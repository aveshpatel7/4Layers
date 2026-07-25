/*
 * SmartNest Multi-Channel Production Firmware (7 Channels)
 * Target Microcontroller: ESP32 Dev Module
 * 
 * Features:
 *   1. Custom Local WebServer (SoftAP): Exposes a direct `/config` HTTP endpoint.
 *      The mobile app sends SSID/Password here to pair the board dynamically.
 *   2. Preferences Storage: Securely saves WiFi configurations in the ESP32 NVS flash.
 *   3. Manual Factory Reset Button: Hold the ESP32 physical BOOT button (GPIO 0) 
 *      for 3 seconds on startup to clear credentials and trigger Setup Mode.
 *   4. Unique Node ID Generation: Generates an MQTT client identifier using the MAC address.
 *   5. Multi-Channel MQTT Controls: Listens to toggles, fan speeds, and LED brightness.
 * 
 * Pin Configuration mapping:
 *   - Channel 1 (Switch 1): Relay 1 connected to GPIO 12
 *   - Channel 2 (Switch 2): Relay 2 connected to GPIO 13
 *   - Channel 3 (Switch 3): Relay 3 connected to GPIO 14
 *   - Channel 4 (Switch 4): Relay 4 connected to GPIO 15
 *   - Channel 5 (Ceiling Fan): PWM speed driver on GPIO 16 (Speed 1-5 mapping)
 *   - Channel 6 (LED Strip): PWM brightness driver on GPIO 17 (0-100% dimming)
 *   - Channel 7 (Master Switch): Logical toggle for all channels combined.
 * 
 * Required Libraries (Install via Arduino Library Manager):
 *   - PubSubClient (by Nick O'Leary)
 *   - ArduinoJson (by Benoit Blanchon)
 */

#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ==========================================
// 🔧 CONFIGURATION (GLOBAL SETTINGS)
// ==========================================
const char* mqtt_server = "broker.emqx.io";
const int mqtt_port = 1883;

// Pin Definitions
const int RELAY_1 = 12;
const int RELAY_2 = 13;
const int RELAY_3 = 14;
const int RELAY_4 = 15;
const int FAN_PWM = 16;
const int LED_PWM = 17;
const int STATUS_LED = 2;   // Onboard LED
const int RESET_BUTTON = 0; // ESP32 physical BOOT button

// PWM Properties for Fan and LED dimming
const int pwmFreq = 5000;
const int pwmResolution = 8; // 8-bit resolution (0-255)
const int FAN_CHANNEL = 0;
const int LED_CHANNEL = 1;

// Device States
bool relayStates[4] = {false, false, false, false};
bool fanEnabled = false;
int fanSpeed = 3; // Default speed: 3/5
bool ledEnabled = false;
int ledBrightness = 50; // Default brightness: 50%

char NODE_ID[32];        
char command_topic[100]; 
char status_topic[100];  

WiFiClient espClient;
PubSubClient client(espClient);
WebServer server(80);
Preferences preferences;

unsigned long lastHeartbeat = 0;
const unsigned long heartbeatInterval = 45000; // telemetry updates every 45s

bool inSetupMode = false;
String ssid = "";
String password = "";

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

// --- Publish Channel State telemetry back to MQTT ---
void sendChannelState(int channel, bool status, int val = -1) {
  StaticJsonDocument<200> doc;
  doc["channel"] = channel;
  doc["status"] = status ? "ON" : "OFF";
  if (val != -1) {
    if (channel == 5) {
      doc["speed"] = val;
    } else if (channel == 6) {
      doc["value"] = val;
    }
  }

  char buffer[256];
  serializeJson(doc, buffer);

  Serial.print("Publishing state update: ");
  Serial.println(buffer);
  client.publish(status_topic, buffer, true);
}

// --- Apply hardware outputs ---
void applyHardware() {
  digitalWrite(RELAY_1, relayStates[0] ? HIGH : LOW);
  digitalWrite(RELAY_2, relayStates[1] ? HIGH : LOW);
  digitalWrite(RELAY_3, relayStates[2] ? HIGH : LOW);
  digitalWrite(RELAY_4, relayStates[3] ? HIGH : LOW);
  
  // Apply Fan speed (Speed 1-5 maps to PWM 50-255 duty cycle)
  if (fanEnabled) {
    int duty = map(fanSpeed, 1, 5, 50, 255);
    ledcWrite(FAN_CHANNEL, duty);
  } else {
    ledcWrite(FAN_CHANNEL, 0);
  }

  // Apply LED brightness (0-100% maps to PWM 0-255 duty cycle)
  if (ledEnabled) {
    int duty = map(ledBrightness, 0, 100, 0, 255);
    ledcWrite(LED_CHANNEL, duty);
  } else {
    ledcWrite(LED_CHANNEL, 0);
  }
}

