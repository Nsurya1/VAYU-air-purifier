# VAYU — 480x320 SPI + Capacitive Touch Air Quality Dashboard
## Complete Setup Guide for ESP32-S3 (N8R8) + ST7796S + FT6336U + AM1008W

---

### 1. Arduino IDE Libraries Required
Install these exact versions from **Sketch → Include Library → Manage Libraries**:

1. **LovyanGFX** by `lovyan03` (Latest version)
2. **lvgl** by `kisvegabor` — **Install version 8.3.11** *(Do NOT install v9.x, as v9 has breaking API changes)*
3. **RTClib** by `Adafruit` *(Optional)*

---

### 2. Configure `lv_conf.h` (One-Time Step)

1. Open your File Explorer and navigate to:  
   `Documents/Arduino/libraries/lvgl/`
2. Look for the file named `lv_conf_template.h`.
3. Rename it to **`lv_conf.h`**.
4. Open `lv_conf.h` in Notepad or VS Code and change:
   - At Line 15: Change `#if 0` $\rightarrow$ **`#if 1`**
   - At Line 30: Ensure `#define LV_COLOR_16_SWAP 1` is set to **`1`** *(Crucial to prevent inverted red/blue colors on SPI screens)*
5. Ensure these Montserrat fonts are enabled (change `0` to `1`):
   ```c
   #define LV_FONT_MONTSERRAT_10 1
   #define LV_FONT_MONTSERRAT_12 1
   #define LV_FONT_MONTSERRAT_14 1
   #define LV_FONT_MONTSERRAT_16 1
   #define LV_FONT_MONTSERRAT_18 1
   #define LV_FONT_MONTSERRAT_28 1
   ```
6. Save and close `lv_conf.h`.

---

### 3. Arduino IDE Board Settings (Tools Menu)

Select the following in the **Tools** menu for your **ESP32-S3 N8R8** board:
* **Board**: `ESP32S3 Dev Module`
* **Port**: Select the COM port of your ESP32
* **USB CDC On Boot**: `Disabled` *(When uploading via UART USB-C port)*
* **Flash Size**: `8MB (64Mb)`
* **Partition Scheme**: `8MB with spiffs (3MB APP/1.5MB SPIFFS)` or `Huge APP`
* **PSRAM**: `OPI PSRAM` *(Mandatory for N8R8 chips to allocate smooth LVGL framebuffers)*
* **Upload Speed**: `921600` or `460800`

---

### 4. Hardware Pinout Matrix

| Module | Pin Name | ESP32-S3 GPIO | Description |
| :--- | :--- | :--- | :--- |
| **ST7796S Display** | **SCK / SCL** | **GPIO 12** | SPI Clock (40 MHz) |
| | **MOSI / SDA**| **GPIO 11** | SPI Data |
| | **DC / RS** | **GPIO 13** | Data / Command |
| | **CS** | **GPIO 10** | Chip Select |
| | **RST** | **GPIO 14** | Reset |
| | **BL / LED** | **GPIO 21** | Backlight PWM control |
| | **VCC / GND** | **3.3V / GND**| Display Power |
| **FT6336U Touch** | **SDA** | **GPIO 8** | I2C Data |
| | **SCL** | **GPIO 9** | I2C Clock (400 kHz) |
| | **INT** | **GPIO 4** | Touch Interrupt |
| | **RST** | Connect to Display RST or 3.3V | Touch Reset |
| **AM1008W Sensor** | **TX (Yellow/White)**| **GPIO 18** | Sensor Data $\rightarrow$ ESP32 RX1 |
| | **RX (Green/Blue)** | **GPIO 17** | ESP32 TX1 $\rightarrow$ Sensor Poll Command |
| | **5V (Red)** | **5V / VBUS** | Powers NDIR IR optical lamp & fan |
| | **GND (Black)**| **GND** | Ground reference |

---

### 5. UI Features Included in `SOCHI_VAYU_Screen_UI.ino`

1. **Tab 1: Live Monitor**:
   * **Centre Bada Emoji & Status**:
     - 🟢 **Green `:)`** $\rightarrow$ `GOOD AIR` (CO2 < 800 ppm, PM2.5 < 15 µg/m³)
     - 🟠 **Orange `:|`** $\rightarrow$ `MODERATE` (CO2 < 1200 ppm, PM2.5 < 35 µg/m³)
     - 🔴 **Red `:(`** $\rightarrow$ `POOR AIR` (High pollutants alert)
   * **KPI Metric Cards**: Real-time cards for **PM2.5**, **VOC**, **CO2**, and **Temperature/Humidity**.
2. **Tab 2: Data Analytics**:
   * Rolling real-time line trend chart displaying CO2 (Cyan) and PM2.5 (Green) variations over a 60-second window.
3. **Tab 3: Settings**:
   * Capacitive touch **Display Brightness Slider** (controls backlight PWM from 10% to 100%).
   * Hardware diagnostics info (ESP32-S3 240MHz, 8MB PSRAM, AM1008W status).
