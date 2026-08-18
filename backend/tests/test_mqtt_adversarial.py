import json
import uuid
import datetime
import pytest
from backend import mqtt, models, auth


class FakeMQTTMessage:
    def __init__(self, topic: str, payload: str | bytes):
        self.topic = topic
        if isinstance(payload, str):
            self.payload = payload.encode("utf-8")
        elif isinstance(payload, bytes):
            self.payload = payload
        else:
            self.payload = json.dumps(payload).encode("utf-8")


class TestAdversarialNormalizeStatus:
    """
    Adversarial stress-testing of mqtt.normalize_status:
    Every possible input type and corner case.
    """

    @pytest.mark.parametrize("raw_input, expected", [
        # Booleans
        (True, "ON"),
        (False, "OFF"),
        # Integers & Floats
        (1, "ON"),
        (2, "ON"),
        (100, "ON"),
        (0, "OFF"),
        (-1, "OFF"),
        (-999, "OFF"),
        (1.0, "ON"),
        (0.5, "ON"),
        (0.0, "OFF"),
        (-0.5, "OFF"),
        # Positive Strings (casing, whitespace)
        ("on", "ON"),
        ("ON", "ON"),
        ("On", "ON"),
        ("  on  ", "ON"),
        ("true", "ON"),
        ("TRUE", "ON"),
        ("True", "ON"),
        ("1", "ON"),
        ("yes", "ON"),
        ("YES", "ON"),
        ("enable", "ON"),
        ("ENABLE", "ON"),
        ("enabled", "ON"),
        ("ENABLED", "ON"),
        # Negative / Falsy Strings
        ("off", "OFF"),
        ("OFF", "OFF"),
        ("false", "OFF"),
        ("FALSE", "OFF"),
        ("0", "OFF"),
        ("no", "OFF"),
        ("NO", "OFF"),
        ("disable", "OFF"),
        ("disabled", "OFF"),
        ("random_junk", "OFF"),
        ("", "OFF"),
        ("   ", "OFF"),
        # Null / None
        (None, "OFF"),
        # Collections & Unexpected Objects
        ([], "OFF"),
        ([1, 2], "OFF"),
        ({}, "OFF"),
        ({"status": "ON"}, "OFF"),
        (object(), "OFF"),
    ])
    def test_normalize_status_comprehensive(self, raw_input, expected):
        result = mqtt.normalize_status(raw_input)
        assert result == expected
        assert isinstance(result, str)
        assert result in ("ON", "OFF")


