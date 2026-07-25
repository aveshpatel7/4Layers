# 4Layers SmartNest — Antigravity / AI Studio Prompts

> Yeh file tumhare liye hai. Har task ka ek **ready-to-paste prompt** hai.
> Antigravity (Gemini) mein ek-ek karke paste karo. Pehle **MASTER CONTEXT** paste karo,
> phir us ke neeche us task ka prompt. Antigravity files khud padh/edit kar lega.
>
> AI Studio (sirf chat, files nahi) = sirf standalone code generate karne ke liye.
> Asli file editing ke liye **Antigravity** use karo.

---

## 📦 PROJECT FACTS (quick reference)

- **Project:** 4Layers Home Automation (repo name: SmartNest)
- **Local path:** `C:\Users\andyk\Desktop\SmartNest`
- **GitHub:** https://github.com/MD-NAVED/SmartNest
- **Backend (LIVE):** https://smartnest-3jr4.onrender.com  (docs: `/docs`)
- **Stack:** FastAPI + PostgreSQL (Supabase) + MQTT (EMQX) | Mobile: React Native + Expo | Dashboard: React + Vite
- **Theme:** Black `#0D0D0D` + Green `#22C55E` (white text, dark cards)
- **Folders:** `backend/`  `mobile/`  `dashboard/`

### 🎯 FINAL DELIVERABLE (client ko sirf yeh chahiye)
1. **Mobile App (APK)** — ek hi normal UI, brand name "4Layers" same.
2. **API Docs** (`https://smartnest-3jr4.onrender.com/docs`) — user activity ke liye.

> **Dashboard alag se deploy NAHI karna.** `dashboard/` ab sirf **reference** hai —
> uske saare features uthha ke **mobile App mein merge** karne hain. Bas.

### ⚡ GOAL = WORKING DEMO (kal client ko dikhana hai)
Priority is a smooth happy-path demo that visibly works — NOT production perfection.
Fine-tuning + reliability baad mein (client AWS pe migrate karega, isliye Render
free-tier sleep abhi koi issue nahi). Har feature "kaam karta dikhe" — bas itna kaafi.

---

## ✅ PROGRESS TRACKER

### Already DONE
- [x] Backend live: Auth (register / login JWT / `/me`), Homes CRUD, Rooms CRUD, Devices (add/list/delete/control via MQTT/history), Device History
- [x] Mobile base: theme, navigation (Login/Register → Tabs: Home + History), Login, Register, Dashboard, AddDevice, History screens, Auth context + JWT interceptor + auto-logout
- [x] **APK crash fix** — `mobile/src/components/DeviceCard.js` mein `isEnabled` ko strict boolean banaya (accessibilityState null fix)
- [x] **P0-A** `mobile/src/api/client.js` → production URL (`USE_LOCAL_BACKEND = false`)
- [x] **P0-B** Dashboard → Mobile **feature parity audit** (kya-kya dashboard mein hai jo app mein missing hai)
- [x] **P1** Settings page (mobile) + backend profile-update / change-password
- [x] **P2** Multi-room management UI (add / delete / select room)
- [x] **P3** Master Switch (sab devices on/off)
- [x] **P4** Add Device via QR / Barcode (UUID + password) + manual fallback
- [x] **P5** Schedules (backend table + APScheduler + mobile UI)
- [x] **P6** Alerts / Notifications (backend table + mobile UI)
- [x] **P7** Deploy: **APK → EAS build only** (dashboard deploy NAHI — sirf reference hai)

- [x] **P8** UI Polish — room-chip fix + plain wording + real stats (committed: style(ui) 1007dd3)
- [x] **P9** Global **Event History endpoint** (`GET /api/history`) — client ko /docs pe poori user activity dikhe

### ⏭️ RESUME POINT
All feature tasks (P0 through P9) are fully implemented, verified, and checked off!
Backend live + deployed (with schedules, alerts, bulk control, and global event history). Mobile app base, UI polish, settings, alerts, and schedules fully done.
Ready for EAS Android preview compilation.

---

# 🧩 MASTER CONTEXT  (har naye Antigravity chat ke shuru mein ek baar paste karo)

