from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from auth.auth_api import get_current_user_full
from database import get_db

router = APIRouter()


def _ensure_table():
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS reviews (
                id SERIAL PRIMARY KEY,
                crop_id INTEGER NOT NULL REFERENCES crops(id),
                consumer_id INTEGER NOT NULL REFERENCES users(id),
                rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                comment TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(crop_id, consumer_id)
            )
        """)
        conn.commit()


_ensure_table()


class ReviewInput(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


def _require_consumer(user):
    if user['role'] != 'consumer':
        raise HTTPException(403, 'Only consumers can leave reviews')


@router.get('/crop/{crop_id}')
async def get_crop_reviews(crop_id: int):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('''
            SELECT r.id, r.rating, r.comment, r.created_at, u.name AS consumer_name
            FROM reviews r
            JOIN users u ON u.id = r.consumer_id
            WHERE r.crop_id = %s
            ORDER BY r.created_at DESC
        ''', (crop_id,))
        reviews = [dict(row) for row in cur.fetchall()]

        cur.execute('SELECT AVG(rating) AS avg_rating, COUNT(*) AS count FROM reviews WHERE crop_id = %s', (crop_id,))
        summary = cur.fetchone()

    return {
        'reviews': reviews,
        'average_rating': round(float(summary['avg_rating']), 1) if summary['avg_rating'] else None,
        'review_count': summary['count'],
    }


@router.get('/crop/{crop_id}/can-review')
async def can_review(crop_id: int, user=Depends(get_current_user_full)):
    if user['role'] != 'consumer':
        return {'can_review': False, 'already_reviewed': False}

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('''
            SELECT 1 FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE oi.crop_id = %s AND o.consumer_id = %s
            LIMIT 1
        ''', (crop_id, user['id']))
        has_ordered = cur.fetchone() is not None

        cur.execute('SELECT 1 FROM reviews WHERE crop_id = %s AND consumer_id = %s', (crop_id, user['id']))
        already_reviewed = cur.fetchone() is not None

    return {'can_review': has_ordered and not already_reviewed, 'already_reviewed': already_reviewed}


@router.post('/crop/{crop_id}')
async def submit_review(crop_id: int, review: ReviewInput, user=Depends(get_current_user_full)):
    _require_consumer(user)

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('''
            SELECT 1 FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE oi.crop_id = %s AND o.consumer_id = %s
            LIMIT 1
        ''', (crop_id, user['id']))
        if not cur.fetchone():
            raise HTTPException(403, 'You can only review products you have ordered')

        cur.execute('''
            INSERT INTO reviews (crop_id, consumer_id, rating, comment)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (crop_id, consumer_id)
            DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment
            RETURNING id
        ''', (crop_id, user['id'], review.rating, review.comment))
        review_id = cur.fetchone()['id']
        conn.commit()

    return {'status': 'submitted', 'id': review_id}