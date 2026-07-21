import os
import psycopg2
import psycopg2.extras
import psycopg2.pool
from contextlib import contextmanager
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / '.env')
DATABASE_URL = os.getenv('DATABASE_URL')

_pool = psycopg2.pool.ThreadedConnectionPool(
    1, 10,
    dsn=DATABASE_URL,
    cursor_factory=psycopg2.extras.RealDictCursor,
)


def _get_live_connection():
    conn = _pool.getconn()
    try:
        if conn.closed:
            raise psycopg2.InterfaceError('connection closed')
        probe = conn.cursor()
        probe.execute('SELECT 1')
        probe.close()
        return conn
    except (psycopg2.OperationalError, psycopg2.InterfaceError):
        try:
            _pool.putconn(conn, close=True)
        except Exception:
            pass
        return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


@contextmanager
def get_db():
    conn = _get_live_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        try:
            _pool.putconn(conn)
        except Exception:
            try:
                conn.close()
            except Exception:
                pass
