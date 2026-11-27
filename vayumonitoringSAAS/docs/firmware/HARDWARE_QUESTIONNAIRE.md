# SOCHI VAYU — Hardware Specification Questionnaire

Before finalizing production firmware for physical VAYU air purifiers, the embedded engineering and manufacturing team must supply the exact hardware parameters listed below.

This prevents assumptions regarding sensor part numbers, pin allocations, electrical ratings, and fan control feedback.

---

## 1. Microcontroller & Board Specifications

| Parameter | Required Specification | Example / Options | SOCHI VAYU Actual Value |
| :--- | :--- | :--- | :--- |
| **MCU Family** | Exact chip or module model | ESP32-WROOM-32E, ESP32-S3-WROOM-1, ESP32-C3 | |
| **Flash Memory Size** | Total SPI Flash (MB) | 4 MB, 8 MB, 16 MB | |
| **PSRAM** | External RAM presence | None, 2 MB, 8 MB Quad/Octal SPI | |
| **Silicon Revision** | Chip silicon version | Rev 1, Rev 3 | |
| **Power Supply & LDO** | Board voltage regulation & peak current | 3.3V @ 1.0A LDO (500mA peak Wi-Fi pulses) | |
| **Brownout Threshold** | Configured brownout reset voltage | Level 0 (2.43V) to Level 7 (2.80V) | |

---

## 2. Particulate Matter (PM) Sensor

| Parameter | Required Specification | Example / Options | SOCHI VAYU Actual Value |
| :--- | :--- | :--- | :--- |
| **Part Number** | Exact manufacturer & model | Plantower PMS5003 / PMS7003, Sensirion SPS30, Honeywell HPMA115S0 | |
| **Interface Bus** | Physical communication bus | Hardware UART, Software Serial, I2C | |
| **Assigned GPIOs** | RX, TX, SET/ENABLE, RESET pins | UART2: GPIO16 (RX), GPIO17 (TX), GPIO4 (EN) | |
| **Baud Rate & Frame** | UART baud rate & data bits | 9600 bps, 8N1 | |
| **Reported Metrics** | Supported particle bins | PM1.0, PM2.5, PM10 (Standard vs Atmospheric) | |
| **Fan / Laser Sleep** | Sleep control mechanism | High/Low logic on SET pin, or UART command | |
| **Warmup Duration** | Required laser stabilization time | 30 seconds from standby | |

---

## 3. Gas / VOC / Environmental Sensors

| Parameter | Required Specification | Example / Options | SOCHI VAYU Actual Value |
| :--- | :--- | :--- | :--- |
| **VOC Sensor Model** | Manufacturer & Part Number | Sensirion SGP40, Sensirion SGPC3, Figaro TGS | |
| **Temp / RH Sensor Model**| Manufacturer & Part Number | Sensirion SHT31, Sensirion SHT40, BME280 | |
| **Interface Bus** | I2C Port & Clock Speed | I2C0, 100 kHz standard / 400 kHz fast | |
| **Assigned GPIOs** | SDA, SCL pins | GPIO21 (SDA), GPIO22 (SCL) | |
| **I2C Addresses** | 7-bit hexadecimal addresses | SGP40: `0x59`, SHT31: `0x44` (or `0x45`) | |
| **VOC Algorithm** | Raw tick vs Sensirion VOC Index | Raw SRAW_VOC or on-chip/MCU VOC Index (0-500)| |

---

## 4. Fan Control, Tachometer & Filter Life

| Parameter | Required Specification | Example / Options | SOCHI VAYU Actual Value |
| :--- | :--- | :--- | :--- |
| **Fan Drive Type** | Electrical control interface | Low-side PWM MOSFET, 0-10V analog, Relay/Triac | |
| **PWM Frequency** | PWM carrier frequency | 25 kHz (standard computer fan), 1 kHz | |
| **PWM GPIO** | Assigned output pin for fan gate | GPIO18 (LEDC timer channel) | |
| **Tachometer Feedback** | Real-time RPM pulse detection | Yes (Hall-effect tachometer) / No (Open-loop) | |
| **Tachometer GPIO & Spec**| Interrupt pin & pulses per revolution | GPIO19 (Input pullup, 2 pulses per revolution)| |
| **Filter Door Interlock** | Safety door switch GPIO | GPIO5 (Active low, normally closed) | |
| **Filter Life Tracking** | Method of filter exhaustion tracking | Run-time hours in NVS, or differential pressure | |

---

## 5. Network, Identity & Provisioning

| Parameter | Required Specification | Example / Options | SOCHI VAYU Actual Value |
| :--- | :--- | :--- | :--- |
| **Device ID Assignment** | Permanent unique device identifier | Factory serial e.g. `VAYU-001`, or MAC-derived | |
| **Wi-Fi Provisioning** | Customer setup protocol | SoftAP Web Portal, BLE Prov, Hardcoded config | |
| **Clock Source (NTP)** | Local timekeeper mechanism | Local NTP server / gateway, SNTP pool, or RTC | |
| **MQTT Credentials** | Per-device username & password | Burned to NVS flash at factory calibration | |
| **Default Reporting Rate**| Telemetry interval | 3 to 10 seconds | |

---

## 6. Safety & Fail-Safe Requirements

1. **Autonomous Operation**: If the Wi-Fi router, monitoring PC, or MQTT broker becomes unreachable, the purifier firmware MUST continue autonomous filtration without restarting or halting the fan.
2. **Thermal & Electrical Interlocks**: Hardware interlocks (e.g. thermal fuses, door switches) must cut power or signal high-priority hardware interrupts immediately.
3. **Sensor Fault Isolation**: If the PM sensor fails or disconnects, the firmware must publish explicit `null` metrics with `pm_sensor_valid: false`, and run the fan at a safe baseline speed rather than stalling.
