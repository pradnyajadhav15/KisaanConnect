from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional

from auth.auth_api import get_current_user_full
from database import get_db
from notifications import send_order_status_update

router = APIRouter()


def _require_admin(user):
    if user['role'] != 'admin':
        raise HTTPException(403, 'Admin access required')


@router.get('/stats')
async def admin_stats(user=Depends(get_current_user_full)):
    _require_admin(user)
    with get_db() as conn:
        cur = conn.cursor()

        cur.execute("SELECT COUNT(*) as c FROM users WHERE role = 'farmer'")
        total_farmers = cur.fetchone()['c']

        cur.execute("SELECT COUNT(*) as c FROM users WHERE role = 'consumer'")
        total_consumers = cur.fetchone()['c']

        cur.execute('SELECT COUNT(*) as c FROM crops')
        total_crops = cur.fetchone()['c']

        cur.execute('SELECT COUNT(*) as c FROM orders')
        total_orders = cur.fetchone()['c']

        cur.execute('SELECT SUM(total_amount) as s FROM orders')
        total_gmv = cur.fetchone()['s'] or 0

        cur.execute('SELECT status, COUNT(*) as c FROM orders GROUP BY status')
        orders_by_status = [dict(r) for r in cur.fetchall()]

        cur.execute('''
            SELECT COUNT(*) as c FROM orders
            WHERE created_at >= NOW() - INTERVAL '7 days'
        ''')
        orders_last_7_days = cur.fetchone()['c']

    return {
        'total_farmers': total_farmers,
        'total_consumers': total_consumers,
        'total_crops': total_crops,
        'total_orders': total_orders,
        'total_gmv': round(total_gmv, 2),
        'orders_by_status': orders_by_status,
        'orders_last_7_days': orders_last_7_days,
    }


@router.get('/users')
async def list_users(role: Optional[str] = None, user=Depends(get_current_user_full)):
    _require_admin(user)
    with get_db() as conn:
        cur = conn.cursor()
        if role:
            cur.execute(
                'SELECT id, username, role, name, email, created_at FROM users WHERE role = %s ORDER BY created_at DESC',
                (role,)
            )
        else:
            cur.execute(
                'SELECT id, username, role, name, email, created_at FROM users ORDER BY created_at DESC'
            )
        return [dict(r) for r in cur.fetchall()]


@router.get('/users/{user_id}')
async def get_user_detail(user_id: int, user=Depends(get_current_user_full)):
    _require_admin(user)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            'SELECT id, username, role, name, email, created_at FROM users WHERE id = %s',
            (user_id,)
        )
        target = cur.fetchone()
        if not target:
            raise HTTPException(404, 'User not found')

        result = dict(target)

        if target['role'] == 'farmer':
            cur.execute('SELECT COUNT(*) as c FROM crops WHERE farmer_id = %s', (user_id,))
            result['total_crops'] = cur.fetchone()['c']
            cur.execute('SELECT COUNT(*) as c FROM orders WHERE farmer_id = %s', (user_id,))
            result['total_orders_received'] = cur.fetchone()['c']
        elif target['role'] == 'consumer':
            cur.execute('SELECT COUNT(*) as c FROM orders WHERE consumer_id = %s', (user_id,))
            result['total_orders_placed'] = cur.fetchone()['c']

    return result


@router.delete('/users/{user_id}')
async def delete_user(user_id: int, user=Depends(get_current_user_full)):
    _require_admin(user)
    if user_id == user['id']:
        raise HTTPException(400, 'Cannot delete your own admin account')
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT id, role FROM users WHERE id = %s', (user_id,))
        target = cur.fetchone()
        if not target:
            raise HTTPException(404, 'User not found')
        cur.execute('DELETE FROM users WHERE id = %s', (user_id,))
    return {'message': 'User deleted successfully'}


@router.get('/crops')
async def list_all_crops(user=Depends(get_current_user_full)):
    _require_admin(user)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('''
            SELECT c.*, u.username as farmer_username
            FROM crops c
            JOIN users u ON u.id = c.farmer_id
            ORDER BY c.created_at DESC
        ''')
        return [dict(r) for r in cur.fetchall()]


@router.patch('/crops/{crop_id}/toggle-availability')
async def toggle_crop_availability(crop_id: int, user=Depends(get_current_user_full)):
    _require_admin(user)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT available FROM crops WHERE id = %s', (crop_id,))
        crop = cur.fetchone()
        if not crop:
            raise HTTPException(404, 'Crop not found')
        new_status = not crop['available']
        cur.execute('UPDATE crops SET available = %s WHERE id = %s', (new_status, crop_id))
    return {'message': 'Crop availability updated', 'available': new_status}


@router.delete('/crops/{crop_id}')
async def admin_delete_crop(crop_id: int, user=Depends(get_current_user_full)):
    _require_admin(user)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT id FROM crops WHERE id = %s', (crop_id,))
        if not cur.fetchone():
            raise HTTPException(404, 'Crop not found')
        cur.execute('DELETE FROM crops WHERE id = %s', (crop_id,))
    return {'message': 'Crop removed by admin'}


@router.get('/orders')
async def list_all_orders(status: Optional[str] = None, user=Depends(get_current_user_full)):
    _require_admin(user)
    with get_db() as conn:
        cur = conn.cursor()
        if status:
            cur.execute('SELECT * FROM orders WHERE status = %s ORDER BY created_at DESC', (status,))
        else:
            cur.execute('SELECT * FROM orders ORDER BY created_at DESC')
        orders = [dict(r) for r in cur.fetchall()]
        for o in orders:
            cur.execute('SELECT * FROM order_items WHERE order_id = %s', (o['id'],))
            o['items'] = [dict(r) for r in cur.fetchall()]
    return {'orders': orders, 'total': len(orders)}


class StatusUpdate(BaseModel):
    status: str


@router.patch('/orders/{order_id}/status')
async def admin_update_order_status(order_id: int, body: StatusUpdate, user=Depends(get_current_user_full)):
    _require_admin(user)
    valid_statuses = {'pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'}
    if body.status not in valid_statuses:
        raise HTTPException(400, 'Invalid status')
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('''
            SELECT o.id, u.email FROM orders o
            JOIN users u ON u.id = o.consumer_id
            WHERE o.id = %s
        ''', (order_id,))
        order_row = cur.fetchone()
        if not order_row:
            raise HTTPException(404, 'Order not found')
        cur.execute('UPDATE orders SET status = %s WHERE id = %s', (body.status, order_id))

    send_order_status_update(order_row['email'], order_id, body.status)

    return {'message': 'Order status updated', 'status': body.status}

