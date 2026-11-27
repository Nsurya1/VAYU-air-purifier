/**
 * @file app_main.c
 * @brief SOCHI VAYU - ESP32 Smart Air Purifier Main Firmware Entry Point
 */

#include <stdio.h>
#include <string.h>
#include "board_config.h"
#include "hal_fan.h"
#include "hal_sensors.h"
#include "safety_controller.h"
#include "telemetry_buffer.h"
#include "telemetry_builder.h"
#include "wifi_manager.h"
#include "mqtt_client_service.h"

#ifndef VAYU_TEST_HOST
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nvs_flash.h"
#include "esp_system.h"
#include "esp_log.h"
#include "esp_timer.h"

static const char *TAG = "APP_MAIN";
static char s_device_id[64] = "VAYU-DEV-001";

/**
 * @brief Autonomous Safety Task (High Priority, Core 1)
 * Evaluates air quality, tachometer pulse feedback, and safety interlocks every 1s.
 * Runs completely independent of Wi-Fi or MQTT availability.
 */
static void safety_task(void *pvParameters)
{
    ESP_LOGI(TAG, "Safety Task started on Core %d", xPortGetCoreID());
    TickType_t last_wake = xTaskGetTickCount();

    while (1) {
        vayu_sensor_data_t sensors;
        hal_sensors_read(&sensors);

        uint16_t rpm = hal_fan_get_rpm();

        // Autonomous safety step (PM-to-fan curve + tachometer stall detection + overheat cutoff)
        safety_controller_step(&sensors, rpm);

        // Apply commanded duty cycle to the physical fan
        vayu_controller_state_t state;
        safety_controller_get_state(&state);
        hal_fan_set_duty(state.commanded_fan_pct);

        vTaskDelayUntil(&last_wake, pdMS_TO_TICKS(SAFETY_EVAL_INTERVAL_MS));
    }
}

/**
 * @brief Telemetry Broadcast Task (Standard Priority, Core 0)
 * Gathers controller state every 5s. If connected, publishes via MQTT; otherwise,
 * stores in bounded offline ring buffer.
 */
static void telemetry_task(void *pvParameters)
{
    ESP_LOGI(TAG, "Telemetry Task started on Core %d", xPortGetCoreID());
    TickType_t last_wake = xTaskGetTickCount();
    char json_buf[1024];

    while (1) {
        vayu_controller_state_t state;
        safety_controller_get_state(&state);

        vayu_telemetry_item_t item;
        item.timestamp_ms = esp_timer_get_time() / 1000;
        item.sensors = state.last_sensors;
        item.fan_pct = state.commanded_fan_pct;
        item.mode = state.mode;
        item.aqi = state.aqi;
        item.filter_hours_left = state.filter_hours_left;
        item.rssi = wifi_manager_get_rssi();
        item.err_code = state.error_code;
        item.uptime_seconds = state.uptime_seconds;

        if (mqtt_client_service_is_connected()) {
            // Broker reachable: serialize and dispatch live
            int len = telemetry_builder_serialize(s_device_id, &item, json_buf, sizeof(json_buf));
            if (len > 0) {
                mqtt_client_service_publish_telemetry(json_buf);
            }
        } else {
            // Broker unreachable: push into bounded offline ring buffer
            telemetry_buffer_push(&item);
            ESP_LOGW(TAG, "Network offline: Telemetry buffered (%u/%d items)",
                     telemetry_buffer_count(), VAYU_BUFFER_MAX_ITEMS);
        }

        vTaskDelayUntil(&last_wake, pdMS_TO_TICKS(TELEMETRY_INTERVAL_MS));
    }
}

void app_main(void)
{
    ESP_LOGI(TAG, "==================================================");
    ESP_LOGI(TAG, "   SOCHI VAYU - Smart Air Purifier Firmware       ");
    ESP_LOGI(TAG, "   Version: %s | Hardware: %s           ", VAYU_FW_VERSION, VAYU_HW_REVISION);
    ESP_LOGI(TAG, "==================================================");

    // 1. Initialize NVS Flash Storage
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        nvs_flash_erase();
        nvs_flash_init();
    }

    // 2. Check MCU Reset Reason (Detect Task Watchdog resets)
    esp_reset_reason_t reset_reason = esp_reset_reason();
    bool was_wdt = (reset_reason == ESP_RST_TASK_WDT || reset_reason == ESP_RST_INT_WDT);
    if (was_wdt) {
        ESP_LOGE(TAG, "Detected previous system crash caused by Watchdog Timer!");
    }

    // 3. Initialize Core Hardware Drivers
    hal_fan_init();
    hal_sensors_init();

    // 4. Initialize Subsystems (Autonomous Safety & Bounded Ring Buffer)
    safety_controller_init(2160, was_wdt);
    telemetry_buffer_init();

    // 5. Spawn Core Tasks
    xTaskCreatePinnedToCore(safety_task, "safety_task", 4096, NULL, 5, NULL, 1);
    xTaskCreatePinnedToCore(telemetry_task, "telemetry_task", 4096, NULL, 2, NULL, 0);

    // 6. Start Network Subsystems
    wifi_manager_init(CONFIG_VAYU_WIFI_SSID, CONFIG_VAYU_WIFI_PASSWORD, NULL);
    mqtt_client_service_init("mqtt://127.0.0.1:1883", s_device_id, "vayu_device", "vayu_device_pass_2026");

    ESP_LOGI(TAG, "All VAYU subsystems initialized successfully.");
}

#else /* VAYU_TEST_HOST */

int main(void)
{
    printf("SOCHI VAYU - Host Simulated App Main\n");
    return 0;
}

#endif
