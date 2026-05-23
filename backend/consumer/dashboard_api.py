from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
import sqlite3
import os
from pathlib import Path
import uuid

from auth.auth_api import get_current_user_full

# -------------------------------------------------
# ROUTER & DB SETUP
# -------------------------------------------------
router = APIRouter()

DB_DIR = Path(__file__).parent / "data"
DB_PATH = DB_DIR / "consumer.db"
FARMER_DB = Path(__file__).parent.parent / "farmer" / "data" / "farmer.db"

os.makedirs(DB_DIR, exist_ok=True)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    return conn

def get_farmer_db():
    conn = sqlite3.connect(FARMER_DB)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout=5000")
    return conn


# -------------------------------------------------
# SCHEMAS
# -------------------------------------------------
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


# -------------------------------------------------
# DB INIT  (self-healing migration included)
# -------------------------------------------------
def setup_db():
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS cart_items (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                crop_id    INTEGER NOT NULL,
                quantity   REAL NOT NULL,
                cart_id    TEXT NOT NULL,
                unit_price REAL,
                crop_name  TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                consumer_id      INTEGER NOT NULL,
                farmer_id        INTEGER NOT NULL,
                total_amount     REAL NOT NULL,
                status           TEXT DEFAULT 'pending',
                shipping_address TEXT NOT NULL,
                phone            TEXT,
                consumer_name    TEXT,
                created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS order_items (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id   INTEGER NOT NULL,
                crop_id    INTEGER NOT NULL,
                farmer_id  INTEGER NOT NULL,
                quantity   REAL NOT NULL,
                unit_price REAL,
                crop_name  TEXT
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_cart ON cart_items(cart_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_consumer ON orders(consumer_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_farmer ON orders(farmer_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_orderitems_order ON order_items(order_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_orderitems_farmer ON order_items(farmer_id)")

        # self-healing: add columns missing from older DBs
        cursor.execute("PRAGMA table_info(orders)")
        ocols = {r[1] for r in cursor.fetchall()}
        for col, ddl in [("farmer_id", "ALTER TABLE orders ADD COLUMN farmer_id INTEGER"),
                         ("phone", "ALTER TABLE orders ADD COLUMN phone TEXT"),
                         ("consumer_name", "ALTER TABLE orders ADD COLUMN consumer_name TEXT")]:
            if col not in ocols:
                cursor.execute(ddl)
        cursor.execute("PRAGMA table_info(order_items)")
        icols = {r[1] for r in cursor.fetchall()}
        if "farmer_id" not in icols:
            cursor.execute("ALTER TABLE order_items ADD COLUMN farmer_id INTEGER")

setup_db()


# -------------------------------------------------
# MARKETPLACE  (public)
# -------------------------------------------------
@router.get("/marketplace")
async def get_marketplace_products():
    if not FARMER_DB.exists():
        return []
    with get_farmer_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, quantity, unit, price_per_unit, description, location, farmer_id, image_url
            FROM crops WHERE available = 1 AND quantity > 0
        """)
        return [dict(r) for r in cursor.fetchall()]


# -------------------------------------------------
# CART
# -------------------------------------------------
@router.get("/cart/{cart_id}")
async def get_cart(cart_id: str, user=Depends(get_current_user_full)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cart_items WHERE cart_id = ?", (cart_id,))
        items = cursor.fetchall()
    total = sum(r["unit_price"] * r["quantity"] for r in items if r["unit_price"])
    return {"items": [dict(i) for i in items], "total": round(total, 2)}


@router.post("/cart")
async def add_to_cart(item: CartItem, user=Depends(get_current_user_full)):
    if not FARMER_DB.exists():
        raise HTTPException(404, "Farmer DB not found")
    with get_farmer_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT name, price_per_unit, quantity FROM crops WHERE id = ? AND available = 1",
            (item.crop_id,)
        )
        crop = cursor.fetchone()
    if not crop:
        raise HTTPException(404, "Product not found or unavailable")
    if item.quantity > crop["quantity"]:
        raise HTTPException(400, f"Only {crop['quantity']} units available")

    item.cart_id = item.cart_id or str(uuid.uuid4())
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, quantity FROM cart_items WHERE cart_id = ? AND crop_id = ?",
            (item.cart_id, item.crop_id)
        )
        existing = cursor.fetchone()
        if existing:
            new_qty = existing["quantity"] + item.quantity
            if new_qty > crop["quantity"]:
                raise HTTPException(400, f"Cannot add more — only {crop['quantity']} units in stock")
            cursor.execute("UPDATE cart_items SET quantity = ? WHERE id = ?", (new_qty, existing["id"]))
        else:
            cursor.execute("""
                INSERT INTO cart_items (crop_id, quantity, cart_id, unit_price, crop_name)
                VALUES (?, ?, ?, ?, ?)
            """, (item.crop_id, item.quantity, item.cart_id, crop["price_per_unit"], crop["name"]))
    return {"message": "Item added to cart", "cart_id": item.cart_id}


@router.delete("/cart/{cart_id}/item/{item_id}")
async def remove_item(cart_id: str, item_id: int, user=Depends(get_current_user_full)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM cart_items WHERE id = ? AND cart_id = ?", (item_id, cart_id))
        if not cursor.fetchone():
            raise HTTPException(404, "Item not found")
        cursor.execute("DELETE FROM cart_items WHERE id = ?", (item_id,))
    return {"message": "Item removed"}


@router.delete("/cart/{cart_id}")
async def clear_cart(cart_id: str, user=Depends(get_current_user_full)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM cart_items WHERE cart_id = ?", (cart_id,))
    return {"message": "Cart cleared"}


# -------------------------------------------------
# ORDERS  (specific routes BEFORE /{order_id})
# -------------------------------------------------
@router.post("/orders")
async def create_order(order: Order, user=Depends(get_current_user_full)):
    if user["role"] != "consumer":
        raise HTTPException(403, "Only consumers can place orders")
    if not order.items:
        raise HTTPException(400, "Cart is empty")
    if not FARMER_DB.exists():
        raise HTTPException(404, "Farmer DB not found")

    consumer_id = user["id"]
    computed_total = 0.0
    validated = []
    farmer_ids = set()
    with get_farmer_db() as fconn:
        fcur = fconn.cursor()
        for it in order.items:
            fcur.execute(
                "SELECT name, price_per_unit, quantity, farmer_id FROM crops WHERE id = ? AND available = 1",
                (it.crop_id,)
            )
            crop = fcur.fetchone()
            if not crop:
                raise HTTPException(404, f"Product {it.crop_id} not available")
            if it.quantity > crop["quantity"]:
                raise HTTPException(400, f"Only {crop['quantity']} units of {crop['name']} available")
            computed_total += crop["price_per_unit"] * it.quantity
            farmer_ids.add(crop["farmer_id"])
            validated.append((it.crop_id, crop["farmer_id"], it.quantity,
                              crop["price_per_unit"], crop["name"]))

    if len(farmer_ids) > 1:
        raise HTTPException(400, "An order can contain crops from only one farmer. Please order separately per farmer.")
    order_farmer_id = farmer_ids.pop()

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO orders (consumer_id, farmer_id, total_amount, status, shipping_address, phone, consumer_name)
            VALUES (?, ?, ?, 'pending', ?, ?, ?)
        """, (consumer_id, order_farmer_id, round(computed_total, 2),
              order.shipping_address, order.phone, user.get("name") or user["username"]))
        order_id = cursor.lastrowid
        for crop_id, farmer_id, qty, price, name in validated:
            cursor.execute("""
                INSERT INTO order_items (order_id, crop_id, farmer_id, quantity, unit_price, crop_name)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (order_id, crop_id, farmer_id, qty, price, name))
        if order.cart_id:
            cursor.execute("DELETE FROM cart_items WHERE cart_id = ?", (order.cart_id,))

    return {"order_id": order_id, "total_amount": round(computed_total, 2),
            "status": "Order placed successfully"}


@router.get("/orders/mine")
async def get_my_orders(user=Depends(get_current_user_full)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM orders WHERE consumer_id = ? ORDER BY created_at DESC",
            (user["id"],)
        )
        orders = [dict(r) for r in cursor.fetchall()]
        for o in orders:
            cursor.execute("SELECT crop_id, crop_name, quantity, unit_price FROM order_items WHERE order_id = ?", (o["id"],))
            o["items"] = [dict(r) for r in cursor.fetchall()]
    return {"orders": orders, "total": len(orders)}


# -------------------------------------------------
# DASHBOARD STATS
# -------------------------------------------------
@router.get("/dashboard/stats")
async def dashboard_stats(user=Depends(get_current_user_full)):
    consumer_id = user["id"]
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM orders WHERE consumer_id = ?", (consumer_id,))
        total_orders = cursor.fetchone()[0]
        cursor.execute("SELECT SUM(total_amount) FROM orders WHERE consumer_id = ?", (consumer_id,))
        total_spending = cursor.fetchone()[0] or 0
        cursor.execute("SELECT status, COUNT(*) c FROM orders WHERE consumer_id = ? GROUP BY status", (consumer_id,))
        order_status = [{"status": r[0], "count": r[1]} for r in cursor.fetchall()]
    return {"total_orders": total_orders, "total_spending": round(total_spending, 2), "order_status": order_status}


# -------------------------------------------------
# GET SINGLE ORDER  (LAST — greedy /{order_id} after specific routes)
# -------------------------------------------------
@router.get("/orders/{order_id}")
async def get_order(order_id: int, user=Depends(get_current_user_full)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
        order = cursor.fetchone()
        if not order:
            raise HTTPException(404, "Order not found")
        if user["role"] == "consumer" and order["consumer_id"] != user["id"]:
            raise HTTPException(403, "Not your order")
        if user["role"] == "farmer" and order["farmer_id"] != user["id"]:
            raise HTTPException(403, "Not your order")
        cursor.execute("SELECT * FROM order_items WHERE order_id = ?", (order_id,))
        items = cursor.fetchall()
    return {"order": dict(order), "items": [dict(i) for i in items]}