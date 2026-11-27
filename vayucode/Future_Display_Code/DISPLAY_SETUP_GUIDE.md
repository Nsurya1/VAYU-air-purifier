# Future Hardware Display Guide: Adding an LCD Screen to ESP32-S3

This guide provides everything you need to connect a physical color display to your ESP32-S3 in the future.

---

## 1. Recommended Screen to Purchase
- **Model**: **ST7789 2.0-inch 320x240 IPS Color LCD Module** (or **ILI9341 2.8-inch SPI TFT**)
- **Interface**: 4-Wire SPI (requires only 6 wires)
- **Why**: High contrast IPS colors, wide viewing angle, and native 320x240 resolution matching the UI layout.

---

## 2. Pin Wiring Diagram

| Screen Pin | ESP32-S3 Pin | Function / Description |
| :--- | :--- | :--- |
| **VCC** | **3.3V** or **5V** | Power supply (matches module spec) |
| **GND** | **GND** | Ground |
| **SCL / SCK** | **GPIO 12** | SPI Bus Clock |
| **SDA / MOSI**| **GPIO 11** | SPI Data Out |
| **RES / RST** | **GPIO 10** | Hardware Reset |
| **DC** | **GPIO 9** | Data / Command Selection |
| **CS** | **GPIO 14** | Chip Select |
| **BLK / LED** | **3.3V** | Backlight ON |

*(Note: Sensor stays connected to Pin 18 (TX) and Pin 17 (RX). Pins 11, 12, 10, 9, 14 leave plenty of room without any pin conflict!)*

---

## 3. How to Activate When Screen Arrives
1. Add `bodmer/TFT_eSPI` library to your `platformio.ini`.
2. Copy `display_dashboard.cpp` into your `src/main.cpp`.
3. Upload to the ESP32.
4. The screen will immediately boot with the custom dark theme, rounded cards, and live sensor readings!
