package com.sochi.vayu.service;

import com.sochi.vayu.model.*;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
@EnableScheduling
public class InMemoryDeviceStateManager {

    private static final Logger log = LoggerFactory.getLogger(InMemoryDeviceStateManager.class);

    private final Map<String, DeviceStateSnapshot> deviceMap = new ConcurrentHashMap<>();
    private final int staleThresholdSeconds;
    private final int offlineThresholdSeconds;
    private final List<String> initialDevices;

    public InMemoryDeviceStateManager(
            @Value("${vayu.telemetry.stale-threshold-seconds:30}") int staleThresholdSeconds,
            @Value("${vayu.telemetry.offline-threshold-seconds:60}") int offlineThresholdSeconds,
            @Value("${vayu.fleet.initial-devices:VAYU-001,VAYU-002,VAYU-003,VAYU-004,VAYU-005}") String initialDevicesList) {
        this.staleThresholdSeconds = staleThresholdSeconds;
        this.offlineThresholdSeconds = offlineThresholdSeconds;
        this.initialDevices = Arrays.stream(initialDevicesList.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    @PostConstruct
    public void init() {
        for (String id : initialDevices) {
            deviceMap.put(id, new DeviceStateSnapshot(id));
        }
        log.info("Initialized in-memory device manager with {} pre-configured devices in WAITING_FOR_DATA state.", deviceMap.size());
    }

    /**
     * Atomically process fresh telemetry message.
     * Replaces previous latest reading in memory.
     * Guards against duplicate and out-of-order deliveries.
     */
    public boolean updateTelemetry(TelemetryMessage message) {
        if (message == null || message.deviceId() == null) return false;

        DeviceStateSnapshot snapshot = deviceMap.computeIfAbsent(message.deviceId(), DeviceStateSnapshot::new);

        synchronized (snapshot) {
            // Guard against out-of-order older messages
            if (snapshot.getLastTelemetryTimestamp() != null &&
                    message.timestamp().isBefore(snapshot.getLastTelemetryTimestamp())) {
                log.warn("[{}] Dropping out-of-order telemetry message. Message timestamp: {}, Current latest: {}",
                        message.deviceId(), message.timestamp(), snapshot.getLastTelemetryTimestamp());
                return false;
            }

            snapshot.setLatestTelemetry(message);
            snapshot.setLastTelemetryTimestamp(message.timestamp());
            snapshot.setLastReceivedAt(Instant.now());
            snapshot.setConnectionState(DeviceConnectionState.ONLINE);
            snapshot.setSimulated(message.isSimulated());

            // Diagnostic & fault detection evaluation
            boolean sensorsValid = message.diagnostics().pmSensorValid() &&
                    message.diagnostics().temperatureSensorValid() &&
                    (message.diagnostics().vocSensorValid() == null || message.diagnostics().vocSensorValid());

            boolean hasSystemFault = message.system().errorCode() != 0;

            if (!sensorsValid || hasSystemFault) {
                snapshot.setHealthState(DeviceHealthState.SENSOR_FAULT);
            } else {
                snapshot.setHealthState(DeviceHealthState.HEALTHY);
            }

            snapshot.setDisconnectReason(null);
            return true;
        }
    }

    /**
     * Process birth or LWT disconnect status announcement.
     */
    public void updateStatus(DeviceStatusMessage status) {
        if (status == null || status.deviceId() == null) return;

        DeviceStateSnapshot snapshot = deviceMap.computeIfAbsent(status.deviceId(), DeviceStateSnapshot::new);

        synchronized (snapshot) {
            snapshot.setLastStatusTimestamp(status.timestamp());
            snapshot.setSimulated(status.isSimulated());

            if (status.room() != null && !status.room().isBlank()) {
                snapshot.setRoom(status.room());
            }

            if ("ONLINE".equalsIgnoreCase(status.status())) {
                snapshot.setConnectionState(DeviceConnectionState.ONLINE);
                snapshot.setDisconnectReason(null);
                if (snapshot.getLatestTelemetry() == null) {
                    snapshot.setHealthState(DeviceHealthState.WAITING_FOR_DATA);
                }
                log.info("[{}] Device reported ONLINE.", status.deviceId());
            } else if ("OFFLINE".equalsIgnoreCase(status.status())) {
                snapshot.setConnectionState(DeviceConnectionState.OFFLINE);
                snapshot.setHealthState(DeviceHealthState.OFFLINE);
                snapshot.setDisconnectReason(status.reason() != null ? status.reason() : "DISCONNECTED");
                log.warn("[{}] Device reported OFFLINE. Reason: {}", status.deviceId(), snapshot.getDisconnectReason());
            }
        }
    }

    /**
     * Scheduled freshness monitor running every 3 seconds.
     * Automatically transitions stale telemetry and detects silent timeouts.
     */
    @Scheduled(fixedRate = 3000)
    public void evaluateFreshness() {
        Instant now = Instant.now();
        for (DeviceStateSnapshot snapshot : deviceMap.values()) {
            synchronized (snapshot) {
                if (snapshot.getConnectionState() == DeviceConnectionState.ONLINE && snapshot.getLastReceivedAt() != null) {
                    long elapsedSeconds = Duration.between(snapshot.getLastReceivedAt(), now).getSeconds();

                    if (elapsedSeconds >= offlineThresholdSeconds) {
                        snapshot.setConnectionState(DeviceConnectionState.OFFLINE);
                        snapshot.setHealthState(DeviceHealthState.OFFLINE);
                        snapshot.setDisconnectReason("MISSED_HEARTBEAT_TIMEOUT");
                        log.warn("[{}] Stale telemetry timeout exceeded ({}s >= {}s). Marking OFFLINE.",
                                snapshot.getDeviceId(), elapsedSeconds, offlineThresholdSeconds);
                    } else if (elapsedSeconds >= staleThresholdSeconds && snapshot.getHealthState() == DeviceHealthState.HEALTHY) {
                        snapshot.setHealthState(DeviceHealthState.STALE);
                        log.info("[{}] Fresh telemetry delayed ({}s >= {}s). Marking STALE.",
                                snapshot.getDeviceId(), elapsedSeconds, staleThresholdSeconds);
                    }
                }
            }
        }
    }

    public Optional<DeviceStateSnapshot> getDevice(String deviceId) {
        return Optional.ofNullable(deviceMap.get(deviceId));
    }

    public List<DeviceStateSnapshot> getAllDevices() {
        return new ArrayList<>(deviceMap.values());
    }

    public int getTotalConfigured() {
        return deviceMap.size();
    }

    public int getOnlineCount() {
        return (int) deviceMap.values().stream()
                .filter(d -> d.getConnectionState() == DeviceConnectionState.ONLINE)
                .count();
    }

    public int getOfflineCount() {
        return (int) deviceMap.values().stream()
                .filter(d -> d.getConnectionState() == DeviceConnectionState.OFFLINE)
                .count();
    }

    public int getStaleCount() {
        return (int) deviceMap.values().stream()
                .filter(d -> d.getHealthState() == DeviceHealthState.STALE)
                .count();
    }

    public int getFaultCount() {
        return (int) deviceMap.values().stream()
                .filter(d -> d.getHealthState() == DeviceHealthState.SENSOR_FAULT)
                .count();
    }
}
