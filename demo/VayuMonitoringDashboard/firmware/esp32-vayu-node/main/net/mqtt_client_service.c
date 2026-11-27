/**
 * @file mqtt_client_service.c
 * @brief SOCHI VAYU - Mosquitto MQTT Gateway Client Service Implementation
 */

#include "mqtt_client_service.h"
#include "board_config.h"
#include "telemetry_builder.h"
#include "safety_controller.h"
#include <stdio.h>
#include <string.h>

static char s_device_id[64] = "VAYU-DEV-001";
static char s_telemetry_topic[128] = "vayu/VAYU-DEV-001/telemetry";
static char s_status_topic[128] = "vayu/VAYU-DEV-001/status";
static char s_cmd_topic[128] = "vayu/VAYU-DEV-001/cmd";

#ifndef VAYU_TEST_HOST
#include "mqtt_client.h"
#include "esp_log.h"
#include "esp_timer.h"

static const char *TAG = "MQTT_SVC";
static esp_mqtt_client_handle_t s_client = NULL;
static char s_lwt_payload[256];
static bool s_connected = false;

static void handle_inbound_command(const char *payload, int len)
{
    char buf[256];
    if (len >= (int)sizeof(buf)) len = sizeof(buf) - 1;
    memcpy(buf, payload, len);
    buf[len] = '\0';

    ESP_LOGI(TAG, "Inbound command received: %s", buf);

    // Simple robust keyword parsing
    if (strstr(buf, "\"FILTER_RESET\"")) {
        ESP_LOGI(TAG, "Command: Filter lifetime reset");
        safety_controller_apply_command(VAYU_MODE_AUTO, 50, true);
    } else if (strstr(buf, "\"SET_MODE\"")) {
        if (strstr(buf, "\"BOOST\"")) {
            safety_controller_apply_command(VAYU_MODE_BOOST, 100, false);
        } else if (strstr(buf, "\"SLEEP\"")) {
            safety_controller_apply_command(VAYU_MODE_SLEEP, 20, false);
        } else if (strstr(buf, "\"AUTO\"")) {
            safety_controller_apply_command(VAYU_MODE_AUTO, 50, false);
        } else if (strstr(buf, "\"MANUAL\"")) {
            safety_controller_apply_command(VAYU_MODE_MANUAL, 50, false);
        }
    } else if (strstr(buf, "\"SET_FAN\"")) {
        const char *fan_pos = strstr(buf, "\"fan_pct\":");
        if (fan_pos) {
            int fan_pct = 50;
            if (sscanf(fan_pos + 10, "%d", &fan_pct) == 1) {
                ESP_LOGI(TAG, "Command: Set manual fan to %d%%", fan_pct);
                safety_controller_apply_command(VAYU_MODE_MANUAL, (uint8_t)fan_pct, false);
            }
        }
    }
}

static void mqtt_event_handler(void *handler_args, esp_event_base_t base, int32_t event_id, void *event_data)
{
    esp_mqtt_event_handle_t event = (esp_mqtt_event_handle_t)event_data;

    switch (event->event_id) {
        case MQTT_EVENT_CONNECTED:
            s_connected = true;
            ESP_LOGI(TAG, "Connected to Mosquitto MQTT broker");

            // 1. Publish ONLINE status
            char online_msg[256];
            snprintf(online_msg, sizeof(online_msg),
                     "{\"schema_version\":\"%s\",\"device_id\":\"%s\",\"status\":\"ONLINE\",\"reason\":\"BOOT\"}",
                     VAYU_SCHEMA_VERSION, s_device_id);
            esp_mqtt_client_publish(s_client, s_status_topic, online_msg, 0, 1, 0);

            // 2. Subscribe to command topic
            esp_mqtt_client_subscribe(s_client, s_cmd_topic, 1);
            ESP_LOGI(TAG, "Subscribed to command topic: %s", s_cmd_topic);

            // 3. Flush any offline telemetry records
            mqtt_client_service_flush_offline_buffer();
            break;

        case MQTT_EVENT_DISCONNECTED:
            s_connected = false;
            ESP_LOGW(TAG, "Disconnected from Mosquitto MQTT broker");
            break;

        case MQTT_EVENT_DATA:
            handle_inbound_command(event->data, event->data_len);
            break;

        default:
            break;
    }
}

