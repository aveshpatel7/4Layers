/* * ==========================================================
 * Project: Go Smart  - All In One (AIO) V2
 * Firmware Version: V10.7 (FAN-STATE PERSISTENCE FIX - OPTION A)
 * Description: V10.6 Logic + Immediate NVS Commit for Fan State
 *
 * CHANGE LOG (V10.6 -> V10.7):
 *  - Added save_state_to_nvs_immediate() which writes AND commits to
 *    flash synchronously, instead of only marking the RAM cache dirty.
 *  - pref_save_fan() now uses save_state_to_nvs_immediate() for the
 *    "F_S" (fan speed), "F_P" (fan power) and "L_S" (last non-zero
 *    speed memory) keys, so fan state can no longer be lost if power
 *    is cut during the up-to-30-second window the old cached/batched
 *    nvs_commit_task() used to wait before flushing to flash.
 *  - Relay states (R1-R4) intentionally remain on the original
 *    cached/batched path, since they can toggle rapidly (RF remote,
 *    physical switches, app) and immediate-write-per-toggle there
 *    would add unnecessary flash wear for no real benefit.
 * ==========================================================
 */

#include <stdio.h>
#include <string.h>
#include <nvs_flash.h>
#include "nvs.h"
#include "driver/gpio.h"
#include "esp_event.h"
#include "esp_wifi.h"
#include "esp_netif.h"
#include "esp_timer.h"
#include "esp_task_wdt.h"
#include "esp_log.h"
#include <esp_rmaker_core.h>
#include <esp_rmaker_standard_types.h>
#include <esp_rmaker_standard_devices.h>
#include <esp_rmaker_standard_params.h>
#include <esp_rmaker_utils.h>
#include <esp_rmaker_schedule.h>
#include <esp_rmaker_common_events.h> 
#include <app_network.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include <esp_rmaker_ota.h> 

static const char *TAG = "Go_Smart_AIO";

// ==========================================================
// 1. CONSTANTS & THRESHOLDS
// ==========================================================

#define DEBOUNCE_MS                 15
#define PAIRING_TIMEOUT_MS          25000U
#define PAIRING_CONFIRM_MS          300U 
#define PAIRING_LED_BLINK_MS        120U
#define WIFI_STUCK_MS               180000U

#define SWITCH1_PAIR_TOGGLES        15
#define SWITCH2_RESET_TOGGLES       20

#define RF_TIMINGS_LEN              (sizeof(rf_timings)/sizeof(rf_timings[0]))
#define NVS_CACHE_LEN               (sizeof(nvs_cache)/sizeof(nvs_cache[0]))

// ==========================================================
// 2. HARDWARE PINS SETUP
// ==========================================================

static const gpio_num_t relay1 = GPIO_NUM_15;
static const gpio_num_t relay2 = GPIO_NUM_5;
static const gpio_num_t relay3 = GPIO_NUM_4;
static const gpio_num_t relay4 = GPIO_NUM_22;

static const gpio_num_t Speed1 = GPIO_NUM_21;
static const gpio_num_t Speed2 = GPIO_NUM_19;
static const gpio_num_t Speed4 = GPIO_NUM_18;

static const gpio_num_t switch1 = GPIO_NUM_32;
static const gpio_num_t switch2 = GPIO_NUM_35; 
static const gpio_num_t switch3 = GPIO_NUM_34; 
static const gpio_num_t switch4 = GPIO_NUM_39; 
static const gpio_num_t fan_switch = GPIO_NUM_33;

static const gpio_num_t s1 = GPIO_NUM_27;
static const gpio_num_t s2 = GPIO_NUM_14;
static const gpio_num_t s3 = GPIO_NUM_12; 
static const gpio_num_t s4 = GPIO_NUM_13;

static const gpio_num_t gpio_reset = GPIO_NUM_0; 
static const gpio_num_t wifiLed = GPIO_NUM_2;
#define RF_PIN 23

// ==========================================================
// 3. GLOBAL VARIABLES & DUAL-CORE LOCKS
// ==========================================================

static portMUX_TYPE state_mux = portMUX_INITIALIZER_UNLOCKED;

bool switch_state_ch1 = false;
bool switch_state_ch2 = false;
bool switch_state_ch3 = false;
bool switch_state_ch4 = false;

int curr_speed = 0;
int fan_speed_memory = 1;
bool fan_power = false;

bool speed1_flag = 1;
bool speed2_flag = 1;
bool speed3_flag = 1;
bool speed4_flag = 1;
bool speed0_flag = 1;

uint32_t rf_code_l1 = 0;
uint32_t rf_code_l2 = 0;
uint32_t rf_code_l3 = 0;
uint32_t rf_code_l4 = 0;
uint32_t rf_code_up = 0;
uint32_t rf_code_dw = 0;
uint32_t rf_code_fan_toggle = 0;
uint32_t rf_code_master = 0;

volatile uint32_t rf_received_value = 0;
volatile bool rf_available = false;

int pairing_target = 0;
uint64_t pairing_timeout = 0;
uint64_t pairing_confirm_until_ms = 0;

uint64_t last_switch1_toggle_time = 0;
uint64_t last_switch2_toggle_time = 0;
int switch1_toggle_count = 0;
int switch2_toggle_count = 0;

uint64_t pairing_led_last_toggle_ms = 0;
bool pairing_led_state = false;

volatile bool is_wifi_connected = false;
volatile bool is_cloud_connected = false; 
volatile bool wasConnected = false;
volatile bool ota_in_progress = false;

volatile uint64_t wifiDisconnectTime = 0;
volatile uint64_t cloudDisconnectTime = 0;
volatile int pending_fan_speed = -1;

esp_rmaker_node_t *my_node = NULL;
esp_rmaker_param_t *ota_status_param = NULL;
esp_rmaker_param_t *wifi_signal_param = NULL;

static TaskHandle_t bulk_on_handle = NULL;
static TaskHandle_t bulk_off_handle = NULL;

// ==========================================================
// 4. NVS CACHING SYSTEM
// ==========================================================

typedef struct {
    const char *key;
    uint8_t value;
    bool dirty;
} nvs_cache_t;

static nvs_cache_t nvs_cache[] = {
    {"R1", 0, false}, 
    {"R2", 0, false}, 
    {"R3", 0, false}, 
    {"R4", 0, false},
    {"F_S", 0, false}, 
    {"F_P", 0, false}, 
    {"L_S", 1, false}
};

uint8_t load_state_from_nvs(const char *key, uint8_t def) 
{
    nvs_handle_t h;
    uint8_t v = def;
    
    if (nvs_open("storage", NVS_READONLY, &h) == ESP_OK) 
    {
        esp_err_t r = nvs_get_u8(h, key, &v);
        
        if (r != ESP_OK && r != ESP_ERR_NVS_NOT_FOUND) 
        {
            ESP_LOGW(TAG, "NVS read error for %s: %s", key, esp_err_to_name(r));
        }
        
        nvs_close(h);
    }
    
    portENTER_CRITICAL(&state_mux);
    
    for (int i = 0; i < NVS_CACHE_LEN; i++) 
    {
        if (strcmp(nvs_cache[i].key, key) == 0) 
        {
            nvs_cache[i].value = v;
            nvs_cache[i].dirty = false;
            break;
        }
    }
    
    portEXIT_CRITICAL(&state_mux);
    
    return v;
}

