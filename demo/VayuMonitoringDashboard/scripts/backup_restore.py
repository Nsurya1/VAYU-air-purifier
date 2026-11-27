#!/usr/bin/env python3
"""
SOCHI VAYU - Phase 9.1 Database Backup, Integrity Verification & Disaster Recovery Drill
Automated PostgreSQL 16 local backup management for industrial gateway hosts:
1. Automated compressed custom-format dumps (--backup) with SHA-256 integrity checksums.
2. Snapshot verification (--verify) inspecting archive Table of Contents (TOC).
3. Disaster Recovery Drill (--drill): non-destructive test restore into an isolated verification DB.
4. Production Point-In-Time Restoration (--restore --confirm-destructive).
5. Retention rotation (pruning backups older than N days).
"""

import sys
import os
import argparse
import hashlib
import time
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Optional

# Constants
CONTAINER_NAME = "vayu-postgres"
DB_NAME = "vayu_monitoring"
DB_USER = "vayu_admin"
DRILL_DB_NAME = "vayu_restore_drill"
DEFAULT_BACKUP_DIR = Path("D:/SochiProjects/VAYU/VayuMonitoringDashboard/backups")

MANDATORY_TABLES = [
    "audit_logs",
    "device_events",
    "device_ota_history",
    "devices",
    "firmware_releases",
    "incidents",
    "ota_deployments",
    "sites",
    "telemetry_records",
    "users",
]

def run_cmd(cmd: List[str], check: bool = True) -> subprocess.CompletedProcess:
    """Executes a command and returns the completed process."""
    result = subprocess.run(cmd, capture_output=True, text=True)
    if check and result.returncode != 0:
        raise RuntimeError(f"Command failed ({result.returncode}): {' '.join(cmd)}\nSTDERR: {result.stderr.strip()}")
    return result

def compute_sha256(file_path: Path) -> str:
    """Computes SHA-256 hexadecimal digest of a local file."""
    sha = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            sha.update(chunk)
    return sha.hexdigest()

def execute_sql(sql: str, db: str = DB_NAME) -> str:
    """Executes an SQL query inside the PostgreSQL container and returns stripped stdout."""
    cmd = [
        "docker", "exec", CONTAINER_NAME,
        "psql", "-U", DB_USER, "-d", db,
        "-t", "-A", "-c", sql
    ]
    return run_cmd(cmd).stdout.strip()

def get_table_counts(db: str = DB_NAME) -> Dict[str, int]:
    """Retrieves row counts for all mandatory tables."""
    queries = [f"SELECT '{t}', count(*) FROM {t}" for t in MANDATORY_TABLES]
    union_sql = " UNION ALL ".join(queries) + ";"
    output = execute_sql(union_sql, db=db)
    counts = {}
    for line in output.splitlines():
        if "|" in line:
            t, c = line.split("|")
            counts[t] = int(c)
    return counts

