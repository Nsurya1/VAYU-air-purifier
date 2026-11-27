package com.sochi.vayu.controller;

import com.sochi.vayu.dto.DeviceFleetResponseDto;
import com.sochi.vayu.dto.DeviceListItemDto;
import com.sochi.vayu.dto.DeviceSummaryDto;
import com.sochi.vayu.dto.SystemDiagnosticsDto;
import com.sochi.vayu.exception.DeviceNotFoundException;
import com.sochi.vayu.model.DeviceStateSnapshot;
import com.sochi.vayu.service.DeviceDtoMapper;
import com.sochi.vayu.service.InMemoryDeviceStateManager;
import com.sochi.vayu.service.MqttIngestionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/v1")
@CrossOrigin(origins = "*")
public class DeviceApiController {

    private static final Logger log = LoggerFactory.getLogger(DeviceApiController.class);

    private final InMemoryDeviceStateManager stateManager;
    private final DeviceDtoMapper dtoMapper;
    private final MqttIngestionService mqttIngestionService;
    private final String siteName;

    private final List<SseEmitter> activeEmitters = new CopyOnWriteArrayList<>();
    private final ScheduledExecutorService sseExecutor = Executors.newSingleThreadScheduledExecutor();

    public DeviceApiController(
            InMemoryDeviceStateManager stateManager,
            DeviceDtoMapper dtoMapper,
            MqttIngestionService mqttIngestionService,
            @Value("${vayu.customer.site-name:SOCHI-HQ-BLDG1}") String siteName) {
        this.stateManager = stateManager;
        this.dtoMapper = dtoMapper;
        this.mqttIngestionService = mqttIngestionService;
        this.siteName = siteName;

        // Broadcast fleet updates via SSE every 2 seconds
        this.sseExecutor.scheduleAtFixedRate(this::broadcastSseUpdate, 2, 2, TimeUnit.SECONDS);
    }

    @GetMapping("/devices")
    public ResponseEntity<DeviceFleetResponseDto> getFleet() {
        return ResponseEntity.ok(buildFleetResponse());
    }

    @GetMapping("/devices/{deviceId}")
    public ResponseEntity<DeviceListItemDto> getDeviceDetail(@PathVariable String deviceId) {
        DeviceStateSnapshot snapshot = stateManager.getDevice(deviceId)
                .orElseThrow(() -> new DeviceNotFoundException(deviceId));

        return ResponseEntity.ok(dtoMapper.toDto(snapshot));
    }

    @GetMapping(value = "/devices/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamFleet() {
        SseEmitter emitter = new SseEmitter(60_000L); // 60s timeout
        activeEmitters.add(emitter);

        emitter.onCompletion(() -> activeEmitters.remove(emitter));
        emitter.onTimeout(() -> {
            emitter.complete();
            activeEmitters.remove(emitter);
        });
        emitter.onError((e) -> activeEmitters.remove(emitter));

        // Send initial state immediately
        try {
            emitter.send(SseEmitter.event().name("fleet-update").data(buildFleetResponse()));
        } catch (IOException e) {
            emitter.complete();
            activeEmitters.remove(emitter);
        }

        return emitter;
    }

    @GetMapping("/system/diagnostics")
    public ResponseEntity<SystemDiagnosticsDto> getDiagnostics() {
        Runtime runtime = Runtime.getRuntime();
        long usedMemoryBytes = runtime.totalMemory() - runtime.freeMemory();

        return ResponseEntity.ok(new SystemDiagnosticsDto(
                siteName,
                Instant.now(),
                mqttIngestionService.isConnected(),
                stateManager.getTotalConfigured(),
                stateManager.getOnlineCount(),
                stateManager.getOfflineCount(),
                stateManager.getStaleCount(),
                stateManager.getFaultCount(),
                usedMemoryBytes / (1024 * 1024),
                runtime.totalMemory() / (1024 * 1024),
                activeEmitters.size()
        ));
    }

    private DeviceFleetResponseDto buildFleetResponse() {
        List<DeviceListItemDto> deviceList = stateManager.getAllDevices().stream()
                .map(dtoMapper::toDto)
                .sorted(Comparator.comparing(DeviceListItemDto::deviceId))
                .toList();

        DeviceSummaryDto summary = new DeviceSummaryDto(
                stateManager.getTotalConfigured(),
                stateManager.getOnlineCount(),
                stateManager.getOfflineCount(),
                stateManager.getStaleCount(),
                stateManager.getFaultCount()
        );

        return new DeviceFleetResponseDto(
                siteName,
                Instant.now(),
                summary,
                deviceList
        );
    }

    private void broadcastSseUpdate() {
        if (activeEmitters.isEmpty()) return;

        DeviceFleetResponseDto data = buildFleetResponse();
        for (SseEmitter emitter : activeEmitters) {
            try {
                emitter.send(SseEmitter.event().name("fleet-update").data(data));
            } catch (Exception e) {
                emitter.complete();
                activeEmitters.remove(emitter);
            }
        }
    }
}
