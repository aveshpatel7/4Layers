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
    """Create a new device auto-toggle schedule. Verifies device ownership."""
    device = db.query(models.Device).join(models.Home).filter(
        models.Device.id == schedule_data.device_id,
        models.Home.owner_id == current_user.id
    ).first()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found or access denied"
        )
        
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
    return new_schedule

@router.get("", response_model=List[schemas.ScheduleResponse])
def get_schedules(
    device_id: Optional[UUID] = None,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve all schedules for the current authenticated user."""
    query = db.query(models.Schedule).filter(models.Schedule.user_id == current_user.id)
    if device_id:
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
    schedule = db.query(models.Schedule).filter(
        models.Schedule.id == schedule_id,
        models.Schedule.user_id == current_user.id
    ).first()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found or access denied"
        )
        
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
    schedule = db.query(models.Schedule).filter(
        models.Schedule.id == schedule_id,
        models.Schedule.user_id == current_user.id
    ).first()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found or access denied"
        )
        
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
    schedule = db.query(models.Schedule).filter(
        models.Schedule.id == schedule_id,
        models.Schedule.user_id == current_user.id
    ).first()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found or access denied"
        )
        
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
