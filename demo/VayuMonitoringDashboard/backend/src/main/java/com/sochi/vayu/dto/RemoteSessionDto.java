package com.sochi.vayu.dto;

import java.time.OffsetDateTime;

public class RemoteSessionDto {

    private Long id;
    private String sessionCode;
    private String targetSiteId;
    private String requestedBy;
    private String reason;
    private String status;
    private Integer durationMinutes;
    private String ephemeralToken;
    private String approvedBy;
    private OffsetDateTime approvedAt;
    private OffsetDateTime expiresAt;
    private String revokedBy;
    private OffsetDateTime revokedAt;
    private OffsetDateTime createdAt;
    private Long remainingSeconds;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getSessionCode() { return sessionCode; }
    public void setSessionCode(String sessionCode) { this.sessionCode = sessionCode; }

    public String getTargetSiteId() { return targetSiteId; }
    public void setTargetSiteId(String targetSiteId) { this.targetSiteId = targetSiteId; }

    public String getRequestedBy() { return requestedBy; }
    public void setRequestedBy(String requestedBy) { this.requestedBy = requestedBy; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Integer getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(Integer durationMinutes) { this.durationMinutes = durationMinutes; }

    public String getEphemeralToken() { return ephemeralToken; }
    public void setEphemeralToken(String ephemeralToken) { this.ephemeralToken = ephemeralToken; }

    public String getApprovedBy() { return approvedBy; }
    public void setApprovedBy(String approvedBy) { this.approvedBy = approvedBy; }

    public OffsetDateTime getApprovedAt() { return approvedAt; }
    public void setApprovedAt(OffsetDateTime approvedAt) { this.approvedAt = approvedAt; }

    public OffsetDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(OffsetDateTime expiresAt) { this.expiresAt = expiresAt; }

    public String getRevokedBy() { return revokedBy; }
    public void setRevokedBy(String revokedBy) { this.revokedBy = revokedBy; }

    public OffsetDateTime getRevokedAt() { return revokedAt; }
    public void setRevokedAt(OffsetDateTime revokedAt) { this.revokedAt = revokedAt; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public Long getRemainingSeconds() { return remainingSeconds; }
    public void setRemainingSeconds(Long remainingSeconds) { this.remainingSeconds = remainingSeconds; }
}