/*
 * save_state_to_nvs()
 * Original CACHED/BATCHED write path.
 * Only updates RAM cache and marks it dirty; the actual flash write
 * happens later, in nvs_commit_task(), up to ~30 seconds afterward.
 * Still used for relay states (R1-R4), which can toggle rapidly.
 */
void save_state_to_nvs(const char *key, uint8_t value) 
{
    portENTER_CRITICAL(&state_mux);
    
    for (int i = 0; i < NVS_CACHE_LEN; i++) 
    {
        if (strcmp(nvs_cache[i].key, key) == 0) 
        {
            if (nvs_cache[i].value != value) 
            {
                nvs_cache[i].value = value;
                nvs_cache[i].dirty = true;
            }
            
            portEXIT_CRITICAL(&state_mux);
            return;
        }
    }
    
    portEXIT_CRITICAL(&state_mux);
}

/*
 * save_state_to_nvs_immediate()  [OPTION A - NEW]
 * Writes the value to flash AND commits it synchronously, right now,
 * instead of waiting for nvs_commit_task()'s periodic batch flush.
 *
 * Used for fan state (F_S, F_P, L_S) because those changes are
 * infrequent (driven by user/RF actions, not rapid switch bounce),
 * so the extra flash write cost is negligible, but losing fan state
 * on a sudden power cut is a real, user-visible problem.
 *
 * The RAM cache is still kept in sync and marked clean, so
 * nvs_commit_task() does not redundantly re-write this key later.
 */
void save_state_to_nvs_immediate(const char *key, uint8_t value)
{
    nvs_handle_t h;
    esp_err_t err = nvs_open("storage", NVS_READWRITE, &h);
    
    if (err == ESP_OK) 
    {
        esp_err_t set_err = nvs_set_u8(h, key, value);
        
        if (set_err == ESP_OK) 
        {
            esp_err_t commit_err = nvs_commit(h);
            
            if (commit_err != ESP_OK) 
            {
                ESP_LOGW(TAG, "Immediate NVS commit failed for %s: %s", key, esp_err_to_name(commit_err));
            }
        } 
        else 
        {
            ESP_LOGW(TAG, "Immediate NVS set failed for %s: %s", key, esp_err_to_name(set_err));
        }
        
        nvs_close(h);
    } 
    else 
    {
        ESP_LOGW(TAG, "Immediate NVS open failed for %s: %s", key, esp_err_to_name(err));
    }
    
    // Keep the RAM cache in sync and clean so the batch task doesn't
    // redundantly (and harmlessly) re-write this key later.
    portENTER_CRITICAL(&state_mux);
    
    for (int i = 0; i < NVS_CACHE_LEN; i++) 
    {
        if (strcmp(nvs_cache[i].key, key) == 0) 
        {
            nvs_cache[i].value = value;
            nvs_cache[i].dirty = false;
            break;
        }
    }
    
    portEXIT_CRITICAL(&state_mux);
}

void nvs_commit_task(void *pv) 
{
    esp_task_wdt_add(NULL);
    
    nvs_handle_t h;
    
    while (1) 
    {
        for (int w = 0; w < 10; w++) 
        {
            vTaskDelay(pdMS_TO_TICKS(3000));
            esp_task_wdt_reset(); 
        }
        
        bool needs_commit = false;
        
        portENTER_CRITICAL(&state_mux);
        
        for (int i = 0; i < NVS_CACHE_LEN; i++) 
        {
            if (nvs_cache[i].dirty) 
            {
                needs_commit = true; 
                break; 
            }
        }
        
        portEXIT_CRITICAL(&state_mux);
        
        if (needs_commit) 
        {
            if (nvs_open("storage", NVS_READWRITE, &h) == ESP_OK) 
            {
                bool keys_written[NVS_CACHE_LEN] = {false};
                
                portENTER_CRITICAL(&state_mux);
                
                for (int i = 0; i < NVS_CACHE_LEN; i++) 
                {
                    if (nvs_cache[i].dirty) 
                    {
                        esp_err_t r = nvs_set_u8(h, nvs_cache[i].key, nvs_cache[i].value);
                        
                        if (r == ESP_OK) 
                        {
                            keys_written[i] = true;
                        }
                    }
                }
                
                portEXIT_CRITICAL(&state_mux);
                
                esp_err_t commit_err = nvs_commit(h);
                
                if (commit_err == ESP_OK) 
                {
                    portENTER_CRITICAL(&state_mux);
                    
                    for (int i = 0; i < NVS_CACHE_LEN; i++) 
                    {
                        if (keys_written[i]) 
                        {
                            nvs_cache[i].dirty = false;
                        }
                    }
                    
                    portEXIT_CRITICAL(&state_mux);
                }
                
                nvs_close(h);
            }
        }
    }
}

uint32_t load_code(const char *key, uint32_t def) 
{
    nvs_handle_t h;
    uint32_t v = def;
    
    if (nvs_open("codes", NVS_READONLY, &h) == ESP_OK) 
    {
        esp_err_t r = nvs_get_u32(h, key, &v);
        
        if (r != ESP_OK && r != ESP_ERR_NVS_NOT_FOUND) 
        {
            ESP_LOGW(TAG, "NVS read error for %s: %s", key, esp_err_to_name(r));
        }
        
        nvs_close(h);
    }
    
    return v;
}

void save_code(const char *key, uint32_t val) 
{
    nvs_handle_t h;
    
    if (nvs_open("codes", NVS_READWRITE, &h) == ESP_OK) 
    {
        esp_err_t err = nvs_set_u32(h, key, val);
        
        if (err == ESP_OK) 
        {
            err = nvs_commit(h);
        }
        
        nvs_close(h);
    }
}

// ==========================================================
// 5. SYSTEM EVENT HANDLERS
// ==========================================================

static void ota_event_handler(void *arg, esp_event_base_t base, int32_t id, void *data) 
{
    if (base == RMAKER_OTA_EVENT) 
    {
        switch (id) 
        {
            case RMAKER_OTA_EVENT_STARTING:
                ota_in_progress = true; 
                if (ota_status_param) 
                {
                    esp_rmaker_param_update_and_report(ota_status_param, esp_rmaker_str("Updating..."));
                }
                break;
                
            case RMAKER_OTA_EVENT_SUCCESSFUL: 
                ota_in_progress = false; 
                if (ota_status_param) 
                {
                    esp_rmaker_param_update_and_report(ota_status_param, esp_rmaker_str("Success!"));
                }
                break;
                
            case RMAKER_OTA_EVENT_FAILED:
                ota_in_progress = false; 
                if (ota_status_param) 
                {
                    esp_rmaker_param_update_and_report(ota_status_param, esp_rmaker_str("Failed!"));
                }
                break;
        }
    }
}

static void rmaker_event_handler(void *arg, esp_event_base_t base, int32_t id, void *data) 
{
    if (base == RMAKER_COMMON_EVENT) 
    {
        if (id == RMAKER_MQTT_EVENT_CONNECTED) 
        {
            is_cloud_connected = true;
            
            portENTER_CRITICAL(&state_mux);
            cloudDisconnectTime = 0;
            portEXIT_CRITICAL(&state_mux);
        } 
        else if (id == RMAKER_MQTT_EVENT_DISCONNECTED) 
        {
            is_cloud_connected = false;
            
            portENTER_CRITICAL(&state_mux);
            if (cloudDisconnectTime == 0) 
            {
                cloudDisconnectTime = (uint64_t)(esp_timer_get_time() / 1000ULL);
            }
            portEXIT_CRITICAL(&state_mux);
        }
    }
}

