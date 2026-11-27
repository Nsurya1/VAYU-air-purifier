"""
SOCHI VAYU - EPA Air Quality Index (AQI) Calculation Module
Implements standard US-EPA linear interpolation across official particulate breakpoints.
Reference: EPA-454/B-18-007 (Technical Assistance Document for the Reporting of Daily Air Quality)
"""

from typing import Optional, Tuple

# EPA PM2.5 Breakpoints: (C_low, C_high, I_low, I_high)
PM25_BREAKPOINTS = [
    (0.0, 12.0, 0, 50),         # Good
    (12.1, 35.4, 51, 100),      # Moderate
    (35.5, 55.4, 101, 150),     # Unhealthy for Sensitive Groups
    (55.5, 150.4, 151, 200),    # Unhealthy
    (150.5, 250.4, 201, 300),   # Very Unhealthy
    (250.5, 350.4, 301, 400),   # Hazardous (Tier 1)
    (350.5, 500.4, 401, 500),   # Hazardous (Tier 2)
]

# EPA PM10 Breakpoints: (C_low, C_high, I_low, I_high)
PM10_BREAKPOINTS = [
    (0, 54, 0, 50),
    (55, 154, 51, 100),
    (155, 254, 101, 150),
    (255, 354, 151, 200),
    (355, 424, 201, 300),
    (425, 504, 301, 400),
    (505, 604, 401, 500),
]


def calculate_sub_index(conc: float, breakpoints: list[Tuple[float, float, int, int]]) -> int:
    """Calculate sub-index using EPA linear interpolation formula."""
    if conc < 0.0:
        return 0

    # Truncate to 1 decimal place as specified by EPA guidelines
    c = round(float(conc), 1)

    for c_low, c_high, i_low, i_high in breakpoints:
        if c_low <= c <= c_high:
            # Formula: I = ((I_high - I_low) / (C_high - C_low)) * (C - C_low) + I_low
            return round(((i_high - i_low) / (c_high - c_low)) * (c - c_low) + i_low)

    # Beyond upper bound (beyond 500.4 ug/m3 for PM2.5)
    return 500


def calculate_aqi(pm25: Optional[float], pm10: Optional[float] = None) -> Tuple[int, str]:
    """
    Computes overall AQI from PM2.5 and optional PM10 concentrations.
    Returns (aqi_value, category_string).
    """
    if pm25 is None and pm10 is None:
        return 0, "UNKNOWN"

    aqi_pm25 = calculate_sub_index(pm25, PM25_BREAKPOINTS) if pm25 is not None else 0
    aqi_pm10 = calculate_sub_index(pm10, PM10_BREAKPOINTS) if pm10 is not None else 0

    overall_aqi = max(aqi_pm25, aqi_pm10)

    if overall_aqi <= 50:
        category = "GOOD"
    elif overall_aqi <= 100:
        category = "MODERATE"
    elif overall_aqi <= 150:
        category = "UNHEALTHY_FOR_SENSITIVE"
    elif overall_aqi <= 200:
        category = "UNHEALTHY"
    elif overall_aqi <= 300:
        category = "VERY_UNHEALTHY"
    else:
        category = "HAZARDOUS"

    return overall_aqi, category
