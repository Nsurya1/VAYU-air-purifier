# ==============================================================================
# SOCHI VAYU — Windows Firewall Cleanup Script
# ==============================================================================
# Removes inbound rules created for the SOCHI VAYU monitoring system.
# Run this script when uninstalling or decommissioning the monitoring PC.
# ==============================================================================

# Require Administrator privileges
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "CRITICAL: This script must be run as Administrator in PowerShell."
    exit 1
}

$rules = @(
    "SOCHI VAYU - Dashboard Web Interface (TCP 3000)",
    "SOCHI VAYU - Purifier MQTT Ingestion (TCP 1883)"
)

foreach ($rule in $rules) {
    $existing = Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue
    if ($existing) {
        Remove-NetFirewallRule -DisplayName $rule
        Write-Host "[-] Removed rule: $rule" -ForegroundColor Yellow
    } else {
        Write-Host "[ ] Rule not found: $rule (already removed)" -ForegroundColor Gray
    }
}

Write-Host "Firewall cleanup completed." -ForegroundColor Green