static void wifi_event_handler(void *arg, esp_event_base_t base, int32_t id, void *data) 
{
    if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) 
    {
        is_wifi_connected = true;
        wasConnected = true;
        
        portENTER_CRITICAL(&state_mux);
        wifiDisconnectTime = 0;
        portEXIT_CRITICAL(&state_mux);
    } 
    else if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) 
    {
        is_wifi_connected = false;
        wifi_event_sta_disconnected_t* event = (wifi_event_sta_disconnected_t*) data;
        int reason = event ? event->reason : -1;
        
        portENTER_CRITICAL(&state_mux);
        if (wifiDisconnectTime == 0) 
        {
            wifiDisconnectTime = (uint64_t)(esp_timer_get_time() / 1000ULL);
        }
        portEXIT_CRITICAL(&state_mux);
        
        if (reason != 203 && reason != 202 && reason != 205) 
        {
            esp_wifi_connect();
        }
    }
}

// ==========================================================
// 6. CORE LOGIC (App & Relays)
// ==========================================================

void update_app_state(const char *dev_name, bool state) 
{
    if (my_node) 
    {
        esp_rmaker_device_t *dev = esp_rmaker_node_get_device_by_name(my_node, dev_name);
        
        if (dev) 
        {
            esp_rmaker_param_t *param = esp_rmaker_device_get_param_by_name(dev, "Power");
            
            if (!param) 
            {
                return;
            }
            
            if (is_cloud_connected) 
            {
                esp_rmaker_param_update_and_report(param, esp_rmaker_bool(state));
            } 
            else 
            {
                esp_rmaker_param_update(param, esp_rmaker_bool(state));
            }
        }
    }
}

/*
 * pref_save_fan()  [MODIFIED - OPTION A]
 * Now uses save_state_to_nvs_immediate() for F_S / F_P / L_S so fan
 * state survives an abrupt power loss instead of only living in the
 * RAM cache for up to ~30 seconds.
 */
void pref_save_fan() 
{
    int safe_speed;
    bool safe_power;
    
    portENTER_CRITICAL(&state_mux);
    safe_speed = curr_speed;
    safe_power = fan_power;
    portEXIT_CRITICAL(&state_mux);
    
    save_state_to_nvs_immediate("F_S", (uint8_t)safe_speed);
    save_state_to_nvs_immediate("F_P", (uint8_t)safe_power);
    
    if (safe_speed > 0) 
    {
        portENTER_CRITICAL(&state_mux);
        fan_speed_memory = safe_speed;
        portEXIT_CRITICAL(&state_mux);
        
        save_state_to_nvs_immediate("L_S", (uint8_t)safe_speed);
    }
    
    if (my_node) 
    {
        esp_rmaker_device_t *f_dev = esp_rmaker_node_get_device_by_name(my_node, "Fan");
        
        if (f_dev) 
        {
            esp_rmaker_param_t *p_pow = esp_rmaker_device_get_param_by_name(f_dev, "Power");
            esp_rmaker_param_t *p_spd = esp_rmaker_device_get_param_by_name(f_dev, "My_Speed");
            
            if (!p_pow || !p_spd) 
            {
                return;
            }
            
            if (is_cloud_connected) 
            {
                esp_rmaker_param_update_and_report(p_pow, esp_rmaker_bool(safe_power));
                esp_rmaker_param_update_and_report(p_spd, esp_rmaker_int(safe_speed));
            } 
            else 
            {
                esp_rmaker_param_update(p_pow, esp_rmaker_bool(safe_power));
                esp_rmaker_param_update(p_spd, esp_rmaker_int(safe_speed));
            }
        }
    }
}

void set_fan_relays(int t_s1, int t_s2, int t_s4) 
{
    gpio_set_level(Speed1, 0); 
    gpio_set_level(Speed2, 0); 
    gpio_set_level(Speed4, 0);
    
    vTaskDelay(pdMS_TO_TICKS(500));
    
    if (t_s1 == 1) 
    {
        gpio_set_level(Speed1, 1);
    }
    
    if (t_s2 == 1) 
    {
        gpio_set_level(Speed2, 1);
    }
    
    if (t_s4 == 1) 
    {
        gpio_set_level(Speed4, 1);
    }
}

void speed_0() 
{ 
    portENTER_CRITICAL(&state_mux);
    curr_speed = 0; 
    fan_power = false; 
    portEXIT_CRITICAL(&state_mux);
    
    set_fan_relays(0, 0, 0); 
    pref_save_fan(); 
}

void speed_1() 
{ 
    portENTER_CRITICAL(&state_mux);
    curr_speed = 1; 
    fan_power = true; 
    portEXIT_CRITICAL(&state_mux);
    
    set_fan_relays(1, 0, 0); 
    pref_save_fan(); 
}

void speed_2() 
{ 
    portENTER_CRITICAL(&state_mux);
    curr_speed = 2; 
    fan_power = true; 
    portEXIT_CRITICAL(&state_mux);
    
    set_fan_relays(0, 1, 0); 
    pref_save_fan(); 
}

void speed_3() 
{ 
    portENTER_CRITICAL(&state_mux);
    curr_speed = 3; 
    fan_power = true; 
    portEXIT_CRITICAL(&state_mux);
    
    set_fan_relays(1, 1, 0); 
    pref_save_fan(); 
}

void speed_4() 
{ 
    portENTER_CRITICAL(&state_mux);
    curr_speed = 4; 
    fan_power = true; 
    portEXIT_CRITICAL(&state_mux);
    
    set_fan_relays(0, 0, 1); 
    pref_save_fan(); 
}

void restore_fan_speed() 
{
    int mem_speed;
    
    portENTER_CRITICAL(&state_mux);
    if (fan_speed_memory < 1 || fan_speed_memory > 4) 
    {
        fan_speed_memory = 1; 
    }
    mem_speed = fan_speed_memory;
    portEXIT_CRITICAL(&state_mux);
    
    if (mem_speed == 1) 
    {
        speed_1();
    }
    else if (mem_speed == 2) 
    {
        speed_2();
    }
    else if (mem_speed == 3) 
    {
        speed_3();
    }
    else if (mem_speed == 4) 
    {
        speed_4();
    }
}

// ==========================================================
// 7. SEQUENCER TASKS
// ==========================================================

