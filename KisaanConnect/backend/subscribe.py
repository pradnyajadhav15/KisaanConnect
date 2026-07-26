from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from database import get_db

router = APIRouter()


class SubscribeRequest(BaseModel):
    email: Optional[EmailStr] = None
    whatsapp_number: Optional[str] = Field(None, min_length=10, max_length=15)

    def has_contact(self) -> bool:
        return bool(self.email or self.whatsapp_number)


def _ensure_table():
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS subscribers (
                id SERIAL PRIMARY KEY,
                email TEXT,
                whatsapp_number TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(email),
                UNIQUE(whatsapp_number)
            )
        """)
        conn.commit()


_ensure_table()


@router.post('/subscribe')
async def subscribe(req: SubscribeRequest):
    if not req.has_contact():
        raise HTTPException(400, 'Provide an email or WhatsApp number')

    with get_db() as conn:
        cur = conn.cursor()
        try:
            cur.execute(
                """
                INSERT INTO subscribers (email, whatsapp_number)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING
                RETURNING id
                """,
                (req.email, req.whatsapp_number),
            )
            row = cur.fetchone()
            conn.commit()
        except Exception:
            conn.rollback()
            raise HTTPException(500, 'Could not save subscription. Please try again.')

    if row is None:
        return {'status': 'already_subscribed'}
    return {'status': 'subscribed', 'id': row['id']}