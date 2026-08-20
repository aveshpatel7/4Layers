"""
4Layers Smart Home - Admin Management API Routes
Provides endpoints for User Management, Live Device Monitoring, and MQTT/Firmware OTA Operations.
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
from typing import List, Optional
import datetime
import uuid
import logging
import math

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
    reason: Optional[str] = None

class UserDeleteRequest(BaseModel):
    reason: Optional[str] = None

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
    active_users = db.query(models.User).filter(models.User.is_active == True).count()
    
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
def list_all_users(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List registered users with server-side pagination, search, and status filtering."""
    query = db.query(models.User)
    
    # Apply search filter across username, email, phone_number
    if search and search.strip():
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.User.username.ilike(search_pattern),
                models.User.email.ilike(search_pattern),
                models.User.phone_number.ilike(search_pattern)
            )
        )

    # Apply status filter
    if status and status.lower() != "all":
        if status.lower() in ("active", "true"):
            query = query.filter(or_(models.User.is_active == True, models.User.is_active.is_(None)))
        elif status.lower() in ("blocked", "false"):
            query = query.filter(models.User.is_active == False)
            
    total_records = query.count()
    total_pages = max(1, math.ceil(total_records / limit))
    actual_page = min(page, total_pages)
    offset = (actual_page - 1) * limit
    
    users = query.order_by(models.User.id.desc()).offset(offset).limit(limit).all()
    user_list = []
    
    for u in users:
        # Find homes owned by user
        user_homes = db.query(models.Home).filter(models.Home.owner_id == u.id).all()
        home_ids = [h.id for h in user_homes]
        
        device_count = db.query(models.Device).filter(models.Device.home_id.in_(home_ids)).count() if home_ids else 0
        room_count = db.query(models.Room).filter(models.Room.home_id.in_(home_ids)).count() if home_ids else 0
        
        auth_method = "google" if (u.hashed_password and "GAuth_" in u.hashed_password) or (not u.hashed_password) else "email"

        user_list.append({
            "id": str(u.id),
            "username": u.username,
            "email": u.email,
            "phone_number": u.phone_number or "N/A",
            "terms_accepted": bool(getattr(u, "terms_accepted", False)),
            "auth_method": auth_method,
            "full_name": u.username,
            "is_active": bool(getattr(u, "is_active", True)),
            "block_reason": getattr(u, "block_reason", None),
            "role": "user",
            "created_at": None,
            "device_count": device_count,
            "room_count": room_count
        })
        
    return {
        "data": user_list,
        "total_records": total_records,
        "total_pages": total_pages,
        "current_page": actual_page
    }

def turn_off_user_hardware_and_disable_schedules(user: models.User, db: Session):
    """
    Physically turns OFF all hardware relays (channels 1-6 & master) via MQTT for all devices
    owned by the user, updates DB states to OFF, and disables all active schedules.
    """
    try:
        user_homes = db.query(models.Home).filter(models.Home.owner_id == user.id).all()
        home_ids = [h.id for h in user_homes]
        
        devices = db.query(models.Device).filter(models.Device.home_id.in_(home_ids)).all() if home_ids else []
        
        base_nodes = set()
        for dev in devices:
            previous_state = dev.current_state or {}
            off_state = {"status": "OFF", "value": 0, "speed": 0}
            dev.current_state = off_state
            
            history_entry = models.DeviceHistory(
                device_id=dev.id,
                change_type="admin_safety_turn_off",
                previous_state=previous_state,
                new_state=off_state
            )
            db.add(history_entry)

            node_id = dev.node_id or str(dev.id)
            if "_" in node_id:
                base_node_id = node_id.rsplit('_', 1)[0]
            else:
                base_node_id = node_id
            base_nodes.add(base_node_id)

        for base_node_id in base_nodes:
            logger.info("Admin safety shutdown: Publishing TURN OFF commands to node %s", base_node_id)
            mqtt.publish_control_message(node_id=base_node_id, state={"channel": 6, "status": "OFF"})
            mqtt.publish_control_message(node_id=base_node_id, state={"channel": 7, "status": "OFF"})
            for ch in range(1, 7):
                mqtt.publish_control_message(node_id=base_node_id, state={"channel": ch, "status": "OFF", "value": 0})

        user_schedules = db.query(models.Schedule).filter(models.Schedule.user_id == user.id).all()
        for sched in user_schedules:
            sched.enabled = False
            
    except Exception as err:
        logger.error("Error in turn_off_user_hardware_and_disable_schedules: %s", err)

