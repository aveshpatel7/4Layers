import datetime
import uuid
import pytest
from backend import main, models, auth, mqtt


class TestChallengerEdgeCases:
    """
    Adversarial Stress Testing & Edge Case Harness for Milestone 3.
    Evaluates:
    1. Voice Assistant Queries (Zero devices, Multi-home, Cross-tenant isolation, Hindi/Transliterated intents)
    2. Bulk Control (Mixed nodes, Partial vs Master switch optimization, Shared nodes, Security boundaries)
    3. Heartbeat Inactivity Boundary Testing (2.9 min vs 3.1 min, Fleet boundary discrimination)
    4. REST Endpoint Robustness (Authorization, Schema normalizations, Invalid inputs)
    """

    # =========================================================================
    # 1. Voice Assistant Edge Cases
    # =========================================================================

    def test_voice_assistant_user_with_zero_devices_and_zero_homes(self, client, auth_headers):
        """
        Adversarial Test: User has no homes or devices registered.
        Voice command must return 200 with success=False, modified_count=0 without raising unhandled exceptions.
        """
        response = client.post(
            "/api/voice/command",
            json={"command": "turn on light"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert data["modified_count"] == 0
        assert "Could not find any matching devices" in data["message"]

    def test_voice_assistant_user_with_empty_home(self, client, auth_headers, test_home, test_room):
        """
        Adversarial Test: User has a Home and Room, but 0 devices.
        Voice command must gracefully return 200 with success=False.
        """
        response = client.post(
            "/api/voice/command",
            json={"command": "turn off fan"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert data["modified_count"] == 0

    def test_voice_assistant_user_with_multiple_homes(self, client, auth_headers, test_user, test_home, test_room, test_switchboard_devices, db_session, published_mqtt_messages):
        """
        Edge Case: User owns multiple homes (e.g. City Flat & Beach House).
        - Test room-specific command targets only the matching room in that home.
        - Test global command ("turn on all lights") targets devices across BOTH homes.
        """
        # Create Second Home & Room for same user
        home2 = models.Home(id=uuid.uuid4(), name="Beach House", owner_id=test_user.id)
        room2 = models.Room(id=uuid.uuid4(), home_id=home2.id, name="Living Room", room_type="living_room")
        db_session.add_all([home2, room2])
        db_session.commit()

        # Add 6 channels for Home 2 switchboard
        base_node_2 = "4L-NODE-BEACH"
        home2_devices = []
        for ch, name, dev_type in [
            (1, "Living Light 1", "light"),
            (2, "Living Light 2", "light"),
            (3, "Living Chandelier", "light"),
            (4, "Living Floor Lamp", "light"),
            (5, "Living Fan", "fan"),
            (6, "Master Switch", "master")
        ]:
            dev = models.Device(
                id=uuid.uuid4(),
                home_id=home2.id,
                room_id=room2.id,
                node_id=f"{base_node_2}_{ch}",
                name=name,
                device_type=dev_type,
                is_online=True,
                current_state={"status": "OFF", "value": 0} if dev_type == "fan" else {"status": "OFF"},
                last_seen=datetime.datetime.utcnow()
            )
            db_session.add(dev)
            home2_devices.append(dev)
        db_session.commit()

        # 1. Room-specific command: "turn on living room light"
        published_mqtt_messages.clear()
        res1 = client.post(
            "/api/voice/command",
            json={"command": "turn on living room light"},
            headers=auth_headers
        )
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["success"] is True
        # Targets devices in Living Room (Home 2)
        assert data1["modified_count"] == 6
        for msg in published_mqtt_messages:
            assert msg["topic"] == "home/device/4L-NODE-BEACH/control"

        # 2. Global command: "turn on all lights"
        published_mqtt_messages.clear()
        res2 = client.post(
            "/api/voice/command",
            json={"command": "turn on all lights"},
            headers=auth_headers
        )
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["success"] is True
        # Affects devices across BOTH Home 1 and Home 2 (6 devices each = 12 total)
        assert data2["modified_count"] == 12
        topics = {msg["topic"] for msg in published_mqtt_messages}
        assert "home/device/4L-NODE-TEST/control" in topics
        assert "home/device/4L-NODE-BEACH/control" in topics

    def test_voice_assistant_cross_tenant_isolation(self, client, auth_headers, test_user, test_switchboard_devices, db_session, published_mqtt_messages):
        """
        Adversarial Security Test: Verify tenant isolation.
        Another user (User B) has their own home and devices.
        When User A issues a broad voice command, User B's devices MUST NEVER be modified or published to.
        """
        user_b = models.User(
            id=uuid.uuid4(),
            username="otheruser",
            email="other@smartnest.io",
            hashed_password=auth.get_password_hash("OtherPass123!"),
            is_active=True
        )
        home_b = models.Home(id=uuid.uuid4(), name="Other Home", owner_id=user_b.id)
        room_b = models.Room(id=uuid.uuid4(), home_id=home_b.id, name="Other Bedroom", room_type="bedroom")
        dev_b = models.Device(
            id=uuid.uuid4(),
            home_id=home_b.id,
            room_id=room_b.id,
            node_id="4L-NODE-OTHER_1",
            name="Other Light",
            device_type="light",
            is_online=True,
            current_state={"status": "OFF"},
            last_seen=datetime.datetime.utcnow()
        )
        db_session.add_all([user_b, home_b, room_b, dev_b])
        db_session.commit()

        # User A executes "turn on all devices"
        published_mqtt_messages.clear()
        response = client.post(
            "/api/voice/command",
            json={"command": "turn on all lights"},
            headers=auth_headers
        )
        assert response.status_code == 200

        # Verify User B's device state remains OFF in DB
        db_session.refresh(dev_b)
        assert dev_b.current_state.get("status") == "OFF"

        # Verify no MQTT message published to 4L-NODE-OTHER
        for msg in published_mqtt_messages:
            assert "4L-NODE-OTHER" not in msg["topic"]

    def test_voice_assistant_hindi_transliteration_intents(self, client, auth_headers, test_switchboard_devices, published_mqtt_messages):
        """
        Adversarial Test: Multi-lingual voice intents in Hindi / Hinglish.
        - 'bedroom light chalu karo' -> ON
        - 'fan band karo' -> OFF
        """
        # 1. 'chalu' (ON)
        published_mqtt_messages.clear()
        res1 = client.post("/api/voice/command", json={"command": "bedroom light chalu karo"}, headers=auth_headers)
        assert res1.status_code == 200
        assert res1.json()["success"] is True
        assert any(msg["payload"].get("status") == "ON" for msg in published_mqtt_messages)

        # 2. 'band' (OFF)
        published_mqtt_messages.clear()
        res2 = client.post("/api/voice/command", json={"command": "fan band karo"}, headers=auth_headers)
        assert res2.status_code == 200
        assert res2.json()["success"] is True
        fan_msg = [m for m in published_mqtt_messages if m["payload"].get("channel") == 5]
        assert len(fan_msg) > 0
        assert fan_msg[0]["payload"]["status"] == "OFF"

    # =========================================================================
    # 2. Bulk Control Edge Cases
    # =========================================================================

    def test_bulk_control_mixed_nodes_partial_vs_master_switch(self, client, auth_headers, test_user, test_home, test_room, test_switchboard_devices, db_session, published_mqtt_messages):
        """
        Adversarial Stress Test: Bulk control across two physical switchboards simultaneously:
        - Board A (4L-NODE-TEST): Only channels 1 and 2 selected (NO master switch).
          -> Must publish 2 separate channel commands (channel 1: ON, channel 2: ON).
        - Board B (4L-NODE-BOARD2): Channels 1, 2, 5, AND 6 (Master) selected.
          -> Must optimize to a single Master Switch command (channel 6: ON).
        Total MQTT commands published across both boards MUST be 3 (2 for Board A, 1 for Board B).
        """
        # Create Board B
        base_node_2 = "4L-NODE-BOARD2"
        board2_devices = []
        for ch, name, dev_type in [
            (1, "Board2 Sw1", "light"),
            (2, "Board2 Sw2", "light"),
            (3, "Board2 Sw3", "light"),
            (4, "Board2 Sw4", "light"),
            (5, "Board2 Fan", "fan"),
            (6, "Board2 Master", "master")
        ]:
            dev = models.Device(
                id=uuid.uuid4(),
                home_id=test_home.id,
                room_id=test_room.id,
                node_id=f"{base_node_2}_{ch}",
                name=name,
                device_type=dev_type,
                is_online=True,
                current_state={"status": "OFF", "value": 0} if dev_type == "fan" else {"status": "OFF"},
                last_seen=datetime.datetime.utcnow()
            )
            db_session.add(dev)
            board2_devices.append(dev)
        db_session.commit()

        # Select Board A channels 1, 2 (devices 0, 1) and Board B channels 1, 2, 5, 6 (devices 0, 1, 4, 5)
        selected_ids = [
            str(test_switchboard_devices[0].id),
            str(test_switchboard_devices[1].id),
            str(board2_devices[0].id),
            str(board2_devices[1].id),
            str(board2_devices[4].id),
            str(board2_devices[5].id)
        ]

        published_mqtt_messages.clear()
        response = client.post(
            "/api/devices/bulk-control",
            json={"device_ids": selected_ids, "state": {"status": "ON", "value": 3}},
            headers=auth_headers
        )
        assert response.status_code == 200

        # Assert exactly 3 MQTT commands were published
        assert len(published_mqtt_messages) == 3

        board_a_msgs = [m for m in published_mqtt_messages if m["topic"] == "home/device/4L-NODE-TEST/control"]
        board_b_msgs = [m for m in published_mqtt_messages if m["topic"] == "home/device/4L-NODE-BOARD2/control"]

        # Board A: 2 individual channel commands
        assert len(board_a_msgs) == 2
        board_a_channels = {m["payload"]["channel"] for m in board_a_msgs}
        assert board_a_channels == {1, 2}

        # Board B: 1 single master switch command
        assert len(board_b_msgs) == 1
        assert board_b_msgs[0]["payload"]["channel"] == 6
        assert board_b_msgs[0]["payload"]["status"] == "ON"

    def test_bulk_control_shared_node_authorization(self, client, auth_headers, test_user, test_home, test_room, test_switchboard_devices, db_session, published_mqtt_messages):
        """
        Edge Case: Bulk control with a mix of owned devices and shared devices (via NodeShare).
        Verifies authorization passes and commands are sent to both owned and shared boards.
        """
        # User B owns Board Shared
        user_b = models.User(
            id=uuid.uuid4(),
            username="friend_user",
            email="friend@smartnest.io",
            hashed_password=auth.get_password_hash("FriendPass123!"),
            is_active=True
        )
        home_b = models.Home(id=uuid.uuid4(), name="Friend Home", owner_id=user_b.id)
        room_b = models.Room(id=uuid.uuid4(), home_id=home_b.id, name="Friend Room", room_type="hall")
        dev_shared = models.Device(
            id=uuid.uuid4(),
            home_id=home_b.id,
            room_id=room_b.id,
            node_id="4L-NODE-SHARED_1",
            name="Shared Light",
            device_type="light",
            is_online=True,
            current_state={"status": "OFF"},
            last_seen=datetime.datetime.utcnow()
        )
        # Grant NodeShare to test_user
        share = models.NodeShare(
            id=uuid.uuid4(),
            node_id="4L-NODE-SHARED",
            shared_with_user_id=test_user.id
        )
        db_session.add_all([user_b, home_b, room_b, dev_shared, share])
        db_session.commit()

        # Bulk control: 1 owned device + 1 shared device
        bulk_ids = [str(test_switchboard_devices[0].id), str(dev_shared.id)]
        published_mqtt_messages.clear()
        response = client.post(
            "/api/devices/bulk-control",
            json={"device_ids": bulk_ids, "state": {"status": "ON"}},
            headers=auth_headers
        )
        assert response.status_code == 200
        assert len(published_mqtt_messages) == 2
        topics = {m["topic"] for m in published_mqtt_messages}
        assert "home/device/4L-NODE-TEST/control" in topics
        assert "home/device/4L-NODE-SHARED/control" in topics

    def test_bulk_control_unauthorized_devices_rejected(self, client, auth_headers, db_session):
        """
        Adversarial Test: Bulk control targeting another user's device without sharing returns 403 Forbidden.
        """
        user_b = models.User(
            id=uuid.uuid4(),
            username="stranger",
            email="stranger@smartnest.io",
            hashed_password=auth.get_password_hash("Pass123!"),
            is_active=True
        )
        home_b = models.Home(id=uuid.uuid4(), name="Stranger Home", owner_id=user_b.id)
        room_b = models.Room(id=uuid.uuid4(), home_id=home_b.id, name="Stranger Room", room_type="room")
        dev_unshared = models.Device(
            id=uuid.uuid4(),
            home_id=home_b.id,
            room_id=room_b.id,
            node_id="4L-NODE-STRANGER_1",
            name="Stranger Light",
            device_type="light",
            is_online=True,
            current_state={"status": "OFF"},
            last_seen=datetime.datetime.utcnow()
        )
        db_session.add_all([user_b, home_b, room_b, dev_unshared])
        db_session.commit()

        response = client.post(
            "/api/devices/bulk-control",
            json={"device_ids": [str(dev_unshared.id)], "state": {"status": "ON"}},
            headers=auth_headers
        )
        assert response.status_code == 403

    def test_bulk_control_invalid_and_empty_payloads(self, client, auth_headers):
        """
        Edge Case: Empty device_ids list or non-existent UUIDs return 404 Not Found.
        """
        # Empty list
        res1 = client.post("/api/devices/bulk-control", json={"device_ids": [], "state": {"status": "ON"}}, headers=auth_headers)
        assert res1.status_code == 404

        # Non-existent UUID
        res2 = client.post("/api/devices/bulk-control", json={"device_ids": [str(uuid.uuid4())], "state": {"status": "ON"}}, headers=auth_headers)
        assert res2.status_code == 404

    # =========================================================================
    # 3. Heartbeat Inactivity Boundary Testing (2.9 min vs 3.1 min)
    # =========================================================================

    def test_heartbeat_boundary_sub_3_minutes_remains_online(self, db_session, test_switchboard_devices):
        """
        Boundary Test: Device seen exactly 2.9 minutes ago (174 seconds).
        With DEVICE_OFFLINE_TIMEOUT_MINUTES = 3, cutoff is exactly 3.0 min (180 seconds).
        Since 174s < 180s, device MUST remain ONLINE, and NO alerts should be created.
        """
        now = datetime.datetime.utcnow()
        last_seen_2_9_min = now - datetime.timedelta(seconds=174)

        for dev in test_switchboard_devices:
            dev.is_online = True
            dev.last_seen = last_seen_2_9_min
            db_session.add(dev)
        db_session.commit()

        # Run heartbeat check
        main.check_device_heartbeats()

        # Assert all remain ONLINE
        for dev in test_switchboard_devices:
            db_session.refresh(dev)
            assert dev.is_online is True, f"Device {dev.node_id} at 2.9 min was incorrectly marked offline"

        # Assert no alerts created
        alerts = db_session.query(models.Alert).all()
        assert len(alerts) == 0

    def test_heartbeat_boundary_super_3_minutes_marked_offline(self, db_session, test_switchboard_devices):
        """
        Boundary Test: Device seen exactly 3.1 minutes ago (186 seconds).
        Since 186s > 180s (3.0 min), device MUST be marked OFFLINE and generate alerts.
        """
        now = datetime.datetime.utcnow()
        last_seen_3_1_min = now - datetime.timedelta(seconds=186)

        for dev in test_switchboard_devices:
            dev.is_online = True
            dev.last_seen = last_seen_3_1_min
            db_session.add(dev)
        db_session.commit()

        # Run heartbeat check
        main.check_device_heartbeats()

        # Assert all are marked OFFLINE
        for dev in test_switchboard_devices:
            db_session.refresh(dev)
            assert dev.is_online is False, f"Device {dev.node_id} at 3.1 min should be marked offline"

        # Assert alerts created for all 6 devices
        alerts = db_session.query(models.Alert).filter(models.Alert.type == "device_offline").all()
        assert len(alerts) == len(test_switchboard_devices)

    def test_heartbeat_fleet_mixed_boundary_discrimination(self, db_session, test_user, test_home, test_room):
        """
        Adversarial Test: Fleet of devices at various boundary timestamps evaluated in a single sweep:
        - Dev A: seen 1.0 min ago (60s) -> stays ONLINE
        - Dev B: seen 2.9 min ago (174s) -> stays ONLINE
        - Dev C: seen 3.1 min ago (186s) -> marked OFFLINE + creates Alert
        - Dev D: seen 10.0 min ago (600s), but ALREADY offline -> stays OFFLINE, NO duplicate Alert
        """
        now = datetime.datetime.utcnow()
        
        dev_a = models.Device(id=uuid.uuid4(), home_id=test_home.id, room_id=test_room.id, node_id="FLEET-NODE_A", device_type="light", is_online=True, last_seen=now - datetime.timedelta(seconds=60), name="Fresh Device")
        dev_b = models.Device(id=uuid.uuid4(), home_id=test_home.id, room_id=test_room.id, node_id="FLEET-NODE_B", device_type="light", is_online=True, last_seen=now - datetime.timedelta(seconds=174), name="Near Boundary Online")
        dev_c = models.Device(id=uuid.uuid4(), home_id=test_home.id, room_id=test_room.id, node_id="FLEET-NODE_C", device_type="light", is_online=True, last_seen=now - datetime.timedelta(seconds=186), name="Stale Device")
        dev_d = models.Device(id=uuid.uuid4(), home_id=test_home.id, room_id=test_room.id, node_id="FLEET-NODE_D", device_type="light", is_online=False, last_seen=now - datetime.timedelta(seconds=600), name="Already Offline Device")

        db_session.add_all([dev_a, dev_b, dev_c, dev_d])
        db_session.commit()

        # Run heartbeat sweep
        main.check_device_heartbeats()

        db_session.refresh(dev_a)
        db_session.refresh(dev_b)
        db_session.refresh(dev_c)
        db_session.refresh(dev_d)

        assert dev_a.is_online is True
        assert dev_b.is_online is True
        assert dev_c.is_online is False
        assert dev_d.is_online is False

        # Alert should be created ONLY for dev_c (transition from True -> False)
        alerts = db_session.query(models.Alert).filter(models.Alert.type == "device_offline").all()
        assert len(alerts) == 1
        assert alerts[0].device_id == dev_c.id

    # =========================================================================
    # 4. REST Endpoint & Database Query Logic Edge Cases
    # =========================================================================

    def test_control_endpoint_unauthorized_device_access(self, client, auth_headers, db_session):
        """
        Adversarial Security Test: Attempt to control another user's device via /api/devices/{id}/control.
        Must return 403 Forbidden.
        """
        user_b = models.User(id=uuid.uuid4(), username="victim", email="victim@smartnest.io", hashed_password=auth.get_password_hash("VictimPass1!"))
        home_b = models.Home(id=uuid.uuid4(), name="Victim Home", owner_id=user_b.id)
        dev_b = models.Device(id=uuid.uuid4(), home_id=home_b.id, node_id="4L-VICTIM_1", device_type="light", name="Victim Lamp", is_online=True, current_state={"status": "OFF"})
        db_session.add_all([user_b, home_b, dev_b])
        db_session.commit()

        response = client.post(
            f"/api/devices/{dev_b.id}/control",
            json={"state": {"status": "ON"}},
            headers=auth_headers
        )
        assert response.status_code == 403

    def test_control_endpoint_boolean_and_casing_variations(self, client, auth_headers, test_switchboard_devices, published_mqtt_messages):
        """
        Verify /control accepts boolean (True/False), lowercase ('on'/'off'), and string numerals ('1'/'0').
        """
        relay = test_switchboard_devices[0]

        # Case 1: boolean True -> "ON"
        published_mqtt_messages.clear()
        res1 = client.post(f"/api/devices/{relay.id}/control", json={"state": {"status": True}}, headers=auth_headers)
        assert res1.status_code == 200
        assert published_mqtt_messages[0]["payload"]["status"] == "ON"

        # Case 2: string "off" -> "OFF"
        published_mqtt_messages.clear()
        res2 = client.post(f"/api/devices/{relay.id}/control", json={"state": {"status": "off"}}, headers=auth_headers)
        assert res2.status_code == 200
        assert published_mqtt_messages[0]["payload"]["status"] == "OFF"

        # Case 3: string "1" -> "ON"
        published_mqtt_messages.clear()
        res3 = client.post(f"/api/devices/{relay.id}/control", json={"state": {"status": "1"}}, headers=auth_headers)
        assert res3.status_code == 200
        assert published_mqtt_messages[0]["payload"]["status"] == "ON"