class TestAdversarialPublisher:
    """
    Adversarial tests for publish_control_message:
    - Channel parsing with various node ID structures
    - Fan speed / value propagation & type casting
    - Action commands
    - Fallback behavior
    """

    def test_multi_underscore_node_id_parsing(self, published_mqtt_messages):
        """Test node IDs with multiple underscores in base name (e.g. 4L_FLOOR_1_BEDROOM_5)."""
        mqtt.publish_control_message(
            node_id="4L_FLOOR_1_BEDROOM_5",
            state={"status": "ON", "speed": 3}
        )
        assert len(published_mqtt_messages) == 1
        msg = published_mqtt_messages[0]
        assert msg["topic"] == "home/device/4L_FLOOR_1_BEDROOM/control"
        assert msg["payload"]["channel"] == 5
        assert msg["payload"]["status"] == "ON"
        assert msg["payload"]["speed"] == 3
        assert msg["payload"]["value"] == 3

    def test_node_id_without_channel_number_suffix(self, published_mqtt_messages):
        """Test node ID without numeric suffix (e.g. 4L-NODE-MAIN)."""
        mqtt.publish_control_message(
            node_id="4L-NODE-MAIN",
            state={"status": "ON"}
        )
        assert len(published_mqtt_messages) == 1
        msg = published_mqtt_messages[0]
        assert msg["topic"] == "home/device/4L-NODE-MAIN/control"
        assert msg["payload"] == {"status": "ON"}
        assert "channel" not in msg["payload"]

    def test_string_speed_and_value_coercion_to_int(self, published_mqtt_messages):
        """Verify string speeds '3' and string values '4' are converted to integer."""
        mqtt.publish_control_message(
            node_id="4L-NODE-100_5",
            state={"status": "ON", "speed": "3"}
        )
        msg = published_mqtt_messages[-1]
        assert msg["payload"]["speed"] == 3
        assert msg["payload"]["value"] == 3
        assert isinstance(msg["payload"]["speed"], int)

        mqtt.publish_control_message(
            node_id="4L-NODE-100_5",
            state={"status": "ON", "value": "4"}
        )
        msg2 = published_mqtt_messages[-1]
        assert msg2["payload"]["speed"] == 4
        assert msg2["payload"]["value"] == 4
        assert isinstance(msg2["payload"]["speed"], int)

    def test_fan_channel_5_zero_speed_preservation(self, published_mqtt_messages):
        """Verify speed 0 is preserved and not treated as falsy/dropped."""
        mqtt.publish_control_message(
            node_id="4L-NODE-100_5",
            state={"status": "OFF", "speed": 0}
        )
        msg = published_mqtt_messages[-1]
        assert msg["payload"]["channel"] == 5
        assert msg["payload"]["status"] == "OFF"
        assert msg["payload"]["speed"] == 0
        assert msg["payload"]["value"] == 0

    def test_fan_channel_5_both_speed_and_value_precedence(self, published_mqtt_messages):
        """When both 'speed' and 'value' are present, 'speed' is prioritized for speed_val."""
        mqtt.publish_control_message(
            node_id="4L-NODE-100_5",
            state={"status": "ON", "speed": 4, "value": 2}
        )
        msg = published_mqtt_messages[-1]
        assert msg["payload"]["speed"] == 4
        assert msg["payload"]["value"] == 4

    def test_action_payload_with_complex_dict(self, published_mqtt_messages):
        """Action command with additional metadata published to stripped base topic."""
        mqtt.publish_control_message(
            node_id="4L-DEVICE-999_3",
            state={"action": "OTA_UPDATE", "firmware_url": "https://bin.smartnest.io/v2.bin", "version": "1.2.5"}
        )
        assert len(published_mqtt_messages) == 1
        msg = published_mqtt_messages[0]
        assert msg["topic"] == "home/device/4L-DEVICE-999/control"
        assert msg["payload"]["action"] == "OTA_UPDATE"
        assert msg["payload"]["firmware_url"] == "https://bin.smartnest.io/v2.bin"
        assert msg["payload"]["version"] == "1.2.5"
        assert "channel" not in msg["payload"]

    def test_channel_in_state_as_string(self, published_mqtt_messages):
        """Verify channel passed as string inside state dict is cast to int."""
        mqtt.publish_control_message(
            node_id="4L-BASE-NODE",
            state={"channel": "3", "status": "ON"}
        )
        assert len(published_mqtt_messages) == 1
        msg = published_mqtt_messages[0]
        assert msg["topic"] == "home/device/4L-BASE-NODE/control"
        assert msg["payload"]["channel"] == 3
        assert isinstance(msg["payload"]["channel"], int)


