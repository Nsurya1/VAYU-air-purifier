# SOCHI VAYU — Standard Operating Procedure 02: Database Backup, Verification & Disaster Recovery Drill

**Document ID:** SOCHI-SOP-VAYU-002  
**Project:** SOCHI VAYU Industrial Air Quality Monitoring  
**Audience:** Site Reliability Engineers, Database Administrators & DevOps  
**Classification:** Internal Operating Procedure  

---

## 1. Objective

This procedure details the execution, verification, scheduling, and disaster recovery drill for PostgreSQL 16 backups supporting the SOCHI VAYU fleet monitoring database (`vayu_monitoring`).

---

## 2. Backup Architecture & Policy

* **Database Engine:** PostgreSQL 16-alpine container (`vayu-postgres`).
* **Dump Format:** Custom Compressed Archive (`-F c`), enabling parallel restoration, schema Table of Contents (TOC) inspection, and integrity checks.
* **Integrity Validation:** SHA-256 cryptographic digest generated alongside every archive file (`.dump.sha256`).
* **Retention Policy:** Default 7 days of daily snapshots, automatically keeping a minimum of 3 historical backups before pruning.
* **Backup Directory:** `D:\SochiProjects\VAYU\VayuMonitoringDashboard\backups\` (Windows) or `/opt/vayu/backups/` (Linux).

---

## 3. Manual Backup & Verification Commands

### Step 3.1: Create a Fresh Compressed Backup
Run the backup script with the `--backup` flag:

```powershell
python D:\SochiProjects\VAYU\VayuMonitoringDashboard\scripts\backup_restore.py --backup
```

Expected output:
```text
[*] Initiating PostgreSQL pg_dump for database 'vayu_monitoring'...
  [PASS] Backup snapshot created: vayu_monitoring_backup_20261022_153847Z.dump
         Size:     634.89 KB (650127 bytes)
         SHA-256:  33a92ba8e7d76c3332691ba76fe28ab6cba3c43cc51f3e027a205da7f8f15975
         Duration: 10.48s
```

### Step 3.2: Verify Archive Integrity & Table of Contents (TOC)
Verify that the dump has not experienced bit-rot and contains all 10 mandatory schemas:

```powershell
python D:\SochiProjects\VAYU\VayuMonitoringDashboard\scripts\backup_restore.py --verify D:\SochiProjects\VAYU\VayuMonitoringDashboard\backups\vayu_monitoring_backup_20261022_153847Z.dump
```

Expected output:
```text
[*] Verifying backup integrity: vayu_monitoring_backup_20261022_153847Z.dump...
  [PASS] Cryptographic SHA-256 digest verified (33a92ba8e7d76c33...).
  [PASS] Archive TOC validated. All 10 core schemas and tables present.
```

### Step 3.3: Execute Disaster Recovery Drill (Non-Destructive)
The DR Drill creates an isolated scratch database (`vayu_restore_drill`), restores the dump, and performs row-by-row count comparisons against the live production database:

```powershell
python D:\SochiProjects\VAYU\VayuMonitoringDashboard\scripts\backup_restore.py --drill D:\SochiProjects\VAYU\VayuMonitoringDashboard\backups\vayu_monitoring_backup_20261022_153847Z.dump
```

Expected output:
```text
[*] Executing Disaster Recovery Drill with: vayu_monitoring_backup_20261022_153847Z.dump...
  [*] Initializing clean drill target database 'vayu_restore_drill'...
  [*] Restoring schema and data into 'vayu_restore_drill'...
  [*] Validating Table Row Counts (Production vs. Restored Drill):
      Table Name             | Production | Drill Restored | Status
      -----------------------+------------+----------------+---------
      audit_logs             | 145        | 145            | MATCH
      device_events          | 9006       | 9006           | MATCH
      device_ota_history     | 127        | 127            | MATCH
      devices                | 31         | 31             | MATCH
      firmware_releases      | 3          | 3              | MATCH
      incidents              | 34         | 34             | MATCH
      ota_deployments        | 7          | 7              | MATCH
      sites                  | 2          | 2              | MATCH
      telemetry_records      | 19250      | 19250          | MATCH
      users                  | 4          | 4              | MATCH
  [PASS] Disaster Recovery Drill PASSED in 17.01s with 100% data parity!
```

---

## 4. Production Database Restoration (Disaster Recovery)

> [!CAUTION]
> Production restoration completely overwrites `vayu_monitoring`. All active client connections are terminated. This procedure must only be executed during a declared disaster recovery event or database migration.

Execute with the explicit `--confirm-destructive` flag:

```powershell
python D:\SochiProjects\VAYU\VayuMonitoringDashboard\scripts\backup_restore.py --restore D:\SochiProjects\VAYU\VayuMonitoringDashboard\backups\vayu_monitoring_backup_20261022_153847Z.dump --confirm-destructive
```

---

## 5. Automated Scheduling

### Windows 11 Gateway (Task Scheduler)
Create a daily scheduled task running at 02:00 AM UTC:

```powershell
$Action = New-ScheduledTaskAction -Execute "python.exe" -Argument "D:\SochiProjects\VAYU\VayuMonitoringDashboard\scripts\backup_restore.py --all-in-one"
$Trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
Register-ScheduledTask -TaskName "SochiVayu_DatabaseBackup" -Action $Action -Trigger $Trigger -Description "Daily automated SOCHI VAYU database backup and DR drill"
```

### Linux Gateway (Crontab)
Add the following line to `/etc/cron.d/vayu-backup`:

```cron
0 2 * * * root /usr/bin/python3 /opt/vayu/scripts/backup_restore.py --all-in-one >> /var/log/vayu_backup.log 2>&1
```
