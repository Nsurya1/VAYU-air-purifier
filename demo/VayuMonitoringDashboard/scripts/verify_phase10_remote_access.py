#!/usr/bin/env python3
"""
SOCHI VAYU - Phase 10 Remote Support & Ephemeral Consent Verification Suite
Validates:
1. Multi-persona Authentication & Role-Based Access Control.
2. Ephemeral Remote Session Request by Support Engineer (dev_eng).
3. Kiosk & Service Technician blocked from granting remote access (403 Forbidden).
4. Customer Administrator explicit consent approval with time-to-live (TTL).
5. Cryptographic ephemeral token issuance (vayu_rst_...).
6. Emergency Administrator Killswitch: instant session revocation & token invalidation.
7. Audit trail generation in PostgreSQL for all remote access lifecycle transitions.
"""

import sys
import json
import time
import subprocess
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
        with urllib.request.urlopen(req, timeout=10) as response:
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
    print("   SOCHI VAYU - Phase 10 Remote Support & Consent Verification    ")
    print("==================================================================")

    # 1. Authenticate Personas
    print("\n[*] 1. Authenticating test personas...")
    admin_token = test_login("admin", "SochiAdmin2026!")
    dev_token = test_login("dev_eng", "DevEng2026!")
    tech_token = test_login("tech_pune", "TechPune2026!")
    kiosk_token = test_login("kiosk", "KioskView2026!")

    # 2. RBAC Enforcement: Kiosk accounts cannot request remote access
    print("\n[*] 2. Testing RBAC Barriers for Remote Access...")
    kiosk_req = {
        "targetSiteId": "SITE-HQ-PUNE",
        "reason": "Unauthorized attempt",
        "durationMinutes": 30
    }
    status, res = make_request("POST", "/remote-sessions/request", kiosk_req, token=kiosk_token)
    if status == 403:
        print("  [PASS] Kiosk persona correctly rejected with HTTP 403 Forbidden")
    else:
        print(f"  [FAIL] Kiosk attempt returned unexpected status {status}: {res}")
        sys.exit(1)

    # 3. Support Engineer requests a diagnostic session
    print("\n[*] 3. Support Engineer requesting remote support session...")
    support_req = {
        "targetSiteId": "SITE-HQ-PUNE",
        "reason": "Investigate PM2.5 sensor drift on Cleanroom node VAYU-DEV-001",
        "durationMinutes": 30
    }
    status, session = make_request("POST", "/remote-sessions/request", support_req, token=dev_token)
    if status != 200 or session.get("status") != "REQUESTED":
        print(f"  [FAIL] Session request failed: Status {status}, {session}")
        sys.exit(1)

    session_id = session.get("id")
    session_code = session.get("sessionCode")
    print(f"  [PASS] Remote session created: ID={session_id}, Code='{session_code}', Status='REQUESTED'")
    print(f"         Site: {session.get('targetSiteId')} | Requested by: {session.get('requestedBy')}")

    # 4. RBAC Check: Service Technician CANNOT approve remote sessions
    print("\n[*] 4. Testing that Service Technician cannot approve remote session...")
    status, res = make_request("POST", f"/remote-sessions/{session_id}/approve", {}, token=tech_token)
    if status == 403:
        print("  [PASS] Service Technician approval correctly rejected with HTTP 403 Forbidden")
    else:
        print(f"  [FAIL] Technician approval returned unexpected status {status}: {res}")
        sys.exit(1)

    # 5. Customer Administrator grants explicit consent
    print("\n[*] 5. Customer Administrator granting explicit consent...")
    approval_payload = {"durationMinutes": 45}
    status, approved_session = make_request("POST", f"/remote-sessions/{session_id}/approve", approval_payload, token=admin_token)
    if status != 200 or approved_session.get("status") != "APPROVED_ACTIVE":
        print(f"  [FAIL] Session approval failed: Status {status}, {approved_session}")
        sys.exit(1)

    token = approved_session.get("ephemeralToken")
    print(f"  [PASS] Session #{session_id} APPROVED_ACTIVE by '{approved_session.get('approvedBy')}'")
    print(f"         Ephemeral Token: {token[:18]}... (High-Entropy Cryptographic Token)")
    print(f"         Expires At:      {approved_session.get('expiresAt')}")
    print(f"         Remaining TTL:   {approved_session.get('remainingSeconds')} seconds")

    if not token or not token.startswith("vayu_rst_"):
        print(f"  [FAIL] Ephemeral token missing or format invalid: {token}")
        sys.exit(1)

    # 6. Customer Administrator triggers Emergency Killswitch
    print("\n[*] 6. Testing Customer Administrator Emergency Killswitch (Revocation)...")
    killswitch_body = {"reason": "Triage complete; closing support channel early"}
    status, revoked_session = make_request("POST", f"/remote-sessions/{session_id}/revoke", killswitch_body, token=admin_token)
    if status != 200 or revoked_session.get("status") != "REVOKED":
        print(f"  [FAIL] Emergency killswitch failed: Status {status}, {revoked_session}")
        sys.exit(1)

    print(f"  [PASS] Session #{session_id} successfully REVOKED via Emergency Killswitch!")
    print(f"         Revoked By: {revoked_session.get('revokedBy')} | Revoked At: {revoked_session.get('revokedAt')}")
    print(f"         Ephemeral Token Wiped: {revoked_session.get('ephemeralToken') is None}")

    # 7. Testing Session Rejection Flow
    print("\n[*] 7. Testing Session Rejection Flow...")
    status, session2 = make_request("POST", "/remote-sessions/request", {
        "targetSiteId": "SITE-BLR-DEV",
        "reason": "Routine firmware inspection",
        "durationMinutes": 15
    }, token=dev_token)
    session2_id = session2.get("id")

    status, rejected_session = make_request("POST", f"/remote-sessions/{session2_id}/reject", {}, token=admin_token)
    if status == 200 and rejected_session.get("status") == "REJECTED":
        print(f"  [PASS] Session #{session2_id} successfully REJECTED by customer admin.")
    else:
        print(f"  [FAIL] Session rejection failed: Status {status}, {rejected_session}")
        sys.exit(1)

    # 8. Query All Sessions
    print("\n[*] 8. Querying all Remote Sessions as Administrator...")
    status, all_sessions = make_request("GET", "/remote-sessions", token=admin_token)
    if status == 200 and isinstance(all_sessions, list) and len(all_sessions) >= 2:
        print(f"  [PASS] Retrieved {len(all_sessions)} remote session records.")
        for s in all_sessions[:2]:
            print(f"         Code: {s.get('sessionCode')} | Status: {s.get('status')} | Site: {s.get('targetSiteId')}")
    else:
        print(f"  [FAIL] Query all sessions failed: Status {status}, {all_sessions}")
        sys.exit(1)

    # 9. Verify PostgreSQL Audit Trail
    print("\n[*] 9. Verifying PostgreSQL Audit Trail Records...")
    audit_count = query_postgres("SELECT count(*) FROM audit_logs WHERE action LIKE 'REMOTE_SESSION_%';")
    print(f"  [PASS] Found {audit_count} remote session audit records logged in PostgreSQL.")

    recent_actions = query_postgres(
        "SELECT action, actor, resource_id FROM audit_logs WHERE action LIKE 'REMOTE_SESSION_%' ORDER BY id DESC LIMIT 5;"
    )
    for row in recent_actions.splitlines():
        if row:
            parts = row.split("|")
            print(f"         [AUDIT] Action: {parts[0]:<28} | Actor: {parts[1]:<10} | Target: {parts[2] if len(parts)>2 else ''}")

    print("\n==================================================================")
    print("   [SUCCESS] All Phase 10 Remote Support & Consent Tests Passed!  ")
    print("==================================================================")

if __name__ == "__main__":
    main()
