# SOCHI VAYU Firmware Architecture & Safety Protocol

## Strict Safety Isolation Boundary

The monitoring software is strictly a read-only passive observer of telemetry. 
Under no circumstances should the purifier's essential safety operations depend on:
- Wi-Fi connectivity
- MQTT broker uptime
- Monitoring PC status
- Customer network switch health

## Pending Hardware Questionnaire (Phase 0)

Before creating hardware-specific firmware modules:
1. Exact ESP32 module variant (ESP32-WROOM-32, ESP32-S3, ESP32-C3, etc.).
2. PM Sensor model (e.g., Plantower PMS5003 / PMS7003 / Sensirion SPS30) and bus interface (UART / I2C).
3. VOC / Gas sensor model (e.g., Sensirion SGP40 / Bosch BME680).
4. Temperature & Humidity sensor model (e.g., SHT31 / DHT22 / onboard).
5. Fan motor drive method (PWM / 0-10V analog / Relay) and presence of tachometer feedback (RPM pulse pin).
6. Filter status detection mechanism (differential pressure sensor / run-hour timer).
7. Flash partition layout & OTA rollback mechanism.
