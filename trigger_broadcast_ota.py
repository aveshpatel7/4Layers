import time
import json
import random
import paho.mqtt.client as mqtt
from paho.mqtt.enums import CallbackAPIVersion

MQTT_BROKER = "i26a1c71.ala.asia-southeast1.emqxsl.com"
MQTT_PORT = 8883
MQTT_USERNAME = "smartnest_client"
MQTT_PASSWORD = "D2m9ga8JynJDEM6"
CLIENT_ID = f"ota_trigger_{random.randint(1000, 9999)}"

FIRMWARE_URL = "https://edabtynvpy.ap-south-1.awsapprunner.com/firmware/latest.bin"
FIRMWARE_VERSION = "v2.2.6"

payload = {
    "action": "OTA_UPDATE",
    "firmware_url": FIRMWARE_URL,
    "version": FIRMWARE_VERSION,
    "timestamp": time.time()
}

connected = False

def on_connect(client, userdata, flags, reason_code, properties=None):
    global connected
    if reason_code == 0:
        connected = True
        print(f"[SUCCESS] Connected to EMQX Cloud MQTT ({MQTT_BROKER}:{MQTT_PORT})")
    else:
        print(f"[ERROR] Failed to connect, rc={reason_code}")

def on_message(client, userdata, msg):
    try:
        print(f"[HARDWARE STATUS] {msg.topic} -> {msg.payload.decode('utf-8', errors='ignore')}")
    except Exception as e:
        print(f"[RAW MSG] {msg.topic}: {msg.payload}")

client = mqtt.Client(CallbackAPIVersion.VERSION2, client_id=CLIENT_ID)
client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
client.tls_set()
client.on_connect = on_connect
client.on_message = on_message

print(f"Connecting to MQTT Broker: {MQTT_BROKER}...")
client.connect(MQTT_BROKER, MQTT_PORT, 60)
client.loop_start()

# Wait for connection
for _ in range(30):
    if connected:
        break
    time.sleep(0.2)

if not connected:
    print("[ERROR] Connection timeout to MQTT broker!")
    exit(1)

topics_to_broadcast = [
    "smartnest/devices/all/ota",
    "smartnest/devices/all/command",
    "home/device/all/set"
]

print(f"[OTA BROADCAST] Triggering Remote Firmware OTA ({FIRMWARE_VERSION})...")
print(f"Payload: {json.dumps(payload, indent=2)}")

for t in topics_to_broadcast:
    res = client.publish(t, json.dumps(payload), qos=1)
    res.wait_for_publish()
    print(f"Published OTA command to: {t}")

print("\nListening for OTA status updates for 8 seconds...")
client.subscribe("smartnest/devices/+/ota/status")
client.subscribe("smartnest/devices/+/logs")
client.subscribe("home/device/+/status")

time.sleep(8)

client.loop_stop()
client.disconnect()
print("\n[DONE] Remote OTA Broadcast completed successfully!")
