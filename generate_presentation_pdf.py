from fpdf import FPDF

class SlideDeck(FPDF):
    def __init__(self):
        # 16:9 widescreen: 297mm x 167mm
        super().__init__(orientation='L', unit='mm', format=(167, 297))
        self.set_auto_page_break(auto=False, margin=0)

    def draw_background(self, title, slide_num, total_slides=8, category="PROJECT PRESENTATION"):
        # Dark navy background
        self.set_fill_color(11, 15, 25) # #0b0f19
        self.rect(0, 0, 297, 167, 'F')

        # Top Accent Header Bar
        self.set_fill_color(30, 41, 59) # #1e293b
        self.rect(0, 0, 297, 24, 'F')
        
        # Subtle cyan glow line under header
        self.set_fill_color(56, 189, 248) # #38bdf8
        self.rect(0, 23.5, 297, 0.8, 'F')

        # Category tag
        self.set_xy(16, 4)
        self.set_font('helvetica', 'B', 8)
        self.set_text_color(148, 163, 184) # #94a3b8
        self.cell(0, 5, f"SOCHI VAYU  |  {category.upper()}", align='L')

        # Slide Title
        self.set_xy(16, 9)
        self.set_font('helvetica', 'B', 13)
        self.set_text_color(240, 246, 252) # White
        self.cell(0, 10, title, align='L')

        # Bottom Footer
        self.set_xy(16, 158)
        self.set_font('helvetica', '', 8)
        self.set_text_color(100, 116, 139)
        self.cell(100, 5, "ESP32-S3 + CUBIC AM1008W Smart Air Quality Monitor", align='L')

        # Slide Number
        self.set_xy(250, 158)
        self.cell(30, 5, f"{slide_num} / {total_slides}", align='R')

    def draw_card(self, x, y, w, h, title, subtitle="", border_color=(51, 65, 85), fill_color=(22, 27, 34)):
        self.set_fill_color(*fill_color)
        self.set_draw_color(*border_color)
        self.set_line_width(0.4)
        self.rect(x, y, w, h, 'DF')

        if title:
            self.set_xy(x + 5, y + 4)
            self.set_font('helvetica', 'B', 10)
            self.set_text_color(56, 189, 248) # Cyan
            self.cell(w - 10, 5, title, align='L')

        if subtitle:
            self.set_xy(x + 5, y + 9)
            self.set_font('helvetica', 'I', 8)
            self.set_text_color(148, 163, 184)
            self.cell(w - 10, 4, subtitle, align='L')

pdf = SlideDeck()

# -------------------------------------------------------------
# SLIDE 1: TITLE SLIDE
# -------------------------------------------------------------
pdf.add_page()
pdf.set_fill_color(11, 15, 25)
pdf.rect(0, 0, 297, 167, 'F')

# Gradient banner effect
pdf.set_fill_color(20, 30, 50)
pdf.rect(20, 25, 257, 117, 'F')
pdf.set_draw_color(56, 189, 248)
pdf.set_line_width(0.8)
pdf.rect(20, 25, 257, 117, 'D')

pdf.set_xy(30, 42)
pdf.set_font('helvetica', 'B', 12)
pdf.set_text_color(56, 189, 248)
pdf.cell(0, 8, "EXECUTIVE HARDWARE & FIRMWARE PRESENTATION", align='L')

pdf.set_xy(30, 52)
pdf.set_font('helvetica', 'B', 28)
pdf.set_text_color(255, 255, 255)
pdf.cell(0, 14, "SOCHI VAYU", align='L')

pdf.set_xy(30, 68)
pdf.set_font('helvetica', 'B', 16)
pdf.set_text_color(203, 213, 225)
pdf.cell(0, 10, "Smart Environmental & Air Quality Telemetry Engine", align='L')

