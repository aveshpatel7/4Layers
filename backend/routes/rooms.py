from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from backend.database import get_db
from backend import models, auth, schemas

router = APIRouter(prefix="/api/rooms", tags=["Rooms"])

@router.post("", response_model=schemas.RoomResponse, status_code=status.HTTP_201_CREATED)
def create_room(
    room_data: schemas.RoomCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new room in a home. Verifies home ownership."""
    home = db.query(models.Home).filter(models.Home.id == room_data.home_id).first()
    if not home:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Home not found"
        )
    if home.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the home owner can create new rooms"
        )
        
    new_room = models.Room(
        name=room_data.name,
        room_type=room_data.room_type,
        home_id=room_data.home_id
    )
    db.add(new_room)
    db.commit()
    db.refresh(new_room)
    return new_room

@router.get("", response_model=List[schemas.RoomResponse])
def get_all_user_rooms(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    user_home_ids = [h.id for h in current_user.homes]
    owned_rooms = []
    if user_home_ids:
        owned_rooms = db.query(models.Room).filter(models.Room.home_id.in_(user_home_ids)).all()

    result_list = []
    for r in owned_rooms:
        result_list.append(schemas.RoomResponse(
            id=r.id,
            home_id=r.home_id,
            name=r.name,
            room_type=r.room_type,
            is_shared=False,
            created_at=r.created_at
        ))

    # Shared nodes for current_user
    shared_shares = db.query(models.NodeShare).filter(
        models.NodeShare.shared_with_user_id == current_user.id
    ).all()
    shared_node_ids = [s.node_id for s in shared_shares if s.node_id]

    if shared_node_ids:
        from sqlalchemy import or_
        conditions = []
        for nid in shared_node_ids:
            conditions.append(models.Device.node_id == nid)
            conditions.append(models.Device.node_id.like(f"{nid}_%"))
        shared_devices = db.query(models.Device).filter(or_(*conditions)).all()
        shared_room_ids = list(set([d.room_id for d in shared_devices if d.room_id]))
        if shared_room_ids:
            s_rooms = db.query(models.Room).filter(models.Room.id.in_(shared_room_ids)).all()
            for r in s_rooms:
                is_owned = r.home and r.home.owner_id == current_user.id
                if not is_owned:
                    room_name = r.name if r.name.endswith(" (Shared)") else f"{r.name} (Shared)"
                    result_list.append(schemas.RoomResponse(
                        id=r.id,
                        home_id=r.home_id,
                        name=room_name,
                        room_type=r.room_type,
                        is_shared=True,
                        created_at=r.created_at
                    ))

    room_map = {r.id: r for r in result_list}
    return list(room_map.values())

@router.get("/home/{home_id}", response_model=List[schemas.RoomResponse])
def get_rooms(
    home_id: UUID,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve all rooms inside a specific home. Verifies home ownership."""
    home = db.query(models.Home).filter(
        models.Home.id == home_id,
        models.Home.owner_id == current_user.id
    ).first()
    
    if not home:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Home not found or access denied"
        )
        
    return db.query(models.Room).filter(models.Room.home_id == home_id).all()

@router.delete("/{room_id}", status_code=status.HTTP_200_OK)
def delete_room(
    room_id: UUID,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a room by UUID. Devices in this room will have room_id set to null."""
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )
    if not room.home or room.home.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the room owner can delete this room"
        )
        
    from backend import mqtt
    
    # Fetch all devices in the room to trigger remote factory reset
    devices = db.query(models.Device).filter(models.Device.room_id == room_id).all()
    unique_nodes = set()
    for dev in devices:
        node_id = dev.node_id
        base_node = node_id.rsplit('_', 1)[0] if "_" in node_id else node_id
        if base_node not in unique_nodes:
            unique_nodes.add(base_node)
            try:
                mqtt.publish_control_message(base_node, {"action": "factory_reset"})
            except Exception as e:
                print(f"[Rooms] Failed to publish remote factory reset for {base_node}: {e}")
                
    # Cascade delete all devices in this room
    db.query(models.Device).filter(models.Device.room_id == room_id).delete(synchronize_session=False)
    db.delete(room)
    db.commit()
    return {"detail": "Room and all its devices successfully deleted."}


@router.delete("/{room_id}/leave", status_code=status.HTTP_200_OK)
def leave_shared_room(
    room_id: UUID,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Allow a shared user to leave a room that was shared with them."""
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )

    # Find devices in this room to extract node_ids
    devices = db.query(models.Device).filter(models.Device.room_id == room_id).all()
    node_ids = set()
    for d in devices:
        if d.node_id:
            base_nid = d.node_id.split('_')[0] if '_' in d.node_id else d.node_id
            node_ids.add(base_nid)

    # Delete NodeShare records for current_user
    deleted_count = 0
    if node_ids:
        shares = db.query(models.NodeShare).filter(
            models.NodeShare.shared_with_user_id == current_user.id,
            models.NodeShare.node_id.in_(list(node_ids))
        ).all()
        for s in shares:
            db.delete(s)
            deleted_count += 1
        db.commit()

    if deleted_count == 0:
        # Fallback: remove all shares for current_user if matching specific nodes didn't hit
        shares = db.query(models.NodeShare).filter(
            models.NodeShare.shared_with_user_id == current_user.id
        ).all()
        for s in shares:
            db.delete(s)
            deleted_count += 1
        db.commit()

    return {"message": "Successfully left shared room"}

