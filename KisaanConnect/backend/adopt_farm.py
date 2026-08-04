import os
import hmac
import hashlib
from typing import Optional, List
from decimal import Decimal

import razorpay
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from pathlib import Path

from auth.auth_api import get_current_user_full
from database import get_db

load_dotenv(Path(__file__).parent / '.env')

RAZORPAY_KEY_ID = os.getenv('RAZORPAY_KEY_ID')
RAZORPAY_KEY_SECRET = os.getenv('RAZORPAY_KEY_SECRET')
client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

router = APIRouter()


class PlotCreate(BaseModel):
    title: str = Field(..., max_length=200)
    description: Optional[str] = None
    crop_type: str = Field(..., max_length=100)
    location: str = Field(..., max_length=200)
    area_guntha: float = Field(..., gt=0)
    price_per_season: float = Field(..., gt=0)
    expected_yield_kg: Optional[float] = None
    season_start: Optional[str] = None
    season_end: Optional[str] = None
    slots_total: int = Field(1, ge=1)
    image_url: Optional[str] = None


class AdoptRequest(BaseModel):
    plot_id: int


class VerifyAdoption(BaseModel):
    adoption_id: int
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class UpdateCreate(BaseModel):
    title: str = Field(..., max_length=200)
    body: Optional[str] = None
    image_url: Optional[str] = None


@router.get('/plots')
async def list_plots(crop: Optional[str] = None, location: Optional[str] = None):
    sql = """
        SELECT p.*, u.username AS farmer_name,
               (p.slots_total - p.slots_taken) AS slots_available
        FROM farm_plots p
        JOIN users u ON u.id = p.farmer_id
        WHERE p.is_active = TRUE
    """
    params = []
    if crop:
        sql += ' AND LOWER(p.crop_type) = LOWER(%s)'
        params.append(crop)
    if location:
        sql += ' AND p.location ILIKE %s'
        params.append(f'%{location}%')
    sql += ' ORDER BY p.created_at DESC'

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(sql, tuple(params))
        return {'plots': cur.fetchall()}


@router.get('/plots/{plot_id}')
async def get_plot(plot_id: int):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT p.*, u.username AS farmer_name,
                   (p.slots_total - p.slots_taken) AS slots_available
            FROM farm_plots p
            JOIN users u ON u.id = p.farmer_id
            WHERE p.id = %s AND p.is_active = TRUE
        """, (plot_id,))
        plot = cur.fetchone()
        if not plot:
            raise HTTPException(404, 'Plot not found')

        cur.execute("""
            SELECT id, title, body, image_url, created_at
            FROM plot_updates WHERE plot_id = %s
            ORDER BY created_at DESC LIMIT 20
        """, (plot_id,))
        updates = cur.fetchall()

    return {'plot': plot, 'updates': updates}


@router.post('/plots')
async def create_plot(body: PlotCreate, user=Depends(get_current_user_full)):
    if user.get('role') != 'farmer':
        raise HTTPException(403, 'Only farmers can list plots')

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO farm_plots
              (farmer_id, title, description, crop_type, location, area_guntha,
               price_per_season, expected_yield_kg, season_start, season_end,
               slots_total, image_url)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING *
        """, (
            user['id'], body.title, body.description, body.crop_type, body.location,
            body.area_guntha, body.price_per_season, body.expected_yield_kg,
            body.season_start or None, body.season_end or None,
            body.slots_total, body.image_url,
        ))
        return {'plot': cur.fetchone()}


@router.get('/my-plots')
async def my_plots(user=Depends(get_current_user_full)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT p.*, (p.slots_total - p.slots_taken) AS slots_available
            FROM farm_plots p WHERE p.farmer_id = %s
            ORDER BY p.created_at DESC
        """, (user['id'],))
        return {'plots': cur.fetchall()}


@router.get('/my-adoptions')
async def my_adoptions(user=Depends(get_current_user_full)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT a.*, p.title, p.crop_type, p.location, p.image_url,
                   u.username AS farmer_name
            FROM adoptions a
            JOIN farm_plots p ON p.id = a.plot_id
            JOIN users u ON u.id = p.farmer_id
            WHERE a.consumer_id = %s
            ORDER BY a.created_at DESC
        """, (user['id'],))
        return {'adoptions': cur.fetchall()}


