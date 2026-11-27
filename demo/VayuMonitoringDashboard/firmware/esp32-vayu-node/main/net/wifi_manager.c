/**
 * @file wifi_manager.c
 * @brief SOCHI VAYU - Wi-Fi Station Manager Implementation
 */

#include "wifi_manager.h"
#include <string.h>

#ifndef VAYU_TEST_HOST
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "WIFI_MGR";
static bool s_connected = false;
static char s_ip_str[16] = "0.0.0.0";
static wifi_state_cb_t s_callback = NULL;
static int s_retry_count = 0;

static void wifi_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data)
{
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        s_connected = false;
        strncpy(s_ip_str, "0.0.0.0", sizeof(s_ip_str));
        s_retry_count++;
        ESP_LOGW(TAG, "Wi-Fi disconnected (retry %d), reconnecting...", s_retry_count);

        if (s_callback) s_callback(false, s_ip_str);

        // Exponential backoff delay up to 15 seconds
        int delay_ms = (s_retry_count < 5) ? (1000 * s_retry_count) : 15000;
        vTaskDelay(pdMS_TO_TICKS(delay_ms));
        esp_wifi_connect();
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t *event = (ip_event_got_ip_t *)event_data;
        esp_ip4addr_ntoa(&event->ip_info.ip, s_ip_str, sizeof(s_ip_str));
        s_connected = true;
        s_retry_count = 0;
        ESP_LOGI(TAG, "Wi-Fi connected! Station IP: %s", s_ip_str);

        if (s_callback) s_callback(true, s_ip_str);
    }
}

bool wifi_manager_init(const char *ssid, const char *password, wifi_state_cb_t on_state_change)
{
    s_callback = on_state_change;
    ESP_LOGI(TAG, "Initializing Wi-Fi station for SSID: '%s'", ssid ? ssid : "VAYU_AIR_NET");

    esp_netif_create_default_wifi_sta();
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    esp_wifi_init(&cfg);

    esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL, NULL);
    esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL, NULL);

    wifi_config_t wifi_config;
    memset(&wifi_config, 0, sizeof(wifi_config));
    if (ssid) strncpy((char *)wifi_config.sta.ssid, ssid, sizeof(wifi_config.sta.ssid) - 1);
    if (password) strncpy((char *)wifi_config.sta.password, password, sizeof(wifi_config.sta.password) - 1);
    wifi_config.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;

    esp_wifi_set_mode(WIFI_MODE_STA);
    esp_wifi_set_config(WIFI_IF_STA, &wifi_config);
    esp_wifi_start();

    return true;
}

bool wifi_manager_is_connected(void)
{
    return s_connected;
}

int8_t wifi_manager_get_rssi(void)
{
    if (!s_connected) return -127;
    wifi_ap_record_t ap_info;
    if (esp_wifi_sta_get_ap_info(&ap_info) == ESP_OK) {
        return ap_info.rssi;
    }
    return -70; // Fallback estimate
}

void wifi_manager_get_ip(char *out_ip, size_t max_len)
{
    if (out_ip) {
        strncpy(out_ip, s_ip_str, max_len);
    }
}

#else /* VAYU_TEST_HOST */

static bool s_mock_connected = true;
static int8_t s_mock_rssi = -62;

bool wifi_manager_init(const char *ssid, const char *password, wifi_state_cb_t on_state_change) {
    (void)ssid; (void)password;
    if (on_state_change) on_state_change(true, "192.168.1.150");
    return true;
}
bool wifi_manager_is_connected(void) { return s_mock_connected; }
int8_t wifi_manager_get_rssi(void) { return s_mock_connected ? s_mock_rssi : -127; }
void wifi_manager_get_ip(char *out_ip, size_t max_len) {
    if (out_ip) strncpy(out_ip, "192.168.1.150", max_len);
}
void wifi_manager_mock_set(bool connected, int8_t rssi) {
    s_mock_connected = connected;
    s_mock_rssi = rssi;
}

#endif
