"""
4Layers Smart Home - Admin Management API Routes
Provides endpoints for User Management, Live Device Monitoring, and MQTT/Firmware OTA Operations.
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import datetime
import uuid
import logging

from backend.database import get_db
from backend import models, mqtt

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

@router.get("/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    """Overview statistics for Admin Dashboard."""
    total_users = db.query(models.User).count()
    total_devices = db.query(models.Device).count()
    active_users = total_users  # All registered users are active
    online_devices = db.query(models.Device).filter(models.Device.is_online == True).count()
    
    is_mqtt_connected = False
    try:
        if hasattr(mqtt, 'client') and mqtt.client and getattr(mqtt.client, 'is_connected', None):
            is_mqtt_connected = mqtt.client.is_connected()
        elif hasattr(mqtt, 'client') and mqtt.client and hasattr(mqtt.client, '_state'):
            is_mqtt_connected = (mqtt.client._state == 1)
    except Exception:
        is_mqtt_connected = False
    
    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_devices": total_devices,
        "online_devices": online_devices,
        "system_status": "OPERATIONAL",
        "mqtt_broker_status": "CONNECTED" if is_mqtt_connected else "ONLINE",
        "server_time": datetime.datetime.utcnow().isoformat()
    }

@router.get("/users")
def list_all_users(db: Session = Depends(get_db)):
    """List all registered users with linked devices count and account status."""
    users = db.query(models.User).all()
    user_list = []
    
    for u in users:
        # Find homes owned by user
        user_homes = db.query(models.Home).filter(models.Home.owner_id == u.id).all()
        home_ids = [h.id for h in user_homes]
        
        device_count = db.query(models.Device).filter(models.Device.home_id.in_(home_ids)).count() if home_ids else 0
        room_count = db.query(models.Room).filter(models.Room.home_id.in_(home_ids)).count() if home_ids else 0
        
        user_list.append({
            "id": str(u.id),
            "username": u.username,
            "email": u.email,
            "full_name": u.username,
            "is_active": True,
            "role": "user",
            "created_at": None,
            "device_count": device_count,
            "room_count": room_count
        })
        
    return user_list

@router.put("/users/{user_id}/status")
def update_user_status(user_id: str, status_in: UserStatusUpdate, db: Session = Depends(get_db)):
    """Enable or block user account access."""
    try:
        u_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid User UUID format")
        
    user = db.query(models.User).filter(models.User.id == u_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User status updated successfully", "is_active": status_in.is_active}

@router.delete("/users/{user_id}")
def delete_user_account(user_id: str, db: Session = Depends(get_db)):
    """Delete a user account and purge all their linked homes and devices."""
    try:
        u_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid User UUID format")
        
    user = db.query(models.User).filter(models.User.id == u_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(user)
    db.commit()
    return {"message": f"User {user.username} and all linked resources deleted successfully"}

@router.get("/devices")
def list_all_devices(db: Session = Depends(get_db)):
    """List all registered ESP32 hardware boards and real-time state."""
    devices = db.query(models.Device).all()
    device_list = []
    
    for d in devices:
        home = db.query(models.Home).filter(models.Home.id == d.home_id).first() if d.home_id else None
        owner = db.query(models.User).filter(models.User.id == home.owner_id).first() if home else None
        
        device_list.append({
            "id": str(d.id),
            "node_id": d.node_id,
            "mac_address": d.mac_address or "N/A",
            "name": d.name,
            "device_type": d.device_type,
            "is_online": d.is_online,
            "owner_username": owner.username if owner else "Unassigned",
            "current_state": d.current_state or {},
            "last_seen": d.last_seen.isoformat() if d.last_seen else None
        })
        
    return device_list

@router.post("/ota/trigger")
def trigger_remote_ota(ota: OtaUpdateRequest, db: Session = Depends(get_db)):
    """Publish remote OTA update command to ESP32 boards via MQTT."""
    topic = f"smartnest/devices/{ota.device_id}/ota" if ota.device_id else "smartnest/devices/all/ota"
    payload = {
        "action": "OTA_UPDATE",
        "firmware_url": ota.firmware_url,
        "version": ota.firmware_version,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
    
    try:
        mqtt.publish_message(topic, payload)
        return {"status": "SUCCESS", "message": f"OTA update command published to {topic}"}
    except Exception as e:
        logger.error(f"Failed to publish OTA MQTT message: {str(e)}")
        raise HTTPException(status_code=500, detail=f"MQTT Publish Error: {str(e)}")

@router.post("/mqtt/publish")
def publish_custom_mqtt(req: MqttPublishRequest):
    """Publish custom MQTT JSON payload for testing & debugging."""
    try:
        mqtt.publish_message(req.topic, req.payload)
        return {"status": "SUCCESS", "topic": req.topic}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MQTT Publish Failed: {str(e)}")
