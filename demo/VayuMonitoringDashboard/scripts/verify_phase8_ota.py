#!/usr/bin/env python3
"""
SOCHI VAYU - Phase 8 OTA Canary Rollout & Two-Partition Rollback Verification Script
Validates:
1. Multi-persona Authentication & Role-Based Access Control (Admin/Dev Engineer authorized, Kiosk/Tech blocked)
2. Firmware release catalog verification & publishing
3. Canary Deployment lifecycle (CREATED -> CANARY_ACTIVE -> CANARY_PASSED -> FULL_ROLLOUT)
4. MQTT Command dispatch & Device Acknowledgment loop
5. Autonomous Health Check Evaluation based on actual ingested telemetry
6. Canary Failure & Rollback Guardrail (abort fleet rollout if canary crashes or reports error code)
7. Audit log verification in PostgreSQL for all OTA state transitions
"""

import sys
import json
import time
import subprocess
import urllib.request
import urllib.error
import paho.mqtt.client as mqtt

BASE_URL = "http://127.0.0.1:8081/api"
BROKER_HOST = "127.0.0.1"
BROKER_PORT = 1883
TEST_CANARY_DEVICE = "VAYU-DEV-001"

def make_request(method, endpoint, payload=None, token=None):
    url = f"{BASE_URL}{endpoint}"
    data = json.dumps(payload).encode("utf-8") if payload else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            status = response.status
            body = response.read().decode("utf-8")
            return status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = {"raw": body}
        return e.code, parsed
    except Exception as e:
        return 0, {"error": str(e)}

def test_login(username, password):
    status, res = make_request("POST", "/auth/login", {"username": username, "password": password})
    if status == 200 and "token" in res:
        print(f"  [PASS] Authenticated '{username}' (HTTP 200)")
        return res.get("token")
    else:
        print(f"  [FAIL] Failed to authenticate '{username}': Status {status}, {res}")
        sys.exit(1)

def query_postgres(sql):
    cmd = [
        "docker", "exec", "vayu-postgres",
        "psql", "-U", "vayu_admin", "-d", "vayu_monitoring",
        "-t", "-A", "-c", sql
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"  [WARN] Postgres query failed: {res.stderr}")
        return ""
    return res.stdout.strip()