class TestAdversarialSubscriber:
    """
    Adversarial tests for on_message subscriber:
    - Malformed JSON / non-JSON payloads
    - Empty payloads
    - Non-dict JSON (lists, primitives)
    - Strange topic structures
    - Sibling node ID matching
    """

    def test_non_dict_json_payload_dropped(self, db_session, test_switchboard_devices):
        """JSON arrays or primitive values should be dropped gracefully without DB errors."""
        for bad_payload in ['[1, 2, 3]', '"just a string"', '12345', 'true', 'null']:
            msg = FakeMQTTMessage(topic="home/device/4L-NODE-TEST/status", payload=bad_payload)
            mqtt.on_message(mqtt.client, None, msg)

    def test_completely_broken_payloads(self, db_session, test_switchboard_devices):
        """Binary garbage, empty strings, and syntax errors in JSON."""
        for garbage in [b"", b"\x00\x01\x02\xff", "   ", "{\"broken\":"]:
            msg = FakeMQTTMessage(topic="home/device/4L-NODE-TEST/status", payload=garbage)
            mqtt.on_message(mqtt.client, None, msg)

    def test_unrecognized_topic_ignored(self, db_session, test_switchboard_devices):
        """Topics outside subscribed contract are safely ignored."""
        for weird_topic in [
            "home/device",
            "home/device/4L-NODE-TEST",
            "home/device/4L-NODE-TEST/unknown/sub",
            "other/device/4L-NODE-TEST/status",
        ]:
            msg = FakeMQTTMessage(topic=weird_topic, payload='{"status": "ON"}')
            mqtt.on_message(mqtt.client, None, msg)

    def test_heartbeat_with_empty_sibling_devices(self, db_session):
        """Heartbeat for an unregistered node ID executes cleanly without exception."""
        msg = FakeMQTTMessage(
            topic="home/device/4L-UNKNOWN-NODE/status",
            payload='{"status": "HEARTBEAT", "is_online": true, "local_ip": "10.0.0.1"}'
        )
        mqtt.on_message(mqtt.client, None, msg)

    def test_lwt_offline_for_unknown_node(self, db_session):
        """LWT offline for unknown device node executes cleanly without crashing."""
        msg = FakeMQTTMessage(
            topic="home/device/4L-UNKNOWN-NODE/status",
            payload='{"status": "OFFLINE"}'
        )
        mqtt.on_message(mqtt.client, None, msg)

    def test_status_update_with_channel_key_maps_to_target_channel(self, db_session, test_switchboard_devices):
        """When status message arrives on base node with 'channel' field, targets correct sibling device."""
        msg = FakeMQTTMessage(
            topic="home/device/4L-NODE-TEST/status",
            payload=json.dumps({"channel": 3, "status": "ON"})
        )
        mqtt.on_message(mqtt.client, None, msg)
        db_session.expire_all()

        dev3 = db_session.query(models.Device).filter(models.Device.node_id == "4L-NODE-TEST_3").first()
        assert dev3 is not None
        assert dev3.current_state.get("status") == "ON"
        assert dev3.is_online is True


class TestAdversarialRoutesAndSecurity:
    """
    Adversarial route tests:
    - User authorization isolation
    - Multi-node bulk control grouping
    - Voice assistant queries across multiple homes
    """

    def test_unauthorized_user_cannot_control_device(self, client, db_session, test_switchboard_devices):
        """Ensure User B cannot control User A's switchboard devices."""
        # Create second user
        user_b = models.User(
            id=uuid.uuid4(),
            username="attacker",
            email="attacker@evil.io",
            hashed_password=auth.get_password_hash("AttackerPass123!"),
            is_active=True,
            terms_accepted=True
        )
        db_session.add(user_b)
        db_session.commit()

        token_b = auth.create_access_token(data={"sub": user_b.username, "user_id": str(user_b.id)})
        headers_b = {"Authorization": f"Bearer {token_b}"}

        target_device = test_switchboard_devices[0]
        response = client.post(
            f"/api/devices/{target_device.id}/control",
            json={"state": {"status": "ON"}},
            headers=headers_b
        )
        assert response.status_code == 403

    def test_bulk_control_across_multiple_switchboards(self, client, auth_headers, test_home, test_room, db_session, published_mqtt_messages):
        """
        When bulk control selects devices across two separate switchboard boards,
        verify commands are grouped and published to their respective base node topics.
        """
        # Create second switchboard
        board2_devices = []
        for ch in range(1, 4):
            dev = models.Device(
                id=uuid.uuid4(),
                home_id=test_home.id,
                room_id=test_room.id,
                node_id=f"4L-BOARD2-TEST_{ch}",
                name=f"Board 2 Light {ch}",
                device_type="light",
                is_online=True,
                current_state={"status": "OFF"}
            )
            db_session.add(dev)
            board2_devices.append(dev)
        db_session.commit()

        selected_ids = [str(board2_devices[0].id), str(board2_devices[1].id)]
        response = client.post(
            "/api/devices/bulk-control",
            json={"device_ids": selected_ids, "state": {"status": "ON"}},
            headers=auth_headers
        )
        assert response.status_code == 200
        assert len(published_mqtt_messages) == 2
        for msg in published_mqtt_messages:
            assert msg["topic"] == "home/device/4L-BOARD2-TEST/control"
            assert msg["payload"]["status"] == "ON"
            assert msg["payload"]["channel"] in (1, 2)
