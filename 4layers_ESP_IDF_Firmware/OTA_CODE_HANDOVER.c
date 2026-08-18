/* =====================================================================
   SmartNest — MQTT-Triggered HTTPS OTA Update (ESP32 / arduino-esp32)
   =====================================================================
   Total: ~90 lines of code in 5 parts.

   HOW IT WORKS
   ------------
   1. Cloud/App publishes to the device's MQTT command topic:
          { "action": "OTA_UPDATE", "firmware_url": "https://.../firmware.bin" }
   2. Device downloads the .bin over HTTPS and writes it to the INACTIVE
      OTA partition (ota_0 / ota_1 alternate each time).
   3. Progress is published every 10% to:  smartnest/devices/<ID>/ota/status
   4. On success the device reboots into the new firmware.
      On failure the OLD firmware keeps running — the device never bricks.

   REQUIREMENTS (all 5 must be done, else OTA will not work)
   ---------------------------------------------------------
   [ ] 4MB flash chip with an OTA partition table (see PART 5)
   [ ] WiFi connected
   [ ] MQTT client connected and subscribed to the command topic
   [ ] Task Watchdog initialised (esp_task_wdt_reset is called during download)
   [ ] NODE_ID / client / preferences globals already exist in the firmware
   ===================================================================== */


/* ---------------------------------------------------------------------
   PART 1 — INCLUDES  (add to the top of the sketch / main.cpp)
   --------------------------------------------------------------------- */
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPUpdate.h>          // <-- the OTA engine
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <esp_task_wdt.h>


/* ---------------------------------------------------------------------
   PART 2 — GLOBALS EXPECTED TO ALREADY EXIST
   (do NOT duplicate these if the firmware already has them)
   --------------------------------------------------------------------- */
// extern char NODE_ID[32];              // unique device id, e.g. "SN_A1B2C3"
// extern PubSubClient client;           // connected MQTT client
// extern WiFiClientSecure espClient;    // the MQTT transport


/* ---------------------------------------------------------------------
   PART 3 — REMOTE LOG + OTA STATUS PUBLISHER   (~30 lines)
   --------------------------------------------------------------------- */

// Prints to Serial AND mirrors the line to MQTT so the cloud can see it.
void logRemote(const String& msg)
{
    Serial.println(msg);

    if (client.connected())
    {
        char logTopic[120];
        snprintf(logTopic, sizeof(logTopic), "smartnest/devices/%s/logs", NODE_ID);
        client.publish(logTopic, msg.c_str());
    }
}

// Publishes {"status":"...","progress":N} as a RETAINED message so the app
// can read the last known OTA state even after reconnecting.
void publishOTAStatus(const char* status, int progress)
{
    if (!client.connected())
    {
        Serial.println("[ERROR] Cannot publish OTA status. MQTT not connected.");
        return;
    }

    StaticJsonDocument<128> doc;
    doc["status"]   = status;      // "downloading" | "success" | "failed"
    doc["progress"] = progress;    // 0..100

    char buffer[128];
    serializeJson(doc, buffer);

    char ota_status_topic[120];
    snprintf(ota_status_topic, sizeof(ota_status_topic),
             "smartnest/devices/%s/ota/status", NODE_ID);
    client.publish(ota_status_topic, buffer, true);   // true = retained

    logRemote("[OTA MQTT] Status: " + String(buffer));
}


/* ---------------------------------------------------------------------
   PART 4 — THE OTA DOWNLOAD + FLASH ROUTINE   (~50 lines)
   --------------------------------------------------------------------- */
void performOTAUpdate(const String& firmwareUrl)
{
    // Random delay so 1000 devices updating at once don't hammer the server
    // at the exact same millisecond (thundering-herd protection).
    int jitterMs = random(1000, 5000);
    logRemote("================================================");
    logRemote("[OTA] Starting Update. Jitter Delay: " + String(jitterMs) + "ms");
    delay(jitterMs);

    logRemote("[OTA] Target URL: " + firmwareUrl);

    WiFiClientSecure otaClient;
    otaClient.setInsecure();        // skip cert validation; use setCACert() to pin
    otaClient.setTimeout(15000);    // milliseconds on ESP32 (NOT seconds)

    httpUpdate.onProgress([](int cur, int total)
    {
        if (total <= 0)
        {
            return;
        }

        int percent = (cur * 100) / total;
        static int lastPercent = -1;

        // Report every 10% only — publishing every byte would flood MQTT.
        if (percent != lastPercent && (percent % 10 == 0 || percent == 100))
        {
            lastPercent = percent;
            publishOTAStatus("downloading", percent);
            logRemote("[OTA PROGRESS] Downloaded " + String(percent) + "%");
        }

        // MUST be here: a big download takes longer than the watchdog
        // timeout, so feed the watchdog or the device will reboot mid-update.
        esp_task_wdt_reset();
    });

    publishOTAStatus("downloading", 0);
    Serial.println("[SYSTEM] OTA Download starting...");

    t_httpUpdate_return ret = httpUpdate.update(otaClient, firmwareUrl);

    if (ret == HTTP_UPDATE_OK)
    {
        logRemote("[OTA SUCCESS] Flashing complete! Rebooting...");
        publishOTAStatus("success", 100);
        delay(1000);
        ESP.restart();              // boots into the newly written partition
    }
    else
    {
        // Failure is safe: nothing was committed, old firmware still active.
        logRemote("[OTA ERROR] Failed! Code: " + String(httpUpdate.getLastError()));
        publishOTAStatus("failed", 0);
    }
}


