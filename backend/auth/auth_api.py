from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, EmailStr
import sqlite3
import secrets
from datetime import datetime, timedelta
from typing import Optional

# Import password hashing & database path
from auth.db_setup import hash_password, DB_PATH


# =========================================
# ROUTER & AUTH SETUP
# =========================================

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Temporary token storage (for learning purpose)
# Format:
# {
#   "token": {
#       "username": "...",
#       "role": "...",
#       "expires": datetime
#   }
# }
active_tokens = {}


# =========================================
# INPUT VALIDATION MODELS (SCHEMAS)
# =========================================

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    role: str = Field(..., pattern="^(farmer|consumer)$")
    name: Optional[str] = None
    email: Optional[EmailStr] = None


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str


# =========================================
# DATABASE HELPER FUNCTIONS
# =========================================

def get_user(username: str):
    """Fetch user from database using username"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, username, password_hash, role, name, email FROM users WHERE username = ?",
        (username,)
    )

    user = cursor.fetchone()
    conn.close()

    if user:
        return {
            "id": user[0],
            "username": user[1],
            "password_hash": user[2],
            "role": user[3],
            "name": user[4],
            "email": user[5]
        }

    return None


def authenticate_user(username: str, password: str):
    """Verify username and password"""
    user = get_user(username)
    if not user:
        return False

    password_hash = hash_password(password)

    if password_hash != user["password_hash"]:
        return False

    return user


def create_access_token():
    """Generate random access token"""
    return secrets.token_hex(32)


# =========================================
# REGISTER API
# =========================================

@router.post("/register", response_model=Token)
async def register_user(user: UserCreate):

    if get_user(user.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    password_hash = hash_password(user.password)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO users (username, password_hash, role, name, email)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                user.username,
                password_hash,
                user.role,
                user.name,
                user.email
            )
        )

        conn.commit()

        access_token = create_access_token()
        expires = datetime.utcnow() + timedelta(days=1)

        active_tokens[access_token] = {
            "username": user.username,
            "role": user.role,
            "expires": expires
        }

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "role": user.role,
            "username": user.username
        }

    except Exception as e:
        conn.rollback()
        raise HTTPException(500, f"Failed to register user: {str(e)}")

    finally:
        conn.close()


# =========================================
# LOGIN API (OAUTH FORM LOGIN)
# =========================================

@router.post("/login", response_model=Token)
async def login_user(form_data: OAuth2PasswordRequestForm = Depends()):

    user = authenticate_user(form_data.username, form_data.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token()
    expires = datetime.utcnow() + timedelta(days=1)

    active_tokens[access_token] = {
        "username": user["username"],
        "role": user["role"],
        "expires": expires
    }

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user["role"],
        "username": user["username"]
    }


# =========================================
# LOGIN API (JSON LOGIN FOR FRONTEND)
# =========================================

@router.post("/login/user", response_model=Token)
async def login_user_json(user: UserLogin):

    authenticated_user = authenticate_user(user.username, user.password)

    if not authenticated_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token()
    expires = datetime.utcnow() + timedelta(days=1)

    active_tokens[access_token] = {
        "username": authenticated_user["username"],
        "role": authenticated_user["role"],
        "expires": expires
    }

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": authenticated_user["role"],
        "username": authenticated_user["username"]
    }


# =========================================
# TOKEN VERIFICATION (PROTECTED ROUTES)
# =========================================

async def get_current_user(token: str = Depends(oauth2_scheme)):

    if token not in active_tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_data = active_tokens[token]

    if token_data["expires"] < datetime.utcnow():
        del active_tokens[token]
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_user(token_data["username"])

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


# =========================================
# PROTECTED USER PROFILE
# =========================================

@router.get("/me")
async def read_users_me(current_user = Depends(get_current_user)):

    return {
        "username": current_user["username"],
        "role": current_user["role"],
        "id": current_user["id"],
        "name": current_user["name"],
        "email": current_user["email"]
    }


# =========================================
# LOGOUT API
# =========================================

@router.post("/logout")
async def logout(token: str = Depends(oauth2_scheme)):

    if token in active_tokens:
        del active_tokens[token]

    return {"message": "Successfully logged out"}
