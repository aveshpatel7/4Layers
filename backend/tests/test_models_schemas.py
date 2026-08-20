import uuid
import datetime
import pytest
from sqlalchemy import inspect, text, create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend import models, schemas
from backend.database import Base


def test_warranty_status_enum():
    """Verify WarrantyStatus enum variants and string compatibility."""
    assert models.WarrantyStatus.ACTIVE == "ACTIVE"
    assert models.WarrantyStatus.VOID == "VOID"
    assert models.WarrantyStatus.EXPIRED == "EXPIRED"
    assert models.WarrantyStatus.UNKNOWN == "UNKNOWN"

    assert schemas.WarrantyStatus.ACTIVE.value == "ACTIVE"
    assert schemas.WarrantyStatus.VOID.value == "VOID"
    assert schemas.WarrantyStatus.EXPIRED.value == "EXPIRED"
    assert schemas.WarrantyStatus.UNKNOWN.value == "UNKNOWN"


def test_schema_compilation_and_table_creation(db_session):
    """Verify all database tables and columns are properly compiled and registered."""
    engine = db_session.get_bind()
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    required_tables = [
        "users",
        "homes",
        "rooms",
        "devices",
        "device_histories",
        "device_telemetries",
        "schedules",
        "alerts",
        "node_shares",
        "pending_invitations",
        "app_settings",
        "device_ownership",
        "ownership_audits",
    ]

    for table in required_tables:
        assert table in table_names, f"Table '{table}' not found in database tables: {table_names}"

    # Verify columns in devices table
    device_cols = {col["name"] for col in inspector.get_columns("devices")}
    required_device_cols = [
        "id", "room_id", "home_id", "node_id", "mac_address", "name", "device_type",
        "local_ip", "is_online", "current_state", "last_seen", "activated_at",
        "warranty_status", "total_toggle_count", "total_on_duration_seconds",
        "crash_count", "boot_count", "updated_at"
    ]
    for col in required_device_cols:
        assert col in device_cols, f"Column '{col}' not found in 'devices' table: {device_cols}"

    # Verify columns in device_telemetries table
    telemetry_cols = {col["name"] for col in inspector.get_columns("device_telemetries")}
    required_telemetry_cols = [
        "id", "device_id", "node_id", "channel", "toggles", "on_duration_seconds",
        "on_hours", "boot_count", "crash_count", "rssi", "uptime_seconds",
        "raw_payload", "created_at"
    ]
    for col in required_telemetry_cols:
        assert col in telemetry_cols, f"Column '{col}' not found in 'device_telemetries' table: {telemetry_cols}"


def test_device_model_defaults_and_properties(db_session, test_home, test_room):
    """Verify default values and computed properties on Device model."""
    dev = models.Device(
        home_id=test_home.id,
        room_id=test_room.id,
        node_id="4L-NODE-TEST-DEF_1",
        mac_address="AA:BB:CC:11:22:33",
        name="Ceiling Light",
        device_type="light",
    )
    db_session.add(dev)
    db_session.commit()
    db_session.refresh(dev)

    assert dev.id is not None
    assert dev.warranty_status == "ACTIVE"
    assert dev.total_toggle_count == 0
    assert dev.total_on_duration_seconds == 0
    assert dev.crash_count == 0
    assert dev.boot_count == 0
    assert dev.total_on_hours == 0.0
    assert isinstance(dev.activated_at, datetime.datetime)

    # Test total_on_hours calculation
    dev.total_on_duration_seconds = 7200
    assert dev.total_on_hours == 2.0

    dev.total_on_duration_seconds = 5400
    assert dev.total_on_hours == 1.5

    dev.total_on_duration_seconds = 0
    assert dev.total_on_hours == 0.0


def test_device_telemetry_crud_and_relationships(db_session, test_home, test_room):
    """Verify CRUD and bidirectional relationship between Device and DeviceTelemetry."""
    dev = models.Device(
        home_id=test_home.id,
        room_id=test_room.id,
        node_id="4L-NODE-TEST-TEL_1",
        mac_address="AA:BB:CC:11:22:44",
        name="Hall Fan",
        device_type="fan",
    )
    db_session.add(dev)
    db_session.commit()
    db_session.refresh(dev)

    # Create telemetry snapshots
    tel1 = models.DeviceTelemetry(
        device_id=dev.id,
        node_id=dev.node_id,
        channel=1,
        toggles=150,
        on_duration_seconds=3600,
        on_hours=1.0,
        boot_count=5,
        crash_count=0,
        rssi=-62,
        uptime_seconds=1200,
        raw_payload={"temp": 24.5}
    )
    tel2 = models.DeviceTelemetry(
        device_id=dev.id,
        node_id=dev.node_id,
        channel=1,
        toggles=320,
        on_duration_seconds=7200,
        on_hours=2.0,
        boot_count=5,
        crash_count=1,
        rssi=-60,
        uptime_seconds=2400,
        raw_payload={"temp": 25.1}
    )
    db_session.add_all([tel1, tel2])
    db_session.commit()
    db_session.refresh(dev)

    # Check relationships
    assert len(dev.telemetry) == 2
    assert len(dev.telemetries) == 2
    assert dev.telemetry[0].device.id == dev.id
    assert dev.telemetry[0].timestamp is not None
    assert dev.telemetry[0].created_at is not None
    assert tel1.raw_payload == {"temp": 24.5}


