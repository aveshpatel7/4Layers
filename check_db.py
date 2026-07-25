from backend.database import SessionLocal
from backend import models

db = SessionLocal()
devs = db.query(models.Device).all()
print("--- TOTAL DEVICES IN DB:", len(devs), "---")
for d in devs:
    print(f"ID: {d.id} | Name: {d.name} | MAC: {d.mac_address} | RoomID: {d.room_id}")

rooms = db.query(models.Room).all()
print("\n--- ROOMS IN DB:", len(rooms), "---")
for r in rooms:
    print(f"Room ID: {r.id} | Name: {r.name}")