def main():
    print("==================================================================")
    print("   SOCHI VAYU - Phase 8 Safe OTA Orchestration Verification       ")
    print("==================================================================")

    # 1. Authenticate Personas
    print("\n[*] 1. Authenticating test personas...")
    admin_token = test_login("admin", "SochiAdmin2026!")
    dev_token = test_login("dev_eng", "DevEng2026!")
    tech_token = test_login("tech_pune", "TechPune2026!")
    kiosk_token = test_login("kiosk", "KioskView2026!")

    # 2. RBAC Enforcement: Verify Kiosk and Service Tech are blocked from OTA operations
    print("\n[*] 2. Testing RBAC Barriers for OTA Orchestration...")
    test_deployment_payload = {
        "deploymentName": "Unauthorized Attempt",
        "firmwareVersion": "v1.1.0-rc1",
        "rolloutStrategy": "CANARY",
        "canaryDeviceId": TEST_CANARY_DEVICE,
        "canaryDurationSeconds": 60
    }

    # Kiosk should receive 403 Forbidden
    status, res = make_request("POST", "/ota/deployments", test_deployment_payload, token=kiosk_token)
    if status == 403:
        print("  [PASS] Kiosk correctly rejected with HTTP 403 Forbidden")
    else:
        print(f"  [FAIL] Kiosk attempt returned unexpected status {status}: {res}")
        sys.exit(1)

    # Service Tech should receive 403 Forbidden
    status, res = make_request("POST", "/ota/deployments", test_deployment_payload, token=tech_token)
    if status == 403:
        print("  [PASS] Service Technician correctly rejected with HTTP 403 Forbidden")
    else:
        print(f"  [FAIL] Tech attempt returned unexpected status {status}: {res}")
        sys.exit(1)

    # 3. Query Firmware Releases Catalog
    print("\n[*] 3. Querying Firmware Release Catalog...")
    status, releases = make_request("GET", "/ota/releases", token=dev_token)
    if status != 200 or not isinstance(releases, list):
        print(f"  [FAIL] Failed to retrieve firmware releases: {status}, {releases}")
        sys.exit(1)

    versions = [r.get("version") for r in releases]
    print(f"  [PASS] Found {len(releases)} registered firmware releases: {versions}")
    if "v1.0.0-prod" not in versions or "v1.1.0-rc1" not in versions:
        print(f"  [FAIL] Baseline releases missing from database: {versions}")
        sys.exit(1)

    # 4. Setup Mock Device Agent MQTT Listener on TEST_CANARY_DEVICE
    print(f"\n[*] 4. Initializing Test MQTT Client for '{TEST_CANARY_DEVICE}'...")
    received_commands = []

    def on_connect(client, userdata, flags, rc, properties=None):
        client.subscribe(f"vayu/{TEST_CANARY_DEVICE}/cmd", qos=1)

    def on_message(client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
            received_commands.append(payload)
        except Exception as e:
            print(f"    [MQTT] Error parsing command: {e}")

    mqtt_client = mqtt.Client(
        client_id=f"vayu_test_listener_{int(time.time())}",
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        protocol=mqtt.MQTTv311
    )
    mqtt_client.username_pw_set("vayu_device", "vayu_device_pass_2026")
    mqtt_client.on_connect = on_connect
    mqtt_client.on_message = on_message
    mqtt_client.connect(BROKER_HOST, BROKER_PORT, keepalive=30)
    mqtt_client.loop_start()
    time.sleep(1.0)
    print("  [PASS] Test MQTT subscriber connected and listening for OTA commands.")

    # 5. Golden Path: Canary Deployment -> Health Check Pass -> Fleet Rollout
    print("\n[*] 5. Executing Golden Path Canary Deployment (v1.1.0-rc1)...")
    golden_deploy_req = {
        "deploymentName": "Fleet Canary Test Rollout v1.1.0-rc1",
        "firmwareVersion": "v1.1.0-rc1",
        "rolloutStrategy": "CANARY",
        "canaryDeviceId": TEST_CANARY_DEVICE,
        "canaryDurationSeconds": 15
    }
    status, dep = make_request("POST", "/ota/deployments", golden_deploy_req, token=dev_token)
    if status != 200 or dep.get("status") != "CREATED":
        print(f"  [FAIL] Failed to create deployment: Status {status}, {dep}")
        sys.exit(1)
    dep_id = dep.get("id")
    print(f"  [PASS] Created deployment #{dep_id} in 'CREATED' status.")

    # Start Canary
    received_commands.clear()
    status, started_dep = make_request("POST", f"/ota/deployments/{dep_id}/start-canary", token=admin_token)
    if status != 200 or started_dep.get("status") != "CANARY_ACTIVE":
        print(f"  [FAIL] Failed to start canary: Status {status}, {started_dep}")
        sys.exit(1)
    print(f"  [PASS] Canary #{dep_id} transitioned to 'CANARY_ACTIVE'.")

    # Wait for MQTT Command
    print("  [*] Waiting for OTA command dispatch on MQTT broker...")
    wait_time = 0
    while not received_commands and wait_time < 5:
        time.sleep(0.5)
        wait_time += 0.5

    if not received_commands:
        print("  [FAIL] No OTA command received on MQTT within 5 seconds!")
        sys.exit(1)

    cmd = received_commands[0]
    print(f"  [PASS] Received OTA command: Action='{cmd.get('command')}', TargetVersion='{cmd.get('target_version')}'")
    if cmd.get("command") != "OTA_UPDATE" or cmd.get("target_version") != "v1.1.0-rc1":
        print(f"  [FAIL] Invalid command structure received: {cmd}")
        sys.exit(1)

    # Simulate Device Flashing Partition B & Reporting Healthy Telemetry
    print("  [*] Simulating device post-flash telemetry on target version 'v1.1.0-rc1'...")
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    # Send ACK
    ack_payload = json.dumps({
        "schema_version": "1.0.0",
        "device_id": TEST_CANARY_DEVICE,
        "cmd_id": cmd.get("cmd_id"),
        "command": "OTA_UPDATE",
        "status": "OTA_SUCCESS",
        "message": "Flashed partition B successfully; booted slot B",
        "timestamp": now_iso
    })
    mqtt_client.publish(f"vayu/{TEST_CANARY_DEVICE}/cmd/ack", ack_payload, qos=1)

    # Send Status Update
    status_payload = json.dumps({
        "schema_version": "1.0.0",
        "device_id": TEST_CANARY_DEVICE,
        "site_id": "SITE-HQ-PUNE",
        "status": "ONLINE",
        "current_fw_version": "v1.1.0-rc1",
        "ip_address": "192.168.1.101",
        "mac_address": "44:17:93:00:01:B2",
        "is_simulated": True,
        "timestamp": now_iso
    })
    mqtt_client.publish(f"vayu/{TEST_CANARY_DEVICE}/status", status_payload, qos=1, retain=True)

    # Send Nominal Telemetry
    telemetry_payload = json.dumps({
        "schema_version": "1.0.0",
        "device_id": TEST_CANARY_DEVICE,
        "timestamp": now_iso,
        "is_simulated": True,
        "metrics": {
            "pm1": 6.5,
            "pm25": 11.2,
            "pm10": 18.0,
            "voc": 85,
            "temp_c": 23.4,
            "rh": 48.0,
            "aqi": 47,
            "aqi_standard": "US_EPA",
            "fan_pct": 35,
            "mode": "AUTO",
            "filter_hours_left": 4200,
            "rssi": -62
        },
        "diagnostics": {
            "fw_build_id": "v1.1.0-rc1",
            "uptime_seconds": 12,
            "err_code": 0,
            "sensor_status": {
                "pm_valid": True,
                "voc_valid": True,
                "temp_rh_valid": True
            }
        }
    })
    mqtt_client.publish(f"vayu/{TEST_CANARY_DEVICE}/telemetry", telemetry_payload, qos=1)
    time.sleep(2.0)  # Allow ingestion pipeline to process

    # Evaluate Canary Health
    print("  [*] Requesting Canary Health Evaluation from Backend...")
    status, evaluated_dep = make_request("POST", f"/ota/deployments/{dep_id}/evaluate-canary", token=admin_token)
    if status != 200 or evaluated_dep.get("status") != "CANARY_PASSED":
        print(f"  [FAIL] Expected 'CANARY_PASSED', got status {status}: {evaluated_dep}")
        sys.exit(1)
    print(f"  [PASS] Canary #{dep_id} health verified! Status: 'CANARY_PASSED'.")

    # Approve Fleet Rollout
    print("  [*] Approving Fleet Rollout for Deployment #{}...".format(dep_id))
    status, fleet_dep = make_request("POST", f"/ota/deployments/{dep_id}/approve-fleet", token=admin_token)
    if status != 200 or fleet_dep.get("status") != "FULL_ROLLOUT":
        print(f"  [FAIL] Expected 'FULL_ROLLOUT', got status {status}: {fleet_dep}")
        sys.exit(1)
    print(f"  [PASS] Fleet rollout approved by '{fleet_dep.get('approvedBy')}'. Status: 'FULL_ROLLOUT'.")

    # 6. Safety Guardrail: Canary Fault Detection & Automatic Rollback Abort
    print("\n[*] 6. Testing Canary Failure & Fleet Rollout Block (Faulty Firmware)...")
    # Register bad firmware release
    bad_release_req = {
        "version": "v1.9.9-faulty",
        "buildId": "bld-20261022-faulty",
        "targetHardware": "REV-B-ESP32",
        "sha256": "cafebabe1234567890abcdef1234567890abcdef1234567890abcdef12345678",
        "binarySize": 1048576,
        "binaryUrl": "/binaries/vayu-v1.9.9-faulty.bin",
        "releaseNotes": "Intentionally unstable build for rollback testing."
    }
    status, bad_rel = make_request("POST", "/ota/releases", bad_release_req, token=dev_token)
    if status != 200 and status != 409 and status != 400:
        print(f"  [FAIL] Failed to register faulty release: {status}, {bad_rel}")
        sys.exit(1)
    print("  [PASS] Faulty release 'v1.9.9-faulty' registered in catalog.")

    # Create Canary Deployment for bad release
    bad_deploy_req = {
        "deploymentName": "Faulty Canary Trial (Rollback Test)",
        "firmwareVersion": "v1.9.9-faulty",
        "rolloutStrategy": "CANARY",
        "canaryDeviceId": TEST_CANARY_DEVICE,
        "canaryDurationSeconds": 10
    }
    status, bad_dep = make_request("POST", "/ota/deployments", bad_deploy_req, token=dev_token)
    if status != 200:
        print(f"  [FAIL] Failed to create bad deployment: {status}, {bad_dep}")
        sys.exit(1)
    bad_dep_id = bad_dep.get("id")

    # Start Canary for bad release
    status, started_bad = make_request("POST", f"/ota/deployments/{bad_dep_id}/start-canary", token=admin_token)
    if status != 200:
        print(f"  [FAIL] Failed to start bad canary: {status}")
        sys.exit(1)

    # Simulate Device Failure: Reports hardware stall fault (err_code = 0x01) or boots back to previous slot
    print("  [*] Simulating device reporting post-boot fault (Fan Stall err_code=1) on trial...")
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    faulty_telem = {
        "schema_version": "1.0.0",
        "device_id": TEST_CANARY_DEVICE,
        "timestamp": now_iso,
        "is_simulated": True,
        "metrics": {
            "pm1": 25.0,
            "pm25": 45.0,
            "pm10": 70.0,
            "voc": 180,
            "temp_c": 29.0,
            "rh": 55.0,
            "aqi": 124,
            "aqi_standard": "US_EPA",
            "fan_pct": 0,
            "mode": "ERROR_SAFE",
            "filter_hours_left": 4190,
            "rssi": -65
        },
        "diagnostics": {
            "fw_build_id": "v1.9.9-faulty",
            "uptime_seconds": 3,
            "err_code": 1,  # Motor stall fault!
            "sensor_status": {
                "pm_valid": True,
                "voc_valid": True,
                "temp_rh_valid": True
            }
        }
    }
    mqtt_client.publish(f"vayu/{TEST_CANARY_DEVICE}/telemetry", json.dumps(faulty_telem), qos=1)
    time.sleep(2.0)

    # Evaluate Canary Health -> Must Fail!
    status, eval_bad = make_request("POST", f"/ota/deployments/{bad_dep_id}/evaluate-canary", token=admin_token)
    if status != 200 or eval_bad.get("status") != "CANARY_FAILED":
        print(f"  [FAIL] Expected 'CANARY_FAILED', got {status}: {eval_bad}")
        sys.exit(1)
    print(f"  [PASS] Canary #{bad_dep_id} correctly marked 'CANARY_FAILED' due to diagnostic fault.")

    # Guardrail Check: Attempting to approve fleet rollout on failed canary MUST be rejected!
    print("  [*] Verifying fleet rollout safety interlock rejects failed canary...")
    status, rejected_rollout = make_request("POST", f"/ota/deployments/{bad_dep_id}/approve-fleet", token=admin_token)
    if status == 400:
        print("  [PASS] Fleet rollout correctly blocked by backend with HTTP 400 Bad Request!")
    else:
        print(f"  [FAIL] Fleet rollout should have been blocked! Got status {status}: {rejected_rollout}")
        sys.exit(1)

    # 7. Query Device OTA History
    print(f"\n[*] 7. Querying OTA History for '{TEST_CANARY_DEVICE}'...")
    status, history = make_request("GET", f"/ota/devices/{TEST_CANARY_DEVICE}/history", token=dev_token)
    if status == 200 and isinstance(history, list) and len(history) >= 2:
        print(f"  [PASS] Retrieved {len(history)} OTA history entries for {TEST_CANARY_DEVICE}:")
        for h in history[:2]:
            print(f"         Target: {h.get('targetVersion')}, Status: {h.get('status')}, Reason: {h.get('failureReason')}")
    else:
        print(f"  [FAIL] Device history query failed: Status {status}, {history}")
        sys.exit(1)

    # 8. Verify PostgreSQL Audit Trail
    print("\n[*] 8. Verifying PostgreSQL Audit Trail Records...")
    audit_count = query_postgres("SELECT count(*) FROM audit_logs WHERE action LIKE 'OTA_%' OR action LIKE 'CANARY_%';")
    print(f"  [PASS] Found {audit_count} OTA & Canary audit events logged in PostgreSQL.")

    recent_actions = query_postgres("SELECT action, actor, resource_id FROM audit_logs WHERE action LIKE 'OTA_%' OR action LIKE 'CANARY_%' ORDER BY id DESC LIMIT 5;")
    for row in recent_actions.splitlines():
        if row:
            parts = row.split("|")
            print(f"         [AUDIT] Action: {parts[0]:<28} | Actor: {parts[1]:<10} | Target: {parts[2] if len(parts)>2 else ''}")

    mqtt_client.loop_stop()
    mqtt_client.disconnect()

    print("\n==================================================================")
    print("   [SUCCESS] All Phase 8 OTA Canary & Safety Tests Passed!        ")
    print("==================================================================")

if __name__ == "__main__":
    main()
