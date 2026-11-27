/**
 * @file board_config.h
 * @brief SOCHI VAYU - Hardware Pinout and Configuration Mapping
 *
 * Defines default GPIO allocations and peripheral configurations for the
 * SOCHI VAYU ESP32-WROOM-32E / ESP32-S3 Reference Controller Board (Rev B).
 */

#ifndef VAYU_BOARD_CONFIG_H
#define VAYU_BOARD_CONFIG_H

#ifdef __cplusplus
extern "C" {
#endif

/* Hardware & Firmware Identity */
#define VAYU_FW_VERSION             "v1.0.0-prod"
#define VAYU_HW_REVISION            "REV-B-ESP32"
#define VAYU_SCHEMA_VERSION         "1.0.0"

/* Blower Fan PWM & Tachometer (Standard 4-Wire 12V/24V BLDC Fan) */
#define PIN_FAN_PWM                 18      /*!< LEDC PWM duty cycle output (25 kHz standard) */
#define PIN_FAN_TACH                19      /*!< Open-collector tachometer pulse input with pull-up */
#define FAN_PWM_FREQ_HZ             25000   /*!< Standard 25 kHz PWM carrier frequency for noise immunity */
#define FAN_PULSES_PER_REV          2       /*!< Standard 2 pulses per full motor revolution */

/* Laser PM Sensor (UART) - PMS5003 / Sensirion SPS30 compatible */
#define VAYU_PM_UART_PORT           1       /*!< UART Peripheral 1 */
#define PIN_PM_UART_TX              17      /*!< MCU TX -> Sensor RX */
#define PIN_PM_UART_RX              16      /*!< MCU RX <- Sensor TX */
#define PM_UART_BAUD_RATE           9600    /*!< Standard 9600 bps */

/* Environmental Sensor (I2C) - Sensirion SHT31 / Bosch BME280 compatible */
#define VAYU_I2C_PORT               0       /*!< I2C Controller 0 */
#define PIN_I2C_SDA                 21      /*!< I2C Data Line */
#define PIN_I2C_SCL                 22      /*!< I2C Clock Line */
#define I2C_CLOCK_SPEED_HZ          100000  /*!< Standard Mode 100 kHz */

/* User Interface & Status Indicators */
#define PIN_STATUS_LED              2       /*!< On-board blue status LED */
#define PIN_FAULT_LED               4       /*!< Orange fault indicator LED */

/* Telemetry & Control Cadence */
#define TELEMETRY_INTERVAL_MS       5000    /*!< Normal telemetry broadcast cadence (5 seconds) */
#define SAFETY_EVAL_INTERVAL_MS     1000    /*!< Core autonomous safety evaluation cycle (1 second) */
#define OFFLINE_BUFFER_CAPACITY     200     /*!< Maximum records buffered during network loss (~16 min) */

/* Operational Safety Limits */
#define FAN_STALL_TIMEOUT_SEC       5       /*!< Consecutive seconds with 0 RPM before declaring stall */
#define SENSOR_COMM_TIMEOUT_SEC     10      /*!< Seconds without valid UART/I2C frames before flagging fault */
#define CHAMBER_OVERHEAT_LIMIT_C    65.0f   /*!< Maximum safe chamber temperature before emergency venting */
#define CHAMBER_CRITICAL_SHUTDOWN_C 75.0f   /*!< Absolute emergency threshold: cut motor to prevent fire */

#ifdef __cplusplus
}
#endif

#endif /* VAYU_BOARD_CONFIG_H */
