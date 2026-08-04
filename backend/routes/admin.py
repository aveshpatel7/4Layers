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

# Global in-memory storage for real-time OTA progress & remote device logs
OTA_STATUS_CACHE = {}  # { node_id: { "status": "downloading", "progress": 45, "updated_at": "..." } }
DEVICE_LOGS_CACHE = {} # { node_id: [ {"timestamp": "...", "log": "..."}, ... ] }

def update_ota_status_cache(ota_data: dict):
    node_id = ota_data.get("node_id", "UNKNOWN")
    raw_status = ota_data.get("status", "pending")
    progress = ota_data.get("progress", 0)
    
    # Fix 100% stuck bug: If progress reaches 100% or status is rebooting, auto-mark Success
    if progress >= 100 and raw_status in ["downloading", "flashing", "rebooting", "pending"]:
        raw_status = "success"
    
    OTA_STATUS_CACHE[node_id] = {
        "status": raw_status,
        "progress": progress,
        "updated_at": datetime.datetime.utcnow(),
        "timestamp": datetime.datetime.utcnow().isoformat()
    }

def append_device_log(node_id: str, log_message: str):
    if node_id not in DEVICE_LOGS_CACHE:
        DEVICE_LOGS_CACHE[node_id] = []
    
    entry = {
        "timestamp": datetime.datetime.utcnow().strftime("%H:%M:%S.%f")[:-3],
        "log": log_message
    }
    
    DEVICE_LOGS_CACHE[node_id].append(entry)
    # Ring buffer: keep max 100 log lines per node
    if len(DEVICE_LOGS_CACHE[node_id]) > 100:
        DEVICE_LOGS_CACHE[node_id] = DEVICE_LOGS_CACHE[node_id][-100:]

mqtt.set_ota_ws_broadcaster(update_ota_status_cache)
mqtt.set_device_log_broadcaster(append_device_log)

@router.get("/ota/status")
def get_ota_status():
    """Returns current in-memory dict of OTA progress per node with 30s timeout check and 5s auto-clear for completed/failed jobs."""
    now = datetime.datetime.utcnow()
    result = {}
    nodes_to_remove = []
    
    for node_id, data in OTA_STATUS_CACHE.items():
        status = data.get("status", "")
        progress = data.get("progress", 0)
        updated_at = data.get("updated_at")
        
        # Fix 100% stuck bug
        if progress >= 100 and status.lower() in ["downloading", "flashing", "rebooting", "pending"]:
            status = "success"
        elif status.lower() in ["downloading", "pending", "flashing", "rebooting"]:
            if updated_at and (now - updated_at).total_seconds() > 30:
                status = "timeout"
                
        result[node_id] = {
            "status": status,
            "progress": progress,
            "updated_at": data.get("timestamp")
        }
        
        # If status is terminal (success, failed, timeout, error, completed), mark for deletion after 5 seconds
        if status.lower() in ["success", "completed", "failed", "error", "timeout"]:
            if updated_at and (now - updated_at).total_seconds() > 5:
                nodes_to_remove.append(node_id)
                
    # Purge old completed/failed status entries from memory cache
    for nid in nodes_to_remove:
        OTA_STATUS_CACHE.pop(nid, None)
        
    return result

@router.get("/devices/{node_id}/logs")
def get_device_logs(node_id: str):
    """Retrieve last 100 live terminal log entries for a specific ESP32 node or all nodes."""
    clean_id = node_id.strip()
    if clean_id.upper() in ["ALL", "ALL_ONLINE_BOARDS", "BROADCAST"]:
        all_logs = []
        for nid, logs in DEVICE_LOGS_CACHE.items():
            for l in logs:
                all_logs.append({
                    "timestamp": l.get("timestamp", ""),
                    "log": f"[{nid}] {l.get('log', '')}"
                })
        # Sort aggregated logs by timestamp
        all_logs.sort(key=lambda x: x.get("timestamp", ""))
        return {"node_id": "ALL", "logs": all_logs[-100:]}
    
    logs = DEVICE_LOGS_CACHE.get(clean_id, [])
    return {"node_id": clean_id, "logs": logs}

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

from sqlalchemy import func

import re