def create_backup(backup_dir: Path, retention_days: int = 7) -> Path:
    """Creates a compressed custom-format dump with cryptographic SHA-256 digest."""
    backup_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    dump_filename = f"vayu_monitoring_backup_{ts}.dump"
    container_tmp_path = f"/tmp/{dump_filename}"
    host_dest_path = backup_dir / dump_filename
    sha_path = backup_dir / f"{dump_filename}.sha256"

    print(f"\n[*] Initiating PostgreSQL pg_dump for database '{DB_NAME}'...")
    start_time = time.time()

    # 1. Run pg_dump inside container with custom format (-F c)
    dump_cmd = [
        "docker", "exec", CONTAINER_NAME,
        "pg_dump", "-U", DB_USER, "-d", DB_NAME,
        "-F", "c", "-b", "-v",
        "-f", container_tmp_path
    ]
    run_cmd(dump_cmd)

    # 2. Copy dump file to host
    cp_cmd = ["docker", "cp", f"{CONTAINER_NAME}:{container_tmp_path}", str(host_dest_path)]
    run_cmd(cp_cmd)

    # 3. Clean container tmp file
    rm_cmd = ["docker", "exec", CONTAINER_NAME, "rm", "-f", container_tmp_path]
    run_cmd(rm_cmd)

    # 4. Generate SHA-256 digest
    sha256_digest = compute_sha256(host_dest_path)
    with open(sha_path, "w", encoding="utf-8") as f:
        f.write(f"{sha256_digest}  {dump_filename}\n")

    file_size_bytes = host_dest_path.stat().st_size
    duration = time.time() - start_time

    print(f"  [PASS] Backup snapshot created: {host_dest_path.name}")
    print(f"         Size:     {file_size_bytes / 1024:.2f} KB ({file_size_bytes} bytes)")
    print(f"         SHA-256:  {sha256_digest}")
    print(f"         Duration: {duration:.2f}s")

    # 5. Apply Retention Policy
    apply_retention_policy(backup_dir, retention_days)

    return host_dest_path

def apply_retention_policy(backup_dir: Path, retention_days: int):
    """Prunes dump files older than retention_days, keeping at least the 3 latest backups."""
    dump_files = sorted(backup_dir.glob("vayu_monitoring_backup_*.dump"), key=lambda p: p.stat().st_mtime)
    if len(dump_files) <= 3:
        return  # Always preserve at least 3 historical snapshots

    cutoff_time = time.time() - (retention_days * 86400)
    pruned_count = 0

    # Never delete the last 3 files
    eligible_for_prune = dump_files[:-3]
    for dump in eligible_for_prune:
        if dump.stat().st_mtime < cutoff_time:
            sha_file = dump.with_suffix(".dump.sha256")
            dump.unlink(missing_ok=True)
            if sha_file.exists():
                sha_file.unlink(missing_ok=True)
            print(f"  [RETENTION] Pruned expired backup: {dump.name}")
            pruned_count += 1

    if pruned_count > 0:
        print(f"  [RETENTION] Removed {pruned_count} expired backups older than {retention_days} days.")

def verify_backup(dump_path: Path) -> bool:
    """Verifies SHA-256 checksum and TOC archive validity."""
    print(f"\n[*] Verifying backup integrity: {dump_path.name}...")
    sha_path = dump_path.with_suffix(".dump.sha256")

    # 1. Checksum Verification
    if not sha_path.exists():
        print(f"  [FAIL] Missing SHA-256 verification file: {sha_path.name}")
        return False

    with open(sha_path, "r", encoding="utf-8") as f:
        expected_sha = f.read().split()[0].strip()

    actual_sha = compute_sha256(dump_path)
    if actual_sha.lower() != expected_sha.lower():
        print(f"  [FAIL] Cryptographic Checksum Mismatch!")
        print(f"         Expected: {expected_sha}")
        print(f"         Actual:   {actual_sha}")
        return False
    print(f"  [PASS] Cryptographic SHA-256 digest verified ({actual_sha[:16]}...).")

    # 2. Inspect pg_restore Table of Contents (TOC)
    container_tmp = f"/tmp/verify_{dump_path.name}"
    run_cmd(["docker", "cp", str(dump_path), f"{CONTAINER_NAME}:{container_tmp}"])

    try:
        toc_res = run_cmd(["docker", "exec", CONTAINER_NAME, "pg_restore", "-l", container_tmp])
        toc_output = toc_res.stdout
        missing_tables = [t for t in MANDATORY_TABLES if f"TABLE public {t}" not in toc_output]
        if missing_tables:
            print(f"  [FAIL] Archive TOC is missing mandatory tables: {missing_tables}")
            return False

        print(f"  [PASS] Archive TOC validated. All {len(MANDATORY_TABLES)} core schemas and tables present.")
        return True
    finally:
        run_cmd(["docker", "exec", CONTAINER_NAME, "rm", "-f", container_tmp], check=False)

