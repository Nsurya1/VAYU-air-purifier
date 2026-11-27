/**
 * @file safety_controller.c
 * @brief SOCHI VAYU - Autonomous Local Safety & Closed-Loop Fan Controller Implementation
 */

#include "safety_controller.h"
#include <string.h>
#include <math.h>

#define DEFAULT_FILTER_LIFESPAN_HOURS   2160    /* 90 days continuous @ 24/7 */
#define MIN_SAFE_FAN_PCT_HAZARDOUS      25
#define STALL_CONFIRMATION_SECONDS      5

static vayu_controller_state_t s_state;
static uint8_t s_manual_target_duty = 50;
static uint32_t s_consecutive_stall_seconds = 0;
static uint32_t s_uptime_tick_counter = 0;

void safety_controller_init(uint32_t initial_filter_hours, bool was_wdt_reboot)
{
    memset(&s_state, 0, sizeof(s_state));

    s_state.mode = VAYU_MODE_AUTO;
    s_state.commanded_fan_pct = 25;
    s_state.measured_rpm = 0;
    s_state.aqi = 0;
    s_state.filter_hours_left = (initial_filter_hours > 0) ? initial_filter_hours : DEFAULT_FILTER_LIFESPAN_HOURS;
    s_state.error_code = was_wdt_reboot ? VAYU_ERR_WDT_REBOOT : VAYU_ERR_NONE;
    s_state.uptime_seconds = 0;
    s_state.emergency_stopped = false;

    s_manual_target_duty = 50;
    s_consecutive_stall_seconds = 0;
    s_uptime_tick_counter = 0;
}

uint16_t safety_controller_calculate_epa_aqi(float pm25)
{
    if (pm25 < 0.0f) return 0;
    if (pm25 > 500.4f) return 500;

    // US-EPA PM2.5 Breakpoints: {C_low, C_high, I_low, I_high}
    struct {
        float c_low;
        float c_high;
        uint16_t i_low;
        uint16_t i_high;
    } bp[] = {
        {0.0f,   12.0f,   0,   50},
        {12.1f,  35.4f,  51,  100},
        {35.5f,  55.4f, 101,  150},
        {55.5f, 150.4f, 151,  200},
        {150.5f, 250.4f, 201, 300},
        {250.5f, 350.4f, 301, 400},
        {350.5f, 500.4f, 401, 500}
    };

    for (int i = 0; i < 7; i++) {
        if (pm25 <= bp[i].c_high) {
            float slope = (float)(bp[i].i_high - bp[i].i_low) / (bp[i].c_high - bp[i].c_low);
            float aqi = slope * (pm25 - bp[i].c_low) + (float)bp[i].i_low;
            return (uint16_t)roundf(aqi);
        }
    }

    return 500;
}

uint8_t safety_controller_calculate_auto_fan_speed(float pm25)
{
    if (pm25 <= 12.0f) {
        // Good air quality: quiet 25% circulation
        return 25;
    } else if (pm25 <= 35.4f) {
        // Moderate: linear scale from 25% to 50%
        float factor = (pm25 - 12.0f) / (35.4f - 12.0f);
        return 25 + (uint8_t)roundf(factor * 25.0f);
    } else if (pm25 <= 55.4f) {
        // Unhealthy for Sensitive Groups: linear scale from 50% to 75%
        float factor = (pm25 - 35.4f) / (55.4f - 35.4f);
        return 50 + (uint8_t)roundf(factor * 25.0f);
    } else if (pm25 <= 150.4f) {
        // Unhealthy: linear scale from 75% to 95%
        float factor = (pm25 - 55.4f) / (150.4f - 55.4f);
        return 75 + (uint8_t)roundf(factor * 20.0f);
    } else {
        // Hazardous: full turbo 100%
        return 100;
    }
}

bool safety_controller_apply_command(vayu_mode_t mode, uint8_t manual_duty, bool reset_filter)
{
    if (reset_filter) {
        s_state.filter_hours_left = DEFAULT_FILTER_LIFESPAN_HOURS;
    }

    // Safety Constraint: If chamber is critically hot (>60 C), reject reducing fan
    if (s_state.last_sensors.temp_rh_valid && s_state.last_sensors.temp_c > 60.0f && manual_duty < 50) {
        return false;
    }

    // Safety Constraint: If PM2.5 is currently Hazardous (>55.4 ug/m3), clamp minimum manual speed
    if (s_state.last_sensors.pm_valid && s_state.last_sensors.pm25 > 55.4f && manual_duty < MIN_SAFE_FAN_PCT_HAZARDOUS) {
        manual_duty = MIN_SAFE_FAN_PCT_HAZARDOUS;
    }

    if (manual_duty > 100) manual_duty = 100;

    s_state.mode = mode;
    s_manual_target_duty = manual_duty;

    return true;
}

