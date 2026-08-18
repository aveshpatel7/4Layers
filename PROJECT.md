# Project: SmartNest

## Architecture
SmartNest is a multi-tier IoT smart switchboard ecosystem composed of:
1. **ESP32 Firmware**: Dual-core FreeRTOS architecture. Core 0 hosts the high-priority Local HTTP Web Server (`/state`, `/control`) and Wi-Fi stack. Core 1 runs the MQTT client task (TLS communication with Cloud Broker) and system/queue processing tasks.
2. **React Native Mobile App**: Cross-platform control UI. Local-first architecture prioritizing direct LAN HTTP control when on local Wi-Fi, with fallback to Cloud MQTT/REST. Offline status warning triggers only when both Local LAN and Cloud reachability fail.
3. **FastAPI Backend & MQTT Broker**: Cloud coordination layer. Normalizes device control payloads, manages device registration and heartbeat state, and brokers commands between clients and hardware.

```
+-------------------------------------------------------------------------+
|                           SmartNest Architecture                        |
+-------------------------------------------------------------------------+
|                                                                         |
|   +-----------------------+              +--------------------------+   |
|   |  React Native App     |              |     FastAPI Backend      |   |
|   |  (Local-First UI)     |              |     (Cloud Services)     |   |
|   +-----------+-----------+              +------------+-------------+   |
|               |                                       |                 |
|     Local LAN | Fast HTTP Ping / Control              | MQTT TLS        |
|     (Core 0)  | (/state, /control)                    | (Core 1)        |
|               v                                       v                 |
|   +-----------------------------------------------------------------+   |
|   |                     ESP32 Dual-Core Firmware                    |   |
|   |   Core 0: Web Server (Priority 5, <5ms local control)           |   |
|   |   Core 1: MQTT Client (Priority 2), Command Queue Buffer        |   |
|   |           mbedTLS Dynamic Buffer, Free Heap Monitoring (>40KB)  |   |
|   +-----------------------------------------------------------------+   |
+-------------------------------------------------------------------------+
```

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | TLS Heap Optimization & Task Stacks | Reduce task stacks (`webserver_task`, `mqtt_task` to 4KB), call `espClient.stop()` before connect, log `ESP.getFreeHeap()`, enable `CONFIG_MBEDTLS_DYNAMIC_BUFFER=y` to prevent `rc=-2` (-29184). | M1 | R1 |
| F2 | Core 0 Non-Blocking Starvation Prevention | Ensure 15s MQTT reconnect backoff runs non-blocking on Core 1 so Core 0 webserver responds in < 20ms at all times. | M1 | R1 |
| F3 | Robust MQTT JSON & Raw Error Logging | Graceful `deserializeJson` handling with verbatim raw payload logging to Serial on `DeserializationError::InvalidInput`. | M1 | R2 |
| F4 | Bulk Action FreeRTOS Command Queueing | Static FreeRTOS `command_queue` (depth 16) to buffer and sequentially execute rapid toggles without "Bulk action already in progress! Ignoring command" drops. | M1 | R3 |
| F5 | Mobile Local-First Offline Gating | `DashboardScreen.js` shows "Switchboard Offline" ONLY if both Local LAN ping (`/state`) and Cloud connection fail when on Wi-Fi. | M2 | R4 |
| F6 | Mobile `/state` Schema Parser & Multi-Node Fallback | Fix mobile `/state` parser for `channel_1..5` and `speed`, iterate all cached devices in offline catch block. | M2 | R4 |
| F7 | Mobile Local LAN Control Priority & Debug Logging | Prioritize direct `sendLocalControlCommand` when local IP is reachable; emit `[LOCAL DEBUG]` console logs. | M2 | R4 |
| F8 | Backend MQTT Payload Normalization | Ensure `backend/mqtt.py` & `backend/routes/devices.py` publish consistent JSON schema (`channel`, `status`: "ON"/"OFF", `speed`, `value`) for single and bulk control. | M3 | R5 |
| F9 | Backend Inactivity Timeout & Route Fixes | Adjust heartbeat offline timeout to 3 min; fix `models.Device` query in `voice_assistant.py` (join `Home`). | M3 | R5 |
| F10 | Comprehensive Test Suite & Acceptance Verification | Requirement-driven test suite (Tiers 1-4) covering all firmware, mobile, and backend acceptance criteria. | M4 | AC |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | ESP32 Firmware Fixes | `4layers_ESP_IDF_Firmware/main/main.cpp`, `sdkconfig.defaults`, `4layers_V12_5_Firmware/4layers_V12_5_Firmware.ino` | Survey Complete | DONE (Gate PASS, FreeRTOS queue & TLS heap verified) |
| M2 | Mobile App Local-First Resilience | `mobile/src/screens/DashboardScreen.js`, `mobile/src/services/localControl.js` | M1 Contract | DONE (Gate PASS, local-first gating verified) |
| M3 | Backend Schema Consistency | `backend/mqtt.py`, `backend/routes/devices.py`, `backend/main.py`, `backend/routes/voice_assistant.py`, `mock_device.py` | M1 Contract | DONE (Gate PASS, 128 tests passed) |
| M4 | E2E Integration & Verification | `backend/tests/`, test runners, end-to-end multi-tier verification | M1, M2, M3 | IN_PROGRESS (sub_orch_m4_e2e) |

