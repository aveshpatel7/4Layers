import sqlite3
import os

db_path = "backend/smartnest.db"
if not os.path.exists(db_path):
    print("DB not found at backend/smartnest.db")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, node_id, room_id, type FROM devices;")
    rows = cursor.fetchall()
    print(f"Total devices: {len(rows)}")
    for r in rows:
        print(r)
    conn.close()
