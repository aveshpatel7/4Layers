import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from backend.database import get_db
from backend import models, auth, mqtt, schemas

router = APIRouter(prefix="/api/devices", tags=["Devices"])

@router.post("", response_model=schemas.DeviceResponse, status_code=status.HTTP_201_CREATED)
def add_device(
    device_data: schemas.DeviceCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Add a new device. Verifies home and room ownership."""
    # Verify home ownership
    home = db.query(models.Home).filter(
        models.Home.id == device_data.home_id,
        models.Home.owner_id == current_user.id
    ).first()
    
    if not home:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Home not found or access denied"
        )
    
    # Verify room is part of the home if provided
    if device_data.room_id:
        room = db.query(models.Room).filter(
            models.Room.id == device_data.room_id,
            models.Room.home_id == device_data.home_id
        ).first()
        if not room:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Room not found inside this home"
            )

    base_node_id = device_data.node_id.strip()

    # Check if this node or any of its channels is already registered
    existing_node = db.query(models.Device).filter(
        (models.Device.node_id == base_node_id) | 
        (models.Device.node_id.like(f"{base_node_id}_%"))
    ).first()
    
    if existing_node:
        # Transfer all channels of this base node to current_user's home and room (Universal Re-claiming)
        all_chan_devices = db.query(models.Device).filter(
            (models.Device.node_id == base_node_id) | 
            (models.Device.node_id.like(f"{base_node_id}_%"))
        ).all()
        for chan_dev in all_chan_devices:
            chan_dev.home_id = device_data.home_id
            chan_dev.room_id = device_data.room_id
            db.query(models.Schedule).filter(models.Schedule.device_id == chan_dev.id).delete(synchronize_session=False)
        db.commit()
        return all_chan_devices[0]

    channel_configs = [
        {"suffix": "1", "name": "Switch 1", "type": "light", "state": {"status": "OFF"}},
        {"suffix": "2", "name": "Switch 2", "type": "light", "state": {"status": "OFF"}},
        {"suffix": "3", "name": "Switch 3", "type": "light", "state": {"status": "OFF"}},
        {"suffix": "4", "name": "Switch 4", "type": "light", "state": {"status": "OFF"}},
        {"suffix": "5", "name": "Fan", "type": "fan", "state": {"status": "OFF", "value": 3}},
        {"suffix": "6", "name": "Master Switch", "type": "master", "state": {"status": "OFF"}}
    ]

    created_devices = []
    for cfg in channel_configs:
        chan_node_id = f"{base_node_id}_{cfg['suffix']}"
        chan_name = f"{device_data.name} {cfg['name']}" if device_data.name else cfg['name']
        
        new_device = models.Device(
            name=chan_name,
            device_type=cfg['type'],
            node_id=chan_node_id,
            home_id=device_data.home_id,
            room_id=device_data.room_id,
            is_online=False,
            current_state=cfg['state']
        )
        db.add(new_device)
        db.commit()
        db.refresh(new_device)

        # Log creation
        history_entry = models.DeviceHistory(
            device_id=new_device.id,
            change_type="device_created",
            previous_state=None,
            new_state=cfg['state']
        )
        db.add(history_entry)
        db.commit()
        
        created_devices.append(new_device)

    # Return the first channel (Switch 1) to satisfy API schema
    return created_devices[0]

@router.get("", response_model=List[schemas.DeviceResponse])
def get_devices(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve all devices owned by or shared with the authenticated user (max 6 channels per board)."""
    # 1. Owned devices
    owned_devices = db.query(models.Device).join(models.Home).filter(
        models.Home.owner_id == current_user.id
    ).all()

    # 2. Shared nodes for current_user
    shared_shares = db.query(models.NodeShare).filter(
        models.NodeShare.shared_with_user_id == current_user.id
    ).all()
    shared_node_ids = [s.node_id for s in shared_shares if s.node_id]

    shared_devices = []
    if shared_node_ids:
        from sqlalchemy import or_
        conditions = []
        for nid in shared_node_ids:
            conditions.append(models.Device.node_id == nid)
            conditions.append(models.Device.node_id.like(f"{nid}_%"))
        shared_devices = db.query(models.Device).filter(or_(*conditions)).all()

    # Combine and deduplicate by string representation of device ID and node_id
    device_map = {}
    for d in owned_devices + shared_devices:
        device_map[str(d.id)] = d

    valid_devices_map = {}
    for d in device_map.values():
        if d.node_id and "_" in d.node_id:
            suffix = d.node_id.rsplit('_', 1)[-1]
            if suffix.isdigit() and int(suffix) > 6:
                continue
        # Ensure node_id uniqueness across final list
        if d.node_id not in valid_devices_map:
            valid_devices_map[d.node_id] = d
    
    valid_devices = list(valid_devices_map.values())
    for d in valid_devices:
        if not getattr(d, 'local_ip', None) and d.current_state and isinstance(d.current_state, dict):
            d.local_ip = d.current_state.get('local_ip') or d.current_state.get('ip')
    valid_devices.sort(key=lambda x: x.node_id or "")
    return valid_devices

@router.delete("/{device_id}", status_code=status.HTTP_200_OK)
def remove_device(
    device_id: UUID,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a device owned by the authenticated user."""
    device = db.query(models.Device).join(models.Home).filter(
        models.Device.id == device_id,
        models.Home.owner_id == current_user.id
    ).first()

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found or access denied"
        )

    db.delete(device)
    db.commit()
    return {"detail": f"Device {device_id} removed successfully."}

@router.put("/{device_id}", response_model=schemas.DeviceResponse)
def update_device(
    device_id: UUID,
    device_update: schemas.DeviceUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Update device properties such as name, device_type, or room."""
    device = db.query(models.Device).join(models.Home).filter(
        models.Device.id == device_id,
        models.Home.owner_id == current_user.id
    ).first()

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found or access denied"
        )

    if device_update.name is not None:
        device.name = device_update.name.strip()
    if device_update.device_type is not None:
        device.device_type = device_update.device_type.strip().lower()
    if device_update.room_id is not None:
        # Verify room exists inside home
        room = db.query(models.Room).filter(
            models.Room.id == device_update.room_id,
            models.Room.home_id == device.home_id
        ).first()
        if not room:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target room not found in this home"
            )
        device.room_id = device_update.room_id

    db.commit()
    db.refresh(device)
    return device

