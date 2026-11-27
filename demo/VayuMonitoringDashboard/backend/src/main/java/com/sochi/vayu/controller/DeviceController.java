package com.sochi.vayu.controller;

import com.sochi.vayu.config.VayuUserPrincipal;
import com.sochi.vayu.domain.Device;
import com.sochi.vayu.domain.TelemetryRecord;
import com.sochi.vayu.dto.CommandRequestDto;
import com.sochi.vayu.dto.DeviceSummaryDto;
import com.sochi.vayu.service.AuditLogService;
import com.sochi.vayu.service.DeviceQueryService;
import com.sochi.vayu.service.MqttGatewayService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/devices")
public class DeviceController {

    private final DeviceQueryService deviceQueryService;
    private final MqttGatewayService mqttGatewayService;
    private final AuditLogService auditLogService;

    public DeviceController(
            DeviceQueryService deviceQueryService,
            MqttGatewayService mqttGatewayService,
            AuditLogService auditLogService
    ) {
        this.deviceQueryService = deviceQueryService;
        this.mqttGatewayService = mqttGatewayService;
        this.auditLogService = auditLogService;
    }

    @GetMapping
    public ResponseEntity<List<DeviceSummaryDto>> getAllDevices(
            @RequestParam(required = false) String siteId,
            Authentication authentication
    ) {
        String effectiveSiteFilter = siteId;

        // If user is a service technician with a specific site scope, constrain output to their site
        if (authentication != null && authentication.getPrincipal() instanceof VayuUserPrincipal principal) {
            if ("ROLE_SERVICE_TECH".equalsIgnoreCase(principal.getRole()) && !"*".equals(principal.getSiteScope())) {
                effectiveSiteFilter = principal.getSiteScope();
            }
        }

        return ResponseEntity.ok(deviceQueryService.getAllDeviceSummaries(effectiveSiteFilter));
    }

    @GetMapping("/{deviceId}")
    public ResponseEntity<Device> getDevice(@PathVariable String deviceId) {
        return deviceQueryService.getDevice(deviceId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{deviceId}/telemetry")
    public ResponseEntity<List<TelemetryRecord>> getDeviceTelemetry(
            @PathVariable String deviceId,
            @RequestParam(defaultValue = "50") int limit
    ) {
        return ResponseEntity.ok(deviceQueryService.getTelemetryHistory(deviceId, limit));
    }

    @PostMapping("/{deviceId}/commands")
    public ResponseEntity<?> sendCommand(
            @PathVariable String deviceId,
            @Valid @RequestBody CommandRequestDto request,
            Authentication authentication
    ) {
        String actor = authentication != null ? authentication.getName() : "anonymous";
        String role = "UNKNOWN";
        String siteScope = "*";

        if (authentication != null && authentication.getPrincipal() instanceof VayuUserPrincipal principal) {
            role = principal.getRole();
            siteScope = principal.getSiteScope();
        }

        // 1. Role-based check: Kiosks are strictly read-only
        if ("ROLE_KIOSK".equalsIgnoreCase(role)) {
            auditLogService.logAction(
                    actor,
                    "COMMAND_DENIED",
                    "DEVICE",
                    deviceId,
                    Map.of("reason", "Kiosk accounts have read-only access and cannot issue commands", "command", request.getCommand())
            );
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", "FORBIDDEN",
                    "message", "Kiosk accounts have read-only access and cannot issue device commands."
            ));
        }

        // 2. Device existence check
        Device device = deviceQueryService.getDevice(deviceId).orElse(null);
        if (device == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "error", "NOT_FOUND",
                    "message", "Target device '" + deviceId + "' not found in inventory."
            ));
        }

        // 3. Site-level authorization: Technicians can only command devices at their assigned site
        if ("ROLE_SERVICE_TECH".equalsIgnoreCase(role) && !"*".equals(siteScope)) {
            if (device.getSiteId() == null || !siteScope.equalsIgnoreCase(device.getSiteId())) {
                auditLogService.logAction(
                        actor,
                        "SITE_AUTHORIZATION_DENIED",
                        "DEVICE",
                        deviceId,
                        Map.of("user_site_scope", siteScope, "target_device_site", device.getSiteId() != null ? device.getSiteId() : "NONE")
                );
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                        "error", "SITE_AUTHORIZATION_DENIED",
                        "message", String.format("Technician access denied: User restricted to '%s', cannot control device '%s' at site '%s'",
                                siteScope, deviceId, device.getSiteId())
                ));
            }
        }

        // 4. Dispatch command via MQTT
        boolean sent = mqttGatewayService.sendDeviceCommand(deviceId, request);

        // 5. Record command execution in Audit Log
        Map<String, Object> auditPayload = new HashMap<>();
        auditPayload.put("command", request.getCommand());
        auditPayload.put("fan_pct", request.getFanPct());
        auditPayload.put("mode", request.getMode());
        auditPayload.put("target_version", request.getTargetVersion());
        auditPayload.put("dispatched", sent);
        auditPayload.put("target_site", device.getSiteId());

        auditLogService.logAction(
                actor,
                "DISPATCH_COMMAND",
                "DEVICE",
                deviceId,
                auditPayload
        );

        Map<String, Object> resp = new HashMap<>();
        resp.put("device_id", deviceId);
        resp.put("command", request.getCommand());
        resp.put("dispatched", sent);
        resp.put("timestamp", System.currentTimeMillis());

        if (sent) {
            return ResponseEntity.ok(resp);
        } else {
            resp.put("error", "Failed to dispatch command to MQTT broker");
            return ResponseEntity.internalServerError().body(resp);
        }
    }
}
