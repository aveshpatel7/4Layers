"""
Firmware Resilience & Stress Test Suite for Milestone 1 (ESP32 Firmware Fixes)
Author: Challenger 2
Tests:
1. MQTT JSON Parsing & Malformed Payload Resilience (empty, non-JSON, truncated, corrupted, oversized, missing keys)
2. Heap Diagnostics & SSL Socket Teardown
3. Core 0 Web Server Latency & Dual-Core Non-blocking FreeRTOS Isolation
"""

import json
import time
import unittest
import queue
import threading
import re
from typing import Dict, Any, Optional, Tuple, List


# =====================================================================
# SIMULATED ARDUINOJSON / PUB SUB CLIENT FIRMWARE PARSER
# =====================================================================
class FirmwareJsonError(Exception):
    pass

class DeserializationError:
    Ok = "Ok"
    EmptyInput = "EmptyInput"
    IncompleteInput = "IncompleteInput"
    InvalidInput = "InvalidInput"
    NoMemory = "NoMemory"
    NotSupported = "NotSupported"

class MockFirmwareMqttParser:
    """
    Exact behavioral reproduction of main.cpp / 4layers_V12_5_Firmware.ino
    mqtt_callback() using StaticJsonDocument<384>.
    """
    MAX_DOC_SIZE = 384

    def __init__(self):
        self.serial_logs: List[str] = []
        self.executed_commands: List[Dict[str, Any]] = []
        self.ota_url: Optional[str] = None
        self.factory_reset_called: bool = False

    def deserialize_json(self, payload: bytes, length: int) -> Tuple[Optional[Dict[str, Any]], str]:
        if length == 0:
            return None, DeserializationError.EmptyInput
        
        # Buffer overrun check
        if length > len(payload):
            raise IndexError("Length parameter exceeds actual payload byte buffer size")

        # StaticJsonDocument<384> capacity limit check
        if length > self.MAX_DOC_SIZE:
            return None, DeserializationError.NoMemory

        # Extract exactly length bytes
        slice_bytes = payload[:length]

        # Check for binary null / invalid utf-8 before json end
        try:
            payload_str = slice_bytes.decode('utf-8')
        except UnicodeDecodeError:
            return None, DeserializationError.InvalidInput

        # Parse JSON
        try:
            # Emulate ArduinoJson: must be an object or array
            parsed = json.loads(payload_str)
            if not isinstance(parsed, dict):
                return None, DeserializationError.InvalidInput
            return parsed, DeserializationError.Ok
        except json.JSONDecodeError as e:
            if "Unterminated" in str(e) or "Expecting" in str(e) and len(payload_str.strip()) > 0 and payload_str.strip()[-1] not in ('}', ']'):
                return None, DeserializationError.IncompleteInput
            return None, DeserializationError.InvalidInput

    def mqtt_callback(self, topic: str, payload: bytes, length: int) -> bool:
        """
        Simulates void mqtt_callback(char* topic, byte* payload, unsigned int length)
        Returns True if a valid command was processed, False otherwise.
        """
        doc, error = self.deserialize_json(payload, length)
        
        if error != DeserializationError.Ok:
            # main.cpp line 876-879:
            # Serial.printf("❌ [ERROR] MQTT JSON Parse Failed: %s (Code: %s). Raw Payload (%u bytes): \"", error.c_str(), ...);
            # Serial.write(payload, length);
            raw_bytes = payload[:length]
            err_code = "InvalidInput" if error == DeserializationError.InvalidInput else error
            log_line = f'❌ [ERROR] MQTT JSON Parse Failed: {error} (Code: {err_code}). Raw Payload ({length} bytes): "{raw_bytes.decode("latin1", errors="replace")}"'
            self.serial_logs.append(log_line)
            return False

        # OTA Update
        if "action" in doc and doc["action"] == "OTA_UPDATE":
            url = doc.get("firmware_url")
            if url and len(url) > 0:
                self.serial_logs.append("📱 [APP/CLOUD] OTA Update Command Received!")
                self.ota_url = url
                return True
            else:
                self.serial_logs.append("❌ [ERROR] OTA Command missing firmware URL!")
                return False

        # Factory Reset
        if "action" in doc and doc["action"] == "factory_reset":
            self.serial_logs.append("🚨 [APP/CLOUD] Factory Reset Command Received!")
            self.factory_reset_called = True
            return True

        # Validation: channel and (status or state)
        if "channel" not in doc or ("status" not in doc and "state" not in doc):
            self.serial_logs.append("❌ [ERROR] Invalid MQTT Command: Missing 'channel' or 'status'/'state'")
            return False

        try:
            channel = int(doc["channel"])
        except (ValueError, TypeError):
            self.serial_logs.append("❌ [ERROR] Invalid channel format")
            return False

        state = False
        if "status" in doc:
            val = doc["status"]
            if isinstance(val, str):
                s = val.upper()
                state = (s == "ON" or s == "TRUE" or s == "1")
            elif isinstance(val, bool):
                state = val
            elif isinstance(val, (int, float)):
                state = (val != 0)
        elif "state" in doc:
            val = doc["state"]
            if isinstance(val, str):
                s = val.upper()
                state = (s == "ON" or s == "TRUE" or s == "1")
            elif isinstance(val, bool):
                state = val
            elif isinstance(val, (int, float)):
                state = (val != 0)

        spd = -1
        if "speed" in doc:
            try:
                spd = int(doc["speed"])
            except (ValueError, TypeError):
                spd = -1
        elif "value" in doc and channel == 5:
            try:
                spd = int(doc["value"])
            except (ValueError, TypeError):
                spd = -1

        self.executed_commands.append({
            "channel": channel,
            "state": state,
            "speed": spd,
            "source": "📱 [APP/CLOUD]"
        })
        return True


