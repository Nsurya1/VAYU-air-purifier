/**
 * @file telemetry_builder.c
 * @brief SOCHI VAYU - Telemetry Payload JSON Serializer Implementation
 */

#include "telemetry_builder.h"
#include "board_config.h"
#include <stdio.h>
#include <string.h>
#include <time.h>

void telemetry_builder_format_iso8601(int64_t timestamp_ms, char *out_iso, size_t max_len)
{
    time_t raw_sec = (time_t)(timestamp_ms / 1000);
    struct tm gm_time;
#if defined(_WIN32)
    gmtime_s(&gm_time, &raw_sec);
#elif defined(__unix__) || defined(__linux__) || defined(__APPLE__) || !defined(VAYU_TEST_HOST)
    gmtime_r(&raw_sec, &gm_time);
#else
    struct tm *tmp = gmtime(&raw_sec);
    if (tmp) gm_time = *tmp;
#endif

    snprintf(out_iso, max_len, "%04d-%02d-%02dT%02d:%02d:%02dZ",
             gm_time.tm_year + 1900,
             gm_time.tm_mon + 1,
             gm_time.tm_mday,
             gm_time.tm_hour,
             gm_time.tm_min,
             gm_time.tm_sec);
}

static const char *get_mode_string(vayu_mode_t mode)
{
    switch (mode) {
        case VAYU_MODE_AUTO:   return "AUTO";
        case VAYU_MODE_MANUAL: return "MANUAL";
        case VAYU_MODE_BOOST:  return "BOOST";
        case VAYU_MODE_SLEEP:  return "SLEEP";
        default:               return "AUTO";
    }
}

int telemetry_builder_serialize(
    const char *device_id,
    const vayu_telemetry_item_t *item,
    char *out_buf,
    size_t buf_size
)
{
    if (device_id == NULL || item == NULL || out_buf == NULL || buf_size < 256) {
        return -1;
    }

    char iso_time[32];
    telemetry_builder_format_iso8601(item->timestamp_ms, iso_time, sizeof(iso_time));

    // Format PM metrics string (null if pm_valid is false)
    char pm1_str[16], pm25_str[16], pm10_str[16], aqi_str[16];
    if (item->sensors.pm_valid) {
        snprintf(pm1_str, sizeof(pm1_str), "%.1f", item->sensors.pm1);
        snprintf(pm25_str, sizeof(pm25_str), "%.1f", item->sensors.pm25);
        snprintf(pm10_str, sizeof(pm10_str), "%.1f", item->sensors.pm10);
        snprintf(aqi_str, sizeof(aqi_str), "%u", item->aqi);
    } else {
        snprintf(pm1_str, sizeof(pm1_str), "null");
        snprintf(pm25_str, sizeof(pm25_str), "null");
        snprintf(pm10_str, sizeof(pm10_str), "null");
        snprintf(aqi_str, sizeof(aqi_str), "null");
    }

    // Format Environmental metrics string (null if temp_rh_valid is false)
    char temp_str[16], rh_str[16];
    if (item->sensors.temp_rh_valid) {
        snprintf(temp_str, sizeof(temp_str), "%.1f", item->sensors.temp_c);
        snprintf(rh_str, sizeof(rh_str), "%.1f", item->sensors.rh);
    } else {
        snprintf(temp_str, sizeof(temp_str), "null");
        snprintf(rh_str, sizeof(rh_str), "null");
    }

    char voc_str[16];
    if (item->sensors.voc_valid) {
        snprintf(voc_str, sizeof(voc_str), "%d", item->sensors.voc);
    } else {
        snprintf(voc_str, sizeof(voc_str), "null");
    }

    int written = snprintf(
        out_buf,
        buf_size,
        "{"
          "\"schema_version\":\"%s\","
          "\"device_id\":\"%s\","
          "\"timestamp\":\"%s\","
          "\"is_simulated\":false,"
          "\"metrics\":{"
            "\"pm1\":%s,"
            "\"pm25\":%s,"
            "\"pm10\":%s,"
            "\"voc\":%s,"
            "\"temp_c\":%s,"
            "\"rh\":%s,"
            "\"aqi\":%s,"
            "\"aqi_standard\":\"US-EPA\","
            "\"fan_pct\":%u,"
            "\"mode\":\"%s\","
            "\"filter_hours_left\":%u,"
            "\"rssi\":%d"
          "},"
          "\"diagnostics\":{"
            "\"fw_build_id\":\"%s\","
            "\"uptime_seconds\":%u,"
            "\"err_code\":%u,"
            "\"sensor_status\":{"
              "\"pm_valid\":%s,"
              "\"voc_valid\":%s,"
              "\"temp_rh_valid\":%s"
            "}"
          "}"
        "}",
        VAYU_SCHEMA_VERSION,
        device_id,
        iso_time,
        pm1_str,
        pm25_str,
        pm10_str,
        voc_str,
        temp_str,
        rh_str,
        aqi_str,
        item->fan_pct,
        get_mode_string(item->mode),
        (unsigned int)item->filter_hours_left,
        item->rssi,
        VAYU_FW_VERSION,
        (unsigned int)item->uptime_seconds,
        item->err_code,
        item->sensors.pm_valid ? "true" : "false",
        item->sensors.voc_valid ? "true" : "false",
        item->sensors.temp_rh_valid ? "true" : "false"
    );

    if (written < 0 || (size_t)written >= buf_size) {
        return -1;
    }

    return written;
}
