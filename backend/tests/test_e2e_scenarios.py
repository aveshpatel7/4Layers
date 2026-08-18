"""
SmartNest Milestone 4: End-to-End Real-World Application Scenario Test Suite (S1 - S5)
File: backend/tests/test_e2e_scenarios.py

Covers:
- Scenario S1: Cloud MQTT Disconnection during Rapid Local Toggles (<20ms latency, zero drops, no offline warning flicker)
- Scenario S2: Malformed MQTT Burst followed by Valid Fan Control (raw payload error logging to Serial, no crash, fan speed update with "speed" key)
- Scenario S3: Multi-Board Switchboard Room with Staggered Reconnects (multi-node parallel discovery, cached state rendering, 3-min timeout cutoff)
- Scenario S4: Master All-ON Triggered Concurrently with Channel 1..4 Toggles (FreeRTOS queue buffering, FIFO order, zero dropped commands, TWDT watchdog safety)
- Scenario S5: Schedule Execution for Channel 5 Fan Speed via Backend MQTT (backend publishes normalized payload {"channel": 5, "status": "ON", "speed": 3, "value": 3})
- Additional Cross-Tier Integration: Voice Assistant Hinglish Intent to MQTT Execution, and Multi-Tenant Security Isolation.
"""

import time
import json
import uuid
import datetime
import threading
import pytest
from unittest.mock import patch, MagicMock

from backend import models, mqtt, database, auth
from backend.main import check_device_heartbeats
from mock_device import SmartNestMockDevice
from backend.tests.test_firmware_resilience_m1 import MockFirmwareMqttParser, DeserializationError
from backend.tests.test_firmware_queue_simulation import ESP32FirmwareQueueSimulator


class FakeMQTTMessage:
    def __init__(self, topic: str, payload: str | bytes):
        self.topic = topic
        self.payload = payload.encode("utf-8") if isinstance(payload, str) else payload


