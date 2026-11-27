package com.sochi.vayu.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;

@JsonIgnoreProperties(ignoreUnknown = true)
public class DeviceStatusPayloadDto {

    @JsonProperty("schema_version")
    private String schemaVersion;

    @JsonProperty("device_id")
    private String deviceId;

    @JsonProperty("site_id")
    private String siteId;

    @JsonProperty("status")
    private String status;

    @JsonProperty("reason")
    private String reason;

    @JsonProperty("current_fw_version")
    private String currentFwVersion;

    @JsonProperty("ip_address")
    private String ipAddress;

    @JsonProperty("mac_address")
    private String macAddress;

    @JsonProperty("is_simulated")
    private Boolean simulated;

    @JsonProperty("timestamp")
    private OffsetDateTime timestamp;

    public String getSchemaVersion() { return schemaVersion; }
    public void setSchemaVersion(String schemaVersion) { this.schemaVersion = schemaVersion; }
    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }
    public String getSiteId() { return siteId; }
    public void setSiteId(String siteId) { this.siteId = siteId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getCurrentFwVersion() { return currentFwVersion; }
    public void setCurrentFwVersion(String currentFwVersion) { this.currentFwVersion = currentFwVersion; }
    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
    public String getMacAddress() { return macAddress; }
    public void setMacAddress(String macAddress) { this.macAddress = macAddress; }
    public Boolean getSimulated() { return simulated; }
    public void setSimulated(Boolean simulated) { this.simulated = simulated; }
    public OffsetDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(OffsetDateTime timestamp) { this.timestamp = timestamp; }
}
