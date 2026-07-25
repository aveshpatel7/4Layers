# 4Layers SmartNest — Hardware Analysis & Integration Plan

**Prepared for:** Client (4Layers)
**Subject:** GoSmart AIO V2 hardware review and the roadmap to integrate it with the SmartNest app
**Date:** 30 June 2026
**Status:** Findings + recommended plan (awaiting go-ahead)

---

## 1. Executive Summary

We reviewed the actual firmware running on your hardware (the **GoSmart AIO V2** board, source: `github.com/aveshpatel7/GoSmart_AIO_V2_Mesh`).

**Key finding:** Your hardware is a complete, professionally-built product based on **Espressif's ESP RainMaker** cloud platform. The SmartNest mobile app we have been building uses a **different, independent connectivity stack** (our own MQTT broker + FastAPI backend). As they stand today, **the two do not talk to each other** — the app cannot directly control the GoSmart boards.

**The good news:** What you asked for — *"devices should connect automatically, without hard-coding each one"* — is completely achievable. In fact your hardware already does this today via RainMaker. And since you want RainMaker removed and replaced with our own system, that is also doable: RainMaker is built on top of **free, open Espressif building blocks that we can reuse directly**. We do not have to invent anything from scratch.

This document explains exactly what the hardware is, why the gap exists, and the step-by-step plan to close it.

---

## 2. What the Hardware Actually Is

The firmware on your boards is titled **"Go Smart — All In One (AIO) V2", firmware version V10.6**. Technical profile:

