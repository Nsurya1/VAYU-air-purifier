/**
 * @file telemetry_buffer.h
 * @brief SOCHI VAYU - Bounded Offline Telemetry Ring Buffer
 *
 * Provides a bounded FIFO ring buffer to store telemetry events during network
 * disconnects. Guarantees zero unbounded memory growth through FIFO overwrite.
 */

#ifndef TELEMETRY_BUFFER_H
#define TELEMETRY_BUFFER_H

#include <stdint.h>
#include <stdbool.h>
#include "safety_controller.h"

#ifdef __cplusplus
extern "C" {
#endif

#define VAYU_BUFFER_MAX_ITEMS   200  /*!< Maximum buffered telemetry records */

typedef struct {
    int64_t timestamp_ms;           /*!< Epoch millisecond timestamp of reading */
    vayu_sensor_data_t sensors;     /*!< Environmental and PM measurements */
    uint8_t fan_pct;                /*!< Commanded fan PWM percentage */
    vayu_mode_t mode;               /*!< Purifier operating mode */
    uint16_t aqi;                   /*!< Calculated EPA AQI */
    uint32_t filter_hours_left;     /*!< Filter lifespan counter */
    int8_t rssi;                    /*!< Wi-Fi RSSI in dBm */
    uint8_t err_code;               /*!< Diagnostic bitmask */
    uint32_t uptime_seconds;        /*!< Device uptime */
} vayu_telemetry_item_t;

/**
 * @brief Initialize the telemetry ring buffer.
 */
void telemetry_buffer_init(void);

/**
 * @brief Push a new telemetry record into the buffer.
 * If the buffer is full, the oldest record is dropped (FIFO overwrite).
 * @param item Record to store.
 * @return true if pushed without overwrite, false if an older record was overwritten.
 */
bool telemetry_buffer_push(const vayu_telemetry_item_t *item);

/**
 * @brief Pop the oldest buffered telemetry record (FIFO order).
 * @param[out] out_item Destination pointer.
 * @return true if an item was retrieved, false if buffer is empty.
 */
bool telemetry_buffer_pop(vayu_telemetry_item_t *out_item);

/**
 * @brief Inspect the oldest buffered record without removing it.
 * @param[out] out_item Destination pointer.
 * @return true if an item was peeked, false if buffer is empty.
 */
bool telemetry_buffer_peek(vayu_telemetry_item_t *out_item);

/**
 * @brief Get the current number of buffered records.
 * @return Count between 0 and VAYU_BUFFER_MAX_ITEMS.
 */
uint16_t telemetry_buffer_count(void);

/**
 * @brief Get total number of records dropped due to buffer overflow.
 * @return Overwrite count.
 */
uint32_t telemetry_buffer_get_dropped_count(void);

/**
 * @brief Clear all buffered records.
 */
void telemetry_buffer_clear(void);

#ifdef __cplusplus
}
#endif

#endif /* TELEMETRY_BUFFER_H */
