package com.sochi.vayu.exception;

public class DeviceNotFoundException extends RuntimeException {
    public DeviceNotFoundException(String deviceId) {
        super("Device with ID '" + deviceId + "' is not registered or found in this installation.");
    }
}
