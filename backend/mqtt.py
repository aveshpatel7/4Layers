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
        # Subscribe to status confirmation updates for all device nodes
        # Topic pattern: home/device/{node_id}/status
        subscribe_topic = "home/device/+/status"
        ota_topic = "smartnest/devices/+/ota/status"
        client.subscribe([(subscribe_topic, 1), (ota_topic, 1)])
        logger.info("Subscribed to MQTT topics: %s and %s", subscribe_topic, ota_topic)
    else:
        logger.error("Failed to connect to MQTT Broker, return code %d", rc)

def on_disconnect(client, userdata, rc):
    """Callback when client disconnects from broker."""
    logger.warning("Disconnected from MQTT Broker. Return code: %s", rc)

# WebSocket broadcast listener callback for OTA status
ota_ws_broadcaster = None

def set_ota_ws_broadcaster(callback):
    global ota_ws_broadcaster
    ota_ws_broadcaster = callback

def on_message(client, userdata, msg):
    """Callback when a message is received from the broker."""
    logger.info("Received MQTT message on topic: %s, payload: %s", msg.topic, msg.payload)
    try:
        payload_str = msg.payload.decode("utf-8").strip()
        
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

        # Parse topic: home/device/{node_id}/status
        parts = msg.topic.split('/')
        if len(parts) == 4 and parts[0] == "home" and parts[1] == "device" and parts[3] == "status":
            node_id = parts[2]
            
            # 1. Strict JSON payload validation
            payload_str = msg.payload.decode("utf-8").strip()
            try:
                state_data = json.loads(payload_str)
            except json.JSONDecodeError as err:
                logger.error("Invalid JSON payload dropped on node %s: %s (Error: %s)", node_id, payload_str, err)
                return
            
            if not isinstance(state_data, dict):
                logger.error("Dropped payload on node %s; must be a JSON object: %s", node_id, payload_str)
                return

            # Target node determination
            target_node_id = node_id
            if "channel" in state_data:
                target_node_id = f"{node_id}_{state_data['channel']}"

            # Update database in callback thread
            db: Session = SessionLocal()
            try:
                device = db.query(models.Device).filter(models.Device.node_id == target_node_id).first()
                
                if device:
                    device.last_seen = datetime.utcnow()
                    
                    # 2. LWT Handling: check if offline LWT arrived
                    if state_data.get("status") == "OFFLINE":
                        device.is_online = False
                        device.updated_at = datetime.utcnow()
                        db.add(device)

                        # Log history
                        history_entry = models.DeviceHistory(
                            device_id=device.id,
                            change_type="status_confirmed",
                            previous_state=device.current_state or {},
                            new_state={"status": "OFFLINE"}
                        )
                        db.add(history_entry)

                        # Create alert
                        alert_entry = models.Alert(
                            user_id=device.home.owner_id,
                            device_id=device.id,
                            type="device_offline",
                            message=f"Smart Nest Device '{device.name}' is now OFFLINE.",
                            is_read=False
                        )
                        db.add(alert_entry)
                        db.commit()
                        logger.info("LWT Offline handled: Device node %s marked offline.", target_node_id)
                        return

                    # Normal status confirmation handling
                    previous_state = device.current_state or {}
                    was_offline = not device.is_online
                    
                    clean_state = {
                        "status": state_data.get("status", "OFF")
                    }
                    if "value" in state_data:
                        clean_state["value"] = state_data["value"]
                    elif "speed" in state_data:
                        clean_state["value"] = state_data["speed"]

                    new_state = {**previous_state, **clean_state}
                    
                    if previous_state != new_state or was_offline:
                        device.current_state = new_state
                        device.is_online = True
                        device.updated_at = datetime.utcnow()
                        db.add(device)
                        
                        history_entry = models.DeviceHistory(
                            device_id=device.id,
                            change_type="status_confirmed",
                            previous_state=previous_state,
                            new_state=clean_state
                        )
                        db.add(history_entry)

                        if was_offline:
                            alert_entry = models.Alert(
                                user_id=device.home.owner_id,
                                device_id=device.id,
                                type="device_online",
                                message=f"Smart Nest Device '{device.name}' is now ONLINE and connected to Gateway.",
                                is_read=False
                            )
                            db.add(alert_entry)

                        db.commit()
                        logger.info("Device node %s status updated via MQTT: %s", target_node_id, state_data)
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

def _blocking_publish(topic: str, payload: str):
    """Executes the blocking publish inside the thread pool executor."""
    try:
        info = client.publish(topic, payload, qos=1)
        info.wait_for_publish(timeout=2.0)
        logger.info("MQTT published to %s: %s", topic, payload)
    except Exception as e:
        logger.error("Failed to publish to %s: %s", topic, e)

def publish_control_message(node_id: str, state: dict):
    """
    Publish a control message to control a device.
    Runs asynchronously inside a thread pool to avoid blocking FastAPI's async loop.
    """
    node_id_to_publish = node_id
    payload_to_publish = state
    
    if "action" in state:
        payload_to_publish = state
        if "_" in node_id:
            node_id_to_publish = node_id.rsplit('_', 1)[0]
    elif "_" in node_id:
        parts = node_id.rsplit('_', 1)
        if len(parts) == 2 and parts[1].isdigit():
            base_node_id = parts[0]
            channel = int(parts[1])
            status_val = state.get("status", "OFF")
            
            payload_to_publish = {
                "channel": channel,
                "status": status_val
            }
            if "value" in state:
                payload_to_publish["value"] = state["value"]
                
            node_id_to_publish = base_node_id

    topic = f"home/device/{node_id_to_publish}/control"
    payload = json.dumps(payload_to_publish)
    try:
        publish_executor.submit(_blocking_publish, topic, payload)
    except Exception as e:
        logger.error("Failed to enqueue MQTT publish to %s: %s", topic, e)
