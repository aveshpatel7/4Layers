"""
4Layers Smart Home - Admin Management API Routes
Provides endpoints for User Management, Live Device Monitoring, and MQTT/Firmware OTA Operations.
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import datetime
import logging

from database import get_db
import models
import mqtt

router = APIRouter(prefix="/api/admin", tags=["Admin Management"])
logger = logging.getLogger(__name__)

# --- Pydantic Schemas ---

class UserStatusUpdate(BaseModel):
    is_active: bool

class MqttPublishRequest(BaseModel):
    topic: str
    payload: str

class OtaUpdateRequest(BaseModel):
    device_id: Optional[str] = None  # None means broadcast to all online devices
    firmware_url: str
    firmware_version: str

# --- Endpoints ---

@app_router = router

@router.get("/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    """Overview statistics for Admin Dashboard."""
    total_users = db.query(models.User).count()
    total_devices = db.query(models.Device).count()
    active_users = db.query(models.User).filter(models.User.is_active == True).count()
    online_devices = db.query(models.Device).filter(models.Device.is_online == True).count()
    
    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_devices": total_devices,
        "online_devices": online_devices,
        "system_status": "OPERATIONAL",
        "mqtt_broker_status": "CONNECTED" if mqtt.mqtt_client and mqtt.mqtt_client.is_connected() else "DISCONNECTED",
        "server_time": datetime.datetime.utcnow().isoformat()
    }

@router.get("/users")
def list_all_users(db: Session = Depends(get_db)):
    """List all registered users with linked devices count and account status."""
    users = db.query(models.User).all()
    user_list = []
    
    for u in users:
        device_count = db.query(models.Device).filter(models.Device.user_id == u.id).count()
        room_count = db.query(models.Room).filter(models.Room.user_id == u.id).count() if hasattr(models, 'Room') else 0
        
        user_list.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "full_name": getattr(u, 'full_name', u.username),
            "is_active": u.is_active,
            "role": getattr(u, 'role', 'user'),
            "created_at": u.created_at.isoformat() if hasattr(u, 'created_at') and u.created_at else None,
            "device_count": device_count,
            "room_count": room_count
        })
        
    return user_list

@router.put("/users/{user_id}/status")
def update_user_status(user_id: int, status_in: UserStatusUpdate, db: Session = Depends(get_db)):
    """Enable or block user account access."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.is_active = status_in.is_active
    db.commit()
    db.refresh(user)
    
    status_str = "activated" if user.is_active else "blocked"
    logger.info(f"Admin updated User ID {user_id} status to {status_str}")
    return {"message": f"User successfully {status_str}", "is_active": user.is_active}

@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    """Delete user account and unassign their devices."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Unlink user devices
    devices = db.query(models.Device).filter(models.Device.user_id == user_id).all()
    for dev in devices:
        dev.user_id = None
        
    db.delete(user)
    db.commit()
    return {"message": f"User ID {user_id} deleted successfully"}

@router.get("/devices")
def list_all_devices(db: Session = Depends(get_db)):
    """List all registered smart home ESP32 nodes and telemetry data."""
    devices = db.query(models.Device).all()
    device_list = []
    
    for d in devices:
        owner = db.query(models.User).filter(models.User.id == d.user_id).first() if d.user_id else None
        
        device_list.append({
            "id": d.id,
            "device_id": d.device_id,
            "name": d.name,
            "is_online": d.is_online,
            "ip_address": getattr(d, 'ip_address', '192.168.1.105'),
            "firmware_version": getattr(d, 'firmware_version', 'v2.0.4'),
            "rssi": getattr(d, 'rssi', -65),
            "owner_email": owner.email if owner else "Unassigned",
            "last_seen": d.updated_at.isoformat() if hasattr(d, 'updated_at') and d.updated_at else None,
            "device_type": getattr(d, 'device_type', '4-Channel Smart Switchboard')
        })
        
    return device_list

@router.post("/mqtt/publish")
def publish_mqtt_message(req: MqttPublishRequest):
    """Publish custom MQTT payload from Admin Console."""
    if not mqtt.mqtt_client or not mqtt.mqtt_client.is_connected():
        raise HTTPException(status_code=500, detail="MQTT broker not connected")
        
    mqtt.mqtt_client.publish(req.topic, req.payload)
    logger.info(f"Admin published MQTT payload to {req.topic}: {req.payload}")
    return {"status": "published", "topic": req.topic, "payload": req.payload}

@router.post("/ota/trigger")
def trigger_ota_update(req: OtaUpdateRequest):
    """Trigger Over-The-Air firmware update command via MQTT."""
    if not mqtt.mqtt_client or not mqtt.mqtt_client.is_connected():
        raise HTTPException(status_code=500, detail="MQTT broker not connected")
        
    topic = f"4layers/devices/{req.device_id}/ota" if req.device_id else "4layers/ota/broadcast"
    payload = f'{{"action":"UPDATE_FIRMWARE","url":"{req.firmware_url}","version":"{req.firmware_version}"}}'
    
    mqtt.mqtt_client.publish(topic, payload)
    logger.info(f"Admin triggered OTA update via {topic}: {payload}")
    return {"status": "OTA_TRIGGERED", "target_topic": topic, "version": req.firmware_version}
