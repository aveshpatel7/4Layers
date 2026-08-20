# Project: SmartNest / 4Layers IoT Usage Analytics & Automated Warranty Validation

## Architecture
SmartNest/4Layers is a multi-tier IoT smart home ecosystem comprising:
1. **ESP32 Firmware Layer (`4layers_ESP_IDF_Firmware/main/main.cpp`)**:
   - FreeRTOS dual-core multitasking (Core 0: Web server; Core 1: System/GPIO debounce, command queue, MQTT TLS client, NVS commit).
   - Tracks boot count and crash/brownout reasons via NVS and ESP reset reason.
   - Measures channel actuations and cumulative active ON durations.
   - Publishes periodic telemetry JSON to `home/device/{node_id}/telemetry`.
2. **Backend Services Layer (`backend/`)**:
   - FastAPI REST API + SQLAlchemy ORM supporting both SQLite and PostgreSQL.
   - MQTT service (`backend/mqtt.py`) subscribing to `home/device/+/telemetry` and `status` to ingest metrics.
   - Dynamic auto-migration at startup (`backend/main.py`) ensuring zero downtime and database cross-compatibility.
   - Warranty Evaluation Engine (`backend/routes/admin.py`):
     - `VOID` if `total_toggle_count > 100,000` OR `crash_count > 50` (hardware abuse/power surge).
     - `EXPIRED` if `(now - activated_at) > 365 days`.
     - `ACTIVE` if within 1 year and thresholds not breached.
     - User profiling flag `is_heavy_user` (sum of ON hours across all user devices > 5000 hours).
   - Analytics endpoint: `GET /api/admin/analytics/usage` with pagination (`page`, `limit`), search (`q`), and warranty filter (`warranty_status`).
3. **Glassmorphic Admin Console UI Layer (`backend/admin_ui.py`)**:
   - Single-page application rendered by FastAPI admin endpoint.
   - Dedicated "Usage & Warranty Report" tab (`#tab-warranty`).
   - Summary KPI cards (Active, Expired, Void warranties, Total Heavy Users).
   - Glassmorphic data table with sorting, search, pagination, and color-coded status badges.
   - One-click CSV export button generating timestamped legal warranty report.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Device Schema Extension | Add `activated_at`, `warranty_status`, `total_toggle_count`, `total_on_duration_seconds`, `crash_count`, `boot_count` to `Device` | M1 | ORIGINAL_REQUEST §R1 |
| 2 | DeviceTelemetry Model | Create `DeviceTelemetry` model to store timestamped telemetry snapshots | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Cross-DB Startup Migration | Add startup column verification & alteration in `backend/main.py` and `backend/migrations/ddl.sql` for SQLite & PostgreSQL | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Pydantic Schema Updates | Update device and telemetry schemas in `backend/schemas.py` | M1 | ORIGINAL_REQUEST §R1 |
| 5 | NVS Boot Counter & Crash Tracker | Read/write persistent `boot_count` and detect `esp_reset_reason()` crashes in ESP32 firmware | M2 | ORIGINAL_REQUEST §R2 |
| 6 | Channel Toggle & Active Duration Tracking | Track cumulative actuations and active ON duration in seconds/hours per channel in ESP32 firmware | M2 | ORIGINAL_REQUEST §R2 |
| 7 | Periodic MQTT Telemetry Publisher | Periodically publish JSON payload `{"channel": X, "toggles": Y, "on_hours": Z, "boot_count": B, "crash_count": C}` to `home/device/{node_id}/telemetry` | M2 | ORIGINAL_REQUEST §R2 |
| 8 | Telemetry Ingestion Service | Parse telemetry JSON in `backend/mqtt.py` and persist metrics to DB models | M3 | ORIGINAL_REQUEST §R3 |
| 9 | Automated Warranty Rule Engine | Evaluate `VOID`, `EXPIRED`, `ACTIVE` rules with strict precedence (abuse > time) | M3 | ORIGINAL_REQUEST §R3 |
| 10 | Usage Analytics API Endpoint | Implement `GET /api/admin/analytics/usage` with pagination, search, warranty filter, and summary counts | M3 | ORIGINAL_REQUEST §R3 |
| 11 | User Profiling `is_heavy_user` | Calculate user-level cumulative ON hours across all devices (>5000 hrs = true) | M3 | ORIGINAL_REQUEST §R3 |
| 12 | Admin Console Warranty Tab | Add "Usage & Warranty Report" navigation item and glassmorphic UI section in `backend/admin_ui.py` | M4 | ORIGINAL_REQUEST §R4 |
| 13 | Interactive Table & Badges | Render glassmorphic data table with green (`ACTIVE`), red (`VOID`), grey (`EXPIRED`), and orange (`Heavy User`) badges | M4 | ORIGINAL_REQUEST §R4 |
| 14 | One-Click CSV Export | Client-side/server-side CSV export button downloading complete formatted warranty report | M4 | ORIGINAL_REQUEST §R4 |
| 15 | E2E Opaque-Box Test Suite | Comprehensive 4-tier E2E test suite verifying backend, firmware telemetry parsing, warranty engine, and UI report | M5 / Test Track | ORIGINAL_REQUEST Acceptance Criteria |
| 16 | Adversarial Hardening & Audit | Adversarial edge-case verification and non-bypassable Forensic Integrity Audit | M5 / Audit | Orchestration Pattern |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Database Schema & Data Models | `backend/models.py`, `backend/main.py`, `backend/migrations/ddl.sql`, `backend/schemas.py` | none | PLANNED |
| M2 | ESP32 Firmware Telemetry & Boot Tracking | `4layers_ESP_IDF_Firmware/main/main.cpp` | none | PLANNED |
| M3 | Backend Analytics & Warranty Evaluation Engine | `backend/routes/admin.py`, `backend/routes/devices.py`, `backend/mqtt.py` | M1 | PLANNED |
| M4 | Glassmorphic Admin Console & CSV Export | `backend/admin_ui.py` | M3 | PLANNED |
| M5 | E2E Testing, Adversarial Hardening & Forensic Audit | `backend/tests/test_warranty_analytics.py`, `TEST_INFRA.md`, full suite verification | M1, M2, M3, M4 | PLANNED |

