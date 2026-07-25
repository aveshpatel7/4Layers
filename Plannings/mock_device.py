import json
import time
import sys
import random
import paho.mqtt.client as mqtt

# Configuration matching backend
MQTT_BROKER = "broker.emqx.io"
MQTT_PORT = 1883
MQTT_CLIENT_ID = f"smartnest_mock_device_{random.randint(10000, 99999)}"

# Track local state of virtual devices
# key: (user_id, device_id), value: "ON" or "OFF"
device_states = {}

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"Mock Device connected to EMQX Broker ({MQTT_BROKER}:{MQTT_PORT})")
        # Listen to control messages sent by backend
        topic = "home/+/+/control"
        client.subscribe(topic)
        print(f"Subscribed to control topic: {topic}")
        print("Waiting for control commands... Press Ctrl+C to exit.")
    else:
        print(f"Connection failed, return code: {rc}")

def on_message(client, userdata, msg):
    try:
        topic = msg.topic
        payload = msg.payload.decode("utf-8")
        print(f"\n[MQTT Control Received] Topic: {topic} | Payload: {payload}")
        
        # Parse topic: home/{user_id}/{device_id}/control
        parts = topic.split('/')
        if len(parts) == 4 and parts[0] == "home" and parts[3] == "control":
            user_id = parts[1]
            device_id = parts[2]
            
            # Parse payload
            data = json.loads(payload)
            target_status = data.get("status", "").upper()
            
            if target_status in ["ON", "OFF"]:
                key = (user_id, device_id)
                old_state = device_states.get(key, "OFF")
                
                print(f"-> Device {device_id} (User {user_id}): Changing state from {old_state} to {target_status}...")
                # Simulate hardware lag (500ms)
                time.sleep(0.5)
                
                device_states[key] = target_status
                print(f"-> Device {device_id} state is now: {target_status}")
                
                # Publish confirmation back to backend
                # Topic: home/{user_id}/{device_id}/status
                status_topic = f"home/{user_id}/{device_id}/status"
                status_payload = json.dumps({"status": target_status})
                client.publish(status_topic, status_payload, qos=1)
                print(f"[MQTT Status Published] Topic: {status_topic} | Payload: {status_payload}")
            else:
                print("Error: Invalid status field in payload")
    except Exception as e:
        print(f"Error handling message: {e}", file=sys.stderr)

# Initialize MQTT Client
client = mqtt.Client(client_id=MQTT_CLIENT_ID)
client.on_connect = on_connect
client.on_message = on_message

try:
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_forever()
except KeyboardInterrupt:
    print("\nDisconnecting device simulator...")
    client.disconnect()
except Exception as e:
    print(f"Simulator Error: {e}", file=sys.stderr)