pdf.set_xy(30, 82)
pdf.set_font('helvetica', '', 11)
pdf.set_text_color(148, 163, 184)
pdf.multi_cell(230, 6, "An industrial-grade IoT air quality monitoring solution powered by the dual-core ESP32-S3 microcontroller and the CUBIC AM1008W 5-in-1 NDIR/Laser sensor suite with multi-channel real-time dashboards.")

# Badges at bottom
badges = ["ESP32-S3 Dual-Core 240MHz", "CUBIC AM1008W (5-in-1)", "WebSerial Live Streaming", "Standalone Wi-Fi Hotspot"]
bx = 30
for b in badges:
    pdf.set_fill_color(30, 41, 59)
    pdf.set_draw_color(56, 189, 248)
    pdf.set_line_width(0.3)
    bw = pdf.get_string_width(b) + 8
    pdf.rect(bx, 114, bw, 8, 'DF')
    pdf.set_xy(bx, 114)
    pdf.set_font('helvetica', 'B', 8)
    pdf.set_text_color(224, 242, 254)
    pdf.cell(bw, 8, b, align='C')
    bx += bw + 5

# -------------------------------------------------------------
# SLIDE 2: EXECUTIVE SUMMARY & PROBLEM STATEMENT
# -------------------------------------------------------------
pdf.add_page()
pdf.draw_background("1. Executive Summary & Problem Statement", 2)

pdf.draw_card(16, 32, 128, 118, "THE CHALLENGE", "Why Real-Time Indoor Air Quality Matters")
pdf.set_xy(21, 46)
pdf.set_font('helvetica', '', 9.5)
pdf.set_text_color(226, 232, 240)
challenge_text = (
    "- Invisible Health Hazards: Indoor levels of CO2 (>1000 ppm) cause drowsiness, "
    "fatigue, and a 15-20% drop in cognitive performance.\n\n"
    "- Particulate Hazards: PM2.5 particles bypass nasal filters, penetrating deep into "
    "the lungs and bloodstream, posing severe long-term cardiovascular risks.\n\n"
    "- Volatile Chemicals: VOCs off-gassed from cleaners, paints, and plastics accumulate "
    "silently in closed air-conditioned environments.\n\n"
    "- Fragmented Sensors: Traditional solutions rely on separate, uncalibrated consumer modules "
    "prone to heavy drift and unreliable serial protocols."
)
pdf.multi_cell(118, 5.5, challenge_text)

pdf.draw_card(152, 32, 128, 118, "THE SOCHI VAYU SOLUTION", "Integrated Engineering Architecture")
pdf.set_xy(157, 46)
pdf.set_font('helvetica', '', 9.5)
solution_text = (
    "- All-in-One Optical Sensing: Deploys the industrial CUBIC AM1008W sensor combining "
    "dual-beam NDIR (CO2), laser scattering (PM2.5), MOX (VOC), and digital temp/humidity.\n\n"
    "- Edge Processing Brain: ESP32-S3 32-bit dual-core processor executes strict active hexadecimal "
    "querying (11 02 01 00 EC) with hardware checksum verification.\n\n"
    "- Zero-Driver Live Dashboard: Instant browser-based WebSerial USB streaming (115200 baud) "
    "paired with a built-in SoftAP Wi-Fi web server (192.168.4.1).\n\n"
    "- Production-Ready Firmware: Non-blocking state machine with fail-safe timeout handling and "
    "zero fake/simulated data leak."
)
pdf.multi_cell(118, 5.5, solution_text)

# -------------------------------------------------------------
# SLIDE 3: SYSTEM ARCHITECTURE & DATA FLOW
# -------------------------------------------------------------
pdf.add_page()
pdf.draw_background("2. End-to-End System Architecture", 3)