def disaster_recovery_drill(dump_path: Path) -> bool:
    """Restores backup to an isolated verification DB and compares row counts."""
    print(f"\n[*] Executing Disaster Recovery Drill with: {dump_path.name}...")
    start_time = time.time()

    if not verify_backup(dump_path):
        print("  [FAIL] Pre-restore verification failed! Aborting drill.")
        return False

    container_tmp = f"/tmp/drill_{dump_path.name}"
    run_cmd(["docker", "cp", str(dump_path), f"{CONTAINER_NAME}:{container_tmp}"])

    try:
        # 1. Get baseline row counts from production
        prod_counts = get_table_counts(DB_NAME)

        # 2. Terminate connections and recreate drill database
        print(f"  [*] Initializing clean drill target database '{DRILL_DB_NAME}'...")
        execute_sql(f"DROP DATABASE IF EXISTS {DRILL_DB_NAME};", db="postgres")
        execute_sql(f"CREATE DATABASE {DRILL_DB_NAME} OWNER {DB_USER};", db="postgres")

        # 3. Restore into drill database
        print(f"  [*] Restoring schema and data into '{DRILL_DB_NAME}'...")
        restore_cmd = [
            "docker", "exec", CONTAINER_NAME,
            "pg_restore", "-U", DB_USER, "-d", DRILL_DB_NAME,
            "--no-owner", "--role=" + DB_USER,
            container_tmp
        ]
        # pg_restore may return 0 or exit with warnings (return code 1) on role notices
        res = run_cmd(restore_cmd, check=False)
        if res.returncode > 1:
            print(f"  [FAIL] Restore failed with fatal code {res.returncode}: {res.stderr}")
            return False

        # 4. Compare row counts between production and restored drill database
        drill_counts = get_table_counts(DRILL_DB_NAME)
        all_match = True

        print(f"  [*] Validating Table Row Counts (Production vs. Restored Drill):")
        print(f"      {'Table Name':<22} | {'Production':<10} | {'Drill Restored':<14} | {'Status'}")
        print(f"      {'-'*22}-+-{'-'*10}-+-{'-'*14}-+-{'-'*8}")

        for t in MANDATORY_TABLES:
            p_cnt = prod_counts.get(t, 0)
            d_cnt = drill_counts.get(t, 0)
            status = "MATCH" if p_cnt == d_cnt else "MISMATCH"
            if p_cnt != d_cnt:
                all_match = False
            print(f"      {t:<22} | {p_cnt:<10} | {d_cnt:<14} | {status}")

        if not all_match:
            print("  [FAIL] Data discrepancies detected between production and restored snapshot!")
            return False

        duration = time.time() - start_time
        print(f"  [PASS] Disaster Recovery Drill PASSED in {duration:.2f}s with 100% data parity!")
        return True

    finally:
        # Clean up drill database and temporary file
        execute_sql(f"DROP DATABASE IF EXISTS {DRILL_DB_NAME};", db="postgres")
        run_cmd(["docker", "exec", CONTAINER_NAME, "rm", "-f", container_tmp], check=False)

