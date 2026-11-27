package com.sochi.vayu.service;

import com.sochi.vayu.domain.RemoteSession;
import com.sochi.vayu.dto.ApproveRemoteSessionDto;
import com.sochi.vayu.dto.RemoteSessionDto;
import com.sochi.vayu.dto.RequestRemoteSessionDto;
import com.sochi.vayu.repository.RemoteSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class RemoteSessionServiceTest {

    private RemoteSessionRepository sessionRepository;
    private AuditLogService auditLogService;
    private RemoteSessionService sessionService;

    @BeforeEach
    void setUp() {
        sessionRepository = mock(RemoteSessionRepository.class);
        auditLogService = mock(AuditLogService.class);
        sessionService = new RemoteSessionService(sessionRepository, auditLogService);
    }

    @Test
    @DisplayName("Should successfully create a remote session request")
    void testRequestSession_Success() {
        RequestRemoteSessionDto req = new RequestRemoteSessionDto();
        req.setTargetSiteId("SITE-HQ-PUNE");
        req.setReason("PM Sensor calibration check");
        req.setDurationMinutes(30);

        when(sessionRepository.save(any(RemoteSession.class))).thenAnswer(i -> {
            RemoteSession s = i.getArgument(0);
            s.setId(101L);
            return s;
        });

        RemoteSessionDto result = sessionService.requestSession(req, "dev_eng", "ROLE_DEV_ENGINEER");

        assertNotNull(result);
        assertEquals("SITE-HQ-PUNE", result.getTargetSiteId());
        assertEquals("REQUESTED", result.getStatus());
        assertEquals("dev_eng", result.getRequestedBy());
        assertTrue(result.getSessionCode().startsWith("REM-"));
        assertEquals(30, result.getDurationMinutes());

        verify(auditLogService, times(1)).logAction(
                eq("dev_eng"),
                eq("REMOTE_SESSION_REQUESTED"),
                eq("REMOTE_SESSION"),
                any(),
                any()
        );
    }

    @Test
    @DisplayName("Should reject session request from Kiosk persona with 403 Forbidden")
    void testRequestSession_KioskForbidden() {
        RequestRemoteSessionDto req = new RequestRemoteSessionDto();
        req.setTargetSiteId("SITE-HQ-PUNE");
        req.setReason("Unauthorized view");

        assertThrows(ResponseStatusException.class, () ->
                sessionService.requestSession(req, "kiosk_user", "ROLE_KIOSK")
        );

        verify(sessionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should allow Customer Administrator to approve remote session with ephemeral token")
    void testApproveSession_Success() {
        RemoteSession existing = new RemoteSession("REM-20261022-A1B2", "SITE-HQ-PUNE", "dev_eng", "Triage", 30);
        existing.setId(1L);

        when(sessionRepository.findById(1L)).thenReturn(Optional.of(existing));
        when(sessionRepository.save(any(RemoteSession.class))).thenAnswer(i -> i.getArgument(0));

        ApproveRemoteSessionDto approveReq = new ApproveRemoteSessionDto();
        approveReq.setDurationMinutes(45);

        RemoteSessionDto result = sessionService.approveSession(1L, approveReq, "admin", "ROLE_ADMIN");

        assertEquals("APPROVED_ACTIVE", result.getStatus());
        assertEquals("admin", result.getApprovedBy());
        assertNotNull(result.getEphemeralToken());
        assertTrue(result.getEphemeralToken().startsWith("vayu_rst_"));
        assertNotNull(result.getExpiresAt());
        assertEquals(45, result.getDurationMinutes());

        verify(auditLogService, times(1)).logAction(
                eq("admin"),
                eq("REMOTE_SESSION_APPROVED"),
                eq("REMOTE_SESSION"),
                eq("REM-20261022-A1B2"),
                any()
        );
    }

    @Test
    @DisplayName("Should deny session approval from non-admin role with 403 Forbidden")
    void testApproveSession_NonAdminForbidden() {
        assertThrows(ResponseStatusException.class, () ->
                sessionService.approveSession(1L, null, "tech_pune", "ROLE_SERVICE_TECH")
        );

        verify(sessionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should allow Customer Administrator to trigger Emergency Killswitch")
    void testRevokeSession_EmergencyKillswitch() {
        RemoteSession active = new RemoteSession("REM-20261022-C3D4", "SITE-HQ-PUNE", "dev_eng", "Triage", 30);
        active.setId(2L);
        active.setStatus("APPROVED_ACTIVE");
        active.setEphemeralToken("vayu_rst_active_secret_token");
        active.setExpiresAt(OffsetDateTime.now().plusMinutes(20));

        when(sessionRepository.findById(2L)).thenReturn(Optional.of(active));
        when(sessionRepository.save(any(RemoteSession.class))).thenAnswer(i -> i.getArgument(0));

        RemoteSessionDto result = sessionService.revokeSession(2L, "admin", "ROLE_ADMIN", "Suspicious traffic detected");

        assertEquals("REVOKED", result.getStatus());
        assertEquals("admin", result.getRevokedBy());
        assertNull(result.getEphemeralToken()); // Ephemeral token wiped immediately!

        verify(auditLogService, times(1)).logAction(
                eq("admin"),
                eq("REMOTE_SESSION_REVOKED"),
                eq("REMOTE_SESSION"),
                eq("REM-20261022-C3D4"),
                any()
        );
    }

    @Test
    @DisplayName("Should validate active ephemeral token and reject invalid/expired tokens")
    void testValidateSessionToken() {
        RemoteSession validSession = new RemoteSession("REM-VALID", "SITE-HQ-PUNE", "dev_eng", "Triage", 30);
        validSession.setStatus("APPROVED_ACTIVE");
        validSession.setEphemeralToken("vayu_rst_valid_123");
        validSession.setExpiresAt(OffsetDateTime.now().plusMinutes(15));

        when(sessionRepository.findByEphemeralToken("vayu_rst_valid_123")).thenReturn(Optional.of(validSession));
        when(sessionRepository.findByEphemeralToken("invalid_token")).thenReturn(Optional.empty());

        RemoteSession validated = sessionService.validateSessionToken("vayu_rst_valid_123");
        assertNotNull(validated);
        assertEquals("REM-VALID", validated.getSessionCode());

        assertThrows(ResponseStatusException.class, () ->
                sessionService.validateSessionToken("invalid_token")
        );
    }
}
