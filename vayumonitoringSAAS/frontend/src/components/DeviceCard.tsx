import React from 'react';
import { DeviceListItem } from '../types/device';
import { Clock, ShieldAlert } from 'lucide-react';

interface DeviceCardProps {
  device: DeviceListItem;
  onSelect: (device: DeviceListItem) => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({ device, onSelect }) => {
  const getStatusBadge = () => {
    switch (device.health_state) {
      case 'HEALTHY':
        return { label: 'ONLINE', bg: '#DCFCE7', text: '#15803D', border: '#86EFAC' };
      case 'SENSOR_FAULT':
        return { label: 'SENSOR FAULT', bg: '#FEE2E2', text: '#B91C1C', border: '#FCA5A5' };
      case 'STALE':
        return { label: 'STALE DATA', bg: '#FEF3C7', text: '#B45309', border: '#FCD34D' };
      case 'WAITING_FOR_DATA':
        return { label: 'WAITING FOR DATA', bg: '#DBEAFE', text: '#1D4ED8', border: '#93C5FD' };
      case 'OFFLINE':
      default:
        return { label: 'OFFLINE', bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
    }
  };

  const getAqiColor = (aqi: number | null) => {
    if (aqi === null) return { bg: '#F1F5F9', text: '#64748B', label: 'N/A' };
    if (aqi <= 50) return { bg: '#DCFCE7', text: '#166534', label: 'Good' };
    if (aqi <= 100) return { bg: '#FEF9C3', text: '#854D0E', label: 'Moderate' };
    if (aqi <= 150) return { bg: '#FFEDD5', text: '#9A3412', label: 'USG' };
    if (aqi <= 200) return { bg: '#FEE2E2', text: '#991B1B', label: 'Unhealthy' };
    if (aqi <= 300) return { bg: '#F3E8FF', text: '#6B21A8', label: 'Very Unhealthy' };
    return { bg: '#881337', text: '#FFFFFF', label: 'Hazardous' };
  };

  const status = getStatusBadge();
  const aqiInfo = getAqiColor(device.metrics?.calculated_aqi ?? null);
  const m = device.metrics;

  return (
    <div
      onClick={() => onSelect(device)}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '8px',
        border: `1px solid ${device.health_state === 'SENSOR_FAULT' ? '#FCA5A5' : 'var(--color-border)'}`,
        boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
        padding: '1.25rem',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
      className="device-card-hover"
    >
      <div>
        {/* Top Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-navy)' }}>
                {device.device_id}
              </span>
              {device.is_simulated && (
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  backgroundColor: '#FFF7ED',
                  color: '#C2410C',
                  border: '1px solid #FFEDD5',
                  padding: '1px 5px',
                  borderRadius: '4px'
                }}>
                  SIMULATED
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '2px' }}>
              {device.room || 'Unassigned Area'}
            </div>
          </div>

          {/* Status Pill */}
          <span style={{
            fontSize: '0.725rem',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '9999px',
            backgroundColor: status.bg,
            color: status.text,
            border: `1px solid ${status.border}`,
            letterSpacing: '0.3px'
          }}>
            {status.label}
          </span>
        </div>

        {/* EPA AQI Banner */}
        <div style={{
          backgroundColor: aqiInfo.bg,
          color: aqiInfo.text,
          borderRadius: '6px',
          padding: '0.5rem 0.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>US EPA AQI:</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>
              {m?.calculated_aqi !== null && m?.calculated_aqi !== undefined ? m.calculated_aqi : '—'}
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
              {aqiInfo.label}
            </span>
          </div>
        </div>

        {/* Primary Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
          {/* PM2.5 */}
          <div style={{ backgroundColor: '#F8FAFC', padding: '0.5rem', borderRadius: '6px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 600 }}>PM2.5</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: m?.pm25 !== null && m?.pm25 !== undefined ? '#0F172A' : '#EF4444' }}>
              {m?.pm25 !== null && m?.pm25 !== undefined ? `${m.pm25}` : '—'}
            </div>
            <div style={{ fontSize: '0.6rem', color: '#94A3B8' }}>µg/m³</div>
          </div>

          {/* PM10 */}
          <div style={{ backgroundColor: '#F8FAFC', padding: '0.5rem', borderRadius: '6px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 600 }}>PM10</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: m?.pm10 !== null && m?.pm10 !== undefined ? '#0F172A' : '#EF4444' }}>
              {m?.pm10 !== null && m?.pm10 !== undefined ? `${m.pm10}` : '—'}
            </div>
            <div style={{ fontSize: '0.6rem', color: '#94A3B8' }}>µg/m³</div>
          </div>

          {/* VOC Index */}
          <div style={{ backgroundColor: '#F8FAFC', padding: '0.5rem', borderRadius: '6px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 600 }}>VOC INDEX</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: m?.voc_index !== null && m?.voc_index !== undefined ? '#0F172A' : '#94A3B8' }}>
              {m?.voc_index !== null && m?.voc_index !== undefined ? `${m.voc_index}` : '—'}
            </div>
            <div style={{ fontSize: '0.6rem', color: '#94A3B8' }}>1-500</div>
          </div>

          {/* PM1 */}
          <div style={{ backgroundColor: '#F8FAFC', padding: '0.5rem', borderRadius: '6px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 600 }}>PM1.0</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: m?.pm1 !== null && m?.pm1 !== undefined ? '#0F172A' : '#EF4444' }}>
              {m?.pm1 !== null && m?.pm1 !== undefined ? `${m.pm1}` : '—'}
            </div>
            <div style={{ fontSize: '0.6rem', color: '#94A3B8' }}>µg/m³</div>
          </div>

          {/* Temp */}
          <div style={{ backgroundColor: '#F8FAFC', padding: '0.5rem', borderRadius: '6px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 600 }}>TEMP</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: m?.temperature_c !== null && m?.temperature_c !== undefined ? '#0F172A' : '#EF4444' }}>
              {m?.temperature_c !== null && m?.temperature_c !== undefined ? `${m.temperature_c}°` : '—'}
            </div>
            <div style={{ fontSize: '0.6rem', color: '#94A3B8' }}>°C</div>
          </div>

          {/* Humidity */}
          <div style={{ backgroundColor: '#F8FAFC', padding: '0.5rem', borderRadius: '6px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 600 }}>HUMIDITY</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: m?.humidity_rh !== null && m?.humidity_rh !== undefined ? '#0F172A' : '#EF4444' }}>
              {m?.humidity_rh !== null && m?.humidity_rh !== undefined ? `${m.humidity_rh}%` : '—'}
            </div>
            <div style={{ fontSize: '0.6rem', color: '#94A3B8' }}>%RH</div>
          </div>
        </div>

        {/* Problems / Warnings Alert Strip */}
        {device.problems && device.problems.length > 0 && (
          <div style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '6px',
            padding: '0.45rem 0.6rem',
            marginBottom: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.725rem',
            color: '#B91C1C'
          }}>
            <ShieldAlert size={14} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {device.problems[0]}
            </span>
          </div>
        )}
      </div>

      {/* Footer Timestamp & Mode */}
      <div style={{
        borderTop: '1px solid var(--color-border)',
        paddingTop: '0.65rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.725rem',
        color: '#64748B'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Clock size={13} />
          <span>
            {device.elapsed_seconds_since_telemetry !== null && device.elapsed_seconds_since_telemetry !== undefined
              ? `${device.elapsed_seconds_since_telemetry}s ago`
              : 'No telemetry yet'}
          </span>
        </div>
        <div style={{ fontWeight: 600, color: 'var(--color-navy)' }}>
          Mode: {device.system?.operating_mode || 'AUTO'}
        </div>
      </div>
    </div>
  );
};
