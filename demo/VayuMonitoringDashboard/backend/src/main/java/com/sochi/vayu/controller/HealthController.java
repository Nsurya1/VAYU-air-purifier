package com.sochi.vayu.controller;

import com.sochi.vayu.repository.DeviceRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
@CrossOrigin(origins = "*")
public class HealthController {

    private final DeviceRepository deviceRepository;
    private final long startTime = System.currentTimeMillis();

    public HealthController(DeviceRepository deviceRepository) {
        this.deviceRepository = deviceRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getHealth() {
        Map<String, Object> status = new HashMap<>();
        status.put("status", "UP");
        status.put("service", "SOCHI VAYU Backend");
        status.put("uptime_seconds", (System.currentTimeMillis() - startTime) / 1000);
        status.put("database", "CONNECTED");
        status.put("total_devices_registered", deviceRepository.count());
        status.put("online_devices", deviceRepository.countByOnlineStatus("ONLINE"));
        return ResponseEntity.ok(status);
    }
}
