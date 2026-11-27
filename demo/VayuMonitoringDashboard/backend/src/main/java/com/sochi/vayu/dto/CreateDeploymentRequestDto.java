package com.sochi.vayu.dto;

import jakarta.validation.constraints.NotBlank;

public class CreateDeploymentRequestDto {

    @NotBlank(message = "deployment_name is required")
    private String deploymentName;

    @NotBlank(message = "firmware_version is required")
    private String firmwareVersion;

    private String rolloutStrategy = "CANARY"; // CANARY, FULL_ROLLOUT
    private String canaryDeviceId = "VAYU-DEV-001";
    private Integer canaryDurationSeconds = 60;

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
}
