from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
import os
from pathlib import Path

# --------------------------------------------------
# 1️⃣ ROUTER SETUP
# --------------------------------------------------
router = APIRouter()

DB_DIR = Path(__file__).parent / "data"
DB_PATH = DB_DIR / "farmer.db"
os.makedirs(DB_DIR, exist_ok=True)


# --------------------------------------------------
# 2️⃣ DATA MODEL
# --------------------------------------------------
class CropListing(BaseModel):
    id: Optional[int] = None
    name: str
    quantity: float
    unit: str
    price_per_unit: float
    description: Optional[str] = None
    location: Optional[str] = None
    available: bool = True
    farmer_id: Optional[int] = None


# --------------------------------------------------
# 3️⃣ DATABASE SETUP
# --------------------------------------------------
def setup_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS crops (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            quantity REAL,
            unit TEXT,
            price_per_unit REAL,
            description TEXT,
            location TEXT,
            available INTEGER,
            farmer_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Insert Sample Data
    cursor.execute("SELECT COUNT(*) FROM crops")
    if cursor.fetchone()[0] == 0:
        sample_crops = [
            ("Rice", 100, "kg", 45, "High quality Basmati rice", "Punjab", 1, 1),
            ("Wheat", 200, "kg", 30, "Organic wheat", "Haryana", 1, 1),
            ("Tomatoes", 50, "kg", 25, "Fresh red tomatoes", "Maharashtra", 1, 1),
            ("Potatoes", 150, "kg", 20, "High quality potatoes", "Uttar Pradesh", 1, 1),
            ("Onions", 75, "kg", 35, "Fresh red onions", "Maharashtra", 1, 1)
        ]

        cursor.executemany("""
            INSERT INTO crops (name, quantity, unit, price_per_unit, description, location, available, farmer_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, sample_crops)

        print("✅ Sample Crops Added")

    conn.commit()
    conn.close()


setup_db()


# --------------------------------------------------
# 4️⃣ GET ALL CROPS
# --------------------------------------------------
@router.get("/", response_model=List[CropListing])
async def get_all_crops():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM crops ORDER BY created_at DESC")
    crops = cursor.fetchall()

    conn.close()
    return [dict(c) for c in crops]


# --------------------------------------------------
# 5️⃣ GET SINGLE CROP
# --------------------------------------------------
@router.get("/{crop_id}", response_model=CropListing)
async def get_crop(crop_id: int):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM crops WHERE id = ?", (crop_id,))
    crop = cursor.fetchone()
    conn.close()

    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")

    return dict(crop)


# --------------------------------------------------
# 6️⃣ CREATE NEW CROP
# --------------------------------------------------
@router.post("/", response_model=CropListing)
async def create_crop(crop: CropListing):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    farmer_id = crop.farmer_id or 1

    cursor.execute("""
        INSERT INTO crops (name, quantity, unit, price_per_unit, description, location, available, farmer_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        crop.name,
        crop.quantity,
        crop.unit,
        crop.price_per_unit,
        crop.description,
        crop.location,
        1 if crop.available else 0,
        farmer_id
    ))

    crop_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {**crop.dict(), "id": crop_id}


# --------------------------------------------------
# 7️⃣ UPDATE CROP
# --------------------------------------------------
@router.put("/{crop_id}", response_model=CropListing)
async def update_crop(crop_id: int, crop: CropListing):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM crops WHERE id = ?", (crop_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Crop not found")

    cursor.execute("""
        UPDATE crops
        SET name = ?, quantity = ?, unit = ?, price_per_unit = ?,
            description = ?, location = ?, available = ?
        WHERE id = ?
    """, (
        crop.name,
        crop.quantity,
        crop.unit,
        crop.price_per_unit,
        crop.description,
        crop.location,
        1 if crop.available else 0,
        crop_id
    ))

    conn.commit()

    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM crops WHERE id = ?", (crop_id,))
    updated = dict(cursor.fetchone())

    conn.close()
    return updated


# --------------------------------------------------
# 8️⃣ DELETE CROP
# --------------------------------------------------
@router.delete("/{crop_id}")
async def delete_crop(crop_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM crops WHERE id = ?", (crop_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Crop not found")

    cursor.execute("DELETE FROM crops WHERE id = ?", (crop_id,))
    conn.commit()
    conn.close()

    return {"message": "✅ Crop deleted successfully"}


# --------------------------------------------------
# 9️⃣ DASHBOARD STATS
# --------------------------------------------------
@router.get("/dashboard/stats")
async def farmer_dashboard_stats():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM crops")
    total_crops = cursor.fetchone()[0]

    cursor.execute("SELECT SUM(quantity) FROM crops")
    total_quantity = cursor.fetchone()[0] or 0

    cursor.execute("SELECT SUM(quantity * price_per_unit) FROM crops")
    total_value = cursor.fetchone()[0] or 0

    cursor.execute("SELECT name, COUNT(*) FROM crops GROUP BY name")
    crops_by_type = [{"name": n, "count": c} for n, c in cursor.fetchall()]

    conn.close()

    return {
        "total_crops": total_crops,
        "total_quantity": total_quantity,
        "total_value": total_value,
        "crops_by_type": crops_by_type
    }
