#!/usr/bin/env python3
"""
SOCHI VAYU - Phase 5 Authentication & RBAC Verification Script
Validates:
1. Admin, Technician, Dev Engineer, and Kiosk logins
2. JWT Token generation & authentication
3. Site-level authorization barriers for service technicians
4. Read-only restriction for Kiosk persona
5. Full audit log trail generation & verification
"""

import sys
import json
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:8081/api"

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

def test_login(username, password, expected_status=200):
    status, res = make_request("POST", "/auth/login", {"username": username, "password": password})
    if status == expected_status:
        print(f"  [PASS] Login '{username}' returned HTTP {status}")
        return res.get("token")
    else:
        print(f"  [FAIL] Login '{username}' expected {expected_status}, got {status}: {res}")
        sys.exit(1)

def main():
    print("==================================================================")
    print("   SOCHI VAYU - Phase 5 Authentication & Authorization Tests      ")
    print("==================================================================")

    # 1. Test Login with All Personas
    print("\n[*] 1. Testing Persona Logins...")
    admin_token = test_login("admin", "SochiAdmin2026!")
    tech_token = test_login("tech_pune", "TechPune2026!")
    dev_token = test_login("dev_eng", "DevEng2026!")
    kiosk_token = test_login("kiosk", "KioskView2026!")

    # Bad login
    print("\n[*] 2. Testing Invalid Credentials Rejection...")
    status, res = make_request("POST", "/auth/login", {"username": "admin", "password": "WrongPassword!"})
    if status == 401:
        print("  [PASS] Invalid password correctly rejected with HTTP 401 Unauthorized")
    else:
        print(f"  [FAIL] Invalid password returned unexpected status: {status}")
        sys.exit(1)

    # 2. Test User Profile Me Endpoint
    print("\n[*] 3. Testing Current User Profile (/auth/me)...")
    status, res = make_request("GET", "/auth/me", token=tech_token)
    if status == 200 and res.get("siteScope") == "SITE-HQ-PUNE" and res.get("role") == "ROLE_SERVICE_TECH":
        print(f"  [PASS] tech_pune profile confirmed: Role={res.get('role')}, Scope={res.get('siteScope')}")
    else:
        print(f"  [FAIL] /auth/me unexpected profile: {res}")
        sys.exit(1)

    # 3. Test Kiosk Read-Only Enforcement
    print("\n[*] 4. Testing Kiosk Persona Command Prevention (Read-Only Guard)...")
    cmd_payload = {"command": "SET_FAN", "fan_pct": 50}
    status, res = make_request("POST", "/devices/VAYU-DEV-001/commands", cmd_payload, token=kiosk_token)
    if status == 403:
        print(f"  [PASS] Kiosk command blocked with HTTP 403 Forbidden: {res.get('message')}")
    else:
        print(f"  [FAIL] Kiosk command not blocked! Status: {status}, Response: {res}")
        sys.exit(1)

    # 4. Test Site-Level Technician Command Isolation
    print("\n[*] 5. Testing Technician Site Isolation Barriers...")
    # Pune device: VAYU-DEV-001 belongs to SITE-HQ-PUNE -> MUST SUCCEED
    status, res = make_request("POST", "/devices/VAYU-DEV-001/commands", cmd_payload, token=tech_token)
    if status == 200:
        print(f"  [PASS] tech_pune authorized to command local Pune device 'VAYU-DEV-001'")
    else:
        print(f"  [FAIL] tech_pune failed to command local device: Status {status}, {res}")
        sys.exit(1)

    # Bengaluru device: VAYU-DEV-020 belongs to SITE-BLR-DEV -> MUST BE REJECTED 403
    status, res = make_request("POST", "/devices/VAYU-DEV-020/commands", cmd_payload, token=tech_token)
    if status == 403 and res.get("error") == "SITE_AUTHORIZATION_DENIED":
        print(f"  [PASS] tech_pune correctly BLOCKED from commanding Bengaluru device 'VAYU-DEV-020'")
        print(f"         Reason: {res.get('message')}")
    else:
        print(f"  [FAIL] tech_pune was NOT blocked from remote site device! Status: {status}, {res}")
        sys.exit(1)

    # 5. Test Admin Override across all sites
    print("\n[*] 6. Testing Admin Fleet-Wide Override...")
    status, res = make_request("POST", "/devices/VAYU-DEV-020/commands", cmd_payload, token=admin_token)
    if status == 200:
        print(f"  [PASS] admin authorized to command Bengaluru device 'VAYU-DEV-020'")
    else:
        print(f"  [FAIL] admin failed to command Bengaluru device: Status {status}, {res}")
        sys.exit(1)

    # 6. Test Audit Log API & Role Permissions
    print("\n[*] 7. Testing Audit Trail API & Role Guard...")
    # Technician should be blocked (403) from viewing system-wide audit logs
    status, res = make_request("GET", "/audit-logs", token=tech_token)
    if status == 403:
        print("  [PASS] tech_pune forbidden from accessing system audit logs (HTTP 403)")
    else:
        print(f"  [FAIL] tech_pune improperly accessed audit logs: Status {status}")
        sys.exit(1)

    # Admin should receive audit logs
    status, res = make_request("GET", "/audit-logs", token=admin_token)
    if status == 200 and isinstance(res, list) and len(res) > 0:
        print(f"  [PASS] admin retrieved {len(res)} audit log records")
        print("  Recent Audit Entries:")
        for entry in res[:4]:
            print(f"    - [{entry.get('createdAt')}] Actor: {entry.get('actor'):<10} Action: {entry.get('action'):<25} Target: {entry.get('resourceType')}:{entry.get('resourceId')}")
    else:
        print(f"  [FAIL] Failed to retrieve audit logs as admin: Status {status}, {res}")
        sys.exit(1)

    print("\n------------------------------------------------------------------")
    print("[SUCCESS] All Phase 5 Authentication & Authorization checks PASSED!")
    print("==================================================================")

if __name__ == "__main__":
    main()
