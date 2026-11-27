package com.sochi.vayu.service;

import com.sochi.vayu.domain.Device;
import com.sochi.vayu.domain.Incident;
import com.sochi.vayu.dto.IncidentDto;
import com.sochi.vayu.repository.DeviceRepository;
import com.sochi.vayu.repository.IncidentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class IncidentService {

    private static final Logger log = LoggerFactory.getLogger(IncidentService.class);

    private final IncidentRepository incidentRepository;
    private final DeviceRepository deviceRepository;
    private final AuditLogService auditLogService;

    public IncidentService(
            IncidentRepository incidentRepository,
            DeviceRepository deviceRepository,
            AuditLogService auditLogService
    ) {
        this.incidentRepository = incidentRepository;
        this.deviceRepository = deviceRepository;
        this.auditLogService = auditLogService;
    }

    @Transactional(readOnly = true)
    public List<IncidentDto> getIncidents(String siteId, String status, String category) {
        String effSite = (siteId != null && !siteId.isBlank() && !"ALL".equalsIgnoreCase(siteId)) ? siteId : null;
        String effStatus = (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) ? status : null;
        String effCategory = (category != null && !category.isBlank() && !"ALL".equalsIgnoreCase(category)) ? category : null;

        List<Incident> incidents = incidentRepository.findFilteredIncidents(effSite, effStatus, effCategory);
        return incidents.stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public IncidentDto getIncidentById(Long id) {
        Incident incident = incidentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Incident not found: " + id));
        return toDto(incident);
    }

    @Transactional
    public IncidentDto acknowledgeIncident(Long id, String actor, String role, String siteScope) {
        enforceOperatorPermissions(id, actor, role, siteScope, "ACKNOWLEDGE_INCIDENT");

        Incident incident = incidentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Incident not found: " + id));

        incident.setStatus("ACKNOWLEDGED");
        incident.setAcknowledgedAt(OffsetDateTime.now());
        incident.setAcknowledgedBy(actor);
        if (incident.getAssignedTo() == null) {
            incident.setAssignedTo(actor);
        }
        incidentRepository.save(incident);

        auditLogService.logAction(
                actor,
                "INCIDENT_ACKNOWLEDGED",
                "INCIDENT",
                String.valueOf(id),
                Map.of("device_id", incident.getDeviceId(), "status", "ACKNOWLEDGED")
        );

        log.info("[INCIDENT ACKNOWLEDGED] Ticket #{} for device '{}' acknowledged by '{}'",
                id, incident.getDeviceId(), actor);

        return toDto(incident);
    }

    @Transactional
    public IncidentDto assignIncident(Long id, String assignee, String actor, String role, String siteScope) {
        enforceOperatorPermissions(id, actor, role, siteScope, "ASSIGN_INCIDENT");

        Incident incident = incidentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Incident not found: " + id));

        incident.setAssignedTo(assignee);
        incidentRepository.save(incident);

        auditLogService.logAction(
                actor,
                "INCIDENT_ASSIGNED",
                "INCIDENT",
                String.valueOf(id),
                Map.of("assigned_to", assignee, "device_id", incident.getDeviceId())
        );

        log.info("[INCIDENT ASSIGNED] Ticket #{} assigned to '{}' by '{}'", id, assignee, actor);

        return toDto(incident);
    }

    @Transactional
    public IncidentDto resolveIncident(Long id, String notes, String actor, String role, String siteScope) {
        enforceOperatorPermissions(id, actor, role, siteScope, "RESOLVE_INCIDENT");

        if (notes == null || notes.trim().length() < 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Resolution notes are required (minimum 5 characters).");
        }

        Incident incident = incidentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Incident not found: " + id));

        incident.setStatus("RESOLVED");
        incident.setResolvedAt(OffsetDateTime.now());
        incident.setResolvedBy(actor);
        incident.setResolutionNotes(notes.trim());
        incidentRepository.save(incident);

        auditLogService.logAction(
                actor,
                "INCIDENT_RESOLVED",
                "INCIDENT",
                String.valueOf(id),
                Map.of("device_id", incident.getDeviceId(), "resolved_by", actor, "notes", notes.trim())
        );

        log.info("[INCIDENT RESOLVED] Ticket #{} resolved by '{}' with notes: {}", id, actor, notes.trim());

        return toDto(incident);
    }

    private void enforceOperatorPermissions(Long incidentId, String actor, String role, String siteScope, String actionName) {
        if ("ROLE_KIOSK".equalsIgnoreCase(role)) {
            auditLogService.logAction(
                    actor,
                    "ACTION_DENIED",
                    "INCIDENT",
                    String.valueOf(incidentId),
                    Map.of("reason", "Kiosk displays have read-only access", "action", actionName)
            );
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Kiosk displays have read-only access and cannot alter incidents.");
        }

        if ("ROLE_SERVICE_TECH".equalsIgnoreCase(role) && !"*".equals(siteScope)) {
            Incident incident = incidentRepository.findById(incidentId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Incident not found: " + incidentId));

            Device dev = deviceRepository.findById(incident.getDeviceId()).orElse(null);
            if (dev != null && dev.getSiteId() != null && !siteScope.equalsIgnoreCase(dev.getSiteId())) {
                auditLogService.logAction(
                        actor,
                        "SITE_AUTHORIZATION_DENIED",
                        "INCIDENT",
                        String.valueOf(incidentId),
                        Map.of("user_site_scope", siteScope, "device_site", dev.getSiteId(), "action", actionName)
                );
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        String.format("Technician access denied: User restricted to '%s', cannot modify incident for device at '%s'",
                                siteScope, dev.getSiteId()));
            }
        }
    }

    private IncidentDto toDto(Incident i) {
        IncidentDto dto = new IncidentDto();
        dto.setId(i.getId());
        dto.setDeviceId(i.getDeviceId());

        Device dev = deviceRepository.findById(i.getDeviceId()).orElse(null);
        if (dev != null) {
            dto.setSiteId(dev.getSiteId());
        }

        dto.setTitle(i.getTitle());
        dto.setDescription(i.getDescription());
        dto.setStatus(i.getStatus());
        dto.setSeverity(i.getSeverity());
        dto.setDiagnosticRule(i.getDiagnosticRule());
        dto.setCategory(i.getCategory());
        dto.setEvidence(i.getEvidence());
        dto.setAssignedTo(i.getAssignedTo());
        dto.setAcknowledgedAt(i.getAcknowledgedAt());
        dto.setAcknowledgedBy(i.getAcknowledgedBy());
        dto.setResolvedAt(i.getResolvedAt());
        dto.setResolvedBy(i.getResolvedBy());
        dto.setResolutionNotes(i.getResolutionNotes());
        dto.setCreatedAt(i.getCreatedAt());
        return dto;
    }
}
