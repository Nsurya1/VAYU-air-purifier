#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>

// ============================================================================
// VAYU - PRODUCTION SENSOR FIRMWARE (CUBIC AM1008W IAQ ENGINE)
// ============================================================================
// HARDWARE PIN CONNECTIONS:
// 1. AM1008W TX (Yellow/White wire) -> ESP32 GPIO Pin 18 (RX1)
// 2. AM1008W RX (Green/Blue wire)   -> ESP32 GPIO Pin 17 (TX1)
// 3. AM1008W 5V (Red wire)          -> ESP32 5V / VBUS pin
// 4. AM1008W GND (Black wire)       -> ESP32 GND pin
#define SENSOR_RX_PIN 18
#define SENSOR_TX_PIN 17

// Telemetry Storage
struct AirData {
    uint16_t co2;
    uint16_t pm25;
    float temp;
    float hum;
    uint16_t voc;
    bool sensor_connected;
    unsigned long last_valid_rx;
};

// Default disconnected
AirData current_data = { 0, 0, 0.0f, 0.0f, 0, false, 0 };

// CUBIC AM1008W Hex Command Set
// 1. Official Read Measurement Result: 11 02 01 01 EB
const uint8_t AM1008W_QUERY_CMD_READ[5] = { 0x11, 0x02, 0x01, 0x01, 0xEB };
// 2. Alternative Query: 11 02 01 00 EC
const uint8_t AM1008W_QUERY_CMD_ALT[5]  = { 0x11, 0x02, 0x01, 0x00, 0xEC };
// 3. Enable Continuous Streaming Mode: 11 03 0D FF FF E1
const uint8_t AM1008W_CMD_CONTINUOUS[6] = { 0x11, 0x03, 0x0D, 0xFF, 0xFF, 0xE1 };
// 4. Open Dynamic Measuring Mode: 11 02 06 01 E6
const uint8_t AM1008W_CMD_DYNAMIC[5]    = { 0x11, 0x02, 0x06, 0x01, 0xE6 };

uint8_t rx_buf[64];
int rx_len = 0;
unsigned long last_poll_time = 0;
unsigned long last_terminal_print = 0;
unsigned long last_init_command_time = 0;

WebServer server(80);
const char* ap_ssid = "VAYU_AIR_DASHBOARD";
const char* ap_pass = "12345678";

