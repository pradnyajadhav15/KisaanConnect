from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid

from auth.auth_api import get_current_user_full
from database import get_db
from notifications import send_order_confirmation

router = APIRouter()


class CartItem(BaseModel):
    id: Optional[int] = None
    crop_id: int
    quantity: float = Field(..., gt=0)
    cart_id: Optional[str] = None
    unit_price: Optional[float] = None
    crop_name: Optional[str] = None

class OrderItemIn(BaseModel):
    crop_id: int
    quantity: float = Field(..., gt=0)

class Order(BaseModel):
    shipping_address: str = Field(..., min_length=1)
    phone: str = Field(..., min_length=10, max_length=15)
    items: List[OrderItemIn] = []
    cart_id: Optional[str] = None


@router.get('/marketplace')
async def get_marketplace_products():
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('''
            SELECT id, name, quantity, unit, price_per_unit, description, location, farmer_id, image_url
            FROM crops WHERE available = TRUE AND quantity > 0
        ''')
        return [dict(r) for r in cur.fetchall()]


@router.get('/cart/{cart_id}')
async def get_cart(cart_id: str, user=Depends(get_current_user_full)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT * FROM cart_items WHERE cart_id = %s', (cart_id,))
        items = cur.fetchall()
    total = sum(r['unit_price'] * r['quantity'] for r in items if r['unit_price'])
    return {'items': [dict(i) for i in items], 'total': round(total, 2)}


@router.post('/cart')
async def add_to_cart(item: CartItem, user=Depends(get_current_user_full)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT name, price_per_unit, quantity FROM crops WHERE id = %s AND available = TRUE', (item.crop_id,))
        crop = cur.fetchone()
        if not crop:
            raise HTTPException(404, 'Product not found or unavailable')
        available_qty = crop['quantity']
        if item.quantity > available_qty:
            raise HTTPException(400, 'Only ' + str(available_qty) + ' units available')

        item.cart_id = item.cart_id or str(uuid.uuid4())
        cur.execute('SELECT id, quantity FROM cart_items WHERE cart_id = %s AND crop_id = %s', (item.cart_id, item.crop_id))
        existing = cur.fetchone()
        if existing:
            new_qty = existing['quantity'] + item.quantity
            if new_qty > available_qty:
                raise HTTPException(400, 'Cannot add more - only ' + str(available_qty) + ' units in stock')
            cur.execute('UPDATE cart_items SET quantity = %s WHERE id = %s', (new_qty, existing['id']))
        else:
            cur.execute('''
                INSERT INTO cart_items (crop_id, quantity, cart_id, unit_price, crop_name)
                VALUES (%s,%s,%s,%s,%s)
            ''', (item.crop_id, item.quantity, item.cart_id, crop['price_per_unit'], crop['name']))
    return {'message': 'Item added to cart', 'cart_id': item.cart_id}


@router.delete('/cart/{cart_id}/item/{item_id}')
async def remove_item(cart_id: str, item_id: int, user=Depends(get_current_user_full)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT id FROM cart_items WHERE id = %s AND cart_id = %s', (item_id, cart_id))
        if not cur.fetchone():
            raise HTTPException(404, 'Item not found')
        cur.execute('DELETE FROM cart_items WHERE id = %s', (item_id,))
    return {'message': 'Item removed'}


@router.delete('/cart/{cart_id}')
async def clear_cart(cart_id: str, user=Depends(get_current_user_full)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('DELETE FROM cart_items WHERE cart_id = %s', (cart_id,))
    return {'message': 'Cart cleared'}


@router.post('/orders')
async def create_order(order: Order, user=Depends(get_current_user_full)):
    if user['role'] != 'consumer':
        raise HTTPException(403, 'Only consumers can place orders')
    if not order.items:
        raise HTTPException(400, 'Cart is empty')

    consumer_id = user['id']
    computed_total = 0.0
    validated = []
    farmer_ids = set()

    with get_db() as conn:
        cur = conn.cursor()
        for it in order.items:
            cur.execute('SELECT name, price_per_unit, quantity, farmer_id FROM crops WHERE id = %s AND available = TRUE', (it.crop_id,))
            crop = cur.fetchone()
            if not crop:
                raise HTTPException(404, 'Product ' + str(it.crop_id) + ' not available')
            crop_qty = crop['quantity']
            crop_name = crop['name']
            if it.quantity > crop_qty:
                raise HTTPException(400, 'Only ' + str(crop_qty) + ' units of ' + crop_name + ' available')
            computed_total += crop['price_per_unit'] * it.quantity
            farmer_ids.add(crop['farmer_id'])
            validated.append((it.crop_id, crop['farmer_id'], it.quantity, crop['price_per_unit'], crop_name))

        if len(farmer_ids) > 1:
            raise HTTPException(400, 'An order can contain crops from only one farmer. Please order separately per farmer.')
        order_farmer_id = farmer_ids.pop()

        cur.execute('''
            INSERT INTO orders (consumer_id, farmer_id, total_amount, status, shipping_address, phone, consumer_name)
            VALUES (%s,%s,%s,'pending',%s,%s,%s) RETURNING id
        ''', (consumer_id, order_farmer_id, round(computed_total, 2), order.shipping_address, order.phone,
              user.get('name') or user['username']))
        order_id = cur.fetchone()['id']

        for crop_id, farmer_id, qty, price, name in validated:
            cur.execute('''
                INSERT INTO order_items (order_id, crop_id, farmer_id, quantity, unit_price, crop_name)
                VALUES (%s,%s,%s,%s,%s,%s)
            ''', (order_id, crop_id, farmer_id, qty, price, name))

        if order.cart_id:
            cur.execute('DELETE FROM cart_items WHERE cart_id = %s', (order.cart_id,))

    send_order_confirmation(
        user.get('email'),
        order_id,
        round(computed_total, 2),
        [{'crop_name': v[4], 'quantity': v[2], 'unit_price': v[3]} for v in validated],
        order.shipping_address
    )

    return {'order_id': order_id, 'total_amount': round(computed_total, 2), 'status': 'Order placed successfully'}


@router.get('/orders/mine')
async def get_my_orders(user=Depends(get_current_user_full)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT * FROM orders WHERE consumer_id = %s ORDER BY created_at DESC', (user['id'],))
        orders = [dict(r) for r in cur.fetchall()]
        for o in orders:
            cur.execute('SELECT crop_id, crop_name, quantity, unit_price FROM order_items WHERE order_id = %s', (o['id'],))
            o['items'] = [dict(r) for r in cur.fetchall()]
    return {'orders': orders, 'total': len(orders)}


@router.get('/dashboard/stats')
async def dashboard_stats(user=Depends(get_current_user_full)):
    consumer_id = user['id']
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT COUNT(*) as c FROM orders WHERE consumer_id = %s', (consumer_id,))
        total_orders = cur.fetchone()['c']
        cur.execute('SELECT SUM(total_amount) as s FROM orders WHERE consumer_id = %s', (consumer_id,))
        total_spending = cur.fetchone()['s'] or 0
        cur.execute('SELECT status, COUNT(*) as c FROM orders WHERE consumer_id = %s GROUP BY status', (consumer_id,))
        order_status = [dict(r) for r in cur.fetchall()]
    return {'total_orders': total_orders, 'total_spending': round(total_spending, 2), 'order_status': order_status}


@router.get('/orders/{order_id}')
async def get_order(order_id: int, user=Depends(get_current_user_full)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT * FROM orders WHERE id = %s', (order_id,))
        order = cur.fetchone()
        if not order:
            raise HTTPException(404, 'Order not found')
        if user['role'] == 'consumer' and order['consumer_id'] != user['id']:
            raise HTTPException(403, 'Not your order')
        if user['role'] == 'farmer' and order['farmer_id'] != user['id']:
            raise HTTPException(403, 'Not your order')
        cur.execute('SELECT * FROM order_items WHERE order_id = %s', (order_id,))
        items = cur.fetchall()
    return {'order': dict(order), 'items': [dict(i) for i in items]}

