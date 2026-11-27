package com.sochi.vayu.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "ota_deployments")
public class OtaDeployment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "deployment_name", nullable = false, length = 128)
    private String deploymentName;

    @Column(name = "firmware_version", nullable = false, length = 32)
    private String firmwareVersion;

    @Column(name = "rollout_strategy", nullable = false, length = 32)
    private String rolloutStrategy = "CANARY"; // CANARY, FULL_ROLLOUT

    @Column(name = "canary_device_id", length = 64)
    private String canaryDeviceId;

    @Column(name = "canary_duration_seconds", nullable = false)
    private Integer canaryDurationSeconds = 60;

    @Column(name = "status", nullable = false, length = 32)
    private String status = "CREATED"; // CREATED, CANARY_ACTIVE, CANARY_PASSED, CANARY_FAILED, FULL_ROLLOUT, COMPLETED, CANCELLED

    @Column(name = "approved_by", length = 64)
    private String approvedBy;

    @Column(name = "approved_at")
    private OffsetDateTime approvedAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "created_by", nullable = false, length = 64)
    private String createdBy = "admin";

    public OtaDeployment() {}

    public OtaDeployment(String deploymentName, String firmwareVersion, String rolloutStrategy,
                         String canaryDeviceId, Integer canaryDurationSeconds, String createdBy) {
        this.deploymentName = deploymentName;
        this.firmwareVersion = firmwareVersion;
        this.rolloutStrategy = rolloutStrategy != null ? rolloutStrategy : "CANARY";
        this.canaryDeviceId = canaryDeviceId;
        this.canaryDurationSeconds = canaryDurationSeconds != null ? canaryDurationSeconds : 60;
        this.status = "CREATED";
        this.createdBy = createdBy != null ? createdBy : "admin";
        this.createdAt = OffsetDateTime.now();
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
}
