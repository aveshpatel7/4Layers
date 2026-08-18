# Original User Request

## Initial Request — 2026-08-17T14:45:01Z

Fix the "Switchboard Offline" flicker, SSL/TLS handshake failures (rc=-2), MQTT JSON parsing crashes, and bulk action drops across the ESP32 firmware, React Native mobile app, and FastAPI backend.

Working directory: c:\Users\andyk\Desktop\SmartNest
Integrity mode: development

## Requirements

### R1. ESP32 Firmware: SSL/TLS Heap Optimization & Stack Allocation
- Optimize heap allocation on ESP32 to prevent TLS handshake failure (`rc=-2`, error `-29184: SSL - An invalid SSL record was received`).
- Reduce stack sizes of tasks (`webserver_task` and `mqtt_task`) to safe sizes (e.g. 4KB) while maintaining stability.
- Free up memory before `client.connect()` and log `ESP.getFreeHeap()` during connection attempts.
- Maintain strict non-blocking 15s retry logic on Core 1 so the Local Web Server on Core 0 never starves or freezes.

### R2. ESP32 Firmware: Robust MQTT JSON Handling & Raw Error Logging
- Ensure `deserializeJson` in MQTT callback handles malformed or unexpected payloads gracefully without crashing or silently dropping.
- If JSON deserialization fails (`DeserializationError::InvalidInput`), print the exact raw payload string to the Serial Monitor for diagnostics.

### R3. ESP32 Firmware: Bulk Action Queueing
- Replace the dropping of commands during in-flight bulk actions with a FreeRTOS Queue mechanism.
- If a bulk action is executing, buffer incoming channel toggle requests into the queue and process them sequentially upon completion.

### R4. Mobile App: Local-First Status & Offline Resilience
- In `DashboardScreen.js`, do not flag devices as "Offline" solely based on Cloud/MQTT disconnection if the phone is connected to Wi-Fi and a valid `local_ip` is known.
- Attempt a fast local HTTP ping (`/state`) first. Only display the "Switchboard Offline" warning if both Cloud AND Local LAN pings fail.
- Prioritize direct Local LAN HTTP control (`sendLocalControlCommand`) for all control toggles and adjustments when local IP is reachable.

### R5. Backend: Command Payload Schema Consistency
- Verify all MQTT control payloads published by `backend/mqtt.py` and `backend/routes/devices.py` adhere strictly to the JSON schema expected by the firmware (`channel`, `status`/`state`, `speed`, `action`).

---

## Acceptance Criteria

### ESP32 Firmware Stability
- [ ] ESP32 boots, connects to Wi-Fi, and maintains free heap above 40KB during SSL connection attempts.
- [ ] Serial logs report free heap and do not encounter SSL record error `-29184`.
- [ ] Malformed MQTT messages log raw payload without crashing.
- [ ] Rapid consecutive channel toggles are queued and processed without "Bulk action already in progress! Ignoring command" drops.
- [ ] Local web server on Core 0 responds to `/state` and `/control` in < 20ms even when Cloud MQTT is reconnecting.

### Mobile App Local-First Resilience
- [ ] When Cloud is simulated disconnected or offline, app continues controlling devices over Local LAN if on same Wi-Fi.
- [ ] "Switchboard Offline" warning only appears when both Local LAN ping and Cloud connection fail.
- [ ] Browser console logs `[LOCAL DEBUG]` verifying local HTTP requests and states.

### Backend Payload Conformance
- [ ] Backend control and bulk-control endpoints generate valid, well-formed JSON payloads matching ESP32 firmware expectations.
