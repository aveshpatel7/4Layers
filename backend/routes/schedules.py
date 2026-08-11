from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from backend.database import get_db
from backend import models, auth, schemas

router = APIRouter(prefix="/api/schedules", tags=["Schedules"])

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
        is_auth = False
        if dev_item.home.owner_id == current_user.id:
            is_auth = True
        else:
            base_node_id = dev_item.node_id.split('_')[0] if dev_item.node_id and '_' in dev_item.node_id else dev_item.node_id
            if base_node_id:
                share = db.query(models.NodeShare).filter(
                    models.NodeShare.node_id == base_node_id,
                    models.NodeShare.shared_with_user_id == current_user.id
                ).first()
                if share:
                    is_auth = True

        if not is_auth:
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
    """Retrieve all schedules for devices the user has access to."""
    owned_devices = db.query(models.Device).join(models.Home).filter(
        models.Home.owner_id == current_user.id
    ).all()
    accessible_device_ids = {d.id for d in owned_devices}

    shared_shares = db.query(models.NodeShare).filter(
        models.NodeShare.shared_with_user_id == current_user.id
    ).all()
    shared_node_ids = {s.node_id for s in shared_shares if s.node_id}
    
    if shared_node_ids:
        from sqlalchemy import or_
        conditions = []
        for nid in shared_node_ids:
            conditions.append(models.Device.node_id == nid)
            conditions.append(models.Device.node_id.like(f"{nid}_%"))
        shared_devices = db.query(models.Device).filter(or_(*conditions)).all()
        for d in shared_devices:
            accessible_device_ids.add(d.id)

    query = db.query(models.Schedule).filter(models.Schedule.device_id.in_(accessible_device_ids))
    if device_id:
        if device_id not in accessible_device_ids:
            return []
        query = query.filter(models.Schedule.device_id == device_id)
        
    return query.all()

@router.patch("/{schedule_id}", response_model=schemas.ScheduleResponse)
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
        
    if schedule_data.action is not None:
        schedule.action = schedule_data.action
    if schedule_data.time is not None:
        schedule.time = schedule_data.time
    if schedule_data.days is not None:
        schedule.days = schedule_data.days.lower()
    if schedule_data.enabled is not None:
        schedule.enabled = schedule_data.enabled
        
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
