# SOCHI VAYU — Customer Deployment & Operations Guide

Welcome to the **SOCHI VAYU Local Air Quality Monitoring Platform**.

This software runs entirely within your facility's local network on a dedicated monitoring computer. It provides real-time visibility into all VAYU air purifiers installed across your rooms, conference halls, and lobbies without sending any data to external cloud servers.

---

## 1. System Requirements

### Hardware Requirements
- **Host Machine**: Any desktop PC, mini-PC (e.g. Intel NUC), or server running 24/7.
- **Operating System**: Windows 11 (64-bit), Windows 10 (64-bit), or Ubuntu 22.04+ LTS.
- **Processor**: Dual-Core x86_64 CPU (2.0 GHz or higher).
- **RAM**: Minimum 4 GB RAM (monitoring platform uses ~640 MB).
- **Disk Space**: Minimum 10 GB free space (monitoring stack uses < 1.5 GB).
- **Network**: Wired Ethernet connection strongly recommended (or strong 2.4/5 GHz Wi-Fi).

### Software Prerequisites
- **Docker Desktop for Windows** (with WSL2 enabled) OR **Docker Engine for Linux**.
  - Download Windows installer: `https://www.docker.com/products/docker-desktop/`
  - Ensure the Docker icon in your system tray shows **"Engine Running"** (green light).

---

## 2. Step-by-Step Installation (Windows 11)

### Step 1: Copy Installation Package
Unpack the `vayumonitoringSAAS` folder onto your local drive (e.g. `C:\VAYU` or `D:\SochiProjects\VAYU\vayumonitoringSAAS`).

### Step 2: Configure Your Building (Optional)
If you want to customize your facility name or room assignments:
1. Open `.env` in Notepad.
2. Edit `CUSTOMER_SITE_NAME`:
   ```env
   CUSTOMER_SITE_NAME=Acme-Corporate-Tower-1
   ```
3. Save and close the file.

### Step 3: Run One-Click Deployment
1. Double-click **`deploy.bat`**.
2. The installer will:
   - Verify Docker Desktop is active.
   - Start the Mosquitto MQTT broker, backend core, and dashboard.
   - Display a verification table showing all services **healthy**.
3. Press any key when prompted.

### Step 4: Configure Windows Defender Firewall
To allow other computers and lobby TV displays on your network to view the dashboard:
1. Right-click `scripts\setup-firewall.ps1`.
2. Choose **"Run with PowerShell"** (or open PowerShell as Administrator and run `.\scripts\setup-firewall.ps1`).
3. This creates inbound rules for Port `3000` (Dashboard) and Port `1883` (Purifiers) restricted strictly to your trusted Private local network.

---

## 3. How to Access the Dashboard

### On the Monitoring PC
Open Google Chrome, Microsoft Edge, or Firefox and go to:
**[http://localhost:3000](http://localhost:3000)**

### On Office TVs, Tablets & Laptops
1. Determine the monitoring PC's local IP address:
   - Open Command Prompt and type `ipconfig`.
   - Locate the **IPv4 Address** (e.g. `192.168.1.100`).
2. On any authorized device connected to the same Wi-Fi/Ethernet network, browse to:
   ```
   http://192.168.1.100:3000
   ```
3. For Lobby and Reception TVs: Click the **"TV Kiosk"** button in the top-right corner of the dashboard to enter full-screen high-contrast rotation mode.

---

## 4. Understanding Dashboard Statuses & Air Quality

### Device Statuses
- **ONLINE (Green)**: The purifier is actively connected and broadcasting fresh telemetry every few seconds.
- **STALE (Yellow)**: The purifier has not reported data in the last 30 seconds (possible Wi-Fi interference or low signal).
- **OFFLINE (Grey)**: The purifier is powered off, disconnected from Wi-Fi, or unreachable for >60 seconds.
- **SENSOR FAULT (Red)**: The purifier's controller is online, but a physical sensor (PM, VOC, or Temp) has reported a hardware fault.

### Air Quality Index (US EPA Standard)
| AQI Range | Category | Color | Action Recommendation |
| :---: | :---: | :---: | :--- |
| **0 – 50** | **Good** | Green | Air quality is satisfactory; clean indoor air. |
| **51 – 100** | **Moderate** | Yellow | Acceptable; purifier runs at baseline speed. |
| **101 – 150** | **Unhealthy for Sensitive Groups** | Orange | Purifier ramps up fan speed automatically. |
| **151 – 200** | **Unhealthy** | Red | Higher fan speed engaged to rapidly scrub air. |
| **201 – 300** | **Very Unhealthy** | Purple | High speed filtration active. |
| **301 – 500** | **Hazardous** | Maroon | Maximum turbo filtration engaged. |

---

## 5. Frequently Asked Questions & Troubleshooting

### Q1: What happens if the monitoring PC loses power or reboots?
**Answer**:
- **Your VAYU purifiers continue operating safely and uninterrupted.** The purifier firmware runs an autonomous embedded safety and filtration control loop that never stops cleaning air, even without a PC.
- When the PC powers back on, Docker Desktop automatically restarts all monitoring services (`restart: unless-stopped`).
- As soon as fresh telemetry arrives from the purifiers, the dashboard automatically updates to ONLINE.

### Q2: A device shows "SENSOR FAULT" — what should I do?
**Answer**:
1. Click on the affected device card to open the **Diagnostics Drawer**.
2. Inspect the sensor status (e.g. "Particulate Matter sensor reports invalid state").
3. Inspect physical purifier: check if the air intake is blocked, or power-cycle the purifier once. If the fault persists, contact SOCHI Support.

### Q3: Why can't other PCs or TVs open `http://<IP>:3000`?
**Answer**:
1. Check that the TV or laptop is connected to the **same local network subnet** (not guest Wi-Fi).
2. Ensure you ran `scripts\setup-firewall.ps1` as Administrator on the monitoring PC.
3. Confirm the monitoring PC is set to a **Private network profile** in Windows Settings (not Public).

### Q4: How are logs managed? Will my computer run out of disk space?
**Answer**:
No. All services are configured with strict 30 MB rotating log limits (`max-size: 10m`, `max-file: 3`). Logs automatically cycle and discard old entries; total disk footprint for logs will never exceed 90 MB.

---

## 6. Requesting Support from SOCHI

SOCHI employees do **not** have permanent remote access or backdoors into your computer. 

If you require technical assistance:
1. Contact SOCHI Support:
   - **Email**: `support@sochiconsulting.com`
   - **Phone**: Provided in your purchase agreement
2. When directed by a SOCHI technician, launch your approved remote support tool (e.g. **AnyDesk** or **TeamViewer**).
3. Provide the temporary connection code to the technician.
4. You can observe the technician's actions on your screen at all times.
5. Close the remote software as soon as the session concludes.
