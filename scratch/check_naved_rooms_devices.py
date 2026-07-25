from sqlalchemy import create_engine, text

db_url = "postgresql://postgres.bdtkybwlpcczyedqrbvz:GA4xt4n8Rw7%2CiG%2B@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
engine = create_engine(db_url)

with engine.connect() as conn:
    print("--- ROOMS FOR NAVED ---")
    rooms_query = text("""
        SELECT r.id, r.name, r.room_type 
        FROM rooms r
        JOIN homes h ON r.home_id = h.id
        JOIN users u ON h.owner_id = u.id
        WHERE u.username = 'Naved'
    """)
    rooms = conn.execute(rooms_query).fetchall()
    for r in rooms:
        print(f"Room ID: {r[0]} | Name: {r[1]} | Type: {r[2]}")

    print("\n--- DEVICES FOR NAVED ---")
    devices_query = text("""
        SELECT d.id, d.name, d.device_type, d.room_id, d.node_id, d.mac_address
        FROM devices d
        JOIN homes h ON d.home_id = h.id
        JOIN users u ON h.owner_id = u.id
        WHERE u.username = 'Naved'
    """)
    devices = conn.execute(devices_query).fetchall()
    for d in devices:
        print(f"Device ID: {d[0]} | Name: {d[1]} | Type: {d[2]} | Room ID: {d[3]} | Node ID: {d[4]} | MAC: {d[5]}")
