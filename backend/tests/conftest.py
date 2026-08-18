import sys
import os

# Ensure project root is in Python sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import json
import uuid
import datetime
import pytest
from unittest.mock import MagicMock, patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from backend.database import Base, get_db
from backend import models, auth, mqtt
from backend.main import app

# Test database setup (file-based or in-memory SQLite with static pool)
from sqlalchemy.pool import StaticPool

TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def setup_test_db(monkeypatch):
    """Create all tables before each test and drop after."""
    Base.metadata.create_all(bind=test_engine)
    
    # Patch SessionLocal across backend modules to use test DB
    monkeypatch.setattr(mqtt, "SessionLocal", TestingSessionLocal)
    monkeypatch.setattr("backend.database.SessionLocal", TestingSessionLocal)
    monkeypatch.setattr("backend.main.SessionLocal", TestingSessionLocal)
    monkeypatch.setattr("backend.routes.devices.SessionLocal", TestingSessionLocal, raising=False)

    yield TestingSessionLocal

    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    """Provides a transactional database session for tests."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def override_get_db(db_session):
    """Overrides FastAPI get_db dependency."""
    def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def published_mqtt_messages(monkeypatch):
    """
    Captures all MQTT publications synchronously for assertions.
    """
    messages = []

    def fake_blocking_publish(topic: str, payload: str):
        try:
            parsed = json.loads(payload)
        except Exception:
            parsed = payload
        messages.append({
            "topic": topic,
            "payload": parsed,
            "raw_payload": payload
        })

    def fake_submit(fn, *args, **kwargs):
        # Execute synchronously instead of background thread pool during tests
        return fn(*args, **kwargs)

    monkeypatch.setattr(mqtt, "_blocking_publish", fake_blocking_publish)
    monkeypatch.setattr(mqtt.publish_executor, "submit", fake_submit)

    return messages


@pytest.fixture
def test_user(db_session) -> models.User:
    """Create a verified test user in the test DB."""
    user = models.User(
        id=uuid.uuid4(),
        username="testengineer",
        email="engineer@smartnest.io",
        hashed_password=auth.get_password_hash("SecretPassword123!"),
        is_active=True,
        terms_accepted=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user) -> dict:
    """Generate Authorization header with valid JWT token for test_user."""
    token = auth.create_access_token(data={"sub": test_user.username, "user_id": str(test_user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def test_home(db_session, test_user) -> models.Home:
    """Create a test home owned by test_user."""
    home = models.Home(
        id=uuid.uuid4(),
        name="Smart Villa",
        owner_id=test_user.id
    )
    db_session.add(home)
    db_session.commit()
    db_session.refresh(home)
    return home


@pytest.fixture
def test_room(db_session, test_home) -> models.Room:
    """Create a test room in test_home."""
    room = models.Room(
        id=uuid.uuid4(),
        home_id=test_home.id,
        name="Master Bedroom",
        room_type="bedroom"
    )
    db_session.add(room)
    db_session.commit()
    db_session.refresh(room)
    return room


@pytest.fixture
def test_switchboard_devices(db_session, test_home, test_room) -> list[models.Device]:
    """
    Creates a full 6-channel SmartNest switchboard (4 relays, 1 fan, 1 master switch).
    Base node ID: 4L-NODE-TEST
    """
    base_node = "4L-NODE-TEST"
    devices = []

    configs = [
        (1, "Bedroom Light 1", "light"),
        (2, "Bedroom Light 2", "light"),
        (3, "Bedroom Spot", "light"),
        (4, "Night Lamp", "light"),
        (5, "Ceiling Fan", "fan"),
        (6, "Master Switch", "master")
    ]

    for ch, name, dev_type in configs:
        dev = models.Device(
            id=uuid.uuid4(),
            home_id=test_home.id,
            room_id=test_room.id,
            node_id=f"{base_node}_{ch}",
            mac_address="AA:BB:CC:DD:EE:01",
            name=name,
            device_type=dev_type,
            local_ip="192.168.1.150",
            is_online=True,
            current_state={"status": "OFF", "value": 0} if dev_type == "fan" else {"status": "OFF"},
            last_seen=datetime.datetime.utcnow()
        )
        db_session.add(dev)
        devices.append(dev)

    db_session.commit()
    for dev in devices:
        db_session.refresh(dev)

    return devices


@pytest.fixture
def client(override_get_db):
    """TestClient instance with overridden dependencies."""
    return TestClient(app)
