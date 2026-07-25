from sqlalchemy import create_engine, text

db_url = "postgresql://postgres.bdtkybwlpcczyedqrbvz:GA4xt4n8Rw7%2CiG%2B@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
engine = create_engine(db_url)

with engine.connect() as conn:
    print("Dropping unique index/constraint from Supabase...")
    # Drop index if it exists
    conn.execute(text("DROP INDEX IF EXISTS ix_devices_mac_address;"))
    # Also drop unique constraint if it was created as a constraint
    try:
        conn.execute(text("ALTER TABLE devices DROP CONSTRAINT IF EXISTS ix_devices_mac_address;"))
    except Exception as e:
        print("Constraint drop info/warning:", e)
    
    conn.commit()
    print("Successfully dropped unique constraint/index!")
