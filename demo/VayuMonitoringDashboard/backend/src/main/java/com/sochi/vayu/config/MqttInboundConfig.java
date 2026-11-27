package com.sochi.vayu.config;

import com.sochi.vayu.service.DeviceStatusService;
import com.sochi.vayu.service.TelemetryIngestionService;
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttCallbackExtended;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Component
public class MqttInboundConfig implements SmartLifecycle {

    private static final Logger log = LoggerFactory.getLogger(MqttInboundConfig.class);

    private final TelemetryIngestionService telemetryIngestionService;
    private final DeviceStatusService deviceStatusService;
    private final String brokerUrl;
    private final String clientId;
    private final String username;
    private final String password;

    private MqttClient client;
    private boolean running = false;

    public MqttInboundConfig(
            TelemetryIngestionService telemetryIngestionService,
            DeviceStatusService deviceStatusService,
            @Value("${vayu.mqtt.broker-url:tcp://mosquitto:1883}") String brokerUrl,
            @Value("${vayu.mqtt.client-id:vayu_backend_gateway}") String clientId,
            @Value("${vayu.mqtt.username:}") String username,
            @Value("${vayu.mqtt.password:}") String password
    ) {
        this.telemetryIngestionService = telemetryIngestionService;
        this.deviceStatusService = deviceStatusService;
        this.brokerUrl = brokerUrl;
        this.clientId = clientId;
        this.username = username;
        this.password = password;
    }

    @Override
    public void start() {
        try {
            log.info("[MQTT INGESTION] Initializing subscriber connection to {} as {}", brokerUrl, clientId);
            client = new MqttClient(brokerUrl, clientId, null);

            MqttConnectOptions options = new MqttConnectOptions();
            options.setCleanSession(true);
            options.setAutomaticReconnect(true);
            options.setConnectionTimeout(10);
            options.setKeepAliveInterval(30);

            if (username != null && !username.isBlank()) {
                options.setUserName(username);
                if (password != null) {
                    options.setPassword(password.toCharArray());
                }
            }

            client.setCallback(new MqttCallbackExtended() {
                @Override
                public void connectComplete(boolean reconnect, String serverURI) {
                    log.info("[MQTT INGESTION] Connected to {} (reconnect: {})", serverURI, reconnect);
                    try {
                        client.subscribe("vayu/+/telemetry", 1);
                        client.subscribe("vayu/+/status", 1);
                        log.info("[MQTT INGESTION] Subscribed to vayu/+/telemetry and vayu/+/status");
                    } catch (Exception e) {
                        log.error("[MQTT INGESTION] Failed to subscribe to topics: {}", e.getMessage());
                    }
                }

                @Override
                public void connectionLost(Throwable cause) {
                    log.warn("[MQTT INGESTION] Connection lost to broker: {}", cause != null ? cause.getMessage() : "Unknown");
                }

                @Override
                public void messageArrived(String topic, MqttMessage message) {
                    try {
                        String payload = new String(message.getPayload(), StandardCharsets.UTF_8);
                        if (topic.endsWith("/telemetry")) {
                            telemetryIngestionService.ingestTelemetry(payload);
                        } else if (topic.endsWith("/status")) {
                            deviceStatusService.ingestStatus(payload);
                        }
                    } catch (Exception e) {
                        log.error("[MQTT INGESTION] Error processing topic {}: {}", topic, e.getMessage(), e);
                    }
                }

                @Override
                public void deliveryComplete(IMqttDeliveryToken token) {}
            });

            client.connect(options);
            running = true;

        } catch (Exception e) {
            log.error("[MQTT INGESTION] Could not establish connection on startup: {}", e.getMessage());
            running = false;
        }
    }

    @Override
    public void stop() {
        try {
            if (client != null && client.isConnected()) {
                client.disconnect();
                client.close();
                log.info("[MQTT INGESTION] Disconnected subscriber gracefully.");
            }
        } catch (Exception e) {
            log.warn("[MQTT INGESTION] Error during disconnect: {}", e.getMessage());
        }
        running = false;
    }

    @Override
    public boolean isRunning() {
        return running;
    }
}
