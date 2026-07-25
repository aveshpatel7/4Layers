# SmartNest: Mobile App UI Redesign Specification
**Project Reference:** 4Layers SmartNest IoT Eco-system  
**Date:** June 30, 2026  
**Document Type:** UI/UX Specification & Screen-by-Screen Layout Guide  

---

## 🎨 1. Premium Visual Design System (Theme & Colors)

Redesigned app ka visual style hum completely premium, dark and minimal rakhenge (exactly matching the 4Layers brand theme):

*   **Background Color:** Near-Black (`#0D0D0D`) — *Sleek dark mode look.*
*   **Card Background:** Dark Gray (`#1A1A1A`) — *Gives high depth & contrast.*
*   **Primary / Accent Highlight:** Vibrant Green (`#22C55E`) — *Displays active/online state.*
*   **Text colors:** White (`#FFFFFF`) for primary headers; Muted Gray (`#9CA3AF`) for secondary labels.
*   **Borders:** Subtle gray (`#262626`) for cards.

---

## 📱 2. Screen-by-Screen Redesign Details

### Screen 1: Redesigned Dashboard (Main Tab)
Ye user ka home screen dashboard hoga. Iska layout upar se niche is tarah dikhega:

1.  **Welcome Header**:
    - `"Welcome, qadir khan"` greeting.
    - Right side par red dot badge ke saath **Notification Bell icon** (Unread alerts count dikhane ke liye).
2.  **Real-Time Stats Card (Bento Design)**:
    - Single compact card jo real-time calculations show karega: **Total Devices | Devices ON | Active Rooms**.
3.  **Horizontal Room Chips (Scrollable row)**:
    - Room names filter chips (jaise: `All`, `Living Room`, `Bedroom`, `Kitchen`) jo single horizontal line par scroll honge.
4.  **2-Column Device Grid**:
    - Har switchboard hardware naye grid card layout mein render hoga:
      - **Relays (Switch 1 to 4):** Standard grid cards with a green power power toggle button and a slider icon.
      - **Fan Card:** Card includes `+` and `-` buttons with speed indicator (e.g. `Speed 3/5`) and a spinning fan icon.
      - **LED Strip Card:** Card displays lightbulb icon with a separate ON/OFF power button.
      - **Local Master Switch:** Aligned as a regular grid card at the end. Toggling it sends command to turn all relays in this switchboard ON/OFF at once.

---

### Screen 2: Add Device & BLE Onboarding Flow
Jab user top header ke `+` button par tap karega, toh ye interactive onboarding flow load hoga:

#### Step 2.1: Entry Screen
- Teen buttons show honge:
  1. **"Provision via Bluetooth (BLE)"** *(Recommended)*
  2. **"Scan Device QR Code"**
  3. **"Add Node Manually"** (Manual fallback typing)

#### Step 2.2: Bluetooth BLE Scan Screen
- Phone ka Bluetooth automatic scan start karega.
- Nearby unconfigured ESP32 boards ki list display hogi (jaise: `PROV_000336`).
- User target device par click karega.

#### Step 2.3: Proof of Possession (PoP) PIN Verification
- Screen user se security PIN (PoP code) enter karne ko kahegi (jaise: `12345678` ya `a1000336`).
- Verification check success hone par next step load hoga.

#### Step 2.4: WiFi Selection & Connection portal
- App phone ko WiFi list select karne ka option dega.
- User apna local **WiFi Name (SSID)** select karega aur **WiFi Password** enter karke "Apply" karega.

#### Step 2.5: Staged Progress Checklist UI
- Bluetooth se data send hote hi, client screen par live checklists show honge:
  - `[✓] Sending Wi-Fi credentials` (Credentials verify & send)
  - `[✓] Applying Wi-Fi connection` (ESP32 connecting to router)
  - `[✓] Checking provisioning status` (Confirming database link)
- Handshake complete hote hi **"OK"** button enable hoga aur user dashboard par land hoga jahan **7 new device cards** automatic create ho chuke honge!

---

### Screen 3: Timers & Schedules Setup
- User kisi bhi individual card (jaise: `Living Room Switch 3`) par click karke uske automated rules set kar sakega:
  - Time input (e.g. `08:30 AM` to `10:00 PM`).
  - Days selection (e.g. `Mon, Tue, Wed, Thu, Fri` or `Daily`).
  - Action selection (`Turn ON` or `Turn OFF`).
- Background worker backend par ise check karke dynamic trigger karta rahega.

---

### Screen 4: Alerts & Real-Time Event History
- Telemetry logs timeline show hogi:
  - `"Living Room Switch 3 turned ON at 08:30 AM (Schedule)"`
  - `"Office Switchboard node connected successfully (Online)"`
  - `"Kitchen Fan speed changed to 4"`

---

### Screen 5: Settings & Security panel
- Profile detail editing.
- **Change Password panel**: Enter current password, new password, and confirm.
- Logout button.
