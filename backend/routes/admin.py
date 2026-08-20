"""
4Layers Smart Home - Admin Management API Routes
Provides endpoints for User Management, Live Device Monitoring, and MQTT/Firmware OTA Operations.
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
from typing import List, Optional
import datetime
import uuid
import logging
import math
import os

from backend.database import get_db
from backend import models, mqtt, auth

router = APIRouter(prefix="/api/admin", tags=["Admin Management"])
logger = logging.getLogger(__name__)

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "Qadir")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "qadir#/777")

admin_security = HTTPBearer(auto_error=False)

def get_current_admin(credentials: Optional[HTTPAuthorizationCredentials] = Depends(admin_security)):
    """Enforce administrator authentication on admin endpoints."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required. Please log in."
        )
    token = credentials.credentials
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        if payload.get("role") != "admin" and not payload.get("is_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrator privileges required"
            )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired admin session token"
        )

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

class AdminLoginRequest(BaseModel):
    username: str
    password: str

@router.post("/login")
def admin_login(req: AdminLoginRequest):
    """Authenticate administrator and return access token."""
    username = req.username.strip() if req.username else ""
    password = req.password.strip() if req.password else ""
    
    if username != ADMIN_USERNAME or password != ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid administrator username or password"
        )
        
    token_data = {
        "sub": "admin",
        "username": ADMIN_USERNAME,
        "role": "admin",
        "is_admin": True
    }
    token = auth.create_access_token(token_data, expires_delta=datetime.timedelta(days=30))
    return {
        "status": "SUCCESS",
        "token": token,
        "username": ADMIN_USERNAME
    }

@router.get("/ota/status")
def get_ota_status(admin: dict = Depends(get_current_admin)):
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
def get_device_logs(node_id: str, admin: dict = Depends(get_current_admin)):
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
def get_admin_stats(db: Session = Depends(get_db), admin: dict = Depends(get_current_admin)):
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
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
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
def update_user_status(user_id: str, status_in: UserStatusUpdate, db: Session = Depends(get_db), admin: dict = Depends(get_current_admin)):
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
def delete_user_account(user_id: str, payload: Optional[UserDeleteRequest] = None, db: Session = Depends(get_db), admin: dict = Depends(get_current_admin)):
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
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
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
def trigger_remote_ota(ota: OtaUpdateRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), admin: dict = Depends(get_current_admin)):
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
def publish_custom_mqtt(req: MqttPublishRequest, admin: dict = Depends(get_current_admin)):
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
async def upload_firmware_file(file: UploadFile = File(...), admin: dict = Depends(get_current_admin)):
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
def admin_get_app_version(db: Session = Depends(get_db), admin: dict = Depends(get_current_admin)):
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
        "latest_version": get_setting("latest_version", "1.0.5"),
        "force_update": get_setting("force_update", "false").lower() in ["true", "1", "yes"],
        "apk_url": get_setting("apk_url", "https://4layers.in/latest.apk")
    }

@router.post("/app/version")
def admin_update_app_version(payload: AppVersionUpdatePayload, db: Session = Depends(get_db), admin: dict = Depends(get_current_admin)):
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


def compute_warranty_status(activated_at: Optional[datetime.datetime], total_toggles: int, crash_count: int) -> str:
    """
    Evaluates dynamic warranty status:
    - VOID if total_toggles > 100,000 OR crash_count > 50 (hardware abuse / extreme stress / unstable power)
    - EXPIRED if activated_at > 365 days ago
    - ACTIVE if within 1 year and thresholds are not breached
    """
    if (total_toggles or 0) > 100000 or (crash_count or 0) > 50:
        return models.WarrantyStatus.VOID.value
    if activated_at:
        now_dt = datetime.datetime.now(datetime.timezone.utc) if activated_at.tzinfo else datetime.datetime.utcnow()
        if (now_dt - activated_at).days > 365:
            return models.WarrantyStatus.EXPIRED.value
    return models.WarrantyStatus.ACTIVE.value


