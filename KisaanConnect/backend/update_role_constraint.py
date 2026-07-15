import psycopg2
from pathlib import Path
from dotenv import load_dotenv
import os

load_dotenv(Path(__file__).parent / '.env')
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()

cur.execute('''
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('farmer','consumer','admin'));
''')
conn.commit()
print('Role constraint updated to allow admin')

cur.close()
conn.close()
