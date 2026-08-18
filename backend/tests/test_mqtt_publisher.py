import pytest
import json
from backend import mqtt


class TestMQTTPublisher:
    """
    Tests for backend/mqtt.py publish_control_message:
    - Verifies JSON schema adherence: {"channel": <int>, "status": "ON"|"OFF", ...}
    - Verifies status normalization (boolean, casing, integer, state vs status)
    - Verifies Channel 5 fan speed payload propagation (both 'speed' and 'value')
    - Verifies Channel 6 Master Switch payload
    - Verifies Action commands (e.g. factory_reset)
    """

    def test_publish_relay_channels_1_to_4(self, published_mqtt_messages):
        for ch in range(1, 5):
            mqtt.publish_control_message(
                node_id=f"4L-NODE-123456_{ch}",
                state={"status": "ON"}
            )
            assert len(published_mqtt_messages) == ch
            last_msg = published_mqtt_messages[-1]
            assert last_msg["topic"] == "home/device/4L-NODE-123456/control"
            assert last_msg["payload"] == {
                "channel": ch,
                "status": "ON"
            }
            # Verify raw JSON string types
            parsed_raw = json.loads(last_msg["raw_payload"])
            assert isinstance(parsed_raw["channel"], int)
            assert parsed_raw["status"] == "ON"

    @pytest.mark.parametrize("input_status, expected_status", [
        (True, "ON"),
        (False, "OFF"),
        ("on", "ON"),
        ("off", "OFF"),
        ("ON", "ON"),
        ("OFF", "OFF"),
        (1, "ON"),
        (0, "OFF"),
        ("true", "ON"),
        ("false", "OFF"),
        ("enabled", "ON"),
        (None, "OFF"),
    ])
    def test_status_normalization(self, published_mqtt_messages, input_status, expected_status):
        mqtt.publish_control_message(
            node_id="4L-NODE-TEST_1",
            state={"status": input_status}
        )
        assert len(published_mqtt_messages) == 1
        msg = published_mqtt_messages[0]
        assert msg["payload"]["channel"] == 1
        assert msg["payload"]["status"] == expected_status
        assert isinstance(msg["payload"]["status"], str)

    def test_state_key_fallback_normalization(self, published_mqtt_messages):
        """Verify that when 'state' key is provided instead of 'status', it normalizes to 'status'."""
        mqtt.publish_control_message(
            node_id="4L-NODE-TEST_2",
            state={"state": "on"}
        )
        assert len(published_mqtt_messages) == 1
        msg = published_mqtt_messages[0]
        assert msg["payload"] == {
            "channel": 2,
            "status": "ON"
        }

    def test_fan_channel_5_speed_propagation_with_value(self, published_mqtt_messages):
        """
        When channel 5 control message is published with 'value',
        verify 'speed' is populated alongside 'value' for ESP32 firmware compatibility.
        """
        mqtt.publish_control_message(
            node_id="4L-NODE-TEST_5",
            state={"status": "ON", "value": 3}
        )
        assert len(published_mqtt_messages) == 1
        msg = published_mqtt_messages[0]
        assert msg["topic"] == "home/device/4L-NODE-TEST/control"
        assert msg["payload"]["channel"] == 5
        assert msg["payload"]["status"] == "ON"
        assert msg["payload"]["speed"] == 3
        assert msg["payload"]["value"] == 3

    def test_fan_channel_5_speed_propagation_with_speed(self, published_mqtt_messages):
        """
        When channel 5 control message is published with 'speed',
        verify 'speed' is preserved and 'value' is populated.
        """
        mqtt.publish_control_message(
            node_id="4L-NODE-TEST_5",
            state={"status": "ON", "speed": 4}
        )
        assert len(published_mqtt_messages) == 1
        msg = published_mqtt_messages[0]
        assert msg["payload"]["channel"] == 5
        assert msg["payload"]["status"] == "ON"
        assert msg["payload"]["speed"] == 4
        assert msg["payload"]["value"] == 4

    def test_fan_channel_5_off_speed_zero(self, published_mqtt_messages):
        mqtt.publish_control_message(
            node_id="4L-NODE-TEST_5",
            state={"status": "OFF", "value": 0}
        )
        assert len(published_mqtt_messages) == 1
        msg = published_mqtt_messages[0]
        assert msg["payload"]["channel"] == 5
        assert msg["payload"]["status"] == "OFF"
        assert msg["payload"]["speed"] == 0
        assert msg["payload"]["value"] == 0

    def test_channel_in_state_dict_direct_call(self, published_mqtt_messages):
        """
        When called on base node ID with channel specified in state dict.
        """
        mqtt.publish_control_message(
            node_id="4L-NODE-TEST",
            state={"channel": 5, "status": "ON", "speed": 2}
        )
        assert len(published_mqtt_messages) == 1
        msg = published_mqtt_messages[0]
        assert msg["topic"] == "home/device/4L-NODE-TEST/control"
        assert msg["payload"]["channel"] == 5
        assert msg["payload"]["status"] == "ON"
        assert msg["payload"]["speed"] == 2
        assert msg["payload"]["value"] == 2

    def test_master_switch_channel_6(self, published_mqtt_messages):
        mqtt.publish_control_message(
            node_id="4L-NODE-TEST_6",
            state={"status": "OFF"}
        )
        assert len(published_mqtt_messages) == 1
        msg = published_mqtt_messages[0]
        assert msg["topic"] == "home/device/4L-NODE-TEST/control"
        assert msg["payload"] == {
            "channel": 6,
            "status": "OFF"
        }

    def test_action_command_factory_reset(self, published_mqtt_messages):
        """Verify factory_reset action stripped of channel suffix and published as-is."""
        mqtt.publish_control_message(
            node_id="4L-NODE-TEST_1",
            state={"action": "factory_reset"}
        )
        assert len(published_mqtt_messages) == 1
        msg = published_mqtt_messages[0]
        assert msg["topic"] == "home/device/4L-NODE-TEST/control"
        assert msg["payload"] == {"action": "factory_reset"}
