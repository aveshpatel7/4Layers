import time
import json
import random
import paho.mqtt.client as mqtt
from paho.mqtt.enums import CallbackAPIVersion

MQTT_BROKER = "i26a1c71.ala.asia-southeast1.emqxsl.com"
MQTT_PORT = 8883
MQTT_USERNAME = "smartnest_client"
MQTT_PASSWORD = "D2m9ga8JynJDEM6"
CLIENT_ID = f"ota_test_single_{random.randint(1000, 9999)}"

TARGET_NODE = "4L-NODE-90DCAC"
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
        print(f"[CONNECTED] Connected to MQTT Broker. Subscribing to topics for {TARGET_NODE}...")
        client.subscribe(f"smartnest/devices/{TARGET_NODE}/ota/status")
        client.subscribe(f"smartnest/devices/{TARGET_NODE}/logs")
        client.subscribe(f"home/device/{TARGET_NODE}/status")

def on_message(client, userdata, msg):
    try:
        topic = msg.topic
        raw = msg.payload.decode('utf-8', errors='ignore')
        print(f"[MSG RECV] {topic} -> {raw}")
    except Exception as e:
        print(f"[RAW RECV] {msg.topic}: {msg.payload}")

client = mqtt.Client(CallbackAPIVersion.VERSION2, client_id=CLIENT_ID)
client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
client.tls_set()
client.on_connect = on_connect
client.on_message = on_message

print("Connecting to MQTT Broker...")
client.connect(MQTT_BROKER, MQTT_PORT, 60)
client.loop_start()

for _ in range(30):
    if connected:
        break
    time.sleep(0.2)

if not connected:
    print("[ERROR] Failed to connect to MQTT broker.")
    exit(1)

time.sleep(1)

target_topic = f"smartnest/devices/{TARGET_NODE}/ota"
command_topic = f"smartnest/devices/{TARGET_NODE}/command"

print(f"\n[TRIGGER OTA] Sending OTA Command to {TARGET_NODE}...")
print(f"Topic: {target_topic}")
print(f"Payload: {json.dumps(payload, indent=2)}")

client.publish(target_topic, json.dumps(payload), qos=1)
client.publish(command_topic, json.dumps(payload), qos=1)

print("\n--- Listening for live OTA Progress & Logs for 25 seconds ---")
time.sleep(25)

client.loop_stop()
client.disconnect()
print("\n[DONE] Test execution finished.")
