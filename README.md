# 🏠 4Layers: Enterprise IoT Home Automation

**FastAPI | PostgreSQL (Supabase) | React Native (Expo) | MQTT (EMQX) | ESP32**

4Layers SmartNest is a production-ready, full-stack IoT platform designed to manage smart appliances (Lights, Fans, ACs, Outlets) in real-time. Built with a focus on bulk manufacturing, thread-safe asynchronous concurrency, and premium modern UI/UX design.

---

## ✨ Key Highlights & Features

*   **📱 4Layers (Google Stitch) Mobile Redesign:** Overhauled the React Native application using a premium, dark-mode visual aesthetic with vibrant neon-green accents, glassmorphic cards, custom capsule switches, and strict status-bar safe-area configurations.
*   **📶 Native Wi-Fi Settings Redirection:** Added an **"Open Wi-Fi Settings"** action during Bluetooth provisioning, allowing users to open their phone's native Wi-Fi panel directly for quick network switching.
*   **🔌 Custom Device Type Registry:** Replaced rigid segmented buttons with a manual text input for "Device Type", letting users provision custom appliance types (e.g. `light`, `fan`, `ac`, `geyser`, `tv`).
*   **🔄 True Real-Time Sync:** Mobile application communicates with a single source of truth. Device state changes and telemetry sync instantly via a high-performance MQTT pipeline.
*   **🏭 Flash-Once Firmware Architecture:** Supports bulk manufacturing. ESP32 firmware requires zero hardcoding; devices are provisioned dynamically via BLE and get their credentials at runtime.
*   **🛡️ Anti-Hijacking Security:** Hardware MAC addresses are strictly bound to user accounts on the Supabase PostgreSQL database to prevent unauthorized device claims.
*   **🧵 Async-Safe MQTT Pipeline:** FastAPI's async event loop is isolated from blocking MQTT client loop operations using thread execution, ensuring server responsiveness.
*   **💀 LWT Auto-Offline Tracking:** Implements MQTT Last Will and Testament. If a device loses power, the backend automatically sets it "Offline" in the database and updates all connected client UIs.

---

## 🏗️ System Architecture & Connection Flow

SmartNest uses a secure 3-way handshake for onboarding new hardware:

```text
[ ESP32 Device ]                       [ Mobile App (BLE) ]                      [ FastAPI Backend (Render) ]
      |                                       |                                       |
      |-- 1. Broadcasts BLE "SmartNest" ----->|                                       |
      |                                       |-- 2. Redirects to System Wi-Fi settings|
      |                                       |      to connect/select network        |
      |                                       |                                       |
      |                                       |-- 3. Transmits SSID & Password over   |
      |<-- 4. Receives Wi-Fi credentials -----|      BLE characteristics              |
      |                                       |                                       |
      |                                       |-- 5. Submits MAC Address & Type ----->|
      |                                       |<-- 6. Confirms registry & response ---|
      |                                                                               |
      |-- 7. Connects to local Wi-Fi Router & EMQX MQTT Broker (broker.emqx.io) ----->|
      |-- 8. Subscribes to: smartnest/devices/{NodeID}/control ---------------------->|
      |-- 9. Publishes confirmation to: smartnest/devices/{NodeID}/status ----------->|
```

---

## 🛠️ Tech Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend** | Python 3.12, FastAPI, Uvicorn | High-performance async REST API hosted on Render |
| **Database** | PostgreSQL 15+ (Supabase) | Reliable concurrent storage with custom relational tables |
| **IoT Protocol** | Paho-MQTT, EMQX Public Broker | Asynchronous device control & telemetry |
| **Mobile App** | Expo SDK 51, React Native Paper | 4Layers Stitch-designed cross-platform interface |
| **Hardware Comms** | BLE (react-native-ble-plx) | Secure local device provisioning |

---

## 📁 Project Structure

```text
SmartNest/
├── backend/
│   ├── main.py            # FastAPI app entry, lifespan hooks, and scheduler
│   ├── database.py        # SQLAlchemy postgres engine & async sessions
│   ├── mqtt.py            # Thread-safe MQTT client, LWT listener, and state sync
│   ├── models.py          # SQLAlchemy models (Users, Devices, Rooms, Schedules, Alerts)
│   ├── schemas.py         # Pydantic request/response validation schemas
│   ├── auth.py            # JWT authentication & bcrypt password hashing
│   └── routes/
│       ├── users.py       # Register, login, and profile APIs
│       └── devices.py     # Provisioning, control, and room CRUD operations
├── mobile/                # React Native Expo Mobile App
│   ├── src/
│   │   ├── api/           # client.js (axios setup pointing to Render server)
│   │   ├── screens/       # ProvisioningScreen.js (BLE & Manual), DashboardScreen.js
│   │   └── navigation/    # AppNavigator.js (Custom green header stack)
└── app.json               # Expo configuration & BLE permissions
```

---

## ⚡ API Endpoints Overview

### User Routes (`/api/users`)
*   `POST /register` - Create a new account
*   `POST /login` - Retrieve JWT token
*   `GET /me` - Fetch authenticated user profile details

### Device & Room Routes (`/api/devices`)
*   `POST /provision` - Secure BLE provisioning endpoint (registers MAC & device channels)
*   `GET /` - List all registered user devices with live `is_online` status
*   `POST /{device_id}/control` - Send MQTT state commands to hardware relays
*   `DELETE /rooms/{room_id}` - Delete room and cascade delete associated devices

---

## 🚀 Installation & Local Run

### 1. Backend Setup
1. Clone the repository and navigate to the project directory.
2. Copy `.env.example` to `.env` and fill in your Supabase Postgres database connection string and JWT secret.
3. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
4. Run the FastAPI development server:
   ```bash
   uvicorn backend.main:app --reload
   ```

### 2. Mobile App Setup
1. Go to the `mobile/` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run on a simulator or physical testing device:
   ```bash
   npx expo start
   ```

---

## 🤝 Hardware Integration Guidelines

When connecting custom hardware (like an ESP32), follow these rules:
1. **No Hardcoded UUIDs:** Read credentials from NVS (Non-volatile storage) written during BLE provisioning.
2. **QoS Levels:** Use QoS 1 for Commands subscription to guarantee delivery, and QoS 0 for Status logs.
3. **Last Will and Testament (LWT):** Configure LWT message `{"is_online": false}` on topic `smartnest/devices/{NodeID}/status` so the backend knows when power is disconnected.

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.