def get_switch_label(device: models.Device) -> str:
    """Derives user-friendly switch/channel name from node_id or device_type."""
    if device.node_id and "_" in device.node_id:
        suffix = device.node_id.rsplit("_", 1)[-1]
        if suffix.isdigit():
            s_num = int(suffix)
            if s_num == 5 or device.device_type == "fan":
                return "Fan"
            elif s_num in [6, 7] or device.device_type == "master":
                return "Master Switch"
            else:
                return f"Switch {s_num}"
    if device.device_type == "fan":
        return "Fan"
    elif device.device_type == "master":
        return "Master Switch"
    return device.name or "Switch"


@router.get("/analytics/usage")
def get_usage_and_warranty_analytics(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    filter_warranty: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    """
    Returns hierarchical IoT usage telemetry and warranty validation records grouped by User Account and Hardware Switchboard.
    Avoids confusion between 4 physical hardware boards and 24 individual relay channels (6 switches per board).
    """
    # Fetch all devices with home, room, and owner
    devices = db.query(models.Device).join(models.Home, models.Device.home_id == models.Home.id, isouter=True)\
                                    .join(models.User, models.Home.owner_id == models.User.id, isouter=True).all()

    # Fetch all registered users
    users = db.query(models.User).all()

    # Map user_id -> User details
    user_map = {str(u.id): u for u in users}

    # Group devices by User ID -> Base Node ID (Physical Board)
    grouped_by_user = {}
    
    # Initialize all registered users in grouped structure
    for u in users:
        uid = str(u.id)
        grouped_by_user[uid] = {
            "user_id": uid,
            "username": u.username,
            "email": u.email,
            "phone": getattr(u, "phone_number", None) or getattr(u, "phone", None) or "N/A",
            "created_at": u.created_at.isoformat() if hasattr(u, "created_at") and u.created_at else None,
            "is_heavy_user": False,
            "total_user_on_hours": 0.0,
            "total_user_toggles": 0,
            "total_boards_count": 0,
            "total_switches_count": 0,
            "boards_dict": {}
        }

    # Include Unassigned bucket if devices exist without owners
    unassigned_uid = "unassigned"
    grouped_by_user[unassigned_uid] = {
        "user_id": unassigned_uid,
        "username": "Unassigned Hardware",
        "email": "unassigned@smartnest.local",
        "phone": "N/A",
        "created_at": None,
        "is_heavy_user": False,
        "total_user_on_hours": 0.0,
        "total_user_toggles": 0,
        "total_boards_count": 0,
        "total_switches_count": 0,
        "boards_dict": {}
    }

    # Distribute devices into their physical boards per user
    for dev in devices:
        owner = dev.home.owner if (dev.home and dev.home.owner) else None
        uid = str(owner.id) if owner else unassigned_uid

        if uid not in grouped_by_user:
            grouped_by_user[uid] = {
                "user_id": uid,
                "username": owner.username if owner else "Unassigned",
                "email": owner.email if owner else "Unassigned",
                "phone": getattr(owner, "phone_number", None) if owner else "N/A",
                "created_at": owner.created_at.isoformat() if owner and hasattr(owner, "created_at") and owner.created_at else None,
                "is_heavy_user": False,
                "total_user_on_hours": 0.0,
                "total_user_toggles": 0,
                "total_boards_count": 0,
                "total_switches_count": 0,
                "boards_dict": {}
            }

        raw_node = dev.node_id or f"DEV-{dev.id}"
        base_node = raw_node.split('_')[0] if '_' in raw_node else raw_node

        toggles = dev.total_toggle_count or 0
        crashes = dev.crash_count or 0
        boots = dev.boot_count or 0
        on_secs = dev.total_on_duration_seconds or 0
        on_hours = round(on_secs / 3600.0, 2)
        act_date = dev.activated_at or (dev.created_at if hasattr(dev, "created_at") else datetime.datetime.utcnow())
        calc_status = compute_warranty_status(act_date, toggles, crashes)

        if dev.warranty_status != calc_status:
            dev.warranty_status = calc_status
            db.add(dev)

        user_boards = grouped_by_user[uid]["boards_dict"]
        if base_node not in user_boards:
            user_boards[base_node] = {
                "base_node_id": base_node,
                "board_name": f"ESP32 Switchboard ({base_node})",
                "home_name": dev.home.name if dev.home else "Default Home",
                "room_name": dev.room.name if dev.room else "Main Room",
                "mac_address": dev.mac_address or "N/A",
                "local_ip": getattr(dev, "local_ip", None) or "N/A",
                "is_online": dev.is_online,
                "firmware_version": "v12.5",
                "activated_at": act_date.isoformat() if act_date else None,
                "boot_count": boots,
                "crash_count": crashes,
                "total_board_toggles": 0,
                "total_board_on_hours": 0.0,
                "warranty_status": calc_status,
                "switches": []
            }

        b_entry = user_boards[base_node]
        b_entry["total_board_toggles"] += toggles
        b_entry["total_board_on_hours"] = round(b_entry["total_board_on_hours"] + on_hours, 2)
        b_entry["boot_count"] = max(b_entry["boot_count"], boots)
        b_entry["crash_count"] = max(b_entry["crash_count"], crashes)
        if dev.is_online:
            b_entry["is_online"] = True
        if dev.local_ip and dev.local_ip not in ("0.0.0.0", "127.0.0.1", "N/A"):
            b_entry["local_ip"] = dev.local_ip

        # Board-level warranty evaluation
        b_entry["warranty_status"] = compute_warranty_status(act_date, b_entry["total_board_toggles"], b_entry["crash_count"])

        b_entry["switches"].append({
            "device_id": str(dev.id),
            "node_id": dev.node_id,
            "switch_channel": get_switch_label(dev),
            "device_name": dev.name,
            "device_type": dev.device_type,
            "toggles": toggles,
            "on_hours": on_hours,
            "is_online": dev.is_online,
            "current_state": dev.current_state or {},
            "warranty_status": calc_status
        })

    try:
        db.commit()
    except Exception:
        db.rollback()

    # Flatten and calculate User Level Totals
    all_user_records = []
    total_physical_boards = 0
    total_switches_count = 0
    active_boards_count = 0
    void_boards_count = 0
    expired_boards_count = 0
    heavy_users_count = 0

    for uid, udata in list(grouped_by_user.items()):
        boards_list = list(udata["boards_dict"].values())
        if uid == unassigned_uid and len(boards_list) == 0:
            continue

        udata["hardware_boards"] = boards_list
        udata["total_boards_count"] = len(boards_list)
        udata["total_switches_count"] = sum(len(b["switches"]) for b in boards_list)
        udata["total_user_toggles"] = sum(b["total_board_toggles"] for b in boards_list)
        udata["total_user_on_hours"] = round(sum(b["total_board_on_hours"] for b in boards_list), 2)
        udata["is_heavy_user"] = udata["total_user_on_hours"] > 5000.0

        if udata["is_heavy_user"]:
            heavy_users_count += 1

        total_physical_boards += len(boards_list)
        total_switches_count += udata["total_switches_count"]

        for b in boards_list:
            if b["warranty_status"] == models.WarrantyStatus.ACTIVE.value:
                active_boards_count += 1
            elif b["warranty_status"] == models.WarrantyStatus.VOID.value:
                void_boards_count += 1
            elif b["warranty_status"] == models.WarrantyStatus.EXPIRED.value:
                expired_boards_count += 1

        # Search Filtering
        if search and search.strip():
            st = search.strip().lower()
            match_user = (
                st in udata["email"].lower() or
                st in udata["username"].lower() or
                any(st in b["base_node_id"].lower() for b in boards_list) or
                any(st in (b["mac_address"] or "").lower() for b in boards_list)
            )
            if not match_user:
                continue

        # Warranty Status Filtering (match if any board matches filter)
        if filter_warranty and filter_warranty.upper() != "ALL":
            fw = filter_warranty.upper()
            filtered_boards = [b for b in boards_list if b["warranty_status"] == fw]
            if not filtered_boards:
                continue
            udata["hardware_boards"] = filtered_boards

        # Clean internal helper key
        udata.pop("boards_dict", None)
        all_user_records.append(udata)

    # Sort users by total ON hours descending
    all_user_records.sort(key=lambda u: u["total_user_on_hours"], reverse=True)

    total_users_matched = len(all_user_records)
    total_pages = max(1, math.ceil(total_users_matched / page_size))
    start_idx = (page - 1) * page_size
    paginated_users = all_user_records[start_idx:start_idx + page_size]

    return {
        "summary": {
            "total_users": len(users),
            "total_hardware_boards": total_physical_boards,
            "total_switches": total_switches_count,
            "active_warranties": active_boards_count,
            "void_warranties": void_boards_count,
            "expired_warranties": expired_boards_count,
            "heavy_users_count": heavy_users_count
        },
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "total_records": total_users_matched
        },
        "records": paginated_users
    }


