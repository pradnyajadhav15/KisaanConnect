from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
import sqlite3
import os
from pathlib import Path
import uuid

# -------------------------------------------------
# 1️⃣ ROUTER SETUP
# -------------------------------------------------
router = APIRouter()

# Database Path
DB_DIR = Path(__file__).parent / "data"
DB_PATH = DB_DIR / "consumer.db"
os.makedirs(DB_DIR, exist_ok=True)


# -------------------------------------------------
# 2️⃣ DATA MODELS (Pydantic Schemas)
# -------------------------------------------------
class CartItem(BaseModel):
    id: Optional[int] = None
    crop_id: int
    quantity: float = Field(..., gt=0)
    cart_id: Optional[str] = None
    unit_price: Optional[float] = None
    crop_name: Optional[str] = None


class Order(BaseModel):
    id: Optional[int] = None
    consumer_id: Optional[int] = None
    total_amount: float
    status: str = "pending"
    shipping_address: str
    items: List[CartItem] = []


# -------------------------------------------------
# 3️⃣ DATABASE INITIALIZATION
# -------------------------------------------------
def setup_db():
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()

        # Cart Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS cart_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                crop_id INTEGER,
                quantity REAL,
                cart_id TEXT,
                unit_price REAL,
                crop_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Orders Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                consumer_id INTEGER,
                total_amount REAL,
                status TEXT,
                shipping_address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Order Items Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER,
                crop_id INTEGER,
                quantity REAL,
                unit_price REAL,
                crop_name TEXT
            )
        """)

setup_db()


# -------------------------------------------------
# 4️⃣ MARKETPLACE ROUTE
# -------------------------------------------------
@router.get("/marketplace")
async def get_marketplace_products():
    farmer_db = Path(__file__).parent.parent / "farmer" / "data" / "farmer.db"

    if not farmer_db.exists():
        return []

    with sqlite3.connect(farmer_db) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, name, quantity, unit, price_per_unit, description, location
            FROM crops WHERE available = 1
        """)

        products = cursor.fetchall()

    return [dict(p) for p in products]


# -------------------------------------------------
# 5️⃣ CART ROUTES
# -------------------------------------------------
@router.get("/cart/{cart_id}")
async def get_cart(cart_id: str):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM cart_items WHERE cart_id = ?", (cart_id,))
        items = cursor.fetchall()

    return [dict(i) for i in items]


@router.post("/cart")
async def add_to_cart(item: CartItem):
    farmer_db = Path(__file__).parent.parent / "farmer" / "data" / "farmer.db"

    if not farmer_db.exists():
        raise HTTPException(status_code=404, detail="Farmer DB not found")

    # Fetch product price
    with sqlite3.connect(farmer_db) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name, price_per_unit FROM crops WHERE id = ?", (item.crop_id,))
        crop = cursor.fetchone()

        if not crop:
            raise HTTPException(status_code=404, detail="Product not found")

        crop_name, unit_price = crop

    item.cart_id = item.cart_id or str(uuid.uuid4())

    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()

        # Check existing product in cart
        cursor.execute(
            "SELECT id FROM cart_items WHERE cart_id = ? AND crop_id = ?",
            (item.cart_id, item.crop_id)
        )
        existing = cursor.fetchone()

        if existing:
            cursor.execute(
                "UPDATE cart_items SET quantity = quantity + ? WHERE id = ?",
                (item.quantity, existing[0])
            )
            item_id = existing[0]
        else:
            cursor.execute("""
                INSERT INTO cart_items (crop_id, quantity, cart_id, unit_price, crop_name)
                VALUES (?, ?, ?, ?, ?)
            """, (item.crop_id, item.quantity, item.cart_id, unit_price, crop_name))
            item_id = cursor.lastrowid

        conn.commit()

    return {"message": "Item added to cart", "cart_id": item.cart_id}


@router.delete("/cart/{cart_id}/item/{item_id}")
async def remove_item(cart_id: str, item_id: int):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id FROM cart_items WHERE id = ? AND cart_id = ?",
            (item_id, cart_id)
        )

        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Item not found")

        cursor.execute("DELETE FROM cart_items WHERE id = ?", (item_id,))
        conn.commit()

    return {"message": "Item removed successfully"}


# -------------------------------------------------
# 6️⃣ ORDER ROUTES
# -------------------------------------------------
@router.post("/orders")
async def create_order(order: Order):

    if not order.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    consumer_id = order.consumer_id or 1

    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO orders (consumer_id, total_amount, status, shipping_address)
            VALUES (?, ?, ?, ?)
        """, (consumer_id, order.total_amount, order.status, order.shipping_address))

        order_id = cursor.lastrowid

        for item in order.items:
            cursor.execute("""
                INSERT INTO order_items (order_id, crop_id, quantity, unit_price, crop_name)
                VALUES (?, ?, ?, ?, ?)
            """, (order_id, item.crop_id, item.quantity, item.unit_price, item.crop_name))

        # Clear Cart
        cart_id = order.items[0].cart_id
        cursor.execute("DELETE FROM cart_items WHERE cart_id = ?", (cart_id,))
        conn.commit()

    return {"order_id": order_id, "status": "Order Placed"}


@router.get("/orders/{order_id}")
async def get_order(order_id: int):

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
        order = cursor.fetchone()

        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        cursor.execute("SELECT * FROM order_items WHERE order_id = ?", (order_id,))
        items = cursor.fetchall()

    return {
        "order": dict(order),
        "items": [dict(i) for i in items]
    }


# -------------------------------------------------
# 7️⃣ DASHBOARD STATS
# -------------------------------------------------
@router.get("/dashboard/stats")
async def dashboard_stats():

    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM orders")
        total_orders = cursor.fetchone()[0]

        cursor.execute("SELECT SUM(total_amount) FROM orders")
        total_spending = cursor.fetchone()[0] or 0

        cursor.execute("SELECT status, COUNT(*) FROM orders GROUP BY status")
        order_status = cursor.fetchall()

    return {
        "total_orders": total_orders,
        "total_spending": total_spending,
        "order_status": order_status
    }