static void bulk_on_task(void *pv) 
{
    portENTER_CRITICAL(&state_mux); 
    switch_state_ch1 = 1; 
    portEXIT_CRITICAL(&state_mux);
    
    gpio_set_level(relay1, 1); 
    update_app_state("Switch1", 1); 
    save_state_to_nvs("R1", 1); 
    vTaskDelay(pdMS_TO_TICKS(100)); 
    
    portENTER_CRITICAL(&state_mux); 
    switch_state_ch2 = 1; 
    portEXIT_CRITICAL(&state_mux);
    
    gpio_set_level(relay2, 1); 
    update_app_state("Switch2", 1); 
    save_state_to_nvs("R2", 1); 
    vTaskDelay(pdMS_TO_TICKS(100));
    
    portENTER_CRITICAL(&state_mux); 
    switch_state_ch3 = 1; 
    portEXIT_CRITICAL(&state_mux);
    
    gpio_set_level(relay3, 1); 
    update_app_state("Switch3", 1); 
    save_state_to_nvs("R3", 1); 
    vTaskDelay(pdMS_TO_TICKS(100));
    
    portENTER_CRITICAL(&state_mux); 
    switch_state_ch4 = 1; 
    portEXIT_CRITICAL(&state_mux);
    
    gpio_set_level(relay4, 1); 
    update_app_state("Switch4", 1); 
    save_state_to_nvs("R4", 1); 
    vTaskDelay(pdMS_TO_TICKS(100));
    
    bool f_pow;
    
    portENTER_CRITICAL(&state_mux); 
    f_pow = fan_power; 
    portEXIT_CRITICAL(&state_mux);
    
    if (!f_pow) 
    {
        restore_fan_speed();
    }
    
    portENTER_CRITICAL(&state_mux); 
    bulk_on_handle = NULL; 
    portEXIT_CRITICAL(&state_mux);
    
    vTaskDelete(NULL);
}

static void bulk_off_task(void *pv) 
{
    portENTER_CRITICAL(&state_mux); 
    switch_state_ch1 = 0; 
    portEXIT_CRITICAL(&state_mux);
    
    gpio_set_level(relay1, 0); 
    update_app_state("Switch1", 0); 
    save_state_to_nvs("R1", 0); 
    vTaskDelay(pdMS_TO_TICKS(100));
    
    portENTER_CRITICAL(&state_mux); 
    switch_state_ch2 = 0; 
    portEXIT_CRITICAL(&state_mux);
    
    gpio_set_level(relay2, 0); 
    update_app_state("Switch2", 0); 
    save_state_to_nvs("R2", 0); 
    vTaskDelay(pdMS_TO_TICKS(100));
    
    portENTER_CRITICAL(&state_mux); 
    switch_state_ch3 = 0; 
    portEXIT_CRITICAL(&state_mux);
    
    gpio_set_level(relay3, 0); 
    update_app_state("Switch3", 0); 
    save_state_to_nvs("R3", 0); 
    vTaskDelay(pdMS_TO_TICKS(100));
    
    portENTER_CRITICAL(&state_mux); 
    switch_state_ch4 = 0; 
    portEXIT_CRITICAL(&state_mux);
    
    gpio_set_level(relay4, 0); 
    update_app_state("Switch4", 0); 
    save_state_to_nvs("R4", 0); 
    vTaskDelay(pdMS_TO_TICKS(100));
    
    speed_0();
    
    portENTER_CRITICAL(&state_mux); 
    bulk_off_handle = NULL; 
    portEXIT_CRITICAL(&state_mux);
    
    vTaskDelete(NULL);
}

void All_On() 
{ 
    portENTER_CRITICAL(&state_mux);
    if (bulk_on_handle != NULL || bulk_off_handle != NULL) 
    { 
        portEXIT_CRITICAL(&state_mux); 
        return; 
    }
    portEXIT_CRITICAL(&state_mux);
    
    if (xTaskCreate(bulk_on_task, "bulk_on", 4096, NULL, 3, &bulk_on_handle) != pdPASS) 
    { 
        portENTER_CRITICAL(&state_mux); 
        bulk_on_handle = NULL; 
        portEXIT_CRITICAL(&state_mux); 
    }
}

void All_Off() 
{ 
    portENTER_CRITICAL(&state_mux);
    if (bulk_off_handle != NULL || bulk_on_handle != NULL) 
    { 
        portEXIT_CRITICAL(&state_mux); 
        return; 
    }
    portEXIT_CRITICAL(&state_mux);
    
    if (xTaskCreate(bulk_off_task, "bulk_off", 4096, NULL, 3, &bulk_off_handle) != pdPASS) 
    { 
        portENTER_CRITICAL(&state_mux); 
        bulk_off_handle = NULL; 
        portEXIT_CRITICAL(&state_mux); 
    }
}

// ==========================================================
// 8. HARDWARE RF DECODER (Interrupt Service Routine)
// ==========================================================
static void IRAM_ATTR rf_isr(void *arg)
{
    if (rf_available == true) 
    {
        return;
    }
    
    static uint32_t lt = 0;
    static uint16_t tm[64];
    static uint8_t ct = 0;

    uint32_t now = esp_timer_get_time();
    uint32_t df = now - lt;
    lt = now;

    if (df < 150) 
    { 
        ct = 0; 
        return; 
    }
    
    if (df > 4000 && df < 20000)
    {
        if (ct >= 48)
        {
            uint32_t c = 0;
            
            for (int i = 0; i < 48; i += 2)
            {
                c = (c << 1) | (tm[i] > tm[i + 1]);
            }
            
            if (c > 0 && c != 0xFFFFFFFF)
            {
                rf_received_value = c;
                rf_available = true;
            }
        }
        
        ct = 0;
    }
    else if (ct < 60)
    {
        tm[ct++] = df;
    }
}

// ==========================================================
// 9. APP WRITE CALLBACK 
// ==========================================================