@router.post("/{device_id}/control", status_code=status.HTTP_200_OK)
def control_device(
    device_id: UUID,
    control_data: schemas.DeviceControl,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Control a device's state.
    Publishes an MQTT control message to 'home/device/{node_id}/control'.
    Logs 'command_sent' to the history log immediately.
    The database state is updated when the physical device responds with status.
    """
    device = db.query(models.Device).filter(models.Device.id == device_id).first()

    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    is_authorized = False
    if device.home.owner_id == current_user.id:
        is_authorized = True
    else:
        base_node_id = device.node_id.split('_')[0] if device.node_id and '_' in device.node_id else device.node_id
        if base_node_id:
            share = db.query(models.NodeShare).filter(
                models.NodeShare.node_id == base_node_id,
                models.NodeShare.shared_with_user_id == current_user.id
            ).first()
            if share:
                is_authorized = True

    if not is_authorized:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    previous_state = device.current_state or {}
    requested_state = control_data.state

    # 1. Log "command_sent" in the database history log and update database state immediately
    # to prevent race conditions when the frontend refreshes state before MQTT roundtrip completes.
    updated_state = dict(previous_state)
    updated_state.update(requested_state)
    device.current_state = updated_state

    history_entry = models.DeviceHistory(
        device_id=device.id,
        change_type="command_sent",
        previous_state=previous_state,
        new_state=requested_state
    )
    db.add(history_entry)
    db.commit()

    # 2. Publish MQTT control message
    # Topic: home/device/{node_id}/control
    node_id_to_publish = device.node_id
    payload_to_publish = requested_state
    
    if "_" in device.node_id:
        parts = device.node_id.rsplit('_', 1)
        if len(parts) == 2 and parts[1].isdigit():
            base_node_id = parts[0]
            channel = int(parts[1])
            status_val = requested_state.get("status", "OFF")
            
            payload_to_publish = {
                "channel": channel,
                "status": status_val
            }
            if "value" in requested_state:
                if device.device_type == "fan":
                    payload_to_publish["speed"] = requested_state["value"]
                else:
                    payload_to_publish["value"] = requested_state["value"]
                    
            node_id_to_publish = base_node_id

    mqtt.publish_control_message(
        node_id=node_id_to_publish,
        state=payload_to_publish
    )

    return {
        "detail": f"Control command sent to device node {device.node_id}.",
        "device_id": device_id,
        "requested_state": requested_state,
        "previous_state": previous_state
    }

@router.get("/{device_id}/history", response_model=List[schemas.DeviceHistoryResponse])
def get_device_history(
    device_id: UUID,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve history log for a specific device owned by the authenticated user."""
    # Ensure device exists and is owned by the user
    device = db.query(models.Device).join(models.Home).filter(
        models.Device.id == device_id,
        models.Home.owner_id == current_user.id
    ).first()

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found or access denied"
        )

    # Return history logs ordered by newest first
    return db.query(models.DeviceHistory).filter(
        models.DeviceHistory.device_id == device_id
    ).order_by(models.DeviceHistory.timestamp.desc()).all()


