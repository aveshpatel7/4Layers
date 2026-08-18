# E2E Test Infra: SmartNest

## Test Philosophy
- Requirement-driven, opaque-box testing covering all requirements in `ORIGINAL_REQUEST.md`.
- Methodologies: Category-Partition, Boundary Value Analysis, Pairwise Combinatorial Testing, Real-World Workload Testing.

## Feature Inventory & Test Mapping
| # | Feature | Requirement | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (Workloads) |
|---|---------|-------------|:----------------:|:-----------------:|:-----------------:|:------------------:|
| 1 | ESP32 TLS Heap & Stacks | R1 | 5 tests | 5 tests | ✓ | ✓ |
| 2 | ESP32 Non-blocking Webserver | R1 | 5 tests | 5 tests | ✓ | ✓ |
| 3 | ESP32 MQTT JSON & Diagnostics | R2 | 5 tests | 5 tests | ✓ | ✓ |
| 4 | ESP32 FreeRTOS Queueing | R3 | 5 tests | 5 tests | ✓ | ✓ |
| 5 | Mobile Local-First Offline Gating | R4 | 5 tests | 5 tests | ✓ | ✓ |
| 6 | Mobile `/state` Schema & Cache | R4 | 5 tests | 5 tests | ✓ | ✓ |
| 7 | Mobile Local LAN HTTP Control | R4 | 5 tests | 5 tests | ✓ | ✓ |
| 8 | Backend Payload Consistency | R5 | 5 tests | 5 tests | ✓ | ✓ |
| 9 | Backend Offline Timeout & Routes | R5 | 5 tests | 5 tests | ✓ | ✓ |

## Test Architecture
- **Runner**: Automated pytest runner (`backend/tests/`) running via `uv run --with-requirements requirements.txt --with pytest pytest backend/tests -v`.
- **Fixtures & Mocks**: Fast HTTP mock server, MQTT broker/client mocks, ESP32 mock simulation, and test payloads.
- **Pass/Fail**: All tests must exit with code 0 and 100% assertions passing.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Expected Outcome |
|---|----------|--------------------|------------------|
| S1 | Cloud MQTT Disconnection during Rapid Local Toggles | F1, F2, F4, F5, F7 | Local HTTP responds <20ms; all toggles processed; no offline warning flicker. |
| S2 | Malformed MQTT Burst followed by Valid Fan Control | F3, F8 | Raw payload logged; no crash; fan speed updated cleanly with `"speed"` key. |
| S3 | Multi-Board Switchboard Room with Staggered Reconnects | F4, F5, F6, F9 | All boards discovered on local LAN; cached state rendered seamlessly. |
| S4 | Master All-ON Triggered Concurrently with Channel 1..4 Toggles | F4, F8 | All toggles queued and applied sequentially without drops. |
| S5 | Schedule Execution for Channel 5 Fan Speed via Backend MQTT | F8, F9 | Backend publishes `{"channel": 5, "status": "ON", "speed": 3}`; firmware consumes properly. |