| Property | Detail |
|---|---|
| Platform | **ESP-IDF** (Espressif's native C SDK, v5.0+) |
| Cloud framework | **ESP RainMaker** (Espressif's official IoT cloud, runs on AWS IoT) |
| Networking | **Wi-Fi + Mesh-Lite** (boards can relay through each other) |
| Onboard outputs | **4 Relays** (Switch 1–4) + **1 Fan** (with speed control) + **LED indicator** |
| Extra control | **RF 433 MHz remote** support (physical remote) |
| Cloud features | **OTA** (remote firmware update), **Schedules**, IST timezone |
| Setup method | **BLE provisioning** — pairing code (PoP): `12345678` |
| Factory reset | Hold BOOT button 3+ seconds (or toggle switch 20 times) |

**In plain words:** each board is a 4-channel smart switch + fan controller. It is provisioned over Bluetooth using a phone app, then it connects to the **RainMaker cloud** — *not* to our server.

---

## 3. Why There Is a Gap (The Core Finding)

There are two separate "worlds" here:

| | **GoSmart Hardware (current)** | **SmartNest App (current)** |
|---|---|---|
| Cloud | ESP RainMaker (AWS IoT) | Our FastAPI + MQTT broker (EMQX) |
| Provisioning | BLE, via RainMaker app | QR / manual entry in our app |
| Control path | RainMaker app → RainMaker cloud → device | Our app → our backend → MQTT topics |

These are **two independent systems**. The SmartNest app was built and prototyped against a standard MQTT broker for rapid development; it was never wired to the RainMaker cloud, which is why it cannot drive the GoSmart boards as-is.

**This is not a defect — it is exactly the integration work that now needs to happen**, and identifying it precisely (by reading your firmware) is what lets us plan it correctly instead of guessing.

---

## 4. What You Asked For

1. **No per-device hard-coding** — flashing each board individually with its own ID/Wi-Fi is impractical at bulk scale.
2. **Automatic connection** — a board should connect by itself after a one-time, simple setup.
3. **Remove the RainMaker dependency** — the system should run on *our* backend, under the 4Layers brand, not Espressif's cloud.

All three are achievable. Below is how.

---

## 5. The Solution — "Our Own RainMaker", Built From Open Parts

RainMaker is not magic. Underneath, it is a combination of **free, open-source Espressif components**. We will assemble the same building blocks on top of our existing backend:

| Capability | What RainMaker uses | What we will use (open / free) |
|---|---|---|
| Auto Wi-Fi setup (no hard-coding) | BLE provisioning | Espressif **`wifi_provisioning`** component (BLE or SoftAP) — the same primitive RainMaker uses |
| Unique device identity (no hard-coding) | Cloud-assigned node ID | Derived automatically from each ESP32's **factory MAC address** |
| Device control / cloud | RainMaker on AWS | **Our existing MQTT broker + FastAPI backend** (already live) |
| Schedules | RainMaker cloud | **Already built** in our backend (server-side scheduler) |
| Remote firmware update (OTA), Mesh | RainMaker | ESP-IDF native OTA / Mesh-Lite — **Phase 2** |

Because our backend, schedules, and app screens already exist, the new work is concentrated in **two places: the firmware and the device-onboarding flow.**

---

## 6. How "Automatic Connection" Will Work (End-User Flow)

1. **One firmware, flashed to every board** — identical binary, no per-unit editing. Each board names itself from its own MAC address.
2. **First-time setup (once per board, ~30 seconds):** the installer opens the 4Layers app, taps "Add Device", and pairs the new board over Bluetooth (or a temporary Wi-Fi hotspot). The app sends the home Wi-Fi credentials to the board.
3. **The board saves the credentials and connects on its own** — from then on it reconnects automatically every time it powers on. No re-flashing, no code editing.
4. **The board appears in the dashboard**, exposing its channels: Switch 1–4, Fan, LED, and a **Master Switch** that turns the whole board on/off at once.

This is identical in convenience to RainMaker — but on the 4Layers platform.

---

## 7. Per-Board Dashboard Layout

Each physical board will register as a set of channels under the chosen Room:

| Channel | Card | Type |
|---|---|---|
| 1–4 | Switch 1, 2, 3, 4 | Relay (light) |
| 5 | Fan | Fan (with speed) |
| 6 | LED Strip | Light |
| 7 | **Master Switch** | Bulk on/off for the whole board |

The Master Switch publishes a single command that toggles all relays + LED on that board together.

---

## 8. Roadmap

### Phase 1 — Core integration (makes real hardware work with our app)
- **Firmware:** new build that (a) provisions Wi-Fi over BLE/SoftAP with no hard-coding, (b) derives its ID from the MAC address, (c) talks to *our* MQTT backend, (d) drives the 4 relays + fan + LED.
- **App:** onboarding/provisioning flow + per-board registration (the 7 channel cards).
- **Backend:** small additions for multi-channel boards and the Master Switch (our backend already handles devices, control, history, and schedules).
- **Build note:** because provisioning uses native Bluetooth libraries, testing requires a **custom Android build (APK)** — it cannot run inside the standard Expo Go sandbox.

### Phase 2 — Parity with RainMaker's advanced features
- **OTA** remote firmware updates (so future fixes don't need physical access).
- **Mesh-Lite** networking (boards relay through each other for large premises).
- **RF 433 MHz remote** behaviour, retained from the existing firmware.

---

## 9. What We Need To Proceed

1. **Reflashing access** — confirmation that we may load new firmware onto the GoSmart boards (the firmware source is available, so this is straightforward to modify).
2. **At least one ESP32 board** on the development side to flash and test against real hardware.
3. **Feature priority** — for the first delivery, is **on/off switching + automatic connection** sufficient, or are **OTA / Mesh / RF remote** required from day one? (We recommend shipping the core first, then adding the rest in Phase 2.)
4. **Firmware approach decision** — either *modify the existing GoSmart firmware* (keeps RF/mesh, more complex) or *write a fresh, lean firmware* (faster, RF/OTA/mesh added later).

---

## 10. Bottom Line

- Your hardware is solid and capable; the "auto-connect, no hard-coding" requirement is fully achievable.
- The only reason the app doesn't control it yet is that the two were built on different connectivity stacks — now precisely identified.
- Replacing RainMaker with our own system is realistic because we can reuse the same open Espressif components RainMaker itself is built on, on top of the SmartNest backend that is already live.
- With reflashing access and one test board, we can begin Phase 1 immediately.

---

*Prepared after a direct review of the GoSmart AIO V2 firmware source. Technical details available on request.*