```
You are working on "4Layers SmartNest", an IoT home automation system.
Project root: C:\Users\andyk\Desktop\SmartNest  (folders: backend/, mobile/, dashboard/)

Stack:
- Backend: FastAPI + PostgreSQL (Supabase) + MQTT (EMQX). LIVE at https://smartnest-3jr4.onrender.com (API docs at /docs).
- Mobile: React Native + Expo.
- Dashboard: React + Vite.

Brand theme (MUST follow): background #0D0D0D (near-black), primary/accent green #22C55E, white text, dark cards. Match the existing styling used in mobile/src/components/DeviceCard.js.

Rules:
1. ALWAYS read the relevant existing files first before editing. Match existing code style, naming, and patterns.
2. Do NOT break existing working features (auth, device control, MQTT).
3. Reuse the existing API client (mobile/src/api/client.js) and Auth context for any network/auth calls.
4. Keep changes minimal and focused on the task. Show me the final files.
5. The backend already has: Auth (register/login JWT, /me), Homes CRUD, Rooms CRUD, Devices (add/list/delete/control via MQTT/history). Reuse these; only add new endpoints when the task explicitly needs them.
6. FINAL PRODUCT = ONE mobile app (Android APK). The dashboard/ folder is REFERENCE ONLY — we are porting its features INTO the mobile app. Do NOT build/deploy the dashboard. When a task says "match the dashboard", read dashboard/src to copy the behavior/UX into mobile.

Acknowledge you understand, then wait for my task.
```

---

# 🚀 PROMPT P0-A — API client production URL

```
TASK: Point the mobile app to the live backend.

File: mobile/src/api/client.js
- Read it first.
- Set USE_LOCAL_BACKEND = false so the app uses the Render URL https://smartnest-3jr4.onrender.com instead of the local PC IP.
- Do not change anything else. Confirm the resolved baseURL prints the Render URL.
```

---

# 🚀 PROMPT P0-B — Dashboard → Mobile feature parity audit

```
TASK: We are merging everything into ONE mobile app. The dashboard/ folder will NOT be deployed — it is only a reference. I need a clear checklist of which dashboard features still need to be ported into the mobile app.

Do this (read-only, do not edit code yet):
1. Read dashboard/src and list EVERY user-facing feature/screen/widget it has (e.g. device grid, room selector, schedules, bluetooth provisioning, charts/stats, master switch, alerts, settings, etc.).
2. Read mobile/src and list what the mobile app currently has.
3. Output a table: Feature | In Dashboard? | In Mobile? | Notes.
4. For each feature that is in the dashboard but MISSING in mobile, say which of my planned prompts (P1 Settings, P2 Rooms, P3 Master Switch, P4 QR Add-Device, P5 Schedules, P6 Alerts) will cover it — and flag anything NOT covered by those, so I can add a prompt for it.

Give me only the audit. No code changes.
```

---

# 🚀 PROMPT P1 — Settings page (mobile) + backend

```
TASK: Add a Settings feature.

BACKEND (backend/):
- Add endpoints (reuse existing auth/JWT dependency):
  - PATCH /auth/me  -> update current user's name and/or email.
  - POST  /auth/change-password  -> body { old_password, new_password }; verify old password, hash and save new one.
- Add matching Pydantic request/response models. Reuse the existing password hashing utility. Update /docs.

MOBILE (mobile/):
- Create mobile/src/screens/SettingsScreen.js:
  - Show logged-in user's name & email (from Auth context / GET /auth/me).
  - "Edit Profile" (name, email) -> PATCH /auth/me.
  - "Change Password" (old, new, confirm) -> POST /auth/change-password.
  - Show app version text.
  - "Logout" button -> existing logout flow.
- Add Settings to navigation: add a "Settings" tab (gear icon) OR a header button on Dashboard that opens it.
- Follow the #0D0D0D / #22C55E theme. Reuse existing API client + Auth context.
```

---

# 🚀 PROMPT P2 — Multi-room management (mobile)

```
TASK: Let users manage rooms (backend Rooms CRUD already exists — reuse it).

MOBILE (mobile/):
- Create mobile/src/screens/RoomsScreen.js:
  - List all rooms for the current home (GET rooms).
  - Add room (name) -> create room.
  - Delete room (with confirm) -> delete room.
  - Tap a room to select it as the active room (store selected room in context/state).
- On the Dashboard, show devices filtered by the selected room, and add a room selector (chips or dropdown) at the top.
- Add navigation entry to reach RoomsScreen (e.g., from Dashboard header or Settings).
- Theme #0D0D0D / #22C55E. Reuse existing API client. Confirm exact room endpoint paths by reading the backend routes / /docs first.
```

---

# 🚀 PROMPT P3 — Master Switch (all devices on/off)

```
TASK: Add a "Master Switch" that turns ALL devices in the current room (and an "all home" option) ON or OFF.

BACKEND (backend/) — preferred for reliability:
- Add POST /devices/bulk-control  with body { device_ids: [..], status: true|false }  (or { room_id, status } / { home_id, status }).
- It should publish the MQTT control message for each matching device, same as the existing single-device control endpoint. Reuse that logic.

MOBILE (mobile/):
- On Dashboard, add a prominent Master Switch (big toggle) that calls the bulk endpoint for the current room, and a secondary "All devices (home)" option.
- Optimistically update the UI, then refresh device states.
- Theme #0D0D0D / #22C55E. If you decide not to add the bulk endpoint, instead loop the existing single-control endpoint client-side — but tell me which approach you used.
```

