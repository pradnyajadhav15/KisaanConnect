import sqlite3
import hashlib
import hmac
import os
from pathlib import Path

# =========================================
# DATABASE PATH SETUP
# =========================================

DB_DIR = Path(__file__).parent / "data"
DB_PATH = DB_DIR / "users.db"

# =========================================
# PASSWORD HASHING (PBKDF2-HMAC-SHA256, salted)
# =========================================

ITERATIONS = 260_000  # work factor; bump over time as hardware improves

def hash_password(password: str) -> str:
    """PBKDF2-HMAC-SHA256 with random per-user salt. Returns 'salt:hash'."""
    salt = os.urandom(16).hex()
    hashed = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), ITERATIONS
    ).hex()
    return f"{salt}:{hashed}"


def verify_password(password: str, stored_hash: str) -> bool:
    """
    Verify a password against a stored 'salt:hash'.
    Uses a constant-time comparison to avoid leaking info via timing.
    No silent legacy fallback — malformed hashes simply fail to verify.
    """
    try:
        salt, hashed = stored_hash.split(":")
    except ValueError:
        return False
    check = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), ITERATIONS
    ).hex()
    return hmac.compare_digest(check, hashed)


# =========================================
# DB CONNECTION HELPER
# =========================================

def get_db_connection():
    """Return a configured SQLite connection with WAL + busy timeout."""
    DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row            # dict-like row access
    conn.execute("PRAGMA journal_mode=WAL")   # readers don't block the writer
    conn.execute("PRAGMA busy_timeout=5000")  # wait up to 5s for a lock, don't error instantly
    conn.execute("PRAGMA foreign_keys=ON")    # enforce FKs (needed once you add listings/orders)
    return conn


# =========================================
# CREATE TABLES
# =========================================

def create_tables():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role          TEXT NOT NULL CHECK(role IN ('farmer', 'consumer')),
            name          TEXT,
            email         TEXT UNIQUE,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()
    print(f"Database ready at {DB_PATH}")


# =========================================
# TEST USERS
# =========================================

def add_test_users():
    conn = get_db_connection()
    cursor = conn.cursor()

    test_users = [
        ("farmer1",   "farmer",   "John Farmer",   "farmer1@example.com"),
        ("consumer1", "consumer", "Mary Consumer", "consumer1@example.com"),
    ]

    added = []
    for username, role, name, email in test_users:
        cursor.execute(
            """INSERT OR IGNORE INTO users (username, password_hash, role, name, email)
               VALUES (?, ?, ?, ?, ?)""",
            (username, hash_password("password123"), role, name, email)
        )
        if cursor.rowcount:
            added.append(username)

    conn.commit()
    conn.close()

    if added:
        print(f"Added test users: {', '.join(added)} | password: password123")
    else:
        print("Test users already exist")


# =========================================
# OPTIONAL: one-time migration for old unsalted SHA-256 accounts
# =========================================

def migrate_legacy_hash_on_login(username: str, password: str) -> bool:
    """
    Call this ONLY from your login path if you have pre-existing accounts
    stored as bare sha256 hex (no salt, no colon).
    Returns True and upgrades the stored hash if the legacy password matches.
    Delete this function once all legacy users have logged in at least once.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT password_hash FROM users WHERE username = ?", (username,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return False
    stored = row["password_hash"]
    if ":" in stored:           # already migrated to salted format
        conn.close()
        return False
    legacy_ok = hmac.compare_digest(
        hashlib.sha256(password.encode()).hexdigest(), stored
    )
    if legacy_ok:
        cur.execute(
            "UPDATE users SET password_hash = ? WHERE username = ?",
            (hash_password(password), username),
        )
        conn.commit()
    conn.close()
    return legacy_ok


# =========================================
# MAIN
# =========================================

if __name__ == "__main__":
    create_tables()
    add_test_users()