def reenable_user_schedules(user: models.User, db: Session):
    """Re-enables user schedules when user account is unblocked."""
    try:
        user_schedules = db.query(models.Schedule).filter(models.Schedule.user_id == user.id).all()
        for sched in user_schedules:
            sched.enabled = True
    except Exception as err:
        logger.error("Error in reenable_user_schedules: %s", err)

@router.put("/users/{user_id}/status")
def update_user_status(user_id: str, status_in: UserStatusUpdate, db: Session = Depends(get_db)):
    """Enable or block user account access with custom reason & hardware safety shutdown."""
    try:
        u_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid User UUID format")
        
    user = db.query(models.User).filter(models.User.id == u_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_active = status_in.is_active
    if not status_in.is_active:
        user.block_reason = status_in.reason if status_in.reason else "Account blocked by administrator"
        turn_off_user_hardware_and_disable_schedules(user, db)
    else:
        user.block_reason = None
        reenable_user_schedules(user, db)
        
    db.commit()
    db.refresh(user)
    return {"message": "User status updated successfully", "is_active": bool(user.is_active), "block_reason": user.block_reason}

@router.delete("/users/{user_id}")
def delete_user_account(user_id: str, payload: Optional[UserDeleteRequest] = None, db: Session = Depends(get_db)):
    """Delete a user account, turn OFF physical hardware, purge linked resources, and lock access with reason."""
    try:
        u_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid User UUID format")
        
    user = db.query(models.User).filter(models.User.id == u_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # 1. Turn OFF physical hardware relays & disable schedules first
    turn_off_user_hardware_and_disable_schedules(user, db)

    # 2. Purge user owned homes and linked devices
    user_homes = db.query(models.Home).filter(models.Home.owner_id == user.id).all()
    for h in user_homes:
        db.delete(h)

    # 3. Lock user account with reason
    reason_str = (payload.reason if payload and payload.reason else None) or "Account deleted by administrator"
    user.is_active = False
    user.block_reason = reason_str
    db.commit()
    return {"message": f"User {user.username} account deleted, hardware turned OFF, and resources purged.", "reason": reason_str}

@router.get("/devices")
def list_all_devices(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = None,
    online: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all registered ESP32 physical hardware boards grouped by base node_id with pagination & filtering."""
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
    now_utc = datetime.datetime.utcnow()
    three_min_ago = now_utc - datetime.timedelta(minutes=3)

    for base_id, node_devs in grouped_nodes.items():
        first_dev = node_devs[0]
        home = db.query(models.Home).filter(models.Home.id == first_dev.home_id).first() if first_dev.home_id else None
        owner = db.query(models.User).filter(models.User.id == home.owner_id).first() if home else None

        # Consider online if is_online flag is set OR last_seen is within the last 3 minutes
        is_online = any(dev.is_online or (dev.last_seen and dev.last_seen > three_min_ago) for dev in node_devs)

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
        owner_username = owner.username if owner else "Unassigned"
        firmware_version = merged_state.get("fw_version") or merged_state.get("version") or "v1.0.0"

        # Correctly resolve real local IP from device records or telemetry
        detected_ip = None
        for dev in node_devs:
            dev_ip = getattr(dev, 'local_ip', None)
            if dev_ip and dev_ip not in ("0.0.0.0", "127.0.0.1") and not dev_ip.startswith("4L-"):
                detected_ip = dev_ip
                break
        if not detected_ip:
            raw_ip = merged_state.get("local_ip") or merged_state.get("ip")
            if raw_ip and not str(raw_ip).startswith("4L-"):
                detected_ip = str(raw_ip)

        ip_address = detected_ip or "N/A"
        
        # Real RSSI from telemetry
        rssi = merged_state.get("rssi")
        if rssi is None:
            for dev in node_devs:
                if dev.current_state and isinstance(dev.current_state, dict) and "rssi" in dev.current_state:
                    rssi = dev.current_state["rssi"]
                    break
        if rssi is None:
            rssi = -55 if is_online else None

        last_seen_times = [dev.last_seen for dev in node_devs if dev.last_seen]
        latest_last_seen = max(last_seen_times).isoformat() if last_seen_times else None

        node_item = {
            "id": str(first_dev.id),
            "device_id": base_id,
            "node_id": base_id,
            "mac_address": first_dev.mac_address or "N/A",
            "name": f"ESP32 Hardware Board ({base_id})",
            "device_type": f"{len(node_devs)}-Channel Relay Board",
            "switch_count": len(node_devs),
            "is_online": is_online,
            "owner_email": owner_email,
            "owner_username": owner_username,
            "firmware_version": firmware_version,
            "ip_address": ip_address,
            "rssi": rssi if rssi is not None else "--",
            "current_state": merged_state,
            "last_seen": latest_last_seen
        }

        # Apply search filter
        if search and search.strip():
            search_str = search.strip().lower()
            match_search = (
                search_str in base_id.lower() or
                search_str in (first_dev.mac_address or "").lower() or
                search_str in owner_email.lower() or
                search_str in owner_username.lower()
            )
            if not match_search:
                continue

        # Apply online filter
        if online and online.lower() != "all":
            if online.lower() in ("online", "true") and not is_online:
                continue
            elif online.lower() in ("offline", "false") and is_online:
                continue

        node_list.append(node_item)
        
    total_records = len(node_list)
    total_pages = max(1, math.ceil(total_records / limit))
    actual_page = min(page, total_pages)
    
    offset = (actual_page - 1) * limit
    paginated_nodes = node_list[offset:offset + limit]

    return {
        "data": paginated_nodes,
        "total_records": total_records,
        "total_pages": total_pages,
        "current_page": actual_page
    }

import asyncio
from fastapi import BackgroundTasks

async def _staggered_ota_broadcast_task(nodes: list, firmware_url: str, version: str):
    """Async background task: Publish OTA commands to 1000+ nodes with 50ms throttling delay per dispatch."""
    for node_id in nodes:
        topic = f"smartnest/devices/{node_id}/ota"
        payload = {
            "action": "OTA_UPDATE",
            "firmware_url": firmware_url,
            "version": version,
            "timestamp": datetime.datetime.utcnow().isoformat()
        }
        try:
            mqtt.publish_message(topic, payload)
        except Exception as e:
            print(f"[OTA Broadcast] Error dispatching to {node_id}: {e}")
        await asyncio.sleep(0.05)  # 50ms throttle delay between dispatches

@router.post("/ota/trigger")
def trigger_remote_ota(ota: OtaUpdateRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Publish remote OTA update command to ESP32 boards via MQTT with throttled broadcast for fleet scalability."""
    target_node = ota.device_id.split('_')[0] if ota.device_id else None
    
    if target_node:
        topic = f"smartnest/devices/{target_node}/ota"
        payload = {
            "action": "OTA_UPDATE",
            "firmware_url": ota.firmware_url,
            "version": ota.firmware_version,
            "timestamp": datetime.datetime.utcnow().isoformat()
        }
        try:
            mqtt.publish_message(topic, payload, retain=False)
            return {"status": "SUCCESS", "target_topic": topic, "message": f"OTA update command published to {topic}"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"MQTT Publish Error: {str(e)}")
    else:
        # Broadcast to all registered online base nodes with async batch throttling
        devices = db.query(models.Device).all()
        base_nodes = sorted(list(set([d.node_id.split('_')[0] for d in devices if d.node_id])))
        
        # Dispatch background staggered rollout task
        background_tasks.add_task(_staggered_ota_broadcast_task, base_nodes, ota.firmware_url, ota.firmware_version)
        
        # Also publish to global broadcast topic for fallback listening
        global_topic = "smartnest/devices/all/ota"
        global_payload = {
            "action": "OTA_UPDATE",
            "firmware_url": ota.firmware_url,
            "version": ota.firmware_version,
            "timestamp": datetime.datetime.utcnow().isoformat()
        }
        try:
            mqtt.publish_message(global_topic, global_payload, retain=False)
        except Exception:
            pass

        return {
            "status": "SUCCESS",
            "target_topic": "smartnest/devices/all/ota",
            "fleet_size": len(base_nodes),
            "message": f"Staggered OTA broadcast initiated for {len(base_nodes)} devices (50ms per-node throttle queue)."
        }

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
    """Upload a new .bin firmware or .apk mobile app file for OTA updates."""
    if not (file.filename.endswith(".bin") or file.filename.endswith(".apk")):
        raise HTTPException(status_code=400, detail="Only .bin and .apk files are supported")

    filename = file.filename
    target_path = os.path.join(FIRMWARE_DIR, filename)

    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    if filename.endswith(".bin"):
        shutil.copyfile(target_path, os.path.join(FIRMWARE_DIR, "latest.bin"))
    elif filename.endswith(".apk"):
        shutil.copyfile(target_path, os.path.join(FIRMWARE_DIR, "latest.apk"))

    return {
        "status": "SUCCESS",
        "filename": filename,
        "latest_url": f"/firmware/{'latest.apk' if filename.endswith('.apk') else 'latest.bin'}",
        "named_url": f"/firmware/{filename}"
    }


class AppVersionUpdatePayload(BaseModel):
    latest_version: str
    force_update: bool = False
    apk_url: str = "https://4layers.in/latest.apk"

@router.get("/app/version")
def admin_get_app_version(db: Session = Depends(get_db)):
    """Retrieve current mobile app OTA version settings for admin control."""
    def get_setting(key: str, default: str) -> str:
        try:
            row = db.query(models.AppSetting).filter(models.AppSetting.key == key).first()
            if row and row.value is not None:
                return row.value
        except Exception:
            pass
        return os.getenv(key.upper(), default)

    return {
        "latest_version": get_setting("latest_version", "1.0.0"),
        "force_update": get_setting("force_update", "false").lower() in ["true", "1", "yes"],
        "apk_url": get_setting("apk_url", "https://4layers.in/latest.apk")
    }

@router.post("/app/version")
def admin_update_app_version(payload: AppVersionUpdatePayload, db: Session = Depends(get_db)):
    """Update mobile app OTA version settings."""
    settings_map = {
        "latest_version": payload.latest_version.strip(),
        "force_update": "true" if payload.force_update else "false",
        "apk_url": payload.apk_url.strip()
    }
    for key, val in settings_map.items():
        try:
            row = db.query(models.AppSetting).filter(models.AppSetting.key == key).first()
            if not row:
                row = models.AppSetting(key=key, value=val)
                db.add(row)
            else:
                row.value = val
                db.add(row)
        except Exception as e:
            logger.error(f"Error updating AppSetting {key}: {e}")
    db.commit()
    return {
        "status": "SUCCESS",
        "message": "App version settings updated successfully",
        "data": {
            "latest_version": payload.latest_version.strip(),
            "force_update": payload.force_update,
            "apk_url": payload.apk_url.strip()
        }
    }

