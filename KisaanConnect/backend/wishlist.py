from fastapi import APIRouter, HTTPException, Depends
from auth.auth_api import get_current_user_full
from database import get_db

router = APIRouter()


def _ensure_table():
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS wishlist_items (
                id SERIAL PRIMARY KEY,
                consumer_id INTEGER NOT NULL REFERENCES users(id),
                crop_id INTEGER NOT NULL REFERENCES crops(id),
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(consumer_id, crop_id)
            )
        """)
        conn.commit()


_ensure_table()


def _require_consumer(user):
    if user['role'] != 'consumer':
        raise HTTPException(403, 'Only consumers can use the wishlist')


@router.get('/mine')
async def get_my_wishlist(user=Depends(get_current_user_full)):
    _require_consumer(user)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('''
            SELECT c.*
            FROM wishlist_items w
            JOIN crops c ON c.id = w.crop_id
            WHERE w.consumer_id = %s
            ORDER BY w.created_at DESC
        ''', (user['id'],))
        return [dict(r) for r in cur.fetchall()]


@router.get('/mine/ids')
async def get_my_wishlist_ids(user=Depends(get_current_user_full)):
    _require_consumer(user)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT crop_id FROM wishlist_items WHERE consumer_id = %s', (user['id'],))
        return {'crop_ids': [row['crop_id'] for row in cur.fetchall()]}


@router.post('/{crop_id}')
async def add_to_wishlist(crop_id: int, user=Depends(get_current_user_full)):
    _require_consumer(user)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT id FROM crops WHERE id = %s', (crop_id,))
        if not cur.fetchone():
            raise HTTPException(404, 'Crop not found')
        cur.execute('''
            INSERT INTO wishlist_items (consumer_id, crop_id)
            VALUES (%s, %s)
            ON CONFLICT DO NOTHING
        ''', (user['id'], crop_id))
        conn.commit()
    return {'status': 'added'}


@router.delete('/{crop_id}')
async def remove_from_wishlist(crop_id: int, user=Depends(get_current_user_full)):
    _require_consumer(user)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            'DELETE FROM wishlist_items WHERE consumer_id = %s AND crop_id = %s',
            (user['id'], crop_id),
        )
        conn.commit()
    return {'status': 'removed'}