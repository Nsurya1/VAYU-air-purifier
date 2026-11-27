/**
 * @file hal_sensors.h
 * @brief Hardware Abstraction Layer for Particulate & Environmental Sensors
 */

#ifndef HAL_SENSORS_H
#define HAL_SENSORS_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    float pm1;              /*!< PM1.0 mass concentration in µg/m³ */
    float pm25;             /*!< PM2.5 mass concentration in µg/m³ */
    float pm10;             /*!< PM10.0 mass concentration in µg/m³ */
    int16_t voc;            /*!< Volatile Organic Compounds index (0-500) */
    float temp_c;           /*!< Ambient temperature in degrees Celsius */
    float rh;               /*!< Relative humidity percentage (0-100) */
    bool pm_valid;          /*!< True if UART frame checksum and parity passed */
    bool temp_rh_valid;     /*!< True if I2C transmission acknowledged and checksum passed */
    bool voc_valid;         /*!< True if VOC sensor warmed up and valid */
} vayu_sensor_data_t;

/**
 * @brief Initialize UART for PM sensor and I2C for environmental sensor.
 * @return true on success, false otherwise.
 */
bool hal_sensors_init(void);

/**
 * @brief Poll active sensor peripherals and populate sensor readings.
 * Missing or corrupted sensor frames will leave the respective validity flags false.
 * @param[out] out_data Pointer to output structure.
 * @return true if at least one sensor was successfully read.
 */
bool hal_sensors_read(vayu_sensor_data_t *out_data);

#ifdef __cplusplus
}
#endif

#endif /* HAL_SENSORS_H */
