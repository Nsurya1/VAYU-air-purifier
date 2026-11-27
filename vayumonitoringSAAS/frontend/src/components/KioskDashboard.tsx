import React from 'react';
import { DeviceFleetResponse, DeviceListItem } from '../types/device';

interface KioskDashboardProps {
  fleet: DeviceFleetResponse | null;
  onExitKiosk: () => void;
  onSelectDevice: (device: DeviceListItem) => void;
}

export const KioskDashboard: React.FC<KioskDashboardProps> = ({ fleet, onExitKiosk, onSelectDevice }) => {
  if (!fleet) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#071527',
        color: '#FFFFFF',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: '1.5rem'
      }}>
        Initializing VAYU Kiosk Display...
      </div>
    );
  }

  const getAqiColor = (aqi: number | null) => {
    if (aqi === null) return { bg: '#334155', text: '#94A3B8', border: '#475569', label: 'NO DATA' };
    if (aqi <= 50) return { bg: '#064E3B', text: '#34D399', border: '#059669', label: 'GOOD' };
    if (aqi <= 100) return { bg: '#713F12', text: '#FDE047', border: '#CA8A04', label: 'MODERATE' };
    if (aqi <= 150) return { bg: '#7C2D12', text: '#FDBA74', border: '#EA580C', label: 'SENSITIVE' };
    if (aqi <= 200) return { bg: '#7F1D1D', text: '#FCA5A5', border: '#DC2626', label: 'UNHEALTHY' };
    if (aqi <= 300) return { bg: '#581C87', text: '#E9D5FF', border: '#9333EA', label: 'V. UNHEALTHY' };
    return { bg: '#4C0519', text: '#FECDD3', border: '#BE123C', label: 'HAZARDOUS' };
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#071527',
      color: '#FFFFFF',
      padding: '1.5rem 2rem',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Top Kiosk Bar */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '2px solid rgba(255,255,255,0.1)',
        paddingBottom: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            background: 'var(--color-orange)',
            borderRadius: '6px',
            padding: '6px 14px',
            fontWeight: 900,
            fontSize: '1.2rem',
            color: '#FFFFFF'
          }}>
            SOCHI
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, letterSpacing: '0.5px' }}>
              VAYU &bull; REAL-TIME FACILITY AIR QUALITY
            </h1>
            <p style={{ fontSize: '0.85rem', color: '#94A3B8', margin: 0 }}>
              Location: <strong>{fleet.site_name}</strong> &bull; Live Telemetry Display
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {/* Quick Summary Counts */}
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
            <span style={{ color: '#34D399' }}>● {fleet.summary.online_devices} Online</span>
            {fleet.summary.stale_devices > 0 && <span style={{ color: '#FBBF24' }}>● {fleet.summary.stale_devices} Stale</span>}
            {fleet.summary.fault_devices > 0 && <span style={{ color: '#F87171' }}>● {fleet.summary.fault_devices} Faults</span>}
            {fleet.summary.offline_devices > 0 && <span style={{ color: '#94A3B8' }}>● {fleet.summary.offline_devices} Offline</span>}
          </div>

          <button
            onClick={onExitKiosk}
            style={{
              backgroundColor: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.25)',
              color: '#FFFFFF',
              borderRadius: '6px',
              padding: '0.45rem 1rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Exit Kiosk Mode
          </button>
        </div>
      </header>

      {/* Main Kiosk Grid */}
      <main style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.25rem'
      }}>
        {fleet.devices.map((device) => {
          const m = device.metrics;
          const aqi = getAqiColor(m?.calculated_aqi ?? null);
          return (
            <div
              key={device.device_id}
              onClick={() => onSelectDevice(device)}
              style={{
                backgroundColor: '#0F223D',
                borderRadius: '10px',
                border: `2px solid ${device.health_state === 'SENSOR_FAULT' ? '#EF4444' : aqi.border}`,
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.3)'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                      {device.device_id}
                    </h2>
                    <div style={{ fontSize: '0.9rem', color: '#94A3B8', marginTop: '2px' }}>
                      {device.room || 'General Area'}
                    </div>
                  </div>

                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: aqi.bg,
                    color: aqi.text,
                    border: `1px solid ${aqi.border}`
                  }}>
                    {device.health_state}
                  </span>
                </div>

                {/* Big AQI Callout */}
                <div style={{
                  backgroundColor: aqi.bg,
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  border: `1px solid ${aqi.border}`
                }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: aqi.text, fontWeight: 700 }}>AIR QUALITY INDEX</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: aqi.text }}>{aqi.label}</div>
                  </div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, color: aqi.text, lineHeight: 1 }}>
                    {m?.calculated_aqi !== null && m?.calculated_aqi !== undefined ? m.calculated_aqi : '—'}
                  </div>
                </div>

                {/* Metrics Breakdown */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>PM2.5</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                      {m?.pm25 !== null && m?.pm25 !== undefined ? m.pm25 : '—'}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#64748B' }}>µg/m³</div>
                  </div>

                  <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>VOC</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                      {m?.voc_index !== null && m?.voc_index !== undefined ? m.voc_index : '—'}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#64748B' }}>Index</div>
                  </div>

                  <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>TEMP</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                      {m?.temperature_c !== null && m?.temperature_c !== undefined ? `${m.temperature_c}°` : '—'}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#64748B' }}>°C</div>
                  </div>
                </div>
              </div>

              {/* Kiosk Card Footer */}
              <div style={{
                marginTop: '1rem',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                paddingTop: '0.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                color: '#64748B'
              }}>
                <span>Last report: {device.elapsed_seconds_since_telemetry !== null && device.elapsed_seconds_since_telemetry !== undefined ? `${device.elapsed_seconds_since_telemetry}s ago` : 'Awaiting'}</span>
                <span>Mode: {device.system?.operating_mode || 'AUTO'}</span>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
};
