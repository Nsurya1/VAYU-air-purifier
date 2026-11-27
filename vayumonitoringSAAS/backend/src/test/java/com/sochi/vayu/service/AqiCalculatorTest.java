package com.sochi.vayu.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AqiCalculatorTest {

    private AqiCalculator calculator;

    @BeforeEach
    void setUp() {
        calculator = new AqiCalculator();
    }

    @Test
    @DisplayName("Null PM2.5 returns null AQI (explicit null rule)")
    void nullPm25ReturnsNull() {
        assertNull(calculator.calculateFromPm25(null));
        assertEquals("Unavailable", calculator.getAqiCategory(null));
    }

    @Test
    @DisplayName("Negative PM2.5 returns null AQI")
    void negativePm25ReturnsNull() {
        assertNull(calculator.calculateFromPm25(-5.0));
    }

    @Test
    @DisplayName("EPA Good range (0 - 12.0 µg/m³) calculates AQI correctly")
    void goodRangeCalculatesCorrectly() {
        Integer aqiZero = calculator.calculateFromPm25(0.0);
        assertEquals(0, aqiZero);

        Integer aqiMid = calculator.calculateFromPm25(6.0);
        assertNotNull(aqiMid);
        assertEquals(25, aqiMid);
        assertEquals("Good", calculator.getAqiCategory(aqiMid));

        Integer aqiMax = calculator.calculateFromPm25(12.0);
        assertEquals(50, aqiMax);
    }

    @Test
    @DisplayName("EPA Moderate range (12.1 - 35.4 µg/m³) calculates AQI correctly")
    void moderateRangeCalculatesCorrectly() {
        Integer aqi = calculator.calculateFromPm25(25.0);
        assertNotNull(aqi);
        assertTrue(aqi >= 51 && aqi <= 100);
        assertEquals("Moderate", calculator.getAqiCategory(aqi));
    }

    @Test
    @DisplayName("EPA Unhealthy range (55.5 - 150.4 µg/m³) calculates AQI correctly")
    void unhealthyRangeCalculatesCorrectly() {
        Integer aqi = calculator.calculateFromPm25(80.0);
        assertNotNull(aqi);
        assertTrue(aqi >= 151 && aqi <= 200);
        assertEquals("Unhealthy", calculator.getAqiCategory(aqi));
    }
}
