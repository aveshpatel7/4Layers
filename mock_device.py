import os
import json
import time
import sys
import random
import threading
import paho.mqtt.client as mqtt

# Configuration
MQTT_BROKER = os.getenv("MQTT_BROKER", "broker.emqx.io")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", None)
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", None)
MQTT_CLIENT_ID = os.getenv("MQTT_CLIENT_ID", f"smartnest_mock_device_{random.randint(10000, 99999)}")
NODE_ID = os.getenv("NODE_ID", "4L-SIMULATOR-001")
LOCAL_IP = os.getenv("LOCAL_IP", "192.168.1.150")
HEARTBEAT_INTERVAL = int(os.getenv("HEARTBEAT_INTERVAL", "20"))


class SmartNestMockDevice:
    """
    Simulates a physical 6-channel SmartNest switchboard:
    - Channel 1..4: Relay Lights / Outlets (ON/OFF)
    - Channel 5: Fan with speed (0..4) and ON/OFF state
    - Channel 6: Master Switch (Bulk ON/OFF)
    """

    def __init__(self, node_id: str = NODE_ID, local_ip: str = LOCAL_IP):
        self.node_id = node_id
        self.local_ip = local_ip
        self.channels = {
            1: "OFF",
            2: "OFF",
            3: "OFF",
            4: "OFF",
            5: "OFF",
            6: "OFF"
        }
        self.speed = 0
        self.free_heap = 48210
        self.rssi = -60

    def process_command(self, payload: dict) -> list[dict]:
        """
        Process a control payload and return response status updates to publish.
        """
        responses = []

        if "action" in payload:
            action = payload["action"]
            if action == "factory_reset":
                for ch in range(1, 7):
                    self.channels[ch] = "OFF"
                self.speed = 0
                responses.append({
                    "node_id": self.node_id,
                    "status": "RESET_COMPLETE",
                    "channels": dict(self.channels),
                    "speed": self.speed
                })
            return responses

        if "channel" not in payload:
            return responses

        try:
            channel = int(payload["channel"])
        except (ValueError, TypeError):
            return responses

        raw_status = payload.get("status") or payload.get("state") or "OFF"
        if isinstance(raw_status, bool):
            target_status = "ON" if raw_status else "OFF"
        elif isinstance(raw_status, (int, float)):
            target_status = "ON" if raw_status > 0 else "OFF"
        elif isinstance(raw_status, str):
            target_status = "ON" if raw_status.strip().upper() in ("ON", "TRUE", "1") else "OFF"
        else:
            target_status = "OFF"

        if channel == 6:
            # Master Switch
            self.channels[6] = target_status
            for ch in range(1, 5):
                self.channels[ch] = target_status
                responses.append({"channel": ch, "status": target_status})

            self.channels[5] = target_status
            if target_status == "ON":
                if self.speed == 0:
                    self.speed = 3
            else:
                self.speed = 0
            responses.append({
                "channel": 5,
                "status": target_status,
                "speed": self.speed,
                "value": self.speed
            })
            responses.append({"channel": 6, "status": target_status})

        elif channel == 5:
            # Fan Control
            self.channels[5] = target_status
            speed_val = payload.get("speed") if "speed" in payload else payload.get("value")
            if speed_val is not None:
                try:
                    self.speed = int(speed_val)
                except (ValueError, TypeError):
                    pass

            if target_status == "OFF":
                self.speed = 0
            elif target_status == "ON" and self.speed == 0:
                self.speed = 3

            responses.append({
                "channel": 5,
                "status": self.channels[5],
                "speed": self.speed,
                "value": self.speed
            })
            self._update_master_status()

        elif 1 <= channel <= 4:
            # Relays
            self.channels[channel] = target_status
            responses.append({
                "channel": channel,
                "status": target_status
            })
            self._update_master_status()

        return responses

    def _update_master_status(self):
        all_on = all(self.channels[ch] == "ON" for ch in range(1, 6))
        all_off = all(self.channels[ch] == "OFF" for ch in range(1, 6))
        if all_on:
            self.channels[6] = "ON"
        elif all_off:
            self.channels[6] = "OFF"

    def get_heartbeat_payload(self) -> dict:
        return {
            "node_id": self.node_id,
            "status": "HEARTBEAT",
            "is_online": True,
            "local_ip": self.local_ip,
            "free_heap": self.free_heap,
            "rssi": self.rssi,
            "channel_1": self.channels[1],
            "channel_2": self.channels[2],
            "channel_3": self.channels[3],
            "channel_4": self.channels[4],
            "channel_5": self.channels[5],
            "channel_6": self.channels[6],
            "speed": self.speed
        }


