/**
 * @file wifi_manager.h
 * @brief SOCHI VAYU - Wi-Fi Station Manager with Exponential Backoff
 */

#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef void (*wifi_state_cb_t)(bool connected, const char *ip_address);

/**
 * @brief Initialize Wi-Fi station mode with non-volatile configuration.
 * @param ssid Target Wi-Fi SSID.
 * @param password Target Wi-Fi WPA2 pre-shared key.
 * @param on_state_change Optional callback fired when Wi-Fi connects or disconnects.
 * @return true on initialization success, false otherwise.
 */
bool wifi_manager_init(const char *ssid, const char *password, wifi_state_cb_t on_state_change);

/**
 * @brief Check if Wi-Fi station is currently connected and has an assigned IP address.
 * @return true if connected.
 */
bool wifi_manager_is_connected(void);

/**
 * @brief Get the current received signal strength indicator (RSSI).
 * @return RSSI in dBm (-120 to 0), or -127 if disconnected.
 */
int8_t wifi_manager_get_rssi(void);

/**
 * @brief Get assigned IPv4 address string (e.g. "192.168.1.105").
 * @param[out] out_ip Destination buffer (minimum 16 bytes).
 */
void wifi_manager_get_ip(char *out_ip, size_t max_len);

#ifdef __cplusplus
}
#endif

#endif /* WIFI_MANAGER_H */