---

# 🚀 PROMPT P4 — Add Device via QR / Barcode (UUID + password)

```
TASK: Improve "Add Device" so a device can be added by scanning a QR/barcode that encodes its UUID and pairing password, with manual entry as fallback.

QR PAYLOAD FORMAT (assume this): a JSON string like {"uuid":"<node uuid>","password":"<pairing code>","name":"<optional>"}.

MOBILE (mobile/):
- Use expo-camera's CameraView barcode scanning (NOT the deprecated expo-barcode-scanner). Install/configure if needed. Handle camera permission request.
- Create a "Scan QR" button on the existing AddDevice screen (mobile/src/screens/AddDevice...). On scan: parse the JSON, pre-fill uuid + password (+ name) into the form.
- Keep the existing MANUAL form as a fallback (user can type uuid/password by hand).
- Submit using the existing add-device API call. If the backend add-device payload has no field for the pairing password, send it in the existing metadata/extra field; do NOT crash if absent.

BACKEND (backend/) — only if needed:
- If add-device has no place for a pairing "password"/"pin", add an optional pairing_code field to the device create model and store it (a new nullable column or in existing metadata). Keep it backward compatible.

NOTE: expo-camera scanning needs an EAS dev build or the APK build to fully work (camera is limited in Expo Go). Mention this in your summary.
Theme #0D0D0D / #22C55E.
```

---

# 🚀 PROMPT P5 — Schedules (backend + mobile)

```
TASK: Add scheduled ON/OFF for devices. Schedules must fire even when the app is closed (server-side).

BACKEND (backend/):
- New table `schedules`: id, user_id, device_id, action ("on"/"off"), time (HH:MM), days (list/CSV of weekdays, or "daily"), enabled (bool), created_at.
- CRUD endpoints (JWT protected): POST/GET/PATCH/DELETE /schedules (GET filterable by device_id).
- Add APScheduler (BackgroundScheduler or AsyncIOScheduler) started on app startup. A job runs every minute, finds enabled schedules whose time/day matches now, and publishes the same MQTT control message the device-control endpoint uses. Reuse that MQTT publish logic.
- Use the app's timezone consistently (state which timezone you used). Make sure it works on Render (single worker).

MOBILE (mobile/):
- Create mobile/src/screens/SchedulesScreen.js: list schedules, add schedule (pick device, on/off, time picker, days, enabled toggle), edit, delete.
- Reachable from a device's detail or from a Schedules tab.
- Theme #0D0D0D / #22C55E. Reuse API client. Read backend device/MQTT code first so the publish matches exactly.

DEMO HELPER (important for showing the client it works):
- Add a "Run Now / Test" button on each schedule that immediately triggers that schedule's action (calls a backend endpoint, e.g. POST /schedules/{id}/run, which publishes the MQTT message right away). This lets us demo a schedule firing without waiting for the clock.
```

---

# 🚀 PROMPT P6 — Alerts / Notifications (backend + mobile)

```
TASK: Add an Alerts feature (device events + a notifications list).

BACKEND (backend/):
- New table `alerts`: id, user_id, device_id (nullable), type (e.g. "device_offline","device_online","schedule_run","info"), message, is_read (bool), created_at.
- Create alert rows when meaningful events happen: device goes offline/online (if you track last-seen/status via MQTT), and when a schedule fires.
- Endpoints (JWT): GET /alerts (newest first, filter unread), PATCH /alerts/{id}/read, PATCH /alerts/read-all, DELETE /alerts/{id}.

MOBILE (mobile/):
- Create mobile/src/screens/AlertsScreen.js: list alerts (icon by type, time-ago), unread highlighted, tap to mark read, "mark all read", pull-to-refresh.
- Add a bell icon (with unread badge count) in the Dashboard header that opens AlertsScreen.
- OPTIONAL (only if time allows): expo-notifications for local/push notifications — keep it optional and isolated so it can't break the build.
- Theme #0D0D0D / #22C55E. Reuse API client.
```

---

# 🚀 PROMPT P7 — Deploy (Android APK via EAS only)

```
TASK: Prepare deployment. NOTE: Only the mobile app ships. The dashboard/ folder is reference only — do NOT deploy it.

MOBILE (mobile/) -> Android APK via EAS:
- Verify app.json (name "4Layers", android package id, icon, version).
- Ensure camera permission (for QR) is declared for Android.
- Give me the exact commands: eas login, eas build:configure, and `eas build -p android --profile preview` to get an installable APK. Note any config the QR/camera feature needs in the build.
- Confirm USE_LOCAL_BACKEND is false before building.
```