# =====================================================================
# SIMULATED DUAL-CORE FREERTOS COMMAND QUEUE & WEB SERVER
# =====================================================================
class MockFreeRTOSQueue:
    def __init__(self, capacity=16):
        self.capacity = capacity
        self.q = queue.Queue(maxsize=capacity)
        self.executed_history = []
        self.lock = threading.Lock()

    def send(self, item, timeout=0.05) -> bool:
        try:
            self.q.put(item, timeout=timeout)
            return True
        except queue.Full:
            return False

    def receive(self, timeout=0.1):
        try:
            return self.q.get(timeout=timeout)
        except queue.Empty:
            return None


class MockDualCoreSystem:
    def __init__(self):
        self.command_queue = MockFreeRTOSQueue(capacity=16)
        self.switch_states = {1: False, 2: False, 3: False, 4: False}
        self.fan_power = False
        self.curr_speed = 0
        self.state_lock = threading.Lock()
        self.stop_event = threading.Event()
        self.mqtt_reconnecting = False
        self.mqtt_reconnect_delays = 0
        self.executed_actions = []

        # Threads
        self.worker_thread = threading.Thread(target=self._command_worker_task, daemon=True)
        self.mqtt_thread = threading.Thread(target=self._mqtt_task, daemon=True)
        
    def start(self):
        self.worker_thread.start()
        self.mqtt_thread.start()

    def stop(self):
        self.stop_event.set()
        self.worker_thread.join(timeout=1.0)
        self.mqtt_thread.join(timeout=1.0)

    def _execute_command_direct(self, cmd):
        cmd_type = cmd.get("type")
        source = cmd.get("source", "UNKNOWN")

        if cmd_type == "CMD_CHANNEL_SET":
            ch = cmd["channel"]
            st = cmd["state"]
            if 1 <= ch <= 4:
                with self.state_lock:
                    self.switch_states[ch] = st
                self.executed_actions.append(f"{source}: Channel {ch} -> {'ON' if st else 'OFF'}")
            elif ch == 5:
                with self.state_lock:
                    self.fan_power = st
                self.executed_actions.append(f"{source}: Fan Power -> {'ON' if st else 'OFF'}")

        elif cmd_type == "CMD_FAN_SPEED_SET":
            spd = cmd["speed"]
            with self.state_lock:
                self.curr_speed = spd
                self.fan_power = (spd > 0)
            self.executed_actions.append(f"{source}: Fan Speed -> {spd}")

        elif cmd_type == "CMD_BULK_ALL_ON":
            for ch in (1, 2, 3, 4):
                with self.state_lock:
                    self.switch_states[ch] = True
                self.executed_actions.append(f"{source}: Bulk ON -> Relay {ch} ON")
                # 25ms simulation delay (representing 250ms hardware delay)
                time.sleep(0.025)
            with self.state_lock:
                self.fan_power = True
                self.curr_speed = 3
            self.executed_actions.append(f"{source}: Bulk ON -> Fan ON")

        elif cmd_type == "CMD_BULK_ALL_OFF":
            for ch in (1, 2, 3, 4):
                with self.state_lock:
                    self.switch_states[ch] = False
                self.executed_actions.append(f"{source}: Bulk OFF -> Relay {ch} OFF")
                time.sleep(0.025)
            with self.state_lock:
                self.fan_power = False
                self.curr_speed = 0
            self.executed_actions.append(f"{source}: Bulk OFF -> Fan OFF")

    def _command_worker_task(self):
        """Simulates Core 1 command_worker_task"""
        while not self.stop_event.is_set():
            cmd = self.command_queue.receive(timeout=0.01)
            if cmd:
                self._execute_command_direct(cmd)

    def _mqtt_task(self):
        """Simulates Core 1 mqtt_task with 15s reconnect backoff"""
        while not self.stop_event.is_set():
            if self.mqtt_reconnecting:
                # Simulating non-blocking reconnect loop
                for _ in range(15):
                    if self.stop_event.is_set():
                        break
                    time.sleep(0.02)  # 20ms per tick in simulation
                    self.mqtt_reconnect_delays += 1
                self.mqtt_reconnecting = False
            time.sleep(0.01)

    def handle_http_state(self) -> Dict[str, Any]:
        """Simulates Core 0 GET /state"""
        t0 = time.perf_counter()
        with self.state_lock:
            ch1 = self.switch_states[1]
            ch2 = self.switch_states[2]
            ch3 = self.switch_states[3]
            ch4 = self.switch_states[4]
            fan_pow = self.fan_power
            spd = self.curr_speed

        all_on = (ch1 and ch2 and ch3 and ch4 and fan_pow)
        all_off = (not ch1 and not ch2 and not ch3 and not ch4 and not fan_pow)
        all_state = "ALL_ON" if all_on else ("ALL_OFF" if all_off else "MIXED")

        resp = {
            "node_id": "4L-NODE-123",
            "local_ip": "192.168.1.50",
            "relays": [1 if ch1 else 0, 1 if ch2 else 0, 1 if ch3 else 0, 1 if ch4 else 0],
            "fan": {"enabled": fan_pow, "speed": spd},
            "channel_1": "ON" if ch1 else "OFF",
            "channel_2": "ON" if ch2 else "OFF",
            "channel_3": "ON" if ch3 else "OFF",
            "channel_4": "ON" if ch4 else "OFF",
            "channel_5": "ON" if fan_pow else "OFF",
            "speed": spd,
            "all_state": all_state
        }
        elapsed_ms = (time.perf_counter() - t0) * 1000
        return resp, elapsed_ms

    def handle_http_control(self, channel: int, status: str, speed: int = -1) -> Tuple[Dict[str, Any], float]:
        """Simulates Core 0 GET /control"""
        t0 = time.perf_counter()
        turn_on = status.upper() in ("ON", "TRUE", "1")
        
        cmd = {
            "source": "🌐 [APP/LOCAL]",
            "channel": channel,
            "state": turn_on,
            "speed": speed
        }
        if 1 <= channel <= 4:
            cmd["type"] = "CMD_CHANNEL_SET"
        elif channel == 5:
            if speed != -1:
                cmd["type"] = "CMD_FAN_SPEED_SET"
            else:
                cmd["type"] = "CMD_CHANNEL_SET"
        elif channel in (6, 7):
            cmd["type"] = "CMD_BULK_ALL_ON" if turn_on else "CMD_BULK_ALL_OFF"
        else:
            return {"error": "Invalid channel"}, 0.0

        enqueued = self.command_queue.send(cmd, timeout=0.05)
        if not enqueued:
            # Fallback direct
            self._execute_command_direct(cmd)

        resp = {
            "success": True,
            "channel": channel,
            "state": "ON" if turn_on else "OFF"
        }
        if speed != -1:
            resp["speed"] = speed

        elapsed_ms = (time.perf_counter() - t0) * 1000
        return resp, elapsed_ms