@router.post('/adopt')
async def adopt_plot(body: AdoptRequest, user=Depends(get_current_user_full)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            'SELECT * FROM farm_plots WHERE id = %s AND is_active = TRUE FOR UPDATE',
            (body.plot_id,)
        )
        plot = cur.fetchone()
        if not plot:
            raise HTTPException(404, 'Plot not found')
        if plot['farmer_id'] == user['id']:
            raise HTTPException(400, 'You cannot adopt your own plot')
        if plot['slots_taken'] >= plot['slots_total']:
            raise HTTPException(400, 'No slots left on this plot')

        amount = Decimal(str(plot['price_per_season']))
        amount_paise = int(round(float(amount) * 100))

        cur.execute("""
            INSERT INTO adoptions (plot_id, consumer_id, amount)
            VALUES (%s,%s,%s) RETURNING id
        """, (body.plot_id, user['id'], amount))
        adoption_id = cur.fetchone()['id']

        try:
            rzp = client.order.create({
                'amount': amount_paise,
                'currency': 'INR',
                'receipt': f'adopt_{adoption_id}',
                'payment_capture': 1,
            })
        except Exception as e:
            raise HTTPException(500, 'Could not create payment order: ' + str(e))

        cur.execute(
            'UPDATE adoptions SET razorpay_order_id = %s WHERE id = %s',
            (rzp['id'], adoption_id)
        )

    return {
        'adoption_id': adoption_id,
        'razorpay_order_id': rzp['id'],
        'amount': amount_paise,
        'currency': 'INR',
        'key_id': RAZORPAY_KEY_ID,
    }


@router.post('/verify')
async def verify_adoption(body: VerifyAdoption, user=Depends(get_current_user_full)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT * FROM adoptions WHERE id = %s', (body.adoption_id,))
        adoption = cur.fetchone()

        if not adoption:
            raise HTTPException(404, 'Adoption not found')
        if adoption['consumer_id'] != user['id']:
            raise HTTPException(403, 'Not your adoption')
        if adoption['razorpay_order_id'] != body.razorpay_order_id:
            raise HTTPException(400, 'Order mismatch')
        if adoption['payment_status'] == 'paid':
            return {'message': 'Already verified', 'payment_status': 'paid'}

        expected = hmac.new(
            RAZORPAY_KEY_SECRET.encode(),
            (body.razorpay_order_id + '|' + body.razorpay_payment_id).encode(),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(expected, body.razorpay_signature):
            cur.execute(
                "UPDATE adoptions SET payment_status = 'failed' WHERE id = %s",
                (body.adoption_id,)
            )
            raise HTTPException(400, 'Payment signature verification failed')

        cur.execute("""
            UPDATE adoptions
            SET payment_status = 'paid', status = 'active', razorpay_payment_id = %s
            WHERE id = %s
        """, (body.razorpay_payment_id, body.adoption_id))

        cur.execute(
            'UPDATE farm_plots SET slots_taken = slots_taken + 1 WHERE id = %s',
            (adoption['plot_id'],)
        )

    return {'message': 'Adoption confirmed', 'payment_status': 'paid'}


@router.post('/plots/{plot_id}/updates')
async def post_update(plot_id: int, body: UpdateCreate, user=Depends(get_current_user_full)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT farmer_id FROM farm_plots WHERE id = %s', (plot_id,))
        plot = cur.fetchone()
        if not plot:
            raise HTTPException(404, 'Plot not found')
        if plot['farmer_id'] != user['id']:
            raise HTTPException(403, 'Not your plot')

        cur.execute("""
            INSERT INTO plot_updates (plot_id, farmer_id, title, body, image_url)
            VALUES (%s,%s,%s,%s,%s) RETURNING *
        """, (plot_id, user['id'], body.title, body.body, body.image_url))
        return {'update': cur.fetchone()}