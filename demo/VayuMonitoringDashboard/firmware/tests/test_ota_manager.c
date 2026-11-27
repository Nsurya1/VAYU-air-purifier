/**
 * @file test_ota_manager.c
 * @brief Unit Tests for Two-Partition OTA & Rollback Engine
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include "../esp32-vayu-node/main/ota/ota_manager.h"

#define ANSI_RED    "\033[31m"
#define ANSI_RESET  "\033[0m"

static int s_tests_run = 0;
static int s_tests_passed = 0;

#define TEST_ASSERT(cond, msg) do { \
    s_tests_run++; \
    if (cond) { \
        s_tests_passed++; \
        printf("  [PASS] %s\n", msg); \
    } else { \
        printf("  " ANSI_RED "[FAIL] %s (Line %d)" ANSI_RESET "\n", msg, __LINE__); \
    } \
} while (0)

void test_ota_image_validation(void)
{
    printf("\n[*] Testing OTA Header & Cryptographic SHA-256 Validation...\n");

    const char *valid_sha = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const char *bad_sha   = "1111111111111111111111111111111111111111111111111111111111111111";

    bool ok = ota_manager_validate_image_header(valid_sha, valid_sha, "REV-B-ESP32");
    TEST_ASSERT(ok == true, "Matching SHA-256 and target hardware accepted");

    bool bad_digest = ota_manager_validate_image_header(valid_sha, bad_sha, "REV-B-ESP32");
    TEST_ASSERT(bad_digest == false, "Mismatched SHA-256 digest rejected");

    bool bad_hw = ota_manager_validate_image_header(valid_sha, valid_sha, "REV-C-ESP32-S3");
    TEST_ASSERT(bad_hw == false, "Incompatible hardware revision rejected (prevents bricking)");
}

void test_ota_diagnostic_trial_and_confirmation(void)
{
    printf("\n[*] Testing Post-Flash Trial Verification & Rollback Cancellation...\n");

    extern void ota_manager_mock_switch_to_pending(const char *new_version);
    ota_manager_mock_switch_to_pending("v1.1.0-rc1");

    vayu_ota_info_t info;
    ota_manager_get_info(&info);
    TEST_ASSERT(strcmp(info.active_slot, "ota_1") == 0, "Booted from trial slot ota_1");
    TEST_ASSERT(info.state == OTA_STATE_PENDING_VERIFY, "Partition state is PENDING_VERIFY");

    // Diagnostic health check passes
    bool confirmed = ota_manager_confirm_valid_cancel_rollback();
    TEST_ASSERT(confirmed == true, "Self-test passed: cancel rollback confirmed");

    ota_manager_get_info(&info);
    TEST_ASSERT(info.state == OTA_STATE_VALIDATED, "Partition permanently marked VALIDATED");
}

void test_ota_diagnostic_failure_and_rollback(void)
{
    printf("\n[*] Testing Post-Flash Fault Detection & Automatic Rollback...\n");

    extern void ota_manager_mock_switch_to_pending(const char *new_version);
    ota_manager_mock_switch_to_pending("v1.1.0-rc2");

    vayu_ota_info_t info;
    ota_manager_get_info(&info);
    TEST_ASSERT(strcmp(info.active_slot, "ota_1") == 0, "Trial running on ota_1");

    // Impeller stall or crash detected during trial
    ota_manager_trigger_rollback("Tachometer reports 0 RPM stall on trial boot");

    ota_manager_get_info(&info);
    TEST_ASSERT(info.state == OTA_STATE_ROLLED_BACK, "State transitions to ROLLED_BACK");
    TEST_ASSERT(strcmp(info.active_slot, "ota_0") == 0, "Active partition safely reverted to previous stable slot ota_0");
}

int main(void)
{
    printf("==================================================================\n");
    printf("   SOCHI VAYU - Two-Partition OTA & Rollback Engine Unit Tests    \n");
    printf("==================================================================\n");

    test_ota_image_validation();
    test_ota_diagnostic_trial_and_confirmation();
    test_ota_diagnostic_failure_and_rollback();

    printf("\n------------------------------------------------------------------\n");
    printf("Test Results: %d / %d tests PASSED (%d%%)\n",
           s_tests_passed, s_tests_run, (s_tests_passed * 100) / (s_tests_run > 0 ? s_tests_run : 1));
    printf("==================================================================\n");

    return (s_tests_passed == s_tests_run) ? 0 : 1;
}
