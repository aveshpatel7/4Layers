import os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session

from backend.database import get_db
from backend import models

# Authentication Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "smartnest_super_secret_key_change_me_in_production")
ALGORITHM = "HS256"
# Set token expiration to 1 Year (525,600 minutes) so users stay logged in like SmartLife/Tuya apps
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "525600"))

# OAuth2PasswordBearer extracts token from authorization header.
# We point tokenUrl to the login endpoint.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/users/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain text password against its hashed version."""
    try:
        # bcrypt requires bytes for both arguments
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt."""
    # bcrypt returns bytes; decode to string for DB storage
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generate a JWT token containing data claims."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    """
    FastAPI dependency to retrieve the currently logged-in user from the JWT token.
    Raises 401 Unauthorized if token is invalid or user is not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    return user
