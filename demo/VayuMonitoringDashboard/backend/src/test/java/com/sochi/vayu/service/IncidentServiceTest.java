package com.sochi.vayu.service;

import com.sochi.vayu.domain.Device;
import com.sochi.vayu.domain.Incident;
import com.sochi.vayu.dto.IncidentDto;
import com.sochi.vayu.repository.DeviceRepository;
import com.sochi.vayu.repository.IncidentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class IncidentServiceTest {

    private IncidentRepository incidentRepository;
    private DeviceRepository deviceRepository;
    private AuditLogService auditLogService;
    private IncidentService incidentService;

    @BeforeEach
    void setUp() {
        incidentRepository = mock(IncidentRepository.class);
        deviceRepository = mock(DeviceRepository.class);
        auditLogService = mock(AuditLogService.class);

        incidentService = new IncidentService(incidentRepository, deviceRepository, auditLogService);
    }

    @Test
    @DisplayName("Should acknowledge incident and record audit log")
    void testAcknowledgeIncident_Success() {
        Incident incident = new Incident("VAYU-DEV-001", "Blower Stall", "Desc", "CRITICAL", "RULE_FAN_STALL", "HARDWARE", "{}");
        incident.setId(101L);

        when(incidentRepository.findById(101L)).thenReturn(Optional.of(incident));
        when(incidentRepository.save(any(Incident.class))).thenAnswer(i -> i.getArgument(0));

        IncidentDto result = incidentService.acknowledgeIncident(101L, "tech_pune", "ROLE_SERVICE_TECH", "*");

        assertNotNull(result);
        assertEquals("ACKNOWLEDGED", result.getStatus());
        assertEquals("tech_pune", result.getAcknowledgedBy());
        assertNotNull(result.getAcknowledgedAt());

        verify(auditLogService, times(1)).logAction(
                eq("tech_pune"),
                eq("INCIDENT_ACKNOWLEDGED"),
                eq("INCIDENT"),
                eq("101"),
                any()
        );
    }

    @Test
    @DisplayName("Should resolve incident with mandatory notes and record audit trail")
    void testResolveIncident_Success() {
        Incident incident = new Incident("VAYU-DEV-001", "PM Fault", "Desc", "HIGH", "RULE_PM_FAULT", "HARDWARE", "{}");
        incident.setId(102L);

        when(incidentRepository.findById(102L)).thenReturn(Optional.of(incident));
        when(incidentRepository.save(any(Incident.class))).thenAnswer(i -> i.getArgument(0));

        IncidentDto result = incidentService.resolveIncident(102L, "Optical sensor cleaned with compressed air and re-calibrated.", "admin", "ROLE_ADMIN", "*");

        assertNotNull(result);
        assertEquals("RESOLVED", result.getStatus());
        assertEquals("admin", result.getResolvedBy());
        assertNotNull(result.getResolvedAt());
        assertTrue(result.getResolutionNotes().contains("Optical sensor cleaned"));

        verify(auditLogService, times(1)).logAction(
                eq("admin"),
                eq("INCIDENT_RESOLVED"),
                eq("INCIDENT"),
                eq("102"),
                any()
        );
    }

    @Test
    @DisplayName("Should reject incident resolution if notes are blank")
    void testResolveIncident_BlankNotes_ThrowsBadRequest() {
        Incident incident = new Incident("VAYU-DEV-001", "Fault", "Desc", "HIGH", "RULE_PM_FAULT", "HARDWARE", "{}");
        incident.setId(103L);

        when(incidentRepository.findById(103L)).thenReturn(Optional.of(incident));

        assertThrows(ResponseStatusException.class, () ->
                incidentService.resolveIncident(103L, "   ", "admin", "ROLE_ADMIN", "*"));
    }

    @Test
    @DisplayName("Should reject Kiosk persona from modifying incidents (403 Forbidden)")
    void testKiosk_CannotModifyIncident_ThrowsForbidden() {
        assertThrows(ResponseStatusException.class, () ->
                incidentService.acknowledgeIncident(104L, "kiosk", "ROLE_KIOSK", "*"));
    }

    @Test
    @DisplayName("Should enforce site-level isolation: Pune tech cannot modify Bengaluru incident")
    void testTechnician_SiteBarrier_ThrowsForbidden() {
        Incident incident = new Incident("VAYU-DEV-020", "Bengaluru Fault", "Desc", "HIGH", "RULE_PM_FAULT", "HARDWARE", "{}");
        incident.setId(105L);

        Device blrDevice = new Device("VAYU-DEV-020", "SITE-BLR-DEV", true);

        when(incidentRepository.findById(105L)).thenReturn(Optional.of(incident));
        when(deviceRepository.findById("VAYU-DEV-020")).thenReturn(Optional.of(blrDevice));

        assertThrows(ResponseStatusException.class, () ->
                incidentService.acknowledgeIncident(105L, "tech_pune", "ROLE_SERVICE_TECH", "SITE-HQ-PUNE"));
    }
}
