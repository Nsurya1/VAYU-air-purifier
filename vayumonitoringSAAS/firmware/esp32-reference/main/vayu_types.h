#ifndef VAYU_TYPES_H
#define VAYU_TYPES_H

#include <stdbool.h>
#include <stdint.h>
#include <time.h>

#ifdef __cplusplus
extern "C" {
#endif

#define VAYU_SCHEMA_VERSION "1.0.0"
#define VAYU_MAX_DEVICE_ID_LEN 32
#define VAYU_MAX_ROOM_LEN 64

/**
 * Operating modes for the VAYU air purifier.
 */
typedef enum {
    VAYU_MODE_AUTO = 0,
    VAYU_MODE_MANUAL,
    VAYU_MODE_SLEEP,
    VAYU_MODE_TURBO
} vayu_operating_mode_t;

/**
 * Standard hardware error codes.
 */
typedef enum {
    VAYU_ERR_NONE = 0,
    VAYU_ERR_DOOR_OPEN = 101,
    VAYU_ERR_FAN_STALLED = 102,
    VAYU_ERR_THERMAL_CUTOFF = 103,
    VAYU_ERR_PM_SENSOR_COMM = 201,
    VAYU_ERR_VOC_SENSOR_COMM = 202,
    VAYU_ERR_TEMP_SENSOR_COMM = 203
} vayu_error_code_t;

/**
 * Sensor diagnostic flags.
 */
typedef struct {
    bool pm_sensor_valid;
    bool temperature_sensor_valid;
    bool voc_sensor_valid;
} vayu_diagnostics_t;

/**
 * Sensor physical measurements.
 * If a sensor is faulted, value is set to NAN or ignored.
 */
typedef struct {
    float pm1;
    float pm25;
    float pm10;
    int32_t voc_index;
    float temperature_c;
    float humidity_rh;
} vayu_metrics_t;

/**
 * Overall thread-safe purifier state.
 */
typedef struct {
    char device_id[VAYU_MAX_DEVICE_ID_LEN];
    char room[VAYU_MAX_ROOM_LEN];
    char firmware_version[16];
    
    vayu_operating_mode_t mode;
    vayu_error_code_t error_code;
    
    vayu_metrics_t metrics;
    vayu_diagnostics_t diagnostics;
    
    time_t last_reading_time;
    bool clock_synchronized;
} vayu_purifier_state_t;

#ifdef __cplusplus
}
#endif

#endif // VAYU_TYPES_H