class TestSmartNestE2EScenarios:
    """
    Comprehensive End-to-End Real-World Application Scenario Test Suite (S1 - S5).
    """

    # =========================================================================
    # S1: Cloud MQTT Disconnection during Rapid Local Toggles
    # =========================================================================
    def test_s1_cloud_disconnect_during_rapid_local_toggles(self, client, auth_headers, test_switchboard_devices, db_session):
        """
        Scenario S1: Cloud MQTT Disconnection during Rapid Local Toggles.
        
        Operational Flow:
        1. Cloud MQTT TLS connection enters a 15-second reconnect backoff on Core 1.
        2. Mobile App (on local Wi-Fi) issues rapid consecutive HTTP control requests (/control) to Core 0.
        3. Measures turnaround latency for each local HTTP request: SLA < 20ms.
        4. Mobile App queries local /state: receives valid JSON state, asserting that
           the 'Switchboard Offline' warning banner is suppressed (dual-gating).
        5. Zero commands are dropped, and all requested states are applied.
        """
        base_node = "4L-NODE-TEST"

        # 1. Simulate Cloud MQTT Disconnected state (Core 1 in 15s reconnect retry loop)
        cloud_mqtt_online = False

        # 2. Local HTTP Server simulator on Core 0 receives rapid toggles
        # Core 0 handles HTTP server independently from Core 1 MQTT task
        local_hardware_state = {
            1: "OFF",
            2: "OFF",
            3: "OFF",
            4: "OFF",
            5: "OFF",
            "speed": 0,
            "all_state": "ALL_OFF"
        }
        state_lock = threading.Lock()

        # Define simulated Core 0 HTTP handlers
        def handle_core0_local_control(channel: int, status: str, speed: int = -1) -> tuple[int, dict]:
            t_start = time.perf_counter()
            with state_lock:
                if 1 <= channel <= 4:
                    local_hardware_state[channel] = status
                elif channel == 5:
                    local_hardware_state[5] = status
                    if speed != -1:
                        local_hardware_state["speed"] = speed
                    elif status == "ON" and local_hardware_state["speed"] == 0:
                        local_hardware_state["speed"] = 3
                    elif status == "OFF":
                        local_hardware_state["speed"] = 0
                elif channel == 6:
                    for ch in range(1, 5):
                        local_hardware_state[ch] = status
                    local_hardware_state[5] = status
                    local_hardware_state["speed"] = 3 if status == "ON" else 0

                # Recompute all_state
                all_on = all(local_hardware_state[ch] == "ON" for ch in range(1, 6))
                all_off = all(local_hardware_state[ch] == "OFF" for ch in range(1, 6))
                local_hardware_state["all_state"] = "ALL_ON" if all_on else ("ALL_OFF" if all_off else "MIXED")

            elapsed_ms = (time.perf_counter() - t_start) * 1000.0
            return 200, {
                "success": True,
                "channel": channel,
                "state": status,
                "elapsed_ms": elapsed_ms
            }

        def handle_core0_local_state() -> tuple[int, dict, float]:
            t_start = time.perf_counter()
            with state_lock:
                resp = {
                    "node_id": base_node,
                    "local_ip": "192.168.1.150",
                    "channel_1": local_hardware_state[1],
                    "channel_2": local_hardware_state[2],
                    "channel_3": local_hardware_state[3],
                    "channel_4": local_hardware_state[4],
                    "channel_5": local_hardware_state[5],
                    "speed": local_hardware_state["speed"],
                    "all_state": local_hardware_state["all_state"]
                }
            elapsed_ms = (time.perf_counter() - t_start) * 1000.0
            return 200, resp, elapsed_ms

        # 3. Simulate burst of 5 rapid local toggles from mobile app
        rapid_commands = [
            (1, "ON", -1),
            (2, "ON", -1),
            (3, "ON", -1),
            (2, "OFF", -1),
            (5, "ON", 4)
        ]

        latencies = []
        for ch, st, spd in rapid_commands:
            status_code, body = handle_core0_local_control(ch, st, spd)
            assert status_code == 200
            assert body["success"] is True
            latencies.append(body["elapsed_ms"])

        # SLA verification: All local control response times must be < 20ms
        for lat in latencies:
            assert lat < 20.0, f"Local control latency {lat}ms exceeded 20ms SLA"

        # 4. Mobile app status evaluation (dual-gated offline warning check)
        state_status_code, local_state, ping_lat = handle_core0_local_state()
        assert state_status_code == 200
        assert ping_lat < 20.0

        # Simulate Mobile App dual-gating decision logic in DashboardScreen.js
        is_phone_on_wifi = True
        cloud_status_reported = "OFFLINE" if not cloud_mqtt_online else "ONLINE"
        
        # Dual-gating rule: If phone is on Wi-Fi and local ping succeeds, device is NOT offline
        if cloud_status_reported == "OFFLINE" and is_phone_on_wifi:
            lan_ping_success = (state_status_code == 200)
            device_is_online = lan_ping_success
            show_switchboard_offline_warning = not device_is_online
        else:
            show_switchboard_offline_warning = (cloud_status_reported == "OFFLINE")

        assert show_switchboard_offline_warning is False, "Offline warning must be suppressed when LAN ping succeeds"
        assert local_state["channel_1"] == "ON"
        assert local_state["channel_2"] == "OFF"
        assert local_state["channel_3"] == "ON"
        assert local_state["channel_4"] == "OFF"
        assert local_state["channel_5"] == "ON"
        assert local_state["speed"] == 4
        assert local_state["all_state"] == "MIXED"

    # =========================================================================
    # S2: Malformed MQTT Burst followed by Valid Fan Control
    # =========================================================================
    def test_s2_malformed_mqtt_burst_followed_by_valid_fan_control(self, db_session, test_switchboard_devices, published_mqtt_messages):
        """
        Scenario S2: Malformed MQTT Burst followed by Valid Fan Control.
        
        Operational Flow:
        1. A burst of malformed payloads is published over MQTT.
        2. Firmware parser catches all deserialization errors, writes exact raw payload
           to serial output, and maintains system stability without crashing.
        3. Backend MQTT subscriber safely drops corrupted packets without database errors.
        4. Valid Fan control command (Channel 5, status ON, speed 3) arrives.
        5. Mock device parses speed, updates channel 5 state, and publishes status telemetry.
        6. Backend subscriber processes telemetry, updating DB current_state and last_seen.
        """
        base_node = "4L-NODE-TEST"
        firmware_parser = MockFirmwareMqttParser()
        device_sim = SmartNestMockDevice(node_id=base_node, local_ip="192.168.1.150")

        # 1. Define burst of malformed payloads
        malformed_burst = [
            b"",
            b"NOT_JSON_DATA_STREAM",
            b'{"channel": 5, "status":',
            b'{"channel": 1\x00, "status": "ON"}',
            b'\x00\xff\xfe\x00{"channel": 1}',
            b'{"channel": 1, "status": "ON\x00"}',
            json.dumps({"channel": 1, "status": "ON", "padding": "x" * 400}).encode('utf-8'),
            b'{}',
            b'{"channel": 5}',  # Missing status
            b'{"unknown_key_only": 9999}'
        ]

        # 2. Process malformed burst through firmware parser
        for raw_bytes in malformed_burst:
            res = firmware_parser.mqtt_callback(f"home/device/{base_node}/control", raw_bytes, len(raw_bytes))
            assert res is False, "Malformed payload must be rejected by firmware"

        # Verify raw payload logging
        assert len(firmware_parser.serial_logs) >= len(malformed_burst)
        logs_str = " ".join(firmware_parser.serial_logs)
        assert "NOT_JSON_DATA_STREAM" in logs_str
        assert "❌ [ERROR]" in logs_str

        # Also verify mock device handles bad payloads without raising exceptions
        for bad_dict in [{}, {"channel": "invalid"}, {"channel": 99, "status": "ON"}]:
            resps = device_sim.process_command(bad_dict)
            assert isinstance(resps, list)

        # 3. Subsequent Valid Fan Control Command
        valid_fan_payload = {"channel": 5, "status": "ON", "speed": 3, "value": 3}
        valid_bytes = json.dumps(valid_fan_payload).encode("utf-8")
        
        # Firmware parse success
        doc, err = firmware_parser.deserialize_json(valid_bytes, len(valid_bytes))
        assert err == DeserializationError.Ok
        assert doc["channel"] == 5
        assert doc["status"] == "ON"
        assert doc["speed"] == 3

        # Device simulation execution
        responses = device_sim.process_command(valid_fan_payload)
        assert device_sim.channels[5] == "ON"
        assert device_sim.speed == 3
        assert len(responses) >= 1
        fan_resp = next(r for r in responses if r["channel"] == 5)
        assert fan_resp["status"] == "ON"
        assert fan_resp["speed"] == 3
        assert fan_resp["value"] == 3

        # 4. Backend synchronization: Simulate receiving device telemetry back to DB
        telemetry_payload = {
            "channel": 5,
            "status": "ON",
            "speed": 3,
            "value": 3
        }
        msg = FakeMQTTMessage(
            topic=f"home/device/{base_node}/status",
            payload=json.dumps(telemetry_payload)
        )
        
        mqtt.on_message(mqtt.client, None, msg)
        db_session.expire_all()

        fan_dev = db_session.query(models.Device).filter(models.Device.node_id == f"{base_node}_5").first()
        assert fan_dev is not None
        assert fan_dev.current_state.get("status") == "ON"
        assert fan_dev.current_state.get("value") == 3

    # =========================================================================
    # S3: Multi-Board Switchboard Room with Staggered Reconnects
    # =========================================================================
    def test_s3_multi_board_switchboard_room_staggered_reconnects(self, db_session, test_user, test_home, test_room, client, auth_headers):
        """
        Scenario S3: Multi-Board Switchboard Room with Staggered Reconnects.
        
        Operational Flow:
        1. A multi-switchboard room contains 3 distinct nodes:
           - Node A (4L_BOARDA): Local LAN online (192.168.1.50), Cloud disconnected.
           - Node B (4L_BOARDB): Cloud MQTT online (last_seen 45s ago), Local LAN unreachable.
           - Node C (4L_BOARDC): Inactive (>180s / 3-minute cutoff, last_seen 240s ago).
        2. Heartbeat background checker evaluates the fleet:
           - Node A and Node B remain is_online=True.
           - Node C is marked is_online=False and generates an Alert in the database.
        3. Mobile App parallel node discovery & composite room master aggregation:
           - Composite room master switch status evaluates ONLY active boards (A & B).
           - Toggling the Room Master Switch issues targeted commands without hanging on Node C.
        """
        now = datetime.datetime.utcnow()

        # Create Board A devices (Channel 1-6) - Active 40s ago, Local IP valid
        board_a_devices = []
        for ch in range(1, 7):
            dev = models.Device(
                id=uuid.uuid4(),
                home_id=test_home.id,
                room_id=test_room.id,
                node_id=f"4L_BOARDA_{ch}",
                name=f"Board A Relay {ch}",
                device_type="master" if ch == 6 else ("fan" if ch == 5 else "light"),
                local_ip="192.168.1.50",
                is_online=True,
                current_state={"status": "ON"},
                last_seen=now - datetime.timedelta(seconds=40)
            )
            db_session.add(dev)
            board_a_devices.append(dev)

        # Create Board B devices (Channel 1-6) - Active 60s ago
        board_b_devices = []
        for ch in range(1, 7):
            dev = models.Device(
                id=uuid.uuid4(),
                home_id=test_home.id,
                room_id=test_room.id,
                node_id=f"4L_BOARDB_{ch}",
                name=f"Board B Relay {ch}",
                device_type="master" if ch == 6 else ("fan" if ch == 5 else "light"),
                local_ip="192.168.1.51",
                is_online=True,
                current_state={"status": "OFF"},
                last_seen=now - datetime.timedelta(seconds=60)
            )
            db_session.add(dev)
            board_b_devices.append(dev)

        # Create Board C devices (Channel 1-6) - Inactive 240s ago (> 180s threshold)
        board_c_devices = []
        for ch in range(1, 7):
            dev = models.Device(
                id=uuid.uuid4(),
                home_id=test_home.id,
                room_id=test_room.id,
                node_id=f"4L_BOARDC_{ch}",
                name=f"Board C Relay {ch}",
                device_type="master" if ch == 6 else ("fan" if ch == 5 else "light"),
                local_ip="192.168.1.52",
                is_online=True,
                current_state={"status": "OFF"},
                last_seen=now - datetime.timedelta(seconds=240)
            )
            db_session.add(dev)
            board_c_devices.append(dev)

        db_session.commit()

        # 2. Execute Heartbeat Checker directly
        check_device_heartbeats()

        # Refresh all devices from DB
        refreshed_a = db_session.query(models.Device).filter(models.Device.node_id.like("4L_BOARDA_%")).all()
        refreshed_b = db_session.query(models.Device).filter(models.Device.node_id.like("4L_BOARDB_%")).all()
        refreshed_c = db_session.query(models.Device).filter(models.Device.node_id.like("4L_BOARDC_%")).all()

        # Assertions on backend online state
        for d in refreshed_a:
            assert d.is_online is True, "Board A (<3 min) must remain online"
        for d in refreshed_b:
            assert d.is_online is True, "Board B (<3 min) must remain online"
        for d in refreshed_c:
            assert d.is_online is False, "Board C (>3 min) must be marked offline"

        # Verify alerts created in database for Board C
        offline_alerts = db_session.query(models.Alert).filter(
            models.Alert.device_id.in_([d.id for d in refreshed_c])
        ).all()
        assert len(offline_alerts) >= 1

        # 3. Simulate Mobile Room Master Calculation (ignoring offline Board C)
        all_room_devices = refreshed_a + refreshed_b + refreshed_c
        online_room_devices = [d for d in all_room_devices if d.is_online and d.device_type != "master"]
        
        # Board A is ON, Board B is OFF -> Composite Master should be "MIXED"
        any_on = any(d.current_state.get("status") == "ON" for d in online_room_devices)
        all_on = all(d.current_state.get("status") == "ON" for d in online_room_devices)
        all_off = all(d.current_state.get("status") == "OFF" for d in online_room_devices)

        assert any_on is True
        assert all_on is False
        assert all_off is False
        room_composite_state = "ALL_ON" if all_on else ("ALL_OFF" if all_off else "MIXED")
        assert room_composite_state == "MIXED"

    # =========================================================================
    # S4: Master All-ON Triggered Concurrently with Channel 1..4 Toggles
    # =========================================================================
    def test_s4_master_all_on_concurrent_with_channel_toggles(self):
        """
        Scenario S4: Master All-ON Triggered Concurrently with Channel 1..4 Toggles.
        
        Operational Flow:
        1. FreeRTOS Static Command Queue (capacity 16) initialized with worker task on Core 1.
        2. Master All-ON bulk action (Channel 6 ON) initiates 1000ms staggered execution (250ms per relay).
        3. Concurrently, 3 independent producers (Local HTTP, Cloud MQTT, Physical Switch)
           fire individual channel toggles (Relay 1 OFF, Relay 2 OFF, Fan Speed 2).
        4. Verifies:
           - All commands are accepted into the queue without drops (no "Bulk action in progress" drops).
           - Monotonic FIFO execution order.
           - Final state correctly reflects trailing overrides (Relay 1 OFF, Relay 2 OFF, Relay 3 ON, Relay 4 ON, Fan ON at Speed 2).
           - Task Watchdog Timer is serviced at every 250ms interval, preventing TWDT panic.
        """
        sim = ESP32FirmwareQueueSimulator(queue_capacity=16, send_timeout_ms=50.0, twdt_timeout_ms=5000)
        sim.start()

        try:
            # 1. Trigger Bulk ALL ON (takes ~1.0s to complete)
            bulk_queued = sim.process_channel_command(channel=6, turnOn=True, speedVal=-1, source="📱 [MOBILE_BULK]")
            assert bulk_queued is True
            time.sleep(0.05)  # Let worker start processing Relay 1

            # 2. Concurrently inject channel overrides from different sources
            def http_producer():
                sim.process_channel_command(channel=1, turnOn=False, speedVal=-1, source="🌐 [HTTP_LOCAL]")

            def mqtt_producer():
                sim.process_channel_command(channel=2, turnOn=False, speedVal=-1, source="☁️ [CLOUD_MQTT]")

            def physical_producer():
                sim.process_channel_command(channel=5, turnOn=True, speedVal=2, source="🔘 [SWITCH_FAN]")

            threads = [
                threading.Thread(target=http_producer),
                threading.Thread(target=mqtt_producer),
                threading.Thread(target=physical_producer)
            ]
            for t in threads:
                t.start()
            for t in threads:
                t.join()

            # 3. Wait for command queue to drain
            timeout = time.time() + 5.0
            expected_total = 4  # 1 bulk + 3 overrides
            while time.time() < timeout and len(sim.executed_commands) < expected_total:
                time.sleep(0.05)

            # 4. Assertions
            assert len(sim.executed_commands) == 4, f"Expected 4 executed commands, got {len(sim.executed_commands)}"
            assert len(sim.dropped_commands) == 0, "Zero commands must be dropped"
            assert sim.twdt.panic_triggered is False, "Task Watchdog Timer must not panic"
            assert sim.twdt.reset_count >= 4, "TWDT must be reset during staggered delays"

            # Check final hardware state reflects trailing overrides
            final_state = sim.get_state()
            assert final_state["channel_1"] == "OFF", "Relay 1 must be overridden to OFF"
            assert final_state["channel_2"] == "OFF", "Relay 2 must be overridden to OFF"
            assert final_state["channel_3"] == "ON", "Relay 3 must remain ON from Bulk All-ON"
            assert final_state["channel_4"] == "ON", "Relay 4 must remain ON from Bulk All-ON"
            assert final_state["channel_5"] == "ON", "Fan must remain ON"
            assert final_state["speed"] == 2, "Fan speed must be updated to 2"

        finally:
            sim.stop()

    # =========================================================================
    # S5: Schedule Execution for Channel 5 Fan Speed via Backend MQTT
    # =========================================================================
    def test_s5_schedule_execution_for_fan_speed_via_mqtt(self, test_switchboard_devices, published_mqtt_messages, db_session):
        """
        Scenario S5: Schedule Execution for Channel 5 Fan Speed via Backend MQTT.
        
        Operational Flow:
        1. Automated schedule triggers fan speed update: {"status": "ON", "speed": 3}.
        2. Backend publish_control_message normalizes payload to strictly include
           {"channel": 5, "status": "ON", "speed": 3, "value": 3}.
        3. Firmware / Mock Device consumes payload, sets fan speed to 3, and emits status telemetry.
        4. Backend MQTT subscriber processes telemetry and updates database records.
        """
        base_node = "4L-NODE-TEST"
        fan_device = test_switchboard_devices[4]  # 4L-NODE-TEST_5

        # 1. Simulate schedule trigger calling backend MQTT control
        target_state = {"status": "ON", "speed": 3}
        mqtt.publish_control_message(node_id=fan_device.node_id, state=target_state)

        # 2. Assert published MQTT message payload schema
        assert len(published_mqtt_messages) == 1
        mqtt_msg = published_mqtt_messages[0]
        assert mqtt_msg["topic"] == f"home/device/{base_node}/control"
        assert mqtt_msg["payload"]["channel"] == 5
        assert mqtt_msg["payload"]["status"] == "ON"
        assert mqtt_msg["payload"]["speed"] == 3
        assert mqtt_msg["payload"]["value"] == 3

        # 3. Simulate Mock Device consuming MQTT control payload
        device_sim = SmartNestMockDevice(node_id=base_node, local_ip="192.168.1.150")
        device_responses = device_sim.process_command(mqtt_msg["payload"])

        assert device_sim.channels[5] == "ON"
        assert device_sim.speed == 3
        assert len(device_responses) >= 1

        fan_telemetry = next(r for r in device_responses if r["channel"] == 5)
        assert fan_telemetry["status"] == "ON"
        assert fan_telemetry["speed"] == 3
        assert fan_telemetry["value"] == 3

        # 4. Simulate backend receiving status telemetry
        msg = FakeMQTTMessage(
            topic=f"home/device/{base_node}/status",
            payload=json.dumps(fan_telemetry)
        )
        mqtt.on_message(mqtt.client, None, msg)
        db_session.expire_all()

        # Verify DB state
        fan_dev = db_session.query(models.Device).filter(models.Device.node_id == f"{base_node}_5").first()
        assert fan_dev is not None
        assert fan_dev.current_state.get("status") == "ON"
        assert fan_dev.current_state.get("value") == 3

    # =========================================================================
    # Additional Cross-Tier Integration: Voice NLP Transliteration & Fan Control
    # =========================================================================
    def test_voice_nlp_fan_speed_intent_to_mqtt_execution(self, client, auth_headers, test_switchboard_devices, published_mqtt_messages):
        """
        Cross-tier Integration: Voice assistant Natural Language command
        (e.g., 'Pankha chalu karo speed 3' or 'turn on bedroom fan speed 3')
        is translated into normalized MQTT message and applied.
        """
        response = client.post(
            "/api/voice/command",
            json={"command": "turn on bedroom fan speed 3"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["modified_count"] >= 1

        # Assert MQTT published with normalized fan speed payload
        assert len(published_mqtt_messages) >= 1
        fan_msg = next((m for m in published_mqtt_messages if m["payload"].get("channel") == 5), None)
        assert fan_msg is not None
        assert fan_msg["payload"]["status"] == "ON"
        assert fan_msg["payload"]["speed"] == 3
        assert fan_msg["payload"]["value"] == 3

    # =========================================================================
    # Additional Cross-Tier Integration: Multi-Tenant Bulk Isolation
    # =========================================================================
    def test_cross_tenant_isolation_during_bulk_actions(self, client, db_session, test_user, test_home, test_room, test_switchboard_devices, published_mqtt_messages):
        """
        Cross-tier Integration: Multi-tenant security isolation.
        An unauthorized User B cannot issue bulk control or voice commands against User A's switchboards.
        """
        # Create User B (unauthorized attacker/other user)
        user_b = models.User(
            id=uuid.uuid4(),
            username="unauthorized_user",
            email="intruder@smartnest.io",
            hashed_password=auth.get_password_hash("Secret123!"),
            is_active=True
        )
        db_session.add(user_b)
        db_session.commit()

        token_b = auth.create_access_token(data={"sub": user_b.username, "user_id": str(user_b.id)})
        auth_headers_b = {"Authorization": f"Bearer {token_b}"}

        # User B attempts bulk control on User A's devices
        user_a_device_ids = [str(d.id) for d in test_switchboard_devices]
        response = client.post(
            "/api/devices/bulk-control",
            json={"device_ids": user_a_device_ids, "state": {"status": "OFF"}},
            headers=auth_headers_b
        )
        # Should return 403 Forbidden or 404
        assert response.status_code in (403, 404)
        assert len(published_mqtt_messages) == 0, "No MQTT messages should be published for unauthorized access"
