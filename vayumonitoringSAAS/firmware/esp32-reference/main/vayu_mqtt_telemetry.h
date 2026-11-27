#ifndef VAYU_MQTT_TELEMETRY_H
#define VAYU_MQTT_TELEMETRY_H

#include "vayu_types.h"
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    const char *broker_uri;       // e.g. "mqtt://192.168.1.100:1883"
    const char *username;         // e.g. "vayu_device"
    const char *password;         // e.g. "VayuDevice2026!"
    const char *device_id;        // e.g. "VAYU-001"
    const char *room;             // e.g. "Conference Room 2A"
} vayu_mqtt_config_t;

/**
 * Initialize the ESP-MQTT client, configure Last Will & Testament (LWT),
 * and start the background event loop.
 */
esp_err_t vayu_mqtt_init(const vayu_mqtt_config_t *config);

/**
 * Check if the MQTT client is currently connected to the broker.
 */
bool vayu_mqtt_is_connected(void);

/**
 * Publish the birth status message: "vayu/devices/{id}/status" with status: "ONLINE".
 */
esp_err_t vayu_mqtt_publish_birth(void);

/**
 * Serialize and publish a telemetry packet according to SOCHI VAYU schema v1.0.0.
 * If sensor diagnostics indicate invalidity, explicit JSON nulls are generated.
 */
esp_err_t vayu_mqtt_publish_telemetry(const vayu_purifier_state_t *state);

/**
 * Cleanly disconnect and destroy the MQTT client.
 */
esp_err_t vayu_mqtt_stop(void);

#ifdef __cplusplus
}
#endif

#endif // VAYU_MQTT_TELEMETRY_H
