package com.sochi.vayu.controller;

import com.sochi.vayu.config.VayuUserPrincipal;
import com.sochi.vayu.dto.IncidentActionRequestDto;
import com.sochi.vayu.dto.IncidentDto;
import com.sochi.vayu.service.IncidentService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/incidents")
public class IncidentController {

    private final IncidentService incidentService;

    public IncidentController(IncidentService incidentService) {
        this.incidentService = incidentService;
    }

    @GetMapping
    public ResponseEntity<List<IncidentDto>> getIncidents(
            @RequestParam(required = false) String siteId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String category,
            Authentication authentication
    ) {
        String effectiveSite = siteId;

        // If technician is scoped to a specific site, default to their site
        if (authentication != null && authentication.getPrincipal() instanceof VayuUserPrincipal principal) {
            if ("ROLE_SERVICE_TECH".equalsIgnoreCase(principal.getRole()) && !"*".equals(principal.getSiteScope())) {
                effectiveSite = principal.getSiteScope();
            }
        }

        return ResponseEntity.ok(incidentService.getIncidents(effectiveSite, status, category));
    }

    @GetMapping("/{id}")
    public ResponseEntity<IncidentDto> getIncident(@PathVariable Long id) {
        return ResponseEntity.ok(incidentService.getIncidentById(id));
    }

    @PostMapping("/{id}/acknowledge")
    public ResponseEntity<IncidentDto> acknowledgeIncident(
            @PathVariable Long id,
            Authentication authentication
    ) {
        String actor = authentication != null ? authentication.getName() : "anonymous";
        String role = "UNKNOWN";
        String siteScope = "*";

        if (authentication != null && authentication.getPrincipal() instanceof VayuUserPrincipal principal) {
            role = principal.getRole();
            siteScope = principal.getSiteScope();
        }

        return ResponseEntity.ok(incidentService.acknowledgeIncident(id, actor, role, siteScope));
    }

    @PostMapping("/{id}/assign")
    public ResponseEntity<IncidentDto> assignIncident(
            @PathVariable Long id,
            @RequestBody IncidentActionRequestDto request,
            Authentication authentication
    ) {
        String actor = authentication != null ? authentication.getName() : "anonymous";
        String role = "UNKNOWN";
        String siteScope = "*";

        if (authentication != null && authentication.getPrincipal() instanceof VayuUserPrincipal principal) {
            role = principal.getRole();
            siteScope = principal.getSiteScope();
        }

        String targetAssignee = request != null && request.getAssignedTo() != null ? request.getAssignedTo() : actor;
        return ResponseEntity.ok(incidentService.assignIncident(id, targetAssignee, actor, role, siteScope));
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<IncidentDto> resolveIncident(
            @PathVariable Long id,
            @RequestBody IncidentActionRequestDto request,
            Authentication authentication
    ) {
        String actor = authentication != null ? authentication.getName() : "anonymous";
        String role = "UNKNOWN";
        String siteScope = "*";

        if (authentication != null && authentication.getPrincipal() instanceof VayuUserPrincipal principal) {
            role = principal.getRole();
            siteScope = principal.getSiteScope();
        }

        String notes = request != null ? request.getNotes() : "";
        return ResponseEntity.ok(incidentService.resolveIncident(id, notes, actor, role, siteScope));
    }
}
