from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from uuid import UUID

from backend.database import get_db
from backend import models, auth, schemas

router = APIRouter(prefix="/api/schedules", tags=["Schedules"])

def is_user_authorized_for_device(db: Session, user: models.User, device: models.Device) -> bool:
    """Verify if user is owner of the device's home or has active NodeShare access."""
    if not device:
        return False

    # 1. Check if user is owner of the home directly or via relationship
    if device.home and device.home.owner_id == user.id:
        return True
    if device.home_id:
        home = db.query(models.Home).filter(models.Home.id == device.home_id, models.Home.owner_id == user.id).first()
        if home:
            return True

    # 2. Check NodeShare (case-insensitive on base_node_id or full node_id)
    raw_node_id = device.node_id or ""
    base_node_id = raw_node_id.split('_')[0] if '_' in raw_node_id else raw_node_id

    share_match = db.query(models.NodeShare).filter(
        models.NodeShare.shared_with_user_id == user.id,
        or_(
            func.lower(models.NodeShare.node_id) == func.lower(base_node_id),
            func.lower(models.NodeShare.node_id) == func.lower(raw_node_id)
        )
    ).first()

    if share_match:
        return True

    # 3. Check by mac_address if present
    if getattr(device, 'mac_address', None) and device.mac_address:
        mac_share = db.query(models.NodeShare).filter(
            models.NodeShare.shared_with_user_id == user.id,
            func.lower(models.NodeShare.node_id) == func.lower(device.mac_address)
        ).first()
        if mac_share:
            return True

    return False

