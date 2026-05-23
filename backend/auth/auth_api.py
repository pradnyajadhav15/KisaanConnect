import os
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, EmailStr
import jwt
from jwt import PyJWTError as JWTError

from auth.db_setup import hash_password, verify_password, DB_PATH


# =========================================
# ROUTER & AUTH SETUP
# =========================================

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# JWT config — secret MUST come from the environment.
# Fail loudly at startup if it's missing rather than silently using a weak default.
SECRET_KEY = os.environ.get("JWT_SECRET")
if not SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET environment variable is not set. "
        "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
    )
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 1


# =========================================
# SCHEMAS
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
# DATABASE HELPERS
# =========================================

def get_user(username: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, username, password_hash, role, name, email FROM users WHERE username = ?",
        (username,)
    )
    user = cursor.fetchone()
    conn.close()
    if user:
        return {"id": user[0], "username": user[1], "password_hash": user[2],
                "role": user[3], "name": user[4], "email": user[5]}
    return None


def get_user_by_email(email: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    conn.close()
    return user


def authenticate_user(username: str, password: str):
    user = get_user(username)
    if not user:
        # Still run a verify to reduce timing differences between
        # "no such user" and "wrong password". Cheap defensive habit.
        verify_password(password, "$2b$12$" + "x" * 53)
        return False
    if not verify_password(password, user["password_hash"]):
        return False
    return user


# =========================================
# JWT HELPERS
# =========================================

def create_access_token(username: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    payload = {"sub": username, "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# =========================================
# REGISTER
# =========================================

@router.post("/register", response_model=Token)
async def register_user(user: UserCreate):
    if get_user(user.username):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Username already registered")

    if user.email and get_user_by_email(user.email):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (username, password_hash, role, name, email) VALUES (?, ?, ?, ?, ?)",
            (user.username, hash_password(user.password), user.role, user.name, user.email)
        )
        conn.commit()
        token = create_access_token(user.username, user.role)
        return {"access_token": token, "token_type": "bearer",
                "role": user.role, "username": user.username}
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, f"Failed to register: {str(e)}")
    finally:
        conn.close()


# =========================================
# LOGIN (OAUTH FORM)  -- used by Swagger UI and OAuth2 clients
# =========================================

@router.post("/login", response_model=Token)
async def login_user(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect username or password",
                            headers={"WWW-Authenticate": "Bearer"})
    token = create_access_token(user["username"], user["role"])
    return {"access_token": token, "token_type": "bearer",
            "role": user["role"], "username": user["username"]}


# =========================================
# LOGIN (JSON)  -- used by your React frontend
# =========================================

@router.post("/login/user", response_model=Token)
async def login_user_json(user: UserLogin):
    auth_user = authenticate_user(user.username, user.password)
    if not auth_user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect username or password",
                            headers={"WWW-Authenticate": "Bearer"})
    token = create_access_token(auth_user["username"], auth_user["role"])
    return {"access_token": token, "token_type": "bearer",
            "role": auth_user["role"], "username": auth_user["username"]}


# =========================================
# GET CURRENT USER (DEPENDENCY)
# =========================================

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Verifies the JWT signature/expiry. No DB hit, no in-memory store.
    Returns a lightweight identity dict from the token payload.
    Use get_current_user_full below when you need name/email/id.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        role = payload.get("role")
        if username is None:
            raise JWTError("missing subject")
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token",
                            headers={"WWW-Authenticate": "Bearer"})
    return {"username": username, "role": role}


async def get_current_user_full(identity=Depends(get_current_user)):
    """Use this dependency on endpoints that actually need the full user row."""
    user = get_user(identity["username"])
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found",
                            headers={"WWW-Authenticate": "Bearer"})
    return user


# =========================================
# PROFILE & LOGOUT
# =========================================

@router.get("/me")
async def read_users_me(current_user=Depends(get_current_user_full)):
    return {"id": current_user["id"], "username": current_user["username"],
            "role": current_user["role"], "name": current_user["name"],
            "email": current_user["email"]}


@router.post("/logout")
async def logout():
    """
    With stateless JWTs there is no server-side session to destroy.
    The client logs out by deleting its stored token.
    This endpoint exists so the frontend has something to call.

    If you later need true server-side revocation (instant ban / force logout),
    add a small 'revoked_tokens' table or a Redis set and check it in
    get_current_user. Not needed for a pilot.
    """
    return {"message": "Logged out — please discard your token client-side."}