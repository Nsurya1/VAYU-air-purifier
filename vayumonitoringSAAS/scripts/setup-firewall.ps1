# ==============================================================================
# SOCHI VAYU — Windows Firewall Configuration Script
# ==============================================================================
# This script configures Windows Defender Firewall inbound rules to allow:
# 1. Local network access to the VAYU Dashboard (TCP port 3000)
# 2. VAYU purifier telemetry ingestion to Mosquitto MQTT (TCP port 1883)
#
# Rules are strictly bound to 'Private' and 'Domain' network profiles.
# Public/untrusted network profiles remain blocked to protect customer premises.
# ==============================================================================

# Require Administrator privileges
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "CRITICAL: This script must be run as Administrator in PowerShell."
    Write-Host "Right-click PowerShell and choose 'Run as Administrator', then re-run this script." -ForegroundColor Yellow
    exit 1
}

Write-Host "Configuring Windows Defender Firewall for SOCHI VAYU..." -ForegroundColor Cyan

# 1. Rule for Dashboard UI (Port 3000)
$uiRuleName = "SOCHI VAYU - Dashboard Web Interface (TCP 3000)"
$existingUiRule = Get-NetFirewallRule -DisplayName $uiRuleName -ErrorAction SilentlyContinue

if ($existingUiRule) {
    Write-Host "[-] Firewall rule already exists: $uiRuleName (updating...)" -ForegroundColor Yellow
    Remove-NetFirewallRule -DisplayName $uiRuleName
}

New-NetFirewallRule `
    -DisplayName $uiRuleName `
    -Description "Allows local network access to the SOCHI VAYU real-time monitoring web dashboard from PCs, tablets, and TVs." `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort 3000 `
    -Profile Private, Domain `
    -Enabled True | Out-Null

Write-Host "[+] Created inbound rule: $uiRuleName (TCP 3000, Private/Domain)" -ForegroundColor Green

# 2. Rule for Purifier MQTT Telemetry (Port 1883)
$mqttRuleName = "SOCHI VAYU - Purifier MQTT Ingestion (TCP 1883)"
$existingMqttRule = Get-NetFirewallRule -DisplayName $mqttRuleName -ErrorAction SilentlyContinue

if ($existingMqttRule) {
    Write-Host "[-] Firewall rule already exists: $mqttRuleName (updating...)" -ForegroundColor Yellow
    Remove-NetFirewallRule -DisplayName $mqttRuleName
}

New-NetFirewallRule `
    -DisplayName $mqttRuleName `
    -Description "Allows VAYU air purifiers on the customer local network to publish telemetry to the Mosquitto MQTT broker." `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort 1883 `
    -Profile Private, Domain `
    -Enabled True | Out-Null

Write-Host "[+] Created inbound rule: $mqttRuleName (TCP 1883, Private/Domain)" -ForegroundColor Green

Write-Host "`nFirewall configuration completed successfully." -ForegroundColor Cyan
Write-Host "Customers can access the dashboard at: http://<MONITORING-PC-LOCAL-IP>:3000" -ForegroundColor White
Write-Host "Purifiers can publish telemetry to:    mqtt://<MONITORING-PC-LOCAL-IP>:1883" -ForegroundColor White
