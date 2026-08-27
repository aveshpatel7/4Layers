import time
import json
import random
import paho.mqtt.client as mqtt
from paho.mqtt.enums import CallbackAPIVersion

MQTT_BROKER = "i26a1c71.ala.asia-southeast1.emqxsl.com"
MQTT_PORT = 8883
MQTT_USERNAME = "smartnest_client"
MQTT_PASSWORD = "D2m9ga8JynJDEM6"
CLIENT_ID = f"persistent_ota_deployer_{random.randint(1000, 9999)}"

FIRMWARE_URL = "https://edabtynvpy.ap-south-1.awsapprunner.com/firmware/latest.bin"
FIRMWARE_VERSION = "v2.2.6"

payload = {
    "action": "OTA_UPDATE",
    "firmware_url": FIRMWARE_URL,
    "version": FIRMWARE_VERSION,
    "timestamp": time.time()
}

discovered_nodes = set()
ota_progress_nodes = {}
rebooted_v226_nodes = set()

def on_connect(client, userdata, flags, reason_code, properties=None):
    if reason_code == 0:
        print("[CONNECTED] Connected to EMQX Cloud. Discovering nodes & deploying persistent OTA...")
        client.subscribe("home/device/+/status")
        client.subscribe("home/device/+/info")
        client.subscribe("smartnest/devices/+/ota/status")
        client.subscribe("smartnest/devices/+/telemetry")
        client.subscribe("smartnest/devices/+/logs")

def on_message(client, userdata, msg):
    try:
        topic = msg.topic
        payload_str = msg.payload.decode('utf-8', errors='ignore')
        data = json.loads(payload_str) if payload_str.startswith('{') else {}
        
        parts = topic.split('/')
        if len(parts) >= 3:
            node_id = parts[2]
            discovered_nodes.add(node_id)
            
            if "ota/status" in topic:
                status = data.get("status", "")
                prog = data.get("progress", 0)
                ota_progress_nodes[node_id] = f"{status} ({prog}%)"
                print(f"[OTA PROGRESS] {node_id} -> {status} ({prog}%)")
            
            if "status" in topic or "telemetry" in topic:
                fw = data.get("fw_version") or data.get("version")
                if fw == "v2.2.6":
                    rebooted_v226_nodes.add(node_id)
                    print(f"[CONFIRMED v2.2.6 ONLINE] {node_id} is running v2.2.6!")
    except Exception:
        pass

def main():
    client = mqtt.Client(CallbackAPIVersion.VERSION2, client_id=CLIENT_ID)
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    client.tls_set()
    client.on_connect = on_connect
    client.on_message = on_message

    print(f"Connecting to MQTT Broker {MQTT_BROKER}...")
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_start()

    # 1. Discover nodes for 4 seconds
    time.sleep(4)

    known_nodes = {
        "4L-NODE-90DCAC",
        "4L-NODE-2FD6E4",
        "4L-NODE-31AD18",
        "4L-NODE-31C7C8",
        "4L-NODE-50B5FC",
        "4L-NODE-6E5D80",
        "4L-NODE-A50528",
        "4L-NODE-CA4B70",
        "4L-NODE-E9BFB4",
        "4L_ALEXA_1"
    }
    all_target_nodes = known_nodes.union(discovered_nodes)

    print(f"\n=======================================================")
    print(f"[PERSISTENT FLEET OTA DISPATCH - {FIRMWARE_VERSION}]")
    print(f"Target Nodes Total: {len(all_target_nodes)}")
    print(f"=======================================================\n")

    # 2. Publish GLOBAL RETAINED OTA (Guarantees any offline node gets it the moment it boots)
    print("1. Publishing to Global Broadcast OTA with RETAIN=True...")
    res = client.publish("smartnest/devices/all/ota", json.dumps(payload), qos=1, retain=True)
    res.wait_for_publish()
    print("   [OK] Global topic 'smartnest/devices/all/ota' set to RETAINED v2.2.6!\n")

    # 3. Publish PER-NODE RETAINED OTA (For every specific node)
    print("2. Publishing Per-Node Retained OTA to each hardware board...")
    for node in sorted(list(all_target_nodes)):
        node_ota_topic = f"smartnest/devices/{node}/ota"
        node_cmd_topic = f"smartnest/devices/{node}/command"
        
        client.publish(node_ota_topic, json.dumps(payload), qos=1, retain=True)
        client.publish(node_cmd_topic, json.dumps(payload), qos=1, retain=False)
        print(f"   [DISPATCHED] Retained OTA for: {node}")
        time.sleep(0.15)

    print("\n3. Listening for live downloads and reboot confirmations for 20 seconds...")
    time.sleep(20)

    client.loop_stop()
    client.disconnect()

    print("\n=======================================================")
    print("[DEPLOYMENT SUMMARY]")
    print(f"Total Fleet Target: {len(all_target_nodes)} devices")
    print(f"Confirmed running v2.2.6 right now: {len(rebooted_v226_nodes)} ({list(rebooted_v226_nodes)})")
    print("Retained Offline Policy: ACTIVE (Broker will immediately deliver v2.2.6 whenever any offline board powers on)")
    print("=======================================================\n")

if __name__ == '__main__':
    main()

