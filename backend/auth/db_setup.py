import sqlite3
import hashlib
from pathlib import Path


# =========================================
# DATABASE PATH SETUP
# =========================================

# Folder where database will be stored
DB_DIR = Path(__file__).parent / "data"

# Full path to database file
DB_PATH = DB_DIR / "users.db"


# =========================================
# PASSWORD HASHING FUNCTION
# =========================================

def hash_password(password: str) -> str:
    """
    Convert plain password into SHA-256 hashed password.
    This ensures passwords are not stored in plain text.
    """
    return hashlib.sha256(password.encode()).hexdigest()


# =========================================
# CREATE DATABASE TABLE
# =========================================

def create_tables():
    """
    Creates the 'users' table if it does not already exist.
    """

    # Ensure data directory exists
    DB_DIR.mkdir(exist_ok=True)

    # Connect to SQLite database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Create users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            name TEXT,
            email TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Save changes and close connection
    conn.commit()
    conn.close()

    print(f"✅ Database setup completed at {DB_PATH}")


# =========================================
# ADD SAMPLE TEST USERS
# =========================================

def add_test_users():
    """
    Inserts one farmer and one consumer for testing.
    """

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Check if users already exist
    cursor.execute(
        "SELECT COUNT(*) FROM users WHERE username IN ('farmer1', 'consumer1')"
    )

    count = cursor.fetchone()[0]

    if count == 0:
        # Add farmer user
        password_hash = hash_password("password123")

        cursor.execute(
            "INSERT INTO users (username, password_hash, role, name, email) VALUES (?, ?, ?, ?, ?)",
            ("farmer1", password_hash, "farmer", "John Farmer", "farmer1@example.com")
        )

        # Add consumer user
        password_hash = hash_password("password123")

        cursor.execute(
            "INSERT INTO users (username, password_hash, role, name, email) VALUES (?, ?, ?, ?, ?)",
            ("consumer1", password_hash, "consumer", "Mary Consumer", "consumer1@example.com")
        )

        conn.commit()
        print("✅ Added test users:")
        print("➡ farmer1 | password: password123")
        print("➡ consumer1 | password: password123")

    else:
        print("ℹ️ Test users already exist")

    conn.close()


# =========================================
# RUN THIS FILE DIRECTLY
# =========================================

if __name__ == "__main__":
    create_tables()
    add_test_users()