---

# 🚀 PROMPT P8 — UI Polish (premium look + normal wording + REAL data)

```
TASK: Polish the mobile app UI. Keep the existing premium dark look (background #0D0D0D, accent green #22C55E). Use SettingsScreen.js as the reference for clean styling. Do NOT break any functionality. Read each screen file BEFORE editing.

Three goals: (A) fix a layout bug, (B) replace techy jargon with normal plain English, (C) replace fake/mock data with REAL data from the app's already-loaded devices/rooms.

=== A. FIX: Room chips layout (DashboardScreen) ===
The room selector chips ("All / Living Room / Master Bedroom / Kitchen / Balcony") currently WRAP to two lines and have uneven heights (e.g. "Master Bedroom" breaks). Fix:
- Put the chips in a horizontal ScrollView (horizontal, showsHorizontalScrollIndicator={false}).
- Each chip: single line only (numberOfLines={1}), fixed height, equal vertical + horizontal padding, rounded. NO wrapping. Selected chip = green fill/border, others = dark card.

=== B. REPLACE jargon with NORMAL words (whole app) ===
Apply these everywhere they appear (labels, section headers, event messages):
- "ROOM VIEWPORTS"        -> "Rooms"
- "CONNECTED HARDWARE"    -> "Devices"
- "No devices detected in this room viewport" -> "No devices in this room yet"
- "SELECT APPLIANCE HUB"  -> "Select Device"
- "TRANSMIT TRIGGER" + "Signal sent: Toggled from OFF -> ON" -> "<DeviceName> turned ON"
- "...Toggled from ON -> OFF" -> "<DeviceName> turned OFF"
- "NODE REGISTERED" + "Node handshake complete. Default state: OFF" -> "Device added"
- "0 ACTIVE" pill         -> "<n> ON"  (n = number of devices currently ON)
- Remove the "SYSTEM SECURITY ARMED" overline; make the title a simple "Welcome, <username>" greeting or the home name + "Dashboard".
Keep tone simple and human. No sci-fi / tech jargon anywhere a normal user sees.

=== C. REPLACE fake data with REAL data (DashboardScreen) ===
1. Remove the fake cards "Overall Efficiency 94.2% (+4.1%)", "Solar Coverage", "Battery Reserves".
   Replace with ONE clean summary card showing 3 REAL stats: Total Devices | Devices ON | Rooms — computed from the already-fetched data (devices.length, devices.filter(on).length, rooms.length). Keep it premium (big numbers, green accents).
2. The big toggle labeled "House Perimeter Security / LOCKDOWNS ARMED. VIDEO FEEDS STREAMING" is FAKE. Convert it into a real MASTER SWITCH: label "Master Switch", subtitle "Turn all devices on/off". Wire it to turn ALL devices in the current room (or all rooms when "All" is selected) on/off via the existing device-control API. Reflect the real on/off state.
Do NOT invent any data the backend does not provide.

=== Polish details ===
- Consistent card padding (~16px) and spacing between sections.
- No text clipped or wrapping awkwardly on normal phone width.
- Match SettingsScreen's clean style across Home and Event History.

Show me the final files you changed.
```

---

# 🚀 PROMPT P9 — Global Event History endpoint (client ke /docs ke liye)

```
TASK: Add a GLOBAL event-history (user activity) endpoint so the client can view all activity from the Swagger /docs page. Currently only a per-device endpoint exists (GET /api/devices/{device_id}/history) which needs a device_id.

BACKEND (backend/):
- Add GET /api/history (new router file routes/history.py, included in main.py, OR reuse devices router — your call). JWT-protected.
- Returns ALL DeviceHistory rows for the CURRENT user's devices only (join Device -> filter by owner), newest first (order by timestamp desc).
- Each item: device_id, device_name, change_type (command_sent / device_created / schedule_run / status_confirmed), previous_state, new_state, timestamp.
- Query params: limit (default 50, max 200), optional device_id filter.
- Give the router its own tag "History" so it shows clearly in /docs.
- Reuse existing auth dependency + DeviceHistory & Device models. Add a response schema (e.g. EventHistoryResponse) that includes device_name.
- No new pip packages. (If you ever add one, add it to the ROOT requirements.txt — Render builds from there, not backend/requirements.txt.)

Show me the final files. After this I will commit, push to main, and let Render redeploy.
```

---

## 🔁 Suggested order to paste
P0-A → P0-B → P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8 → **P9 (event history endpoint)**

Har prompt ke baad Antigravity ko complete hone do (interrupt mat karo), file save hone do, phir agla paste karo.
Jo task ho jaaye uske aage `[ ]` ko `[x]` kar dena upar tracker mein.