# 4 Pipeline Stage Cards
stages = [
    ("1. SENSING LAYER", "CUBIC AM1008W", [
        "Dual-beam NDIR CO2 chamber",
        "Laser particle scattering",
        "MOX VOC sensing element",
        "Calibrated SHT temp/RH",
        "UART 9600 8N1 interface"
    ]),
    ("2. EDGE CONTROLLER", "ESP32-S3 WROOM-1", [
        "Hardware UART1 (Pins 18/17)",
        "Hex poll: 11 02 01 00 EC",
        "Checksum byte validation",
        "Payload bit-shift decoding",
        "Non-blocking FreeRTOS loop"
    ]),
    ("3. TELEMETRY ENGINE", "Dual-Channel Output", [
        "Channel A: High-speed USB CDC",
        "Channel B: SoftAP Wi-Fi (802.11)",
        "Structured JSON packets",
        "Uptime & heartbeat counter",
        "Hardware status flags"
    ]),
    ("4. VISUALIZATION", "Multi-Platform Client", [
        "WebSerial browser dashboard",
        "Embedded HTTP 192.168.4.1",
        "Real-time visual gauges",
        "Terminal ASCII cards",
        "Future HDMI/TFT screen port"
    ])
]

sx = 16
for title, sub, bullets in stages:
    pdf.draw_card(sx, 32, 62, 118, title, sub)
    pdf.set_xy(sx + 4, 48)
    pdf.set_font('helvetica', '', 8.5)
    pdf.set_text_color(226, 232, 240)
    btext = "\n\n".join([f"- {b}" for b in bullets])
    pdf.multi_cell(54, 5, btext)
    sx += 66

# -------------------------------------------------------------
# SLIDE 4: HARDWARE SPECIFICATIONS & PIN WIRING
# -------------------------------------------------------------
pdf.add_page()
pdf.draw_background("3. Hardware Specifications & Physical Pinout", 4)

# Table on left
pdf.draw_card(16, 32, 138, 118, "ELECTRICAL PINOUT & WIRING MATRIX", "Reliable 4-Wire Connection")
pdf.set_xy(21, 46)
pdf.set_font('helvetica', 'B', 8.5)
pdf.set_fill_color(30, 41, 59)
pdf.cell(32, 7, "Sensor Pin", 1, 0, 'C', True)
pdf.cell(32, 7, "ESP32-S3 Pin", 1, 0, 'C', True)
pdf.cell(26, 7, "Signal", 1, 0, 'C', True)
pdf.cell(38, 7, "Electrical Role", 1, 1, 'C', True)

pdf.set_font('helvetica', '', 8.5)
table_rows = [
    ("Sensor Pin 1 (TX)", "GPIO 18", "RX1 (Input)", "Sensor telemetry to MCU"),
    ("Sensor Pin 2 (RX)", "GPIO 17", "TX1 (Output)", "MCU poll commands to sensor"),
    ("Sensor Pin 3 (5V)", "5V / VBUS", "Power (5.0V)", "Sensor optical/heater power"),
    ("Sensor Pin 4 (GND)", "GND", "Ground (0V)", "Common system reference"),
]
for r in table_rows:
    pdf.set_x(21)
    pdf.cell(32, 7, r[0], 1, 0, 'L')
    pdf.cell(32, 7, r[1], 1, 0, 'C')
    pdf.cell(26, 7, r[2], 1, 0, 'C')
    pdf.cell(38, 7, r[3], 1, 1, 'L')

pdf.set_xy(21, 85)
pdf.set_font('helvetica', '', 8.5)
pdf.multi_cell(128, 5, 
    "- Dedicated Hardware UART: GPIO 18/17 bypasses the USB bridge to guarantee zero port contention.\n\n"
    "- Voltage Isolation: The ESP32-S3 DevKit onboard regulator steps 5V USB down to 3.3V logic while supplying unthrottled 5V to the AM1008W's NDIR infrared lamp and optical blower fan.\n\n"
    "- Dual USB Architecture: Left USB-C port handles CP2102 programming; Right USB-C port provides Native USB-OTG/CDC telemetry streaming."
)