def restore_database(dump_path: Path, confirm_destructive: bool = False) -> bool:
    """Restores database into production vayu_monitoring."""
    print(f"\n[!] WARNING: Production Database Restore Requested for '{DB_NAME}'")
    if not confirm_destructive:
        print("  [FAIL] Safety Lock Active: You must supply '--confirm-destructive' to execute production restore.")
        return False

    if not verify_backup(dump_path):
        print("  [FAIL] Backup verification failed! Aborting production restore.")
        return False

    container_tmp = f"/tmp/restore_{dump_path.name}"
    run_cmd(["docker", "cp", str(dump_path), f"{CONTAINER_NAME}:{container_tmp}"])

    try:
        # Terminate active client connections
        print(f"  [*] Disconnecting active sessions on '{DB_NAME}'...")
        term_sql = f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{DB_NAME}' AND pid <> pg_backend_pid();"
        execute_sql(term_sql, db="postgres")

        # Recreate clean production DB
        print(f"  [*] Resetting database '{DB_NAME}'...")
        execute_sql(f"DROP DATABASE IF EXISTS {DB_NAME};", db="postgres")
        execute_sql(f"CREATE DATABASE {DB_NAME} OWNER {DB_USER};", db="postgres")

        # Restore
        print(f"  [*] Executing pg_restore...")
        restore_cmd = [
            "docker", "exec", CONTAINER_NAME,
            "pg_restore", "-U", DB_USER, "-d", DB_NAME,
            "--no-owner", "--role=" + DB_USER,
            container_tmp
        ]
        res = run_cmd(restore_cmd, check=False)
        if res.returncode > 1:
            print(f"  [FAIL] Restore failed with code {res.returncode}: {res.stderr}")
            return False

        # Validate restored tables
        counts = get_table_counts(DB_NAME)
        print(f"  [PASS] Database successfully restored from {dump_path.name}:")
        for t, c in counts.items():
            print(f"         {t:<22}: {c} rows")
        return True

    finally:
        run_cmd(["docker", "exec", CONTAINER_NAME, "rm", "-f", container_tmp], check=False)

def main():
    parser = argparse.ArgumentParser(description="SOCHI VAYU - PostgreSQL Backup & Recovery Manager")
    parser.add_argument("--backup", action="store_true", help="Create a fresh compressed database snapshot")
    parser.add_argument("--verify", type=str, help="Verify SHA-256 and TOC for a specified backup file")
    parser.add_argument("--drill", type=str, help="Execute non-destructive disaster recovery drill using specified backup")
    parser.add_argument("--restore", type=str, help="Restore database into production from specified backup")
    parser.add_argument("--confirm-destructive", action="store_true", help="Explicit confirmation required for production restore")
    parser.add_argument("--backup-dir", type=str, default=str(DEFAULT_BACKUP_DIR), help="Directory to store backup dumps")
    parser.add_argument("--retention-days", type=int, default=7, help="Number of days to keep historical backups")
    parser.add_argument("--all-in-one", action="store_true", help="Run full pipeline: Backup -> Verify -> Recovery Drill")

    args = parser.parse_args()
    backup_dir = Path(args.backup_dir)

    print("==================================================================")
    print("   SOCHI VAYU - Industrial Database Backup & Recovery Engine     ")
    print("==================================================================")
    print(f"Target Container:  {CONTAINER_NAME}")
    print(f"Target Database:   {DB_NAME}")
    print(f"Backup Directory:  {backup_dir}")

    if args.all_in_one:
        dump_path = create_backup(backup_dir, args.retention_days)
        if not verify_backup(dump_path):
            sys.exit(1)
        if not disaster_recovery_drill(dump_path):
            sys.exit(1)
        print("\n==================================================================")
        print("   [SUCCESS] Full Backup & Disaster Recovery Drill Complete!     ")
        print("==================================================================")
        return

    if args.backup:
        create_backup(backup_dir, args.retention_days)

    elif args.verify:
        p = Path(args.verify)
        if not p.is_file():
            print(f"File not found: {p}")
            sys.exit(1)
        if not verify_backup(p):
            sys.exit(1)

    elif args.drill:
        p = Path(args.drill)
        if not p.is_file():
            print(f"File not found: {p}")
            sys.exit(1)
        if not disaster_recovery_drill(p):
            sys.exit(1)

    elif args.restore:
        p = Path(args.restore)
        if not p.is_file():
            print(f"File not found: {p}")
            sys.exit(1)
        if not restore_database(p, confirm_destructive=args.confirm_destructive):
            sys.exit(1)

    else:
        parser.print_help()

if __name__ == "__main__":
    main()
