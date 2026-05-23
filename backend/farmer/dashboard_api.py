from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
import sqlite3
import os
from pathlib import Path

from auth.auth_api import get_current_user_full

# --------------------------------------------------
# ROUTER & DB SETUP
# --------------------------------------------------
router = APIRouter()

DB_DIR = Path(__file__).parent / "data"
DB_PATH = DB_DIR / "farmer.db"
os.makedirs(DB_DIR, exist_ok=True)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    return conn


# --------------------------------------------------
# SCHEMAS
# --------------------------------------------------
# Input schema: NO farmer_id / NO id — those are server-controlled.
class CropInput(BaseModel):
    name: str = Field(..., min_length=1)
    quantity: float = Field(..., gt=0)
    unit: str = Field(..., min_length=1)
    price_per_unit: float = Field(..., gt=0)
    description: Optional[str] = None
    location: Optional[str] = None
    available: bool = True
    image_url: Optional[str] = None

# Output schema: includes server-assigned fields.
class CropListing(CropInput):
    id: int
    farmer_id: int


# --------------------------------------------------
# DB INIT
# --------------------------------------------------
def setup_db():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS crops (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                name           TEXT NOT NULL,
                quantity       REAL NOT NULL CHECK(quantity >= 0),
                unit           TEXT NOT NULL,
                price_per_unit REAL NOT NULL CHECK(price_per_unit > 0),
                description    TEXT,
                location       TEXT,
                available      INTEGER DEFAULT 1,
                farmer_id      INTEGER NOT NULL,
                image_url      TEXT,
                created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_crops_farmer ON crops(farmer_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_crops_available ON crops(available)")

        cursor.execute("SELECT COUNT(*) FROM crops")
        if cursor.fetchone()[0] == 0:
            sample_crops = [
                ("Rice",     100, "kg", 45, "High quality Basmati rice", "Punjab",        1, 1, None),
                ("Wheat",    200, "kg", 30, "Organic wheat",             "Haryana",       1, 1, None),
                ("Tomatoes",  50, "kg", 25, "Fresh red tomatoes",        "Maharashtra",   1, 1, None),
                ("Potatoes", 150, "kg", 20, "High quality potatoes",     "Uttar Pradesh", 1, 1, None),
                ("Onions",    75, "kg", 35, "Fresh red onions",          "Maharashtra",   1, 1, None),
            ]
            cursor.executemany("""
                INSERT INTO crops (name, quantity, unit, price_per_unit, description, location, available, farmer_id, image_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, sample_crops)
            print("Sample crops added")

setup_db()


def _require_farmer(user):
    if user["role"] != "farmer":
        raise HTTPException(403, "Only farmers can manage crop listings")


# --------------------------------------------------
# GET MY CROPS  (logged-in farmer only)
# --------------------------------------------------
@router.get("/mine", response_model=List[CropListing])
async def get_my_crops(user=Depends(get_current_user_full)):
    _require_farmer(user)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM crops WHERE farmer_id = ? ORDER BY created_at DESC",
            (user["id"],)
        )
        return [dict(r) for r in cursor.fetchall()]


# --------------------------------------------------
# GET ALL AVAILABLE CROPS  (public marketplace)
# --------------------------------------------------
@router.get("/", response_model=List[CropListing])
async def get_all_crops():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM crops WHERE available = 1 AND quantity > 0 ORDER BY created_at DESC"
        )
        return [dict(r) for r in cursor.fetchall()]


# --------------------------------------------------
# GET SINGLE CROP  (public)
# --------------------------------------------------
@router.get("/{crop_id}", response_model=CropListing)
async def get_crop(crop_id: int):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM crops WHERE id = ?", (crop_id,))
        crop = cursor.fetchone()

    if not crop:
        raise HTTPException(404, "Crop not found")
    return dict(crop)


# --------------------------------------------------
# CREATE CROP  (farmer_id from token)
# --------------------------------------------------
@router.post("/", response_model=CropListing)
async def create_crop(crop: CropInput, user=Depends(get_current_user_full)):
    _require_farmer(user)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO crops (name, quantity, unit, price_per_unit, description, location, available, farmer_id, image_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            crop.name, crop.quantity, crop.unit, crop.price_per_unit,
            crop.description, crop.location, 1 if crop.available else 0,
            user["id"], crop.image_url
        ))
        crop_id = cursor.lastrowid
        cursor.execute("SELECT * FROM crops WHERE id = ?", (crop_id,))
        return dict(cursor.fetchone())


# --------------------------------------------------
# UPDATE CROP  (ownership enforced via token)
# --------------------------------------------------
@router.put("/{crop_id}", response_model=CropListing)
async def update_crop(crop_id: int, crop: CropInput, user=Depends(get_current_user_full)):
    _require_farmer(user)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id FROM crops WHERE id = ? AND farmer_id = ?",
            (crop_id, user["id"])
        )
        if not cursor.fetchone():
            raise HTTPException(404, "Crop not found or not yours")

        cursor.execute("""
            UPDATE crops
            SET name=?, quantity=?, unit=?, price_per_unit=?,
                description=?, location=?, available=?, image_url=?
            WHERE id = ?
        """, (
            crop.name, crop.quantity, crop.unit, crop.price_per_unit,
            crop.description, crop.location, 1 if crop.available else 0,
            crop.image_url, crop_id
        ))

        cursor.execute("SELECT * FROM crops WHERE id = ?", (crop_id,))
        return dict(cursor.fetchone())


# --------------------------------------------------
# DELETE CROP  (ownership enforced via token)
# --------------------------------------------------
@router.delete("/{crop_id}")
async def delete_crop(crop_id: int, user=Depends(get_current_user_full)):
    _require_farmer(user)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id FROM crops WHERE id = ? AND farmer_id = ?", (crop_id, user["id"])
        )
        if not cursor.fetchone():
            raise HTTPException(404, "Crop not found or not yours")

        cursor.execute("DELETE FROM crops WHERE id = ?", (crop_id,))

    return {"message": "Crop deleted successfully"}


# --------------------------------------------------
# DASHBOARD STATS  (logged-in farmer)
# --------------------------------------------------
@router.get("/dashboard/stats")
async def farmer_dashboard_stats(user=Depends(get_current_user_full)):
    _require_farmer(user)
    farmer_id = user["id"]
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM crops WHERE farmer_id = ?", (farmer_id,))
        total_crops = cursor.fetchone()[0]

        cursor.execute("SELECT SUM(quantity) FROM crops WHERE farmer_id = ?", (farmer_id,))
        total_quantity = cursor.fetchone()[0] or 0

        cursor.execute(
            "SELECT SUM(quantity * price_per_unit) FROM crops WHERE farmer_id = ?",
            (farmer_id,)
        )
        total_value = cursor.fetchone()[0] or 0

        cursor.execute(
            "SELECT name, COUNT(*) as count FROM crops WHERE farmer_id = ? GROUP BY name",
            (farmer_id,)
        )
        crops_by_type = [{"name": r[0], "count": r[1]} for r in cursor.fetchall()]

    return {
        "total_crops": total_crops,
        "total_quantity": round(total_quantity, 2),
        "total_value": round(total_value, 2),
        "crops_by_type": crops_by_type
    }