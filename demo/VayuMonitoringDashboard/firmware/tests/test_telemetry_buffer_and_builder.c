/**
 * @file test_telemetry_buffer_and_builder.c
 * @brief Unit Tests for Bounded Offline Ring Buffer & Telemetry JSON Serializer
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include "../esp32-vayu-node/main/telemetry_buffer.h"
#include "../esp32-vayu-node/main/telemetry_builder.h"

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

void test_buffer_basic_push_pop(void)
{
    printf("\n[*] Testing Basic Push & Pop Operations...\n");

    telemetry_buffer_init();
    TEST_ASSERT(telemetry_buffer_count() == 0, "Initial buffer count is 0");

    // Push 3 items
    for (int i = 1; i <= 3; i++) {
        vayu_telemetry_item_t item = {
            .timestamp_ms = 1000 * i,
            .uptime_seconds = i,
            .fan_pct = i * 20
        };
        bool ok = telemetry_buffer_push(&item);
        TEST_ASSERT(ok == true, "Pushing within capacity returns true (no overwrite)");
    }

    TEST_ASSERT(telemetry_buffer_count() == 3, "Buffer count is 3 after 3 pushes");

    // Pop items in FIFO order
    vayu_telemetry_item_t popped;
    for (int i = 1; i <= 3; i++) {
        bool has_item = telemetry_buffer_pop(&popped);
        TEST_ASSERT(has_item == true, "Pop returned item");
        TEST_ASSERT(popped.uptime_seconds == (uint32_t)i, "Popped item maintains strict FIFO order");
    }

    TEST_ASSERT(telemetry_buffer_count() == 0, "Buffer count is 0 after popping all items");
    TEST_ASSERT(telemetry_buffer_pop(&popped) == false, "Popping empty buffer returns false");
}

void test_buffer_overflow_fifo_overwrite(void)
{
    printf("\n[*] Testing Bounded Buffer Overflow & FIFO Overwrite Policy...\n");

    telemetry_buffer_init();

    // Push 250 items into a 200-capacity ring buffer
    for (int i = 1; i <= 250; i++) {
        vayu_telemetry_item_t item = {
            .timestamp_ms = 1000 * i,
            .uptime_seconds = i,
            .fan_pct = 50
        };
        telemetry_buffer_push(&item);
    }

    TEST_ASSERT(telemetry_buffer_count() == VAYU_BUFFER_MAX_ITEMS, "Buffer count strictly capped at 200 items (no memory growth)");
    TEST_ASSERT(telemetry_buffer_get_dropped_count() == 50, "Exactly 50 oldest records recorded as dropped");

    // Oldest 50 (1..50) must have been discarded. First popped item must be record 51!
    vayu_telemetry_item_t oldest_retained;
    telemetry_buffer_pop(&oldest_retained);
    TEST_ASSERT(oldest_retained.uptime_seconds == 51, "Oldest retained item is item #51 (FIFO overwrite verified)");

    // Pop remaining 199 items. Last popped item must be record 250!
    vayu_telemetry_item_t item;
    for (int i = 52; i < 250; i++) {
        telemetry_buffer_pop(&item);
    }
    telemetry_buffer_pop(&item);
    TEST_ASSERT(item.uptime_seconds == 250, "Most recent item #250 is safely preserved in buffer");
    TEST_ASSERT(telemetry_buffer_count() == 0, "Buffer completely emptied after draining");
}

void test_telemetry_builder_valid_payload(void)
{
    printf("\n[*] Testing Telemetry JSON Serialization (Contract v1.0.0)...\n");

    vayu_telemetry_item_t item = {
        .timestamp_ms = 1776864000000LL, // 2026-04-22T13:20:00Z
        .sensors = {
            .pm1 = 8.5f,
            .pm25 = 15.2f,
            .pm10 = 24.8f,
            .voc = 55,
            .temp_c = 24.8f,
            .rh = 46.5f,
            .pm_valid = true,
            .temp_rh_valid = true,
            .voc_valid = true
        },
        .fan_pct = 50,
        .mode = VAYU_MODE_AUTO,
        .aqi = 58,
        .filter_hours_left = 2140,
        .rssi = -64,
        .err_code = 0,
        .uptime_seconds = 3600
    };

    char json[1024];
    int len = telemetry_builder_serialize("VAYU-DEV-001", &item, json, sizeof(json));

    TEST_ASSERT(len > 0, "Telemetry JSON serialized successfully");
    TEST_ASSERT(strstr(json, "\"schema_version\":\"1.0.0\"") != NULL, "Schema version is 1.0.0");
    TEST_ASSERT(strstr(json, "\"device_id\":\"VAYU-DEV-001\"") != NULL, "Device ID is VAYU-DEV-001");
    TEST_ASSERT(strstr(json, "\"is_simulated\":false") != NULL, "is_simulated is explicitly false for physical hardware node");
    TEST_ASSERT(strstr(json, "\"aqi_standard\":\"US-EPA\"") != NULL, "AQI standard is US-EPA");
    TEST_ASSERT(strstr(json, "\"mode\":\"AUTO\"") != NULL, "Operating mode is AUTO");
    TEST_ASSERT(strstr(json, "\"pm25\":15.2") != NULL, "PM2.5 value is serialized correctly");
    TEST_ASSERT(strstr(json, "\"filter_hours_left\":2140") != NULL, "Filter hours serialized correctly");
}

void test_telemetry_builder_invalid_sensor_emits_null(void)
{
    printf("\n[*] Testing Strict Null Handling When Sensor Is Faulty / Disconnected...\n");

    vayu_telemetry_item_t item = {
        .timestamp_ms = 1776864000000LL,
        .sensors = {
            .pm1 = 0.0f,
            .pm25 = 0.0f,
            .pm10 = 0.0f,
            .voc = 0,
            .temp_c = 0.0f,
            .rh = 0.0f,
            .pm_valid = false,     // Broken PM UART
            .temp_rh_valid = false, // Broken I2C
            .voc_valid = false
        },
        .fan_pct = 50,
        .mode = VAYU_MODE_AUTO,
        .aqi = 0,
        .filter_hours_left = 2140,
        .rssi = -70,
        .err_code = 0x06, // PM fault (0x02) | Temp fault (0x04)
        .uptime_seconds = 4000
    };

    char json[1024];
    int len = telemetry_builder_serialize("VAYU-DEV-002", &item, json, sizeof(json));

    TEST_ASSERT(len > 0, "Faulty payload serialized successfully");
    TEST_ASSERT(strstr(json, "\"pm25\":null") != NULL, "PM2.5 is serialized as null (not fabricated 0.0)");
    TEST_ASSERT(strstr(json, "\"aqi\":null") != NULL, "AQI is serialized as null when PM sensor is invalid");
    TEST_ASSERT(strstr(json, "\"temp_c\":null") != NULL, "Chamber temperature is serialized as null");
    TEST_ASSERT(strstr(json, "\"rh\":null") != NULL, "Relative humidity is serialized as null");
    TEST_ASSERT(strstr(json, "\"pm_valid\":false") != NULL, "pm_valid flag is false in diagnostics");
    TEST_ASSERT(strstr(json, "\"err_code\":6") != NULL, "err_code bitmask reflects 0x06 (PM & Temp faults)");
}

int main(void)
{
    printf("==================================================================\n");
    printf("   SOCHI VAYU - Telemetry Buffer & Serializer Unit Tests          \n");
    printf("==================================================================\n");

    test_buffer_basic_push_pop();
    test_buffer_overflow_fifo_overwrite();
    test_telemetry_builder_valid_payload();
    test_telemetry_builder_invalid_sensor_emits_null();

    printf("\n------------------------------------------------------------------\n");
    printf("Test Results: %d / %d tests PASSED (%d%%)\n",
           s_tests_passed, s_tests_run, (s_tests_passed * 100) / (s_tests_run > 0 ? s_tests_run : 1));
    printf("==================================================================\n");

    return (s_tests_passed == s_tests_run) ? 0 : 1;
}
