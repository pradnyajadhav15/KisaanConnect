import os
import razorpay
import hmac
import hashlib
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from dotenv import load_dotenv
from pathlib import Path

from auth.auth_api import get_current_user_full
from database import get_db

load_dotenv(Path(__file__).parent / '.env')

RAZORPAY_KEY_ID = os.getenv('RAZORPAY_KEY_ID')
RAZORPAY_KEY_SECRET = os.getenv('RAZORPAY_KEY_SECRET')

client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

router = APIRouter()


class CreatePaymentOrderRequest(BaseModel):
    order_id: int


class VerifyPaymentRequest(BaseModel):
    order_id: int
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@router.post('/create-order')
async def create_payment_order(body: CreatePaymentOrderRequest, user=Depends(get_current_user_full)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT * FROM orders WHERE id = %s', (body.order_id,))
        order = cur.fetchone()

        if not order:
            raise HTTPException(404, 'Order not found')
        if order['consumer_id'] != user['id']:
            raise HTTPException(403, 'Not your order')
        if order['payment_status'] == 'paid':
            raise HTTPException(400, 'Order already paid')

        amount_paise = int(round(float(order['total_amount']) * 100))

        try:
            razorpay_order = client.order.create({
                'amount': amount_paise,
                'currency': 'INR',
                'receipt': 'order_' + str(body.order_id),
                'payment_capture': 1,
            })
        except Exception as e:
            raise HTTPException(500, 'Could not create payment order: ' + str(e))

        cur.execute(
            'UPDATE orders SET razorpay_order_id = %s, payment_method = %s WHERE id = %s',
            (razorpay_order['id'], 'razorpay', body.order_id)
        )

    return {
        'razorpay_order_id': razorpay_order['id'],
        'amount': amount_paise,
        'currency': 'INR',
        'key_id': RAZORPAY_KEY_ID,
    }


@router.post('/verify')
async def verify_payment(body: VerifyPaymentRequest, user=Depends(get_current_user_full)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT * FROM orders WHERE id = %s', (body.order_id,))
        order = cur.fetchone()

        if not order:
            raise HTTPException(404, 'Order not found')
        if order['consumer_id'] != user['id']:
            raise HTTPException(403, 'Not your order')
        if order['razorpay_order_id'] != body.razorpay_order_id:
            raise HTTPException(400, 'Order mismatch')

        generated_signature = hmac.new(
            RAZORPAY_KEY_SECRET.encode(),
            (body.razorpay_order_id + '|' + body.razorpay_payment_id).encode(),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(generated_signature, body.razorpay_signature):
            cur.execute('UPDATE orders SET payment_status = %s WHERE id = %s', ('failed', body.order_id))
            raise HTTPException(400, 'Payment signature verification failed')

        cur.execute(
            'UPDATE orders SET payment_status = %s, razorpay_payment_id = %s WHERE id = %s',
            ('paid', body.razorpay_payment_id, body.order_id)
        )

    return {'message': 'Payment verified successfully', 'payment_status': 'paid'}
