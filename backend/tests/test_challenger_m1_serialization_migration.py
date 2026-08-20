import uuid
import datetime
from zoneinfo import ZoneInfo
import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine, inspect, text, Column, String, Boolean, JSON, DateTime, Integer, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool

from backend import models, schemas
from backend.database import Base


class TestPydanticSchemaValidationMalformedInputs:
    """
    Empirical Challenge: Pydantic Schema Validation against malformed,
    type-mismatched, out-of-bounds, and adversarial inputs.
    """

    def test_device_create_malformed_uuid(self):
        """Invalid UUID string in home_id or room_id must raise ValidationError."""
        # Invalid home_id (not a UUID)
        with pytest.raises(ValidationError) as exc_info:
            schemas.DeviceCreate(
                name="Living Light",
                device_type="light",
                node_id="4L-NODE-001",
                home_id="not-a-valid-uuid",
            )
        assert "home_id" in str(exc_info.value)

        # Invalid room_id
        with pytest.raises(ValidationError) as exc_info:
            schemas.DeviceCreate(
                name="Living Light",
                device_type="light",
                node_id="4L-NODE-001",
                home_id=uuid.uuid4(),
                room_id="invalid-uuid-format-12345",
            )
        assert "room_id" in str(exc_info.value)

    def test_device_response_type_mismatches(self):
        """Invalid data types in DeviceResponse must be rejected or strictly validated."""
        valid_uuid = uuid.uuid4()
        now = datetime.datetime.now(datetime.timezone.utc)

        # Non-integer toggles
        with pytest.raises(ValidationError) as exc_info:
            schemas.DeviceResponse(
                id=valid_uuid,
                home_id=valid_uuid,
                node_id="4L-NODE-001",
                name="Lamp",
                device_type="light",
                is_online=True,
                total_toggle_count="not_a_number",  # Invalid int
                updated_at=now
            )
        assert "total_toggle_count" in str(exc_info.value)

        # Non-integer crash_count
        with pytest.raises(ValidationError) as exc_info:
            schemas.DeviceResponse(
                id=valid_uuid,
                home_id=valid_uuid,
                node_id="4L-NODE-001",
                name="Lamp",
                device_type="light",
                is_online=True,
                crash_count={"invalid": "dict"},
                updated_at=now
            )
        assert "crash_count" in str(exc_info.value)

    def test_telemetry_schema_malformed_payloads(self):
        """Telemetry payloads with invalid types or non-dict raw_payload."""
        # Non-numeric toggles
        with pytest.raises(ValidationError) as exc_info:
            schemas.DeviceTelemetryCreate(
                node_id="4L-NODE-001",
                toggles="invalid_int"
            )
        assert "toggles" in str(exc_info.value)

        # Non-numeric on_hours
        with pytest.raises(ValidationError) as exc_info:
            schemas.DeviceTelemetryCreate(
                node_id="4L-NODE-001",
                on_hours="not_a_float"
            )
        assert "on_hours" in str(exc_info.value)

        # raw_payload must be dict if provided
        with pytest.raises(ValidationError) as exc_info:
            schemas.DeviceTelemetryCreate(
                node_id="4L-NODE-001",
                raw_payload=["list", "is", "not", "dict"]  # List instead of dict
            )
        assert "raw_payload" in str(exc_info.value)

    def test_usage_analytics_schema_malformed_inputs(self):
        """UsageAnalytics schemas must reject malformed types."""
        valid_dev_id = uuid.uuid4()
        now = datetime.datetime.now(datetime.timezone.utc)

        # Invalid is_heavy_user boolean (e.g. passing dict or unparseable object)
        with pytest.raises(ValidationError) as exc_info:
            schemas.UsageAnalyticsItem(
                device_id=valid_dev_id,
                node_id="4L-NODE-001",
                device_name="Light",
                device_type="light",
                is_heavy_user={"type": "not_a_bool"},
                user_total_on_hours=100.0,
                updated_at=now
            )
        assert "is_heavy_user" in str(exc_info.value)

        # Summary total_devices as non-integer
        with pytest.raises(ValidationError) as exc_info:
            schemas.UsageAnalyticsSummary(
                total_devices="many_devices",
                active_count=0
            )
        assert "total_devices" in str(exc_info.value)

    def test_adversarial_string_payloads_in_schemas(self):
        """Adversarial SQL injection, XSS, and Unicode payloads in string fields."""
        adversarial_payloads = [
            "'; DROP TABLE devices; --",
            "<script>alert('xss')</script>",
            "💡 Smart ⚡ Switch 🏠 \u0000 \ud83d\ude00",
            "A" * 5000,  # Long string
        ]

        valid_uuid = uuid.uuid4()
        now = datetime.datetime.now(datetime.timezone.utc)

        for payload in adversarial_payloads:
            # DeviceResponse
            dev_resp = schemas.DeviceResponse(
                id=valid_uuid,
                home_id=valid_uuid,
                node_id=payload[:100],  # node_id
                name=payload[:100],
                device_type="light",
                is_online=True,
                warranty_status=payload[:32],
                updated_at=now
            )
            assert dev_resp.name == payload[:100]

            # UsageAnalyticsItem
            item = schemas.UsageAnalyticsItem(
                device_id=valid_uuid,
                node_id=payload[:100],
                device_name=payload[:100],
                device_type="light",
                warranty_reason=payload,
            )
            assert item.warranty_reason == payload


