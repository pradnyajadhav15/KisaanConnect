from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional

from auth.auth_api import get_current_user_full
from database import get_db

router = APIRouter()


class CropInput(BaseModel):
    name: str = Field(..., min_length=1)
    quantity: float = Field(..., gt=0)
    unit: str = Field(..., min_length=1)
    price_per_unit: float = Field(..., gt=0)
    description: Optional[str] = None
    location: Optional[str] = None
    available: bool = True
    image_url: Optional[str] = None

class CropListing(CropInput):
    id: int
    farmer_id: int


def _require_farmer(user):
    if user['role'] != 'farmer':
        raise HTTPException(403, 'Only farmers can manage crop listings')


@router.get('/mine', response_model=List[CropListing])
async def get_my_crops(user=Depends(get_current_user_full)):
    _require_farmer(user)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT * FROM crops WHERE farmer_id = %s ORDER BY created_at DESC', (user['id'],))
        return [dict(r) for r in cur.fetchall()]


@router.get('/', response_model=List[CropListing])
async def get_all_crops():
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT * FROM crops WHERE available = TRUE AND quantity > 0 ORDER BY created_at DESC')
        return [dict(r) for r in cur.fetchall()]


@router.get('/{crop_id}', response_model=CropListing)
async def get_crop(crop_id: int):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT * FROM crops WHERE id = %s', (crop_id,))
        crop = cur.fetchone()
    if not crop:
        raise HTTPException(404, 'Crop not found')
    return dict(crop)


@router.post('/', response_model=CropListing)
async def create_crop(crop: CropInput, user=Depends(get_current_user_full)):
    _require_farmer(user)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('''
            INSERT INTO crops (name, quantity, unit, price_per_unit, description, location, available, farmer_id, image_url)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
        ''', (crop.name, crop.quantity, crop.unit, crop.price_per_unit, crop.description,
              crop.location, crop.available, user['id'], crop.image_url))
        crop_id = cur.fetchone()['id']
        cur.execute('SELECT * FROM crops WHERE id = %s', (crop_id,))
        return dict(cur.fetchone())


@router.put('/{crop_id}', response_model=CropListing)
async def update_crop(crop_id: int, crop: CropInput, user=Depends(get_current_user_full)):
    _require_farmer(user)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT id FROM crops WHERE id = %s AND farmer_id = %s', (crop_id, user['id']))
        if not cur.fetchone():
            raise HTTPException(404, 'Crop not found or not yours')
        cur.execute('''
            UPDATE crops SET name=%s, quantity=%s, unit=%s, price_per_unit=%s,
                description=%s, location=%s, available=%s, image_url=%s
            WHERE id = %s
        ''', (crop.name, crop.quantity, crop.unit, crop.price_per_unit, crop.description,
              crop.location, crop.available, crop.image_url, crop_id))
        cur.execute('SELECT * FROM crops WHERE id = %s', (crop_id,))
        return dict(cur.fetchone())


@router.delete('/{crop_id}')
async def delete_crop(crop_id: int, user=Depends(get_current_user_full)):
    _require_farmer(user)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT id FROM crops WHERE id = %s AND farmer_id = %s', (crop_id, user['id']))
        if not cur.fetchone():
            raise HTTPException(404, 'Crop not found or not yours')
        cur.execute('DELETE FROM crops WHERE id = %s', (crop_id,))
    return {'message': 'Crop deleted successfully'}


@router.get('/dashboard/stats')
async def farmer_dashboard_stats(user=Depends(get_current_user_full)):
    _require_farmer(user)
    farmer_id = user['id']
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT COUNT(*) as c FROM crops WHERE farmer_id = %s', (farmer_id,))
        total_crops = cur.fetchone()['c']
        cur.execute('SELECT SUM(quantity) as s FROM crops WHERE farmer_id = %s', (farmer_id,))
        total_quantity = cur.fetchone()['s'] or 0
        cur.execute('SELECT SUM(quantity * price_per_unit) as s FROM crops WHERE farmer_id = %s', (farmer_id,))
        total_value = cur.fetchone()['s'] or 0
        cur.execute('SELECT name, COUNT(*) as count FROM crops WHERE farmer_id = %s GROUP BY name', (farmer_id,))
        crops_by_type = [dict(r) for r in cur.fetchall()]
    return {'total_crops': total_crops, 'total_quantity': round(total_quantity, 2),
            'total_value': round(total_value, 2), 'crops_by_type': crops_by_type}
