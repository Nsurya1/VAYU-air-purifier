package com.sochi.vayu.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sochi.vayu.dto.CommandRequestDto;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class MqttGatewayService {

    private static final Logger log = LoggerFactory.getLogger(MqttGatewayService.class);

    private final ObjectMapper objectMapper;
    private final String brokerUrl;
    private final String username;
    private final String password;
    private MqttClient publisherClient;

    public MqttGatewayService(
            ObjectMapper objectMapper,
            @Value("${vayu.mqtt.broker-url:tcp://mosquitto:1883}") String brokerUrl,
            @Value("${vayu.mqtt.username:}") String username,
            @Value("${vayu.mqtt.password:}") String password
    ) {
        this.objectMapper = objectMapper;
        this.brokerUrl = brokerUrl;
        this.username = username;
        this.password = password;
        initPublisher();
    }

    private synchronized void initPublisher() {
        try {
            String clientId = "vayu_backend_cmd_pub_" + UUID.randomUUID().toString().substring(0, 8);
            publisherClient = new MqttClient(brokerUrl, clientId, null);
            MqttConnectOptions options = new MqttConnectOptions();
            options.setCleanSession(true);
            options.setAutomaticReconnect(true);
            options.setConnectionTimeout(10);

            if (username != null && !username.isBlank()) {
                options.setUserName(username);
                if (password != null) {
                    options.setPassword(password.toCharArray());
                }
            }

            publisherClient.connect(options);
            log.info("[MQTT PUBLISHER] Connected to broker: {}", brokerUrl);
        } catch (Exception e) {
            log.warn("[MQTT PUBLISHER] Failed to initialize command publisher: {}", e.getMessage());
        }
    }

    public boolean sendDeviceCommand(String deviceId, CommandRequestDto request) {
        try {
            if (publisherClient == null || !publisherClient.isConnected()) {
                initPublisher();
            }

            String topic = "vayu/" + deviceId + "/cmd";
            String cmdId = "cmd-" + UUID.randomUUID().toString().substring(0, 8);

            Map<String, Object> payload = new HashMap<>();
            payload.put("cmd_id", cmdId);
            payload.put("command", request.getCommand());
            payload.put("timestamp", OffsetDateTime.now().toString());

            if (request.getFanPct() != null) {
                payload.put("fan_pct", request.getFanPct());
            }
            if (request.getMode() != null) {
                payload.put("mode", request.getMode());
            }
            if (request.getTargetVersion() != null) {
                payload.put("target_version", request.getTargetVersion());
            }
            if (request.getBinaryUrl() != null) {
                payload.put("binary_url", request.getBinaryUrl());
            }
            if (request.getSha256() != null) {
                payload.put("sha256", request.getSha256());
            }

            byte[] jsonBytes = objectMapper.writeValueAsBytes(payload);
            MqttMessage msg = new MqttMessage(jsonBytes);
            msg.setQos(1);

            publisherClient.publish(topic, msg);
            log.info("[COMMAND SENT] Target: {} | Command: {} (id: {})", deviceId, request.getCommand(), cmdId);
            return true;
        } catch (Exception e) {
            log.error("[COMMAND ERROR] Failed to send command to {}: {}", deviceId, e.getMessage());
            return false;
        }
    }
}
