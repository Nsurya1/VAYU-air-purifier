/**
 * @file mqtt_client_service.h
 * @brief SOCHI VAYU - Mosquitto MQTT Gateway Client Service
 */

#ifndef MQTT_CLIENT_SERVICE_H
#define MQTT_CLIENT_SERVICE_H

#include <stdbool.h>
#include <stdint.h>
#include "telemetry_buffer.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef void (*command_handler_cb_t)(const char *command_json);

/**
 * @brief Initialize and start the MQTT client connected to the local Mosquitto broker.
 * Configures authentication credentials and Last Will and Testament (LWT).
 * @param broker_uri Broker endpoint (e.g. "mqtt://192.168.1.50:1883").
 * @param device_id Unique device identifier (e.g. "VAYU-DEV-001").
 * @param username MQTT client username ("vayu_device").
 * @param password MQTT client password ("vayu_device_pass_2026").
 * @return true on initialization success, false otherwise.
 */
bool mqtt_client_service_init(
    const char *broker_uri,
    const char *device_id,
    const char *username,
    const char *password
);

/**
 * @brief Check if MQTT client is currently connected to broker.
 * @return true if connected.
 */
bool mqtt_client_service_is_connected(void);

/**
 * @brief Publish a live or buffered telemetry payload to vayu/{device_id}/telemetry.
 * @param payload_json Null-terminated JSON string.
 * @return true if enqueued/published successfully.
 */
bool mqtt_client_service_publish_telemetry(const char *payload_json);

/**
 * @brief Drain and publish any telemetry records stored in the offline ring buffer.
 * @return Number of records successfully dispatched.
 */
uint16_t mqtt_client_service_flush_offline_buffer(void);

/**
 * @brief Send graceful shutdown offline status before reboot or deep sleep.
 */
void mqtt_client_service_send_clean_disconnect(void);

#ifdef __cplusplus
}
#endif

#endif /* MQTT_CLIENT_SERVICE_H */
