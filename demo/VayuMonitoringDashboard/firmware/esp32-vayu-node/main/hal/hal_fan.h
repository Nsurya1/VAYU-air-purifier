/**
 * @file hal_fan.h
 * @brief Hardware Abstraction Layer for 4-Wire PWM Blower Fan and Tachometer
 */

#ifndef HAL_FAN_H
#define HAL_FAN_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Initialize fan PWM timer, channel, and tachometer pulse capture.
 * @return true on success, false on driver initialization error.
 */
bool hal_fan_init(void);

/**
 * @brief Command fan PWM duty cycle.
 * @param duty_pct Desired duty cycle from 0% (off) to 100% (full speed).
 */
void hal_fan_set_duty(uint8_t duty_pct);

/**
 * @brief Get the current commanded PWM duty cycle.
 * @return Commanded percentage (0-100).
 */
uint8_t hal_fan_get_duty(void);

/**
 * @brief Read measured impeller speed from tachometer interrupt counter.
 * Calculates RPM over the last sampling window.
 * @return Measured rotational speed in RPM.
 */
uint16_t hal_fan_get_rpm(void);

/**
 * @brief Emergency motor power cut-off for thermal or electrical faults.
 */
void hal_fan_emergency_stop(void);

#ifdef __cplusplus
}
#endif

#endif /* HAL_FAN_H */
