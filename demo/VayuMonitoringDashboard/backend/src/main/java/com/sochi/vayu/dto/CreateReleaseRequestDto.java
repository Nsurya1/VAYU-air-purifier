package com.sochi.vayu.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public class CreateReleaseRequestDto {

    @NotBlank(message = "version is required")
    @Pattern(regexp = "^v[0-9]+\\.[0-9]+\\.[0-9]+.*$", message = "version must match semver e.g. v1.1.0-rc1")
    private String version;

    @NotBlank(message = "build_id is required")
    private String buildId;

    private String targetHardware = "REV-B-ESP32";

    @NotBlank(message = "sha256 is required")
    @Pattern(regexp = "^[a-fA-F0-9]{64}$", message = "sha256 must be a 64-character hex string")
    private String sha256;

    @NotNull(message = "binary_size is required")
    private Integer binarySize;

    @NotBlank(message = "binary_url is required")
    private String binaryUrl;

    private String status = "PUBLISHED";
    private String releaseNotes;

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }
    public String getBuildId() { return buildId; }
    public void setBuildId(String buildId) { this.buildId = buildId; }
    public String getTargetHardware() { return targetHardware; }
    public void setTargetHardware(String targetHardware) { this.targetHardware = targetHardware; }
    public String getSha256() { return sha256; }
    public void setSha256(String sha256) { this.sha256 = sha256; }
    public Integer getBinarySize() { return binarySize; }
    public void setBinarySize(Integer binarySize) { this.binarySize = binarySize; }
    public String getBinaryUrl() { return binaryUrl; }
    public void setBinaryUrl(String binaryUrl) { this.binaryUrl = binaryUrl; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getReleaseNotes() { return releaseNotes; }
    public void setReleaseNotes(String releaseNotes) { this.releaseNotes = releaseNotes; }
}
