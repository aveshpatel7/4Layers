import time
import json
import random
import paho.mqtt.client as mqtt
from paho.mqtt.enums import CallbackAPIVersion

MQTT_BROKER = "i26a1c71.ala.asia-southeast1.emqxsl.com"
MQTT_PORT = 8883
MQTT_USERNAME = "smartnest_client"
MQTT_PASSWORD = "D2m9ga8JynJDEM6"
CLIENT_ID = f"listener_{random.randint(1000, 9999)}"

TARGET_NODE = "4L-NODE-90DCAC"

def on_connect(client, userdata, flags, reason_code, properties=None):
    if reason_code == 0:
        print("[CONNECTED] Subscribing to 4L-NODE-90DCAC topics...")
        client.subscribe("smartnest/devices/4L-NODE-90DCAC/#")
        client.subscribe("home/device/4L-NODE-90DCAC/#")

def on_message(client, userdata, msg):
    try:
        topic = msg.topic
        raw = msg.payload.decode('utf-8', errors='ignore')
        print(f"[{topic}] -> {raw}")
    except Exception as e:
        print(f"[{msg.topic}] -> {msg.payload}")

client = mqtt.Client(CallbackAPIVersion.VERSION2, client_id=CLIENT_ID)
client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
client.tls_set()
client.on_connect = on_connect
client.on_message = on_message

client.connect(MQTT_BROKER, MQTT_PORT, 60)
client.loop_start()

print("Listening for 30 seconds...")
time.sleep(30)

client.loop_stop()
client.disconnect()
