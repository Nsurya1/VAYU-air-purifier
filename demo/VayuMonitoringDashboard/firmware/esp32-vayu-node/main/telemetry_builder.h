/**
 * @file telemetry_builder.h
 * @brief SOCHI VAYU - Telemetry Payload JSON Serializer
 *
 * Serializes telemetry snapshots into contract v1.0.0 compliant JSON strings.
 * Enforces strict synthetic data tagging (is_simulated: false) and nullifies
 * invalid sensor metrics.
 */

#ifndef TELEMETRY_BUILDER_H
#define TELEMETRY_BUILDER_H

#include <stddef.h>
#include <stdbool.h>
#include "telemetry_buffer.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Serialize a telemetry item into contract v1.0.0 JSON.
 * @param device_id Unique alphanumeric device identifier (e.g. "VAYU-DEV-001").
 * @param item Telemetry record to serialize.
 * @param[out] out_buf Destination character buffer.
 * @param buf_size Size of destination buffer (must be at least 512 bytes).
 * @return Number of characters written, or -1 if buffer was too small.
 */
int telemetry_builder_serialize(
    const char *device_id,
    const vayu_telemetry_item_t *item,
    char *out_buf,
    size_t buf_size
);

/**
 * @brief Format epoch millisecond timestamp into ISO 8601 UTC string.
 * Format: "YYYY-MM-DDTHH:MM:SSZ"
 * @param timestamp_ms Milliseconds since Unix epoch.
 * @param[out] out_iso Destination buffer (at least 25 bytes).
 * @param max_len Size of destination buffer.
 */
void telemetry_builder_format_iso8601(int64_t timestamp_ms, char *out_iso, size_t max_len);

#ifdef __cplusplus
}
#endif

#endif /* TELEMETRY_BUILDER_H */
