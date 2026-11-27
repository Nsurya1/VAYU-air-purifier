/**
 * @file ota_manager.c
 * @brief SOCHI VAYU - Two-Partition OTA & Bootloader Rollback Engine Implementation
 */

#include "ota_manager.h"
#include "board_config.h"
#include <string.h>
#include <stdio.h>

#ifndef VAYU_TEST_HOST
#include "esp_ota_ops.h"
#include "esp_partition.h"
#include "esp_log.h"
#include "esp_system.h"

static const char *TAG = "OTA_MGR";
static vayu_ota_info_t s_info;

void ota_manager_init(void)
{
    memset(&s_info, 0, sizeof(s_info));
    s_info.rollback_supported = true;
    s_info.state = OTA_STATE_IDLE;
    strncpy(s_info.running_version, VAYU_FW_VERSION, sizeof(s_info.running_version) - 1);

    const esp_partition_t *running = esp_ota_get_running_partition();
    const esp_partition_t *next = esp_ota_get_next_update_partition(NULL);

    if (running) {
        strncpy(s_info.active_slot, running->label, sizeof(s_info.active_slot) - 1);
        ESP_LOGI(TAG, "Running from partition: %s (Address: 0x%08" PRIx32 ")", running->label, running->address);
    }
    if (next) {
        strncpy(s_info.next_slot, next->label, sizeof(s_info.next_slot) - 1);
        ESP_LOGI(TAG, "Next update partition: %s (Address: 0x%08" PRIx32 ")", next->label, next->address);
    }

    // Check if this boot is a diagnostic trial verifying new firmware
    esp_ota_img_states_t ota_state;
    if (esp_ota_get_state_partition(running, &ota_state) == ESP_OK) {
        if (ota_state == ESP_OTA_IMG_PENDING_VERIFY) {
            s_info.state = OTA_STATE_PENDING_VERIFY;
            ESP_LOGW(TAG, "Diagnostic trial active: new firmware running in pending verification state!");
        }
    }
}

void ota_manager_get_info(vayu_ota_info_t *out_info)
{
    if (out_info) *out_info = s_info;
}

bool ota_manager_validate_image_header(
    const char *expected_sha256,
    const char *computed_sha256,
    const char *target_hw
)
{
    if (!expected_sha256 || !computed_sha256 || !target_hw) return false;

    // 1. Verify target hardware compatibility
    if (strcasecmp(target_hw, VAYU_HW_REVISION) != 0) {
        ESP_LOGE(TAG, "Hardware mismatch: Image targets '%s', this board is '%s'", target_hw, VAYU_HW_REVISION);
        return false;
    }

    // 2. Cryptographic SHA-256 match
    if (strcasecmp(expected_sha256, computed_sha256) != 0) {
        ESP_LOGE(TAG, "SHA-256 digest mismatch! Expected: %s, Computed: %s", expected_sha256, computed_sha256);
        return false;
    }

    return true;
}

bool ota_manager_confirm_valid_cancel_rollback(void)
{
    esp_err_t err = esp_ota_mark_app_valid_cancel_rollback();
    if (err == ESP_OK) {
        s_info.state = OTA_STATE_VALIDATED;
        ESP_LOGI(TAG, "Firmware successfully validated. Rollback cancelled.");
        return true;
    }
    ESP_LOGE(TAG, "Failed to cancel rollback: %s", esp_err_to_name(err));
    return false;
}

void ota_manager_trigger_rollback(const char *failure_reason)
{
    s_info.state = OTA_STATE_ROLLED_BACK;
    ESP_LOGE(TAG, "[OTA ROLLBACK] Post-flash failure: %s. Reverting to previous partition!", failure_reason);
    esp_ota_mark_app_invalid_rollback_and_reboot();
}

#else /* VAYU_TEST_HOST */

static vayu_ota_info_t s_mock_info = {
    .active_slot = "ota_0",
    .next_slot = "ota_1",
    .running_version = "v1.0.0-prod",
    .state = OTA_STATE_IDLE,
    .rollback_supported = true
};

void ota_manager_init(void) {
    s_mock_info.state = OTA_STATE_IDLE;
}

void ota_manager_get_info(vayu_ota_info_t *out_info) {
    if (out_info) *out_info = s_mock_info;
}

bool ota_manager_validate_image_header(
    const char *expected_sha256,
    const char *computed_sha256,
    const char *target_hw
)
{
    if (!expected_sha256 || !computed_sha256 || !target_hw) return false;
    if (strcasecmp(target_hw, VAYU_HW_REVISION) != 0) return false;
    return (strcasecmp(expected_sha256, computed_sha256) == 0);
}

bool ota_manager_confirm_valid_cancel_rollback(void) {
    s_mock_info.state = OTA_STATE_VALIDATED;
    return true;
}

void ota_manager_trigger_rollback(const char *failure_reason) {
    (void)failure_reason;
    s_mock_info.state = OTA_STATE_ROLLED_BACK;
    // Swap back to previous slot
    if (strcmp(s_mock_info.active_slot, "ota_1") == 0) {
        strcpy(s_mock_info.active_slot, "ota_0");
        strcpy(s_mock_info.next_slot, "ota_1");
    } else {
        strcpy(s_mock_info.active_slot, "ota_1");
        strcpy(s_mock_info.next_slot, "ota_0");
    }
}

void ota_manager_mock_switch_to_pending(const char *new_version) {
    s_mock_info.state = OTA_STATE_PENDING_VERIFY;
    if (new_version) strncpy(s_mock_info.running_version, new_version, sizeof(s_mock_info.running_version) - 1);
    strcpy(s_mock_info.active_slot, "ota_1");
    strcpy(s_mock_info.next_slot, "ota_0");
}

#endif
