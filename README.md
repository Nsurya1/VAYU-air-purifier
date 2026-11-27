# SOCHI VAYU: Smart Air Quality & Environmental Telemetry Platform

[![VAYU](vayu_logo.png)](https://github.com/Nsurya1/VAYU-air-purifier)

**SOCHI VAYU** is an industrial-grade smart air quality and environmental telemetry solution combining edge microcontrollers, optical multi-sensor modules, and modern web dashboards.

---

## 🚀 Key Features

- **Industrial Sensing Suite**: CUBIC AM1008W (5-in-1 NDIR/Laser) for physical CO2, PM1.0, PM2.5, PM10, VOC, Temperature, and Humidity.
- **Edge Microcontroller**: ESP32-S3 Dual-Core 240MHz with custom UART master-slave polling (`11 02 01 00 EC`) and checksum validation.
- **Zero-Driver Web Dashboard**: Instant browser streaming via WebSerial API over USB-C (115200 Baud) or standalone Wi-Fi AP (`192.168.4.1`).
- **5 Integrated Monitoring Screens**:
  1. **Primary Air Quality Overview**: Real-time AQI ring gauge, 6-parameter summary cards, multi-wave air quality trends, and status diagnostics.
  2. **Detailed Environmental Trends**: Dedicated trend charts for CO2, PM2.5, Temperature, and VOC.
  3. **Live Telemetry & Diagnostics**: Dual-split high-visibility live telemetry stream and raw sensor registers.
  4. **Device Controls & Calibration**: Zero-calibration, fan boost mode, and buzzer controls.
  5. **Network & System Settings**: Wi-Fi configuration, MQTT broker endpoints, and OTA updates.
- **Persistent SOCHI Branding**: Clean UI layout with vibrant SOCHI orange accent (`#f97316`) and embedded transparent VAYU branding.

---

## 📁 Repository Structure

```
.
├── index.html                           # Main web monitoring dashboard
├── vayu_logo.png                        # Transparent VAYU branding logo
├── SOCHI_VAYU_Project_Presentation.md   # Presentation deck and system architecture
├── SOCHI_VAYU_Presentation.html         # Interactive slide presentation
├── SOCHI_VAYU_Master_Report.pdf         # Master technical report
├── netlify.toml                         # Netlify deployment configuration
├── _redirects                           # Web routing rules
├── vayucode/                            # Embedded firmware and hardware code
│   ├── index.html                       # Synchronized dashboard copy
│   ├── VAYU_Air_Monitor_UI.html         # Local dashboard file
│   ├── Live_Laptop_Dashboard.html       # Laptop serial dashboard
│   ├── ESP32_Test/                      # ESP32-S3 test sketches & firmware
│   ├── SOCHI_VAYU_Screen_UI/            # Screen UI components
│   └── Future_Display_Code/             # Extended display firmware
├── demo/                                # Local monitoring system & microservices
└── vayumonitoringSAAS/                  # Cloud SaaS backend & telemetry simulator
```

---

## 🛠️ Quick Start

### 1. Launch the Live Web Dashboard
Open `index.html` in any Chromium-based browser (Chrome, Edge, Opera, Brave).

1. Click **Connect Device** (or use the WebSerial connect button).
2. Select your ESP32-S3 serial port (115200 baud).
3. Telemetry streams directly in real-time.

### 2. Standalone Wi-Fi Mode
1. Connect your phone or laptop to Wi-Fi SSID: `VAYU_AIR_MONITOR` (Password: `vayu12345`).
2. Open your browser and navigate to `http://192.168.4.1`.

---

## 🛡️ License & Attribution

Designed and developed by **SOCHI** for the **VAYU Air Purifier & Environmental Intelligence Platform**.