---

## Interface Contracts

### 1. ESP32 Local HTTP Interface (Core 0)
- **`GET /state`**:
  - Response (JSON 200 OK):
    ```json
    {
      "node_id": "4L-NODE-123",
      "local_ip": "192.168.1.50",
      "channel_1": "ON",
      "channel_2": "OFF",
      "channel_3": "OFF",
      "channel_4": "OFF",
      "channel_5": "ON",
      "speed": 3,
      "all_state": "MIXED"
    }
    ```
- **`GET /control?channel={1..6}&status={ON|OFF}&speed={1..5}`**:
  - Query parameters:
    - `channel`: integer `1..6` (1..4: relays, 5: fan, 6: master)
    - `state` or `status`: string `"ON"` | `"OFF"`
    - `speed`: integer `1..5` (for channel 5)
  - Response: JSON 200 OK `{"success": true, "channel": 1, "state": "ON"}`

### 2. Cloud MQTT Control Interface (Core 1)
- **Topic**: `home/device/{node_id}/control`
- **Payload Schema**:
  ```json
  {
    "channel": 1,
    "status": "ON"
  }
  ```
  For Fan (Channel 5):
  ```json
  {
    "channel": 5,
    "status": "ON",
    "speed": 3
  }
  ```
  For Bulk/Master (Channel 6):
  ```json
  {
    "channel": 6,
    "status": "ON"
  }
  ```

### 3. Cloud MQTT Telemetry / Heartbeat Interface
- **Topic**: `home/device/{node_id}/status`
- **Payload Schema**:
  ```json
  {
    "node_id": "4L-NODE-123",
    "local_ip": "192.168.1.50",
    "free_heap": 48210,
    "channel_1": "ON",
    "channel_2": "OFF",
    "channel_3": "OFF",
    "channel_4": "OFF",
    "channel_5": "ON",
    "speed": 3
  }
  ```

---

## Code Layout
- **ESP32 Firmware**:
  - `4layers_ESP_IDF_Firmware/main/main.cpp` — Main ESP-IDF application entry, FreeRTOS tasks, MQTT & webserver callbacks.
  - `4layers_ESP_IDF_Firmware/sdkconfig.defaults` — ESP-IDF build defaults (mbedTLS dynamic buffer).
  - `4layers_V12_5_Firmware/4layers_V12_5_Firmware.ino` — Arduino reference firmware.
- **Mobile Application**:
  - `mobile/src/screens/DashboardScreen.js` — Main dashboard screen, status evaluation, local ping fallback.
  - `mobile/src/services/localControl.js` — Local LAN HTTP ping and control service.
- **FastAPI Backend**:
  - `backend/mqtt.py` — MQTT client management, publish_control_message payload formatting.
  - `backend/routes/devices.py` — REST endpoints for device control and bulk control.
  - `backend/main.py` — Background tasks, heartbeat checker.
  - `backend/routes/voice_assistant.py` — Voice assistant route querying device ownership.
  - `mock_device.py` — Hardware simulator for testing.
  - `backend/tests/` — Automated test suite.
