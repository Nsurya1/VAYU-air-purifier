import mqtt from 'mqtt';
import dotenv from 'dotenv';

dotenv.config();

const BROKER_HOST = process.env.MQTT_BROKER_HOST || 'localhost';
const BROKER_PORT = parseInt(process.env.MQTT_BROKER_PORT || '1883', 10);
const USERNAME = process.env.MQTT_USERNAME || 'vayu_simulator';
const PASSWORD = process.env.MQTT_PASSWORD || 'VayuSim2026!';
const DEVICE_COUNT = parseInt(process.env.DEVICE_COUNT || '5', 10);
const INTERVAL_SECONDS = parseInt(process.env.INTERVAL_SECONDS || '5', 10);

const BROKER_URL = `mqtt://${BROKER_HOST}:${BROKER_PORT}`;

console.log(`[VAYU-SIM] Initializing Fleet Simulator...`);
console.log(`[VAYU-SIM] Broker: ${BROKER_URL} | Auth User: ${USERNAME}`);
console.log(`[VAYU-SIM] Fleet Size: ${DEVICE_COUNT} devices | Interval: ${INTERVAL_SECONDS}s`);

// Predefined room configurations for realistic deployment topology
const ROOMS = [
  'Conference Room 2A',
  'Executive Boardroom',
  'Open Workspace East',
  'Server Room B1',
  'Cafeteria & Lounge',
  'Medical Bay / Wellness',
  'Lab Cleanroom 1',
  'Training Hall C'
];

class SimulatedDevice {
  constructor(index) {
    this.id = `VAYU-${String(index + 1).padStart(3, '0')}`;
    this.room = ROOMS[index % ROOMS.length];
    this.client = null;
    this.state = 'NORMAL'; // NORMAL, SENSOR_FAULT_PM, SENSOR_FAULT_TEMP, CORRUPT_PAYLOAD, OFFLINE
    this.timer = null;
    this.basePm25 = 8 + (index * 4); // Distinct baseline air conditions per room
    this.baseVoc = 60 + (index * 15);
    this.baseTemp = 22.0 + (index * 0.4);
    this.baseHumidity = 45.0 + (index * 2);
  }

  connect() {
    const lwtTopic = `vayu/devices/${this.id}/status`;
    const lwtPayload = JSON.stringify({
      schema_version: '1.0.0',
      device_id: this.id,
      status: 'OFFLINE',
      timestamp: new Date().toISOString(),
      reason: 'UNEXPECTED_DISCONNECT',
      is_simulated: true
    });

    this.client = mqtt.connect(BROKER_URL, {
      clientId: `sim_${this.id}_${Math.random().toString(16).substring(2, 8)}`,
      username: USERNAME,
      password: PASSWORD,
      clean: true,
      keepalive: 15,
      will: {
        topic: lwtTopic,
        payload: lwtPayload,
        qos: 1,
        retain: true
      }
    });

    this.client.on('connect', () => {
      console.log(`[${this.id}] Connected to broker. Publishing ONLINE status.`);
      this.publishStatus('ONLINE');
      this.startTelemetryLoop();
    });

    this.client.on('error', (err) => {
      console.error(`[${this.id}] MQTT Error:`, err.message);
    });

    this.client.on('close', () => {
      console.log(`[${this.id}] Connection closed.`);
    });
  }

  publishStatus(status, reason = null) {
    if (!this.client || !this.client.connected) return;
    const topic = `vayu/devices/${this.id}/status`;
    const payload = {
      schema_version: '1.0.0',
      device_id: this.id,
      status: status,
      timestamp: new Date().toISOString(),
      firmware_version: '1.0.0',
      room: this.room,
      is_simulated: true
    };
    if (reason) payload.reason = reason;

    this.client.publish(topic, JSON.stringify(payload), { qos: 1, retain: true });
  }

  startTelemetryLoop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.publishTelemetry();
    }, INTERVAL_SECONDS * 1000);
  }

  stopTelemetryLoop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  publishTelemetry() {
    if (!this.client || !this.client.connected || this.state === 'OFFLINE') return;

    const topic = `vayu/devices/${this.id}/telemetry`;

    if (this.state === 'CORRUPT_PAYLOAD') {
      // Intentionally publish malformed JSON
      console.log(`[${this.id}] [SIM-FAULT] Emitting corrupt payload for backend validation test`);
      this.client.publish(topic, '{"device_id": "' + this.id + '", "metrics": {BROKEN_JSON', { qos: 1 });
      return;
    }

    // Small natural fluctuations
    const jitter = () => (Math.random() - 0.5) * 1.5;
    const pmJitter = () => (Math.random() - 0.5) * 2.5;

    let pmValid = true;
    let tempValid = true;
    let vocValid = true;

    let pm25 = parseFloat(Math.max(1.0, this.basePm25 + pmJitter()).toFixed(1));
    let pm1 = parseFloat(Math.max(0.5, (pm25 * 0.4) + jitter()).toFixed(1));
    let pm10 = parseFloat(Math.max(pm25, (pm25 * 1.6) + jitter()).toFixed(1));
    let voc = Math.round(Math.max(10, this.baseVoc + (jitter() * 5)));
    let temp = parseFloat((this.baseTemp + (jitter() * 0.3)).toFixed(1));
    let humidity = parseFloat(Math.min(99.0, Math.max(10.0, this.baseHumidity + jitter())).toFixed(1));

    // Handle sensor fault states (Rule: explicit nulls when invalid, never fabricated values)
    if (this.state === 'SENSOR_FAULT_PM') {
      pmValid = false;
      pm1 = null;
      pm25 = null;
      pm10 = null;
    } else if (this.state === 'SENSOR_FAULT_TEMP') {
      tempValid = false;
      temp = null;
      humidity = null;
    }

    const payload = {
      schema_version: '1.0.0',
      device_id: this.id,
      timestamp: new Date().toISOString(),
      is_simulated: true,
      metrics: {
        pm1: pm1,
        pm25: pm25,
        pm10: pm10,
        voc_index: voc,
        temperature_c: temp,
        humidity_rh: humidity
      },
      diagnostics: {
        pm_sensor_valid: pmValid,
        temperature_sensor_valid: tempValid,
        voc_sensor_valid: vocValid
      },
      system: {
        firmware_version: '1.0.0',
        error_code: (!pmValid || !tempValid) ? 101 : 0,
        operating_mode: 'AUTO'
      }
    };

    this.client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (!err) {
        const pmStr = pmValid ? `PM2.5: ${pm25} µg/m³` : `PM: [SENSOR_FAULT]`;
        const tempStr = tempValid ? `${temp}°C` : `Temp: [FAULT]`;
        console.log(`[${this.id}] Telemetry sent -> ${pmStr} | VOC: ${voc} | ${tempStr} | State: ${this.state}`);
      }
    });
  }

  // Fault injection helper: Trigger unexpected network loss (forcing broker to send LWT)
  simulateUnexpectedDisconnect() {
    console.log(`[${this.id}] [SIM-FAULT] Triggering abrupt socket destruction (LWT test)...`);
    this.stopTelemetryLoop();
    this.state = 'OFFLINE';
    if (this.client && this.client.stream) {
      this.client.stream.destroy(); // Abruptly destroy underlying TCP socket
    }
  }

  // Fault injection helper: Graceful disconnect
  simulateGracefulDisconnect() {
    console.log(`[${this.id}] [SIM-SCENARIO] Executing graceful shutdown...`);
    this.stopTelemetryLoop();
    this.state = 'OFFLINE';
    this.publishStatus('OFFLINE', 'GRACEFUL_SHUTDOWN');
    setTimeout(() => {
      if (this.client) this.client.end();
    }, 500);
  }

  // Recovery helper
  recover() {
    console.log(`[${this.id}] [SIM-RECOVERY] Restoring healthy state...`);
    this.state = 'NORMAL';
    if (!this.client || !this.client.connected) {
      this.connect();
    } else {
      this.publishStatus('ONLINE');
      this.startTelemetryLoop();
    }
  }
}

// Instantiate devices
const fleet = [];
for (let i = 0; i < DEVICE_COUNT; i++) {
  const dev = new SimulatedDevice(i);
  fleet.push(dev);
  // Stagger connections slightly to mimic real world startup
  setTimeout(() => dev.connect(), i * 400);
}

// Automated Demonstration Lifecycle Scenarios
// Cycles through simulated faults every 45 seconds to exercise all edge cases
const runDemoCycle = () => {
  let step = 0;
  setInterval(() => {
    step = (step + 1) % 5;
    if (fleet.length < 3) return;

    if (step === 1) {
      console.log('\n>>> [SIM-DEMO] Scenario 1: Injecting PM sensor fault into VAYU-002 <<<');
      fleet[1].state = 'SENSOR_FAULT_PM';
    } else if (step === 2) {
      console.log('\n>>> [SIM-DEMO] Scenario 2: Inducing unexpected network disconnect on VAYU-003 (LWT test) <<<');
      fleet[2].simulateUnexpectedDisconnect();
    } else if (step === 3) {
      console.log('\n>>> [SIM-DEMO] Scenario 3: Recovering VAYU-002 and VAYU-003 <<<');
      fleet[1].recover();
      fleet[2].recover();
    } else if (step === 4) {
      console.log('\n>>> [SIM-DEMO] Scenario 4: Injecting Temperature sensor fault into VAYU-001 <<<');
      fleet[0].state = 'SENSOR_FAULT_TEMP';
    } else if (step === 0) {
      console.log('\n>>> [SIM-DEMO] Scenario 0: Restoring all devices to Normal <<<');
      fleet[0].recover();
    }
  }, 45000);
};

runDemoCycle();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[VAYU-SIM] Shutting down simulator fleet gracefully...');
  fleet.forEach(dev => dev.simulateGracefulDisconnect());
  setTimeout(() => process.exit(0), 1000);
});