def test_device_telemetry_cascade_delete(db_session, test_home, test_room):
    """Verify that deleting a Device cascades and deletes all associated DeviceTelemetry records."""
    dev = models.Device(
        home_id=test_home.id,
        room_id=test_room.id,
        node_id="4L-NODE-CASCADE_1",
        mac_address="AA:BB:CC:11:22:55",
        name="Balcony Light",
        device_type="light",
    )
    db_session.add(dev)
    db_session.commit()
    db_session.refresh(dev)

    dev_id = dev.id

    tel = models.DeviceTelemetry(
        device_id=dev_id,
        node_id=dev.node_id,
        channel=1,
        toggles=100,
        on_duration_seconds=1800,
        on_hours=0.5,
        boot_count=2,
        crash_count=0,
    )
    db_session.add(tel)
    db_session.commit()

    # Confirm telemetry exists
    saved_tel = db_session.query(models.DeviceTelemetry).filter_by(device_id=dev_id).all()
    assert len(saved_tel) == 1

    # Delete device
    db_session.delete(dev)
    db_session.commit()

    # Verify telemetry was deleted by cascade
    remaining_tel = db_session.query(models.DeviceTelemetry).filter_by(device_id=dev_id).all()
    assert len(remaining_tel) == 0


def test_unlinked_telemetry_support(db_session):
    """Verify telemetry snapshot can be persisted with node_id even if device_id is NULL (unclaimed board)."""
    tel = models.DeviceTelemetry(
        device_id=None,
        node_id="4L-NODE-UNCLAIMED",
        channel=1,
        toggles=50,
        on_duration_seconds=900,
        on_hours=0.25,
        boot_count=1,
        crash_count=0,
        rssi=-70,
    )
    db_session.add(tel)
    db_session.commit()
    db_session.refresh(tel)

    assert tel.id is not None
    assert tel.device_id is None
    assert tel.node_id == "4L-NODE-UNCLAIMED"


def test_pydantic_device_schemas_serialization(db_session, test_home, test_room):
    """Verify Pydantic DeviceCreate, DeviceUpdate, and DeviceResponse serialization with R1 fields."""
    create_schema = schemas.DeviceCreate(
        name="Study Table Light",
        device_type="light",
        node_id="4L-NODE-STUDY_1",
        home_id=test_home.id,
        room_id=test_room.id,
        mac_address="AA:BB:CC:99:88:77",
        activated_at=datetime.datetime(2026, 1, 1, 12, 0, 0)
    )
    assert create_schema.name == "Study Table Light"
    assert create_schema.mac_address == "AA:BB:CC:99:88:77"
    assert create_schema.activated_at == datetime.datetime(2026, 1, 1, 12, 0, 0)

    # Insert in DB
    dev = models.Device(
        home_id=create_schema.home_id,
        room_id=create_schema.room_id,
        node_id=create_schema.node_id,
        mac_address=create_schema.mac_address,
        name=create_schema.name,
        device_type=create_schema.device_type,
        activated_at=create_schema.activated_at,
        warranty_status="ACTIVE",
        total_toggle_count=4500,
        total_on_duration_seconds=7200,
        crash_count=1,
        boot_count=12,
    )
    db_session.add(dev)
    db_session.commit()
    db_session.refresh(dev)

    # Validate ORM -> Pydantic response
    resp = schemas.DeviceResponse.model_validate(dev)
    assert resp.id == dev.id
    assert resp.total_toggle_count == 4500
    assert resp.total_on_duration_seconds == 7200
    assert resp.total_on_hours == 2.0
    assert resp.crash_count == 1
    assert resp.boot_count == 12
    assert resp.warranty_status == "ACTIVE"
    assert resp.activated_at == datetime.datetime(2026, 1, 1, 12, 0, 0)

    # Validate DeviceUpdate
    update_schema = schemas.DeviceUpdate(
        name="Renamed Study Light",
        warranty_status="VOID",
        activated_at=datetime.datetime(2025, 5, 10, 0, 0, 0)
    )
    assert update_schema.name == "Renamed Study Light"
    assert update_schema.warranty_status == "VOID"