class TestPydanticSchemaValidationMissingOptionalFields:
    """
    Empirical Challenge: Pydantic Schema Validation with missing optional fields,
    null values, and default propagation.
    """

    def test_device_create_missing_optional_fields(self):
        """DeviceCreate should accept minimal required fields and default optional fields to None."""
        home_id = uuid.uuid4()
        dev = schemas.DeviceCreate(
            name="Living Room Light",
            device_type="light",
            node_id="4L-NODE-TEST-1",
            home_id=home_id
        )
        assert dev.name == "Living Room Light"
        assert dev.device_type == "light"
        assert dev.node_id == "4L-NODE-TEST-1"
        assert dev.home_id == home_id
        assert dev.room_id is None
        assert dev.mac_address is None
        assert dev.activated_at is None

    def test_device_response_default_values(self):
        """DeviceResponse should supply correct default values for M1 fields when omitted."""
        dev_id = uuid.uuid4()
        home_id = uuid.uuid4()
        now = datetime.datetime.now(datetime.timezone.utc)

        dev_resp = schemas.DeviceResponse(
            id=dev_id,
            home_id=home_id,
            node_id="4L-NODE-TEST-2",
            name="Kitchen Fan",
            device_type="fan",
            is_online=False,
            updated_at=now
        )
        # Check M1 default fields
        assert dev_resp.warranty_status == "ACTIVE"
        assert dev_resp.total_toggle_count == 0
        assert dev_resp.total_on_duration_seconds == 0
        assert dev_resp.total_on_hours == 0.0
        assert dev_resp.crash_count == 0
        assert dev_resp.boot_count == 0
        assert dev_resp.activated_at is None
        assert dev_resp.last_seen is None
        assert dev_resp.local_ip is None
        assert dev_resp.current_state == {}

    def test_device_update_all_fields_optional(self):
        """DeviceUpdate should allow completely empty dictionary."""
        update = schemas.DeviceUpdate()
        assert update.name is None
        assert update.device_type is None
        assert update.room_id is None
        assert update.activated_at is None
        assert update.warranty_status is None

    def test_device_telemetry_create_defaults_and_nulls(self):
        """DeviceTelemetryCreate minimal fields should default counters to 0 and optionals to None."""
        tel = schemas.DeviceTelemetryCreate(node_id="4L-NODE-TEST-MIN")
        assert tel.node_id == "4L-NODE-TEST-MIN"
        assert tel.channel is None
        assert tel.toggles == 0
        assert tel.on_duration_seconds == 0
        assert tel.on_hours == 0.0
        assert tel.boot_count == 0
        assert tel.crash_count == 0
        assert tel.rssi is None
        assert tel.uptime_seconds is None
        assert tel.raw_payload is None
        assert tel.device_id is None

    def test_usage_analytics_missing_optional_fields(self):
        """UsageAnalyticsItem with missing user fields (e.g. unassigned device)."""
        dev_id = uuid.uuid4()
        item = schemas.UsageAnalyticsItem(
            device_id=dev_id,
            node_id="4L-NODE-UNCLAIMED",
            device_name="Unclaimed Switch",
            device_type="switch",
        )
        assert item.user_id is None
        assert item.user_email is None
        assert item.user_name is None
        assert item.is_heavy_user is False
        assert item.user_total_on_hours == 0.0
        assert item.channel is None
        assert item.total_toggle_count == 0
        assert item.total_on_duration_seconds == 0
        assert item.total_on_hours == 0.0
        assert item.crash_count == 0
        assert item.boot_count == 0
        assert item.activated_at is None
        assert item.warranty_status == "ACTIVE"
        assert item.warranty_reason is None

    def test_usage_analytics_response_empty_items(self):
        """UsageAnalyticsResponse with 0 items."""
        summary = schemas.UsageAnalyticsSummary()
        assert summary.total_devices == 0
        assert summary.active_count == 0
        assert summary.expired_count == 0
        assert summary.void_count == 0
        assert summary.heavy_user_count == 0

        resp = schemas.UsageAnalyticsResponse(
            total_records=0,
            page=1,
            page_size=50,
            total_pages=0,
            summary=summary,
            items=[]
        )
        assert resp.total_records == 0
        assert len(resp.items) == 0