esp_err_t write_callback(const esp_rmaker_device_t *device, const esp_rmaker_param_t *param, const esp_rmaker_param_val_t val, void *priv_data, esp_rmaker_write_ctx_t *ctx) 
{
    if (device == NULL || param == NULL) 
    {
        return ESP_ERR_INVALID_ARG;
    }
    
    const char *d_name = esp_rmaker_device_get_name(device);
    const char *p_name = esp_rmaker_param_get_name(param);
    
    if (d_name == NULL || p_name == NULL) 
    {
        return ESP_ERR_INVALID_ARG;
    }

    if (strcmp(p_name, "Power") == 0) 
    {
        bool state = val.val.b;
        
        if (strcmp(d_name, "Switch1") == 0) 
        { 
            bool changed = false;
            
            portENTER_CRITICAL(&state_mux);
            if (switch_state_ch1 != state) 
            { 
                switch_state_ch1 = state; 
                changed = true; 
            }
            portEXIT_CRITICAL(&state_mux);
            
            if (changed) 
            { 
                gpio_set_level(relay1, state); 
                save_state_to_nvs("R1", (uint8_t)state); 
                esp_rmaker_param_update_and_report(param, esp_rmaker_bool(state)); 
            } 
        }
        else if (strcmp(d_name, "Switch2") == 0) 
        { 
            bool changed = false;
            
            portENTER_CRITICAL(&state_mux);
            if (switch_state_ch2 != state) 
            { 
                switch_state_ch2 = state; 
                changed = true; 
            }
            portEXIT_CRITICAL(&state_mux);
            
            if (changed) 
            { 
                gpio_set_level(relay2, state); 
                save_state_to_nvs("R2", (uint8_t)state); 
                esp_rmaker_param_update_and_report(param, esp_rmaker_bool(state)); 
            } 
        }
        else if (strcmp(d_name, "Switch3") == 0) 
        { 
            bool changed = false;
            
            portENTER_CRITICAL(&state_mux);
            if (switch_state_ch3 != state) 
            { 
                switch_state_ch3 = state; 
                changed = true; 
            }
            portEXIT_CRITICAL(&state_mux);
            
            if (changed) 
            { 
                gpio_set_level(relay3, state); 
                save_state_to_nvs("R3", (uint8_t)state); 
                esp_rmaker_param_update_and_report(param, esp_rmaker_bool(state)); 
            } 
        }
        else if (strcmp(d_name, "Switch4") == 0) 
        { 
            bool changed = false;
            
            portENTER_CRITICAL(&state_mux);
            if (switch_state_ch4 != state) 
            { 
                switch_state_ch4 = state; 
                changed = true; 
            }
            portEXIT_CRITICAL(&state_mux);
            
            if (changed) 
            { 
                gpio_set_level(relay4, state); 
                save_state_to_nvs("R4", (uint8_t)state); 
                esp_rmaker_param_update_and_report(param, esp_rmaker_bool(state)); 
            } 
        }
        else if (strcmp(d_name, "Fan") == 0) 
        { 
            bool changed = false; 
            int mem_speed;
            
            portENTER_CRITICAL(&state_mux);
            if (fan_power != state) 
            { 
                fan_power = state; 
                mem_speed = fan_speed_memory; 
                changed = true; 
            }
            portEXIT_CRITICAL(&state_mux);
            
            if (changed) 
            { 
                portENTER_CRITICAL(&state_mux); 
                if (state) 
                {
                    pending_fan_speed = mem_speed;
                }
                else 
                {
                    pending_fan_speed = 0;
                }
                portEXIT_CRITICAL(&state_mux);
                
                esp_rmaker_param_update_and_report(param, esp_rmaker_bool(state));
            } 
        }
    }
    else if (strcmp(p_name, "My_Speed") == 0 && strcmp(d_name, "Fan") == 0) 
    {
        int s = val.val.i;
        
        if (s < 0 || s > 4) 
        {
            return ESP_ERR_INVALID_ARG;
        }
        
        bool changed = false;
        
        portENTER_CRITICAL(&state_mux);
        if (s != curr_speed) 
        {
            changed = true; 
        }
        portEXIT_CRITICAL(&state_mux);
        
        if (changed) 
        {
            portENTER_CRITICAL(&state_mux); 
            pending_fan_speed = s; 
            portEXIT_CRITICAL(&state_mux);
            
            esp_rmaker_param_update_and_report(param, esp_rmaker_int(s));
        }
    }
    
    return ESP_OK;
}

// ==========================================================
// 10. MASTER SYSTEM TASK
// ==========================================================

