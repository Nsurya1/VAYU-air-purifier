package com.sochi.vayu.service;

import com.sochi.vayu.domain.RemoteSession;
import com.sochi.vayu.dto.ApproveRemoteSessionDto;
import com.sochi.vayu.dto.RemoteSessionDto;
import com.sochi.vayu.dto.RequestRemoteSessionDto;
import com.sochi.vayu.repository.RemoteSessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class RemoteSessionService {

    private static final Logger log = LoggerFactory.getLogger(RemoteSessionService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RemoteSessionRepository sessionRepository;
    private final AuditLogService auditLogService;

    public RemoteSessionService(RemoteSessionRepository sessionRepository, AuditLogService auditLogService) {
        this.sessionRepository = sessionRepository;
        this.auditLogService = auditLogService;
    }

    public List<RemoteSessionDto> getAllSessions(String siteScope) {
        autoExpireActiveSessions();

        List<RemoteSession> list;
        if (siteScope != null && !siteScope.equals("*") && !siteScope.equalsIgnoreCase("ALL")) {
            list = sessionRepository.findByTargetSiteIdOrderByCreatedAtDesc(siteScope);
        } else {
            list = sessionRepository.findAllByOrderByCreatedAtDesc();
        }

        return list.stream().map(this::toDto).collect(Collectors.toList());
    }

    public RemoteSessionDto getSessionById(Long id) {
        autoExpireActiveSessions();
        RemoteSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Remote session not found: " + id));
        return toDto(session);
    }

    @Transactional
    public RemoteSessionDto requestSession(RequestRemoteSessionDto req, String actor, String role) {
        if ("ROLE_KIOSK".equalsIgnoreCase(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Kiosk accounts cannot request remote support sessions.");
        }

        String datePrefix = OffsetDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String randomSuffix = String.format("%04X", RANDOM.nextInt(0x10000));
        String sessionCode = "REM-" + datePrefix + "-" + randomSuffix;

        int duration = req.getDurationMinutes() != null ? req.getDurationMinutes() : 30;
        duration = Math.max(5, Math.min(60, duration));

        RemoteSession session = new RemoteSession(
                sessionCode,
                req.getTargetSiteId(),
                actor,
                req.getReason(),
                duration
        );

        sessionRepository.save(session);

        auditLogService.logAction(
                actor,
                "REMOTE_SESSION_REQUESTED",
                "REMOTE_SESSION",
                session.getSessionCode(),
                Map.of("target_site", session.getTargetSiteId(), "reason", session.getReason(), "duration_minutes", session.getDurationMinutes())
        );

        log.info("[REMOTE ACCESS] Session requested: {} by '{}' for site '{}'", sessionCode, actor, session.getTargetSiteId());
        return toDto(session);
    }

    @Transactional
    public RemoteSessionDto approveSession(Long id, ApproveRemoteSessionDto req, String adminActor, String role) {
        if (!"ROLE_ADMIN".equalsIgnoreCase(role)) {
            auditLogService.logAction(
                    adminActor,
                    "ACTION_DENIED",
                    "REMOTE_SESSION",
                    String.valueOf(id),
                    Map.of("reason", "Only administrators have authority to approve remote sessions.", "role", role)
            );
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access Denied: Only customer administrators can approve remote troubleshooting sessions.");
        }

        RemoteSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Remote session not found: " + id));

        if (!"REQUESTED".equalsIgnoreCase(session.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Session cannot be approved in status: " + session.getStatus());
        }

        int duration = session.getDurationMinutes();
        if (req != null && req.getDurationMinutes() != null) {
            duration = Math.max(5, Math.min(60, req.getDurationMinutes()));
            session.setDurationMinutes(duration);
        }

        // Generate high-entropy ephemeral cryptographic token
        byte[] tokenBytes = new byte[32];
        RANDOM.nextBytes(tokenBytes);
        String ephemeralToken = "vayu_rst_" + Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);

        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime expiresAt = now.plusMinutes(duration);

        session.setStatus("APPROVED_ACTIVE");
        session.setApprovedBy(adminActor);
        session.setApprovedAt(now);
        session.setExpiresAt(expiresAt);
        session.setEphemeralToken(ephemeralToken);

        sessionRepository.save(session);

        auditLogService.logAction(
                adminActor,
                "REMOTE_SESSION_APPROVED",
                "REMOTE_SESSION",
                session.getSessionCode(),
                Map.of("approved_by", adminActor, "duration_minutes", duration, "expires_at", expiresAt.toString())
        );

        log.info("[REMOTE ACCESS] Session {} APPROVED by '{}' until {}", session.getSessionCode(), adminActor, expiresAt);
        return toDto(session);
    }

    @Transactional
    public RemoteSessionDto rejectSession(Long id, String adminActor, String role) {
        if (!"ROLE_ADMIN".equalsIgnoreCase(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only administrators can reject remote sessions.");
        }

        RemoteSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Remote session not found: " + id));

        if (!"REQUESTED".equalsIgnoreCase(session.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Session cannot be rejected in status: " + session.getStatus());
        }

        session.setStatus("REJECTED");
        sessionRepository.save(session);

        auditLogService.logAction(
                adminActor,
                "REMOTE_SESSION_REJECTED",
                "REMOTE_SESSION",
                session.getSessionCode(),
                Map.of("rejected_by", adminActor)
        );

        log.info("[REMOTE ACCESS] Session {} REJECTED by '{}'", session.getSessionCode(), adminActor);
        return toDto(session);
    }

    @Transactional
    public RemoteSessionDto revokeSession(Long id, String adminActor, String role, String reason) {
        if (!"ROLE_ADMIN".equalsIgnoreCase(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only administrators can trigger the emergency killswitch.");
        }

        RemoteSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Remote session not found: " + id));

        if (!"APPROVED_ACTIVE".equalsIgnoreCase(session.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot revoke a session that is not APPROVED_ACTIVE. Current: " + session.getStatus());
        }

        OffsetDateTime now = OffsetDateTime.now();
        session.setStatus("REVOKED");
        session.setRevokedBy(adminActor);
        session.setRevokedAt(now);
        session.setEphemeralToken(null); // Invalidate token immediately
        sessionRepository.save(session);

        auditLogService.logAction(
                adminActor,
                "REMOTE_SESSION_REVOKED",
                "REMOTE_SESSION",
                session.getSessionCode(),
                Map.of("action", "EMERGENCY_KILLSWITCH", "revoked_by", adminActor, "reason", reason != null ? reason : "Admin manual killswitch")
        );

        log.warn("[REMOTE ACCESS KILLSWITCH] Session {} REVOKED immediately by '{}'!", session.getSessionCode(), adminActor);
        return toDto(session);
    }

    @Transactional(readOnly = true)
    public RemoteSession validateSessionToken(String token) {
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing ephemeral remote session token.");
        }

        RemoteSession session = sessionRepository.findByEphemeralToken(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or revoked remote session token."));

        if (!"APPROVED_ACTIVE".equalsIgnoreCase(session.getStatus())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Remote session is not active (Status: " + session.getStatus() + ")");
        }

        if (session.getExpiresAt() != null && session.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Remote session has expired.");
        }

        return session;
    }

    @Transactional
    public void autoExpireActiveSessions() {
        OffsetDateTime now = OffsetDateTime.now();
        List<RemoteSession> expiredSessions = sessionRepository.findByStatusAndExpiresAtBefore("APPROVED_ACTIVE", now);
        for (RemoteSession s : expiredSessions) {
            s.setStatus("EXPIRED");
            s.setEphemeralToken(null);
            sessionRepository.save(s);

            auditLogService.logAction(
                    "SYSTEM_ORCHESTRATOR",
                    "REMOTE_SESSION_EXPIRED",
                    "REMOTE_SESSION",
                    s.getSessionCode(),
                    Map.of("reason", "TTL expired automatically", "duration_minutes", s.getDurationMinutes())
            );
            log.info("[REMOTE ACCESS] Session {} auto-expired after TTL elapsed.", s.getSessionCode());
        }
    }

    private RemoteSessionDto toDto(RemoteSession s) {
        RemoteSessionDto dto = new RemoteSessionDto();
        dto.setId(s.getId());
        dto.setSessionCode(s.getSessionCode());
        dto.setTargetSiteId(s.getTargetSiteId());
        dto.setRequestedBy(s.getRequestedBy());
        dto.setReason(s.getReason());
        dto.setStatus(s.getStatus());
        dto.setDurationMinutes(s.getDurationMinutes());
        dto.setEphemeralToken(s.getEphemeralToken());
        dto.setApprovedBy(s.getApprovedBy());
        dto.setApprovedAt(s.getApprovedAt());
        dto.setExpiresAt(s.getExpiresAt());
        dto.setRevokedBy(s.getRevokedBy());
        dto.setRevokedAt(s.getRevokedAt());
        dto.setCreatedAt(s.getCreatedAt());

        if ("APPROVED_ACTIVE".equalsIgnoreCase(s.getStatus()) && s.getExpiresAt() != null) {
            long remaining = Duration.between(OffsetDateTime.now(), s.getExpiresAt()).getSeconds();
            dto.setRemainingSeconds(Math.max(0, remaining));
        } else {
            dto.setRemainingSeconds(0L);
        }

        return dto;
    }
}
