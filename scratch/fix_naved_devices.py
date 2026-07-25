from sqlalchemy import create_engine, text

db_url = "postgresql://postgres.bdtkybwlpcczyedqrbvz:GA4xt4n8Rw7%2CiG%2B@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
engine = create_engine(db_url)

gaming_room_id = "2118f819-5c53-4445-bcf7-c2a90ca8ed8b"

with engine.connect() as conn:
    print("Fixing device records in database...")
    
    # 1. Update mac_address and room_id for all 7 channels
    for suffix in range(1, 8):
        node_id = f"4L-NODE-A50528_{suffix}"
        
        # Determine correct type based on channel configs
        device_type = "light"
        if suffix == 5:
            device_type = "fan"
        elif suffix == 7:
            device_type = "outlet"
            
        update_query = text("""
            UPDATE devices
            SET mac_address = '4L-NODE-A50528',
                room_id = :room_id,
                device_type = :device_type
            WHERE node_id = :node_id
        """)
        
        conn.execute(update_query, {
            "room_id": gaming_room_id,
            "device_type": device_type,
            "node_id": node_id
        })
    
    conn.commit()
    print("Cleanup successful!")
