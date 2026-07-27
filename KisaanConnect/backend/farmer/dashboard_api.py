import csv
import io

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
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


REQUIRED_CSV_COLUMNS = {"name", "quantity", "unit", "price_per_unit"}
OPTIONAL_CSV_COLUMNS = {"description", "location", "available", "image_url"}


def _require_farmer(user):
    if user['role'] != 'farmer':
        raise HTTPException(403, 'Only farmers can manage crop listings')


# --------------------------------------------------
# FIXED-PATH ROUTES FIRST (must come before /{crop_id})
# --------------------------------------------------

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


@router.post('/bulk-upload')
async def bulk_upload_crops(file: UploadFile = File(...), user=Depends(get_current_user_full)):
    _require_farmer(user)

    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(400, 'Please upload a .csv file')

    raw = await file.read()
    try:
        text = raw.decode('utf-8-sig')
    except UnicodeDecodeError:
        raise HTTPException(400, 'Could not read file. Please save it as UTF-8 CSV and try again.')

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise HTTPException(400, 'CSV appears to be empty')

    headers = {h.strip() for h in reader.fieldnames}
    missing = REQUIRED_CSV_COLUMNS - headers
    if missing:
        raise HTTPException(400, f"Missing required columns: {', '.join(sorted(missing))}")

    succeeded = []
    failed = []

    with get_db() as conn:
        cur = conn.cursor()
        for i, row in enumerate(reader, start=2):
            try:
                name = (row.get('name') or '').strip()
                quantity_raw = (row.get('quantity') or '').strip()
                unit = (row.get('unit') or '').strip()
                price_raw = (row.get('price_per_unit') or '').strip()

                if not name:
                    raise ValueError('name is required')
                if not unit:
                    raise ValueError('unit is required')

                quantity = float(quantity_raw)
                if quantity <= 0:
                    raise ValueError('quantity must be greater than 0')

                price_per_unit = float(price_raw)
                if price_per_unit <= 0:
                    raise ValueError('price_per_unit must be greater than 0')

                description = (row.get('description') or '').strip() or None
                location = (row.get('location') or '').strip() or None
                image_url = (row.get('image_url') or '').strip() or None
                available_raw = (row.get('available') or 'true').strip().lower()
                available = available_raw not in ('false', '0', 'no')

                cur.execute('''
                    INSERT INTO crops (name, quantity, unit, price_per_unit, description, location, available, farmer_id, image_url)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id, name
                ''', (name, quantity, unit, price_per_unit, description, location, available, user['id'], image_url))

                result = cur.fetchone()
                succeeded.append({'row': i, 'id': result['id'], 'name': result['name']})

            except ValueError as e:
                failed.append({'row': i, 'name': row.get('name', ''), 'error': str(e)})
            except Exception:
                failed.append({'row': i, 'name': row.get('name', ''), 'error': 'Unexpected error, please check this row'})

        conn.commit()

    return {
        'total_rows': len(succeeded) + len(failed),
        'succeeded_count': len(succeeded),
        'failed_count': len(failed),
        'succeeded': succeeded,
        'failed': failed,
    }


@router.get('/sales-summary')
async def farmer_sales_summary(user=Depends(get_current_user_full)):
    _require_farmer(user)
    farmer_id = user['id']

    with get_db() as conn:
        cur = conn.cursor()

        cur.execute('''
            SELECT
                DATE_TRUNC('week', created_at)::date AS week_start,
                SUM(total_amount) AS revenue,
                COUNT(*) AS order_count
            FROM orders
            WHERE farmer_id = %s
              AND created_at >= NOW() - INTERVAL '8 weeks'
              AND status != 'cancelled'
            GROUP BY week_start
            ORDER BY week_start ASC
        ''', (farmer_id,))
        weekly = [
            {
                'week_start': row['week_start'].isoformat(),
                'revenue': round(float(row['revenue'] or 0), 2),
                'order_count': row['order_count'],
            }
            for row in cur.fetchall()
        ]

        cur.execute('''
            SELECT
                oi.crop_name,
                SUM(oi.quantity * oi.unit_price) AS revenue,
                SUM(oi.quantity) AS total_quantity
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE oi.farmer_id = %s
              AND o.status != 'cancelled'
            GROUP BY oi.crop_name
            ORDER BY revenue DESC
            LIMIT 10
        ''', (farmer_id,))
        top_crops = [
            {
                'crop_name': row['crop_name'],
                'revenue': round(float(row['revenue'] or 0), 2),
                'total_quantity': float(row['total_quantity'] or 0),
            }
            for row in cur.fetchall()
        ]

        cur.execute('''
            SELECT
                SUM(total_amount) AS total_revenue,
                COUNT(*) AS total_orders
            FROM orders
            WHERE farmer_id = %s AND status != 'cancelled'
        ''', (farmer_id,))
        totals_row = cur.fetchone()

    return {
        'weekly_revenue': weekly,
        'top_crops': top_crops,
        'total_revenue': round(float(totals_row['total_revenue'] or 0), 2),
        'total_orders': totals_row['total_orders'] or 0,
    }


# --------------------------------------------------
# DYNAMIC /{crop_id} ROUTES LAST
# --------------------------------------------------

@router.get('/{crop_id}', response_model=CropListing)
async def get_crop(crop_id: int):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT * FROM crops WHERE id = %s', (crop_id,))
        crop = cur.fetchone()
    if not crop:
        raise HTTPException(404, 'Crop not found')
    return dict(crop)


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