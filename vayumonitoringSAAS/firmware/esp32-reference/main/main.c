#include <stdio.h>
#include <string.h>
#include <time.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "esp_system.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_event.h"
#include "nvs_flash.h"
#include "esp_sntp.h"

#include "vayu_types.h"
#include "vayu_mqtt_telemetry.h"

static const char *TAG = "VAYU_MAIN";

// Global thread-safe purifier state protected by mutex
static vayu_purifier_state_t s_device_state;
static SemaphoreHandle_t s_state_mutex = NULL;

// Factory configuration (In production, loaded from NVS flash)
#define CONFIG_VAYU_DEVICE_ID   "VAYU-001"
#define CONFIG_VAYU_ROOM        "Conference Room 2A"
#define CONFIG_VAYU_FIRMWARE    "1.0.0"
#define CONFIG_MQTT_BROKER_URI  "mqtt://192.168.1.100:1883"
#define CONFIG_MQTT_USERNAME    "vayu_device"
#define CONFIG_MQTT_PASSWORD    "VayuDevice2026!"

/**
 * Task A: Safety & Fan Control Loop (Core 1, Priority 5 - Highest)
 * Operates strictly independently of network and MQTT.
 */
static void vayu_safety_ctrl_task(void *pvParameters) {
    ESP_LOGI(TAG, "Safety & Fan Control Task started on Core %d", xPortGetCoreID());

    while (1) {
        // High-frequency physical safety evaluation (100 ms period)
        if (xSemaphoreTake(s_state_mutex, pdMS_TO_TICKS(20)) == pdTRUE) {
            // Simulated safety check: door switch, thermal cutoff
            if (s_device_state.error_code == VAYU_ERR_DOOR_OPEN) {
                // Instantly cut fan PWM to 0% for physical user protection
                // (e.g. ledc_set_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0, 0);)
            } else {
                // Regulate fan according to operating mode
                // In AUTO mode, fan speed scales with particulate matter
            }
            xSemaphoreGive(s_state_mutex);
        }

        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

/**
 * Task B: Sensor Acquisition Task (Core 1, Priority 3 - Medium)
 * Samples PM, VOC, and Temperature/Humidity sensors every 1.0 second.
 */
static void vayu_sensor_acq_task(void *pvParameters) {
    ESP_LOGI(TAG, "Sensor Acquisition Task started on Core %d", xPortGetCoreID());

    float sim_pm25 = 12.0f;
    float sim_temp = 22.5f;

    while (1) {
        // In real hardware: read UART buffer from PMS5003 and I2C from SGP40/SHT31.
        // If checksum or communication fails, flag invalidity.
        if (xSemaphoreTake(s_state_mutex, pdMS_TO_TICKS(50)) == pdTRUE) {
            // Update sensor metrics
            s_device_state.metrics.pm1 = sim_pm25 * 0.4f;
            s_device_state.metrics.pm25 = sim_pm25;
            s_device_state.metrics.pm10 = sim_pm25 * 1.6f;
            s_device_state.metrics.voc_index = 65;
            s_device_state.metrics.temperature_c = sim_temp;
            s_device_state.metrics.humidity_rh = 48.0f;

            // Health flags
            s_device_state.diagnostics.pm_sensor_valid = true;
            s_device_state.diagnostics.temperature_sensor_valid = true;
            s_device_state.diagnostics.voc_sensor_valid = true;
            s_device_state.last_reading_time = time(NULL);

            xSemaphoreGive(s_state_mutex);
        }

        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}

/**
 * Task C: Network & Telemetry Publisher Task (Core 0, Priority 2 - Low)
 * Telemetry publication occurs on a background cadence. Network drops
 * never block or impede the safety and sensor tasks.
 */
static void vayu_telemetry_task(void *pvParameters) {
    ESP_LOGI(TAG, "MQTT Telemetry Task started on Core %d", xPortGetCoreID());

    vayu_purifier_state_t local_snapshot;

    while (1) {
        vTaskDelay(pdMS_TO_TICKS(3000));

        if (!vayu_mqtt_is_connected()) {
            ESP_LOGD(TAG, "MQTT not connected. Retrying next period...");
            continue;
        }

        // Take snapshot under lock to minimize critical section
        if (xSemaphoreTake(s_state_mutex, pdMS_TO_TICKS(50)) == pdTRUE) {
            memcpy(&local_snapshot, &s_device_state, sizeof(vayu_purifier_state_t));
            xSemaphoreGive(s_state_mutex);

            // Publish outside lock so network latency never blocks control loops
            vayu_mqtt_publish_telemetry(&local_snapshot);
        }
    }
}

static void initialize_sntp(void) {
    ESP_LOGI(TAG, "Initializing SNTP for network timestamp synchronization");
    esp_sntp_setoperatingmode(SNTP_OPMODE_POLL);
    esp_sntp_setservername(0, "pool.ntp.org");
    esp_sntp_init();
}

void app_main(void) {
    ESP_LOGI(TAG, "==================================================");
    ESP_LOGI(TAG, "SOCHI VAYU — Air Purifier Embedded Firmware v%s", CONFIG_VAYU_FIRMWARE);
    ESP_LOGI(TAG, "Device ID: %s | Room: %s", CONFIG_VAYU_DEVICE_ID, CONFIG_VAYU_ROOM);
    ESP_LOGI(TAG, "==================================================");

    // Initialize NVS
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());

    // Create thread-safe state mutex
    s_state_mutex = xSemaphoreCreateMutex();
    assert(s_state_mutex != NULL);

    // Initialize baseline device state
    memset(&s_device_state, 0, sizeof(vayu_purifier_state_t));
    strncpy(s_device_state.device_id, CONFIG_VAYU_DEVICE_ID, sizeof(s_device_state.device_id) - 1);
    strncpy(s_device_state.room, CONFIG_VAYU_ROOM, sizeof(s_device_state.room) - 1);
    strncpy(s_device_state.firmware_version, CONFIG_VAYU_FIRMWARE, sizeof(s_device_state.firmware_version) - 1);
    s_device_state.mode = VAYU_MODE_AUTO;
    s_device_state.error_code = VAYU_ERR_NONE;

    initialize_sntp();

    // Start MQTT Telemetry client
    vayu_mqtt_config_t mqtt_cfg = {
        .broker_uri = CONFIG_MQTT_BROKER_URI,
        .username = CONFIG_MQTT_USERNAME,
        .password = CONFIG_MQTT_PASSWORD,
        .device_id = CONFIG_VAYU_DEVICE_ID,
        .room = CONFIG_VAYU_ROOM
    };
    vayu_mqtt_init(&mqtt_cfg);

    // Spawn Core FreeRTOS Tasks
    // 1. Safety Control Task: Pinned to Core 1, Priority 5 (Highest)
    xTaskCreatePinnedToCore(vayu_safety_ctrl_task, "vayu_safety", 4096, NULL, 5, NULL, 1);

    // 2. Sensor Acquisition Task: Pinned to Core 1, Priority 3 (Medium)
    xTaskCreatePinnedToCore(vayu_sensor_acq_task, "vayu_sensor", 4096, NULL, 3, NULL, 1);

    // 3. MQTT Telemetry Task: Pinned to Core 0 (Network core), Priority 2 (Low)
    xTaskCreatePinnedToCore(vayu_telemetry_task, "vayu_telemetry", 4096, NULL, 2, NULL, 0);

    ESP_LOGI(TAG, "All FreeRTOS operational tasks initialized successfully.");
}
