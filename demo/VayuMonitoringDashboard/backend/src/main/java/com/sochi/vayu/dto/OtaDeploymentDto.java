package com.sochi.vayu.dto;

import java.time.OffsetDateTime;
import java.util.List;

public class OtaDeploymentDto {
    private Long id;
    private String deploymentName;
    private String firmwareVersion;
    private String rolloutStrategy;
    private String canaryDeviceId;
    private Integer canaryDurationSeconds;
    private String status;
    private String approvedBy;
    private OffsetDateTime approvedAt;
    private OffsetDateTime createdAt;
    private String createdBy;
    private List<DeviceOtaHistoryDto> deviceHistory;

    public static class DeviceOtaHistoryDto {
        private String deviceId;
        private String targetVersion;
        private String previousVersion;
        private String status;
        private String failureReason;
        private OffsetDateTime updatedAt;

        public String getDeviceId() { return deviceId; }
        public void setDeviceId(String deviceId) { this.deviceId = deviceId; }
        public String getTargetVersion() { return targetVersion; }
        public void setTargetVersion(String targetVersion) { this.targetVersion = targetVersion; }
        public String getPreviousVersion() { return previousVersion; }
        public void setPreviousVersion(String previousVersion) { this.previousVersion = previousVersion; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public String getFailureReason() { return failureReason; }
        public void setFailureReason(String failureReason) { this.failureReason = failureReason; }
        public OffsetDateTime getUpdatedAt() { return updatedAt; }
        public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getDeploymentName() { return deploymentName; }
    public void setDeploymentName(String deploymentName) { this.deploymentName = deploymentName; }
    public String getFirmwareVersion() { return firmwareVersion; }
    public void setFirmwareVersion(String firmwareVersion) { this.firmwareVersion = firmwareVersion; }
    public String getRolloutStrategy() { return rolloutStrategy; }
    public void setRolloutStrategy(String rolloutStrategy) { this.rolloutStrategy = rolloutStrategy; }
    public String getCanaryDeviceId() { return canaryDeviceId; }
    public void setCanaryDeviceId(String canaryDeviceId) { this.canaryDeviceId = canaryDeviceId; }
    public Integer getCanaryDurationSeconds() { return canaryDurationSeconds; }
    public void setCanaryDurationSeconds(Integer canaryDurationSeconds) { this.canaryDurationSeconds = canaryDurationSeconds; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getApprovedBy() { return approvedBy; }
    public void setApprovedBy(String approvedBy) { this.approvedBy = approvedBy; }
    public OffsetDateTime getApprovedAt() { return approvedAt; }
    public void setApprovedAt(OffsetDateTime approvedAt) { this.approvedAt = approvedAt; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public List<DeviceOtaHistoryDto> getDeviceHistory() { return deviceHistory; }
    public void setDeviceHistory(List<DeviceOtaHistoryDto> deviceHistory) { this.deviceHistory = deviceHistory; }
}
