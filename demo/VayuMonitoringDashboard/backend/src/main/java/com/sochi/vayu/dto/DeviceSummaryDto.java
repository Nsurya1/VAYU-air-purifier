package com.sochi.vayu.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public class DeviceSummaryDto {
    private String deviceId;
    private String siteId;
    private String model;
    private String currentFwVersion;
    private String onlineStatus;
    private OffsetDateTime lastSeenAt;
    private boolean simulated;

    private BigDecimal pm25;
    private Integer aqi;
    private Integer fanPct;
    private String mode;
    private Integer filterHoursLeft;
    private Integer rssi;
    private Integer errCode;
    private String healthBadge; // "NORMAL", "WARNING", "CRITICAL", "OFFLINE"

    public DeviceSummaryDto() {}

    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }
    public String getSiteId() { return siteId; }
    public void setSiteId(String siteId) { this.siteId = siteId; }
    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
    public String getCurrentFwVersion() { return currentFwVersion; }
    public void setCurrentFwVersion(String currentFwVersion) { this.currentFwVersion = currentFwVersion; }
    public String getOnlineStatus() { return onlineStatus; }
    public void setOnlineStatus(String onlineStatus) { this.onlineStatus = onlineStatus; }
    public OffsetDateTime getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(OffsetDateTime lastSeenAt) { this.lastSeenAt = lastSeenAt; }
    public boolean isSimulated() { return simulated; }
    public void setSimulated(boolean simulated) { this.simulated = simulated; }
    public BigDecimal getPm25() { return pm25; }
    public void setPm25(BigDecimal pm25) { this.pm25 = pm25; }
    public Integer getAqi() { return aqi; }
    public void setAqi(Integer aqi) { this.aqi = aqi; }
    public Integer getFanPct() { return fanPct; }
    public void setFanPct(Integer fanPct) { this.fanPct = fanPct; }
    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }
    public Integer getFilterHoursLeft() { return filterHoursLeft; }
    public void setFilterHoursLeft(Integer filterHoursLeft) { this.filterHoursLeft = filterHoursLeft; }
    public Integer getRssi() { return rssi; }
    public void setRssi(Integer rssi) { this.rssi = rssi; }
    public Integer getErrCode() { return errCode; }
    public void setErrCode(Integer errCode) { this.errCode = errCode; }
    public String getHealthBadge() { return healthBadge; }
    public void setHealthBadge(String healthBadge) { this.healthBadge = healthBadge; }
}
