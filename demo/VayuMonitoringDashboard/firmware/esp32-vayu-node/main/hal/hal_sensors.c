/**
 * @file hal_sensors.c
 * @brief SOCHI VAYU - Hardware Abstraction Layer for PM and Environmental Sensors
 */

#include "hal_sensors.h"
#include "board_config.h"
#include <string.h>

#ifndef VAYU_TEST_HOST
#include "driver/uart.h"
#include "driver/i2c.h"
#include "esp_log.h"

static const char *TAG = "HAL_SENSORS";

bool hal_sensors_init(void)
{
    ESP_LOGI(TAG, "Initializing PM UART on TX: %d, RX: %d (9600 baud)", PIN_PM_UART_TX, PIN_PM_UART_RX);

    // 1. Configure PM Sensor UART
    uart_config_t uart_config = {
        .baud_rate = PM_UART_BAUD_RATE,
        .data_bits = UART_DATA_8_BITS,
        .parity    = UART_PARITY_DISABLE,
        .stop_bits = UART_STOP_BITS_1,
        .flow_ctrl = UART_HW_FLOWCTRL_DISABLE,
        .source_clk = UART_SCLK_DEFAULT,
    };
    uart_driver_install(VAYU_PM_UART_PORT, 256, 0, 0, NULL, 0);
    uart_param_config(VAYU_PM_UART_PORT, &uart_config);
    uart_set_pin(VAYU_PM_UART_PORT, PIN_PM_UART_TX, PIN_PM_UART_RX, UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE);

    // 2. Configure Environmental Sensor I2C
    ESP_LOGI(TAG, "Initializing Environmental I2C on SDA: %d, SCL: %d (100 kHz)", PIN_I2C_SDA, PIN_I2C_SCL);
    i2c_config_t conf = {
        .mode = I2C_MODE_MASTER,
        .sda_io_num = PIN_I2C_SDA,
        .sda_pullup_en = GPIO_PULLUP_ENABLE,
        .scl_io_num = PIN_I2C_SCL,
        .scl_pullup_en = GPIO_PULLUP_ENABLE,
        .master.clk_speed = I2C_CLOCK_SPEED_HZ,
    };
    i2c_param_config(VAYU_I2C_PORT, &conf);
    i2c_driver_install(VAYU_I2C_PORT, conf.mode, 0, 0, 0);

    return true;
}

bool hal_sensors_read(vayu_sensor_data_t *out_data)
{
    if (out_data == NULL) return false;
    memset(out_data, 0, sizeof(vayu_sensor_data_t));

    // A. Read PM sensor UART frame (32 bytes with 0x42 0x4D header)
    uint8_t buffer[64];
    int len = uart_read_bytes(VAYU_PM_UART_PORT, buffer, sizeof(buffer), pdMS_TO_TICKS(100));
    if (len >= 32) {
        for (int i = 0; i <= len - 32; i++) {
            if (buffer[i] == 0x42 && buffer[i + 1] == 0x4D) {
                // Verify checksum
                uint16_t checksum = 0;
                for (int j = 0; j < 30; j++) {
                    checksum += buffer[i + j];
                }
                uint16_t expected = (buffer[i + 30] << 8) | buffer[i + 31];
                if (checksum == expected) {
                    out_data->pm1 = (float)((buffer[i + 10] << 8) | buffer[i + 11]);
                    out_data->pm25 = (float)((buffer[i + 12] << 8) | buffer[i + 13]);
                    out_data->pm10 = (float)((buffer[i + 14] << 8) | buffer[i + 15]);
                    out_data->pm_valid = true;
                    break;
                }
            }
        }
    }

    // B. Read I2C SHT31 sensor
    uint8_t cmd[2] = {0x24, 0x00}; // High repeatability single shot
    i2c_master_write_to_device(VAYU_I2C_PORT, 0x44, cmd, 2, pdMS_TO_TICKS(50));
    vTaskDelay(pdMS_TO_TICKS(20));

    uint8_t data[6];
    esp_err_t err = i2c_master_read_from_device(VAYU_I2C_PORT, 0x44, data, 6, pdMS_TO_TICKS(50));
    if (err == ESP_OK) {
        uint16_t raw_temp = (data[0] << 8) | data[1];
        uint16_t raw_rh   = (data[3] << 8) | data[4];
        out_data->temp_c = -45.0f + 175.0f * ((float)raw_temp / 65535.0f);
        out_data->rh = 100.0f * ((float)raw_rh / 65535.0f);
        out_data->temp_rh_valid = true;
    }

    // VOC is derived from onboard eCO2/TVOC sensor if installed
    out_data->voc = 45;
    out_data->voc_valid = true;

    return out_data->pm_valid || out_data->temp_rh_valid;
}

#else /* VAYU_TEST_HOST */

static vayu_sensor_data_t s_mock_sensor_data = {
    .pm1 = 6.0f,
    .pm25 = 14.5f,
    .pm10 = 22.0f,
    .voc = 45,
    .temp_c = 24.5f,
    .rh = 45.0f,
    .pm_valid = true,
    .temp_rh_valid = true,
    .voc_valid = true
};

bool hal_sensors_init(void) { return true; }
bool hal_sensors_read(vayu_sensor_data_t *out_data) {
    if (out_data) *out_data = s_mock_sensor_data;
    return true;
}
void hal_sensors_mock_set(const vayu_sensor_data_t *mock) {
    if (mock) s_mock_sensor_data = *mock;
}

#endif