// --- Web Server Setup Mode Handler ---
void handleConfigRoute() {
  // CORS Headers to allow React Native local fetch requests
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (server.method() == HTTP_OPTIONS) {
    server.send(200, "text/plain", "OK");
    return;
  }

  String reqSsid = server.arg("ssid");
  String reqPass = server.arg("pass");

  if (reqSsid.length() > 0) {
    Serial.printf("[Setup] Received SSID: %s, Pass: %s\n", reqSsid.c_str(), reqPass.c_str());
    
    // Save to secure flash preferences namespace "wifi"
    preferences.begin("wifi", false);
    preferences.putString("ssid", reqSsid);
    preferences.putString("pass", reqPass);
    preferences.end();

    // Confirm setup to client
    StaticJsonDocument<200> reply;
    reply["status"] = "success";
    reply["node_id"] = NODE_ID;
    reply["message"] = "Credentials saved. Board rebooting to connect.";
    
    char buffer[256];
    serializeJson(reply, buffer);
    server.send(200, "application/json", buffer);

    Serial.println("[Setup] Saved credentials. Rebooting board...");
    blinkLED(4, 100);
    delay(1500);
    ESP.restart();
  } else {
    server.send(400, "application/json", "{\"status\":\"error\",\"message\":\"SSID is required\"}");
  }
}

// --- Start Local Config Portal ---
void startSetupPortal() {
  inSetupMode = true;
  char portalSSID[50];
  snprintf(portalSSID, sizeof(portalSSID), "SmartNest-Setup-%s", NODE_ID + 8);

  WiFi.mode(WIFI_AP);
  WiFi.softAP(portalSSID);

  Serial.println("\n--- [SETUP MODE ACTIVE] ---");
  Serial.print("1. Connect to WiFi hotspot: ");
  Serial.println(portalSSID);
  Serial.println("2. Setup will post credentials directly from the SmartNest App.");
  Serial.print("Local Setup IP Address: ");
  Serial.println(WiFi.softAPIP());
  Serial.println("---------------------------\n");

  // Keep Status LED ON during Setup Mode
  digitalWrite(STATUS_LED, HIGH);

  server.on("/config", handleConfigRoute);
  server.onNotFound([]() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "text/html", "<h3>SmartNest Setup Active</h3><p>Configure WiFi SSID and Password directly via mobile application setup.</p>");
  });
  server.begin();
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
  // LED Strip (Channel 6)
  else if (channel == 6) {
    ledEnabled = turnOn;
    if (doc.containsKey("value")) {
      ledBrightness = doc["value"];
    }
    sendChannelState(6, ledEnabled, ledBrightness);
  }
  // Master Switch (Channel 7)
  else if (channel == 7) {
    for (int i = 0; i < 4; i++) {
      relayStates[i] = turnOn;
      sendChannelState(i + 1, turnOn);
    }
    fanEnabled = turnOn;
    sendChannelState(5, fanEnabled, fanSpeed);
    
    ledEnabled = turnOn;
    sendChannelState(6, ledEnabled, ledBrightness);
    
    sendChannelState(7, turnOn);
  }

  // Write changes to physical pins
  applyHardware();
}

// --- Reconnect to MQTT Broker Loop ---
void reconnectMqtt() {
  while (!client.connected()) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi disconnected. Reconnecting WiFi first...");
      return;
    }

    Serial.print("Connecting to EMQX MQTT Broker...");
    String clientId = "SmartNestClient-" + String(NODE_ID);
    
    if (client.connect(clientId.c_str())) {
      Serial.println("connected!");
      client.subscribe(command_topic);
      
      // Publish initial state confirmations on reconnect
      for (int i = 1; i <= 4; i++) sendChannelState(i, relayStates[i-1]);
      sendChannelState(5, fanEnabled, fanSpeed);
      sendChannelState(6, ledEnabled, ledBrightness);
      sendChannelState(7, relayStates[0] || relayStates[1] || relayStates[2] || relayStates[3] || fanEnabled || ledEnabled);
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

  // Setup PWM channels for Fan and LED Dimming
  ledcSetup(FAN_CHANNEL, pwmFreq, pwmResolution);
  ledcAttachPin(FAN_PWM, FAN_CHANNEL);
  
  ledcSetup(LED_CHANNEL, pwmFreq, pwmResolution);
  ledcAttachPin(LED_PWM, LED_CHANNEL);

  // Initial boot state is OFF
  applyHardware();

  // 1. Generate unique Node ID
  generateNodeId();

  // 2. Check for Manual Factory Reset (BOOT button held down for 3 seconds)
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

  // 3. Retrieve saved WiFi configurations
  preferences.begin("wifi", true);
  ssid = preferences.getString("ssid", "");
  password = preferences.getString("pass", "");
  preferences.end();

  // 4. Connect WiFi or start configuration portal
  if (ssid.length() > 0) {
    Serial.printf("Attempting WiFi Connection to saved network: %s\n", ssid.c_str());
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid.c_str(), password.c_str());
    
    int retries = 0;
    while (WiFi.status() != WL_CONNECTED && retries < 20) { // wait up to 10s
      delay(500);
      Serial.print(".");
      digitalWrite(STATUS_LED, !digitalRead(STATUS_LED)); // slow toggle
      retries++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\nWiFi Connected Successfully!");
      Serial.print("Local IP Address: ");
      Serial.println(WiFi.localIP());
      digitalWrite(STATUS_LED, LOW); // turn off on success
      
      // Initialize MQTT Broker Connection
      client.setServer(mqtt_server, mqtt_port);
      client.setCallback(callback);
    } else {
      Serial.println("\nConnection Timeout. Reverting to Setup Mode AP.");
      startSetupPortal();
    }
  } else {
    Serial.println("No WiFi configurations found in memory. Loading setup AP portal.");
    startSetupPortal();
  }
}

void loop() {
  if (inSetupMode) {
    server.handleClient();
    return; // Stay in configuration loop until rebooted
  }

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
      sendChannelState(6, ledEnabled, ledBrightness);
    }
  }
}
