from pathlib import Path
from database import get_db

sql = Path("migrations_adopt_ngo.sql").read_text()
with get_db() as conn:
    conn.cursor().execute(sql)
print("migration applied")

with get_db() as conn:
    cur = conn.cursor()
    cur.execute("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema='public'
          AND table_name IN ('farm_plots','adoptions','plot_updates','ngos','donations')
        ORDER BY table_name
    """)
    for r in cur.fetchall():
        print(" -", r["table_name"])