def test_pydantic_telemetry_schemas_validation():
    """Verify DeviceTelemetryCreate and DeviceTelemetryResponse validation."""
    payload = {
        "node_id": "SN-001A2B3C",
        "channel": 1,
        "toggles": 12450,
        "on_duration_seconds": 36000,
        "on_hours": 10.0,
        "boot_count": 42,
        "crash_count": 2,
        "rssi": -65,
        "uptime_seconds": 3600,
        "raw_payload": {"ambient_temp": 28.2}
    }
    telemetry_create = schemas.DeviceTelemetryCreate(**payload)
    assert telemetry_create.node_id == "SN-001A2B3C"
    assert telemetry_create.toggles == 12450
    assert telemetry_create.on_hours == 10.0
    assert telemetry_create.raw_payload == {"ambient_temp": 28.2}

    response_payload = {
        "id": uuid.uuid4(),
        "device_id": uuid.uuid4(),
        "node_id": "SN-001A2B3C",
        "channel": 1,
        "toggles": 12450,
        "on_duration_seconds": 36000,
        "on_hours": 10.0,
        "boot_count": 42,
        "crash_count": 2,
        "rssi": -65,
        "uptime_seconds": 3600,
        "created_at": datetime.datetime.utcnow()
    }
    telemetry_resp = schemas.DeviceTelemetryResponse(**response_payload)
    assert telemetry_resp.id == response_payload["id"]
    assert telemetry_resp.toggles == 12450


def test_pydantic_usage_analytics_schemas_serialization():
    """Verify full serialization roundtrip for UsageAnalytics schemas."""
    user_id = uuid.uuid4()
    device_id = uuid.uuid4()
    now = datetime.datetime.utcnow()

    item = schemas.UsageAnalyticsItem(
        user_id=user_id,
        user_email="john@smartnest.io",
        user_name="John Doe",
        is_heavy_user=True,
        user_total_on_hours=5400.0,
        device_id=device_id,
        node_id="SN-001A2B3C",
        device_name="Living Room Main",
        device_type="light",
        channel=1,
        total_toggle_count=125000,
        total_on_duration_seconds=18000000,
        total_on_hours=5000.0,
        crash_count=55,
        boot_count=80,
        activated_at=now,
        warranty_status="VOID",
        warranty_reason="Excessive switch actuations (>100,000) and crash threshold exceeded"
    )

    summary = schemas.UsageAnalyticsSummary(
        total_devices=1,
        active_count=0,
        expired_count=0,
        void_count=1,
        heavy_user_count=1
    )

    response = schemas.UsageAnalyticsResponse(
        total_records=1,
        page=1,
        page_size=50,
        total_pages=1,
        summary=summary,
        items=[item]
    )

    # Serialize to JSON dict
    data = response.model_dump()
    assert data["total_records"] == 1
    assert data["summary"]["void_count"] == 1
    assert data["summary"]["heavy_user_count"] == 1
    assert len(data["items"]) == 1
    assert data["items"][0]["warranty_status"] == "VOID"
    assert data["items"][0]["is_heavy_user"] is True
    assert data["items"][0]["total_toggle_count"] == 125000


def test_startup_migration_idempotency():
    """Verify that startup migration logic can run multiple times cleanly without errors."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)

    # Simulate running the startup migration routine twice
    for iteration in range(2):
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        is_sqlite = "sqlite" in str(engine.url)

        columns_to_migrate = [
            ("users", "email_verified", "BOOLEAN", "BOOLEAN", "DEFAULT FALSE"),
            ("users", "email_verification_token", "VARCHAR(255)", "VARCHAR(255)", None),
            ("users", "email_verification_sent_at", "TIMESTAMP WITH TIME ZONE", "DATETIME", None),
            ("users", "reset_password_token", "VARCHAR(255)", "VARCHAR(255)", None),
            ("users", "reset_password_sent_at", "TIMESTAMP WITH TIME ZONE", "DATETIME", None),
            ("devices", "local_ip", "VARCHAR(64)", "VARCHAR(64)", None),
            ("devices", "activated_at", "TIMESTAMP WITH TIME ZONE", "DATETIME", "DEFAULT CURRENT_TIMESTAMP"),
            ("devices", "warranty_status", "VARCHAR(32)", "VARCHAR(32)", "DEFAULT 'ACTIVE'"),
            ("devices", "total_toggle_count", "INTEGER", "INTEGER", "DEFAULT 0"),
            ("devices", "total_on_duration_seconds", "INTEGER", "INTEGER", "DEFAULT 0"),
            ("devices", "crash_count", "INTEGER", "INTEGER", "DEFAULT 0"),
            ("devices", "boot_count", "INTEGER", "INTEGER", "DEFAULT 0"),
        ]

        for table, col, pg_type, sqlite_type, default in columns_to_migrate:
            if table in existing_tables:
                current_cols = {c["name"] for c in inspector.get_columns(table)}
                if col not in current_cols:
                    dtype = sqlite_type if is_sqlite else pg_type
                    if is_sqlite:
                        cmd = f"ALTER TABLE {table} ADD COLUMN {col} {dtype}"
                    else:
                        cmd = f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {dtype}"
                    if default:
                        cmd += f" {default}"
                    with engine.begin() as conn:
                        conn.execute(text(cmd))

    # Verify tables still intact
    inspector = inspect(engine)
    assert "devices" in inspector.get_table_names()
    assert "device_telemetries" in inspector.get_table_names()
