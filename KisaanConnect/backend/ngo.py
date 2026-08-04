import os
import hmac
import hashlib
from typing import Optional
from decimal import Decimal

import razorpay
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, EmailStr
from dotenv import load_dotenv
from pathlib import Path

from auth.auth_api import get_current_user_full
from database import get_db

load_dotenv(Path(__file__).parent / '.env')

RAZORPAY_KEY_ID = os.getenv('RAZORPAY_KEY_ID')
RAZORPAY_KEY_SECRET = os.getenv('RAZORPAY_KEY_SECRET')
client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

MIN_DONATION = 10
MAX_DONATION = 100000

router = APIRouter()


class DonateRequest(BaseModel):
    ngo_id: int
    amount: float = Field(..., gt=0)
    donor_name: Optional[str] = Field(None, max_length=200)
    donor_email: Optional[EmailStr] = None
    is_anonymous: bool = False
    message: Optional[str] = Field(None, max_length=500)


class VerifyDonation(BaseModel):
    donation_id: int
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@router.get('/ngos')
async def list_ngos(focus: Optional[str] = None):
    sql = """
        SELECT n.*,
               (SELECT COUNT(*) FROM donations d
                WHERE d.ngo_id = n.id AND d.payment_status = 'paid') AS donor_count
        FROM ngos n
        WHERE n.is_active = TRUE
    """
    params = []
    if focus:
        sql += ' AND n.focus_area ILIKE %s'
        params.append(f'%{focus}%')
    sql += ' ORDER BY n.is_verified DESC, n.total_raised DESC'

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(sql, tuple(params))
        return {'ngos': cur.fetchall()}


@router.get('/ngos/{ngo_id}')
async def get_ngo(ngo_id: int):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT * FROM ngos WHERE id = %s AND is_active = TRUE', (ngo_id,))
        ngo = cur.fetchone()
        if not ngo:
            raise HTTPException(404, 'NGO not found')

        cur.execute("""
            SELECT
              CASE WHEN is_anonymous THEN 'Anonymous' ELSE COALESCE(donor_name, 'Supporter') END AS name,
              amount, message, created_at
            FROM donations
            WHERE ngo_id = %s AND payment_status = 'paid'
            ORDER BY created_at DESC LIMIT 10
        """, (ngo_id,))
        recent = cur.fetchall()

    return {'ngo': ngo, 'recent_donations': recent}


@router.post('/donate')
async def create_donation(body: DonateRequest, user=Depends(get_current_user_full)):
    if body.amount < MIN_DONATION:
        raise HTTPException(400, f'Minimum donation is Rs. {MIN_DONATION}')
    if body.amount > MAX_DONATION:
        raise HTTPException(400, f'Maximum donation is Rs. {MAX_DONATION}')

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT id, name FROM ngos WHERE id = %s AND is_active = TRUE', (body.ngo_id,))
        ngo = cur.fetchone()
        if not ngo:
            raise HTTPException(404, 'NGO not found')

        amount = Decimal(str(round(body.amount, 2)))
        amount_paise = int(round(float(amount) * 100))

        cur.execute("""
            INSERT INTO donations
              (ngo_id, donor_id, donor_name, donor_email, amount, is_anonymous, message)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
            RETURNING id
        """, (
            body.ngo_id, user['id'],
            body.donor_name or user.get('username'),
            body.donor_email or user.get('email'),
            amount, body.is_anonymous, body.message,
        ))
        donation_id = cur.fetchone()['id']

        try:
            rzp = client.order.create({
                'amount': amount_paise,
                'currency': 'INR',
                'receipt': f'donate_{donation_id}',
                'payment_capture': 1,
            })
        except Exception as e:
            raise HTTPException(500, 'Could not create payment order: ' + str(e))

        cur.execute(
            'UPDATE donations SET razorpay_order_id = %s WHERE id = %s',
            (rzp['id'], donation_id)
        )

    return {
        'donation_id': donation_id,
        'ngo_name': ngo['name'],
        'razorpay_order_id': rzp['id'],
        'amount': amount_paise,
        'currency': 'INR',
        'key_id': RAZORPAY_KEY_ID,
    }


@router.post('/verify')
async def verify_donation(body: VerifyDonation, user=Depends(get_current_user_full)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT * FROM donations WHERE id = %s', (body.donation_id,))
        d = cur.fetchone()

        if not d:
            raise HTTPException(404, 'Donation not found')
        if d['donor_id'] != user['id']:
            raise HTTPException(403, 'Not your donation')
        if d['razorpay_order_id'] != body.razorpay_order_id:
            raise HTTPException(400, 'Order mismatch')
        if d['payment_status'] == 'paid':
            return {'message': 'Already verified', 'payment_status': 'paid'}

        expected = hmac.new(
            RAZORPAY_KEY_SECRET.encode(),
            (body.razorpay_order_id + '|' + body.razorpay_payment_id).encode(),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(expected, body.razorpay_signature):
            cur.execute(
                "UPDATE donations SET payment_status = 'failed' WHERE id = %s",
                (body.donation_id,)
            )
            raise HTTPException(400, 'Payment signature verification failed')

        cur.execute("""
            UPDATE donations
            SET payment_status = 'paid', razorpay_payment_id = %s
            WHERE id = %s
        """, (body.razorpay_payment_id, body.donation_id))

        cur.execute(
            'UPDATE ngos SET total_raised = total_raised + %s WHERE id = %s',
            (d['amount'], d['ngo_id'])
        )

    return {'message': 'Thank you for your donation', 'payment_status': 'paid'}


@router.get('/my-donations')
async def my_donations(user=Depends(get_current_user_full)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT d.id, d.amount, d.message, d.payment_status, d.created_at,
                   n.name AS ngo_name, n.logo_url
            FROM donations d
            JOIN ngos n ON n.id = d.ngo_id
            WHERE d.donor_id = %s
            ORDER BY d.created_at DESC
        """, (user['id'],))
        return {'donations': cur.fetchall()}