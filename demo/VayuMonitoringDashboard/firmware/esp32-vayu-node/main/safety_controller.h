/**
 * @file safety_controller.h
 * @brief SOCHI VAYU - Autonomous Local Safety & Closed-Loop Fan Controller
 *
 * Runs autonomously on the ESP32. Guarantees safe air purification behavior,
 * thermal protection, and tachometer stall detection regardless of network or
 * broker availability.
 */

#ifndef SAFETY_CONTROLLER_H
#define SAFETY_CONTROLLER_H

#include <stdint.h>
#include <stdbool.h>
#include "hal_sensors.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Operational Modes */
typedef enum {
    VAYU_MODE_AUTO = 0,     /*!< Autonomous PM2.5 closed-loop control (default) */
    VAYU_MODE_MANUAL,       /*!< Operator commanded fan speed (safety constrained) */
    VAYU_MODE_BOOST,        /*!< Maximum airflow 100% duty cycle */
    VAYU_MODE_SLEEP         /*!< Ultra-quiet 20% duty cycle */
} vayu_mode_t;

/* Diagnostic Error Bitmask */
#define VAYU_ERR_NONE           0x00
#define VAYU_ERR_FAN_STALL      0x01    /*!< Commanded > 20% but tachometer reports 0 RPM */
#define VAYU_ERR_PM_SENSOR      0x02    /*!< PM sensor UART communication timeout / checksum fail */
#define VAYU_ERR_TEMP_RH        0x04    /*!< Environmental sensor I2C timeout */
#define VAYU_ERR_OVERHEAT       0x08    /*!< Chamber temperature exceeded 65.0 C */
#define VAYU_ERR_WDT_REBOOT     0x10    /*!< Previous boot was caused by Task Watchdog */

/* Controller State Snapshot */
typedef struct {
    vayu_mode_t mode;               /*!< Active operating mode */
    uint8_t commanded_fan_pct;      /*!< Current PWM duty cycle (0-100%) */
    uint16_t measured_rpm;          /*!< Measured impeller rotational speed */
    uint16_t aqi;                   /*!< Calculated US-EPA Air Quality Index */
    uint32_t filter_hours_left;     /*!< Remaining filter lifetime in hours */
    uint8_t error_code;             /*!< Active error bitmask */
    uint32_t uptime_seconds;        /*!< System operational seconds */
    bool emergency_stopped;         /*!< True if thermal runaway shutdown is active */
    vayu_sensor_data_t last_sensors;/*!< Most recent sensor snapshot */
} vayu_controller_state_t;

/**
 * @brief Initialize the autonomous safety controller state machine.
 * @param initial_filter_hours Total filter lifespan to seed (e.g. 2160 hours).
 * @param was_wdt_reboot True if system reset reason was watchdog crash.
 */
void safety_controller_init(uint32_t initial_filter_hours, bool was_wdt_reboot);

/**
 * @brief Autonomous control loop iteration. Called every 1 second.
 * Reads sensors, checks tachometer, evaluates safety interlocks, and updates fan PWM.
 * @param sensors Snapshot of sensor inputs.
 * @param measured_rpm Impeller speed from tachometer.
 */
void safety_controller_step(const vayu_sensor_data_t *sensors, uint16_t measured_rpm);

/**
 * @brief Apply an external operator command (from MQTT or physical button).
 * Validates against safety rules (e.g., prevents setting 0% fan when PM2.5 is hazardous).
 * @param mode Target mode (or keep current).
 * @param manual_duty Target manual fan duty (0-100%).
 * @param reset_filter If true, resets filter hours back to 2160.
 * @return true if command was safely accepted, false if rejected by safety logic.
 */
bool safety_controller_apply_command(vayu_mode_t mode, uint8_t manual_duty, bool reset_filter);

/**
 * @brief Get read-only snapshot of current controller state for telemetry.
 * @param[out] out_state Destination pointer.
 */
void safety_controller_get_state(vayu_controller_state_t *out_state);

/**
 * @brief Calculate US-EPA AQI from PM2.5 mass concentration.
 * @param pm25 Particulate matter in µg/m³.
 * @return EPA AQI integer (0 - 500).
 */
uint16_t safety_controller_calculate_epa_aqi(float pm25);

/**
 * @brief Calculate recommended autonomous fan speed from PM2.5.
 * @param pm25 Particulate matter in µg/m³.
 * @return Fan duty cycle percentage (25% - 100%).
 */
uint8_t safety_controller_calculate_auto_fan_speed(float pm25);

#ifdef __cplusplus
}
#endif

#endif /* SAFETY_CONTROLLER_H */
