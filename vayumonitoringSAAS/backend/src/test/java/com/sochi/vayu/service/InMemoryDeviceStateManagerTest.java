package com.sochi.vayu.service;

import com.sochi.vayu.model.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class InMemoryDeviceStateManagerTest {

    private InMemoryDeviceStateManager stateManager;

    @BeforeEach
    void setUp() {
        // staleThreshold = 2s, offlineThreshold = 4s for fast testing
        stateManager = new InMemoryDeviceStateManager(2, 4, "VAYU-001,VAYU-002");
        stateManager.init();
    }

    private TelemetryMessage createSampleMessage(String deviceId, Instant timestamp, boolean pmValid, int errorCode) {
        TelemetryMetrics metrics = new TelemetryMetrics(
                pmValid ? 5.0 : null,
                pmValid ? 12.0 : null,
                pmValid ? 18.0 : null,
                80,
                23.0,
                50.0
        );
        TelemetryDiagnostics diag = new TelemetryDiagnostics(pmValid, true, true);
        TelemetrySystem sys = new TelemetrySystem("1.0.0", errorCode, "AUTO");

        return new TelemetryMessage("1.0.0", deviceId, timestamp, true, metrics, diag, sys);
    }

    @Test
    @DisplayName("Pre-configured devices initialize in WAITING_FOR_DATA state")
    void initialDevicesStartInWaitingForData() {
        Optional<DeviceStateSnapshot> dev = stateManager.getDevice("VAYU-001");
        assertTrue(dev.isPresent());
        assertEquals(DeviceConnectionState.WAITING_FOR_DATA, dev.get().getConnectionState());
        assertEquals(DeviceHealthState.WAITING_FOR_DATA, dev.get().getHealthState());
        assertNull(dev.get().getLatestTelemetry());
    }

    @Test
    @DisplayName("Fresh valid telemetry transitions device to ONLINE and HEALTHY")
    void freshTelemetrySetsOnlineAndHealthy() {
        TelemetryMessage msg = createSampleMessage("VAYU-001", Instant.now(), true, 0);
        boolean accepted = stateManager.updateTelemetry(msg);

        assertTrue(accepted);
        DeviceStateSnapshot dev = stateManager.getDevice("VAYU-001").orElseThrow();
        assertEquals(DeviceConnectionState.ONLINE, dev.getConnectionState());
        assertEquals(DeviceHealthState.HEALTHY, dev.getHealthState());
        assertNotNull(dev.getLatestTelemetry());
        assertEquals(12.0, dev.getLatestTelemetry().metrics().pm25());
    }

    @Test
    @DisplayName("Out-of-order older telemetry is rejected and does not corrupt latest state")
    void outOfOrderTelemetryRejected() {
        Instant t2 = Instant.now();
        Instant t1 = t2.minus(10, ChronoUnit.SECONDS);

        // Newer message arrives first
        TelemetryMessage newerMsg = createSampleMessage("VAYU-001", t2, true, 0);
        stateManager.updateTelemetry(newerMsg);

        // Older message arrives later (e.g. MQTT duplicate or network delayed packet)
        TelemetryMessage olderMsg = createSampleMessage("VAYU-001", t1, true, 0);
        boolean accepted = stateManager.updateTelemetry(olderMsg);

        assertFalse(accepted, "Older out-of-order message must be rejected");
        DeviceStateSnapshot dev = stateManager.getDevice("VAYU-001").orElseThrow();
        assertEquals(t2, dev.getLastTelemetryTimestamp());
    }

    @Test
    @DisplayName("Sensor fault causes health state to transition to SENSOR_FAULT")
    void sensorFaultTransitionsState() {
        TelemetryMessage faultMsg = createSampleMessage("VAYU-001", Instant.now(), false, 101);
        stateManager.updateTelemetry(faultMsg);

        DeviceStateSnapshot dev = stateManager.getDevice("VAYU-001").orElseThrow();
        assertEquals(DeviceConnectionState.ONLINE, dev.getConnectionState());
        assertEquals(DeviceHealthState.SENSOR_FAULT, dev.getHealthState());
        assertNull(dev.getLatestTelemetry().metrics().pm25());
    }

    @Test
    @DisplayName("Stale sweep transitions device to STALE when fresh data stops arriving")
    void staleThresholdDetection() throws InterruptedException {
        TelemetryMessage msg = createSampleMessage("VAYU-001", Instant.now(), true, 0);
        stateManager.updateTelemetry(msg);

        // Wait past stale threshold (2s)
        Thread.sleep(2500);
        stateManager.evaluateFreshness();

        DeviceStateSnapshot dev = stateManager.getDevice("VAYU-001").orElseThrow();
        assertEquals(DeviceHealthState.STALE, dev.getHealthState());
        assertEquals(DeviceConnectionState.ONLINE, dev.getConnectionState());
    }

    @Test
    @DisplayName("Offline sweep transitions device to OFFLINE when timeout exceeds offline threshold")
    void offlineTimeoutDetection() throws InterruptedException {
        TelemetryMessage msg = createSampleMessage("VAYU-001", Instant.now(), true, 0);
        stateManager.updateTelemetry(msg);

        // Wait past offline threshold (4s)
        Thread.sleep(4500);
        stateManager.evaluateFreshness();

        DeviceStateSnapshot dev = stateManager.getDevice("VAYU-001").orElseThrow();
        assertEquals(DeviceHealthState.OFFLINE, dev.getHealthState());
        assertEquals(DeviceConnectionState.OFFLINE, dev.getConnectionState());
        assertEquals("MISSED_HEARTBEAT_TIMEOUT", dev.getDisconnectReason());
    }

    @Test
    @DisplayName("MQTT Last Will status message transitions device to OFFLINE immediately")
    void lwtDisconnectTransitionsToOffline() {
        // First bring online
        TelemetryMessage msg = createSampleMessage("VAYU-001", Instant.now(), true, 0);
        stateManager.updateTelemetry(msg);

        // Receive LWT disconnect message
        DeviceStatusMessage lwt = new DeviceStatusMessage(
                "1.0.0", "VAYU-001", "OFFLINE", Instant.now(), "UNEXPECTED_DISCONNECT", "1.0.0", "Room A", true
        );
        stateManager.updateStatus(lwt);

        DeviceStateSnapshot dev = stateManager.getDevice("VAYU-001").orElseThrow();
        assertEquals(DeviceConnectionState.OFFLINE, dev.getConnectionState());
        assertEquals(DeviceHealthState.OFFLINE, dev.getHealthState());
        assertEquals("UNEXPECTED_DISCONNECT", dev.getDisconnectReason());
    }

    @Test
    @DisplayName("Multiple devices maintain completely isolated in-memory states")
    void multiDeviceIsolation() {
        TelemetryMessage msg1 = createSampleMessage("VAYU-001", Instant.now(), true, 0);
        TelemetryMessage msg2 = createSampleMessage("VAYU-002", Instant.now(), false, 101);

        stateManager.updateTelemetry(msg1);
        stateManager.updateTelemetry(msg2);

        DeviceStateSnapshot dev1 = stateManager.getDevice("VAYU-001").orElseThrow();
        DeviceStateSnapshot dev2 = stateManager.getDevice("VAYU-002").orElseThrow();

        assertEquals(DeviceHealthState.HEALTHY, dev1.getHealthState());
        assertEquals(DeviceHealthState.SENSOR_FAULT, dev2.getHealthState());
    }
}