## Interface Contracts

### 1. ESP32 Firmware -> MQTT Telemetry Topic
- **Topic**: `home/device/{node_id}/telemetry`
- **Payload Schema**:
```json
{
  "node_id": "SN-001A2B3C",
  "channel": 1,
  "toggles": 12450,
  "on_duration_seconds": 36000,
  "on_hours": 10.0,
  "boot_count": 42,
  "crash_count": 2,
  "rssi": -65,
  "uptime_seconds": 3600
}
```

### 2. Backend Usage Analytics API
- **Endpoint**: `GET /api/admin/analytics/usage`
- **Headers**: `Authorization: Bearer <admin_jwt_token>`
- **Query Params**:
  - `page`: int (default: 1)
  - `page_size` or `limit`: int (default: 50, max: 200)
  - `search` or `q`: str (optional, matches email, name, node_id, mac_address)
  - `filter_warranty` or `warranty_status`: str (optional: `ACTIVE`, `VOID`, `EXPIRED`, `UNKNOWN`)
- **Response Schema**:
```json
{
  "total_records": 100,
  "page": 1,
  "page_size": 50,
  "total_pages": 2,
  "summary": {
    "total_devices": 100,
    "active_count": 80,
    "expired_count": 15,
    "void_count": 5,
    "heavy_user_count": 12
  },
  "items": [
    {
      "user_id": 1,
      "user_email": "user@smartnest.io",
      "user_name": "John Doe",
      "is_heavy_user": false,
      "user_total_on_hours": 1240.5,
      "device_id": 10,
      "node_id": "SN-001A2B3C",
      "device_name": "Living Room Light",
      "device_type": "switch_4ch",
      "channel": 1,
      "total_toggle_count": 12450,
      "total_on_duration_seconds": 36000,
      "total_on_hours": 10.0,
      "crash_count": 2,
      "boot_count": 42,
      "activated_at": "2026-01-15T08:30:00Z",
      "warranty_status": "ACTIVE",
      "warranty_reason": "Within 1 year (217 days remaining), counters within normal limits"
    }
  ]
}
```

### 3. Warranty Rule Decision Matrix
| Condition | Evaluated Status | Priority |
|-----------|------------------|----------|
| `total_toggle_count > 100,000` OR `crash_count > 50` | `VOID` | 1 (Highest - hardware abuse / electrical surge) |
| `(current_date - activated_at) > 365 days` | `EXPIRED` | 2 (Time expiration) |
| Otherwise | `ACTIVE` | 3 (Normal active coverage) |

## Code Layout
- `backend/models.py`: Database tables and enum definitions (`Device`, `DeviceTelemetry`, `WarrantyStatus`).
- `backend/schemas.py`: Pydantic models for analytics and device schemas.
- `backend/main.py`: Startup DB table initialization and automatic migration.
- `backend/migrations/ddl.sql`: Initial PostgreSQL schema definitions.
- `4layers_ESP_IDF_Firmware/main/main.cpp`: ESP32 firmware source with NVS boot count, toggle/duration tracking, and MQTT telemetry.
- `backend/mqtt.py`: MQTT listener & telemetry processor.
- `backend/routes/admin.py`: Admin API router with `/api/admin/analytics/usage`.
- `backend/routes/devices.py`: Device API router.
- `backend/admin_ui.py`: Embedded Admin Console HTML/CSS/JS with Usage & Warranty tab.
- `backend/tests/`: Pytest test suite and E2E validation.