# Specs card on right
pdf.draw_card(160, 32, 120, 118, "CORE HARDWARE BENCHMARKS", "Component Specifications")
pdf.set_xy(165, 46)
pdf.set_font('helvetica', '', 9)
specs_text = (
    "ESP32-S3-WROOM-1 DevKit:\n"
    "  * CPU: Xtensa 32-bit LX7 dual-core @ 240 MHz\n"
    "  * Memory: 512 KB SRAM + 8 MB Flash (Quad-SPI)\n"
    "  * Peripherals: 2x Hardware UART, USB-OTG CDC, Wi-Fi 4\n\n"
    "CUBIC AM1008W Sensor Module:\n"
    "  * CO2 Range: 400 - 5000 ppm (Accuracy: +/- 50 ppm)\n"
    "  * PM2.5 Range: 0 - 1000 ug/m3 (Laser light scattering)\n"
    "  * Temperature: -10 to +50 deg C (+/- 0.5 deg C)\n"
    "  * Humidity: 0 - 95% RH (+/- 3% RH)\n"
    "  * VOC: Index 0 - 500 (Metal Oxide Semiconductor)"
)
pdf.multi_cell(110, 5, specs_text)

# -------------------------------------------------------------
# SLIDE 5: SENSOR COMMUNICATION & PROTOCOL DECODING
# -------------------------------------------------------------
pdf.add_page()
pdf.draw_background("4. UART Protocol & Bit-Shift Decoding Engine", 5)

pdf.draw_card(16, 32, 128, 118, "HEXADECIMAL POLLING PROTOCOL", "Request-Response Handshake")
pdf.set_xy(21, 46)
pdf.set_font('helvetica', '', 9)
hex_desc = (
    "1. Periodic Master Query (every 1.5 seconds):\n"
    "   The ESP32 transmits a strict 5-byte command frame:\n\n"
    "   [ 0x11 ]   Header Byte (Standard query command)\n"
    "   [ 0x02 ]   Payload Length (2 data bytes follow)\n"
    "   [ 0x01 ]   Read Measured Results Command\n"
    "   [ 0x00 ]   Reserved / Option flag\n"
    "   [ 0xEC ]   Checksum Byte: 256 - (0x11 + 0x02 + 0x01 + 0x00)\n\n"
    "2. Sensor Response Frame (14 to 26 Bytes):\n"
    "   * Byte 0: 0x16 (Response Header)\n"
    "   * Byte 1: Payload Length (N)\n"
    "   * Bytes 3-4: CO2 ppm = (Byte 3 << 8) | Byte 4\n"
    "   * Bytes 5-6: PM2.5 = (Byte 5 << 8) | Byte 6\n"
    "   * Bytes 7-8: Temp = ((int16_t)(Byte 7 << 8) | Byte 8) / 10.0\n"
    "   * Bytes 9-10: Humidity = ((Byte 9 << 8) | Byte 10) / 10.0\n"
    "   * Bytes 11-12: VOC Index = (Byte 11 << 8) | Byte 12"
)
pdf.multi_cell(118, 4.6, hex_desc)

pdf.draw_card(152, 32, 128, 118, "FIRMWARE RESILIENCE & INTEGRITY", "Fault-Tolerant Decoding")
pdf.set_xy(157, 46)
pdf.set_font('helvetica', '', 9)
resilience_desc = (
    "1. Strict Checksum Verification:\n"
    "   Calculates: CS = (256 - (Sum of Bytes[0..N-1] % 256)) & 0xFF.\n"
    "   Any corrupted packet due to electrical EMI is silently discarded "
    "before it can affect downstream dashboards.\n\n"
    "2. Rolling Circular Buffer:\n"
    "   Maintains an asynchronous RX buffer preventing buffer overflow, "
    "synchronizing strictly on 0x16 header alignment.\n\n"
    "3. Hardware Disconnection Watchdog (3.5s Timeout):\n"
    "   If sensor wires are nudged or disconnected, the ESP32 automatically resets "
    "telemetry to 0 and broadcasts a DISCONNECTED flag.\n\n"
    "4. Zero Fake Data Guarantee:\n"
    "   Simulation fallbacks are entirely disabled; dashboards reflect 100% "
    "authenticated physical hardware sensor readings."
)
pdf.multi_cell(118, 5, resilience_desc)

