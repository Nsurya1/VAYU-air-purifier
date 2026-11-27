package com.sochi.vayu.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "firmware_releases")
public class FirmwareRelease {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "version", nullable = false, unique = true, length = 32)
    private String version;

    @Column(name = "build_id", nullable = false, length = 64)
    private String buildId;

    @Column(name = "target_hardware", nullable = false, length = 32)
    private String targetHardware = "REV-B-ESP32";

    @Column(name = "sha256", nullable = false, length = 64)
    private String sha256;

    @Column(name = "binary_size", nullable = false)
    private Integer binarySize;

    @Column(name = "binary_url", nullable = false, length = 255)
    private String binaryUrl;

    @Column(name = "status", nullable = false, length = 32)
    private String status = "PUBLISHED"; // PUBLISHED, TESTING, REVOKED

    @Column(name = "release_notes", columnDefinition = "TEXT")
    private String releaseNotes;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "created_by", nullable = false, length = 64)
    private String createdBy = "admin";

    public FirmwareRelease() {}

    public FirmwareRelease(String version, String buildId, String targetHardware, String sha256,
                           Integer binarySize, String binaryUrl, String status, String releaseNotes, String createdBy) {
        this.version = version;
        this.buildId = buildId;
        this.targetHardware = targetHardware != null ? targetHardware : "REV-B-ESP32";
        this.sha256 = sha256;
        this.binarySize = binarySize;
        this.binaryUrl = binaryUrl;
        this.status = status != null ? status : "PUBLISHED";
        this.releaseNotes = releaseNotes;
        this.createdBy = createdBy != null ? createdBy : "admin";
        this.createdAt = OffsetDateTime.now();
    }

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
