import os
import json
import urllib.request
import urllib.parse
import base64
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import RedirectResponse, JSONResponse
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

    if not getattr(user, "is_active", True):
        reason = getattr(user, "block_reason", None) or "Account suspended by administrator."
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": "Account blocked", "reason": reason}
        )

    # Create token
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "972753923440-npkju4948rt72csvuivqnulavv98t9i6.apps.googleusercontent.com")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
PUBLIC_BACKEND_URL = os.getenv("PUBLIC_BACKEND_URL", "https://edabtynvpy.ap-south-1.awsapprunner.com")
APP_DEEP_LINK_SCHEME = "4layers"

def get_google_callback_url(request: Request) -> str:
    base = PUBLIC_BACKEND_URL or str(request.base_url).rstrip("/")
    if base.startswith("http://"):
        base = "https://" + base[7:]
    return f"{base.rstrip('/')}/api/users/google/callback"

@router.get("/google-login", dependencies=[Depends(auth_rate_limiter)])
def google_oauth_start(request: Request):
    """
    Server-side Google OAuth start. Redirects the user's browser to Google's
    consent screen. After consent, Google redirects back to /google/callback.
    """
    callback_url = get_google_callback_url(request)
    print(f"[GOOGLE OAUTH START] Constructing OAuth redirect_uri: {callback_url}", flush=True)
    
    params = urllib.parse.urlencode({
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": callback_url,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    })
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{params}")


@router.get("/google/callback")
def google_oauth_callback(request: Request, code: str = None, error: str = None, db: Session = Depends(get_db)):
    """
    Server-side Google OAuth callback. Exchanges auth code for tokens,
    creates/logs in user, then redirects to the app deep link with JWT.
    """
    if error or not code:
        # Redirect to app with error
        return RedirectResponse(f"{APP_DEEP_LINK_SCHEME}://auth?error={error or 'no_code'}")
    
    callback_url = get_google_callback_url(request)
    print(f"[GOOGLE OAUTH CALLBACK] Using callback_url for token exchange: {callback_url}", flush=True)
    
    # Exchange auth code for tokens
    try:
        token_data = urllib.parse.urlencode({
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": callback_url,
            "grant_type": "authorization_code",
        }).encode("utf-8")
        
        token_req = urllib.request.Request(
            "https://oauth2.googleapis.com/token",
            data=token_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(token_req, timeout=15) as resp:
            token_resp = json.loads(resp.read().decode())
        
        id_token_raw = token_resp.get("id_token", "")
    except Exception as e:
        return RedirectResponse(f"{APP_DEEP_LINK_SCHEME}://auth?error={urllib.parse.quote(str(e))}")
    
    # Decode ID token to get user info
    google_email = None
    google_name = None
    google_picture = None
    
    try:
        parts = id_token_raw.split(".")
        if len(parts) >= 2:
            padding = "=" * (4 - len(parts[1]) % 4)
            decoded_json = json.loads(base64.urlsafe_b64decode(parts[1] + padding).decode("utf-8"))
            google_email = decoded_json.get("email")
            google_name = decoded_json.get("name") or (google_email.split("@")[0] if google_email else "User")
            google_picture = decoded_json.get("picture")
    except Exception:
        pass
    
    if not google_email:
        return RedirectResponse(f"{APP_DEEP_LINK_SCHEME}://auth?error=no_email")
    
    # Find or create user
    user = db.query(models.User).filter(models.User.email == google_email.lower().strip()).first()
    
    if not user:
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
            terms_accepted=False,
            profile_pic_url=google_picture,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if google_picture and user.profile_pic_url != google_picture:
            user.profile_pic_url = google_picture
            db.commit()
            db.refresh(user)
    
    if not getattr(user, "is_active", True):
        reason = getattr(user, "block_reason", None) or "Account suspended by administrator."
        encoded_reason = urllib.parse.quote(reason)
        return RedirectResponse(f"{APP_DEEP_LINK_SCHEME}://auth?error=Account%20blocked&reason={encoded_reason}")

    # Create 4Layers JWT
    jwt_token = auth.create_access_token(data={"sub": user.username})
    
    # Redirect back to app with token via deep link (HTMLResponse to prevent AWS App Runner Location header mangling)
    deep_link = f"{APP_DEEP_LINK_SCHEME}://auth?token={jwt_token}"
    intent_link = f"intent://auth?token={jwt_token}#Intent;scheme={APP_DEEP_LINK_SCHEME};package=com.smartnest.app;end"
    print(f"[GOOGLE OAUTH CALLBACK] Sending HTML JS redirect for deep link: {deep_link}", flush=True)
    
    from fastapi.responses import HTMLResponse
    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <title>Authenticating SmartNest...</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="refresh" content="0;url={deep_link}">
    <script>
        function openApp() {{
            window.location.href = "{deep_link}";
            setTimeout(function() {{
                window.location.href = "{intent_link}";
            }}, 300);
        }}
        window.onload = openApp;
    </script>
    <style>
        body {{ background-color: #0E0E0E; color: white; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px 20px; margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; box-sizing: border-box; }}
        .card {{ background: #1C1B1B; border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); padding: 32px; width: 100%; max-width: 380px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
        .btn {{ display: block; background-color: #22C55E; color: #000; padding: 16px 28px; text-decoration: none; border-radius: 12px; margin-top: 25px; font-weight: bold; font-size: 16px; border: none; width: 100%; box-sizing: border-box; cursor: pointer; text-align: center; }}
        .btn:hover {{ background-color: #16a34a; }}
        .logo {{ font-size: 28px; font-weight: bold; margin-bottom: 8px; color: #fff; }}
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">4Layers <span style="color:#22C55E;">IoT</span></div>
        <h2 style="margin-top: 16px; font-size: 22px;">Login Successful!</h2>
        <p style="color: #9CA3AF; font-size: 14px;">Redirecting back to 4Layers SmartNest app...</p>
        <a href="{deep_link}" onclick="openApp()" class="btn">Open App Now</a>
    </div>
</body>
</html>"""
    return HTMLResponse(content=html_content)


@router.get("/google/{rest:path}")
def handle_mangled_google_path(rest: str, request: Request):
    """
    Fallback handler for AWS App Runner path-mangling (e.g. /api/users/google/4layers://auth?token=...).
    Extracts the token parameter and completes the deep link redirect cleanly.
    """
    full_url = str(request.url)
    print(f"[GOOGLE FALLBACK ROUTE] Intercepted mangled path: {full_url}", flush=True)
    
    token = None
    if "token=" in full_url:
        token = full_url.split("token=")[1].split("&")[0]
        
    if token:
        deep_link = f"{APP_DEEP_LINK_SCHEME}://auth?token={token}"
        intent_link = f"intent://auth?token={token}#Intent;scheme={APP_DEEP_LINK_SCHEME};package=com.smartnest.app;end"
        from fastapi.responses import HTMLResponse
        return HTMLResponse(content=f"""<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="refresh" content="0;url={deep_link}">
    <script>
        function openApp() {{
            window.location.href = "{deep_link}";
            setTimeout(function() {{
                window.location.href = "{intent_link}";
            }}, 300);
        }}
        window.onload = openApp;
    </script>
    <style>
        body {{ background-color: #0E0E0E; color: white; font-family: sans-serif; text-align: center; padding: 40px 20px; margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; box-sizing: border-box; }}
        .card {{ background: #1C1B1B; border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); padding: 32px; width: 100%; max-width: 380px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
        .btn {{ display: block; background-color: #22C55E; color: #000; padding: 16px 28px; text-decoration: none; border-radius: 12px; margin-top: 25px; font-weight: bold; font-size: 16px; border: none; width: 100%; box-sizing: border-box; cursor: pointer; text-align: center; }}
    </style>
</head>
<body>
    <div class="card">
        <div style="font-size: 28px; font-weight: bold; margin-bottom: 8px; color: #fff;">4Layers <span style="color:#22C55E;">IoT</span></div>
        <h2 style="margin-top: 16px; font-size: 22px;">Login Successful!</h2>
        <p style="color: #9CA3AF; font-size: 14px;">Redirecting back to 4Layers SmartNest app...</p>
        <a href="{deep_link}" onclick="openApp()" class="btn">Open App Now</a>
    </div>
</body>
</html>""")
    
    raise HTTPException(status_code=404, detail="Not Found")


@router.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    """Get profile information for the currently authenticated user."""
    return current_user

from typing import Optional, Dict, Any
from fastapi import File, UploadFile, Body, Form
import base64

@router.post("/me/profile-picture", response_model=schemas.UserResponse)
async def upload_profile_picture(
    file: Optional[UploadFile] = File(None),
    profile_pic_url: Optional[str] = Form(None),
    body: Optional[Dict[str, Any]] = Body(None),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload or update profile picture.
    Accepts multipart file upload ('file'), Form parameter ('profile_pic_url'), OR base64 data URI string JSON body.
    Saves image as Base64 string in DB (stateless App Runner safe).
    """
    pic_url = None

    if file:
        contents = await file.read()
        if len(contents) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Image size exceeds 5MB limit")
        mime = file.content_type or "image/jpeg"
        b64_str = base64.b64encode(contents).decode("utf-8")
        pic_url = f"data:{mime};base64,{b64_str}"
    elif profile_pic_url:
        pic_url = profile_pic_url
    elif body and "profile_pic_url" in body:
        pic_url = body["profile_pic_url"]

    if not pic_url:
        raise HTTPException(status_code=400, detail="No image file or profile_pic_url payload provided")

    current_user.profile_pic_url = pic_url
    db.commit()
    db.refresh(current_user)
    print(f"[PROFILE PIC] Updated profile_pic_url for {current_user.username}", flush=True)
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
    # Always force terms_accepted = True (this is the whole point of this endpoint)
    current_user.terms_accepted = True

    # Save phone number (allow None/empty — user may skip)
    if onboarding_data.phone_number is not None:
        phone = onboarding_data.phone_number.strip()
        if phone:
            current_user.phone_number = phone

    db.commit()
    db.refresh(current_user)

    # Debug log to confirm what's being saved
    print(f"[ONBOARDING] User {current_user.username} onboarding complete: phone={current_user.phone_number}, terms_accepted={current_user.terms_accepted}", flush=True)

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
