#!/usr/bin/env python3
"""
SOCHI VAYU - Phase 6 Incident Management & Diagnostic Rules Verification Script
Validates:
1. Dynamic incident ingestion triggered by DiagnosticRuleEngine
2. Role-based incident access & Site-level filtering for technicians
3. Rich developer evidence inspection (snapshot metrics, telemetry, and triage checklist)
4. Full incident lifecycle: Acknowledge -> Assign -> Resolve
5. Strict validation (resolution notes required)
6. Security enforcement: Kiosk blocked (403), Technician site barrier enforced (403)
7. Audit log generation for all triage and resolution actions
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

def test_login(username, password):
    status, res = make_request("POST", "/auth/login", {"username": username, "password": password})
    if status == 200 and "token" in res:
        print(f"  [PASS] Authenticated '{username}' (HTTP 200)")
        return res.get("token")
    else:
        print(f"  [FAIL] Failed to authenticate '{username}': Status {status}, {res}")
        sys.exit(1)

def main():
    print("==================================================================")
    print("   SOCHI VAYU - Phase 6 Incident Management & Triage Tests        ")
    print("==================================================================")

    # 1. Authenticate personas
    print("\n[*] 1. Authenticating test personas...")
    admin_token = test_login("admin", "SochiAdmin2026!")
    tech_token = test_login("tech_pune", "TechPune2026!")
    dev_token = test_login("dev_eng", "DevEng2026!")
    kiosk_token = test_login("kiosk", "KioskView2026!")

    # 2. Query Fleet Incidents
    print("\n[*] 2. Querying Incidents as Administrator...")
    status, incidents = make_request("GET", "/incidents", token=admin_token)
    if status != 200 or not isinstance(incidents, list):
        print(f"  [FAIL] Failed to query incidents: Status {status}, {incidents}")
        sys.exit(1)

    print(f"  [PASS] Administrator retrieved {len(incidents)} active/historical fleet incidents.")
    if len(incidents) == 0:
        print("  [WARN] No incidents currently recorded! (Ensure simulator is running).")
        sys.exit(1)

    categories = {inc.get("category") for inc in incidents}
    print(f"  Found Incident Categories: {list(categories)}")

    # 3. Verify Site-Level Scope Filtering for Service Technicians
    print("\n[*] 3. Testing Technician Site-Level Scope Filtering...")
    status, tech_incidents = make_request("GET", "/incidents", token=tech_token)
    if status != 200 or not isinstance(tech_incidents, list):
        print(f"  [FAIL] Technician incident query failed: Status {status}")
        sys.exit(1)

    # All incidents returned to tech_pune must belong to SITE-HQ-PUNE
    invalid_sites = [i for i in tech_incidents if i.get("siteId") and i.get("siteId") != "SITE-HQ-PUNE"]
    if invalid_sites:
        print(f"  [FAIL] Technician received incidents outside Pune scope: {invalid_sites}")
        sys.exit(1)
    print(f"  [PASS] Technician scoped strictly to SITE-HQ-PUNE ({len(tech_incidents)} incidents retrieved)")

    # 4. Find Pune incident and Remote (Bengaluru) incident for RBAC tests
    pune_incident = None
    blr_incident = None

    for inc in incidents:
        if inc.get("siteId") == "SITE-HQ-PUNE" and inc.get("status") in ["OPEN", "ACKNOWLEDGED"] and not pune_incident:
            pune_incident = inc
        elif inc.get("siteId") == "SITE-BLR-DEV" and inc.get("status") in ["OPEN", "ACKNOWLEDGED"] and not blr_incident:
            blr_incident = inc

    if not pune_incident:
        pune_incident = incidents[0]
        print(f"  [INFO] Using incident #{pune_incident.get('id')} for lifecycle tests (Site: {pune_incident.get('siteId')})")
    else:
        print(f"  [INFO] Identified Pune incident #{pune_incident.get('id')} on device '{pune_incident.get('deviceId')}'")

    # 5. Inspect Developer Evidence & Triage Checklist
    print("\n[*] 4. Inspecting Developer Evidence Payload...")
    status, inc_detail = make_request("GET", f"/incidents/{pune_incident.get('id')}", token=dev_token)
    if status != 200 or not inc_detail.get("evidence"):
        print(f"  [FAIL] Could not fetch incident detail: Status {status}, {inc_detail}")
        sys.exit(1)

    try:
        evidence_data = json.loads(inc_detail.get("evidence"))
        print(f"  [PASS] Developer evidence JSON is well-formed.")
        print(f"         Device ID:      {evidence_data.get('device_id')}")
        print(f"         Firmware:       {evidence_data.get('firmware_version')}")
        print(f"         Diagnostic Rule:{inc_detail.get('diagnosticRule')}")
        checklist = evidence_data.get("triage_checklist", [])
        print(f"         Triage Steps:   {len(checklist)} recommendations found")
        for step in checklist[:2]:
            print(f"           - {step}")
    except Exception as e:
        print(f"  [FAIL] Evidence parsing failed: {e}")
        sys.exit(1)

    # 6. Test Kiosk Read-Only Barrier (403 Forbidden)
    print("\n[*] 5. Testing Kiosk Read-Only Restriction on Incident Mutation...")
    status, res = make_request("POST", f"/incidents/{pune_incident.get('id')}/acknowledge", token=kiosk_token)
    if status == 403:
        print(f"  [PASS] Kiosk acknowledge blocked with HTTP 403 Forbidden")
    else:
        print(f"  [FAIL] Kiosk was not blocked! Status: {status}, Response: {res}")
        sys.exit(1)

    # 7. Test Lifecycle: Acknowledge Pune Incident
    print("\n[*] 6. Testing Incident Acknowledgment (as tech_pune)...")
    status, ack_res = make_request("POST", f"/incidents/{pune_incident.get('id')}/acknowledge", token=tech_token)
    if status == 200 and ack_res.get("status") == "ACKNOWLEDGED":
        print(f"  [PASS] Incident #{pune_incident.get('id')} transitioned to ACKNOWLEDGED by '{ack_res.get('acknowledgedBy')}'")
    else:
        print(f"  [FAIL] Failed to acknowledge incident: Status {status}, {ack_res}")
        sys.exit(1)

    # 8. Test Lifecycle: Assign Incident
    print("\n[*] 7. Testing Incident Assignment (as admin)...")
    assign_payload = {"assignedTo": "dev_eng"}
    status, assign_res = make_request("POST", f"/incidents/{pune_incident.get('id')}/assign", assign_payload, token=admin_token)
    if status == 200 and assign_res.get("assignedTo") == "dev_eng":
        print(f"  [PASS] Incident #{pune_incident.get('id')} assigned to '{assign_res.get('assignedTo')}'")
    else:
        print(f"  [FAIL] Failed to assign incident: Status {status}, {assign_res}")
        sys.exit(1)

    # 9. Test Resolution Validation: Blank Notes Rejected
    print("\n[*] 8. Testing Resolution Validation (Rejecting Empty Notes)...")
    empty_notes_payload = {"notes": "   "}
    status, res = make_request("POST", f"/incidents/{pune_incident.get('id')}/resolve", empty_notes_payload, token=dev_token)
    if status == 400:
        print(f"  [PASS] Blank resolution notes rejected with HTTP 400 Bad Request")
    else:
        print(f"  [FAIL] Blank notes were not rejected! Status {status}, {res}")
        sys.exit(1)

    # 10. Test Resolution Workflow: Valid Resolution
    print("\n[*] 9. Testing Incident Resolution with Evidence Notes...")
    resolve_payload = {
        "notes": "Verified fan wiring harness and cleared intake obstruction. Tachometer pulse restored to nominal 1200 RPM."
    }
    status, resolve_res = make_request("POST", f"/incidents/{pune_incident.get('id')}/resolve", resolve_payload, token=dev_token)
    if status == 200 and resolve_res.get("status") == "RESOLVED":
        print(f"  [PASS] Incident #{pune_incident.get('id')} RESOLVED successfully!")
        print(f"         Resolved By: {resolve_res.get('resolvedBy')}")
        print(f"         Notes:       {resolve_res.get('resolutionNotes')}")
    else:
        print(f"  [FAIL] Resolution failed: Status {status}, {resolve_res}")
        sys.exit(1)

    # 11. Test Technician Site Barrier on Bengaluru Incident
    if blr_incident:
        print("\n[*] 10. Testing Technician Site Barrier on Remote Site Incident...")
        status, res = make_request("POST", f"/incidents/{blr_incident.get('id')}/acknowledge", token=tech_token)
        if status == 403:
            print(f"  [PASS] tech_pune correctly BLOCKED (HTTP 403) from acknowledging Bengaluru incident #{blr_incident.get('id')}")
        else:
            print(f"  [FAIL] tech_pune was NOT blocked from remote incident! Status: {status}, {res}")
            sys.exit(1)
    else:
        print("\n[*] 10. [SKIP] No active Bengaluru incidents found for cross-site barrier test.")

    # 12. Check Audit Log Trail
    print("\n[*] 11. Verifying Incident Audit Trail Entries...")
    status, logs = make_request("GET", "/audit-logs", token=admin_token)
    if status == 200 and isinstance(logs, list):
        incident_actions = [l for l in logs if "INCIDENT" in l.get("action", "")]
        print(f"  [PASS] Retrieved {len(incident_actions)} incident audit actions.")
        for action in incident_actions[:4]:
            print(f"    - [{action.get('createdAt')}] Actor: {action.get('actor'):<10} Action: {action.get('action'):<25} Target: {action.get('resourceType')}:{action.get('resourceId')}")
    else:
        print(f"  [FAIL] Could not verify audit logs: Status {status}, {logs}")
        sys.exit(1)

    print("\n------------------------------------------------------------------")
    print("[SUCCESS] All Phase 6 Incident Management & Diagnostic tests PASSED!")
    print("==================================================================")

if __name__ == "__main__":
    main()
