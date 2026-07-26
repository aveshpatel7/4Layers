from backend import database, models

models.Base.metadata.create_all(bind=database.engine)

db = database.SessionLocal()

users = db.query(models.User).all()
print("=== USERS ===")
for u in users:
    print("User:", u.id, u.username, u.email)

homes = db.query(models.Home).all()
print("\n=== HOMES ===")
for h in homes:
    print("Home:", h.id, h.name, "OwnerID:", h.owner_id)

rooms = db.query(models.Room).all()
print("\n=== ROOMS ===")
for r in rooms:
    print("Room:", r.id, r.name, "HomeID:", r.home_id)

devs = db.query(models.Device).all()
print("\n=== DEVICES ===")
for d in devs:
    print("Device ID:", d.id, "| Name:", d.name, "| MAC:", d.mac_address, "| NodeID:", d.node_id, "| RoomID:", d.room_id)