void system_task(void *arg) 
{
    esp_task_wdt_add(NULL);

    int lsw1 = gpio_get_level(switch1);
    int lsw2 = gpio_get_level(switch2);
    int lsw3 = gpio_get_level(switch3);
    int lsw4 = gpio_get_level(switch4);
    int lfan = gpio_get_level(fan_switch);

    static uint64_t reset_press_start = 0; 
    static uint64_t last_wifi_check_time = 0;
    static bool reset_triggered = false; 
    
    static uint32_t last_valid_code = 0;
    static uint64_t last_valid_rf_time = 0;

    while (1) 
    {
        uint64_t now_ms = (uint64_t)(esp_timer_get_time() / 1000ULL);

        uint64_t local_wifi_disconnect = 0;
        
        portENTER_CRITICAL(&state_mux); 
        local_wifi_disconnect = wifiDisconnectTime; 
        portEXIT_CRITICAL(&state_mux);

        if (!is_wifi_connected && wasConnected && local_wifi_disconnect != 0) 
        {
            if ((now_ms - local_wifi_disconnect) > WIFI_STUCK_MS) 
            {
                esp_wifi_connect(); 
                
                portENTER_CRITICAL(&state_mux); 
                wifiDisconnectTime = now_ms; 
                portEXIT_CRITICAL(&state_mux);
            }
        }
        
        if (is_wifi_connected && (now_ms - last_wifi_check_time > 60000)) 
        {
            last_wifi_check_time = now_ms;
            wifi_ap_record_t ap_info;
            
            if (esp_wifi_sta_get_ap_info(&ap_info) == ESP_OK && wifi_signal_param != NULL) 
            {
                int rssi = ap_info.rssi;
                int quality;
                
                if (rssi <= -100) 
                {
                    quality = 0;
                }
                else if (rssi >= -50) 
                {
                    quality = 100;
                }
                else 
                {
                    quality = 2 * (rssi + 100);
                }

                char signal_str[64];
                
                if (quality >= 80) 
                {
                    snprintf(signal_str, sizeof(signal_str), "📶 ▂ ▄ ▆ █   %d%%", quality);
                }
                else if (quality >= 60) 
                {
                    snprintf(signal_str, sizeof(signal_str), "📶 ▂ ▄ ▆ _   %d%%", quality);
                }
                else if (quality >= 40) 
                {
                    snprintf(signal_str, sizeof(signal_str), "📶 ▂ ▄ _ _   %d%%", quality);
                }
                else 
                {
                    snprintf(signal_str, sizeof(signal_str), "📶 ▂ _ _ _   %d%%", quality);
                }

                if (is_cloud_connected) 
                {
                    esp_rmaker_param_update_and_report(wifi_signal_param, esp_rmaker_str(signal_str));
                }
                else 
                {
                    esp_rmaker_param_update(wifi_signal_param, esp_rmaker_str(signal_str));
                }
            }
        }

        if (pairing_target > 0 && (now_ms - pairing_timeout > PAIRING_TIMEOUT_MS)) 
        {
            pairing_target = 0; 
        }

        int local_pending_fan = -1;
        
        portENTER_CRITICAL(&state_mux);
        if (pending_fan_speed != -1) 
        {
            local_pending_fan = pending_fan_speed; 
            pending_fan_speed = -1; 
        }
        portEXIT_CRITICAL(&state_mux);

        if (local_pending_fan != -1) 
        {
            if (local_pending_fan == 1) 
            {
                speed_1();
            }
            else if (local_pending_fan == 2) 
            {
                speed_2();
            }
            else if (local_pending_fan == 3) 
            {
                speed_3();
            }
            else if (local_pending_fan == 4) 
            {
                speed_4();
            }
            else 
            {
                speed_0();
            }
        }

        if (rf_available) 
        {
            uint32_t code = rf_received_value;

            if (pairing_target > 0) 
            {
                if (code == last_valid_code && (now_ms - last_valid_rf_time < 2000)) 
                {
                    rf_available = false; 
                }
                else 
                {
                    last_valid_code = code;
                    last_valid_rf_time = now_ms;

                    switch (pairing_target) 
                    {
                        case 1: 
                            rf_code_l1 = code; 
                            save_code("rf1", code); 
                            break;
                        case 2: 
                            rf_code_l2 = code; 
                            save_code("rf2", code); 
                            break;
                        case 3: 
                            rf_code_l3 = code; 
                            save_code("rf3", code); 
                            break;
                        case 4: 
                            rf_code_l4 = code; 
                            save_code("rf4", code); 
                            break;
                        case 5: 
                            rf_code_up = code; 
                            save_code("rfu", code); 
                            break;
                        case 6: 
                            rf_code_dw = code; 
                            save_code("rfd", code); 
                            break;
                        case 7: 
                            rf_code_fan_toggle = code; 
                            save_code("rft", code); 
                            break;
                        case 8: 
                            rf_code_master = code; 
                            save_code("rfm", code); 
                            break;
                    }
                    
                    pairing_target++; 
                    pairing_timeout = now_ms; 
                    pairing_confirm_until_ms = now_ms + PAIRING_CONFIRM_MS;
                    
                    if (pairing_target > 8) 
                    {
                        pairing_target = 0;
                    }
                    
                    rf_available = false;
                }
            } 
            else 
            {
                bool is_known_code = (code == rf_code_l1 || code == rf_code_l2 || code == rf_code_l3 || 
                                      code == rf_code_l4 || code == rf_code_up || code == rf_code_dw || 
                                      code == rf_code_fan_toggle || code == rf_code_master);

                if (is_known_code) 
                {
                    if (code == last_valid_code && (now_ms - last_valid_rf_time < 1000)) 
                    {
                        last_valid_rf_time = now_ms; 
                    } 
                    else 
                    {
                        last_valid_code = code; 
                        last_valid_rf_time = now_ms;

                        if (code == rf_code_l1) 
                        { 
                            portENTER_CRITICAL(&state_mux); 
                            switch_state_ch1 = !switch_state_ch1; 
                            bool st = switch_state_ch1; 
                            portEXIT_CRITICAL(&state_mux);
                            
                            gpio_set_level(relay1, st); 
                            update_app_state("Switch1", st); 
                            save_state_to_nvs("R1", (uint8_t)st); 
                        }
                        else if (code == rf_code_l2) 
                        { 
                            portENTER_CRITICAL(&state_mux); 
                            switch_state_ch2 = !switch_state_ch2; 
                            bool st = switch_state_ch2; 
                            portEXIT_CRITICAL(&state_mux);
                            
                            gpio_set_level(relay2, st); 
                            update_app_state("Switch2", st); 
                            save_state_to_nvs("R2", (uint8_t)st); 
                        }
                        else if (code == rf_code_l3) 
                        { 
                            portENTER_CRITICAL(&state_mux); 
                            switch_state_ch3 = !switch_state_ch3; 
                            bool st = switch_state_ch3; 
                            portEXIT_CRITICAL(&state_mux);
                            
                            gpio_set_level(relay3, st); 
                            update_app_state("Switch3", st); 
                            save_state_to_nvs("R3", (uint8_t)st); 
                        }
                        else if (code == rf_code_l4) 
                        { 
                            portENTER_CRITICAL(&state_mux); 
                            switch_state_ch4 = !switch_state_ch4; 
                            bool st = switch_state_ch4; 
                            portEXIT_CRITICAL(&state_mux);
                            
                            gpio_set_level(relay4, st); 
                            update_app_state("Switch4", st); 
                            save_state_to_nvs("R4", (uint8_t)st); 
                        }
                        else if (code == rf_code_up) 
                        { 
                            int l_speed; 
                            
                            portENTER_CRITICAL(&state_mux); 
                            l_speed = curr_speed; 
                            portEXIT_CRITICAL(&state_mux);
                            
                            if (l_speed < 4) 
                            { 
                                l_speed++; 
                                
                                if (l_speed == 1) 
                                {
                                    speed_1();
                                }
                                else if (l_speed == 2) 
                                {
                                    speed_2();
                                }
                                else if (l_speed == 3) 
                                {
                                    speed_3();
                                }
                                else 
                                {
                                    speed_4();
                                }
                            } 
                        }
                        else if (code == rf_code_dw) 
                        { 
                            int l_speed; 
                            
                            portENTER_CRITICAL(&state_mux); 
                            l_speed = curr_speed; 
                            portEXIT_CRITICAL(&state_mux);
                            
                            if (l_speed > 0) 
                            { 
                                l_speed--; 
                                
                                if (l_speed == 0) 
                                {
                                    speed_0();
                                }
                                else if (l_speed == 1) 
                                {
                                    speed_1();
                                }
                                else if (l_speed == 2) 
                                {
                                    speed_2();
                                }
                                else 
                                {
                                    speed_3();
                                }
                            } 
                        }
                        else if (code == rf_code_fan_toggle) 
                        { 
                            bool f_pow; 
                            
                            portENTER_CRITICAL(&state_mux); 
                            f_pow = fan_power; 
                            portEXIT_CRITICAL(&state_mux);
                            
                            if (f_pow) 
                            {
                                speed_0();
                            }
                            else 
                            {
                                restore_fan_speed();
                            }
                        }
                        else if (code == rf_code_master) 
                        { 
                            bool s1, s2, s3, s4, f_pow;
                            
                            portENTER_CRITICAL(&state_mux); 
                            s1 = switch_state_ch1; 
                            s2 = switch_state_ch2; 
                            s3 = switch_state_ch3; 
                            s4 = switch_state_ch4; 
                            f_pow = fan_power; 
                            portEXIT_CRITICAL(&state_mux);
                            
                            if (s1 || s2 || s3 || s4 || f_pow) 
                            {
                                All_Off();
                            }
                            else 
                            {
                                All_On();
                            }
                        }
                        
                        pairing_confirm_until_ms = now_ms + 200U; 
                    }
                }
                
                rf_available = false;
            }
        }

        vTaskDelay(pdMS_TO_TICKS(DEBOUNCE_MS));
        int csw1 = gpio_get_level(switch1);
        
        if (csw1 != lsw1) 
        {
            lsw1 = csw1; 
            
            portENTER_CRITICAL(&state_mux); 
            switch_state_ch1 = (csw1 == 0); 
            bool st = switch_state_ch1; 
            portEXIT_CRITICAL(&state_mux);
            
            gpio_set_level(relay1, st); 
            update_app_state("Switch1", st); 
            save_state_to_nvs("R1", (uint8_t)st);
            
            if (pairing_target == 0) 
            {
                if (now_ms - last_switch1_toggle_time > 4000U) 
                {
                    switch1_toggle_count = 1;
                }
                else 
                {
                    switch1_toggle_count++;
                }
                
                last_switch1_toggle_time = now_ms;
                
                if (switch1_toggle_count >= SWITCH1_PAIR_TOGGLES) 
                {
                    pairing_target = 1; 
                    pairing_timeout = now_ms; 
                    switch1_toggle_count = 0; 
                    pairing_confirm_until_ms = now_ms + PAIRING_CONFIRM_MS;
                }
            }
        }

        vTaskDelay(pdMS_TO_TICKS(DEBOUNCE_MS));
        int csw2 = gpio_get_level(switch2);
        
        if (csw2 != lsw2) 
        {
            lsw2 = csw2; 
            
            portENTER_CRITICAL(&state_mux); 
            switch_state_ch2 = (csw2 == 0); 
            bool st = switch_state_ch2; 
            portEXIT_CRITICAL(&state_mux);
            
            gpio_set_level(relay2, st); 
            update_app_state("Switch2", st); 
            save_state_to_nvs("R2", (uint8_t)st);
            
            if (pairing_target == 0) 
            {
                if (now_ms - last_switch2_toggle_time > 1500) 
                {
                    switch2_toggle_count = 1;
                }
                else 
                {
                    switch2_toggle_count++;
                }
                
                last_switch2_toggle_time = now_ms;
                
                if (switch2_toggle_count >= SWITCH2_RESET_TOGGLES) 
                { 
                    esp_rmaker_wifi_reset(0, 2); 
                    switch2_toggle_count = 0; 
                }
            }
        }

        vTaskDelay(pdMS_TO_TICKS(DEBOUNCE_MS));
        int csw3 = gpio_get_level(switch3);
        
        if (csw3 != lsw3) 
        {
            lsw3 = csw3; 
            
            portENTER_CRITICAL(&state_mux); 
            switch_state_ch3 = (csw3 == 0); 
            bool st = switch_state_ch3; 
            portEXIT_CRITICAL(&state_mux);
            
            gpio_set_level(relay3, st); 
            update_app_state("Switch3", st); 
            save_state_to_nvs("R3", (uint8_t)st); 
        }

        vTaskDelay(pdMS_TO_TICKS(DEBOUNCE_MS));
        int csw4 = gpio_get_level(switch4);
        
        if (csw4 != lsw4) 
        {
            lsw4 = csw4; 
            
            portENTER_CRITICAL(&state_mux); 
            switch_state_ch4 = (csw4 == 0); 
            bool st = switch_state_ch4; 
            portEXIT_CRITICAL(&state_mux);
            
            gpio_set_level(relay4, st); 
            update_app_state("Switch4", st); 
            save_state_to_nvs("R4", (uint8_t)st); 
        }

        vTaskDelay(pdMS_TO_TICKS(DEBOUNCE_MS));
        int cf_sw = gpio_get_level(fan_switch);
        
        if (cf_sw != lfan) 
        {
            lfan = cf_sw; 
            
            if (cf_sw == 0) 
            { 
                int l_speed; 
                
                portENTER_CRITICAL(&state_mux); 
                l_speed = curr_speed; 
                portEXIT_CRITICAL(&state_mux); 
                
                if (l_speed == 0) 
                {
                    restore_fan_speed();
                }
            } 
            else 
            {
                speed_0(); 
            }
        }

        if (gpio_get_level(s1) == 0 && speed1_flag == 1)
        {
            speed_1();
            
            speed1_flag = 0; 
            speed2_flag = 1; 
            speed3_flag = 1; 
            speed4_flag = 1; 
            speed0_flag = 1;
        }
        
        if (gpio_get_level(s2) == 0 && gpio_get_level(s3) == 1 && speed2_flag == 1)
        {
            speed_2();
            
            speed1_flag = 1; 
            speed2_flag = 0; 
            speed3_flag = 1; 
            speed4_flag = 1; 
            speed0_flag = 1;
        }
        
        if (gpio_get_level(s2) == 0 && gpio_get_level(s3) == 0 && speed3_flag == 1)
        {
            speed_3();
            
            speed1_flag = 1; 
            speed2_flag = 1; 
            speed3_flag = 0; 
            speed4_flag = 1; 
            speed0_flag = 1;
        }
        
        if (gpio_get_level(s4) == 0 && speed4_flag == 1)
        {
            speed_4();
            
            speed1_flag = 1; 
            speed2_flag = 1; 
            speed3_flag = 1; 
            speed4_flag = 0; 
            speed0_flag = 1;
        }
        
        if (gpio_get_level(s1) == 1 && gpio_get_level(s2) == 1 && gpio_get_level(s3) == 1 && gpio_get_level(s4) == 1 && speed0_flag == 1)
        {
            speed_0();
            
            speed1_flag = 1; 
            speed2_flag = 1; 
            speed3_flag = 1; 
            speed4_flag = 1; 
            speed0_flag = 0;
        }

        if (gpio_get_level(gpio_reset) == 0) 
        {
            if (reset_press_start == 0) 
            {
                reset_press_start = now_ms;
            }
            else if (now_ms - reset_press_start >= 5000) 
            { 
                if (!reset_triggered) 
                { 
                    reset_triggered = true; 
                    esp_rmaker_wifi_reset(0, 2); 
                } 
            }
        } 
        else 
        { 
            reset_press_start = 0; 
            reset_triggered = false; 
        }

        if (pairing_confirm_until_ms > now_ms) 
        {
            gpio_set_level(wifiLed, 1);
        }
        else if (pairing_target > 0) 
        {
            if ((now_ms - pairing_led_last_toggle_ms) >= PAIRING_LED_BLINK_MS) 
            {
                pairing_led_last_toggle_ms = now_ms; 
                pairing_led_state = !pairing_led_state; 
                
                gpio_set_level(wifiLed, pairing_led_state ? 1 : 0);
            }
        }
        else if (ota_in_progress) 
        {
            gpio_set_level(wifiLed, (now_ms / 50) % 2);
        }
        else if (is_wifi_connected) 
        {
            gpio_set_level(wifiLed, 1);
        }
        else if (wasConnected) 
        {
            gpio_set_level(wifiLed, (now_ms / 200) % 2);
        }
        else 
        {
            gpio_set_level(wifiLed, (now_ms / 1000) % 2);
        }

        esp_task_wdt_reset(); 
        
        vTaskDelay(pdMS_TO_TICKS(100)); 
    }
}

