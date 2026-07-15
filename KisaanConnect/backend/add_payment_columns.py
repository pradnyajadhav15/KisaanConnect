import psycopg2
from pathlib import Path
from dotenv import load_dotenv
import os

load_dotenv(Path(__file__).parent / '.env')
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()

cur.execute('''
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cod';
''')
conn.commit()
print('Payment columns added to orders table')

cur.close()
conn.close()
