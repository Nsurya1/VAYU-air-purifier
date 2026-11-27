package com.sochi.vayu.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/system")
@CrossOrigin(origins = "*")
public class SystemInfoController {

    private final String siteName;
    private final int staleThresholdSeconds;
    private final int offlineThresholdSeconds;
    private final Instant startupTime = Instant.now();

    public SystemInfoController(
            @Value("${vayu.customer.site-name}") String siteName,
            @Value("${vayu.telemetry.stale-threshold-seconds}") int staleThresholdSeconds,
            @Value("${vayu.telemetry.offline-threshold-seconds}") int offlineThresholdSeconds) {
        this.siteName = siteName;
        this.staleThresholdSeconds = staleThresholdSeconds;
        this.offlineThresholdSeconds = offlineThresholdSeconds;
    }

    @GetMapping("/info")
    public ResponseEntity<Map<String, Object>> getSystemInfo() {
        return ResponseEntity.ok(Map.of(
                "app_name", "SOCHI VAYU Local Real-Time Monitoring",
                "version", "1.0.0",
                "site_name", siteName,
                "startup_time", startupTime.toString(),
                "status", "RUNNING",
                "stale_threshold_seconds", staleThresholdSeconds,
                "offline_threshold_seconds", offlineThresholdSeconds
        ));
    }
}
