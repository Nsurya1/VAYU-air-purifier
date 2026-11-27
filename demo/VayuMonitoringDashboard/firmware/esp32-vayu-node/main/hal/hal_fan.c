/**
 * @file hal_fan.c
 * @brief SOCHI VAYU - Hardware Abstraction Layer for 4-Wire PWM Blower & Tachometer
 */

#include "hal_fan.h"
#include "board_config.h"

#ifndef VAYU_TEST_HOST
#include "driver/ledc.h"
#include "driver/gpio.h"
#include "esp_timer.h"
#include "esp_log.h"

static const char *TAG = "HAL_FAN";
static volatile uint32_t s_tach_pulses = 0;
static int64_t s_last_tach_time_us = 0;
static uint8_t s_current_duty = 0;

static void IRAM_ATTR tach_isr_handler(void *arg)
{
    s_tach_pulses++;
}

bool hal_fan_init(void)
{
    ESP_LOGI(TAG, "Initializing Fan PWM on GPIO %d (25 kHz) & Tach on GPIO %d", PIN_FAN_PWM, PIN_FAN_TACH);

    // 1. Configure LEDC Timer
    ledc_timer_config_t timer_conf = {
        .speed_mode = LEDC_LOW_SPEED_MODE,
        .duty_resolution = LEDC_TIMER_10_BIT,
        .timer_num = LEDC_TIMER_0,
        .freq_hz = FAN_PWM_FREQ_HZ,
        .clk_cfg = LEDC_AUTO_CLK
    };
    if (ledc_timer_config(&timer_conf) != ESP_OK) {
        ESP_LOGE(TAG, "Failed to configure LEDC timer");
        return false;
    }

    // 2. Configure LEDC Channel
    ledc_channel_config_t channel_conf = {
        .gpio_num = PIN_FAN_PWM,
        .speed_mode = LEDC_LOW_SPEED_MODE,
        .channel = LEDC_CHANNEL_0,
        .intr_type = LEDC_INTR_DISABLE,
        .timer_sel = LEDC_TIMER_0,
        .duty = 0,
        .hpoint = 0
    };
    if (ledc_channel_config(&channel_conf) != ESP_OK) {
        ESP_LOGE(TAG, "Failed to configure LEDC channel");
        return false;
    }

    // 3. Configure Tachometer GPIO with internal pull-up and interrupt
    gpio_config_t tach_conf = {
        .pin_bit_mask = (1ULL << PIN_FAN_TACH),
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_NEGEDGE
    };
    gpio_config(&tach_conf);
    gpio_install_isr_service(0);
    gpio_isr_handler_add(PIN_FAN_TACH, tach_isr_handler, NULL);

    s_last_tach_time_us = esp_timer_get_time();
    return true;
}

void hal_fan_set_duty(uint8_t duty_pct)
{
    if (duty_pct > 100) duty_pct = 100;
    s_current_duty = duty_pct;

    // Convert 0-100% to 10-bit duty (0-1023)
    uint32_t duty_val = (duty_pct * 1023) / 100;
    ledc_set_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0, duty_val);
    ledc_update_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0);
}

uint8_t hal_fan_get_duty(void)
{
    return s_current_duty;
}

uint16_t hal_fan_get_rpm(void)
{
    int64_t now_us = esp_timer_get_time();
    int64_t dt_us = now_us - s_last_tach_time_us;

    if (dt_us <= 0) return 0;

    uint32_t pulses = s_tach_pulses;
    s_tach_pulses = 0;
    s_last_tach_time_us = now_us;

    // RPM = (pulses * 60,000,000 us) / (FAN_PULSES_PER_REV * dt_us)
    double seconds = (double)dt_us / 1000000.0;
    double rps = (double)pulses / (double)FAN_PULSES_PER_REV / seconds;
    double rpm = rps * 60.0;

    return (uint16_t)rpm;
}

void hal_fan_emergency_stop(void)
{
    ledc_set_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0, 0);
    ledc_update_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0);
    s_current_duty = 0;
}

#else /* VAYU_TEST_HOST (Simulated / Host unit tests) */

static uint8_t s_mock_duty = 0;
static uint16_t s_mock_rpm = 1200;

bool hal_fan_init(void) { return true; }
void hal_fan_set_duty(uint8_t duty_pct) { s_mock_duty = duty_pct; }
uint8_t hal_fan_get_duty(void) { return s_mock_duty; }
uint16_t hal_fan_get_rpm(void) { return (s_mock_duty > 0) ? s_mock_rpm : 0; }
void hal_fan_emergency_stop(void) { s_mock_duty = 0; }
void hal_fan_mock_set_rpm(uint16_t rpm) { s_mock_rpm = rpm; }

#endif
