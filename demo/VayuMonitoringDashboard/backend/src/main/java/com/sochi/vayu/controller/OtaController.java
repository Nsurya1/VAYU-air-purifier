package com.sochi.vayu.controller;

import com.sochi.vayu.config.VayuUserPrincipal;
import com.sochi.vayu.domain.DeviceOtaHistory;
import com.sochi.vayu.dto.CreateDeploymentRequestDto;
import com.sochi.vayu.dto.CreateReleaseRequestDto;
import com.sochi.vayu.dto.FirmwareReleaseDto;
import com.sochi.vayu.dto.OtaDeploymentDto;
import com.sochi.vayu.service.OtaOrchestrationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ota")
public class OtaController {

    private final OtaOrchestrationService otaService;

    public OtaController(OtaOrchestrationService otaService) {
        this.otaService = otaService;
    }

    @GetMapping("/releases")
    public ResponseEntity<List<FirmwareReleaseDto>> getReleases() {
        return ResponseEntity.ok(otaService.getReleases());
    }

    @PostMapping("/releases")
    public ResponseEntity<FirmwareReleaseDto> createRelease(
            @Valid @RequestBody CreateReleaseRequestDto request,
            Authentication authentication
    ) {
        String actor = authentication != null ? authentication.getName() : "anonymous";
        String role = "UNKNOWN";
        if (authentication != null && authentication.getPrincipal() instanceof VayuUserPrincipal principal) {
            role = principal.getRole();
        }
        return ResponseEntity.ok(otaService.createRelease(request, actor, role));
    }

    @GetMapping("/deployments")
    public ResponseEntity<List<OtaDeploymentDto>> getDeployments() {
        return ResponseEntity.ok(otaService.getDeployments());
    }

    @GetMapping("/deployments/{id}")
    public ResponseEntity<OtaDeploymentDto> getDeployment(@PathVariable Long id) {
        return ResponseEntity.ok(otaService.getDeploymentById(id));
    }

    @PostMapping("/deployments")
    public ResponseEntity<OtaDeploymentDto> createDeployment(
            @Valid @RequestBody CreateDeploymentRequestDto request,
            Authentication authentication
    ) {
        String actor = authentication != null ? authentication.getName() : "anonymous";
        String role = "UNKNOWN";
        if (authentication != null && authentication.getPrincipal() instanceof VayuUserPrincipal principal) {
            role = principal.getRole();
        }
        return ResponseEntity.ok(otaService.createDeployment(request, actor, role));
    }

    @PostMapping("/deployments/{id}/start-canary")
    public ResponseEntity<OtaDeploymentDto> startCanary(
            @PathVariable Long id,
            Authentication authentication
    ) {
        String actor = authentication != null ? authentication.getName() : "anonymous";
        String role = "UNKNOWN";
        if (authentication != null && authentication.getPrincipal() instanceof VayuUserPrincipal principal) {
            role = principal.getRole();
        }
        return ResponseEntity.ok(otaService.startCanary(id, actor, role));
    }

    @PostMapping("/deployments/{id}/evaluate-canary")
    public ResponseEntity<OtaDeploymentDto> evaluateCanary(
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(otaService.evaluateCanaryHealth(id));
    }

    @PostMapping("/deployments/{id}/approve-fleet")
    public ResponseEntity<OtaDeploymentDto> approveFleet(
            @PathVariable Long id,
            Authentication authentication
    ) {
        String actor = authentication != null ? authentication.getName() : "anonymous";
        String role = "UNKNOWN";
        if (authentication != null && authentication.getPrincipal() instanceof VayuUserPrincipal principal) {
            role = principal.getRole();
        }
        return ResponseEntity.ok(otaService.approveAndRolloutFleet(id, actor, role));
    }

    @GetMapping("/devices/{deviceId}/history")
    public ResponseEntity<List<DeviceOtaHistory>> getDeviceHistory(@PathVariable String deviceId) {
        return ResponseEntity.ok(otaService.getDeviceHistory(deviceId));
    }
}
