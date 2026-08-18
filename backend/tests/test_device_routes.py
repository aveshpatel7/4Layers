import uuid
import pytest
from backend import models


class TestDeviceRoutes:
    """
    Tests for backend REST routes:
    - /api/devices/{id}/control
    - /api/devices/bulk-control
    - /api/voice/command
    """

    def test_single_relay_control(self, client, auth_headers, test_switchboard_devices, published_mqtt_messages, db_session):
        relay_device = test_switchboard_devices[0]  # Channel 1: 4L-NODE-TEST_1

        response = client.post(
            f"/api/devices/{relay_device.id}/control",
            json={"state": {"status": "ON"}},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["device_id"] == str(relay_device.id)
        assert data["requested_state"] == {"status": "ON"}

        # Verify MQTT published
        assert len(published_mqtt_messages) == 1
        msg = published_mqtt_messages[0]
        assert msg["topic"] == "home/device/4L-NODE-TEST/control"
        assert msg["payload"] == {"channel": 1, "status": "ON"}

        # Verify DB updated
        db_session.refresh(relay_device)
        assert relay_device.current_state.get("status") == "ON"

    def test_fan_control_with_value(self, client, auth_headers, test_switchboard_devices, published_mqtt_messages):
        fan_device = test_switchboard_devices[4]  # Channel 5: 4L-NODE-TEST_5

        response = client.post(
            f"/api/devices/{fan_device.id}/control",
            json={"state": {"status": "ON", "value": 3}},
            headers=auth_headers
        )
        assert response.status_code == 200

        # Verify MQTT payload contains speed
        assert len(published_mqtt_messages) == 1
        msg = published_mqtt_messages[0]
        assert msg["topic"] == "home/device/4L-NODE-TEST/control"
        assert msg["payload"]["channel"] == 5
        assert msg["payload"]["status"] == "ON"
        assert msg["payload"]["speed"] == 3
        assert msg["payload"]["value"] == 3

    def test_fan_control_with_speed(self, client, auth_headers, test_switchboard_devices, published_mqtt_messages):
        fan_device = test_switchboard_devices[4]  # Channel 5: 4L-NODE-TEST_5

        response = client.post(
            f"/api/devices/{fan_device.id}/control",
            json={"state": {"status": "ON", "speed": 4}},
            headers=auth_headers
        )
        assert response.status_code == 200

        # Verify MQTT payload contains speed & value
        assert len(published_mqtt_messages) == 1
        msg = published_mqtt_messages[0]
        assert msg["payload"]["channel"] == 5
        assert msg["payload"]["status"] == "ON"
        assert msg["payload"]["speed"] == 4
        assert msg["payload"]["value"] == 4

    def test_control_boolean_status_normalization(self, client, auth_headers, test_switchboard_devices, published_mqtt_messages):
        relay_device = test_switchboard_devices[1]  # Channel 2

        response = client.post(
            f"/api/devices/{relay_device.id}/control",
            json={"state": {"status": True}},
            headers=auth_headers
        )
        assert response.status_code == 200
        assert len(published_mqtt_messages) == 1
        assert published_mqtt_messages[0]["payload"]["status"] == "ON"

    def test_bulk_control_with_master_switch(self, client, auth_headers, test_switchboard_devices, published_mqtt_messages):
        """
        When all devices including channel 6 (master) are selected in bulk control,
        it should send a single optimized command for channel 6.
        """
        all_ids = [str(dev.id) for dev in test_switchboard_devices]

        response = client.post(
            "/api/devices/bulk-control",
            json={"device_ids": all_ids, "state": {"status": "ON"}},
            headers=auth_headers
        )
        assert response.status_code == 200

        # Should only publish 1 optimized command to master switch channel 6
        assert len(published_mqtt_messages) == 1
        msg = published_mqtt_messages[0]
        assert msg["topic"] == "home/device/4L-NODE-TEST/control"
        assert msg["payload"] == {"channel": 6, "status": "ON"}

    def test_bulk_control_individual_channels(self, client, auth_headers, test_switchboard_devices, published_mqtt_messages):
        """
        When specific channels (e.g. 1, 2, 5) without master (channel 6) are controlled in bulk,
        it should publish separate channel messages including speed for fan.
        """
        selected_devices = [test_switchboard_devices[0], test_switchboard_devices[1], test_switchboard_devices[4]]
        device_ids = [str(dev.id) for dev in selected_devices]

        response = client.post(
            "/api/devices/bulk-control",
            json={"device_ids": device_ids, "state": {"status": "ON", "value": 3}},
            headers=auth_headers
        )
        assert response.status_code == 200
        assert len(published_mqtt_messages) == 3

        channels_published = {msg["payload"]["channel"]: msg["payload"] for msg in published_mqtt_messages}
        assert 1 in channels_published
        assert 2 in channels_published
        assert 5 in channels_published

        assert channels_published[1]["status"] == "ON"
        assert channels_published[5]["status"] == "ON"
        assert channels_published[5]["speed"] == 3

    def test_voice_assistant_command_execution(self, client, auth_headers, test_switchboard_devices, published_mqtt_messages):
        """
        Test in-app natural voice command parser (/api/voice/command).
        Ensures line 716 query join on models.Home works without AttributeError on owner_id.
        """
        response = client.post(
            "/api/voice/command",
            json={"command": "turn on bedroom light"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["modified_count"] > 0

        # Verify MQTT control was sent
        assert len(published_mqtt_messages) > 0
        for msg in published_mqtt_messages:
            assert msg["payload"]["status"] == "ON"

    def test_voice_assistant_fan_speed_command(self, client, auth_headers, test_switchboard_devices, published_mqtt_messages):
        """Test voice command setting fan speed."""
        response = client.post(
            "/api/voice/command",
            json={"command": "set fan speed 3"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        fan_msg = [m for m in published_mqtt_messages if m["payload"].get("channel") == 5]
        assert len(fan_msg) > 0
        assert fan_msg[0]["payload"]["speed"] == 3
        assert fan_msg[0]["payload"]["status"] == "ON"

    def test_voice_assistant_empty_command_fails(self, client, auth_headers):
        response = client.post(
            "/api/voice/command",
            json={"command": "   "},
            headers=auth_headers
        )
        assert response.status_code == 400
