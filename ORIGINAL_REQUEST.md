# Original User Request

## 2026-08-20T17:42:30Z

Build an end-to-end IoT Usage Analytics & Automated Warranty Validation system for the SmartNest/4Layers ecosystem.

Working directory: c:\Users\andyk\Desktop\SmartNest
Integrity mode: development

## Requirements

### R1. Database Schema & Data Models (backend/models.py & migrations)
- Extend the `Device` model with `activated_at` (DateTime, defaults to first provision/creation date) and `warranty_status` (Enum: `ACTIVE`, `VOID`, `EXPIRED`, `UNKNOWN`).
- Extend telemetry/state tracking in `DeviceTelemetry` or channel models with `total_toggle_count`, `total_on_duration_seconds` (or hours), and `crash_count` (Integer).
- Add support for recording cumulative boot counts and brownout/crash counters per physical board.

### R2. ESP32 Firmware Telemetry & Boot Tracking (4layers_ESP_IDF_Firmware/main/main.cpp)
- Persist `boot_count` in non-volatile storage (NVS) using ESP32 Preferences/NVS API; increment on each boot and publish in telemetry JSON payload.
- Measure cumulative channel toggles and calculate active ON duration per channel.
- Periodically publish telemetry payload including `{"channel": X, "toggles": Y, "on_hours": Z, "boot_count": B}` to MQTT topic.

### R3. Backend Analytics & Warranty Evaluation Engine (backend/routes/admin.py & backend/routes/devices.py)
- Ingest and aggregate firmware telemetry (cumulative toggles, active ON hours, and crash/boot counts).
- Implement warranty rule engine:
  - `VOID` if `total_toggle_count > 100,000` OR `crash_count > 50` (hardware abuse / unstable power).
  - `EXPIRED` if `activated_at` is older than 1 year (365 days) from current date.
  - `ACTIVE` if within 1 year and thresholds are not breached.
- Expose `GET /api/admin/analytics/usage` endpoint supporting pagination (`page`, `page_size`, `search`, `filter_warranty`), returning aggregated rows: User Email, Device ID, Switch/Channel Name, Toggle Count, ON Hours, Crash Count, Activated Date, and Warranty Status.
- Add user profiling flag `is_heavy_user` (True if total ON Hours > 5000 across user's devices) for subscription monetization targeting.

### R4. Glassmorphic Admin Console: Usage & Warranty Report (backend/admin_ui.py)
- Add a new dedicated tab/section: **"Usage & Warranty Report"** in the Admin Console.
- Render interactive glassmorphic data table displaying: User | Device | Channel | Toggles | Total ON Hours | Crashes | Activated On | Warranty Status Badge.
- Color-code Warranty Status: Green badge (`ACTIVE`), Red badge (`VOID`), Grey badge (`EXPIRED`).
- Add a one-click **"Export Warranty Report (CSV)"** button that generates and downloads a clean, legally-formatted CSV report containing all aggregated fields and calculated status.

## Acceptance Criteria

### Backend & Database Integrity
- [ ] `models.py` schema compiles and loads cleanly with SQLite and PostgreSQL compatibility.
- [ ] `GET /api/admin/analytics/usage` returns 200 OK with correct schema, pagination metadata, and warranty classification.
- [ ] Warranty rule engine correctly marks records with >100,000 toggles or >50 crashes as `VOID`, >365 days as `EXPIRED`, and normal records as `ACTIVE`.
- [ ] `is_heavy_user` flag correctly evaluates to true when cumulative usage exceeds 5000 ON hours.

### ESP32 Firmware Telemetry
- [ ] ESP32 firmware reads, increments, and commits `boot_count` to NVS without memory leaks.
- [ ] Periodic telemetry publishing includes channel toggles, ON duration, and boot count in MQTT JSON payload.

### Admin Console & Reporting
- [ ] Admin UI renders the "Usage & Warranty Report" tab with real-time aggregated data.
- [ ] CSV Export button downloads valid CSV file matching table data with timestamps and status headers.
- [ ] `python -m py_compile` passes with zero errors on all modified backend files.