# Global simulator instance
device_simulator = SmartNestMockDevice()
running = True


def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"[Simulator] Connected to MQTT Broker ({MQTT_BROKER}:{MQTT_PORT})")
        control_topic = f"home/device/{device_simulator.node_id}/control"
        wildcard_topic = "home/device/+/control"
        client.subscribe([(control_topic, 1), (wildcard_topic, 1)])
        print(f"[Simulator] Subscribed to control topics: '{control_topic}' and '{wildcard_topic}'")
        print(f"[Simulator] Device Node ID: {device_simulator.node_id} | Local IP: {device_simulator.local_ip}")
        
        # Publish initial online status and heartbeat
        heartbeat = device_simulator.get_heartbeat_payload()
        status_topic = f"home/device/{device_simulator.node_id}/status"
        client.publish(status_topic, json.dumps(heartbeat), qos=1)
        print(f"[Simulator] Initial heartbeat published to {status_topic}")
    else:
        print(f"[Simulator] Connection failed with rc={rc}")


def on_message(client, userdata, msg):
    try:
        topic = msg.topic
        payload_str = msg.payload.decode("utf-8").strip()
        print(f"\n[Simulator RX] Topic: {topic} | Payload: {payload_str}")

        parts = topic.split('/')
        # Topic format: home/device/{node_id}/control
        if len(parts) == 4 and parts[0] == "home" and parts[1] == "device" and parts[3] == "control":
            target_node = parts[2]
            if target_node not in (device_simulator.node_id, "+"):
                return

            try:
                data = json.loads(payload_str)
            except json.JSONDecodeError as e:
                print(f"[Simulator ERROR] Invalid JSON payload: {payload_str} ({e})")
                return

            responses = device_simulator.process_command(data)
            status_topic = f"home/device/{device_simulator.node_id}/status"

            for resp in responses:
                resp_payload = json.dumps(resp)
                client.publish(status_topic, resp_payload, qos=1)
                print(f"[Simulator TX Status] Topic: {status_topic} | Payload: {resp_payload}")

    except Exception as e:
        print(f"[Simulator ERROR] Error in message handler: {e}", file=sys.stderr)


def heartbeat_loop(client):
    while running:
        time.sleep(HEARTBEAT_INTERVAL)
        if client.is_connected():
            heartbeat = device_simulator.get_heartbeat_payload()
            status_topic = f"home/device/{device_simulator.node_id}/status"
            try:
                client.publish(status_topic, json.dumps(heartbeat), qos=1)
                print(f"[Simulator Heartbeat] Published to {status_topic}")
            except Exception as e:
                print(f"[Simulator Heartbeat ERROR] {e}")


def main():
    global running
    client = mqtt.Client(client_id=MQTT_CLIENT_ID)
    if MQTT_USERNAME and MQTT_PASSWORD:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

    client.on_connect = on_connect
    client.on_message = on_message

    # Set LWT for abnormal disconnection
    lwt_topic = f"home/device/{device_simulator.node_id}/status"
    lwt_payload = json.dumps({"status": "OFFLINE", "is_online": False, "node_id": device_simulator.node_id})
    client.will_set(lwt_topic, lwt_payload, qos=1, retain=False)

    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_start()

        # Start heartbeat background thread
        hb_thread = threading.Thread(target=heartbeat_loop, args=(client,), daemon=True)
        hb_thread.start()

        print("[Simulator] Running. Press Ctrl+C to stop.")
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[Simulator] Stopping mock device...")
    finally:
        running = False
        client.loop_stop()
        client.disconnect()
        print("[Simulator] Disconnected.")


if __name__ == "__main__":
    main()
