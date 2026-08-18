import json
import datetime
import pytest
from backend import mqtt, models


class FakeMQTTMessage:
    def __init__(self, topic: str, payload: str | bytes):
        self.topic = topic
        self.payload = payload.encode("utf-8") if isinstance(payload, str) else payload


class TestMQTTSubscriber:
    """
    Tests for backend/mqtt.py on_message handler:
    - Periodic HEARTBEAT handling & sibling channel refresh
    - Real-time channel state updates & history logging
    - LWT OFFLINE disconnect handling
    - Telemetry IP updates
    - Resilience to malformed payloads
    """

    def test_heartbeat_refreshes_all_sibling_channels(self, db_session, test_switchboard_devices):
        # Set all devices to offline and clear local_ip
        for dev in test_switchboard_devices:
            dev.is_online = False
            dev.local_ip = None
            dev.last_seen = datetime.datetime.utcnow() - datetime.timedelta(minutes=10)
            db_session.add(dev)
        db_session.commit()

        heartbeat_payload = {
            "status": "HEARTBEAT",
            "is_online": True,
            "local_ip": "192.168.1.188"
        }
        msg = FakeMQTTMessage(
            topic="home/device/4L-NODE-TEST/status",
            payload=json.dumps(heartbeat_payload)
        )

        mqtt.on_message(mqtt.client, None, msg)
        db_session.expire_all()

        # Verify all 6 devices are now marked online with new local_ip
        devices = db_session.query(models.Device).filter(
            models.Device.node_id.like("4L-NODE-TEST_%")
        ).all()
        assert len(devices) == 6
        for dev in devices:
            assert dev.is_online is True
            assert dev.local_ip == "192.168.1.188"
            assert (datetime.datetime.utcnow() - dev.last_seen).total_seconds() < 5

    def test_channel_status_update_and_history(self, db_session, test_switchboard_devices):
        status_payload = {
            "channel": 1,
            "status": "ON"
        }
        msg = FakeMQTTMessage(
            topic="home/device/4L-NODE-TEST/status",
            payload=json.dumps(status_payload)
        )

        mqtt.on_message(mqtt.client, None, msg)
        db_session.expire_all()

        dev_ch1 = db_session.query(models.Device).filter(
            models.Device.node_id == "4L-NODE-TEST_1"
        ).first()
        assert dev_ch1 is not None
        assert dev_ch1.current_state.get("status") == "ON"
        assert dev_ch1.is_online is True

        history = db_session.query(models.DeviceHistory).filter(
            models.DeviceHistory.device_id == dev_ch1.id
        ).all()
        assert len(history) >= 1
        assert history[-1].change_type == "status_confirmed"
        assert history[-1].new_state.get("status") == "ON"

    def test_fan_status_update_with_speed(self, db_session, test_switchboard_devices):
        status_payload = {
            "channel": 5,
            "status": "ON",
            "speed": 3
        }
        msg = FakeMQTTMessage(
            topic="home/device/4L-NODE-TEST/status",
            payload=json.dumps(status_payload)
        )

        mqtt.on_message(mqtt.client, None, msg)
        db_session.expire_all()

        fan = db_session.query(models.Device).filter(
            models.Device.node_id == "4L-NODE-TEST_5"
        ).first()
        assert fan is not None
        assert fan.current_state.get("status") == "ON"
        assert fan.current_state.get("value") == 3

    def test_lwt_offline_message_marks_siblings_offline(self, db_session, test_switchboard_devices):
        offline_payload = {
            "status": "OFFLINE"
        }
        msg = FakeMQTTMessage(
            topic="home/device/4L-NODE-TEST/status",
            payload=json.dumps(offline_payload)
        )

        mqtt.on_message(mqtt.client, None, msg)
        db_session.expire_all()

        devices = db_session.query(models.Device).filter(
            models.Device.node_id.like("4L-NODE-TEST_%")
        ).all()
        assert len(devices) == 6
        for dev in devices:
            assert dev.is_online is False

        # Verify alert was created
        alerts = db_session.query(models.Alert).all()
        assert len(alerts) > 0
        assert alerts[0].type == "device_offline"

    def test_malformed_json_dropped_gracefully(self, db_session, test_switchboard_devices):
        msg = FakeMQTTMessage(
            topic="home/device/4L-NODE-TEST/status",
            payload="NOT_A_VALID_JSON{{"
        )
        # Should not raise any unhandled exception
        mqtt.on_message(mqtt.client, None, msg)

    def test_telemetry_topic_updates_local_ip(self, db_session, test_switchboard_devices):
        telemetry_payload = {
            "local_ip": "192.168.1.222"
        }
        msg = FakeMQTTMessage(
            topic="home/device/4L-NODE-TEST/telemetry",
            payload=json.dumps(telemetry_payload)
        )

        mqtt.on_message(mqtt.client, None, msg)
        db_session.expire_all()

        devices = db_session.query(models.Device).filter(
            models.Device.node_id.like("4L-NODE-TEST_%")
        ).all()
        for dev in devices:
            assert dev.local_ip == "192.168.1.222"
