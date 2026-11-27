package com.sochi.vayu.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.sochi.vayu.model.DeviceStatusMessage;
import com.sochi.vayu.model.TelemetryMessage;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.eclipse.paho.client.mqttv3.*;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class MqttIngestionService implements MqttCallbackExtended {

    private static final Logger log = LoggerFactory.getLogger(MqttIngestionService.class);

    private static final Pattern TELEMETRY_TOPIC_PATTERN = Pattern.compile("^vayu/devices/([^/]+)/telemetry$");
    private static final Pattern STATUS_TOPIC_PATTERN = Pattern.compile("^vayu/devices/([^/]+)/status$");

    private final String brokerHost;
    private final int brokerPort;
    private final String username;
    private final String password;
    private final String clientId;

    private final TelemetryValidator validator;
    private final InMemoryDeviceStateManager stateManager;
    private final ObjectMapper objectMapper;

    private MqttAsyncClient mqttClient;

    public MqttIngestionService(
            @Value("${vayu.mqtt.broker-host:localhost}") String brokerHost,
            @Value("${vayu.mqtt.broker-port:1883}") int brokerPort,
            @Value("${vayu.mqtt.username:vayu_backend}") String username,
            @Value("${vayu.mqtt.password:VayuBackend2026!}") String password,
            @Value("${vayu.mqtt.client-id:vayu_backend_core}") String clientId,
            TelemetryValidator validator,
            InMemoryDeviceStateManager stateManager) {
        this.brokerHost = brokerHost;
        this.brokerPort = brokerPort;
        this.username = username;
        this.password = password;
        this.clientId = clientId;
        this.validator = validator;
        this.stateManager = stateManager;
        this.objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
    }

    @PostConstruct
    public void start() {
        String brokerUrl = "tcp://" + brokerHost + ":" + brokerPort;
        log.info("Starting MQTT Ingestion Service connecting to {} with clientId {}", brokerUrl, clientId);

        try {
            mqttClient = new MqttAsyncClient(brokerUrl, clientId, new MemoryPersistence());
            mqttClient.setCallback(this);

            MqttConnectOptions options = new MqttConnectOptions();
            options.setCleanSession(true);
            options.setAutomaticReconnect(true);
            options.setConnectionTimeout(10);
            options.setKeepAliveInterval(20);
            options.setUserName(username);
            options.setPassword(password.toCharArray());

            mqttClient.connect(options, null, new IMqttActionListener() {
                @Override
                public void onSuccess(IMqttToken asyncActionToken) {
                    log.info("Connected to Mosquitto broker successfully.");
                    subscribeToTopics();
                }

                @Override
                public void onFailure(IMqttToken asyncActionToken, Throwable exception) {
                    log.error("Initial connection to Mosquitto broker failed: {}. Will retry automatically.", exception.getMessage());
                }
            });
        } catch (MqttException e) {
            log.error("Error creating MQTT client: {}", e.getMessage(), e);
        }
    }

    @Override
    public void connectComplete(boolean reconnect, String serverURI) {
        if (reconnect) {
            log.warn("Reconnected to MQTT broker at {}. Restoring topic subscriptions...", serverURI);
            subscribeToTopics();
        }
    }

    private void subscribeToTopics() {
        if (mqttClient == null || !mqttClient.isConnected()) return;

        try {
            String[] topics = {"vayu/devices/+/telemetry", "vayu/devices/+/status"};
            int[] qos = {1, 1};

            mqttClient.subscribe(topics, qos, null, new IMqttActionListener() {
                @Override
                public void onSuccess(IMqttToken asyncActionToken) {
                    log.info("Subscribed to MQTT topics: vayu/devices/+/telemetry and vayu/devices/+/status [QoS 1]");
                }

                @Override
                public void onFailure(IMqttToken asyncActionToken, Throwable exception) {
                    log.error("Failed to subscribe to MQTT topics: {}", exception.getMessage());
                }
            });
        } catch (MqttException e) {
            log.error("Exception during topic subscription: {}", e.getMessage(), e);
        }
    }

    @Override
    public void connectionLost(Throwable cause) {
        log.warn("MQTT connection lost: {}. Paho automatic reconnect is active.", cause != null ? cause.getMessage() : "Unknown");
    }

    @Override
    public void messageArrived(String topic, MqttMessage message) {
        String payload = new String(message.getPayload(), StandardCharsets.UTF_8);

        Matcher telemetryMatcher = TELEMETRY_TOPIC_PATTERN.matcher(topic);
        if (telemetryMatcher.matches()) {
            handleTelemetryMessage(topic, payload);
            return;
        }

        Matcher statusMatcher = STATUS_TOPIC_PATTERN.matcher(topic);
        if (statusMatcher.matches()) {
            handleStatusMessage(topic, payload);
            return;
        }

        log.debug("Received unhandled topic: {}", topic);
    }

    private void handleTelemetryMessage(String topic, String payload) {
        try {
            TelemetryMessage telemetry = objectMapper.readValue(payload, TelemetryMessage.class);

            TelemetryValidator.ValidationResult result = validator.validate(telemetry);
            if (!result.valid()) {
                log.warn("[MALFORMED_TELEMETRY] Dropped invalid packet on topic {}: {}", topic, result.errorMessage());
                return;
            }

            stateManager.updateTelemetry(telemetry);
        } catch (Exception e) {
            log.warn("[QUARANTINE] Failed to parse telemetry JSON on topic {}: {}", topic, e.getMessage());
        }
    }

    private void handleStatusMessage(String topic, String payload) {
        try {
            DeviceStatusMessage status = objectMapper.readValue(payload, DeviceStatusMessage.class);
            stateManager.updateStatus(status);
        } catch (Exception e) {
            log.warn("[QUARANTINE] Failed to parse device status JSON on topic {}: {}", topic, e.getMessage());
        }
    }

    @Override
    public void deliveryComplete(IMqttDeliveryToken token) {
        // Passive subscriber in Version 1
    }

    @PreDestroy
    public void stop() {
        if (mqttClient != null) {
            try {
                if (mqttClient.isConnected()) {
                    mqttClient.disconnect();
                }
                mqttClient.close();
                log.info("Disconnected and closed MQTT Ingestion Service.");
            } catch (MqttException e) {
                log.error("Error closing MQTT client: {}", e.getMessage());
            }
        }
    }

    public boolean isConnected() {
        return mqttClient != null && mqttClient.isConnected();
    }
}
