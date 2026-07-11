import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, EmailStr
import jwt
from jwt import PyJWTError as JWTError

from auth.db_setup import hash_password, verify_password
from database import get_db

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='login')

SECRET_KEY = os.environ.get('JWT_SECRET')
if not SECRET_KEY:
    raise RuntimeError('JWT_SECRET environment variable is not set.')
ALGORITHM = 'HS256'
TOKEN_EXPIRE_DAYS = 1


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    role: str = Field(..., pattern='^(farmer|consumer)$')
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


def get_user(username: str):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT id, username, password_hash, role, name, email FROM users WHERE username = %s', (username,))
        row = cur.fetchone()
        return dict(row) if row else None


def get_user_by_email(email: str):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT id FROM users WHERE email = %s', (email,))
        return cur.fetchone()


def authenticate_user(username: str, password: str):
    user = get_user(username)
    if not user:
        verify_password(password, '$2b$12$' + 'x' * 53)
        return False
    if not verify_password(password, user['password_hash']):
        return False
    return user


def create_access_token(username: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    payload = {'sub': username, 'role': role, 'exp': expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


@router.post('/register', response_model=Token)
async def register_user(user: UserCreate):
    if get_user(user.username):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, 'Username already registered')
    if user.email and get_user_by_email(user.email):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, 'Email already registered')

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            'INSERT INTO users (username, password_hash, role, name, email) VALUES (%s,%s,%s,%s,%s)',
            (user.username, hash_password(user.password), user.role, user.name, user.email)
        )
    token = create_access_token(user.username, user.role)
    return {'access_token': token, 'token_type': 'bearer', 'role': user.role, 'username': user.username}


@router.post('/login', response_model=Token)
async def login_user(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Incorrect username or password', headers={'WWW-Authenticate': 'Bearer'})
    token = create_access_token(user['username'], user['role'])
    return {'access_token': token, 'token_type': 'bearer', 'role': user['role'], 'username': user['username']}


@router.post('/login/user', response_model=Token)
async def login_user_json(user: UserLogin):
    auth_user = authenticate_user(user.username, user.password)
    if not auth_user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Incorrect username or password', headers={'WWW-Authenticate': 'Bearer'})
    token = create_access_token(auth_user['username'], auth_user['role'])
    return {'access_token': token, 'token_type': 'bearer', 'role': auth_user['role'], 'username': auth_user['username']}


async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get('sub')
        role = payload.get('role')
        if username is None:
            raise JWTError('missing subject')
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Invalid or expired token', headers={'WWW-Authenticate': 'Bearer'})
    return {'username': username, 'role': role}


async def get_current_user_full(identity=Depends(get_current_user)):
    user = get_user(identity['username'])
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'User not found', headers={'WWW-Authenticate': 'Bearer'})
    return user


@router.get('/me')
async def read_users_me(current_user=Depends(get_current_user_full)):
    return {'id': current_user['id'], 'username': current_user['username'], 'role': current_user['role'],
            'name': current_user['name'], 'email': current_user['email']}


@router.post('/logout')
async def logout():
    return {'message': 'Logged out - please discard your token client-side.'}
