import datetime
import pytest
from backend import main, models


class TestHeartbeatAndOfflineTimeout:
    """
    Tests for backend/main.py check_device_heartbeats:
    - Verifies DEVICE_OFFLINE_TIMEOUT_MINUTES is 3 minutes
    - Verifies devices with last_seen < 3 min remain ONLINE (prevents TLS reconnection false offline flapping)
    - Verifies devices with last_seen > 3 min are marked OFFLINE and generate alerts
    """

    def test_offline_timeout_constant_is_three_minutes(self):
        assert main.DEVICE_OFFLINE_TIMEOUT_MINUTES == 3

    def test_devices_within_timeout_remain_online(self, db_session, test_switchboard_devices):
        # Set last_seen to 2 minutes ago (greater than 1 min, but less than 3 min)
        two_mins_ago = datetime.datetime.utcnow() - datetime.timedelta(minutes=2)
        for dev in test_switchboard_devices:
            dev.is_online = True
            dev.last_seen = two_mins_ago
            db_session.add(dev)
        db_session.commit()

        # Run heartbeat check
        main.check_device_heartbeats()

        # Verify devices are STILL online
        devices = db_session.query(models.Device).filter(
            models.Device.node_id.like("4L-NODE-TEST_%")
        ).all()
        for dev in devices:
            assert dev.is_online is True

    def test_devices_exceeding_timeout_marked_offline(self, db_session, test_switchboard_devices):
        # Set last_seen to 4 minutes ago (exceeding 3 min timeout)
        four_mins_ago = datetime.datetime.utcnow() - datetime.timedelta(minutes=4)
        for dev in test_switchboard_devices:
            dev.is_online = True
            dev.last_seen = four_mins_ago
            db_session.add(dev)
        db_session.commit()

        # Run heartbeat check
        main.check_device_heartbeats()

        # Verify devices are now marked offline
        devices = db_session.query(models.Device).filter(
            models.Device.node_id.like("4L-NODE-TEST_%")
        ).all()
        for dev in devices:
            assert dev.is_online is False

        # Verify alerts created
        alerts = db_session.query(models.Alert).filter(
            models.Alert.type == "device_offline"
        ).all()
        assert len(alerts) == len(test_switchboard_devices)
