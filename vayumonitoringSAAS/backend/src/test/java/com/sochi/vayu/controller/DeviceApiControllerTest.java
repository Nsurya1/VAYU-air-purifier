package com.sochi.vayu.controller;

import com.sochi.vayu.model.DeviceStateSnapshot;
import com.sochi.vayu.service.DeviceDtoMapper;
import com.sochi.vayu.service.InMemoryDeviceStateManager;
import com.sochi.vayu.service.MqttIngestionService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(DeviceApiController.class)
class DeviceApiControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private InMemoryDeviceStateManager stateManager;

    @MockBean
    private DeviceDtoMapper dtoMapper;

    @MockBean
    private MqttIngestionService mqttIngestionService;

    @Test
    @DisplayName("GET /api/v1/devices returns fleet summary and device list")
    void getFleetReturnsSummaryAndList() throws Exception {
        DeviceStateSnapshot dev1 = new DeviceStateSnapshot("VAYU-001");
        when(stateManager.getAllDevices()).thenReturn(List.of(dev1));
        when(stateManager.getTotalConfigured()).thenReturn(1);
        when(stateManager.getOnlineCount()).thenReturn(0);
        when(stateManager.getOfflineCount()).thenReturn(0);
        when(stateManager.getStaleCount()).thenReturn(0);
        when(stateManager.getFaultCount()).thenReturn(0);

        mockMvc.perform(get("/api/v1/devices")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.total_devices").value(1))
                .andExpect(jsonPath("$.devices").isArray());
    }

    @Test
    @DisplayName("GET /api/v1/devices/{deviceId} returns 404 for unknown device")
    void getDeviceNotFoundReturns404() throws Exception {
        when(stateManager.getDevice("VAYU-999")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/v1/devices/VAYU-999")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"))
                .andExpect(jsonPath("$.message").value("Device with ID 'VAYU-999' is not registered or found in this installation."));
    }

    @Test
    @DisplayName("GET /api/v1/system/diagnostics returns JVM memory and connection health")
    void getDiagnosticsReturnsHealth() throws Exception {
        when(mqttIngestionService.isConnected()).thenReturn(true);
        when(stateManager.getTotalConfigured()).thenReturn(5);

        mockMvc.perform(get("/api/v1/system/diagnostics")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mqtt_broker_connected").value(true))
                .andExpect(jsonPath("$.total_configured_devices").value(5))
                .andExpect(jsonPath("$.jvm_used_memory_mb").isNumber());
    }
}
