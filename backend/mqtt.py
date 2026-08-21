import os
import json
import logging
import random
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
import paho.mqtt.client as mqtt
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MQTT")

# MQTT Configuration
MQTT_BROKER = os.getenv("MQTT_BROKER", "i26a1c71.ala.asia-southeast1.emqxsl.com")
MQTT_PORT = int(os.getenv("MQTT_PORT", "8883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "smartnest_client")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "D2m9ga8JynJDEM6")
MQTT_KEEPALIVE = int(os.getenv("MQTT_KEEPALIVE", "60"))
MQTT_CLIENT_ID = os.getenv("MQTT_CLIENT_ID", f"smartnest_backend_{random.randint(10000, 99999)}")

# Thread pool for non-blocking MQTT publishing
publish_executor = ThreadPoolExecutor(max_workers=10, thread_name_prefix="mqtt_publisher")

# Initialize global MQTT client
client = mqtt.Client(client_id=MQTT_CLIENT_ID)

if MQTT_USERNAME and MQTT_PASSWORD:
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

if MQTT_PORT == 8883:
    # Enable secure TLS connection for EMQX Cloud Serverless
    client.tls_set()

def on_connect(client, userdata, flags, rc):
    """Callback when client connects to broker."""
    if rc == 0:
        logger.info("Connected successfully to MQTT Broker: %s:%d", MQTT_BROKER, MQTT_PORT)
        # Subscribe to status and telemetry confirmation updates for all device nodes
        # Topic pattern: home/device/{node_id}/status and home/device/{node_id}/telemetry
        subscribe_status = "home/device/+/status"
        subscribe_telemetry = "home/device/+/telemetry"
        ota_topic = "smartnest/devices/+/ota/status"
        logs_topic = "smartnest/devices/+/logs"
        client.subscribe([(subscribe_status, 1), (subscribe_telemetry, 1), (ota_topic, 1), (logs_topic, 1)])
        logger.info("Subscribed to MQTT topics: %s, %s, %s, and %s", subscribe_status, subscribe_telemetry, ota_topic, logs_topic)
    else:
        logger.error("Failed to connect to MQTT Broker, return code %d", rc)

def on_disconnect(client, userdata, rc):
    """Callback when client disconnects from broker."""
    logger.warning("Disconnected from MQTT Broker. Return code: %s", rc)

# Callbacks for OTA status and device remote logs
ota_ws_broadcaster = None
device_log_broadcaster = None

def set_ota_ws_broadcaster(callback):
    global ota_ws_broadcaster
    ota_ws_broadcaster = callback

def set_device_log_broadcaster(callback):
    global device_log_broadcaster
    device_log_broadcaster = callback

def on_message(client, userdata, msg):
    """Callback when a message is received from the broker."""
    logger.info("Received MQTT message on topic: %s, payload: %s", msg.topic, msg.payload)
    try:
        payload_str = msg.payload.decode("utf-8").strip()
        
        # Handle Remote Device Logs Topic: smartnest/devices/{node_id}/logs
        log_parts = msg.topic.split('/')
        if len(log_parts) == 4 and log_parts[0] == "smartnest" and log_parts[1] == "devices" and log_parts[3] == "logs":
            node_id = log_parts[2]
            if device_log_broadcaster:
                device_log_broadcaster(node_id, payload_str)
            return

        # Handle OTA Status Topic: smartnest/devices/{node_id}/ota/status
        ota_parts = msg.topic.split('/')
        if len(ota_parts) == 5 and ota_parts[0] == "smartnest" and ota_parts[1] == "devices" and ota_parts[3] == "ota" and ota_parts[4] == "status":
            node_id = ota_parts[2]
            try:
                ota_data = json.loads(payload_str)
            except json.JSONDecodeError:
                ota_data = {"status": payload_str, "progress": 0}
            
            ota_data["node_id"] = node_id
            logger.info("OTA status received for node %s: %s", node_id, ota_data)
            
            if ota_ws_broadcaster:
                ota_ws_broadcaster(ota_data)
            return

        # Parse topic: home/device/{node_id}/status OR home/device/{node_id}/telemetry
        parts = msg.topic.split('/')
        if len(parts) == 4 and parts[0] == "home" and parts[1] == "device" and (parts[3] == "status" or parts[3] == "telemetry"):
            raw_node_id = parts[2]
            is_telemetry = (parts[3] == "telemetry")
            
            # 1. Strict JSON payload validation
            try:
                state_data = json.loads(payload_str)
            except json.JSONDecodeError as err:
                logger.error("Invalid JSON payload dropped on node %s: %s (Error: %s)", raw_node_id, payload_str, err)
                return
            
            if not isinstance(state_data, dict):
                logger.error("Dropped payload on node %s; must be a JSON object: %s", raw_node_id, payload_str)
                return

            # Extract base node ID (e.g., '4L_123456' from '4L_123456_1' or '4L_123456')
            parts_node = raw_node_id.rsplit('_', 1)
            if len(parts_node) == 2 and parts_node[1].isdigit():
                base_node_id = parts_node[0]
            else:
                base_node_id = raw_node_id

            # Extract local_ip if present in payload
            incoming_local_ip = state_data.get("local_ip") or state_data.get("ip")

            # Update database in callback thread
            db: Session = SessionLocal()
            try:
                # If local_ip is provided in telemetry/status, update all sibling channel devices
                if incoming_local_ip:
                    sibling_devices = db.query(models.Device).filter(
                        (models.Device.node_id == base_node_id) | 
                        (models.Device.node_id.like(f"{base_node_id}_%"))
                    ).all()
                    for sib in sibling_devices:
                        sib.local_ip = incoming_local_ip
                        cur = sib.current_state or {}
                        sib.current_state = {**cur, "local_ip": incoming_local_ip}
                        sib.last_seen = datetime.utcnow()
                        sib.is_online = True
                        db.add(sib)
                    db.commit()
                    logger.info("Updated local_ip=%s for %d channels on node %s", incoming_local_ip, len(sibling_devices), base_node_id)
                    if is_telemetry and "status" not in state_data:
                        return

                # Handle periodic HEARTBEAT to keep entire switchboard online
                if state_data.get("status") == "HEARTBEAT" or state_data.get("heartbeat") is True:
                    sibling_devices = db.query(models.Device).filter(
                        (models.Device.node_id == base_node_id) | 
                        (models.Device.node_id.like(f"{base_node_id}_%"))
                    ).all()
                    for sib in sibling_devices:
                        sib.last_seen = datetime.utcnow()
                        sib.is_online = True
                        if incoming_local_ip:
                            sib.local_ip = incoming_local_ip
                        db.add(sib)
                    db.commit()
                    logger.debug("Heartbeat refreshed %d channels for node %s", len(sibling_devices), base_node_id)
                    return

                # 2. LWT Handling: check if abrupt disconnect or offline LWT arrived
                if state_data.get("status") == "OFFLINE":
                    all_chan_devices = db.query(models.Device).filter(
                        (models.Device.node_id == base_node_id) | 
                        (models.Device.node_id.like(f"{base_node_id}_%"))
                    ).all()

                    if all_chan_devices:
                        for device in all_chan_devices:
                            was_online = device.is_online
                            device.is_online = False
                            device.updated_at = datetime.utcnow()
                            db.add(device)

                            if was_online:
                                # Log history
                                history_entry = models.DeviceHistory(
                                    device_id=device.id,
                                    change_type="status_confirmed",
                                    previous_state=device.current_state or {},
                                    new_state={"status": "OFFLINE"}
                                )
                                db.add(history_entry)

                                # Create alert if home owner exists
                                if device.home and device.home.owner_id:
                                    alert_entry = models.Alert(
                                        user_id=device.home.owner_id,
                                        device_id=device.id,
                                        type="device_offline",
                                        message=f"Device '{device.name}' is now OFFLINE.",
                                        is_read=False
                                    )
                                    db.add(alert_entry)

                        db.commit()
                        logger.info("LWT Offline handled: Marked %d channel devices OFFLINE for node %s.", len(all_chan_devices), base_node_id)
                    return

                # Keep ALL sibling channels on this base node online whenever any packet arrives
                sibling_devices = db.query(models.Device).filter(
                    (models.Device.node_id == base_node_id) | 
                    (models.Device.node_id.like(f"{base_node_id}_%"))
                ).all()
                for sib in sibling_devices:
                    sib.last_seen = datetime.utcnow()
                    sib.is_online = True
                    if incoming_local_ip:
                        sib.local_ip = incoming_local_ip
                    db.add(sib)

                # Target node determination for channel-specific updates
                target_node_id = raw_node_id
                if "channel" in state_data:
                    target_node_id = f"{base_node_id}_{state_data['channel']}"

                device = db.query(models.Device).filter(models.Device.node_id == target_node_id).first()
                
                if device:
                    device.last_seen = datetime.utcnow()
                    previous_state = device.current_state or {}
                    was_offline = not device.is_online
                    
                    # Handle telemetry counters (toggles, runtime hours, crashes, boots)
                    if "toggles" in state_data or "toggle_count" in state_data:
                        device.total_toggle_count = int(state_data.get("toggles") or state_data.get("toggle_count") or device.total_toggle_count or 0)
                    if "on_hours" in state_data:
                        device.total_on_duration_seconds = int(float(state_data["on_hours"]) * 3600)
                    elif "on_duration_seconds" in state_data:
                        device.total_on_duration_seconds = int(state_data["on_duration_seconds"])
                    if "crash_count" in state_data:
                        device.crash_count = int(state_data["crash_count"])
                    if "boot_count" in state_data:
                        device.boot_count = int(state_data["boot_count"])

                    # Re-evaluate dynamic warranty status
                    toggles_val = device.total_toggle_count or 0
                    crashes_val = device.crash_count or 0
                    act_date = device.activated_at or datetime.utcnow()
                    if toggles_val > 100000 or crashes_val > 50:
                        device.warranty_status = models.WarrantyStatus.VOID.value
                    elif (datetime.utcnow() - act_date).days > 365:
                        device.warranty_status = models.WarrantyStatus.EXPIRED.value
                    else:
                        device.warranty_status = models.WarrantyStatus.ACTIVE.value

                    # Record snapshot in DeviceTelemetry table
                    if is_telemetry or "toggles" in state_data or "on_hours" in state_data:
                        telemetry_row = models.DeviceTelemetry(
                            device_id=device.id,
                            node_id=target_node_id,
                            channel=state_data.get("channel"),
                            toggles=toggles_val,
                            on_duration_seconds=device.total_on_duration_seconds or 0,
                            on_hours=round((device.total_on_duration_seconds or 0) / 3600.0, 2),
                            boot_count=device.boot_count or 0,
                            crash_count=crashes_val,
                            rssi=state_data.get("rssi"),
                            uptime_seconds=state_data.get("uptime"),
                            raw_payload=state_data
                        )
                        db.add(telemetry_row)

                    clean_state = {}
                    if "status" in state_data:
                        raw_st = state_data.get("status")
                        clean_state["status"] = normalize_status(raw_st)
                    if "value" in state_data:
                        clean_state["value"] = state_data["value"]
                    elif "speed" in state_data:
                        clean_state["value"] = state_data["speed"]
                    if incoming_local_ip:
                        clean_state["local_ip"] = incoming_local_ip

                    new_state = {**previous_state, **clean_state}
                    
                    if previous_state != new_state or was_offline or incoming_local_ip or is_telemetry:
                        # Increment toggle counter on real state change
                        if "status" in clean_state and previous_state.get("status") != clean_state.get("status") and clean_state.get("status") in ["ON", "OFF"]:
                            device.total_toggle_count = (device.total_toggle_count or 0) + 1

                        device.current_state = new_state
                        device.is_online = True
                        if incoming_local_ip:
                            device.local_ip = incoming_local_ip
                        device.updated_at = datetime.utcnow()
                        db.add(device)
                        
                        history_entry = models.DeviceHistory(
                            device_id=device.id,
                            change_type="telemetry_snapshot" if is_telemetry else "status_confirmed",
                            previous_state=previous_state,
                            new_state=new_state
                        )
                        db.add(history_entry)

                        if was_offline and device.home and device.home.owner_id:
                            alert_entry = models.Alert(
                                user_id=device.home.owner_id,
                                device_id=device.id,
                                type="device_online",
                                message=f"Device '{device.name}' is now ONLINE.",
                                is_read=False
                            )
                            db.add(alert_entry)

                        db.commit()
                        logger.info("Device node %s updated via MQTT: %s", target_node_id, state_data)
                    else:
                        logger.info("Device node %s state is already up-to-date.", target_node_id)
                else:
                    logger.warning("Device node %s not found in database.", target_node_id)
            except Exception as e:
                db.rollback()
                logger.exception("Error processing MQTT message in DB: %s", e)
            finally:
                db.close()
    except Exception as e:
        logger.exception("General error in MQTT on_message: %s", e)

# Setup callbacks
client.on_connect = on_connect
client.on_disconnect = on_disconnect
client.on_message = on_message

def start_mqtt():
    """Connect to broker and start loop in a background thread."""
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, MQTT_KEEPALIVE)
        client.loop_start()
        logger.info("MQTT loop started.")
    except Exception as e:
        logger.exception("Failed to connect/start MQTT: %s", e)

def stop_mqtt():
    """Stop MQTT loop and disconnect."""
    client.loop_stop()
    client.disconnect()
    logger.info("MQTT loop stopped and disconnected.")

def _blocking_publish(topic: str, payload: str, retain: bool = False):
    """Executes the blocking publish inside the thread pool executor."""
    try:
        info = client.publish(topic, payload, qos=1, retain=retain)
        info.wait_for_publish(timeout=2.0)
        logger.info("MQTT published (retain=%s) to %s: %s", retain, topic, payload)
    except Exception as e:
        logger.error("Failed to publish to %s: %s", topic, e)

def normalize_status(raw_status) -> str:
    """
    Normalize any status representation to strictly string 'ON' or 'OFF'.
    Handles booleans (True/False), integers (1/0), and casing ('on'/'off').
    """
    if raw_status is None:
        return "OFF"
    if isinstance(raw_status, bool):
        return "ON" if raw_status else "OFF"
    if isinstance(raw_status, (int, float)):
        return "ON" if raw_status > 0 else "OFF"
    if isinstance(raw_status, str):
        cleaned = raw_status.strip().upper()
        if cleaned in ("ON", "TRUE", "1", "YES", "ENABLE", "ENABLED"):
            return "ON"
        return "OFF"
    return "OFF"

def publish_control_message(node_id: str, state: dict):
    """
    Publish a control message to control a device.
    Ensures strict JSON schema adherence:
    - Normalizes status to 'ON' | 'OFF'
    - Normalizes channel number to integer
    - For fan (channel 5) or speed adjustments, ensures 'speed' key is always present alongside 'value'
    Runs asynchronously inside a thread pool to avoid blocking FastAPI's async loop.
    """
    node_id_to_publish = node_id
    payload_to_publish = dict(state) if isinstance(state, dict) else {}
    
    # 1. Action commands (e.g. factory_reset, OTA_UPDATE)
    if "action" in state:
        payload_to_publish = dict(state)
        if "_" in node_id:
            parts = node_id.rsplit('_', 1)
            if len(parts) == 2 and parts[1].isdigit():
                node_id_to_publish = parts[0]
    else:
        # 2. Extract channel from node_id (e.g. 4L-NODE-123_5) or state dict
        channel = None
        if "_" in node_id:
            parts = node_id.rsplit('_', 1)
            if len(parts) == 2 and parts[1].isdigit():
                node_id_to_publish = parts[0]
                channel = int(parts[1])
        elif "channel" in state:
            try:
                channel = int(state["channel"])
            except (ValueError, TypeError):
                channel = None

        # 3. Normalize status
        raw_status = state.get("status") if "status" in state else state.get("state")
        status_val = normalize_status(raw_status)

        if channel is not None:
            payload_to_publish = {
                "channel": channel,
                "status": status_val
            }
            # 4. Fan speed & value propagation for channel 5 or when speed/value is provided
            if channel == 5 or "speed" in state or "value" in state:
                speed_val = state.get("speed") if "speed" in state else state.get("value")
                if speed_val is not None:
                    try:
                        speed_val = int(speed_val)
                    except (ValueError, TypeError):
                        pass
                    payload_to_publish["speed"] = speed_val
                    payload_to_publish["value"] = speed_val
                elif "speed" in state:
                    payload_to_publish["speed"] = state["speed"]
                elif "value" in state:
                    payload_to_publish["value"] = state["value"]
        else:
            payload_to_publish["status"] = status_val
            if "speed" in state or "value" in state:
                speed_val = state.get("speed") if "speed" in state else state.get("value")
                if speed_val is not None:
                    try:
                        speed_val = int(speed_val)
                    except (ValueError, TypeError):
                        pass
                    payload_to_publish["speed"] = speed_val
                    payload_to_publish["value"] = speed_val

    topic = f"home/device/{node_id_to_publish}/control"
    payload = json.dumps(payload_to_publish)
    try:
        publish_executor.submit(_blocking_publish, topic, payload)
    except Exception as e:
        logger.error("Failed to enqueue MQTT publish to %s: %s", topic, e)

def publish_message(topic: str, payload: dict | str, retain: bool = False):
    """
    Generic MQTT publish function to send a JSON payload or string to any specified topic.
    Submits blocking publish to thread pool to prevent blocking FastAPI's event loop.
    """
    if isinstance(payload, (dict, list)):
        payload_str = json.dumps(payload)
    else:
        payload_str = str(payload)
        
    try:
        publish_executor.submit(_blocking_publish, topic, payload_str, retain)
        logger.info("Enqueued MQTT publish (retain=%s) to topic %s: %s", retain, topic, payload_str)
    except Exception as e:
        logger.error("Failed to enqueue MQTT publish to %s: %s", topic, e)

# Backward-compatibility alias
publish_device_control = publish_control_message
