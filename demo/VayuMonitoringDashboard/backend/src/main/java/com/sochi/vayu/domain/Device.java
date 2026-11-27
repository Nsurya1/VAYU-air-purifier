package com.sochi.vayu.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "devices")
public class Device {

    @Id
    @Column(name = "device_id", length = 64)
    private String deviceId;

    @Column(name = "site_id", length = 64)
    private String siteId;

    @Column(name = "model", nullable = false, length = 64)
    private String model = "VAYU-AirPurifier-Pro";

    @Column(name = "hardware_rev", nullable = false, length = 32)
    private String hardwareRev = "REV-A";

    @Column(name = "mac_address", length = 32)
    private String macAddress;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "current_fw_version", nullable = false, length = 32)
    private String currentFwVersion = "v1.0.0-rc1";

    @Column(name = "online_status", nullable = false, length = 20)
    private String onlineStatus = "OFFLINE";

    @Column(name = "last_seen_at")
    private OffsetDateTime lastSeenAt;

    @Column(name = "is_simulated", nullable = false)
    private boolean simulated = true;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    public Device() {}

    public Device(String deviceId, String siteId, boolean simulated) {
        this.deviceId = deviceId;
        this.siteId = siteId;
        this.simulated = simulated;
        this.onlineStatus = "OFFLINE";
        this.createdAt = OffsetDateTime.now();
        this.updatedAt = OffsetDateTime.now();
    }

    public String getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(String deviceId) {
        this.deviceId = deviceId;
    }

    public String getSiteId() {
        return siteId;
    }

    public void setSiteId(String siteId) {
        this.siteId = siteId;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getHardwareRev() {
        return hardwareRev;
    }

    public void setHardwareRev(String hardwareRev) {
        this.hardwareRev = hardwareRev;
    }

    public String getMacAddress() {
        return macAddress;
    }

    public void setMacAddress(String macAddress) {
        this.macAddress = macAddress;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public String getCurrentFwVersion() {
        return currentFwVersion;
    }

    public void setCurrentFwVersion(String currentFwVersion) {
        this.currentFwVersion = currentFwVersion;
    }

    public String getOnlineStatus() {
        return onlineStatus;
    }

    public void setOnlineStatus(String onlineStatus) {
        this.onlineStatus = onlineStatus;
        this.updatedAt = OffsetDateTime.now();
    }

    public OffsetDateTime getLastSeenAt() {
        return lastSeenAt;
    }

    public void setLastSeenAt(OffsetDateTime lastSeenAt) {
        this.lastSeenAt = lastSeenAt;
        this.updatedAt = OffsetDateTime.now();
    }

    public boolean isSimulated() {
        return simulated;
    }

    public void setSimulated(boolean simulated) {
        this.simulated = simulated;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(OffsetDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
