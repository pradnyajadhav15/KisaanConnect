import psycopg2
from pathlib import Path
from dotenv import load_dotenv
import os
import sys
sys.path.insert(0, str(Path(__file__).parent))
from auth.db_setup import hash_password

load_dotenv(Path(__file__).parent / '.env')
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()

cur.execute('SELECT id FROM users WHERE username = %s', ('admin',))
if cur.fetchone():
    print('Admin already exists')
else:
    cur.execute(
        'INSERT INTO users (username, password_hash, role, name, email) VALUES (%s,%s,%s,%s,%s)',
        ('admin', hash_password('AdminPass123!'), 'admin', 'Site Admin', 'admin@kisaanconnect.local')
    )
    conn.commit()
    print('Admin user created: username=admin password=AdminPass123!')

cur.close()
conn.close()