@router.post("", response_model=schemas.ScheduleResponse, status_code=status.HTTP_201_CREATED)
def create_schedule(
    schedule_data: schemas.ScheduleCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new device auto-toggle schedule. Verifies device ownership or NodeShare access."""
    print(f"[SCHEDULE CREATE] Received POST /api/schedules from User '{current_user.email}' ({current_user.id}): device_id={schedule_data.device_id}, action={schedule_data.action}, time={schedule_data.time}, days={schedule_data.days}, actions={schedule_data.actions}")

    device = db.query(models.Device).filter(models.Device.id == schedule_data.device_id).first()

    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    target_devices = [device]
    if schedule_data.actions and isinstance(schedule_data.actions, list):
        for act in schedule_data.actions:
            d_id = act.get("device_id")
            if d_id and str(d_id) != str(schedule_data.device_id):
                sub_dev = db.query(models.Device).filter(models.Device.id == d_id).first()
                if sub_dev:
                    target_devices.append(sub_dev)

    for dev_item in target_devices:
        if not is_user_authorized_for_device(db, current_user, dev_item):
            print(f"[SCHEDULE CREATE] Access denied for User '{current_user.email}' on device '{dev_item.name}' ({dev_item.id})")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Access denied for device '{dev_item.name}'")
        
    actions_data = None
    if schedule_data.actions and isinstance(schedule_data.actions, list):
        actions_data = schedule_data.actions

    new_schedule = models.Schedule(
        user_id=current_user.id,
        device_id=schedule_data.device_id,
        action=schedule_data.action,
        time=schedule_data.time,
        days=schedule_data.days.lower(),
        enabled=schedule_data.enabled,
        actions_json=actions_data
    )
    
    db.add(new_schedule)
    db.commit()
    db.refresh(new_schedule)
    print(f"[SCHEDULE CREATE] Successfully created Schedule {new_schedule.id} for User '{current_user.email}'")
    return new_schedule

@router.get("", response_model=List[schemas.ScheduleResponse])
def get_schedules(
    device_id: Optional[UUID] = None,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve all schedules created by or accessible to the authenticated user."""
    # 1. Devices owned by user
    owned_devices = db.query(models.Device).join(models.Home).filter(
        models.Home.owner_id == current_user.id
    ).all()
    accessible_device_ids = {d.id for d in owned_devices}

    # 2. Devices shared with user
    shared_shares = db.query(models.NodeShare).filter(
        models.NodeShare.shared_with_user_id == current_user.id
    ).all()
    shared_node_ids = [s.node_id for s in shared_shares if s.node_id]
    
    if shared_node_ids:
        conditions = []
        for nid in shared_node_ids:
            conditions.append(func.lower(models.Device.node_id) == func.lower(nid))
            conditions.append(func.lower(models.Device.node_id).like(f"{nid.lower()}_%"))
        shared_devices = db.query(models.Device).filter(or_(*conditions)).all()
        for d in shared_devices:
            accessible_device_ids.add(d.id)

    # Allow schedules matching accessible devices OR created by current_user
    filter_conditions = [models.Schedule.user_id == current_user.id]
    if accessible_device_ids:
        filter_conditions.append(models.Schedule.device_id.in_(accessible_device_ids))

    query = db.query(models.Schedule).filter(or_(*filter_conditions))
    if device_id:
        query = query.filter(models.Schedule.device_id == device_id)
        
    return query.all()

@router.patch("/{schedule_id}", response_model=schemas.ScheduleResponse)
@router.put("/{schedule_id}", response_model=schemas.ScheduleResponse)
def update_schedule(
    schedule_id: UUID,
    schedule_data: schemas.ScheduleUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Update a specific schedule settings."""
    schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")

    device = schedule.device
    is_authorized = (schedule.user_id == current_user.id) or is_user_authorized_for_device(db, current_user, device)

    if not is_authorized:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        
    if schedule_data.action is not None:
        schedule.action = schedule_data.action
    if schedule_data.time is not None:
        schedule.time = schedule_data.time
    if schedule_data.days is not None:
        schedule.days = schedule_data.days.lower()
    if schedule_data.enabled is not None:
        schedule.enabled = schedule_data.enabled
    if schedule_data.actions is not None:
        schedule.actions_json = schedule_data.actions
        # If primary device_id is updated in actions, sync device_id
        if len(schedule_data.actions) > 0 and schedule_data.actions[0].get("device_id"):
            schedule.device_id = schedule_data.actions[0]["device_id"]
        
    db.commit()
    db.refresh(schedule)
    return schedule

@router.delete("/{schedule_id}", status_code=status.HTTP_200_OK)
def delete_schedule(
    schedule_id: UUID,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a schedule configuration by ID."""
    schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")

    device = schedule.device
    is_authorized = (schedule.user_id == current_user.id) or is_user_authorized_for_device(db, current_user, device)

    if not is_authorized:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        
    db.delete(schedule)
    db.commit()
    return {"detail": "Schedule successfully deleted."}

@router.post("/{schedule_id}/run", status_code=status.HTTP_200_OK)
def trigger_schedule_manually(
    schedule_id: UUID,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Demo Helper: Manually triggers the schedule's action immediately via MQTT."""
    schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")

    device = schedule.device
    is_authorized = (schedule.user_id == current_user.id) or is_user_authorized_for_device(db, current_user, device)

    if not is_authorized:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        
    device = db.query(models.Device).filter(models.Device.id == schedule.device_id).first()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated device not found"
        )
        
    # Trigger MQTT command
    from backend import mqtt
    import datetime
    requested_state = { "status": schedule.action }
    previous_state = device.current_state or {}
    
    # Update device current_state in DB
    new_state = {**previous_state, **requested_state}
    device.current_state = new_state
    device.updated_at = datetime.datetime.utcnow()
    db.add(device)
    
    history_entry = models.DeviceHistory(
        device_id=device.id,
        change_type="command_sent",
        previous_state=previous_state,
        new_state=requested_state
    )
    db.add(history_entry)
    
    alert_entry = models.Alert(
        user_id=current_user.id,
        device_id=device.id,
        type="schedule_run",
        message=f"Manual Run: Schedule triggered action '{schedule.action}' for appliance '{device.name}'.",
        is_read=False
    )
    db.add(alert_entry)
    
    db.commit()
    
    mqtt.publish_control_message(
        node_id=device.node_id,
        state=requested_state
    )
    
    return {"detail": "Schedule triggered successfully", "status": "fired"}