@router.post("/bulk-control", status_code=status.HTTP_200_OK)
def bulk_control_devices(
    control_data: schemas.BulkDeviceControl,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Control multiple devices at once.
    Publishes MQTT control messages to their respective topics.
    """
    devices = db.query(models.Device).filter(models.Device.id.in_(control_data.device_ids)).all()

    if not devices:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No valid devices found")
        
    shared_shares = db.query(models.NodeShare).filter(
        models.NodeShare.shared_with_user_id == current_user.id
    ).all()
    shared_node_ids = {s.node_id for s in shared_shares if s.node_id}

    authorized_devices = []
    for device in devices:
        if device.home.owner_id == current_user.id:
            authorized_devices.append(device)
        else:
            base_node_id = device.node_id.split('_')[0] if device.node_id and '_' in device.node_id else device.node_id
            if base_node_id in shared_node_ids:
                authorized_devices.append(device)

    if not authorized_devices:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    
    devices = authorized_devices

    # Update all database states first to prevent race conditions on UI refresh
    for device in devices:
        previous_state = device.current_state or {}
        requested_state = control_data.state

        updated_state = dict(previous_state)
        updated_state.update(requested_state)
        device.current_state = updated_state

        # Log "command_sent"
        history_entry = models.DeviceHistory(
            device_id=device.id,
            change_type="command_sent",
            previous_state=previous_state,
            new_state=requested_state
        )
        db.add(history_entry)

    # Group devices by base node ID to optimize MQTT commands
    grouped_by_base = {}
    for device in devices:
        base_node_id = device.node_id
        channel = 7
        if "_" in device.node_id:
            parts = device.node_id.rsplit('_', 1)
            if len(parts) == 2 and parts[1].isdigit():
                base_node_id = parts[0]
                channel = int(parts[1])
        
        if base_node_id not in grouped_by_base:
            grouped_by_base[base_node_id] = []
        grouped_by_base[base_node_id].append((device, channel))

    # Publish optimized MQTT commands
    for base_node_id, device_channel_pairs in grouped_by_base.items():
        channels = [pair[1] for pair in device_channel_pairs]
        requested_state = control_data.state
        status_val = requested_state.get("status", "OFF")

        if 6 in channels or 7 in channels:
            # Optimize: Only send a single Master Switch (channel 6 or 7) command!
            # The firmware automatically applies this to all other channels.
            master_chan = 6 if 6 in channels else 7
            payload_to_publish = {
                "channel": master_chan,
                "status": status_val
            }
            mqtt.publish_control_message(
                node_id=base_node_id,
                state=payload_to_publish
            )
        else:
            # Publish individual channel control messages
            for device, channel in device_channel_pairs:
                payload_to_publish = {
                    "channel": channel,
                    "status": status_val
                }
                if "value" in requested_state:
                    if device.device_type == "fan":
                        payload_to_publish["speed"] = requested_state["value"]
                    else:
                        payload_to_publish["value"] = requested_state["value"]

                mqtt.publish_control_message(
                    node_id=base_node_id,
                    state=payload_to_publish
                )

    db.commit()
    return {"detail": f"Bulk control commands sent to {len(devices)} devices."}


@router.post("/provision", status_code=status.HTTP_200_OK)
def provision_device(
    provision_data: schemas.DeviceProvision,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Check if a device with this MAC address already exists.
    If yes, updates its room and name prefix and returns its UUID.
    If no, registers a new device node under the specified or default Room for the user.
    """
    mac = provision_data.mac_address.strip()
    
    # Resolve or create home for current user
    home = db.query(models.Home).filter(models.Home.owner_id == current_user.id).first()
    if not home:
        home = models.Home(
            name="4Layers Home",
            owner_id=current_user.id
        )
        db.add(home)
        db.commit()
        db.refresh(home)

    # Resolve or create room
    resolved_room_id = None
    if provision_data.room_id:
        room = db.query(models.Room).filter(
            models.Room.id == provision_data.room_id,
            models.Room.home_id == home.id
        ).first()
        if room:
            resolved_room_id = room.id
            
    if not resolved_room_id and provision_data.new_room_name:
        new_name = provision_data.new_room_name.strip()
        if new_name:
            room = db.query(models.Room).filter(
                models.Room.name == new_name,
                models.Room.home_id == home.id
            ).first()
            if not room:
                room = models.Room(
                    name=new_name,
                    room_type=provision_data.new_room_type or "living_room",
                    home_id=home.id
                )
                db.add(room)
                db.commit()
                db.refresh(room)
            resolved_room_id = room.id

    if not resolved_room_id:
        room = db.query(models.Room).filter(models.Room.home_id == home.id).first()
        if not room:
            room = models.Room(
                name="Control Room",
                room_type="living_room",
                home_id=home.id
            )
            db.add(room)
            db.commit()
            db.refresh(room)
        resolved_room_id = room.id

    prefix = provision_data.name.strip() if provision_data.name else ""

    channel_configs = [
        {"suffix": "1", "name": "Switch 1", "type": "light", "state": {"status": "OFF"}},
        {"suffix": "2", "name": "Switch 2", "type": "light", "state": {"status": "OFF"}},
        {"suffix": "3", "name": "Switch 3", "type": "light", "state": {"status": "OFF"}},
        {"suffix": "4", "name": "Switch 4", "type": "light", "state": {"status": "OFF"}},
        {"suffix": "5", "name": "Fan", "type": "fan", "state": {"status": "OFF", "value": 3}},
        {"suffix": "6", "name": "Master Switch", "type": "master", "state": {"status": "OFF"}}
    ]

    # Check if this node already exists (matching by mac_address OR base node_id)
    device = db.query(models.Device).filter(
        (models.Device.mac_address == mac) |
        (models.Device.node_id == mac) |
        (models.Device.node_id.like(f"{mac}_%"))
    ).first()
    if device:
        # Seamless Re-claiming: Ensure device is assigned to current user's primary home
        user_home = db.query(models.Home).filter(models.Home.owner_id == current_user.id).first()
        if not user_home:
            user_home = models.Home(name=f"{current_user.username}'s Home", owner_id=current_user.id)
            db.add(user_home)
            db.commit()
            db.refresh(user_home)
        
        # Cleanly transfer all 7 channels of this MAC to current user's home & room
        # and reset channel names to fresh defaults so old user's names never leak!
        for cfg in channel_configs:
            chan_node_id = f"{mac}_{cfg['suffix']}"
            new_chan_name = f"{prefix} {cfg['name']}" if prefix else cfg['name']
            
            chan_device = db.query(models.Device).filter(models.Device.node_id == chan_node_id).first()
            if chan_device:
                chan_device.home_id = user_home.id
                chan_device.room_id = resolved_room_id
                chan_device.name = new_chan_name
                chan_device.device_type = cfg['type']
                chan_device.current_state = cfg['state']
                
                # Delete any old schedules linked to this device from previous owner
                db.query(models.Schedule).filter(models.Schedule.device_id == chan_device.id).delete(synchronize_session=False)

        db.commit()
        return {"id": device.id}

    # Create 7 channels automatically for the switchboard board
    import uuid
    created_devices = []
    for cfg in channel_configs:
        chan_node_id = f"{mac}_{cfg['suffix']}"
        
        # Check if this channel already exists in DB to prevent duplicates
        existing_chan = db.query(models.Device).filter(models.Device.node_id == chan_node_id).first()
        if existing_chan:
            created_devices.append(existing_chan)
            continue
            
        chan_name = f"{prefix} {cfg['name']}" if prefix else f"Smart {cfg['name']}"
        device_id = uuid.uuid4()
        
        new_device = models.Device(
            id=device_id,
            name=chan_name,
            device_type=cfg['type'],
            node_id=chan_node_id,
            mac_address=mac,
            home_id=home.id,
            room_id=resolved_room_id,
            is_online=False,
            current_state=cfg['state']
        )
        db.add(new_device)
        db.commit()
        db.refresh(new_device)

        # Log history
        history_entry = models.DeviceHistory(
            device_id=new_device.id,
            change_type="device_created",
            previous_state=None,
            new_state=cfg['state']
        )
        db.add(history_entry)
        db.commit()
        
        created_devices.append(new_device)

    # Return the first channel (Switch 1) to satisfy API schema
    return {"id": created_devices[0].id if created_devices else uuid.uuid4()}

@router.post("/provision-single", response_model=schemas.DeviceResponse, status_code=status.HTTP_201_CREATED)
def provision_single_channel(
    provision_data: schemas.DeviceProvisionSingle,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Dynamically activate/re-create a single switch (channel suffix) under a board."""
    mac = provision_data.mac_address.strip().upper()
    suffix = provision_data.suffix.strip()
    chan_node_id = f"{mac}_{suffix}"

    # Verify home and room ownership
    room = db.query(models.Room).join(models.Home).filter(
        models.Room.id == provision_data.room_id,
        models.Home.owner_id == current_user.id
    ).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found or access denied"
        )

    # Check if channel node ID already exists
    existing = db.query(models.Device).filter(models.Device.node_id == chan_node_id).first()
    if existing:
        # Re-assign or just update room
        existing.room_id = room.id
        existing.device_type = provision_data.device_type.strip().lower()
        db.commit()
        db.refresh(existing)
        return existing

    # Define default attributes based on suffix type
    default_name = f"Switch {suffix}"
    if suffix == "5":
        default_name = "Fan"
    elif suffix == "6":
        default_name = "Master Switch"

    new_device = models.Device(
        id=uuid.uuid4(),
        name=default_name,
        device_type=provision_data.device_type.strip().lower(),
        node_id=chan_node_id,
        mac_address=mac,
        home_id=room.home_id,
        room_id=room.id,
        is_online=False,
        current_state={"status": "OFF", "value": 3 if suffix == "5" else (50 if suffix == "6" else 0)}
    )
    db.add(new_device)
    db.commit()
    db.refresh(new_device)
    return new_device