void safety_controller_step(const vayu_sensor_data_t *sensors, uint16_t measured_rpm)
{
    s_state.uptime_seconds++;
    s_state.measured_rpm = measured_rpm;

    if (sensors != NULL) {
        s_state.last_sensors = *sensors;
    }

    // 1. Evaluate Sensor Validity & Communication Errors
    if (!s_state.last_sensors.pm_valid) {
        s_state.error_code |= VAYU_ERR_PM_SENSOR;
    } else {
        s_state.error_code &= ~VAYU_ERR_PM_SENSOR;
        s_state.aqi = safety_controller_calculate_epa_aqi(s_state.last_sensors.pm25);
    }

    if (!s_state.last_sensors.temp_rh_valid) {
        s_state.error_code |= VAYU_ERR_TEMP_RH;
    } else {
        s_state.error_code &= ~VAYU_ERR_TEMP_RH;
    }

    // 2. Thermal Runaway & Overheat Protection
    if (s_state.last_sensors.temp_rh_valid && s_state.last_sensors.temp_c >= 75.0f) {
        // Fire safety threshold: Emergency shutdown
        s_state.emergency_stopped = true;
        s_state.error_code |= VAYU_ERR_OVERHEAT;
    } else if (s_state.last_sensors.temp_rh_valid && s_state.last_sensors.temp_c >= 65.0f) {
        // High chamber temp: flag error, maximize cooling fan
        s_state.emergency_stopped = false;
        s_state.error_code |= VAYU_ERR_OVERHEAT;
    } else {
        s_state.emergency_stopped = false;
        s_state.error_code &= ~VAYU_ERR_OVERHEAT;
    }

    // 3. Determine Commanded Fan Speed Based on Mode & Health
    uint8_t target_duty = 25;

    if (s_state.emergency_stopped) {
        target_duty = 0;
    } else if ((s_state.error_code & VAYU_ERR_OVERHEAT) != 0) {
        target_duty = 100; // Emergency thermal extraction
    } else {
        switch (s_state.mode) {
            case VAYU_MODE_AUTO:
                if (s_state.last_sensors.pm_valid) {
                    target_duty = safety_controller_calculate_auto_fan_speed(s_state.last_sensors.pm25);
                } else {
                    // Safe fallback when PM sensor is broken/disconnected
                    target_duty = 50;
                }
                break;

            case VAYU_MODE_BOOST:
                target_duty = 100;
                break;

            case VAYU_MODE_SLEEP:
                target_duty = 20;
                break;

            case VAYU_MODE_MANUAL:
            default:
                target_duty = s_manual_target_duty;
                break;
        }
    }

    // 4. Tachometer Fan Stall Interlock Protection
    // Only verify tachometer if motor is commanded to significant duty (>= 25%)
    if (target_duty >= 25 && !s_state.emergency_stopped) {
        if (measured_rpm == 0) {
            s_consecutive_stall_seconds++;
            if (s_consecutive_stall_seconds >= STALL_CONFIRMATION_SECONDS) {
                // Impeller obstructed or BLDC motor coil disconnected
                s_state.error_code |= VAYU_ERR_FAN_STALL;

                // Protect winding from continuous locked-rotor current:
                // Periodically de-energize coil with cooldown pulse
                if ((s_consecutive_stall_seconds % 10) < 3) {
                    target_duty = 0;
                }
            }
        } else if (measured_rpm > 200) {
            // Nominal rotation confirmed
            s_consecutive_stall_seconds = 0;
            s_state.error_code &= ~VAYU_ERR_FAN_STALL;
        }
    } else {
        s_consecutive_stall_seconds = 0;
    }

    s_state.commanded_fan_pct = target_duty;

    // 5. Update Filter Lifetime Counter (every 3600 iterations = 1 hour)
    s_uptime_tick_counter++;
    if (s_uptime_tick_counter >= 3600) {
        s_uptime_tick_counter = 0;
        if (s_state.filter_hours_left > 0) {
            s_state.filter_hours_left--;
        }
    }
}

void safety_controller_get_state(vayu_controller_state_t *out_state)
{
    if (out_state != NULL) {
        *out_state = s_state;
    }
}
