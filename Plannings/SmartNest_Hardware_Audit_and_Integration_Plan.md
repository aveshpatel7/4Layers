# SmartNest: GoSmart Hardware Audit & Custom Integration Plan (Hinglish Version)
**Project Reference:** 4Layers SmartNest IoT Eco-system  
**Date:** June 29, 2026  
**Document Type:** Technical Integration Proposal & Roadmap  

---

## 📝 1. Executive Summary

Yeh report **GoSmart AIO V2 Mesh** firmware code (`GoSmart_AIO_V2_Mesh`) ke audit findings aur is hardware ko **SmartNest** custom cloud backend aur mobile app ke saath connect karne ka step-by-step plan details karti hai.

Humara main goal yeh hai ki bina kisi hardcoding ke (yaani har device ke liye alag se programming kiye bina) bulk hardware devices ko custom EMQX MQTT + FastAPI backend par direct aur automatically connect kiya ja sake.

---

## 🔍 2. Hardware Code Audit Findings (GoSmart V2)

Aapke current repository/code ko audit karne par ye technical configurations mili hain:

1. **Development Framework:** Yeh code Arduino IDE ke bajaye native **ESP-IDF (v5.x)** framework par bana hai (jiski performance aur RAM management bohot fast hai).
2. **Channel & GPIO Mapping:**
   - **4 Switches (Relays):** GPIO pins `15`, `5`, `4`, aur `22` par mapped hain.
   - **1 Fan Speed Controller:** Step-sliders ke through control hota hai.
3. **Provisioning (WiFi Connection Setup):** Yeh hardware default mein **Bluetooth Low Energy (BLE)** aur RainMaker protocol use karta hai, jiska configuration pairing code (Proof of Possession - PoP) **`12345678`** hai.
4. **Active Cloud Service:** Current firmware completely **ESP RainMaker Cloud** (AWS IoT Core under Espressif account) par depend karta hai.
5. **Advanced Features:** Code ke andar **Mesh-Lite** (devices ka aapas mein range badhane ka system), **OTA Updates** (WiFi se direct update), aur **RF 433MHz Remote** functionalities pre-integrated hain.

---

## ⚠️ 3. Integration Gap (Kyun abhi direct connect nahi ho raha?)

Abhi hardware aur app dono alag systems par chal rahe hain:
- **Client Hardware:** Apne saare actions aur status update Espressif ke RainMaker Cloud server par bhejta hai.
- **SmartNest App:** Humare custom **EMQX MQTT Broker** aur **FastAPI server** se controls communicate karta hai.

Dono ko connect karne ke liye hume hardware se RainMaker dependency ko hata kar use direct humare custom MQTT handler par setup karna padega.

---

## 💡 4. Solution: Zero-Hardcoding Custom Provisioning

Bulk production (jahan 100s of hardware units ko bina code edit kiye flash karna ho) ke liye hum ye 3-step automatic provisioning system build karenge:

```
+---------------------------------------------------------------------------------+
|                                                                                 |
| 1. Device Boot  --> Automatic Setup Hotspot banega: "SmartNest-Setup-XXXX"      |
|                                                                                 |
+---------------------------------------+-----------------------------------------+
                                        |
                                        v
+---------------------------------------+-----------------------------------------+
|                                                                                 |
| 2. WiFi Connection --> User phone connect karke local WiFi & Password enter     |
|                        karega portal page par (Credentials auto-save)           |
|                                                                                 |
+---------------------------------------+-----------------------------------------+
                                        |
                                        v
+---------------------------------------+-----------------------------------------+
|                                                                                 |
| 3. App Register  --> Device unique MAC Address se unique ID auto-generate karega;|
|                      User box par laga QR scan karke app mein register karega   |
|                                                                                 |
+---------------------------------------------------------------------------------+
```

### 4.1 Auto-Generated Node ID (No Code Edit)
Har chip ki apni unique physical address (MAC) hoti hai. Hardcoding ke bina device khud apni ID generate karega:
```c
char NODE_ID[32];
uint64_t mac = ESP.getEfuseMac();
snprintf(NODE_ID, sizeof(NODE_ID), "4L-NODE-%06llX", mac & 0xFFFFFF);
```
- **Fayda:** Same code hum 10,000 devices par flash kar sakte hain, aur har device ki ID automatic unique generate ho jayegi.

### 4.2 SoftAP Portal Setup (Zero-Hardcoding WiFi)
1. Jab device pehli baar ON hoga, toh woh automatic ek local hotspot banayega (e.g. `SmartNest-Setup-XXXX`).
2. Client apne phone se is WiFi hotspot ko connect karega.
3. Phone screen par ek portal page open hoga, jahan client apna local WiFi SSID aur Password select karke save kar dega.
4. Device credentials ko memory (NVS) mein save karke automatic restart hoga aur internet se connect ho jayega.

### 4.3 QR Code Claim Flow
1. Device box par unique Node ID ka QR code lagaya jayega.
2. Mobile App mein add-device scanner se QR code scan karte hi hardware link ho jayega.

---

## 📅 5. Proposed Implementation Roadmap (Planning)

Hum is integration ko do phases mein complete karenge:

### Phase 1: Core Connectivity & Provisioning (Staging Phase)
- RainMaker functions ko disable karke direct custom MQTT protocol configure karenge.
- SoftAP config portal aur MAC-based auto Node ID features setup karenge.
- *Deliverables:* Ek complete working C++ firmware jo direct humare EMQX server se link ho aur app se ON/OFF relays control ho sakein.

### Phase 2: Advanced Native Features (Production Phase)
- Port parsing code for RF 433MHz remote controls, Mesh-Lite protocols, aur OTA features.
- Manufacturing line ke liye final production-ready binary format release karenge.