/* ---------------------------------------------------------------------
   PART 5 — MQTT TRIGGER
   Paste this block INSIDE the existing mqtt_callback(), right after the
   JSON has been parsed into `doc`.
   --------------------------------------------------------------------- */
/*
void mqtt_callback(char* topic, byte* payload, unsigned int length)
{
    StaticJsonDocument<384> doc;
    if (deserializeJson(doc, payload, length)) { return; }

    // ---------- PASTE FROM HERE ----------
    if (doc.containsKey("action") && doc["action"] == "OTA_UPDATE")
    {
        const char* url = doc["firmware_url"];

        if (url && strlen(url) > 0)
        {
            Serial.println("[APP/CLOUD] OTA Update Command Received!");
            logRemote("[MQTT] OTA Update Command Received!");
            performOTAUpdate(String(url));
        }
        else
        {
            Serial.println("[ERROR] OTA Command missing firmware URL!");
        }
        return;
    }
    // ---------- PASTE TO HERE ----------

    // ... rest of the existing command handling ...
}
*/


/* =====================================================================
   PARTITION TABLE — partitions.csv  (REQUIRED, 4MB flash)
   =====================================================================
   Without two app partitions OTA is impossible. Create partitions.csv in
   the project root with exactly this content:

   # Name,   Type, SubType, Offset,   Size
   nvs,      data, nvs,     0x9000,   0x5000
   otadata,  data, ota,     0xE000,   0x2000
   app0,     app,  ota_0,   0x10000,  0x1C0000
   app1,     app,  ota_1,   0x1D0000, 0x1C0000
   spiffs,   data, spiffs,  0x390000, 0x70000

   ESP-IDF — add to sdkconfig.defaults:
       CONFIG_PARTITION_TABLE_CUSTOM=y
       CONFIG_PARTITION_TABLE_CUSTOM_FILENAME="partitions.csv"
       CONFIG_PARTITION_TABLE_OFFSET=0x8000
       CONFIG_ESPTOOLPY_FLASHSIZE_4MB=y

   Arduino IDE — Tools menu:
       Partition Scheme -> "Minimal SPIFFS" or any scheme listing OTA
       Flash Size       -> 4MB (32Mb)


   =====================================================================
   HOW TO TRIGGER (from server / app / CLI)
   =====================================================================
   Publish to:  smartnest/devices/<NODE_ID>/command
   Payload:
       {"action":"OTA_UPDATE","firmware_url":"https://your-server.com/fw_v2.bin"}

   Test from a PC with mosquitto:
       mosquitto_pub -h <broker> -p 8883 -u <user> -P <pass> \
         -t "smartnest/devices/SN_A1B2C3/command" \
         -m '{"action":"OTA_UPDATE","firmware_url":"https://example.com/fw.bin"}'

   Watch progress on:  smartnest/devices/<NODE_ID>/ota/status
   Watch logs on:      smartnest/devices/<NODE_ID>/logs


   =====================================================================
   GOTCHAS — the 5 things that actually break OTA in the field
   =====================================================================
   1. WRONG .bin FILE
      Upload the APP binary only, e.g. build/<project>.bin (Arduino: Sketch ->
      Export Compiled Binary). Do NOT upload bootloader.bin, partition-table.bin,
      or a merged/combined .bin — the update will fail or brick the boot.

   2. FIRMWARE TOO BIG
      The .bin must fit in ONE app partition (1.75MB with the table above).
      idf.py build prints the free space; if it says 0% free, OTA cannot work.

   3. WATCHDOG REBOOT MID-DOWNLOAD
      esp_task_wdt_reset() inside onProgress is not optional. Remove it and
      slow networks will cause a reboot at ~40-60%.

   4. TIMEOUT UNITS
      setTimeout() is MILLISECONDS on ESP32 (it was seconds on ESP8266).
      setTimeout(15) = instant failure. Use setTimeout(15000).

   5. HTTPS REDIRECTS / CERTIFICATES
      setInsecure() skips validation, which is fine for a trusted server.
      Note that S3/CloudFront pre-signed URLs often 302-redirect; if the
      update fails with a redirect error, use a direct URL or call
      httpUpdate.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS).

   ERROR CODES from httpUpdate.getLastError():
      -1   could not connect / TLS handshake failed
      -3   no HTTP response
      -100 not enough space in the partition
      -103 wrong magic byte — you uploaded a non-app binary (see gotcha #1)
   ===================================================================== */