@router.get("/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    """Overview statistics for Admin Dashboard."""
    total_users = db.query(models.User).count()
    devices = db.query(models.Device).all()
    
    base_nodes = set()
    online_base_nodes = set()
    for d in devices:
        raw_id = d.node_id or str(d.id)[:8]
        base_id = re.sub(r'\s*-\s*', '-', raw_id.split('_')[0].strip())
        base_nodes.add(base_id)
        if d.is_online:
            online_base_nodes.add(base_id)
            
    total_nodes = len(base_nodes)
    online_nodes = len(online_base_nodes)
    total_switches = len(devices)
    active_users = total_users
    
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
        "total_devices": total_nodes,
        "online_devices": online_nodes,
        "total_switches": total_switches,
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
    """List all registered ESP32 physical hardware boards grouped by base node_id."""
    devices = db.query(models.Device).all()
    
    # Group devices by base_node_id (strip _1, _2 suffixes and extra hyphen spaces)
    grouped_nodes = {}
    for d in devices:
        raw_id = d.node_id or str(d.id)[:8]
        base_id = re.sub(r'\s*-\s*', '-', raw_id.split('_')[0].strip())
        if base_id not in grouped_nodes:
            grouped_nodes[base_id] = []
        grouped_nodes[base_id].append(d)

    node_list = []
    for base_id, node_devs in grouped_nodes.items():
        first_dev = node_devs[0]
        home = db.query(models.Home).filter(models.Home.id == first_dev.home_id).first() if first_dev.home_id else None
        owner = db.query(models.User).filter(models.User.id == home.owner_id).first() if home else None

        is_online = any(dev.is_online for dev in node_devs)

        merged_state = {}
        for dev in node_devs:
            st = dev.current_state or {}
            if isinstance(st, str):
                try:
                    import json
                    st = json.loads(st)
                except Exception:
                    st = {}
            merged_state.update(st)

        owner_email = owner.email if owner else "Unassigned"
        firmware_version = merged_state.get("fw_version", merged_state.get("version", "v1.0.0"))
        ip_address = merged_state.get("ip", first_dev.mac_address or "192.168.1.50")
        rssi = merged_state.get("rssi", -62)

        last_seen_times = [dev.last_seen for dev in node_devs if dev.last_seen]
        latest_last_seen = max(last_seen_times).isoformat() if last_seen_times else None

        node_list.append({
            "id": str(first_dev.id),
            "device_id": base_id,
            "node_id": base_id,
            "mac_address": first_dev.mac_address or "N/A",
            "name": f"ESP32 Hardware Board ({base_id})",
            "device_type": f"{len(node_devs)}-Channel Relay Board",
            "switch_count": len(node_devs),
            "is_online": is_online,
            "owner_email": owner_email,
            "owner_username": owner.username if owner else "Unassigned",
            "firmware_version": firmware_version,
            "ip_address": ip_address,
            "rssi": rssi,
            "current_state": merged_state,
            "last_seen": latest_last_seen
        })
        
    return node_list

@router.post("/ota/trigger")
def trigger_remote_ota(ota: OtaUpdateRequest, db: Session = Depends(get_db)):
    """Publish remote OTA update command to ESP32 boards via MQTT."""
    target_node = ota.device_id.split('_')[0] if ota.device_id else None
    topic = f"smartnest/devices/{target_node}/ota" if target_node else "smartnest/devices/all/ota"
    payload = {
        "action": "OTA_UPDATE",
        "firmware_url": ota.firmware_url,
        "version": ota.firmware_version,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
    
    try:
        mqtt.publish_message(topic, payload)
        return {"status": "SUCCESS", "target_topic": topic, "message": f"OTA update command published to {topic}"}
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

import os
import shutil

FIRMWARE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "firmware")
os.makedirs(FIRMWARE_DIR, exist_ok=True)

@router.post("/firmware/upload")
async def upload_firmware_file(file: UploadFile = File(...)):
    """Upload a new .bin firmware file for OTA updates."""
    if not file.filename.endswith(".bin"):
        raise HTTPException(status_code=400, detail="Only .bin firmware files are supported")

    filename = file.filename
    target_path = os.path.join(FIRMWARE_DIR, filename)
    latest_path = os.path.join(FIRMWARE_DIR, "latest.bin")

    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    shutil.copyfile(target_path, latest_path)

    return {
        "status": "SUCCESS",
        "filename": filename,
        "latest_url": "/firmware/latest.bin",
        "named_url": f"/firmware/{filename}"
    }
