package com.sochi.vayu.model;

import java.time.Instant;

public class DeviceStateSnapshot {

    private final String deviceId;
    private volatile String deviceName;
    private volatile String room;
    private volatile DeviceConnectionState connectionState;
    private volatile DeviceHealthState healthState;
    private volatile TelemetryMessage latestTelemetry;
    private volatile Instant lastTelemetryTimestamp;
    private volatile Instant lastReceivedAt;
    private volatile Instant lastStatusTimestamp;
    private volatile String disconnectReason;
    private volatile boolean isSimulated;

    public DeviceStateSnapshot(String deviceId) {
        this.deviceId = deviceId;
        this.deviceName = deviceId;
        this.room = "Unassigned";
        this.connectionState = DeviceConnectionState.WAITING_FOR_DATA;
        this.healthState = DeviceHealthState.WAITING_FOR_DATA;
        this.latestTelemetry = null;
        this.lastTelemetryTimestamp = null;
        this.lastReceivedAt = null;
        this.lastStatusTimestamp = null;
        this.disconnectReason = null;
        this.isSimulated = false;
    }

    public String getDeviceId() {
        return deviceId;
    }

    public String getDeviceName() {
        return deviceName;
    }

    public void setDeviceName(String deviceName) {
        this.deviceName = deviceName;
    }

    public String getRoom() {
        return room;
    }

    public void setRoom(String room) {
        this.room = room;
    }

    public DeviceConnectionState getConnectionState() {
        return connectionState;
    }

    public void setConnectionState(DeviceConnectionState connectionState) {
        this.connectionState = connectionState;
    }

    public DeviceHealthState getHealthState() {
        return healthState;
    }

    public void setHealthState(DeviceHealthState healthState) {
        this.healthState = healthState;
    }

    public TelemetryMessage getLatestTelemetry() {
        return latestTelemetry;
    }

    public void setLatestTelemetry(TelemetryMessage latestTelemetry) {
        this.latestTelemetry = latestTelemetry;
    }

    public Instant getLastTelemetryTimestamp() {
        return lastTelemetryTimestamp;
    }

    public void setLastTelemetryTimestamp(Instant lastTelemetryTimestamp) {
        this.lastTelemetryTimestamp = lastTelemetryTimestamp;
    }

    public Instant getLastReceivedAt() {
        return lastReceivedAt;
    }

    public void setLastReceivedAt(Instant lastReceivedAt) {
        this.lastReceivedAt = lastReceivedAt;
    }

    public Instant getLastStatusTimestamp() {
        return lastStatusTimestamp;
    }

    public void setLastStatusTimestamp(Instant lastStatusTimestamp) {
        this.lastStatusTimestamp = lastStatusTimestamp;
    }

    public String getDisconnectReason() {
        return disconnectReason;
    }

    public void setDisconnectReason(String disconnectReason) {
        this.disconnectReason = disconnectReason;
    }

    public boolean isSimulated() {
        return isSimulated;
    }

    public void setSimulated(boolean simulated) {
        isSimulated = simulated;
    }
}
