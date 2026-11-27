#include <Arduino.h>
#include <TFT_eSPI.h> // Highly optimized TFT driver for ESP32
#include <SPI.h>

// ============================================================================
// SOCHI VAYU - HARDWARE SPI DISPLAY + AM1008W SENSOR
// For ST7789 or ILI9341 320x240 Color TFT LCD Display
// ============================================================================

// --- HARDWARE CONNECTIONS ---
// 1. AM1008W Sensor:
//    - Sensor TX -> ESP32 Pin 18 (RX1)
//    - Sensor RX -> ESP32 Pin 17 (TX1)
//    - Sensor 5V -> ESP32 5V (VBUS)
//    - Sensor GND -> ESP32 GND
//
// 2. ST7789 / ILI9341 SPI Display:
//    - VCC -> 3.3V
//    - GND -> GND
//    - SCL / SCK -> Pin 12
//    - SDA / MOSI -> Pin 11
//    - RES / RST -> Pin 10
//    - DC -> Pin 9
//    - CS -> Pin 14
//    - BLK (Backlight) -> 3.3V
#define SENSOR_RX_PIN 18
#define SENSOR_TX_PIN 17

TFT_eSPI tft = TFT_eSPI(); 

const uint8_t AM1008W_QUERY_CMD[5] = { 0x11, 0x02, 0x01, 0x00, 0xEC };
uint8_t rx_buf[64];
int rx_len = 0;
unsigned long last_poll = 0;
unsigned long last_screen_refresh = 0;

uint16_t current_co2 = 650;
uint16_t current_pm25 = 12;
float current_temp = 24.5;
float current_hum = 52.0;
uint16_t current_voc = 40;

// Draw a modern rounded card on the LCD screen
void drawCard(int x, int y, int w, int h, const char* title, uint16_t valColor, const char* valueStr) {
    tft.fillRoundRect(x, y, w, h, 6, 0x2104); // Dark charcoal background
    tft.drawRoundRect(x, y, w, h, 6, 0x39E7); // Subtle border
    
    // Title
    tft.setTextColor(0x9CD3, 0x2104); // Muted gray
    tft.setTextSize(1);
    tft.drawString(title, x + 10, y + 8);
    
    // Value
    tft.setTextColor(valColor, 0x2104);
    tft.setTextSize(2);
    tft.drawString(valueStr, x + 10, y + 25);
}

void initDashboardUI() {
    tft.fillScreen(0x10A2); // Deep dark blue-black background
    
    // Header Bar
    tft.fillRect(0, 0, 320, 30, 0x1C7F); // Bright Blue Header
    tft.setTextColor(TFT_WHITE, 0x1C7F);
    tft.setTextSize(2);
    tft.drawString("AIR QUALITY MONITOR", 35, 7);
}

void updateDashboardUI() {
    char buf[32];

    // Card 1: CO2 (Amber)
    snprintf(buf, sizeof(buf), "%d ppm", current_co2);
    drawCard(10, 40, 145, 55, "CO2", 0xFD60, buf);

    // Card 2: PM 2.5 (Green)
    snprintf(buf, sizeof(buf), "%d ug/m3", current_pm25);
    drawCard(165, 40, 145, 55, "PM 2.5", 0x24C6, buf);

    // Card 3: Temperature (Red)
    snprintf(buf, sizeof(buf), "%.1f C", current_temp);
    drawCard(10, 105, 145, 55, "TEMPERATURE", 0xF246, buf);

    // Card 4: Humidity (Cyan)
    snprintf(buf, sizeof(buf), "%.1f %%", current_hum);
    drawCard(165, 105, 145, 55, "HUMIDITY", 0x2DDD, buf);

    // Wide Card 5: VOC (Purple)
    tft.fillRoundRect(10, 170, 300, 50, 6, 0x2104);
    tft.drawRoundRect(10, 170, 300, 50, 6, 0x39E7);
    tft.setTextColor(0x9CD3, 0x2104);
    tft.setTextSize(1);
    tft.drawString("VOC LEVEL (AIR QUALITY INDEX)", 20, 180);
    snprintf(buf, sizeof(buf), "%d Index", current_voc);
    tft.setTextColor(0xA9FD, 0x2104);
    tft.setTextSize(2);
    tft.drawString(buf, 20, 195);
}

void setup() {
    Serial.begin(115200);
    Serial1.begin(9600, SERIAL_8N1, SENSOR_RX_PIN, SENSOR_TX_PIN);

    // Initialize TFT LCD
    tft.init();
    tft.setRotation(1); // Landscape 320x240
    initDashboardUI();
    updateDashboardUI();
}

void loop() {
    // 1. Poll sensor every 1.5s
    if (millis() - last_poll > 1500) {
        Serial1.write(AM1008W_QUERY_CMD, 5);
        last_poll = millis();
    }

    // 2. Read sensor bytes
    while (Serial1.available()) {
        uint8_t b = Serial1.read();
        if (rx_len == 0 && b != 0x16) continue;
        rx_buf[rx_len++] = b;

        if (rx_len >= 14) {
            current_co2  = (rx_buf[3] << 8) | rx_buf[4];
            current_pm25 = (rx_buf[5] << 8) | rx_buf[6];
            current_temp = ((rx_buf[7] << 8) | rx_buf[8]) / 10.0f;
            current_hum  = ((rx_buf[9] << 8) | rx_buf[10]) / 10.0f;
            current_voc  = (rx_buf[11] << 8) | rx_buf[12];
            rx_len = 0;
        }
    }

    // 3. Refresh screen every 1s
    if (millis() - last_screen_refresh > 1000) {
        updateDashboardUI();
        last_screen_refresh = millis();
    }
}