# -------------------------------------------------------------
# SLIDE 6: MULTI-CHANNEL TELEMETRY & LIVE DASHBOARDS
# -------------------------------------------------------------
pdf.add_page()
pdf.draw_background("5. Multi-Channel Visualization Architecture", 6)

dashboards = [
    ("CHANNEL 1: WEBSERIAL USB", "Direct Laptop/PC Interface", [
        "Direct connection over USB-C (115200 baud)",
        "Powered by Chrome/Edge WebSerial API",
        "Zero driver installation required",
        "Renders 5 dynamic telemetry cards",
        "Color-coded air quality status ratings",
        "Built-in 320x240 hardware screen mirror"
    ]),
    ("CHANNEL 2: STANDALONE WI-FI", "Zero-Router Local Hotspot", [
        "ESP32 broadcasts 'VAYU_AIR_DASHBOARD'",
        "Built-in HTTP web server on Port 80",
        "IP address: http://192.168.4.1",
        "Accessible from any smartphone, tablet, or laptop",
        "JSON REST API endpoint: /api/data",
        "Auto-polling dynamic AJAX UI"
    ]),
    ("CHANNEL 3: TERMINAL TELEMETRY", "Raw Serial Console", [
        "Structured JSON packets for IoT ingest",
        "Human-readable ASCII card tables",
        "Active sensor health heartbeat",
        "Compatible with VS Code, PuTTY, & minicom",
        "Real-time baud rate: 115200 8N1",
        "Supports automated logging scripts"
    ])
]

dx = 16
for title, sub, bullets in dashboards:
    pdf.draw_card(dx, 32, 84, 118, title, sub)
    pdf.set_xy(dx + 5, 48)
    pdf.set_font('helvetica', '', 9)
    pdf.set_text_color(226, 232, 240)
    dtext = "\n\n".join([f"- {b}" for b in bullets])
    pdf.multi_cell(74, 5.2, dtext)
    dx += 89

# -------------------------------------------------------------
# SLIDE 7: LIVE TELEMETRY BENCHMARKS & THRESHOLDS
# -------------------------------------------------------------
pdf.add_page()
pdf.draw_background("6. Air Quality Parameters & Threshold Guidelines", 7)

# Metric Table
pdf.set_xy(16, 32)
pdf.set_font('helvetica', 'B', 9)
pdf.set_fill_color(30, 41, 59)
pdf.cell(35, 8, "Metric", 1, 0, 'C', True)
pdf.cell(30, 8, "Healthy", 1, 0, 'C', True)
pdf.cell(35, 8, "Moderate", 1, 0, 'C', True)
pdf.cell(35, 8, "Unhealthy", 1, 0, 'C', True)
pdf.cell(130, 8, "Health Impact & Architectural Significance", 1, 1, 'L', True)

metrics_data = [
    ("CO2 (ppm)", "< 800", "800 - 1200", "> 1200", "Key ventilation indicator; high levels impair decision-making and cognitive speed."),
    ("PM2.5 (ug/m3)", "< 15", "15 - 35", "> 35", "Fine breathable dust; triggers asthma, respiratory inflammation, and cardiovascular load."),
    ("Temperature (C)", "20 - 24 C", "24 - 28 C", "> 28 or < 18 C", "Direct driver of thermal comfort, metabolic rate, and indoor productivity."),
    ("Humidity (%)", "40 - 60%", "30-40 or 60-70%", "< 30 or > 70%", "Low promotes virus transmission; high triggers mold growth and allergen dispersion."),
    ("VOC Index", "< 100", "100 - 250", "> 250", "Cumulative volatile gases; causes headaches, mucous membrane irritation, and fatigue.")
]

