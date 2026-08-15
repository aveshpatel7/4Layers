/*
 * SmartNest Multi-Channel Production Firmware (7 Channels)
 * Target Microcontroller: ESP32 Dev Module (Go Smart AIO V2 Compatible)
 * 
 * Features:
 *   1. Preferences Storage: Securely saves WiFi configurations in the ESP32 NVS flash.
 *   2. Manual Factory Reset Button: Hold the ESP32 physical BOOT button (GPIO 0) 
 *      for 3 seconds on startup to clear credentials and trigger Setup Mode.
 *   3. Unique Node ID Generation: Generates an MQTT client identifier using the MAC address.
 *   4. Multi-Channel MQTT Controls: Listens to toggles, fan speed relays, and master logical commands.
 *   5. Remote MQTT Reset: Resets Wi-Fi credentials when receiving {"action": "factory_reset"}.
 * 
 * Pin Configuration mapping (Go Smart AIO V2 Hardware):
 *   - Channel 1 (Switch 1): Relay 1 connected to GPIO 15
 *   - Channel 2 (Switch 2): Relay 2 connected to GPIO 5
 *   - Channel 3 (Switch 3): Relay 3 connected to GPIO 4
 *   - Channel 4 (Switch 4): Relay 4 connected to GPIO 22
 *   - Channel 5 (Ceiling Fan Relays): 
 *     * Speed 1 Relay: GPIO 21
 *     * Speed 2 Relay: GPIO 19
 *     * Speed 4 Relay: GPIO 18
 *   - Channel 6 (LED Strip): Logical brightness dimming (no physical pin on AIO V2)
 *   - Channel 7 (Master Switch): Logical toggle for all channels combined.
 *   - Onboard Status LED: GPIO 2
 *   - Factory Reset Button: GPIO 0
 * 
 * Required Libraries (Install via Arduino Library Manager):
 *   - PubSubClient (by Nick O'Leary)
 *   - ArduinoJson (by Benoit Blanchon)
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h>
#include <WebServer.h>
#include <ESPmDNS.h>

// ==========================================
// 🔧 CONFIGURATION (GLOBAL SETTINGS)
// ==========================================
const char* mqtt_server = "i26a1c71.ala.asia-southeast1.emqxsl.com";
const int mqtt_port = 8883;
const char* mqtt_user = "smartnest_client";
const char* mqtt_pass = "D2m9ga8JynJDEM6";

// Pin Definitions matching Go Smart AIO V2 hardware
const int RELAY_1 = 15;
const int RELAY_2 = 5;
const int RELAY_3 = 4;
const int RELAY_4 = 22;

const int FAN_SPEED_1 = 21;
const int FAN_SPEED_2 = 19;
const int FAN_SPEED_4 = 18;

const int STATUS_LED = 2;   // Onboard LED
const int RESET_BUTTON = 0; // ESP32 physical BOOT button (Active Low)

// Device States
bool relayStates[4] = {false, false, false, false}; // Relays 1-4 (Channels 1-4)
bool fanEnabled = false;                            // Ceiling Fan (Channel 5)
int fanSpeed = 3;                                   // Default speed: 3/4 (Range 1-4)

char NODE_ID[32];        
char command_topic[100]; 
char status_topic[100];  

WiFiClientSecure espClient;
PubSubClient client(espClient);
Preferences preferences;
WebServer server(80);

// 1. Mandatory Remote Logging Function (Serial + MQTT Topic)
void logRemote(const String& msg) {
  Serial.println(msg); // Print to local USB Serial Monitor
  
  if (client.connected()) {
    char logTopic[120];
    snprintf(logTopic, sizeof(logTopic), "smartnest/devices/%s/logs", NODE_ID);
    client.publish(logTopic, msg.c_str());
  }
}

// 2. Helper function to publish OTA status JSON over MQTT
void publishOTAStatus(const char* status, int progress) {
  if (!client.connected()) return;
  
  StaticJsonDocument<128> doc;
  doc["status"] = status;
  doc["progress"] = progress;
  
  char buffer[128];
  serializeJson(doc, buffer);
  
  char ota_status_topic[120];
  snprintf(ota_status_topic, sizeof(ota_status_topic), "smartnest/devices/%s/ota/status", NODE_ID);
  client.publish(ota_status_topic, buffer, true);
  logRemote("[OTA MQTT] Published status: " + String(buffer));
}

// 3. Perform HTTP OTA Update with Error Tracing & Live Remote Console Logs
void performOTAUpdate(const String& firmwareUrl) {
  // 1. Randomized Network Jitter Delay (1s - 15s) to de-congest Wi-Fi router & AWS HTTP requests
  int jitterMs = random(1000, 15000);
  logRemote("================================================");
  logRemote("[OTA JITTER] Mass Rollout Jitter active: waiting " + String(jitterMs) + "ms before downloading...");
  delay(jitterMs);

  logRemote("[OTA] Initiating Remote HTTP OTA Update...");
  logRemote("[OTA] Target Binary URL: " + firmwareUrl);
  logRemote("[OTA] Free Heap Memory: " + String(ESP.getFreeHeap()) + " bytes");
  logRemote("================================================");

  WiFiClientSecure otaClient;
  otaClient.setInsecure();
  otaClient.setTimeout(15000);

  httpUpdate.onProgress([](int cur, int total) {
    if (total <= 0) return;
    int percent = (cur * 100) / total;
    static int lastPercent = -1;
    if (percent != lastPercent && (percent % 10 == 0 || percent == 100)) {
      lastPercent = percent;
      publishOTAStatus("downloading", percent);
      logRemote("[OTA PROGRESS] Downloaded " + String(percent) + "% (" + String(cur) + " / " + String(total) + " bytes)");
    }
  });

  publishOTAStatus("downloading", 0);
  t_httpUpdate_return ret = httpUpdate.update(otaClient, firmwareUrl);

  switch (ret) {
    case HTTP_UPDATE_FAILED:
      logRemote("[OTA ERROR] Update Failed! Code: " + String(httpUpdate.getLastError()) + " Msg: " + httpUpdate.getLastErrorString());
      publishOTAStatus("failed", 0);
      break;

    case HTTP_UPDATE_OK:
      logRemote("[OTA SUCCESS] Download 100% Complete! Flashing binary...");
      publishOTAStatus("flashing", 100);
      delay(300);
      logRemote("[OTA SUCCESS] Flashing complete! Rebooting ESP32 board now...");
      publishOTAStatus("success", 100);
      
      for (int i = 0; i < 10; i++) {
        client.loop();
        delay(100);
      }
      ESP.restart();
      break;
  }
}

// BLE Onboarding Configurations
#define SERVICE_UUID           "0000ffe0-0000-1000-8000-00805f9b34fb"
#define WIFI_CHAR_UUID         "0000ffe1-0000-1000-8000-00805f9b34fb"
#define MAC_CHAR_UUID          "0000ffe2-0000-1000-8000-00805f9b34fb"
#define DEVICE_ID_CHAR_UUID    "0000ffe3-0000-1000-8000-00805f9b34fb"

bool bleDeviceConnected = false;
bool shouldReboot = false;
String receivedSsid = "";
String receivedPass = "";

unsigned long lastHeartbeat = 0;
const unsigned long heartbeatInterval = 45000; // telemetry updates every 45s

bool inSetupMode = false;
String ssid = "";
String password = "";

// Reset Button holding logic
unsigned long buttonPressStart = 0;
bool buttonHeld = false;

// --- Format Unique Node ID based on MAC Address ---
void generateNodeId() {
  uint64_t mac = ESP.getEfuseMac();
  snprintf(NODE_ID, sizeof(NODE_ID), "4L-NODE-%06llX", mac & 0xFFFFFF);
  
  // Construct dynamic MQTT topics
  snprintf(command_topic, sizeof(command_topic), "home/device/%s/control", NODE_ID);
  snprintf(status_topic, sizeof(status_topic), "home/device/%s/status", NODE_ID);
  
  Serial.println("\n====================================");
  Serial.print("Generated Unique Node ID: ");
  Serial.println(NODE_ID);
  Serial.print("Subscribe Command Topic : ");
  Serial.println(command_topic);
  Serial.print("Publish Status Topic    : ");
  Serial.println(status_topic);
  Serial.println("------------------------------------");
  Serial.println("Click the link to generate/print QR sticker:");
  Serial.printf("Plain ID QR: https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=%s\n", NODE_ID);
  Serial.printf("JSON Payload QR: https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=%%7B%%22uuid%%22:%%22%s%%22,%%22name%%22:%%22SmartNest%%20Board%%22%%7D\n", NODE_ID);
  Serial.println("====================================\n");
}

// --- Status LED Indicators ---
void blinkLED(int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(STATUS_LED, HIGH);
    delay(delayMs);
    digitalWrite(STATUS_LED, LOW);
    delay(delayMs);
  }
}

// --- Check and handle reset button hold at runtime ---
void checkResetButton() {
  if (digitalRead(RESET_BUTTON) == LOW) {
    if (!buttonHeld) {
      buttonPressStart = millis();
      buttonHeld = true;
      Serial.println("[Reset] Button pressed. Keep holding for 3 seconds to reset...");
    } else {
      if (millis() - buttonPressStart >= 3000) {
        Serial.println("[Reset] Reset button held for 3 seconds! Formatting NVS and rebooting...");
        preferences.begin("wifi", false);
        preferences.clear();
        preferences.end();
        blinkLED(15, 60); // Rapid blink to confirm
        ESP.restart();
      }
    }
  } else {
    if (buttonHeld) {
      Serial.println("[Reset] Button released before 3 seconds.");
      buttonHeld = false;
    }
  }
}

// --- Save & Load Relay States to Flash Memory (EEPROM/NVS) ---
void saveStateToNVS() {
  preferences.begin("states", false);
  preferences.putBool("r1", relayStates[0]);
  preferences.putBool("r2", relayStates[1]);
  preferences.putBool("r3", relayStates[2]);
  preferences.putBool("r4", relayStates[3]);
  preferences.putBool("fanEn", fanEnabled);
  preferences.putInt("fanSpd", fanSpeed);
  preferences.end();
}

void loadStateFromNVS() {
  preferences.begin("states", true);
  relayStates[0] = preferences.getBool("r1", false);
  relayStates[1] = preferences.getBool("r2", false);
  relayStates[2] = preferences.getBool("r3", false);
  relayStates[3] = preferences.getBool("r4", false);
  fanEnabled = preferences.getBool("fanEn", false);
  fanSpeed = preferences.getInt("fanSpd", 3);
  preferences.end();
}

// --- Publish Channel State telemetry back to MQTT ---
void sendChannelState(int channel, bool status, int val = -1) {
  StaticJsonDocument<256> doc;
  doc["channel"] = channel;
  doc["status"] = status ? "ON" : "OFF";
  if (val != -1 && channel == 5) {
    doc["speed"] = val;
  }
  if (WiFi.status() == WL_CONNECTED) {
    doc["local_ip"] = WiFi.localIP().toString();
  }

  char buffer[256];
  serializeJson(doc, buffer);

  Serial.print("Publishing state update: ");
  Serial.println(buffer);
  client.publish(status_topic, buffer, true);
}

// --- Setup Local LAN Web Server & Endpoints (Port 80) ---
void setupLocalWebServer() {
  server.enableCORS(true);

  // 1. Local Device State Endpoint: GET /state
  server.on("/state", HTTP_GET, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "*");

    StaticJsonDocument<512> doc;
    doc["node_id"] = NODE_ID;
    doc["local_ip"] = WiFi.localIP().toString();
    doc["rssi"] = WiFi.RSSI();
    
    JsonArray relays = doc.createNestedArray("relays");
    for (int i = 0; i < 4; i++) relays.add(relayStates[i]);

    JsonObject fanObj = doc.createNestedObject("fan");
    fanObj["enabled"] = fanEnabled;
    fanObj["speed"] = fanSpeed;

    doc["channel_1"] = relayStates[0] ? "ON" : "OFF";
    doc["channel_2"] = relayStates[1] ? "ON" : "OFF";
    doc["channel_3"] = relayStates[2] ? "ON" : "OFF";
    doc["channel_4"] = relayStates[3] ? "ON" : "OFF";

    JsonObject ch5 = doc.createNestedObject("channel_5");
    ch5["status"] = fanEnabled ? "ON" : "OFF";
    ch5["speed"] = fanSpeed;

    doc["channel_6"] = (relayStates[0] || relayStates[1] || relayStates[2] || relayStates[3] || fanEnabled) ? "ON" : "OFF";

    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);
  });

  // 2. Local Control Endpoint: GET /control?channel=1&state=on
  server.on("/control", HTTP_GET, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "*");

    if (!server.hasArg("channel")) {
      server.send(400, "application/json", "{\"status\":\"error\",\"message\":\"Missing channel parameter\"}");
      return;
    }

    int channel = server.arg("channel").toInt();
    String stateStr = "";
    if (server.hasArg("state")) stateStr = server.arg("state");
    else if (server.hasArg("status")) stateStr = server.arg("status");
    
    stateStr.toUpperCase();
    bool turnOn = (stateStr == "ON" || stateStr == "TRUE" || stateStr == "1");

    Serial.printf("[Local HTTP Control] Channel %d -> %s\n", channel, turnOn ? "ON" : "OFF");

    if (channel >= 1 && channel <= 4) {
      relayStates[channel - 1] = turnOn;
      if (client.connected()) sendChannelState(channel, turnOn);
    } else if (channel == 5) {
      fanEnabled = turnOn;
      if (server.hasArg("speed")) {
        fanSpeed = server.arg("speed").toInt();
        if (fanSpeed < 1) fanSpeed = 1;
        if (fanSpeed > 4) fanSpeed = 4;
      }
      if (client.connected()) sendChannelState(5, fanEnabled, fanSpeed);
    } else if (channel == 6 || channel == 7) {
      // Master toggle
      for (int i = 0; i < 4; i++) {
        relayStates[i] = turnOn;
        if (client.connected()) sendChannelState(i + 1, turnOn);
      }
      fanEnabled = turnOn;
      if (client.connected()) sendChannelState(5, fanEnabled, fanSpeed);
      if (client.connected()) sendChannelState(6, turnOn);
    }

    applyHardware();

    StaticJsonDocument<256> doc;
    doc["status"] = "success";
    doc["node_id"] = NODE_ID;
    doc["channel"] = channel;
    doc["state"] = turnOn ? "ON" : "OFF";
    if (channel == 5) doc["speed"] = fanSpeed;

    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);
  });

  // Handle CORS Pre-flight Options
  server.onNotFound([]() {
    if (server.method() == HTTP_OPTIONS) {
      server.sendHeader("Access-Control-Allow-Origin", "*");
      server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      server.sendHeader("Access-Control-Allow-Headers", "*");
      server.send(204);
    } else {
      server.send(404, "application/json", "{\"status\":\"error\",\"message\":\"Not found\"}");
    }
  });

  server.begin();
  Serial.println("[LocalServer] Local HTTP Control Web Server started on port 80.");
}

// --- Apply hardware outputs ---
void applyHardware() {
  digitalWrite(RELAY_1, relayStates[0] ? HIGH : LOW);
  digitalWrite(RELAY_2, relayStates[1] ? HIGH : LOW);
  digitalWrite(RELAY_3, relayStates[2] ? HIGH : LOW);
  digitalWrite(RELAY_4, relayStates[3] ? HIGH : LOW);
  
  // Apply Fan speed relays combinations (matching Go Smart V2 speed steps)
  digitalWrite(FAN_SPEED_1, LOW);
  digitalWrite(FAN_SPEED_2, LOW);
  digitalWrite(FAN_SPEED_4, LOW);
  
  if (fanEnabled) {
    if (fanSpeed == 1) {
      digitalWrite(FAN_SPEED_1, HIGH);
    } else if (fanSpeed == 2) {
      digitalWrite(FAN_SPEED_2, HIGH);
    } else if (fanSpeed == 3) {
      digitalWrite(FAN_SPEED_1, HIGH);
      digitalWrite(FAN_SPEED_2, HIGH);
    } else if (fanSpeed >= 4) {
      digitalWrite(FAN_SPEED_4, HIGH);
    }
  }

  // Save states to non-volatile memory
  saveStateToNVS();
}

// --- Base64 Encoding Helper ---
String base64Encode(String input) {
  const char lookup[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  String out = "";
  int len = input.length();
  for (int i = 0; i < len; i += 3) {
    uint8_t c1 = input[i];
    uint8_t c2 = (i + 1 < len) ? input[i + 1] : 0;
    uint8_t c3 = (i + 2 < len) ? input[i + 2] : 0;
    
    uint8_t byte1 = c1 >> 2;
    uint8_t byte2 = ((c1 & 3) << 4) | (c2 >> 4);
    uint8_t byte3 = (i + 1 < len) ? (((c2 & 15) << 2) | (c3 >> 6)) : 64;
    uint8_t byte4 = (i + 2 < len) ? (c3 & 63) : 64;
    
    out += lookup[byte1];
    out += lookup[byte2];
    out += (byte3 == 64) ? '=' : lookup[byte3];
    out += (byte4 == 64) ? '=' : lookup[byte4];
  }
  return out;
}

// --- Base64 Decoding Helper ---
String base64Decode(String input) {
  const String lookup = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  String decoded = "";
  int in_len = input.length();
  int i = 0;
  while (i < in_len) {
    char c1 = input[i++];
    if (c1 == '=' || c1 == '\r' || c1 == '\n' || c1 == ' ') continue;
    char c2 = (i < in_len) ? input[i++] : '=';
    char c3 = (i < in_len) ? input[i++] : '=';
    char c4 = (i < in_len) ? input[i++] : '=';
    
    int i1 = lookup.indexOf(c1);
    int i2 = lookup.indexOf(c2);
    int i3 = lookup.indexOf(c3);
    int i4 = lookup.indexOf(c4);
    
    if (i1 == -1) i1 = 0;
    if (i2 == -1) i2 = 0;
    if (i3 == -1) i3 = 0;
    if (i4 == -1) i4 = 0;
    
    char out1 = (char)((i1 << 2) | (i2 >> 4));
    decoded += out1;
    if (c3 != '=') {
      char out2 = (char)(((i2 & 15) << 4) | (i3 >> 2));
      decoded += out2;
    }
    if (c4 != '=') {
      char out3 = (char)(((i3 & 3) << 6) | i4);
      decoded += out3;
    }
  }
  return decoded;
}

// --- BLE Server Callbacks ---
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      bleDeviceConnected = true;
      Serial.println("[BLE] Phone connected!");
    };

    void onDisconnect(BLEServer* pServer) {
      bleDeviceConnected = false;
      Serial.println("[BLE] Phone disconnected. Restarting BLE advertising...");
      pServer->getAdvertising()->start();
    }
};

// --- BLE Wi-Fi Credentials Callback ---
class WifiWriteCallback: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String value = pCharacteristic->getValue().c_str();
      if (value.length() > 0) {
        Serial.print("[BLE] Raw WiFi payload received: ");
        Serial.println(value);
        
        // Parse JSON directly from raw payload
        StaticJsonDocument<256> doc;
        DeserializationError error = deserializeJson(doc, value);
        
        if (error) {
          Serial.print("[BLE] JSON parse failed: ");
          Serial.println(error.c_str());
          return;
        }
        
        const char* reqSsid = doc["ssid"];
        const char* reqPass = doc["pass"];
        
        if (reqSsid && strlen(reqSsid) > 0) {
          receivedSsid = reqSsid;
          receivedPass = reqPass ? reqPass : "";
          
          Serial.printf("[BLE] Saving credentials. SSID: %s\n", receivedSsid.c_str());
          
          preferences.begin("wifi", false);
          preferences.putString("ssid", receivedSsid);
          preferences.putString("pass", receivedPass);
          preferences.end();
          
          // Credentials saved! Reboot board to connect to home Wi-Fi
          shouldReboot = true;
        }
      }
    }
};

// --- BLE Cloud Device UUID Callback ---
class DeviceIdWriteCallback: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String value = pCharacteristic->getValue().c_str();
      if (value.length() > 0) {
        Serial.print("[BLE] Decoded Cloud Device UUID: ");
        Serial.println(value);
        
        preferences.begin("wifi", false);
        preferences.putString("uuid", value);
        preferences.end();
        
        // Handshake complete, trigger the reboot!
        shouldReboot = true;
      }
    }
};

// --- Start Local Config BLE & SoftAP Server ---
void startSetupPortal() {
  inSetupMode = true;
  char portalSSID[50];
  snprintf(portalSSID, sizeof(portalSSID), "SmartNest-Setup-%s", NODE_ID + 8);

  Serial.println("\n--- [SETUP MODE ACTIVE (BLE & SOFTAP)] ---");
  Serial.print("SSID/Device Name: ");
  Serial.println(portalSSID);
  Serial.println("-----------------------------------------\n");

  // Keep Status LED ON during Setup Mode
  digitalWrite(STATUS_LED, HIGH);

  // 1. Initialize WiFi Access Point (SoftAP)
  WiFi.mode(WIFI_AP);
  WiFi.softAP(portalSSID); // default IP: 192.168.4.1
  Serial.print("SoftAP Hotspot active. IP Address: ");
  Serial.println(WiFi.softAPIP());

  // 2. Set Up HTTP Web Server route for SoftAP config URL
  server.on("/config", HTTP_GET, []() {
    String ssid_param = server.arg("ssid");
    String pass_param = server.arg("pass");
    
    if (ssid_param.length() > 0) {
      Serial.println("\n[SoftAP] Received WiFi credentials via Web Server!");
      Serial.printf("SSID: %s\n", ssid_param.c_str());
      
      preferences.begin("wifi", false);
      preferences.putString("ssid", ssid_param);
      preferences.putString("pass", pass_param);
      preferences.end();
      
      // Return HTTP response success to app (including the generated unique node_id)
      char responseBuf[128];
      snprintf(responseBuf, sizeof(responseBuf), "{\"status\":\"success\",\"node_id\":\"%s\",\"message\":\"Credentials saved. Rebooting...\"}", NODE_ID);
      server.send(200, "application/json", responseBuf);
      
      delay(500);
      shouldReboot = true;
    } else {
      server.send(400, "application/json", "{\"status\":\"error\",\"message\":\"Missing SSID parameter.\"}");
    }
  });
  
  server.begin();
  Serial.println("HTTP Web Config Server started successfully.");

  // 3. Initialize BLE Device
  BLEDevice::init(portalSSID);
  
  // Create BLE Server
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  // Create BLE Service
  BLEService *pService = pServer->createService(SERVICE_UUID);

  // Create BLE Characteristics
  BLECharacteristic *pWifiChar = pService->createCharacteristic(
                                         WIFI_CHAR_UUID,
                                         BLECharacteristic::PROPERTY_WRITE
                                       );
  pWifiChar->setCallbacks(new WifiWriteCallback());

  BLECharacteristic *pMacChar = pService->createCharacteristic(
                                         MAC_CHAR_UUID,
                                         BLECharacteristic::PROPERTY_READ
                                       );
  pMacChar->setValue(NODE_ID);

  BLECharacteristic *pDevIdChar = pService->createCharacteristic(
                                         DEVICE_ID_CHAR_UUID,
                                         BLECharacteristic::PROPERTY_WRITE
                                       );
  pDevIdChar->setCallbacks(new DeviceIdWriteCallback());

  // Start BLE Service
  pService->start();

  // Start BLE Advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
}

// --- MQTT Commands Handler (Callback) ---
void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived on topic [");
  Serial.print(topic);
  Serial.println("]");

  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, payload, length);

  if (error) {
    Serial.print("JSON Parse failed: ");
    Serial.println(error.c_str());
    return;
  }

  // Handle Remote OTA Update Trigger
  if (doc.containsKey("action") && doc["action"] == "OTA_UPDATE") {
    const char* firmwareUrl = doc["firmware_url"];
    if (firmwareUrl && strlen(firmwareUrl) > 0) {
      Serial.printf("[MQTT] OTA Update Triggered! URL: %s\n", firmwareUrl);
      performOTAUpdate(String(firmwareUrl));
      return;
    }
  }

  // Handle Remote Factory Reset Trigger
  if (doc.containsKey("action") && doc["action"] == "factory_reset") {
    Serial.println("[MQTT] Remote Reset Command Received. Erasing credentials & rebooting...");
    preferences.begin("wifi", false);
    preferences.clear();
    preferences.end();
    delay(1000);
    ESP.restart();
    return;
  }

  if (!doc.containsKey("channel") || !doc.containsKey("status")) {
    Serial.println("Incomplete JSON control payload received.");
    return;
  }

  int channel = doc["channel"];
  const char* status = doc["status"];
  bool turnOn = (strcmp(status, "ON") == 0);

  Serial.printf("Command received: Channel %d -> %s\n", channel, status);

  // Relay 1-4
  if (channel >= 1 && channel <= 4) {
    relayStates[channel - 1] = turnOn;
    sendChannelState(channel, turnOn);
  }
  // Ceiling Fan (Channel 5)
  else if (channel == 5) {
    fanEnabled = turnOn;
    if (doc.containsKey("speed")) {
      fanSpeed = doc["speed"];
    }
    sendChannelState(5, fanEnabled, fanSpeed);
  }
  // Master Switch (Channel 6)
  else if (channel == 6) {
    for (int i = 0; i < 4; i++) {
      relayStates[i] = turnOn;
      sendChannelState(i + 1, turnOn);
    }
    fanEnabled = turnOn;
    sendChannelState(5, fanEnabled, fanSpeed);
    
    sendChannelState(6, turnOn);
  }

  // Write changes to physical pins & save to memory
  applyHardware();
}

// --- Reconnect to MQTT Broker Loop ---
void reconnectMqtt() {
  while (!client.connected()) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi disconnected. Reconnecting WiFi first...");
      return;
    }

    Serial.print("Connecting to EMQX MQTT Broker with LWT...");
    String clientId = "SmartNestClient-" + String(NODE_ID);
    
    // Configure MQTT Last Will and Testament (LWT) on status_topic to cleanly publish OFFLINE on ungraceful disconnect
    const char* willPayload = "{\"status\":\"OFFLINE\"}";
    if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass, status_topic, 1, true, willPayload)) {
      // Connected successfully to broker & subscribed to control & OTA topics
      client.subscribe(command_topic);
      
      char ota_topic_node[120];
      snprintf(ota_topic_node, sizeof(ota_topic_node), "smartnest/devices/%s/ota", NODE_ID);
      client.subscribe(ota_topic_node);
      client.subscribe("smartnest/devices/all/ota");
      
      Serial.printf("[MQTT] Connected and subscribed to: %s, %s, smartnest/devices/all/ota\n", command_topic, ota_topic_node);

      // Sync current states back to cloud on reconnect (preserves last saved ON/OFF state)
      for (int i = 1; i <= 4; i++) sendChannelState(i, relayStates[i-1]);
      sendChannelState(5, fanEnabled, fanSpeed);
      sendChannelState(6, relayStates[0] || relayStates[1] || relayStates[2] || relayStates[3] || fanEnabled);
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" retrying in 5 seconds...");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  
  pinMode(STATUS_LED, OUTPUT);
  pinMode(RESET_BUTTON, INPUT_PULLUP);
  
  pinMode(RELAY_1, OUTPUT);
  pinMode(RELAY_2, OUTPUT);
  pinMode(RELAY_3, OUTPUT);
  pinMode(RELAY_4, OUTPUT);

  pinMode(FAN_SPEED_1, OUTPUT);
  pinMode(FAN_SPEED_2, OUTPUT);
  pinMode(FAN_SPEED_4, OUTPUT);

  // 1. Restore last saved state from NVS memory on boot
  loadStateFromNVS();

  // Apply restored hardware outputs
  applyHardware();

  // 2. Generate unique Node ID
  generateNodeId();

  // 3. Check for Manual Factory Reset (BOOT button held down for 3 seconds)
  Serial.println("Checking Boot Button state...");
  if (digitalRead(RESET_BUTTON) == LOW) {
    Serial.println("Factory Reset Triggered! Hold button for 3 seconds to confirm...");
    delay(3000);
    if (digitalRead(RESET_BUTTON) == LOW) {
      Serial.println("[Reset] Erasing WiFi configurations from NVS flash!");
      preferences.begin("wifi", false);
      preferences.clear();
      preferences.end();
      blinkLED(10, 80); // Rapid blink confirmation
    }
  }

  // 4. Retrieve saved WiFi configurations (Read-Only mode = true for NVS safety)
  preferences.begin("wifi", true);
  ssid = preferences.getString("ssid", "");
  password = preferences.getString("pass", "");
  preferences.end();

  // 5. Resilient WiFi Connection with 3 Retries (20-second timeout per attempt)
  if (ssid.length() > 0) {
    Serial.printf("Saved WiFi credentials found for SSID: %s\n", ssid.c_str());
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.persistent(true);

    bool connected = false;
    const int MAX_ATTEMPTS = 3;
    const int TIMEOUT_PER_ATTEMPT_SECONDS = 20;

    for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      Serial.printf("[WiFi] Attempt %d/%d: Connecting to '%s'...\n", attempt, MAX_ATTEMPTS, ssid.c_str());
      
      WiFi.disconnect(true);
      delay(200);
      WiFi.begin(ssid.c_str(), password.c_str());

      int retries = 0;
      int max_retries = TIMEOUT_PER_ATTEMPT_SECONDS * 2; // 500ms steps -> 20 seconds
      while (WiFi.status() != WL_CONNECTED && retries < max_retries) {
        delay(500);
        Serial.print(".");
        digitalWrite(STATUS_LED, !digitalRead(STATUS_LED)); // toggle LED
        retries++;
      }
      Serial.println();

      if (WiFi.status() == WL_CONNECTED) {
        connected = true;
        break;
      }

      Serial.printf("[WiFi] Attempt %d failed. Waiting 3 seconds before next retry...\n", attempt);
      digitalWrite(STATUS_LED, HIGH);
      delay(3000);
    }

    if (connected && WiFi.status() == WL_CONNECTED) {
      Serial.println("\nWiFi Connected Successfully!");
      Serial.print("Local IP Address: ");
      Serial.println(WiFi.localIP());
      digitalWrite(STATUS_LED, LOW); // turn off on success
      
      // Disable WiFi Sleep Mode to ensure instant MQTT message delivery (<10ms latency)
      WiFi.setSleep(false);
      
      // Bypasses certificate chain validation securely for EMQX Serverless TLS
      espClient.setInsecure();
      
      // Initialize MQTT Broker Connection with 60s KeepAlive & 1024 Buffer Size
      client.setServer(mqtt_server, mqtt_port);
      client.setKeepAlive(60);
      client.setBufferSize(1024);
      client.setCallback(callback);

      // Start Local HTTP Web Server on Port 80
      setupLocalWebServer();

      // Initialize mDNS Responder (4layers-{node_id}.local)
      String mdnsHost = "4layers-" + String(NODE_ID);
      mdnsHost.toLowerCase();
      mdnsHost.replace("_", "-");
      if (MDNS.begin(mdnsHost.c_str())) {
        Serial.printf("[mDNS] Responder started: http://%s.local\n", mdnsHost.c_str());
        MDNS.addService("http", "tcp", 80);
      } else {
        Serial.println("[mDNS] Error setting up MDNS responder");
      }
    } else {
      Serial.println("\nAll 3 WiFi Connection Attempts Failed. Reverting to Setup Mode AP.");
      startSetupPortal();
    }
  } else {
    Serial.println("No WiFi configurations found in memory. Loading setup AP portal.");
    startSetupPortal();
  }
}

void loop() {
  checkResetButton(); // Always check reset button state (at runtime or setup mode)

  if (inSetupMode) {
    server.handleClient(); // Handle HTTP server requests
    if (shouldReboot) {
      Serial.println("[Setup] Rebooting board in 2 seconds...");
      blinkLED(5, 100);
      delay(2000);
      ESP.restart();
    }
    delay(10);
    return; // Stay in configuration loop until rebooted
  }

  // Handle local HTTP requests on port 80 in normal Station Mode (Zero-Latency Local LAN Control)
  server.handleClient();

  if (!client.connected()) {
    reconnectMqtt();
  }
  client.loop();

  // Send periodic state telemetry heartbeat updates (every 45s)
  unsigned long now = millis();
  if (now - lastHeartbeat > heartbeatInterval) {
    lastHeartbeat = now;
    if (client.connected()) {
      Serial.println("Sending periodic telemetry heartbeat...");
      for (int i = 1; i <= 4; i++) sendChannelState(i, relayStates[i-1]);
      sendChannelState(5, fanEnabled, fanSpeed);
      sendChannelState(6, relayStates[0] || relayStates[1] || relayStates[2] || relayStates[3] || fanEnabled);
    }
  }
}
