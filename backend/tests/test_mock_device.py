import pytest
from mock_device import SmartNestMockDevice


class TestMockDeviceSimulator:
    """
    Tests for mock_device.py simulator:
    - Verifies 6-channel state management
    - Verifies fan speed processing
    - Verifies master switch toggle (all channels)
    - Verifies factory reset action
    - Verifies heartbeat payload format
    """

    def test_initial_state(self):
        device = SmartNestMockDevice(node_id="4L-SIM-TEST", local_ip="192.168.1.99")
        assert device.node_id == "4L-SIM-TEST"
        assert device.local_ip == "192.168.1.99"
        for ch in range(1, 7):
            assert device.channels[ch] == "OFF"
        assert device.speed == 0

    def test_relay_toggle(self):
        device = SmartNestMockDevice()
        responses = device.process_command({"channel": 1, "status": "ON"})
        assert device.channels[1] == "ON"
        assert len(responses) == 1
        assert responses[0] == {"channel": 1, "status": "ON"}

    def test_fan_control_with_speed(self):
        device = SmartNestMockDevice()
        responses = device.process_command({"channel": 5, "status": "ON", "speed": 3})
        assert device.channels[5] == "ON"
        assert device.speed == 3
        assert len(responses) == 1
        assert responses[0]["channel"] == 5
        assert responses[0]["status"] == "ON"
        assert responses[0]["speed"] == 3
        assert responses[0]["value"] == 3

    def test_fan_turn_off_resets_speed(self):
        device = SmartNestMockDevice()
        device.process_command({"channel": 5, "status": "ON", "speed": 4})
        responses = device.process_command({"channel": 5, "status": "OFF"})
        assert device.channels[5] == "OFF"
        assert device.speed == 0
        assert responses[0]["status"] == "OFF"
        assert responses[0]["speed"] == 0

    def test_master_switch_on_and_off(self):
        device = SmartNestMockDevice()
        
        # Turn Master ON
        responses = device.process_command({"channel": 6, "status": "ON"})
        for ch in range(1, 7):
            assert device.channels[ch] == "ON"
        assert device.speed == 3  # Fan initialized to default running speed

        # Turn Master OFF
        responses = device.process_command({"channel": 6, "status": "OFF"})
        for ch in range(1, 7):
            assert device.channels[ch] == "OFF"
        assert device.speed == 0

    def test_factory_reset_action(self):
        device = SmartNestMockDevice()
        device.process_command({"channel": 1, "status": "ON"})
        device.process_command({"channel": 5, "status": "ON", "speed": 2})
        
        responses = device.process_command({"action": "factory_reset"})
        for ch in range(1, 7):
            assert device.channels[ch] == "OFF"
        assert device.speed == 0
        assert len(responses) == 1
        assert responses[0]["status"] == "RESET_COMPLETE"

    def test_heartbeat_payload_schema(self):
        device = SmartNestMockDevice(node_id="4L-SIM-999", local_ip="192.168.1.55")
        device.process_command({"channel": 2, "status": "ON"})
        device.process_command({"channel": 5, "status": "ON", "speed": 2})

        payload = device.get_heartbeat_payload()
        assert payload["node_id"] == "4L-SIM-999"
        assert payload["status"] == "HEARTBEAT"
        assert payload["is_online"] is True
        assert payload["local_ip"] == "192.168.1.55"
        assert payload["channel_2"] == "ON"
        assert payload["channel_5"] == "ON"
        assert payload["speed"] == 2
        assert "free_heap" in payload