bool mqtt_client_service_init(
    const char *broker_uri,
    const char *device_id,
    const char *username,
    const char *password
)
{
    if (device_id) {
        strncpy(s_device_id, device_id, sizeof(s_device_id) - 1);
        snprintf(s_telemetry_topic, sizeof(s_telemetry_topic), "vayu/%s/telemetry", s_device_id);
        snprintf(s_status_topic, sizeof(s_status_topic), "vayu/%s/status", s_device_id);
        snprintf(s_cmd_topic, sizeof(s_cmd_topic), "vayu/%s/cmd", s_device_id);
    }

    // Configure MQTT Last Will and Testament (LWT)
    snprintf(s_lwt_payload, sizeof(s_lwt_payload),
             "{\"schema_version\":\"%s\",\"device_id\":\"%s\",\"status\":\"OFFLINE\",\"reason\":\"UNEXPECTED_DISCONNECT\"}",
             VAYU_SCHEMA_VERSION, s_device_id);

    esp_mqtt_client_config_t mqtt_cfg = {
        .broker.address.uri = broker_uri ? broker_uri : "mqtt://127.0.0.1:1883",
        .credentials = {
            .username = username ? username : "vayu_device",
            .authentication.password = password ? password : "vayu_device_pass_2026",
        },
        .session.last_will = {
            .topic = s_status_topic,
            .msg = s_lwt_payload,
            .msg_len = strlen(s_lwt_payload),
            .qos = 1,
            .retain = 0,
        },
        .network.reconnect_timeout_ms = 4000,
    };

    s_client = esp_mqtt_client_init(&mqtt_cfg);
    esp_mqtt_client_register_event(s_client, ESP_EVENT_ANY_ID, mqtt_event_handler, NULL);
    esp_mqtt_client_start(s_client);

    return true;
}

bool mqtt_client_service_is_connected(void)
{
    return s_connected;
}

bool mqtt_client_service_publish_telemetry(const char *payload_json)
{
    if (!s_connected || s_client == NULL || payload_json == NULL) {
        return false;
    }
    int msg_id = esp_mqtt_client_publish(s_client, s_telemetry_topic, payload_json, 0, 1, 0);
    return msg_id >= 0;
}

uint16_t mqtt_client_service_flush_offline_buffer(void)
{
    if (!s_connected || s_client == NULL) return 0;

    uint16_t sent = 0;
    vayu_telemetry_item_t item;
    char json_buf[1024];

    while (telemetry_buffer_pop(&item)) {
        int len = telemetry_builder_serialize(s_device_id, &item, json_buf, sizeof(json_buf));
        if (len > 0) {
            esp_mqtt_client_publish(s_client, s_telemetry_topic, json_buf, 0, 1, 0);
            sent++;
        }
    }

    if (sent > 0) {
        ESP_LOGI(TAG, "Flushed %u buffered offline telemetry records to broker", sent);
    }
    return sent;
}

void mqtt_client_service_send_clean_disconnect(void)
{
    if (s_connected && s_client != NULL) {
        char clean_offline[256];
        snprintf(clean_offline, sizeof(clean_offline),
                 "{\"schema_version\":\"%s\",\"device_id\":\"%s\",\"status\":\"OFFLINE\",\"reason\":\"CLEAN_SHUTDOWN\"}",
                 VAYU_SCHEMA_VERSION, s_device_id);
        esp_mqtt_client_publish(s_client, s_status_topic, clean_offline, 0, 1, 0);
    }
}

#else /* VAYU_TEST_HOST */

static bool s_mock_connected = true;
static int s_mock_published_count = 0;

bool mqtt_client_service_init(const char *broker_uri, const char *device_id, const char *username, const char *password) {
    (void)broker_uri; (void)username; (void)password;
    if (device_id) strncpy(s_device_id, device_id, sizeof(s_device_id) - 1);
    snprintf(s_telemetry_topic, sizeof(s_telemetry_topic), "vayu/%s/telemetry", s_device_id);
    snprintf(s_status_topic, sizeof(s_status_topic), "vayu/%s/status", s_device_id);
    snprintf(s_cmd_topic, sizeof(s_cmd_topic), "vayu/%s/cmd", s_device_id);
    return true;
}
bool mqtt_client_service_is_connected(void) { return s_mock_connected; }
bool mqtt_client_service_publish_telemetry(const char *payload_json) {
    (void)payload_json;
    if (!s_mock_connected) return false;
    s_mock_published_count++;
    return true;
}
uint16_t mqtt_client_service_flush_offline_buffer(void) {
    if (!s_mock_connected) return 0;
    uint16_t sent = 0;
    vayu_telemetry_item_t item;
    while (telemetry_buffer_pop(&item)) {
        sent++;
        s_mock_published_count++;
    }
    return sent;
}
void mqtt_client_service_send_clean_disconnect(void) { s_mock_connected = false; }
void mqtt_client_service_mock_set(bool connected) { s_mock_connected = connected; }
int mqtt_client_service_mock_get_published(void) { return s_mock_published_count; }

#endif