# =====================================================================
# EMPIRICAL UNIT & STRESS TEST CASES
# =====================================================================
class TestFirmwareResilienceMilestone1(unittest.TestCase):

    def setUp(self):
        self.parser = MockFirmwareMqttParser()

    # -------------------------------------------------------------
    # OBJECTIVE 1: MQTT JSON Parsing & Malformed Payloads
    # -------------------------------------------------------------
    def test_empty_payload(self):
        """Verify empty payload (0 bytes) fails gracefully with raw logging, no crash"""
        res = self.parser.mqtt_callback("home/device/control", b"", 0)
        self.assertFalse(res)
        self.assertEqual(len(self.parser.executed_commands), 0)
        self.assertTrue(any("EmptyInput" in log or "0 bytes" in log for log in self.parser.serial_logs))

    def test_non_json_string(self):
        """Verify plain text strings log exact raw payload and do not throw unhandled exceptions"""
        test_payloads = [
            b"hello world",
            b"TOGGLE_CHANNEL_1",
            b"12345678",
            b"status=ON&channel=1",
            b"<xml><channel>1</channel></xml>"
        ]
        for p in test_payloads:
            res = self.parser.mqtt_callback("home/device/control", p, len(p))
            self.assertFalse(res)
            self.assertEqual(len(self.parser.executed_commands), 0)
        
        # Check logs contain raw strings
        logs_str = " ".join(self.parser.serial_logs)
        self.assertIn("hello world", logs_str)
        self.assertIn("TOGGLE_CHANNEL_1", logs_str)

    def test_truncated_json(self):
        """Verify incomplete / truncated JSON fragments are safely rejected"""
        truncated_payloads = [
            b'{"channel": 1, "sta',
            b'{"channel": 1, "status":',
            b'{"channel":',
            b'{"action": "OTA_UPDATE", "firmware_url":'
        ]
        for p in truncated_payloads:
            res = self.parser.mqtt_callback("home/device/control", p, len(p))
            self.assertFalse(res)
            self.assertEqual(len(self.parser.executed_commands), 0)
        
        self.assertEqual(len(self.parser.serial_logs), len(truncated_payloads))

    def test_corrupted_payload_with_binary_and_null(self):
        """Verify payloads with embedded nulls or high-byte binary characters are safely handled"""
        corrupted_payloads = [
            b'{"channel": 1\x00, "status": "ON"}',
            b'\x00\xff\xfe\x00{"channel": 1}',
            b'{"channel": 1, "status": "ON\x00"}'
        ]
        for p in corrupted_payloads:
            res = self.parser.mqtt_callback("home/device/control", p, len(p))
            self.assertFalse(res)
            self.assertEqual(len(self.parser.executed_commands), 0)

    def test_oversized_payload(self):
        """Verify payloads exceeding StaticJsonDocument capacity (384 bytes) trigger NoMemory error safely"""
        large_json = json.dumps({
            "channel": 1,
            "status": "ON",
            "padding": "x" * 400
        }).encode('utf-8')
        
        self.assertGreater(len(large_json), 384)
        res = self.parser.mqtt_callback("home/device/control", large_json, len(large_json))
        self.assertFalse(res)
        self.assertTrue(any("NoMemory" in log for log in self.parser.serial_logs))

    def test_missing_keys(self):
        """Verify missing channel or status/state are rejected with descriptive error"""
        invalid_json_payloads = [
            b'{}',
            b'{"channel": 1}',
            b'{"status": "ON"}',
            b'{"unrelated_key": 999}'
        ]
        for p in invalid_json_payloads:
            res = self.parser.mqtt_callback("home/device/control", p, len(p))
            self.assertFalse(res)
            self.assertEqual(len(self.parser.executed_commands), 0)

        self.assertTrue(any("Missing 'channel' or 'status'/'state'" in log for log in self.parser.serial_logs))

    def test_valid_payload_variations(self):
        """Verify all valid status/state formats (string, bool, int, fan speed/value)"""
        cases = [
            (b'{"channel": 1, "status": "ON"}', 1, True, -1),
            (b'{"channel": 2, "status": "OFF"}', 2, False, -1),
            (b'{"channel": 3, "state": "true"}', 3, True, -1),
            (b'{"channel": 4, "state": "false"}', 4, False, -1),
            (b'{"channel": 1, "status": true}', 1, True, -1),
            (b'{"channel": 2, "status": false}', 2, False, -1),
            (b'{"channel": 3, "status": 1}', 3, True, -1),
            (b'{"channel": 4, "status": 0}', 4, False, -1),
            (b'{"channel": 5, "status": "ON", "speed": 4}', 5, True, 4),
            (b'{"channel": 5, "status": "ON", "value": 2}', 5, True, 2),
            (b'{"channel": 6, "status": "ON"}', 6, True, -1),
            (b'{"channel": 6, "status": "OFF"}', 6, False, -1),
        ]
        for payload, exp_ch, exp_st, exp_spd in cases:
            self.parser.executed_commands.clear()
            res = self.parser.mqtt_callback("home/device/control", payload, len(payload))
            self.assertTrue(res, f"Failed on {payload}")
            self.assertEqual(len(self.parser.executed_commands), 1)
            cmd = self.parser.executed_commands[0]
            self.assertEqual(cmd["channel"], exp_ch)
            self.assertEqual(cmd["state"], exp_st)
            self.assertEqual(cmd["speed"], exp_spd)

    def test_ota_and_factory_reset_actions(self):
        """Verify OTA and factory_reset action handlers in MQTT callback"""
        ota_payload = b'{"action": "OTA_UPDATE", "firmware_url": "http://192.168.1.100:8000/firmware.bin"}'
        res = self.parser.mqtt_callback("smartnest/devices/ota", ota_payload, len(ota_payload))
        self.assertTrue(res)
        self.assertEqual(self.parser.ota_url, "http://192.168.1.100:8000/firmware.bin")

        reset_payload = b'{"action": "factory_reset"}'
        res = self.parser.mqtt_callback("home/device/control", reset_payload, len(reset_payload))
        self.assertTrue(res)
        self.assertTrue(self.parser.factory_reset_called)


    # -------------------------------------------------------------
    # OBJECTIVE 2: Heap Diagnostics & SSL Socket Teardown
    # -------------------------------------------------------------
    def test_firmware_source_code_static_verification(self):
        """Inspect actual firmware files for heap diagnostics, stop() calls, and sdkconfig options"""
        main_cpp_path = r"c:\Users\andyk\Desktop\SmartNest\4layers_ESP_IDF_Firmware\main\main.cpp"
        ino_path = r"c:\Users\andyk\Desktop\SmartNest\4layers_V12_5_Firmware\4layers_V12_5_Firmware.ino"
        sdkconfig_path = r"c:\Users\andyk\Desktop\SmartNest\4layers_ESP_IDF_Firmware\sdkconfig.defaults"

        # Check sdkconfig.defaults
        with open(sdkconfig_path, "r", encoding="utf-8") as f:
            sdk_content = f.read()
        self.assertIn("CONFIG_MBEDTLS_DYNAMIC_BUFFER=y", sdk_content)
        self.assertIn("CONFIG_MBEDTLS_DYNAMIC_FREE_PEER_CERT=y", sdk_content)

        # Check main.cpp
        with open(main_cpp_path, "r", encoding="utf-8") as f:
            main_content = f.read()

        # 1. Verify espClient.stop() before client.connect() and on failure
        self.assertIn("espClient.stop();", main_content)
        
        # 2. Verify heap diagnostics logging
        self.assertIn("ESP.getFreeHeap()", main_content)
        self.assertIn("ESP.getMinFreeHeap()", main_content)
        self.assertIn("ESP.getMaxAllocHeap()", main_content)

        # 3. Verify task stacks (4096 bytes)
        self.assertIn('xTaskCreatePinnedToCore(webserver_task, "webserver_task", 4096', main_content)
        self.assertIn('xTaskCreatePinnedToCore(mqtt_task, "mqtt_task", 4096', main_content)
        self.assertIn('xTaskCreatePinnedToCore(command_worker_task, "cmd_worker", 4096', main_content)

        # 4. Verify Serial.write(payload, length) for verbatim output
        self.assertIn("Serial.write(payload, length);", main_content)

        # Check .ino
        with open(ino_path, "r", encoding="utf-8") as f:
            ino_content = f.read()
        self.assertIn("espClient.stop();", ino_content)
        self.assertIn("ESP.getFreeHeap()", ino_content)
        self.assertIn("Serial.write(payload, length);", ino_content)


    # -------------------------------------------------------------
    # OBJECTIVE 3: Core 0 Web Server Latency & Non-blocking Isolation
    # -------------------------------------------------------------
    def test_core_isolation_and_bulk_queueing(self):
        """
        Verify:
        1. Core 0 /state and /control execute in < 20ms even when Core 1 MQTT is reconnecting.
        2. Rapid channel toggles during bulk action execution are queued without drops.
        """
        system = MockDualCoreSystem()
        system.start()

        try:
            # 1. Test baseline /state latency
            state, latency_ms = system.handle_http_state()
            self.assertLess(latency_ms, 20.0)
            self.assertEqual(state["node_id"], "4L-NODE-123")
            self.assertIn("all_state", state)
            self.assertIn("relays", state)

            # 2. Trigger MQTT reconnect backoff on Core 1
            system.mqtt_reconnecting = True
            time.sleep(0.01) # Allow thread to enter reconnect loop

            # 3. Verify Core 0 /state responds under 20ms DURING MQTT reconnect backoff
            for _ in range(5):
                state, latency_ms = system.handle_http_state()
                self.assertLess(latency_ms, 20.0, f"/state latency exceeded 20ms: {latency_ms:.2f}ms")
                time.sleep(0.005)

            # 4. Trigger Bulk Master ON (takes 4 * 25ms = 100ms in simulation)
            ctrl_resp, latency_ms = system.handle_http_control(6, "ON")
            self.assertLess(latency_ms, 20.0, f"Bulk /control dispatch latency exceeded 20ms: {latency_ms:.2f}ms")
            self.assertTrue(ctrl_resp["success"])

            # 5. IMMEDIATELY fire rapid channel toggles while bulk action is running
            # In legacy firmware, these were dropped with "Bulk action already in progress! Ignoring command"
            for ch in (1, 2, 3, 4):
                resp, l_ms = system.handle_http_control(ch, "OFF")
                self.assertLess(l_ms, 20.0)
                self.assertTrue(resp["success"])

            # 6. Wait for worker task to finish queue
            time.sleep(0.3)

            # 7. Check final states: All 4 channels should end up OFF because the queued OFF commands ran after the bulk ON!
            final_state, _ = system.handle_http_state()
            self.assertEqual(final_state["relays"], [0, 0, 0, 0], "Intermediate commands during bulk were lost or not executed in order!")

        finally:
            system.stop()


if __name__ == "__main__":
    unittest.main()