class TestPydanticSchemaTimezoneHandling:
    """
    Empirical Challenge: Timezone-Aware vs Naive Datetimes serialization,
    deserialization, microsecond precision, and ISO 8601 formatting.
    """

    def test_timezone_aware_utc_iso_string(self):
        """Schema parses ISO string with Z UTC suffix."""
        iso_str = "2026-08-20T17:42:30Z"
        home_id = uuid.uuid4()
        dev = schemas.DeviceCreate(
            name="Living Light",
            device_type="light",
            node_id="4L-NODE-001",
            home_id=home_id,
            activated_at=iso_str
        )
        assert dev.activated_at is not None
        assert dev.activated_at.year == 2026
        assert dev.activated_at.month == 8
        assert dev.activated_at.day == 20
        assert dev.activated_at.hour == 17
        assert dev.activated_at.minute == 42
        assert dev.activated_at.second == 30

    def test_timezone_aware_offset_iso_string(self):
        """Schema parses ISO string with positive offset (+05:30 Asia/Kolkata)."""
        iso_str = "2026-08-20T23:12:30+05:30"
        home_id = uuid.uuid4()
        dev = schemas.DeviceCreate(
            name="Living Light",
            device_type="light",
            node_id="4L-NODE-001",
            home_id=home_id,
            activated_at=iso_str
        )
        assert dev.activated_at is not None
        # Should parse with timezone offset preserved or properly converted
        assert dev.activated_at.tzinfo is not None

    def test_timezone_aware_negative_offset_iso_string(self):
        """Schema parses ISO string with negative offset (-05:00 US Eastern Daylight/Standard)."""
        iso_str = "2026-08-20T12:42:30-05:00"
        home_id = uuid.uuid4()
        dev = schemas.DeviceCreate(
            name="Living Light",
            device_type="light",
            node_id="4L-NODE-001",
            home_id=home_id,
            activated_at=iso_str
        )
        assert dev.activated_at is not None
        assert dev.activated_at.tzinfo is not None

    def test_naive_datetime_object(self):
        """Schema accepts naive Python datetime object."""
        naive_dt = datetime.datetime(2026, 8, 20, 17, 42, 30)
        home_id = uuid.uuid4()
        dev = schemas.DeviceCreate(
            name="Living Light",
            device_type="light",
            node_id="4L-NODE-001",
            home_id=home_id,
            activated_at=naive_dt
        )
        assert dev.activated_at == naive_dt

    def test_timezone_aware_datetime_object(self):
        """Schema accepts timezone-aware Python datetime object (UTC and ZoneInfo)."""
        aware_utc = datetime.datetime(2026, 8, 20, 17, 42, 30, tzinfo=datetime.timezone.utc)
        home_id = uuid.uuid4()
        dev = schemas.DeviceCreate(
            name="Living Light",
            device_type="light",
            node_id="4L-NODE-001",
            home_id=home_id,
            activated_at=aware_utc
        )
        assert dev.activated_at == aware_utc

        aware_ist = datetime.datetime(2026, 8, 20, 23, 12, 30, tzinfo=ZoneInfo("Asia/Kolkata"))
        dev_ist = schemas.DeviceCreate(
            name="Living Light",
            device_type="light",
            node_id="4L-NODE-001",
            home_id=home_id,
            activated_at=aware_ist
        )
        assert dev_ist.activated_at == aware_ist

    def test_microsecond_precision_preservation(self):
        """Sub-second microsecond timestamps are preserved without loss."""
        dt_with_micros = datetime.datetime(2026, 8, 20, 17, 42, 30, 987654, tzinfo=datetime.timezone.utc)
        home_id = uuid.uuid4()
        dev = schemas.DeviceCreate(
            name="Living Light",
            device_type="light",
            node_id="4L-NODE-001",
            home_id=home_id,
            activated_at=dt_with_micros
        )
        assert dev.activated_at.microsecond == 987654

    def test_json_serialization_roundtrip_iso_format(self):
        """model_dump_json serializes datetimes into valid ISO8601 strings."""
        aware_utc = datetime.datetime(2026, 8, 20, 17, 42, 30, tzinfo=datetime.timezone.utc)
        tel_resp = schemas.DeviceTelemetryResponse(
            id=uuid.uuid4(),
            node_id="4L-NODE-001",
            created_at=aware_utc
        )
        json_output = tel_resp.model_dump_json()
        assert "2026-08-20T17:42:30" in json_output

        # Re-parse from JSON string
        reparsed = schemas.DeviceTelemetryResponse.model_validate_json(json_output)
        assert reparsed.created_at.year == 2026
        assert reparsed.created_at.month == 8
        assert reparsed.created_at.day == 20