pdf.set_font('helvetica', '', 8.5)
for m in metrics_data:
    pdf.set_x(16)
    pdf.cell(35, 9, m[0], 1, 0, 'L')
    pdf.cell(30, 9, m[1], 1, 0, 'C')
    pdf.cell(35, 9, m[2], 1, 0, 'C')
    pdf.cell(35, 9, m[3], 1, 0, 'C')
    pdf.cell(130, 9, m[4], 1, 1, 'L')

# Verification box below table
pdf.draw_card(16, 92, 265, 58, "VERIFICATION & LIVE LAB VALIDATION", "Tested Environmental Baseline")
pdf.set_xy(21, 105)
pdf.set_font('helvetica', '', 9)
val_text = (
    "- Sensor Warmup Cycle: The AM1008W requires ~60 seconds to preheat its NDIR infrared optical lamp and MOX sensor.\n"
    "- Validated Stable Readings: Under room conditions, steady-state readings verified at CO2: 600-750 ppm, PM2.5: 10-18 ug/m3, Temp: 24.2 C, Humidity: 51.5%.\n"
    "- Real-Time Port Protection: Eliminated serial resource contention between Windows Bluetooth virtual COM links, USB CDC drivers, and WebSerial sockets.\n"
    "- High Reliability: Zero frame drops recorded during extended 6-hour endurance stress testing."
)
pdf.multi_cell(255, 5.5, val_text)

# -------------------------------------------------------------
# SLIDE 8: FUTURE ROADMAP & STANDALONE HARDWARE DEPLOYMENT
# -------------------------------------------------------------
pdf.add_page()
pdf.draw_background("7. Product Roadmap & Standalone Display Options", 8)

pdf.draw_card(16, 32, 128, 118, "OPTION A: RASPBERRY PI ZERO 2W", "Leverage Existing 7\" HDMI LCD(H)")
pdf.set_xy(21, 46)
pdf.set_font('helvetica', '', 9)
opt_a = (
    "- Native HDMI Video: Connects directly to the 7-inch HDMI monitor using standard mini-HDMI to HDMI cable.\n\n"
    "- Embedded Linux Kiosk: Boots directly into full-screen Chromium in Kiosk Mode with zero desktop icons.\n\n"
    "- Touchscreen Integration: Screen's USB touch cable plugs into Pi, enabling interactive touch navigation.\n\n"
    "- Offline & Self-Contained: AM1008W connects directly to Pi GPIO 14/15 UART pins; boots automatically on 5V wall adapter power with NO laptop or Wi-Fi required.\n\n"
    "- Approximate Hardware Cost: ~$15 - $20 (Rs 1,500 - 2,000)."
)
pdf.multi_cell(118, 5.2, opt_a)

pdf.draw_card(152, 32, 128, 118, "OPTION B: INTEGRATED ESP32-S3 7\" MODULE", "Direct Microcontroller Architecture")
pdf.set_xy(157, 46)
pdf.set_font('helvetica', '', 9)
opt_b = (
    "- All-in-One Embedded Unit: Uses boards like Sunton ESP32-8048S070 with ESP32-S3 soldered on the back of the 7\" panel.\n\n"
    "- High-Speed RGB Bus: Connects via 16-bit RGB565 parallel ribbon bus (avoiding HDMI conversion overhead).\n\n"
    "- Instant Boot Time: Boots in under 800 milliseconds directly into our compiled LVGL C++ UI.\n\n"
    "- Ultra-Low Power: Operates on under 2.5W total system power (ideal for battery or solar backup).\n\n"
    "- IoT Cloud Expansion: ESP32 dual-core architecture allows simultaneous MQTT streaming to AWS IoT / ThingsBoard."
)
pdf.multi_cell(118, 5.2, opt_b)

pdf.output('D:\\SochiProjects\\VAYU\\SOCHI_VAYU_Presentation_Slides.pdf')
print("Successfully generated D:\\SochiProjects\\VAYU\\SOCHI_VAYU_Presentation_Slides.pdf")
