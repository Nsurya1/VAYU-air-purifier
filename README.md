# SOCHI VAYU: Smart Air Quality Monitor & Purifier

[![VAYU](vayu_logo.png)](https://github.com/Nsurya1/VAYU-air-purifier)

[![Live Web Dashboard](https://img.shields.io/badge/Live%20Web%20Dashboard-vayumonitoring.netlify.app-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)](https://vayumonitoring.netlify.app/)
[![GitHub Repo](https://img.shields.io/badge/GitHub-VAYU--air--purifier-181717?style=for-the-badge&logo=github)](https://github.com/Nsurya1/VAYU-air-purifier)
[![Firmware](https://img.shields.io/badge/ESP32--S3-Dual--Core%20240MHz-E7352C?style=for-the-badge&logo=espressif&logoColor=white)](https://github.com/Nsurya1/VAYU-air-purifier)

> 🌐 **Live Web Monitor & Cloud Telemetry:** [https://vayumonitoring.netlify.app/](https://vayumonitoring.netlify.app/)

---

## 📁 Repository Structure

This repository contains the core software and firmware stack for the **VAYU Air Monitor & Purifier**:

```
.
├── index.html                           # 🌐 VAYU Live Web Dashboard (WebSerial + Netlify)
├── vayu_logo.png                        # Official VAYU branding logo
├── netlify.toml                         # Netlify deployment configuration
├── _redirects                           # Web routing rules
├── .gitignore                           # Git ignore rules
├── README.md                            # Complete setup & flashing guide
│
└── vayucode/
    ├── ESP32_Test/                      # ⚡ ESP32 Firmware for Testing (WebSerial & Wi-Fi)
    │   ├── platformio.ini               # PlatformIO build configuration
    │   └── src/
    │       └── main.cpp                 # UART hex polling engine & serial streamer
    │
    ├── SOCHI_VAYU_Screen_UI/            # 🖥️ Final Standalone LVGL Code (No laptop required!)
    │   ├── SOCHI_VAYU_Screen_UI.ino     # LovyanGFX + LVGL 8.3.11 screen driver
    │   └── README_SETUP_GUIDE.md        # Arduino IDE & library setup instructions
    │
    └── Future_Display_Code/             # 📱 Alternative SPI TFT Display Implementation
        ├── display_dashboard.cpp        # TFT_eSPI rendering engine
        └── DISPLAY_SETUP_GUIDE.md       # Display wiring & setup guide
```

---

## 1. 🌐 VAYU Live Web Dashboard (`index.html`)

An industrial zero-driver dashboard for real-time monitoring and sensor diagnostics.

* **Live Deployment:** [https://vayumonitoring.netlify.app/](https://vayumonitoring.netlify.app/)
* **Zero Software Setup:** Connect directly to your ESP32-S3 over USB-C via the browser's native **WebSerial API** (115200 Baud).
* **Cross-Platform:** Works on Google Chrome, Microsoft Edge, Opera, and Brave on Windows, macOS, Linux, and Android.
* **Features:**
  - Real-time AQI ring gauge and 6-parameter summary cards (CO2, PM2.5, PM10, VOC, Temperature, Humidity).
  - Multi-wave air quality trends and dual-split live telemetry logs.
  - Zero-scroll layout optimized for both desktop and 7-inch embedded kiosks.
  - Persistent SOCHI orange brand footer (`#f97316`).

---

## 2. ⚡ ESP32 Testing Firmware (`vayucode/ESP32_Test/`)

Firmware for hardware verification, bench testing, and USB-C serial streaming to the web dashboard.

* **Toolchain:** PlatformIO / VS Code.
* **Microcontroller:** ESP32-S3 Dual-Core (240MHz).
* **Sensor Module:** CUBIC AM1008W (5-in-1 NDIR CO2 + Laser PM2.5 + MOX VOC).
* **Hardware Wiring:**
  - Sensor TX $\rightarrow$ ESP32 **GPIO 18** (RX1)
  - Sensor RX $\rightarrow$ ESP32 **GPIO 17** (TX1)
  - Sensor 5V $\rightarrow$ ESP32 **5V / VBUS**
  - Sensor GND $\rightarrow$ ESP32 **GND**
* **How It Works:**
  - Actively polls the sensor using hex command `11 02 01 00 EC` with checksum validation.
  - Streams clean JSON telemetry over Serial (115200 Baud) to `index.html`.
  - Automatically hosts an access point `VAYU_AIR_DASHBOARD` (`192.168.4.1`) for local Wi-Fi telemetry.

---

## 3. 🖥️ Final ESP32 LVGL Standalone Display Code (`vayucode/SOCHI_VAYU_Screen_UI/`)

**Runs 100% independently on the device with zero dependency on a laptop or external PC!**

* **Toolchain:** Arduino IDE.
* **Display & Touch:** ST7796S 480x320 SPI LCD + FT6336U Capacitive Touch.
* **Graphics Framework:** **LovyanGFX** + **LVGL v8.3.11** with PSRAM double-buffering.
* **Key Features:**
  - Full standalone touch UI rendered directly on the physical screen.
  - Independent UART sensor polling on Core 1 while LVGL renders smoothly on Core 0.
  - Complete instructions and library setup in `vayucode/SOCHI_VAYU_Screen_UI/README_SETUP_GUIDE.md`.

---

## 🛡️ Attribution & License

Designed and developed by **SOCHI** for the **VAYU Smart Air Quality Platform**.