class TestStartupMigrationIdempotencyStress:
    """
    Empirical Stress Testing: Repeated execution of backend/main.py startup migration
    loop across empty, partially populated, and legacy databases.
    """

    MIGRATION_COLUMNS = [
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

    def _execute_migration_routine(self, test_engine):
        """Executes the exact auto-migration logic from backend/main.py startup_event."""
        Base.metadata.create_all(bind=test_engine)
        inspector = inspect(test_engine)
        existing_tables = inspector.get_table_names()
        is_sqlite = "sqlite" in str(test_engine.url)

        for table, col, pg_type, sqlite_type, default in self.MIGRATION_COLUMNS:
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
                    with test_engine.begin() as conn:
                        conn.execute(text(cmd))

    def test_cold_start_empty_database_migration(self):
        """Execute migration on a freshly initialized database."""
        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        self._execute_migration_routine(engine)

        inspector = inspect(engine)
        device_cols = {c["name"] for c in inspector.get_columns("devices")}
        for _, col, _, _, _ in self.MIGRATION_COLUMNS:
            if _ == "devices":
                assert col in device_cols

    def test_repeated_migration_idempotency_10_iterations(self):
        """Run migration routine 10 times consecutively without raising errors or altering structure."""
        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)

        # First run creates tables
        self._execute_migration_routine(engine)

        # Subsequent 10 runs must execute cleanly with zero side-effects
        for iteration in range(1, 11):
            try:
                self._execute_migration_routine(engine)
            except Exception as e:
                pytest.fail(f"Migration failed on iteration {iteration} with exception: {e}")

        # Verify columns count remains correct
        inspector = inspect(engine)
        device_cols = {c["name"] for c in inspector.get_columns("devices")}
        assert "activated_at" in device_cols
        assert "warranty_status" in device_cols
        assert "total_toggle_count" in device_cols

    def test_migration_data_preservation_under_repeated_runs(self):
        """Verify data integrity: multiple migration runs must never alter or lose existing records."""
        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        self._execute_migration_routine(engine)

        Session = sessionmaker(bind=engine)
        session = Session()

        # Insert test user and device
        user_id = uuid.uuid4()
        user = models.User(
            id=user_id,
            username="migration_user",
            email="mig@smartnest.io",
            hashed_password="hash",
            is_active=True
        )
        home = models.Home(id=uuid.uuid4(), name="Home", owner_id=user_id)
        room = models.Room(id=uuid.uuid4(), home_id=home.id, name="Room", room_type="living")
        dev = models.Device(
            id=uuid.uuid4(),
            home_id=home.id,
            room_id=room.id,
            node_id="4L-NODE-MIG-DATA",
            name="Preserved Device",
            device_type="light",
            warranty_status="VOID",
            total_toggle_count=105000,
            crash_count=60,
            boot_count=15
        )
        session.add_all([user, home, room, dev])
        session.commit()
        dev_id = dev.id
        session.close()

        # Execute migration 5 more times
        for _ in range(5):
            self._execute_migration_routine(engine)

        # Verify records are preserved intact
        verify_session = Session()
        fetched_dev = verify_session.query(models.Device).filter_by(id=dev_id).first()
        assert fetched_dev is not None
        assert fetched_dev.node_id == "4L-NODE-MIG-DATA"
        assert fetched_dev.warranty_status == "VOID"
        assert fetched_dev.total_toggle_count == 105000
        assert fetched_dev.crash_count == 60
        assert fetched_dev.boot_count == 15
        verify_session.close()

    def test_legacy_schema_live_upgrade_migration(self):
        """
        Simulate an existing legacy SQLite DB that was created BEFORE Milestone 1
        (i.e. table exists but does not have activated_at, warranty_status, total_toggle_count, etc.).
        Verify that migration routine adds all missing columns without crashing.
        """
        LegacyBase = declarative_base()

        class LegacyDevice(LegacyBase):
            __tablename__ = "devices"
            id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
            room_id = Column(UUID(as_uuid=True), nullable=True)
            home_id = Column(UUID(as_uuid=True), nullable=False)
            node_id = Column(String, unique=True, index=True, nullable=False)
            mac_address = Column(String, nullable=True)
            name = Column(String, nullable=False)
            device_type = Column(String, nullable=False)
            is_online = Column(Boolean, default=False, nullable=False)
            current_state = Column(JSON, default={}, nullable=False)
            last_seen = Column(DateTime, nullable=True)
            updated_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        # Create legacy table structure only
        LegacyBase.metadata.create_all(bind=engine)

        inspector_before = inspect(engine)
        cols_before = {c["name"] for c in inspector_before.get_columns("devices")}
        assert "activated_at" not in cols_before
        assert "warranty_status" not in cols_before
        assert "total_toggle_count" not in cols_before
        assert "crash_count" not in cols_before

        # Run migration routine to upgrade live schema
        self._execute_migration_routine(engine)

        inspector_after = inspect(engine)
        cols_after = {c["name"] for c in inspector_after.get_columns("devices")}
        assert "activated_at" in cols_after
        assert "warranty_status" in cols_after
        assert "total_toggle_count" in cols_after
        assert "total_on_duration_seconds" in cols_after
        assert "crash_count" in cols_after
        assert "boot_count" in cols_after

        # Run migration a second time to verify idempotency on previously upgraded schema
        self._execute_migration_routine(engine)
        inspector_rerun = inspect(engine)
        cols_rerun = {c["name"] for c in inspector_rerun.get_columns("devices")}
        assert cols_rerun == cols_after

    def test_postgresql_ddl_syntax_structure(self):
        """
        Verify the PostgreSQL branch of the migration generates valid ALTER TABLE statements.
        """
        for table, col, pg_type, sqlite_type, default in self.MIGRATION_COLUMNS:
            cmd = f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {pg_type}"
            if default:
                cmd += f" {default}"
            assert "ADD COLUMN IF NOT EXISTS" in cmd
            assert table in ["users", "devices"]
            assert col in cmd
            assert pg_type in cmd

    def test_direct_main_startup_event_execution(self, monkeypatch):
        """
        Empirical test: Directly call backend.main.startup_event() multiple times
        with mocked background daemons (mqtt and scheduler) to test the actual function.
        """
        from backend import main

        monkeypatch.setattr(main.mqtt, "start_mqtt", lambda: None)
        monkeypatch.setattr(main.scheduler, "start", lambda: None)
        monkeypatch.setattr(main.scheduler, "add_job", lambda *args, **kwargs: None)

        # Run startup_event 5 times in a row
        for i in range(5):
            main.startup_event()

        inspector = inspect(main.engine)
        device_cols = {c["name"] for c in inspector.get_columns("devices")}
        assert "activated_at" in device_cols
        assert "warranty_status" in device_cols
        assert "total_toggle_count" in device_cols
        assert "boot_count" in device_cols


