package com.sochi.vayu.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "device_ota_history")
public class DeviceOtaHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "device_id", nullable = false, length = 64)
    private String deviceId;

    @Column(name = "deployment_id")
    private Long deploymentId;

    @Column(name = "target_version", nullable = false, length = 32)
    private String targetVersion;

    @Column(name = "previous_version", nullable = false, length = 32)
    private String previousVersion;

    @Column(name = "status", nullable = false, length = 32)
    private String status = "SCHEDULED"; // SCHEDULED, DOWNLOADING, FLASHING, VERIFYING, SUCCESS, FAILED_ROLLBACK

    @Column(name = "failure_reason", columnDefinition = "TEXT")
    private String failureReason;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    public DeviceOtaHistory() {}

    public DeviceOtaHistory(String deviceId, Long deploymentId, String targetVersion,
                            String previousVersion, String status, String failureReason) {
        this.deviceId = deviceId;
        this.deploymentId = deploymentId;
        this.targetVersion = targetVersion;
        this.previousVersion = previousVersion;
        this.status = status != null ? status : "SCHEDULED";
        this.failureReason = failureReason;
        this.updatedAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }
    public Long getDeploymentId() { return deploymentId; }
    public void setDeploymentId(Long deploymentId) { this.deploymentId = deploymentId; }
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
