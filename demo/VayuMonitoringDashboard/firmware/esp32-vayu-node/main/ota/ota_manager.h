/**
 * @file ota_manager.h
 * @brief SOCHI VAYU - Two-Partition OTA & Bootloader Rollback Engine
 */

#ifndef OTA_MANAGER_H
#define OTA_MANAGER_H

#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    OTA_STATE_IDLE = 0,
    OTA_STATE_DOWNLOADING,
    OTA_STATE_FLASHING,
    OTA_STATE_PENDING_VERIFY,
    OTA_STATE_VALIDATED,
    OTA_STATE_ROLLED_BACK
} vayu_ota_state_t;

typedef struct {
    char active_slot[8];        /*!< "ota_0" or "ota_1" */
    char next_slot[8];          /*!< Non-active target partition */
    char running_version[32];   /*!< Current active firmware version */
    vayu_ota_state_t state;     /*!< Current OTA state machine phase */
    bool rollback_supported;    /*!< True if bootloader otadata partition is present */
} vayu_ota_info_t;

/**
 * @brief Initialize the OTA subsystem and check bootloader partition state.
 */
void ota_manager_init(void);

/**
 * @brief Get partition slot and version information.
 * @param[out] out_info Destination pointer.
 */
void ota_manager_get_info(vayu_ota_info_t *out_info);

/**
 * @brief Validate incoming firmware SHA-256 and target hardware before flashing.
 * @param expected_sha256 Expected 64-char hex SHA-256 digest.
 * @param computed_sha256 Actual digest calculated during download.
 * @param target_hw Target hardware identifier ("REV-B-ESP32").
 * @return true if valid and compatible, false otherwise.
 */
bool ota_manager_validate_image_header(
    const char *expected_sha256,
    const char *computed_sha256,
    const char *target_hw
);

/**
 * @brief Confirm post-flash trial health checks passed.
 * Calls esp_ota_mark_app_valid_cancel_rollback() to make the new partition permanent.
 * @return true on success.
 */
bool ota_manager_confirm_valid_cancel_rollback(void);

/**
 * @brief Trigger an immediate rollback to the previous stable partition.
 * @param failure_reason Diagnostic rationale.
 */
void ota_manager_trigger_rollback(const char *failure_reason);

#ifdef __cplusplus
}
#endif

#endif /* OTA_MANAGER_H */