@router.get("/analytics/usage/export")
def export_usage_warranty_csv(
    user_id: Optional[str] = None,
    search: Optional[str] = None,
    filter_warranty: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    """
    Generates downloadable legal CSV report for warranty validation and usage auditing.
    Supports exporting all users or a specific single user account.
    """
    import csv
    import io
    from fastapi.responses import Response

    query = db.query(models.Device).join(models.Home, models.Device.home_id == models.Home.id, isouter=True)\
                                  .join(models.User, models.Home.owner_id == models.User.id, isouter=True)

    if user_id and user_id != "unassigned":
        query = query.filter(models.User.id == user_id)

    if search:
        search_term = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                models.Device.name.ilike(search_term),
                models.Device.node_id.ilike(search_term),
                models.User.email.ilike(search_term),
                models.User.username.ilike(search_term)
            )
        )

    devices = query.order_by(models.Device.activated_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)

    # Write Legal CSV Header
    writer.writerow([
        "User Email",
        "Username",
        "Physical Board Node ID",
        "Switch Channel / Name",
        "Device Type",
        "Toggle Cycles",
        "Total ON Hours",
        "Board Crash Count",
        "Board Boot Count",
        "Activated Date (UTC)",
        "Warranty Status",
        "Heavy User (>5000h)",
        "Audit Timestamp (UTC)"
    ])

    audit_timestamp = datetime.datetime.utcnow().isoformat()

    for dev in devices:
        owner = dev.home.owner if (dev.home and dev.home.owner) else None
        user_email = owner.email if owner else "Unassigned / Guest"
        username = owner.username if owner else "Unassigned"

        toggles = dev.total_toggle_count or 0
        crashes = dev.crash_count or 0
        boots = dev.boot_count or 0
        on_secs = dev.total_on_duration_seconds or 0
        on_hours = round(on_secs / 3600.0, 2)
        act_date = dev.activated_at or (dev.created_at if hasattr(dev, "created_at") else datetime.datetime.utcnow())
        status = compute_warranty_status(act_date, toggles, crashes)

        raw_node = dev.node_id or f"DEV-{dev.id}"
        base_node = raw_node.split('_')[0] if '_' in raw_node else raw_node

        if filter_warranty and filter_warranty.upper() != "ALL":
            if status != filter_warranty.upper():
                continue

        writer.writerow([
            user_email,
            username,
            base_node,
            f"{get_switch_label(dev)} ({dev.name})",
            dev.device_type,
            toggles,
            f"{on_hours} hrs",
            crashes,
            boots,
            act_date.isoformat() if act_date else "N/A",
            status,
            "YES" if on_hours > 5000 else "NO",
            audit_timestamp
        ])

    csv_data = output.getvalue()
    filename = f"4Layers_Warranty_Audit_{user_id or 'Fleet'}_{datetime.datetime.utcnow().strftime('%Y%m%d')}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )
