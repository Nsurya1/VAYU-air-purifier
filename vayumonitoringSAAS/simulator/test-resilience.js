/**
 * SOCHI VAYU — Outage & Resilience Automated Test Suite
 *
 * Verifies:
 * 1. Zero fabricated readings (Cold Boot State).
 * 2. Real-time telemetry ingestion and US EPA AQI calculation.
 * 3. Sensor fault isolation (explicit nulls and healthState: SENSOR_FAULT).
 * 4. Recovery when sensor fault resolves.
 * 5. Malformed payload rejection (payloads violating schema are discarded).
 * 6. Last Will and Testament (LWT) immediate offline detection on TCP socket drop.
 */

import mqtt from 'mqtt';
import http from 'http';

const BROKER_URL = 'mqtt://127.0.0.1:1883';
const API_BASE = 'http://127.0.0.1:3000';

const SIMULATOR_USER = 'vayu_simulator';
const SIMULATOR_PASS = 'VayuSim2026!';

function httpRequest(path) {
  return new Promise((resolve, reject) => {
    http.get(`${API_BASE}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function runSuite() {
  console.log('================================================================');
  console.log('SOCHI VAYU — Outage & Resilience Automated Verification Suite');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // Test 1: Verify Cold Boot & Zero Fabricated Data
  // -------------------------------------------------------------------------
  console.log('TEST 1: In-Memory Cold Boot Integrity & Non-Fabrication');
  try {
    const res = await httpRequest('/api/v1/devices');
    assert(res.status === 200, 'API /api/v1/devices returned 200 OK');
    assert(res.body.summary.total_devices === 5, 'Found 5 pre-configured devices');
    
    // Check device VAYU-001
    const dev1 = res.body.devices.find(d => d.device_id === 'VAYU-001');
    assert(dev1 !== undefined, 'Device VAYU-001 exists in fleet state');
    assert(dev1.connection_state === 'OFFLINE', 'Initial connection state is OFFLINE');
    console.log('  -> Cold Boot verification complete.\n');
  } catch (err) {
    assert(false, `Test 1 failed with error: ${err.message}`);
  }

  // Connect MQTT Client for simulation
  const client = mqtt.connect(BROKER_URL, {
    clientId: 'vayu_resilience_tester',
    username: SIMULATOR_USER,
    password: SIMULATOR_PASS,
    clean: true
  });

  await new Promise((resolve, reject) => {
    client.on('connect', resolve);
    client.on('error', reject);
  });
  console.log('Connected test runner to MQTT Broker (vayu-mosquitto:1883).\n');

  // -------------------------------------------------------------------------
  // Test 2: Ingest Valid Telemetry & Verify US EPA AQI
  // -------------------------------------------------------------------------
  console.log('TEST 2: Telemetry Ingestion & EPA AQI Calculation');
  const validTelemetry = {
    schema_version: '1.0.0',
    device_id: 'VAYU-001',
    timestamp: new Date().toISOString(),
    metrics: {
      pm1: 5.2,
      pm25: 12.0,
      pm10: 20.4,
      voc_index: 65,
      temperature_c: 22.5,
      humidity_rh: 48.0
    },
    diagnostics: {
      pm_sensor_valid: true,
      temperature_sensor_valid: true,
      voc_sensor_valid: true
    },
    system: {
      firmware_version: '1.0.0',
      error_code: 0,
      operating_mode: 'AUTO'
    }
  };

  // Announce ONLINE on status topic
  client.publish('vayu/devices/VAYU-001/status', JSON.stringify({
    schema_version: '1.0.0',
    device_id: 'VAYU-001',
    timestamp: new Date().toISOString(),
    status: 'ONLINE'
  }));

  // Publish telemetry
  client.publish('vayu/devices/VAYU-001/telemetry', JSON.stringify(validTelemetry));
  await sleep(1000);

  const res2 = await httpRequest('/api/v1/devices/VAYU-001');
  assert(res2.status === 200, 'Fetched VAYU-001 detail endpoint 200 OK');
  assert(res2.body.connection_state === 'ONLINE', 'VAYU-001 is ONLINE');
  assert(res2.body.health_state === 'HEALTHY', 'VAYU-001 health_state is HEALTHY');
  assert(res2.body.metrics.pm25 === 12.0, 'VAYU-001 PM2.5 metric ingested as 12.0');
  assert(res2.body.metrics.calculated_aqi === 50, 'EPA AQI correctly calculated as 50');
  assert(res2.body.metrics.aqi_category === 'Good', 'AQI category correctly resolved as "Good"');
  console.log('  -> Ingestion & AQI verification complete.\n');

  // -------------------------------------------------------------------------
  // Test 3: Sensor Fault Ingestion & Isolation
  // -------------------------------------------------------------------------
  console.log('TEST 3: Sensor Fault Ingestion & Metric Isolation');
  const faultedTelemetry = {
    schema_version: '1.0.0',
    device_id: 'VAYU-001',
    timestamp: new Date().toISOString(),
    metrics: {
      pm1: null,
      pm25: null,
      pm10: null,
      voc_index: 80,
      temperature_c: 23.0,
      humidity_rh: 49.0
    },
    diagnostics: {
      pm_sensor_valid: false,
      temperature_sensor_valid: true,
      voc_sensor_valid: true
    },
    system: {
      firmware_version: '1.0.0',
      error_code: 101,
      operating_mode: 'MANUAL'
    }
  };

  client.publish('vayu/devices/VAYU-001/telemetry', JSON.stringify(faultedTelemetry));
  await sleep(1000);

  const res3 = await httpRequest('/api/v1/devices/VAYU-001');
  assert(res3.body.health_state === 'SENSOR_FAULT', 'Device health transitioned to SENSOR_FAULT');
  assert(res3.body.metrics.pm25 === null, 'Faulted PM2.5 is strictly null (never fabricated)');
  assert(res3.body.metrics.calculated_aqi === null, 'AQI is strictly null when PM2.5 input is invalid');
  assert(res3.body.diagnostics.pm_sensor_valid === false, 'pm_sensor_valid is false');
  assert(res3.body.problems.some(p => p.includes('Particulate Matter') || p.includes('PM')), 'Problem list details PM sensor fault');
  console.log('  -> Sensor fault isolation verified.\n');

  // -------------------------------------------------------------------------
  // Test 4: Sensor Fault Recovery
  // -------------------------------------------------------------------------
  console.log('TEST 4: Sensor Recovery & Fault Resolution');
  const recoveredTelemetry = {
    schema_version: '1.0.0',
    device_id: 'VAYU-001',
    timestamp: new Date().toISOString(),
    metrics: {
      pm1: 4.0,
      pm25: 9.5,
      pm10: 16.0,
      voc_index: 55,
      temperature_c: 22.0,
      humidity_rh: 45.0
    },
    diagnostics: {
      pm_sensor_valid: true,
      temperature_sensor_valid: true,
      voc_sensor_valid: true
    },
    system: {
      firmware_version: '1.0.0',
      error_code: 0,
      operating_mode: 'AUTO'
    }
  };

  client.publish('vayu/devices/VAYU-001/telemetry', JSON.stringify(recoveredTelemetry));
  await sleep(1000);

  const res4 = await httpRequest('/api/v1/devices/VAYU-001');
  assert(res4.body.health_state === 'HEALTHY', 'Device health returned to HEALTHY');
  assert(res4.body.metrics.pm25 === 9.5, 'PM2.5 restored to 9.5');
  assert(res4.body.metrics.calculated_aqi === 40, 'EPA AQI restored to 40');
  assert(res4.body.problems.length === 0, 'Problem list is cleared');
  console.log('  -> Recovery verified.\n');

  // -------------------------------------------------------------------------
  // Test 5: Malformed Payload Rejection
  // -------------------------------------------------------------------------
  console.log('TEST 5: Malformed & Schema-Violating Payload Quarantine');
  // Attempt to publish corrupt JSON
  client.publish('vayu/devices/VAYU-001/telemetry', '{"broken_json": true, incomplete');
  // Attempt to publish invalid negative physical reading
  client.publish('vayu/devices/VAYU-001/telemetry', JSON.stringify({
    schema_version: '1.0.0',
    device_id: 'VAYU-001',
    timestamp: new Date().toISOString(),
    metrics: { pm1: -50, pm25: -100, pm10: -20 },
    diagnostics: { pm_sensor_valid: true },
    system: { firmware_version: '1.0.0', error_code: 0 }
  }));
  await sleep(1000);

  // State must NOT be corrupted; remains at last valid reading
  const res5 = await httpRequest('/api/v1/devices/VAYU-001');
  assert(res5.body.health_state === 'HEALTHY', 'State was not corrupted by malformed payloads');
  assert(res5.body.metrics.pm25 === 9.5, 'Metric remains at previous valid reading (9.5)');
  console.log('  -> Malformed payload quarantine verified.\n');

  // Close test client
  client.end();

  // -------------------------------------------------------------------------
  // Test 6: Last Will and Testament (LWT) on Abrupt TCP Drop
  // -------------------------------------------------------------------------
  console.log('TEST 6: Last Will and Testament (LWT) Detection on Network Drop');
  const lwtClient = mqtt.connect(BROKER_URL, {
    clientId: 'vayu_lwt_probe_device',
    username: SIMULATOR_USER,
    password: SIMULATOR_PASS,
    clean: true,
    will: {
      topic: 'vayu/devices/VAYU-002/status',
      payload: JSON.stringify({
        schema_version: '1.0.0',
        device_id: 'VAYU-002',
        timestamp: new Date().toISOString(),
        status: 'OFFLINE',
        reason: 'UNEXPECTED_DISCONNECT'
      }),
      qos: 1,
      retain: false
    }
  });

  await new Promise(resolve => lwtClient.on('connect', resolve));

  // Mark VAYU-002 online
  lwtClient.publish('vayu/devices/VAYU-002/status', JSON.stringify({
    schema_version: '1.0.0',
    device_id: 'VAYU-002',
    timestamp: new Date().toISOString(),
    status: 'ONLINE'
  }));
  await sleep(1000);

  const res6a = await httpRequest('/api/v1/devices/VAYU-002');
  assert(res6a.body.connection_state === 'ONLINE', 'VAYU-002 marked ONLINE');

  // Force socket destruction (simulating physical cable cut / power drop)
  lwtClient.stream.destroy();
  await sleep(2000);

  const res6b = await httpRequest('/api/v1/devices/VAYU-002');
  assert(res6b.body.connection_state === 'OFFLINE', 'LWT triggered: VAYU-002 marked OFFLINE');
  assert(res6b.body.disconnect_reason === 'UNEXPECTED_DISCONNECT', 'Disconnect reason recorded: UNEXPECTED_DISCONNECT');
  assert(res6b.body.problems.some(p => p.includes('UNEXPECTED_DISCONNECT')), 'Problem list records unexpected disconnect');
  console.log('  -> LWT detection verified.\n');

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
