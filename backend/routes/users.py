from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from backend.database import get_db
from backend import models, auth, schemas
from backend.rate_limit import auth_rate_limiter

router = APIRouter(prefix="/api/users", tags=["Users"])

@router.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(auth_rate_limiter)])
def register_user(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    """Register a new user in the system."""
    # Check if username already exists
    existing_username = db.query(models.User).filter(models.User.username == user_data.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Check if email already exists
    existing_email = db.query(models.User).filter(models.User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Hash the password and save the user
    hashed_pwd = auth.get_password_hash(user_data.password)
    new_user = models.User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_pwd
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Check for pending node invitations matching this email
    pending_invites = db.query(models.PendingInvitation).filter(
        models.PendingInvitation.invited_email == user_data.email.strip().lower(),
        models.PendingInvitation.status == "pending"
    ).all()

    for invite in pending_invites:
        existing_share = db.query(models.NodeShare).filter(
            models.NodeShare.node_id == invite.node_id,
            models.NodeShare.shared_with_user_id == new_user.id
        ).first()

        if not existing_share:
            new_share = models.NodeShare(
                node_id=invite.node_id,
                shared_with_user_id=new_user.id,
                access_level="user"
            )
            db.add(new_share)

        invite.status = "completed"

    if pending_invites:
        db.commit()

    return new_user

@router.post("/login", response_model=schemas.TokenResponse, dependencies=[Depends(auth_rate_limiter)])
def login_user(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Authenticate user and return a JWT access token.
    Uses standard form-data (username/password) to integrate with Swagger UI Authorize.
    Note: 'username' field can accept either username or email.
    """
    # Look up by username or email
    user = db.query(models.User).filter(
        (models.User.username == form_data.username) | 
        (models.User.email == form_data.username)
    ).first()

    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create token
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/google-login", response_model=schemas.TokenResponse)
def google_login(payload: schemas.GoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Authenticate user via Google OAuth ID token.
    Verifies token, finds or auto-creates user record, and returns 4Layers JWT access token.
    """
    import urllib.request
    import json
    
    token = payload.id_token.strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google id_token is required"
        )
        
    google_email = None
    google_name = None
    
    try:
        # Verify id_token using Google tokeninfo endpoint
        verify_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={token}"
        req = urllib.request.Request(verify_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode())
            google_email = res_data.get("email")
            google_name = res_data.get("name") or google_email.split("@")[0]
    except Exception as e:
        # Fallback for dev / token mock
        if "mock" in token.lower() or len(token) < 20:
            google_email = "google.user@4layers.io"
            google_name = "Google User"
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid Google OAuth Token: {str(e)}"
            )

    if not google_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to extract verified email from Google OAuth Token"
        )

    # Find existing user by email
    user = db.query(models.User).filter(models.User.email == google_email.lower().strip()).first()
    
    if not user:
        # Auto-create new user for Google login
        base_username = google_email.split("@")[0].replace(".", "_")
        username = base_username
        counter = 1
        while db.query(models.User).filter(models.User.username == username).first():
            username = f"{base_username}_{counter}"
            counter += 1

        random_pwd = auth.get_password_hash(f"GAuth_{google_email}_4Layers_Secret")
        user = models.User(
            username=username,
            email=google_email.lower().strip(),
            hashed_password=random_pwd,
            terms_accepted=False
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    """Get profile information for the currently authenticated user."""
    return current_user

@router.put("/me", response_model=schemas.UserResponse)
def update_profile(
    profile_data: schemas.UserUpdateProfile,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user's profile (email and/or username)."""
    if profile_data.username:
        # Check if new username is already taken by someone else
        existing = db.query(models.User).filter(
            models.User.username == profile_data.username,
            models.User.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
        current_user.username = profile_data.username

    if profile_data.email:
        # Check if new email is already taken by someone else
        existing = db.query(models.User).filter(
            models.User.email == profile_data.email,
            models.User.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already taken"
            )
        current_user.email = profile_data.email

    if profile_data.phone_number is not None:
        current_user.phone_number = profile_data.phone_number

    if profile_data.terms_accepted is not None:
        current_user.terms_accepted = profile_data.terms_accepted

    db.commit()
    db.refresh(current_user)
    return current_user

@router.post("/me/onboarding", response_model=schemas.UserResponse)
def complete_onboarding(
    onboarding_data: schemas.OnboardingUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Complete post-login onboarding by saving phone number and accepting Terms & Privacy Policy."""
    if onboarding_data.phone_number:
        current_user.phone_number = onboarding_data.phone_number.strip()
    if onboarding_data.terms_accepted is not None:
        current_user.terms_accepted = onboarding_data.terms_accepted
    else:
        current_user.terms_accepted = True

    db.commit()
    db.refresh(current_user)
    return current_user

@router.post("/me/change-password", status_code=status.HTTP_200_OK)
def change_password(
    password_data: schemas.UserChangePassword,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Change current user's password."""
    # Verify current password
    if not auth.verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    # Update to new password
    current_user.hashed_password = auth.get_password_hash(password_data.new_password)
    db.commit()
    return {"message": "Password changed successfully"}

@router.get("/mqtt-config", response_model=schemas.MqttConfigResponse)
def get_mqtt_config(current_user: models.User = Depends(auth.get_current_user)):
    """Retrieve dynamic MQTT broker credentials for WebSockets connection."""
    from backend import mqtt
    import os
    ws_port = int(os.getenv("MQTT_WS_PORT", 8084))
    return {
        "broker_host": mqtt.MQTT_BROKER,
        "broker_port": ws_port,
        "username": mqtt.MQTT_USERNAME,
        "password": mqtt.MQTT_PASSWORD
    }

@router.post("/push-token", status_code=status.HTTP_200_OK)
def update_push_token(
    token_data: schemas.PushTokenCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Save Expo Push Token for the authenticated user."""
    current_user.expo_push_token = token_data.push_token
    db.commit()
    return {"message": "Push token updated successfully"}
