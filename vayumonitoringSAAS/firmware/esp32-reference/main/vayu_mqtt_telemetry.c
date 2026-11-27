#include "vayu_mqtt_telemetry.h"
#include "mqtt_client.h"
#include "esp_log.h"
#include "cJSON.h"
#include <stdio.h>
#include <string.h>
#include <time.h>

static const char *TAG = "VAYU_MQTT";

static esp_mqtt_client_handle_t s_mqtt_client = NULL;
static bool s_is_connected = false;
static vayu_mqtt_config_t s_config = {0};

static char s_telemetry_topic[128] = {0};
static char s_status_topic[128] = {0};
static char s_lwt_payload[256] = {0};

static void get_iso8601_timestamp(char *buf, size_t max_len) {
    time_t now = time(NULL);
    struct tm timeinfo;
    gmtime_r(&now, &timeinfo);
    strftime(buf, max_len, "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
}

static void mqtt_event_handler(void *handler_args, esp_event_base_t base, int32_t event_id, void *event_data) {
    esp_mqtt_event_handle_t event = (esp_mqtt_event_handle_t)event_data;
    switch ((esp_mqtt_event_id_t)event_id) {
        case MQTT_EVENT_CONNECTED:
            ESP_LOGI(TAG, "Connected to Mosquitto MQTT broker successfully.");
            s_is_connected = true;
            vayu_mqtt_publish_birth();
            break;
        case MQTT_EVENT_DISCONNECTED:
            ESP_LOGW(TAG, "Disconnected from MQTT broker. Underlying client will auto-reconnect.");
            s_is_connected = false;
            break;
        case MQTT_EVENT_ERROR:
            ESP_LOGE(TAG, "MQTT transport error encountered.");
            break;
        default:
            break;
    }
}

esp_err_t vayu_mqtt_init(const vayu_mqtt_config_t *config) {
    if (!config || !config->broker_uri || !config->device_id) {
        return ESP_ERR_INVALID_ARG;
    }

    s_config = *config;

    snprintf(s_telemetry_topic, sizeof(s_telemetry_topic), "vayu/devices/%s/telemetry", s_config.device_id);
    snprintf(s_status_topic, sizeof(s_status_topic), "vayu/devices/%s/status", s_config.device_id);

    char timestamp[32];
    get_iso8601_timestamp(timestamp, sizeof(timestamp));

    // Prepare Last Will and Testament (LWT) Payload
    cJSON *lwt_json = cJSON_CreateObject();
    cJSON_AddStringToObject(lwt_json, "schema_version", VAYU_SCHEMA_VERSION);
    cJSON_AddStringToObject(lwt_json, "device_id", s_config.device_id);
    cJSON_AddStringToObject(lwt_json, "status", "OFFLINE");
    cJSON_AddStringToObject(lwt_json, "timestamp", timestamp);
    cJSON_AddStringToObject(lwt_json, "reason", "UNEXPECTED_DISCONNECT");
    cJSON_AddBoolToObject(lwt_json, "is_simulated", false);

    char *rendered_lwt = cJSON_PrintUnformatted(lwt_json);
    strncpy(s_lwt_payload, rendered_lwt, sizeof(s_lwt_payload) - 1);
    cJSON_free(rendered_lwt);
    cJSON_Delete(lwt_json);

    esp_mqtt_client_config_t mqtt_cfg = {
        .broker = {
            .address = {
                .uri = s_config.broker_uri,
            },
        },
        .credentials = {
            .username = s_config.username,
            .authentication = {
                .password = s_config.password,
            },
            .client_id = s_config.device_id,
        },
        .session = {
            .last_will = {
                .topic = s_status_topic,
                .msg = s_lwt_payload,
                .msg_len = strlen(s_lwt_payload),
                .qos = 1,
                .retain = 0,
            },
            .keepalive = 15,
        },
        .network = {
            .reconnect_timeout_ms = 5000,
            .timeout_ms = 10000,
        },
    };

    s_mqtt_client = esp_mqtt_client_init(&mqtt_cfg);
    if (!s_mqtt_client) {
        ESP_LOGE(TAG, "Failed to initialize ESP-MQTT client.");
        return ESP_FAIL;
    }

    esp_mqtt_client_register_event(s_mqtt_client, ESP_EVENT_ANY_ID, mqtt_event_handler, NULL);
    return esp_mqtt_client_start(s_mqtt_client);
}

bool vayu_mqtt_is_connected(void) {
    return s_is_connected;
}

esp_err_t vayu_mqtt_publish_birth(void) {
    if (!s_mqtt_client || !s_is_connected) {
        return ESP_ERR_INVALID_STATE;
    }

    char timestamp[32];
    get_iso8601_timestamp(timestamp, sizeof(timestamp));

    cJSON *root = cJSON_CreateObject();
    cJSON_AddStringToObject(root, "schema_version", VAYU_SCHEMA_VERSION);
    cJSON_AddStringToObject(root, "device_id", s_config.device_id);
    cJSON_AddStringToObject(root, "status", "ONLINE");
    cJSON_AddStringToObject(root, "timestamp", timestamp);
    if (s_config.room) {
        cJSON_AddStringToObject(root, "room", s_config.room);
    }
    cJSON_AddBoolToObject(root, "is_simulated", false);

    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    int msg_id = esp_mqtt_client_publish(s_mqtt_client, s_status_topic, json_str, strlen(json_str), 1, 0);
    cJSON_free(json_str);

    if (msg_id < 0) {
        ESP_LOGW(TAG, "Failed to publish birth status message.");
        return ESP_FAIL;
    }

    ESP_LOGI(TAG, "Published birth ONLINE announcement to %s", s_status_topic);
    return ESP_OK;
}

esp_err_t vayu_mqtt_publish_telemetry(const vayu_purifier_state_t *state) {
    if (!s_mqtt_client || !s_is_connected || !state) {
        return ESP_ERR_INVALID_STATE;
    }

    char timestamp[32];
    get_iso8601_timestamp(timestamp, sizeof(timestamp));

    cJSON *root = cJSON_CreateObject();
    cJSON_AddStringToObject(root, "schema_version", VAYU_SCHEMA_VERSION);
    cJSON_AddStringToObject(root, "device_id", state->device_id);
    cJSON_AddStringToObject(root, "timestamp", timestamp);

    // Metrics object
    cJSON *metrics = cJSON_CreateObject();
    if (state->diagnostics.pm_sensor_valid) {
        cJSON_AddNumberToObject(metrics, "pm1", state->metrics.pm1);
        cJSON_AddNumberToObject(metrics, "pm25", state->metrics.pm25);
        cJSON_AddNumberToObject(metrics, "pm10", state->metrics.pm10);
    } else {
        // Strictly serialize explicit nulls when sensor is in fault state
        cJSON_AddNullToObject(metrics, "pm1");
        cJSON_AddNullToObject(metrics, "pm25");
        cJSON_AddNullToObject(metrics, "pm10");
    }

    if (state->diagnostics.voc_sensor_valid) {
        cJSON_AddNumberToObject(metrics, "voc_index", state->metrics.voc_index);
    } else {
        cJSON_AddNullToObject(metrics, "voc_index");
    }

    if (state->diagnostics.temperature_sensor_valid) {
        cJSON_AddNumberToObject(metrics, "temperature_c", state->metrics.temperature_c);
        cJSON_AddNumberToObject(metrics, "humidity_rh", state->metrics.humidity_rh);
    } else {
        cJSON_AddNullToObject(metrics, "temperature_c");
        cJSON_AddNullToObject(metrics, "humidity_rh");
    }
    cJSON_AddItemToObject(root, "metrics", metrics);

    // Diagnostics object
    cJSON *diag = cJSON_CreateObject();
    cJSON_AddBoolToObject(diag, "pm_sensor_valid", state->diagnostics.pm_sensor_valid);
    cJSON_AddBoolToObject(diag, "temperature_sensor_valid", state->diagnostics.temperature_sensor_valid);
    cJSON_AddBoolToObject(diag, "voc_sensor_valid", state->diagnostics.voc_sensor_valid);
    cJSON_AddItemToObject(root, "diagnostics", diag);

    // System object
    cJSON *sys = cJSON_CreateObject();
    cJSON_AddStringToObject(sys, "firmware_version", state->firmware_version);
    cJSON_AddNumberToObject(sys, "error_code", (int)state->error_code);
    const char *mode_str = "AUTO";
    switch (state->mode) {
        case VAYU_MODE_MANUAL: mode_str = "MANUAL"; break;
        case VAYU_MODE_SLEEP:  mode_str = "SLEEP";  break;
        case VAYU_MODE_TURBO:  mode_str = "TURBO";  break;
        default:               mode_str = "AUTO";   break;
    }
    cJSON_AddStringToObject(sys, "operating_mode", mode_str);
    cJSON_AddItemToObject(root, "system", sys);

    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    int msg_id = esp_mqtt_client_publish(s_mqtt_client, s_telemetry_topic, json_str, strlen(json_str), 1, 0);
    cJSON_free(json_str);

    if (msg_id < 0) {
        ESP_LOGW(TAG, "Failed to publish telemetry to %s", s_telemetry_topic);
        return ESP_FAIL;
    }

    ESP_LOGD(TAG, "Published telemetry packet to %s [msg_id=%d]", s_telemetry_topic, msg_id);
    return ESP_OK;
}

esp_err_t vayu_mqtt_stop(void) {
    if (s_mqtt_client) {
        esp_mqtt_client_stop(s_mqtt_client);
        esp_mqtt_client_destroy(s_mqtt_client);
        s_mqtt_client = NULL;
        s_is_connected = false;
    }
    return ESP_OK;
}
