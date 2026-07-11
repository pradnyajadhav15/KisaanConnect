import psycopg2
from pathlib import Path
from dotenv import load_dotenv
import os

load_dotenv(Path(__file__).parent / '.env')

conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()
cur.execute(Path(__file__).parent.joinpath('schema.sql').read_text())
conn.commit()

cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
print('Tables created:', cur.fetchall())

cur.close()
conn.close()
print('Schema applied successfully')