// ==========================================================
// 11. APP MAIN
// ==========================================================

void app_main() 
{
    esp_task_wdt_config_t twdt_config = {
        .timeout_ms = 10000,
        .idle_core_mask = (1 << portNUM_PROCESSORS) - 1,
        .trigger_panic = true,
    };
    
    esp_err_t twdt_err = esp_task_wdt_reconfigure(&twdt_config);
    
    if (twdt_err != ESP_OK) 
    {
        ESP_LOGW(TAG, "Watchdog already configured. Reconfiguring... %s", esp_err_to_name(twdt_err));
    }

    esp_err_t err = nvs_flash_init();
    
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) 
    {
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    
    if (err != ESP_OK) 
    {
        vTaskDelay(pdMS_TO_TICKS(1000));
        esp_restart(); 
    }
    
    switch_state_ch1 = load_state_from_nvs("R1", 0); 
    switch_state_ch2 = load_state_from_nvs("R2", 0);
    switch_state_ch3 = load_state_from_nvs("R3", 0); 
    switch_state_ch4 = load_state_from_nvs("R4", 0);
    
    curr_speed = load_state_from_nvs("F_S", 0); 
    fan_power = load_state_from_nvs("F_P", 0); 
    fan_speed_memory = load_state_from_nvs("L_S", 1);

    rf_code_l1 = load_code("rf1", 0); 
    rf_code_l2 = load_code("rf2", 0); 
    rf_code_l3 = load_code("rf3", 0); 
    rf_code_l4 = load_code("rf4", 0);
    rf_code_up = load_code("rfu", 0); 
    rf_code_dw = load_code("rfd", 0); 
    rf_code_fan_toggle = load_code("rft", 0); 
    rf_code_master = load_code("rfm", 0);

    gpio_config_t o_conf = {0};
    o_conf.pin_bit_mask = (1ULL << relay1) | (1ULL << relay2) | (1ULL << relay3) | (1ULL << relay4) | (1ULL << Speed1) | (1ULL << Speed2) | (1ULL << Speed4) | (1ULL << wifiLed);
    o_conf.mode = GPIO_MODE_OUTPUT; 
    o_conf.pull_up_en = GPIO_PULLUP_DISABLE; 
    o_conf.pull_down_en = GPIO_PULLDOWN_DISABLE; 
    o_conf.intr_type = GPIO_INTR_DISABLE;
    gpio_config(&o_conf);

    gpio_set_level(relay1, switch_state_ch1); 
    gpio_set_level(relay2, switch_state_ch2); 
    gpio_set_level(relay3, switch_state_ch3); 
    gpio_set_level(relay4, switch_state_ch4);
    
    if (curr_speed == 1) 
    {
        speed_1();
    }
    else if (curr_speed == 2) 
    {
        speed_2();
    }
    else if (curr_speed == 3) 
    {
        speed_3();
    }
    else if (curr_speed == 4) 
    {
        speed_4();
    }
    else 
    {
        speed_0();
    }

    gpio_config_t i_conf_pu = {0};
    i_conf_pu.pin_bit_mask = (1ULL << switch1) | (1ULL << fan_switch) | (1ULL << s1) | (1ULL << s2) | (1ULL << s3) | (1ULL << s4);
    i_conf_pu.mode = GPIO_MODE_INPUT; 
    i_conf_pu.pull_up_en = GPIO_PULLUP_ENABLE; 
    i_conf_pu.pull_down_en = GPIO_PULLDOWN_DISABLE; 
    i_conf_pu.intr_type = GPIO_INTR_DISABLE;
    gpio_config(&i_conf_pu);

    gpio_config_t i_conf_no_pu = {0};
    i_conf_no_pu.pin_bit_mask = (1ULL << switch2) | (1ULL << switch3) | (1ULL << switch4) | (1ULL << gpio_reset);
    i_conf_no_pu.mode = GPIO_MODE_INPUT; 
    i_conf_no_pu.pull_up_en = GPIO_PULLUP_DISABLE; 
    i_conf_no_pu.pull_down_en = GPIO_PULLDOWN_DISABLE; 
    i_conf_no_pu.intr_type = GPIO_INTR_DISABLE;
    gpio_config(&i_conf_no_pu);

    gpio_config_t s_conf = {0};
    s_conf.pin_bit_mask = (1ULL << RF_PIN);
    s_conf.mode = GPIO_MODE_INPUT; 
    s_conf.pull_up_en = GPIO_PULLUP_DISABLE; 
    s_conf.pull_down_en = GPIO_PULLDOWN_DISABLE; 
    s_conf.intr_type = GPIO_INTR_ANYEDGE;
    gpio_config(&s_conf);
    
    err = gpio_install_isr_service(0);
    
    if (err != ESP_OK) 
    {
        ESP_LOGW(TAG, "ISR Service install issue: %s", esp_err_to_name(err));
    }
    
    err = gpio_isr_handler_add(RF_PIN, rf_isr, NULL);
    
    if (err != ESP_OK) 
    {
        ESP_LOGE(TAG, "CRITICAL: RF ISR add failed! Remote will not work.");
    }

    setenv("TZ", "IST-5:30", 1); 
    tzset();

    app_network_init();
    
    esp_wifi_set_ps(WIFI_PS_NONE); 
    esp_wifi_set_max_tx_power(78); 
    
    esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL, NULL);
    esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL, NULL);
    esp_event_handler_instance_register(RMAKER_OTA_EVENT, ESP_EVENT_ANY_ID, &ota_event_handler, NULL, NULL);
    esp_event_handler_instance_register(RMAKER_COMMON_EVENT, ESP_EVENT_ANY_ID, &rmaker_event_handler, NULL, NULL);

    my_node = esp_rmaker_node_init(&(esp_rmaker_config_t){.enable_time_sync = true}, "Go Smart", "AIO V2");
    
    if (!my_node) 
    {
        vTaskDelay(pdMS_TO_TICKS(1000)); 
        esp_restart(); 
    }

    esp_rmaker_device_t *sw1 = esp_rmaker_switch_device_create("Switch1", NULL, switch_state_ch1); 
    esp_rmaker_device_add_cb(sw1, write_callback, NULL); 
    esp_rmaker_node_add_device(my_node, sw1);
    
    esp_rmaker_device_t *sw2 = esp_rmaker_switch_device_create("Switch2", NULL, switch_state_ch2); 
    esp_rmaker_device_add_cb(sw2, write_callback, NULL); 
    esp_rmaker_node_add_device(my_node, sw2);
    
    esp_rmaker_device_t *sw3 = esp_rmaker_switch_device_create("Switch3", NULL, switch_state_ch3); 
    esp_rmaker_device_add_cb(sw3, write_callback, NULL); 
    esp_rmaker_node_add_device(my_node, sw3);
    
    esp_rmaker_device_t *sw4 = esp_rmaker_switch_device_create("Switch4", NULL, switch_state_ch4); 
    esp_rmaker_device_add_cb(sw4, write_callback, NULL); 
    esp_rmaker_node_add_device(my_node, sw4);

    esp_rmaker_device_t *fan = esp_rmaker_fan_device_create("Fan", NULL, fan_power); 
    esp_rmaker_device_add_cb(fan, write_callback, NULL);
    
    esp_rmaker_param_t *sp = esp_rmaker_param_create("My_Speed", ESP_RMAKER_PARAM_RANGE, esp_rmaker_int(curr_speed), PROP_FLAG_READ | PROP_FLAG_WRITE); 
    esp_rmaker_param_add_bounds(sp, esp_rmaker_int(0), esp_rmaker_int(4), esp_rmaker_int(1)); 
    esp_rmaker_param_add_ui_type(sp, ESP_RMAKER_UI_SLIDER); 
    esp_rmaker_device_add_param(fan, sp);
    
    ota_status_param = esp_rmaker_param_create("OTA_Status", NULL, esp_rmaker_str("System Up to Date"), PROP_FLAG_READ); 
    esp_rmaker_param_add_ui_type(ota_status_param, ESP_RMAKER_UI_TEXT); 
    esp_rmaker_device_add_param(fan, ota_status_param);
    
    wifi_signal_param = esp_rmaker_param_create("WiFi_Signal", NULL, esp_rmaker_str("Checking..."), PROP_FLAG_READ); 
    esp_rmaker_param_add_ui_type(wifi_signal_param, ESP_RMAKER_UI_TEXT); 
    esp_rmaker_device_add_param(fan, wifi_signal_param);

    esp_rmaker_node_add_device(my_node, fan);
    
    esp_rmaker_timezone_service_enable(); 
    esp_rmaker_time_set_timezone("Asia/Kolkata"); 
    esp_rmaker_schedule_enable();

    BaseType_t task_ok = xTaskCreatePinnedToCore(system_task, "system_task", 6144, NULL, 5, NULL, 1);
    
    if (task_ok != pdPASS) 
    {
        vTaskDelay(pdMS_TO_TICKS(1000)); 
        esp_restart(); 
    }

    xTaskCreatePinnedToCore(nvs_commit_task, "nvs_commit", 3072, NULL, 3, NULL, 1);
    
    esp_rmaker_ota_enable(&(esp_rmaker_ota_config_t){.server_cert = NULL}, OTA_USING_TOPICS);

    printf("Go Smart firmware V10.7 - Fan-State Persistence Fix (Option A)\n");

    esp_rmaker_start();
    
    app_network_set_custom_pop("12345678");
    app_network_start(POP_TYPE_CUSTOM);
}
