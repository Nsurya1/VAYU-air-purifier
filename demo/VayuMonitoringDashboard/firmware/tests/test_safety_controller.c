/**
 * @file test_safety_controller.c
 * @brief Unit Tests for SOCHI VAYU Autonomous Safety & Closed-Loop Controller
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include "../esp32-vayu-node/main/safety_controller.h"

#define ANSI_GREEN  "\033[32m"
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

void test_epa_aqi_calculation(void)
{
    printf("\n[*] Testing US-EPA PM2.5 AQI Breakpoint Calculations...\n");

    uint16_t aqi_0 = safety_controller_calculate_epa_aqi(0.0f);
    TEST_ASSERT(aqi_0 == 0, "PM2.5 = 0.0 ug/m3 produces AQI = 0");

    uint16_t aqi_good = safety_controller_calculate_epa_aqi(12.0f);
    TEST_ASSERT(aqi_good == 50, "PM2.5 = 12.0 ug/m3 produces AQI = 50 (Good upper bound)");

    uint16_t aqi_mod = safety_controller_calculate_epa_aqi(35.4f);
    TEST_ASSERT(aqi_mod == 100, "PM2.5 = 35.4 ug/m3 produces AQI = 100 (Moderate upper bound)");

    uint16_t aqi_sens = safety_controller_calculate_epa_aqi(55.4f);
    TEST_ASSERT(aqi_sens == 150, "PM2.5 = 55.4 ug/m3 produces AQI = 150 (Unhealthy Sensitive)");

    uint16_t aqi_unhealthy = safety_controller_calculate_epa_aqi(150.4f);
    TEST_ASSERT(aqi_unhealthy == 200, "PM2.5 = 150.4 ug/m3 produces AQI = 200 (Unhealthy upper bound)");
}

void test_autonomous_fan_speed_curve(void)
{
    printf("\n[*] Testing Autonomous Auto-Speed Curve Mapping...\n");

    uint8_t duty_clean = safety_controller_calculate_auto_fan_speed(8.0f);
    TEST_ASSERT(duty_clean == 25, "Clean room (PM2.5=8.0) maps to baseline 25% fan");

    uint8_t duty_mod = safety_controller_calculate_auto_fan_speed(35.4f);
    TEST_ASSERT(duty_mod == 50, "Moderate PM2.5 (35.4) scales to 50% fan");

    uint8_t duty_high = safety_controller_calculate_auto_fan_speed(55.4f);
    TEST_ASSERT(duty_high == 75, "High PM2.5 (55.4) scales to 75% fan");

    uint8_t duty_extreme = safety_controller_calculate_auto_fan_speed(180.0f);
    TEST_ASSERT(duty_extreme == 100, "Severe PM2.5 (180.0) forces 100% turbo fan");
}

void test_pm_sensor_failure_safe_fallback(void)
{
    printf("\n[*] Testing Continuous Air Filtration During PM Sensor Disconnection...\n");

    safety_controller_init(2160, false);

    vayu_sensor_data_t bad_sensors = {
        .pm1 = 0.0f,
        .pm25 = 0.0f,
        .pm10 = 0.0f,
        .temp_c = 24.0f,
        .rh = 40.0f,
        .pm_valid = false, // Broken UART
        .temp_rh_valid = true,
        .voc_valid = true
    };

    safety_controller_step(&bad_sensors, 1200);

    vayu_controller_state_t state;
    safety_controller_get_state(&state);

    TEST_ASSERT((state.error_code & VAYU_ERR_PM_SENSOR) != 0, "Error code bit 0x02 set for PM sensor timeout");
    TEST_ASSERT(state.commanded_fan_pct == 50, "Fan automatically runs at safe 50% fallback, never stalling");
}

void test_tachometer_stall_detection(void)
{
    printf("\n[*] Testing Tachometer Impeller Stall Interlock & Recovery...\n");

    safety_controller_init(2160, false);

    vayu_sensor_data_t nominal_sensors = {
        .pm1 = 10.0f,
        .pm25 = 45.0f,
        .pm10 = 30.0f,
        .temp_c = 25.0f,
        .rh = 45.0f,
        .pm_valid = true,
        .temp_rh_valid = true,
        .voc_valid = true
    };

    // Simulate 4 seconds of 0 RPM (within startup grace window)
    for (int i = 0; i < 4; i++) {
        safety_controller_step(&nominal_sensors, 0);
    }
    vayu_controller_state_t state;
    safety_controller_get_state(&state);
    TEST_ASSERT((state.error_code & VAYU_ERR_FAN_STALL) == 0, "Stall not declared during 4-sec startup window");

    // 5th second of 0 RPM -> declares stall
    safety_controller_step(&nominal_sensors, 0);
    safety_controller_get_state(&state);
    TEST_ASSERT((state.error_code & VAYU_ERR_FAN_STALL) != 0, "Stall error bit 0x01 triggered after 5 consecutive seconds");

    // Clear stall by reporting nominal 1200 RPM
    safety_controller_step(&nominal_sensors, 1200);
    safety_controller_get_state(&state);
    TEST_ASSERT((state.error_code & VAYU_ERR_FAN_STALL) == 0, "Stall error clears upon tachometer pulse recovery");
}

void test_thermal_overheat_protection(void)
{
    printf("\n[*] Testing Thermal Overheat Protection & Emergency Shutdown...\n");

    safety_controller_init(2160, false);

    // High chamber temperature: 66.0 C -> Force 100% cooling fan
    vayu_sensor_data_t hot_sensors = {
        .pm25 = 10.0f,
        .temp_c = 66.0f,
        .rh = 30.0f,
        .pm_valid = true,
        .temp_rh_valid = true
    };
    safety_controller_step(&hot_sensors, 1400);

    vayu_controller_state_t state;
    safety_controller_get_state(&state);
    TEST_ASSERT((state.error_code & VAYU_ERR_OVERHEAT) != 0, "Overheat error bit 0x08 set when temp > 65 C");
    TEST_ASSERT(state.commanded_fan_pct == 100, "Fan commanded to 100% turbo for thermal extraction");

    // Critical thermal runaway: 76.0 C -> Emergency motor shutdown to prevent fire
    hot_sensors.temp_c = 76.0f;
    safety_controller_step(&hot_sensors, 1400);
    safety_controller_get_state(&state);
    TEST_ASSERT(state.emergency_stopped == true, "Emergency stop activated at 76 C");
    TEST_ASSERT(state.commanded_fan_pct == 0, "Motor power cut to 0% to prevent fire");
}

void test_operator_command_safety_guard(void)
{
    printf("\n[*] Testing Operator Command Validation & Local Safety Guard...\n");

    safety_controller_init(100, false);

    // Seed state with hazardous air (PM2.5 = 80 ug/m3)
    vayu_sensor_data_t haz_sensors = {
        .pm25 = 80.0f,
        .temp_c = 25.0f,
        .pm_valid = true,
        .temp_rh_valid = true
    };
    safety_controller_step(&haz_sensors, 1200);

    // Attempt operator command: MANUAL mode with 0% fan (dangerous during hazardous air)
    bool accepted = safety_controller_apply_command(VAYU_MODE_MANUAL, 0, false);
    TEST_ASSERT(accepted == true, "Command accepted but clamped by local safety");

    safety_controller_step(&haz_sensors, 1200);
    vayu_controller_state_t state;
    safety_controller_get_state(&state);
    TEST_ASSERT(state.commanded_fan_pct >= 25, "Fan clamped to minimum 25% despite 0% manual command");

    // Test filter reset command
    safety_controller_apply_command(VAYU_MODE_AUTO, 50, true);
    safety_controller_get_state(&state);
    TEST_ASSERT(state.filter_hours_left == 2160, "Filter hours successfully reset to 2160 hours");
}

int main(void)
{
    printf("==================================================================\n");
    printf("   SOCHI VAYU - ESP32 Autonomous Safety Controller Unit Tests     \n");
    printf("==================================================================\n");

    test_epa_aqi_calculation();
    test_autonomous_fan_speed_curve();
    test_pm_sensor_failure_safe_fallback();
    test_tachometer_stall_detection();
    test_thermal_overheat_protection();
    test_operator_command_safety_guard();

    printf("\n------------------------------------------------------------------\n");
    printf("Test Results: %d / %d tests PASSED (%d%%)\n",
           s_tests_passed, s_tests_run, (s_tests_passed * 100) / (s_tests_run > 0 ? s_tests_run : 1));
    printf("==================================================================\n");

    return (s_tests_passed == s_tests_run) ? 0 : 1;
}
