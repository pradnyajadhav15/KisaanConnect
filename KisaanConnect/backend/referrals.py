import random
import string

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from auth.auth_api import get_current_user_full
from database import get_db

router = APIRouter()

REFERRAL_DISCOUNT = 50.0


def _ensure_schema():
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE")
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES users(id)")
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_discount_used BOOLEAN DEFAULT FALSE")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS referrals (
                id SERIAL PRIMARY KEY,
                referrer_id INTEGER NOT NULL REFERENCES users(id),
                referred_id INTEGER NOT NULL REFERENCES users(id),
                referrer_reward_applied BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(referred_id)
            )
        """)
        conn.commit()


_ensure_schema()


def generate_referral_code(username: str) -> str:
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    base = ''.join(c for c in username.upper() if c.isalnum())[:6] or 'USER'
    return base + suffix


def get_or_create_referral_code(user_id: int, username: str) -> str:
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT referral_code FROM users WHERE id = %s', (user_id,))
        row = cur.fetchone()
        if row and row['referral_code']:
            return row['referral_code']

        for _ in range(5):
            code = generate_referral_code(username)
            cur.execute('SELECT id FROM users WHERE referral_code = %s', (code,))
            if not cur.fetchone():
                cur.execute('UPDATE users SET referral_code = %s WHERE id = %s', (code, user_id))
                conn.commit()
                return code
        raise HTTPException(500, 'Could not generate a unique referral code, please try again')


def link_referral(new_user_id: int, referral_code: str):
    """Called at registration time if a referral_code was provided."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT id FROM users WHERE referral_code = %s', (referral_code,))
        referrer = cur.fetchone()
        if not referrer:
            raise HTTPException(400, 'Invalid referral code')
        if referrer['id'] == new_user_id:
            raise HTTPException(400, 'You cannot refer yourself')

        cur.execute('UPDATE users SET referred_by = %s WHERE id = %s', (referrer['id'], new_user_id))
        cur.execute(
            'INSERT INTO referrals (referrer_id, referred_id) VALUES (%s, %s) ON CONFLICT DO NOTHING',
            (referrer['id'], new_user_id),
        )
        conn.commit()


def get_referred_discount(user_id: int) -> float:
    """Returns REFERRAL_DISCOUNT if this user was referred and hasn't used their discount yet."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            'SELECT referred_by, referral_discount_used FROM users WHERE id = %s',
            (user_id,),
        )
        row = cur.fetchone()
        if row and row['referred_by'] and not row['referral_discount_used']:
            return REFERRAL_DISCOUNT
    return 0.0


def mark_referral_discount_used(user_id: int):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('UPDATE users SET referral_discount_used = TRUE WHERE id = %s', (user_id,))

        cur.execute('SELECT referred_by FROM users WHERE id = %s', (user_id,))
        referrer_row = cur.fetchone()
        if referrer_row and referrer_row['referred_by']:
            cur.execute(
                'UPDATE referrals SET referrer_reward_applied = TRUE WHERE referred_id = %s AND referrer_reward_applied = FALSE',
                (user_id,),
            )
        conn.commit()


@router.get('/mine')
async def my_referral_info(user=Depends(get_current_user_full)):
    code = get_or_create_referral_code(user['id'], user['username'])
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT COUNT(*) as c FROM referrals WHERE referrer_id = %s', (user['id'],))
        referral_count = cur.fetchone()['c']
        cur.execute(
            'SELECT COUNT(*) as c FROM referrals WHERE referrer_id = %s AND referrer_reward_applied = TRUE',
            (user['id'],),
        )
        rewarded_count = cur.fetchone()['c']

    return {
        'referral_code': code,
        'referral_count': referral_count,
        'rewarded_count': rewarded_count,
        'reward_per_referral': REFERRAL_DISCOUNT,
    }