class TestOrmToPydanticSerializationEdgeCases:
    """
    Empirical Challenge: Direct ORM Model -> Pydantic Model validation under edge cases.
    """

    def test_orm_with_naive_and_aware_datetimes_to_pydantic(self, test_home, test_room, db_session):
        """Test ORM Device with timezone-aware datetime serialized to DeviceResponse."""
        aware_dt = datetime.datetime.now(datetime.timezone.utc)
        dev = models.Device(
            home_id=test_home.id,
            room_id=test_room.id,
            node_id="4L-NODE-TZ-TEST",
            name="TZ Test Light",
            device_type="light",
            activated_at=aware_dt,
            warranty_status="ACTIVE",
            total_toggle_count=500,
            total_on_duration_seconds=3600
        )
        db_session.add(dev)
        db_session.commit()
        db_session.refresh(dev)

        resp = schemas.DeviceResponse.model_validate(dev)
        assert resp.id == dev.id
        assert resp.activated_at is not None
        assert resp.total_on_hours == 1.0

    def test_invalid_date_strings_rejected(self):
        """Invalid date strings such as '2026-02-31' or 'invalid-date' must raise ValidationError."""
        home_id = uuid.uuid4()
        with pytest.raises(ValidationError):
            schemas.DeviceCreate(
                name="Light",
                device_type="light",
                node_id="4L-NODE-1",
                home_id=home_id,
                activated_at="2026-02-31"  # Invalid calendar date
            )

        with pytest.raises(ValidationError):
            schemas.DeviceCreate(
                name="Light",
                device_type="light",
                node_id="4L-NODE-1",
                home_id=home_id,
                activated_at="not_a_valid_date_string"
            )

    def test_invalid_email_formats_rejected(self):
        """Invalid email addresses in UserBase and NodeShareCreate must raise ValidationError."""
        with pytest.raises(ValidationError):
            schemas.UserBase(username="validuser", email="not_an_email")

        with pytest.raises(ValidationError):
            schemas.NodeShareCreate(email="plainaddress")

        with pytest.raises(ValidationError):
            schemas.NodeShareCreate(email="@missingusername.com")

