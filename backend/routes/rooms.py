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
    home = db.query(models.Home).filter(
        models.Home.id == room_data.home_id,
        models.Home.owner_id == current_user.id
    ).first()
    
    if not home:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Home not found or access denied"
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
    """Retrieve all rooms across all homes owned by the user."""
    user_home_ids = [h.id for h in current_user.homes]
    if not user_home_ids:
        return []
    return db.query(models.Room).filter(models.Room.home_id.in_(user_home_ids)).all()

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
    room = db.query(models.Room).join(models.Home).filter(
        models.Room.id == room_id,
        models.Home.owner_id == current_user.id
    ).first()
    
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found or access denied"
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
