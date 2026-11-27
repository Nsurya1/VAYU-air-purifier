package com.sochi.vayu.service;

import org.springframework.stereotype.Component;

/**
 * Standard US EPA AQI (Air Quality Index) Calculator based on PM2.5 concentration.
 * If PM2.5 is null or invalid, AQI cannot be calculated and returns null.
 */
@Component
public class AqiCalculator {

    public record AqiBreakpoint(double cLow, double cHigh, int iLow, int iHigh, String category) {}

    private static final AqiBreakpoint[] BREAKPOINTS = {
            new AqiBreakpoint(0.0, 12.0, 0, 50, "Good"),
            new AqiBreakpoint(12.1, 35.4, 51, 100, "Moderate"),
            new AqiBreakpoint(35.5, 55.4, 101, 150, "Unhealthy for Sensitive Groups"),
            new AqiBreakpoint(55.5, 150.4, 151, 200, "Unhealthy"),
            new AqiBreakpoint(150.5, 250.4, 201, 300, "Very Unhealthy"),
            new AqiBreakpoint(250.5, 500.4, 301, 500, "Hazardous")
    };

    /**
     * Calculates the Air Quality Index (AQI) from PM2.5 concentration in µg/m³.
     * Formula: I = ((I_high - I_low) / (C_high - C_low)) * (C - C_low) + I_low
     *
     * @param pm25 Concentration in µg/m³
     * @return Calculated integer AQI (0-500) or null if input is invalid/null
     */
    public Integer calculateFromPm25(Double pm25) {
        if (pm25 == null || pm25 < 0.0) {
            return null;
        }

        // Truncate to 1 decimal place per EPA standard
        double c = Math.floor(pm25 * 10.0) / 10.0;

        for (AqiBreakpoint bp : BREAKPOINTS) {
            if (c >= bp.cLow && c <= bp.cHigh) {
                double aqi = ((double) (bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (c - bp.cLow) + bp.iLow;
                return (int) Math.round(aqi);
            }
        }

        // Above standard scale
        if (c > 500.4) {
            return 500;
        }

        return null;
    }

    public String getAqiCategory(Integer aqi) {
        if (aqi == null) return "Unavailable";
        if (aqi <= 50) return "Good";
        if (aqi <= 100) return "Moderate";
        if (aqi <= 150) return "Unhealthy for Sensitive Groups";
        if (aqi <= 200) return "Unhealthy";
        if (aqi <= 300) return "Very Unhealthy";
        return "Hazardous";
    }
}