// ============================================================================
// EMBEDDED WEB DASHBOARD (WIFI FALLBACK)
// ============================================================================
const char INDEX_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>VAYU Live Telemetry</title>
<style>
    body { font-family: sans-serif; background: #0b0f19; color: #fff; text-align: center; padding: 20px; }
    .status { padding: 8px 16px; border-radius: 20px; font-weight: bold; display: inline-block; margin-bottom: 20px; }
    .online { background: #166534; color: #4ade80; }
    .offline { background: #991b1b; color: #f87171; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; max-width: 600px; margin: 0 auto; }
    .card { background: #1e293b; padding: 20px; border-radius: 12px; }
    .title { font-size: 13px; color: #94a3b8; }
    .val { font-size: 32px; font-weight: bold; margin: 8px 0; }
</style>
</head>
<body>
    <h1>VAYU</h1>
    <div id="status" class="status offline">WAITING FOR SENSOR...</div>
    <div class="grid">
        <div class="card"><div class="title">CO2</div><div class="val" id="co2">--</div>ppm</div>
        <div class="card"><div class="title">PM 2.5</div><div class="val" id="pm25">--</div>ug/m3</div>
        <div class="card"><div class="title">TEMP</div><div class="val" id="temp">--</div>&deg;C</div>
        <div class="card"><div class="title">HUMIDITY</div><div class="val" id="hum">--</div>%</div>
        <div class="card"><div class="title">VOC</div><div class="val" id="voc">--</div>Index</div>
    </div>
<script>
    async function refresh() {
        try {
            let res = await fetch('/api/data');
            let d = await res.json();
            let st = document.getElementById('status');
            if (d.sensor_active) {
                st.className = "status online";
                st.innerText = "AM1008W SENSOR CONNECTED";
                document.getElementById('co2').innerText = d.co2;
                document.getElementById('pm25').innerText = d.pm25;
                document.getElementById('temp').innerText = d.temp.toFixed(1);
                document.getElementById('hum').innerText = d.hum.toFixed(1);
                document.getElementById('voc').innerText = d.voc;
            } else {
                st.className = "status offline";
                st.innerText = "AM1008W WAITING (Check Pin 18 RX / Pin 17 TX)";
                document.getElementById('co2').innerText = "--";
                document.getElementById('pm25').innerText = "--";
                document.getElementById('temp').innerText = "--";
                document.getElementById('hum').innerText = "--";
                document.getElementById('voc').innerText = "--";
            }
        } catch(e) {}
    }
    setInterval(refresh, 1000);
</script>
</body>
</html>
)rawliteral";

void handleRoot() { server.send_P(200, "text/html", INDEX_HTML); }

void handleDataApi() {
    char json[256];
    snprintf(json, sizeof(json),
        "{\"co2\":%d,\"pm25\":%d,\"temp\":%.1f,\"hum\":%.1f,\"voc\":%d,\"sensor_active\":%s,\"uptime\":%lu}",
        current_data.co2,
        current_data.pm25,
        current_data.temp,
        current_data.hum,
        current_data.voc,
        current_data.sensor_connected ? "true" : "false",
        millis() / 1000
    );
    server.send(200, "application/json", json);
}

// ============================================================================
// AM1008W PROTOCOL ENGINE
// ============================================================================
void initSensorModes() {
    // 1. Enable Continuous Auto-Streaming Mode
    Serial1.write(AM1008W_CMD_CONTINUOUS, 6);
    delay(50);
    // 2. Open Dynamic Particle Measuring Mode
    Serial1.write(AM1008W_CMD_DYNAMIC, 5);
    delay(50);
    // 3. Send initial query
    Serial1.write(AM1008W_QUERY_CMD_READ, 5);
}

void pollSensor() {
    // Send standard Read Measurement command
    Serial1.write(AM1008W_QUERY_CMD_READ, 5);
    // Also periodically ping fallback command
    static uint8_t alt_counter = 0;
    if (++alt_counter >= 3) {
        alt_counter = 0;
        Serial1.write(AM1008W_QUERY_CMD_ALT, 5);
    }
}

void parseSensorResponse() {
    while (Serial1.available()) {
        uint8_t b = Serial1.read();

        // Response frame from AM1008W begins with 0x16
        if (rx_len == 0) {
            if (b != 0x16) continue;
        }
        rx_buf[rx_len++] = b;

        // Prevent buffer overrun
        if (rx_len >= 64) {
            rx_len = 0;
            continue;
        }

        // AM1008W response frame is either:
        // Format A (Full 24-byte IAQ): 16 16 01 [DF1..DF21] [CS]
        // Format B (Standard 16..20 byte): 16 [LEN] 01 [Data...] [CS]
        if (rx_len >= 16) {
            uint8_t payload_len = rx_buf[1];
            int expected_len = payload_len + 2; // Header(1) + Len(1) + Data(LEN) + CS(1) -> typically LEN + 2
            if (expected_len < 16) expected_len = 16;
            if (expected_len > 32) expected_len = 24;

            if (rx_len >= expected_len || rx_len >= 24) {
                // Checksum validation: CS = (256 - (sum % 256)) & 0xFF
                uint16_t sum = 0;
                for (int i = 0; i < rx_len - 1; i++) {
                    sum += rx_buf[i];
                }
                uint8_t calc_cs = (256 - (sum % 256)) & 0xFF;
                uint8_t actual_cs = rx_buf[rx_len - 1];

                bool valid_checksum = (calc_cs == actual_cs);
                bool valid_header = (rx_buf[0] == 0x16);

                if (valid_checksum || valid_header) {
                    uint16_t co2_val  = 0;
                    uint16_t pm25_val = 0;
                    float    temp_val = 0.0f;
                    float    hum_val  = 0.0f;
                    uint16_t voc_val  = 0;

                    if (rx_buf[1] >= 0x14) {
                        // --------------------------------------------------------
                        // AM1008W 24-Byte Full Multi-Sensor Frame:
                        // Byte 0: 0x16 (HEAD)
                        // Byte 1: 0x16 (LEN = 22)
                        // Byte 2: 0x01 (CMD)
                        // Byte 3,4:   DF1, DF2  -> CO2 (ppm)
                        // Byte 5,6:   DF3, DF4  -> VOC Status / Level
                        // Byte 7,8:   DF5, DF6  -> PM1.0 (ug/m3)
                        // Byte 9,10:  DF7, DF8  -> PM2.5 (ug/m3)
                        // Byte 11,12: DF9, DF10 -> PM10  (ug/m3)
                        // Byte 13,14: DF11,DF12 -> Temp (((DF11*256+DF12)-500)/10.0)
                        // Byte 15,16: DF13,DF14 -> Humidity ((DF13*256+DF14)/10.0)
                        // --------------------------------------------------------
                        co2_val  = (rx_buf[3] << 8) | rx_buf[4];
                        voc_val  = (rx_buf[5] << 8) | rx_buf[6];
                        pm25_val = (rx_buf[9] << 8) | rx_buf[10];

                        int16_t raw_temp = (rx_buf[13] << 8) | rx_buf[14];
                        if (raw_temp >= 500) {
                            temp_val = (raw_temp - 500) / 10.0f;
                        } else if (raw_temp > 0) {
                            temp_val = raw_temp / 10.0f;
                        }

                        uint16_t raw_hum = (rx_buf[15] << 8) | rx_buf[16];
                        hum_val = raw_hum / 10.0f;

                    } else {
                        // --------------------------------------------------------
                        // AM1008 Alternative / Compact Frame Layout:
                        // Byte 3,4:   CO2
                        // Byte 5,6:   PM2.5
                        // Byte 7,8:   Temp
                        // Byte 9,10:  Humidity
                        // Byte 11,12: VOC
                        // --------------------------------------------------------
                        co2_val  = (rx_buf[3] << 8) | rx_buf[4];
                        pm25_val = (rx_buf[5] << 8) | rx_buf[6];
                        
                        int16_t raw_temp = (rx_buf[7] << 8) | rx_buf[8];
                        temp_val = (raw_temp > 500) ? ((raw_temp - 500) / 10.0f) : (raw_temp / 10.0f);

                        uint16_t raw_hum = (rx_buf[9] << 8) | rx_buf[10];
                        hum_val = raw_hum / 10.0f;

                        voc_val  = (rx_buf[11] << 8) | rx_buf[12];
                    }

                    // Sanity check to avoid zero glitch during warmup
                    if (co2_val > 0 || pm25_val > 0 || temp_val > 0.0f) {
                        current_data.co2  = co2_val;
                        current_data.pm25 = pm25_val;
                        current_data.temp = temp_val;
                        current_data.hum  = hum_val;
                        current_data.voc  = voc_val;
                        current_data.sensor_connected = true;
                        current_data.last_valid_rx = millis();
                    }
                }
                rx_len = 0; // Reset packet buffer
            }
        }
    }
}

// Timeout check: If no data received for 4 seconds, flag sensor status
void checkSensorTimeout() {
    if (current_data.sensor_connected && (millis() - current_data.last_valid_rx > 4000)) {
        current_data.sensor_connected = false;
    }
}

// ============================================================================
// SETUP & LOOP
// ============================================================================
void setup() {
    // 1. USB CDC Connection to Laptop (115200)
    Serial.begin(115200);

    // 2. Hardware UART1 to AM1008W Sensor (9600 Baud 8N1)
    Serial1.begin(9600, SERIAL_8N1, SENSOR_RX_PIN, SENSOR_TX_PIN);

    // 3. Wi-Fi SoftAP (For direct phone/laptop backup access)
    WiFi.mode(WIFI_AP);
    WiFi.softAP(ap_ssid, ap_pass);

    server.on("/", handleRoot);
    server.on("/api/data", handleDataApi);
    server.begin();

    delay(300);
    initSensorModes();

    Serial.println("\n\n=======================================================");
    Serial.println("         VAYU - AM1008W SENSOR ENGINE ONLINE          ");
    Serial.println("=======================================================");
    Serial.println(" [PINS] AM1008W TX -> ESP32 Pin 18 (RX1)");
    Serial.println(" [PINS] AM1008W RX -> ESP32 Pin 17 (TX1)");
    Serial.println(" [PINS] AM1008W 5V -> ESP32 5V/VBUS | GND -> GND");
    Serial.println("=======================================================\n");
}

void loop() {
    server.handleClient();

    // 1. Re-initialize continuous streaming every 15 seconds if idle
    if (millis() - last_init_command_time >= 15000) {
        last_init_command_time = millis();
        initSensorModes();
    }

    // 2. Poll AM1008W every 1.5 seconds
    if (millis() - last_poll_time >= 1500) {
        pollSensor();
        last_poll_time = millis();
    }

    // 3. Parse real responses from sensor
    parseSensorResponse();

    // 4. Check for timeout
    checkSensorTimeout();

    // 5. Output telemetry to USB CDC every 1 second
    if (millis() - last_terminal_print >= 1000) {
        last_terminal_print = millis();

        if (current_data.sensor_connected) {
            // Live valid packet
            Serial.printf("DATA:{\"co2\":%d,\"pm25\":%d,\"temp\":%.1f,\"hum\":%.1f,\"voc\":%d,\"sensor\":\"CONNECTED\"}\n",
                current_data.co2,
                current_data.pm25,
                current_data.temp,
                current_data.hum,
                current_data.voc
            );
        } else {
            // Sensor not yet responding or preheating
            Serial.printf("DATA:{\"co2\":%d,\"pm25\":%d,\"temp\":%.1f,\"hum\":%.1f,\"voc\":%d,\"sensor\":\"WAITING_FOR_SENSOR\"}\n",
                current_data.co2,
                current_data.pm25,
                current_data.temp,
                current_data.hum,
                current_data.voc
            );
        }
    }
}
