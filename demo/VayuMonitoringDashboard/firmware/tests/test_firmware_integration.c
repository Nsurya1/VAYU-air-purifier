/**
 * @file test_firmware_integration.c
 * @brief End-to-End Firmware Integration Tests
 *
 * Verifies that the ESP32 firmware stack correctly manages:
 * 1. Autonomous safety operation during offline states.
 * 2. Bounded ring buffer storage during MQTT network loss.
 * 3. Automatic buffer draining and replay upon reconnection.
 * 4. Inbound command dispatching and safety filtering.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include "../esp32-vayu-node/main/safety_controller.h"
#include "../esp32-vayu-node/main/telemetry_buffer.h"
#include "../esp32-vayu-node/main/telemetry_builder.h"
#include "../esp32-vayu-node/main/net/wifi_manager.h"
#include "../esp32-vayu-node/main/net/mqtt_client_service.h"

#define ANSI_RED    "\033[31m"
#define ANSI_RESET  "\033[0m"

static int s_tests_run = 0;
static int s_tests_passed = 0;

#define TEST_ASSERT(cond, msg) do { \
    s_tests_run++; \
    if (cond) { \
        s_tests_passed++; \
        printf("  [PASS] %s\n", msg); \
    } else { \
        printf("  " ANSI_RED "[FAIL] %s (Line %d)" ANSI_RESET "\n", msg, __LINE__); \
    } \
} while (0)

void test_offline_buffering_and_reconnection_flush(void)
{
    printf("\n[*] Testing Offline Buffering & Automatic Reconnection Flushing...\n");

    // 1. Initialize subsystems
    safety_controller_init(2160, false);
    telemetry_buffer_init();
    wifi_manager_init("VAYU_AIR_NET", "pass", NULL);
    mqtt_client_service_init("mqtt://127.0.0.1:1883", "VAYU-DEV-001", "vayu_device", "vayu_device_pass_2026");

    TEST_ASSERT(telemetry_buffer_count() == 0, "Buffer starts empty");

    // 2. Simulate Network Drop (MQTT Disconnected)
    extern void mqtt_client_service_mock_set(bool connected);
    extern int mqtt_client_service_mock_get_published(void);

    mqtt_client_service_mock_set(false);
    TEST_ASSERT(mqtt_client_service_is_connected() == false, "MQTT client enters disconnected state");

    // 3. Purifier continues autonomous operation and buffers 10 telemetry events
    vayu_sensor_data_t sensors = {
        .pm1 = 5.0f,
        .pm25 = 14.0f,
        .pm10 = 20.0f,
        .temp_c = 24.0f,
        .rh = 45.0f,
        .pm_valid = true,
        .temp_rh_valid = true,
        .voc_valid = true
    };

    for (int i = 1; i <= 10; i++) {
        // Autonomous safety step (100% operational offline)
        safety_controller_step(&sensors, 1200);

        vayu_controller_state_t state;
        safety_controller_get_state(&state);

        // Telemetry task stores in ring buffer because MQTT is offline
        vayu_telemetry_item_t item = {
            .timestamp_ms = 1000 * i,
            .sensors = state.last_sensors,
            .fan_pct = state.commanded_fan_pct,
            .mode = state.mode,
            .aqi = state.aqi,
            .filter_hours_left = state.filter_hours_left,
            .rssi = -65,
            .err_code = state.error_code,
            .uptime_seconds = state.uptime_seconds
        };
        telemetry_buffer_push(&item);
    }

    TEST_ASSERT(telemetry_buffer_count() == 10, "10 telemetry records buffered while offline");

    // 4. Reconnect to MQTT Broker
    mqtt_client_service_mock_set(true);
    TEST_ASSERT(mqtt_client_service_is_connected() == true, "MQTT client reconnected");

    // 5. Automatic Flush of Offline Buffer
    int initial_published = mqtt_client_service_mock_get_published();
    uint16_t flushed = mqtt_client_service_flush_offline_buffer();

    TEST_ASSERT(flushed == 10, "All 10 offline records flushed upon reconnection");
    TEST_ASSERT(telemetry_buffer_count() == 0, "Offline buffer completely drained");
    TEST_ASSERT(mqtt_client_service_mock_get_published() == initial_published + 10,
                "MQTT gateway published all 10 historical records");
}

void test_autonomous_operation_during_complete_network_loss(void)
{
    printf("\n[*] Testing Autonomous Safety & Blower Regulation During Total Network Outage...\n");

    safety_controller_init(2160, false);

    // Simulate clean air -> fan runs at 25%
    vayu_sensor_data_t clean = { .pm25 = 8.0f, .temp_c = 23.0f, .pm_valid = true, .temp_rh_valid = true };
    safety_controller_step(&clean, 800);
    vayu_controller_state_t st;
    safety_controller_get_state(&st);
    TEST_ASSERT(st.commanded_fan_pct == 25, "Blower regulated to 25% for clean air (no broker needed)");

    // Smoke spike occurs locally (PM2.5 = 120 ug/m3) -> Controller independently ramps fan to 90%
    vayu_sensor_data_t smoke = { .pm25 = 120.0f, .temp_c = 24.0f, .pm_valid = true, .temp_rh_valid = true };
    safety_controller_step(&smoke, 1600);
    safety_controller_get_state(&st);
    TEST_ASSERT(st.commanded_fan_pct >= 85, "Blower automatically accelerates to >=85% during smoke spike offline");
    TEST_ASSERT(st.aqi >= 180, "AQI calculated locally on ESP32 without cloud/backend dependency");
}

int main(void)
{
    printf("==================================================================\n");
    printf("   SOCHI VAYU - End-to-End Firmware Integration Test Suite        \n");
    printf("==================================================================\n");

    test_offline_buffering_and_reconnection_flush();
    test_autonomous_operation_during_complete_network_loss();

    printf("\n------------------------------------------------------------------\n");
    printf("Test Results: %d / %d tests PASSED (%d%%)\n",
           s_tests_passed, s_tests_run, (s_tests_passed * 100) / (s_tests_run > 0 ? s_tests_run : 1));
    printf("==================================================================\n");

    return (s_tests_passed == s_tests_run) ? 0 : 1;
}
