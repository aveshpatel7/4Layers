# SmartNest: BLE 5.2 WiFi Provisioning Plan
**Project Reference:** 4Layers SmartNest IoT Eco-system  
**Date:** June 30, 2026  
**Objective:** Bluetooth Low Energy (BLE 5.2) Integration for Dynamic Onboarding  

---

## 📝 1. Baat Kya Hai? (Executive Summary)

Bhai, tere hardware ke requirements ke according hum mobile app ke andar **BLE 5.2 (Bluetooth Low Energy 5.2)** protocol use karke WiFi provisioning integration karenge. 

Isse user ko hardware code mein manually WiFi password ya device configuration set nahi karni padegi. App directly bluetooth se connect hoga, credentials transfer karega, aur device online aa jayega (exactly jaise tune screenshots bhein hain).

---

## 📡 2. BLE 5.2 Provisioning Kaam Kaise Karega? (Step-by-Step Flow)

```
+-------------------+             BLE 5.2 Connection            +-------------------+
|                   | <=======================================> |                   |
|  SmartNest App    |                                           |   ESP32 Board     |
|                   | -------------[ WiFi Creds ]-------------> |                   |
+-------------------+                                           +-------------------+
          |                                                               |
  (Registers 7 Cards)                                             (Connects to WiFi)
          |                                                               |
          v                                                               v
+-------------------+                                           +-------------------+
| FastAPI Database  | <=======================================> | EMQX MQTT Broker  |
+-------------------+                                           +-------------------+
```

1. **Step 1: BLE Device Discovery (Scan & Find)**
   - App nearby Bluetooth devices scan karega jo `PROV_` prefix broadcast kar rahe hain (jaise: `PROV_000336`).
   - *Security Check:* User select karke **Proof of Possession (PoP) PIN** (jaise: `12345678`) enter karega authentication verify karne ke liye (Security 1 encryption standard).

2. **Step 2: Credential Exchange (WiFi inputs)**
   - User app par target WiFi router ka name (SSID) aur password type karega.
   - App BLE 5.2 raw channels ke through encrypted credentials ESP32 ko send kar dega.

3. **Step 3: Staged Progress Verification (Checklist)**
   - App screen par client ki custom requirements ke details aur status check show honge:
     - `[✓] Sending Wi-Fi credentials` (Credentials verify & send)
     - `[✓] Applying Wi-Fi connection` (ESP32 connecting to router)
     - `[✓] Checking provisioning status` (Confirming database link)

4. **Step 4: Automatic 7-Device Generation (Final Sync)**
   - Jaise hi connection verify hoga, App backend API (`/api/devices/bulk-register`) trigger karega.
   - Database mein **7 dynamic control cards** (Switch 1-4, Fan, LED, aur **Master Switch**) automatic create ho jayenge.

---

## ⚡ 3. BLE 5.2 Ke Key Benefits (Dost ko batane ke liye points)

* **Super Fast & Low Latency:** BLE 5.2 standard raw channels (2 Mbps bandwidth) data packet transfer ko extremely speed up kar dete hain. Handshake and provisioning process 15-20 seconds mein complete ho jayega.
* **LE Secure Connections:** ECDH key exchange security protocols ke through data transfer fully secure and encrypted rehta hai (no snooping).
* **Automated Dashboard Integration:** WiFi connect hote hi, 7-Channel device console single click setup se register ho jata hai, zero manual repetition.
