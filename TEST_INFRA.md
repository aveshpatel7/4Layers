# E2E Test Infra: SmartNest Usage Analytics & Warranty Engine

## Test Philosophy
- Opaque-box, requirement-driven. Derives strictly from `ORIGINAL_REQUEST.md`.
- Systematic 4-tier testing: Category-Partition, Boundary Value Analysis (BVA), Pairwise Combinatorial, Real-World Scenarios.
- Pass/fail semantics: zero assertions failed, clean exit code.

## Feature Inventory & Test Coverage Mapping
| # | Feature | Requirement | Tier 1 (Coverage) | Tier 2 (Boundaries) | Tier 3 (Pairwise) | Tier 4 (Workloads) |
|---|---------|-------------|:-----------------:|:-------------------:|:-----------------:|:------------------:|
| 1 | Device Warranty Fields | R1 | 5 tests | 5 tests | ✓ | ✓ |
| 2 | DeviceTelemetry Model | R1 | 5 tests | 5 tests | ✓ | ✓ |
| 3 | Cross-DB Migration | R1 | 5 tests | 5 tests | ✓ | ✓ |
| 4 | NVS Boot Counter & Crash Tracker | R2 | 5 tests | 5 tests | ✓ | ✓ |
| 5 | Toggle & ON Duration Tracker | R2 | 5 tests | 5 tests | ✓ | ✓ |
| 6 | MQTT Telemetry Ingestion | R3 | 5 tests | 5 tests | ✓ | ✓ |
| 7 | Warranty Rules (VOID, EXPIRED, ACTIVE) | R3 | 5 tests | 5 tests | ✓ | ✓ |
| 8 | Usage Analytics API Endpoint | R3 | 5 tests | 5 tests | ✓ | ✓ |
| 9 | User Profiling `is_heavy_user` | R3 | 5 tests | 5 tests | ✓ | ✓ |
| 10 | Admin UI Warranty Tab & Badges | R4 | 5 tests | 5 tests | ✓ | ✓ |
| 11 | CSV Report Export | R4 | 5 tests | 5 tests | ✓ | ✓ |

## Test Architecture
- Test Runner: `pytest backend/tests/test_warranty_analytics.py -v`
- Execution: `uv run --with-requirements requirements.txt --with pytest pytest backend/tests/test_warranty_analytics.py -v`
- Test Files: `backend/tests/test_warranty_analytics.py`, `backend/tests/test_firmware_telemetry_schema.py`
