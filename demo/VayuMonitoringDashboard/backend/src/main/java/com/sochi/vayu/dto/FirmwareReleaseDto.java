package com.sochi.vayu.dto;

import java.time.OffsetDateTime;

public class FirmwareReleaseDto {
    private Long id;
    private String version;
    private String buildId;
    private String targetHardware;
    private String sha256;
    private Integer binarySize;
    private String binaryUrl;
    private String status;
    private String releaseNotes;
    private OffsetDateTime createdAt;
    private String createdBy;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
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
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
}
