"""Neon Postgres connectivity + capability test."""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in .env file.")
    exit(1)

# Neon requires SSL — make sure it's requested even if the URL omits it.
if "sslmode=" not in DATABASE_URL:
    sep = "&" if "?" in DATABASE_URL else "?"
    DATABASE_URL = f"{DATABASE_URL}{sep}sslmode=require"

print(f"DATABASE_URL loaded ({len(DATABASE_URL)} chars, sslmode enforced)")

try:
    import psycopg2
    print("psycopg2 imported OK")

    print("Connecting to Postgres (first connect may be slow if Neon was asleep)...")
    conn = psycopg2.connect(DATABASE_URL, connect_timeout=15)
    cur = conn.cursor()

    cur.execute("SELECT version();")
    print("Connected to:", cur.fetchone()[0])

    # Prove we can actually write/read/clean up — not just connect.
    cur.execute("CREATE TABLE IF NOT EXISTS _kc_conn_test (id SERIAL PRIMARY KEY, note TEXT);")
    cur.execute("INSERT INTO _kc_conn_test (note) VALUES (%s) RETURNING id;", ("hello",))
    new_id = cur.fetchone()[0]
    cur.execute("SELECT note FROM _kc_conn_test WHERE id = %s;", (new_id,))
    print("Write/read OK — row says:", cur.fetchone()[0])
    cur.execute("DROP TABLE _kc_conn_test;")
    conn.commit()
    print("Table create/insert/select/drop all succeeded.")

    cur.close()
    conn.close()
    print("Connection closed cleanly.")
except Exception as e:
    print(f"FAILED: {type(e).__name__}: {e}")
    exit(1)