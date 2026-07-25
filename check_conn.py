import sys
from sqlalchemy import create_engine, text

db_url = "postgresql://postgres.bdtkybwlpcczyedqrbvz:GA4xt4n8Rw7%2CiG%2B@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
print("Creating engine...")
engine = create_engine(db_url, connect_args={"connect_timeout": 5})

try:
    print("Connecting...")
    with engine.connect() as conn:
        print("Executing query...")
        res = conn.execute(text("SELECT id, username, email FROM users"))
        users = res.fetchall()
        print(f"SUCCESS! Total users: {len(users)}")
        for u in users:
            print(f"ID: {u[0]} | Username: {u[1]} | Email: {u[2]}")
except Exception as e:
    print(f"ERROR: {e}")
