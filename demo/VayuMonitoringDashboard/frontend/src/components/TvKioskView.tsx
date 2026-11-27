import React from 'react';
import { DeviceSummary } from '../types/device';
import { IconAlertTriangle } from './Icons';

interface TvKioskViewProps {
  devices: DeviceSummary[];
  onSelectDevice: (device: DeviceSummary) => void;
}

export const TvKioskView: React.FC<TvKioskViewProps> = ({ devices, onSelectDevice }) => {
  const getCardStyle = (d: DeviceSummary): React.CSSProperties => {
    if (d.healthBadge === 'CRITICAL') {
      return {
        backgroundColor: '#260D0D',
        border: '2px solid #EF4444',
        boxShadow: '0 0 16px rgba(239, 68, 68, 0.4)',
      };
    }
    if (d.healthBadge === 'WARNING') {
      return {
        backgroundColor: '#261C0D',
        border: '2px solid #F59E0B',
      };
    }
    if (d.healthBadge === 'OFFLINE' || d.onlineStatus === 'OFFLINE') {
      return {
        backgroundColor: '#0F1A28',
        border: '1px solid #1E2E44',
        opacity: 0.75,
      };
    }
    return {
      backgroundColor: '#0E223D',
      border: '1px solid #1B355A',
    };
  };

  const getAqiColor = (aqi: number | null) => {
    if (aqi === null) return '#64748B';
    if (aqi <= 50) return '#10B981';
    if (aqi <= 100) return '#F59E0B';
    if (aqi <= 150) return '#F97316';
    if (aqi <= 200) return '#EF4444';
    return '#B91C1C';
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1.25rem',
      }}
    >
      {devices.map((d) => (
        <div
          key={d.deviceId}
          onClick={() => onSelectDevice(d)}
          style={{
            ...getCardStyle(d),
            borderRadius: '10px',
            padding: '1.25rem',
            cursor: 'pointer',
            transition: 'transform 0.15s ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          {/* Card Top: ID & Status */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div>
              <span
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: '#FFFFFF',
                  letterSpacing: '0.02em',
                }}
              >
                {d.deviceId}
              </span>
              <p style={{ fontSize: '0.8rem', color: '#94A3B8', margin: '0.1rem 0 0' }}>
                {d.siteId === 'SITE-HQ-PUNE' ? 'Pune HQ' : 'Bangalore R&D'}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
              <span className={`badge badge-${d.healthBadge.toLowerCase()}`} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                {d.healthBadge}
              </span>
              {d.simulated && (
                <span style={{ fontSize: '0.65rem', color: '#60A5FA', fontFamily: 'var(--font-mono)' }}>
                  SIM
                </span>
              )}
            </div>
          </div>

          {/* Card Middle: Primary Telemetry (AQI & PM2.5) */}
          <div
            style={{
              backgroundColor: 'rgba(0,0,0,0.25)',
              borderRadius: '8px',
              padding: '0.85rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              margin: '0.5rem 0',
            }}
          >
            {/* AQI */}
            <div>
              <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700 }}>AQI (EPA)</span>
              <div style={{ fontSize: '2.2rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: getAqiColor(d.aqi), lineHeight: 1 }}>
                {d.aqi !== null ? d.aqi : '--'}
              </div>
            </div>

            {/* PM2.5 */}
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700 }}>PM2.5 DENSITY</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#FFFFFF', lineHeight: 1 }}>
                {d.pm25 !== null ? (
                  <>
                    {d.pm25.toFixed(1)} <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>µg/m³</span>
                  </>
                ) : (
                  <span style={{ color: '#EF4444', fontSize: '1.1rem' }}>FAULT</span>
                )}
              </div>
            </div>
          </div>

          {/* Card Bottom: Fan Duty, Mode & Last Seen */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.85rem',
              color: '#CBD5E1',
              paddingTop: '0.5rem',
              borderTop: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div>
              <span>Fan: </span>
              <strong style={{ fontFamily: 'var(--font-mono)', color: '#F47721' }}>
                {d.fanPct !== null ? `${d.fanPct}%` : '--'}
              </strong>
              <span style={{ color: '#94A3B8', marginLeft: '0.4rem' }}>({d.mode || '--'})</span>
            </div>

            <div style={{ fontSize: '0.75rem', color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>
              {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleTimeString() : 'Never'}
            </div>
          </div>

          {/* Error Message Strip */}
          {d.errCode !== null && d.errCode > 0 && (
            <div
              style={{
                marginTop: '0.6rem',
                backgroundColor: 'rgba(239, 68, 68, 0.25)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                color: '#FCA5A5',
                fontSize: '0.75rem',
                fontWeight: 700,
                borderRadius: '4px',
                padding: '0.25rem 0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <IconAlertTriangle size={13} color="#EF4444" />
              <span>
                {(d.errCode & 0x01) ? 'MOTOR STALL TRIP' : (d.errCode & 0x02) ? 'PM SENSOR FAULT' : 'DIAGNOSTIC ALARM'}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
