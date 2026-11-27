import React from 'react';
import { DeviceListItem } from '../types/device';

interface DeviceTableProps {
  devices: DeviceListItem[];
  onSelect: (device: DeviceListItem) => void;
}

export const DeviceTable: React.FC<DeviceTableProps> = ({ devices, onSelect }) => {
  const getStatusBadge = (state: string) => {
    switch (state) {
      case 'HEALTHY':
        return { label: 'ONLINE', bg: '#DCFCE7', text: '#15803D' };
      case 'SENSOR_FAULT':
        return { label: 'FAULT', bg: '#FEE2E2', text: '#B91C1C' };
      case 'STALE':
        return { label: 'STALE', bg: '#FEF3C7', text: '#B45309' };
      case 'WAITING_FOR_DATA':
        return { label: 'WAITING', bg: '#DBEAFE', text: '#1D4ED8' };
      case 'OFFLINE':
      default:
        return { label: 'OFFLINE', bg: '#F1F5F9', text: '#475569' };
    }
  };

  return (
    <div style={{
      backgroundColor: '#FFFFFF',
      borderRadius: '8px',
      border: '1px solid var(--color-border)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      overflowX: 'auto'
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
        <thead>
          <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid var(--color-border)', color: '#475569' }}>
            <th style={{ padding: '0.75rem 1rem' }}>Device ID</th>
            <th style={{ padding: '0.75rem 1rem' }}>Location / Room</th>
            <th style={{ padding: '0.75rem 1rem' }}>Status</th>
            <th style={{ padding: '0.75rem 1rem' }}>AQI</th>
            <th style={{ padding: '0.75rem 1rem' }}>PM2.5 (µg/m³)</th>
            <th style={{ padding: '0.75rem 1rem' }}>PM10 (µg/m³)</th>
            <th style={{ padding: '0.75rem 1rem' }}>VOC Index</th>
            <th style={{ padding: '0.75rem 1rem' }}>Temp / RH</th>
            <th style={{ padding: '0.75rem 1rem' }}>Last Seen</th>
            <th style={{ padding: '0.75rem 1rem' }}>Diagnostics / Faults</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => {
            const st = getStatusBadge(device.health_state);
            const m = device.metrics;
            return (
              <tr
                key={device.device_id}
                onClick={() => onSelect(device)}
                style={{
                  borderBottom: '1px solid #F1F5F9',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease'
                }}
                className="table-row-hover"
              >
                <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--color-navy)' }}>
                  {device.device_id}
                  {device.is_simulated && (
                    <span style={{ marginLeft: '6px', fontSize: '0.65rem', color: '#EA580C', fontWeight: 600 }}>
                      [SIM]
                    </span>
                  )}
                </td>
                <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>
                  {device.room || '—'}
                </td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '4px',
                    backgroundColor: st.bg,
                    color: st.text
                  }}>
                    {st.label}
                  </span>
                </td>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>
                  {m?.calculated_aqi !== null && m?.calculated_aqi !== undefined ? (
                    <span>{m.calculated_aqi} ({m.aqi_category})</span>
                  ) : '—'}
                </td>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                  {m?.pm25 !== null && m?.pm25 !== undefined ? m.pm25 : <span style={{ color: '#EF4444' }}>—</span>}
                </td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  {m?.pm10 !== null && m?.pm10 !== undefined ? m.pm10 : <span style={{ color: '#EF4444' }}>—</span>}
                </td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  {m?.voc_index !== null && m?.voc_index !== undefined ? m.voc_index : '—'}
                </td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  {m?.temperature_c !== null && m?.temperature_c !== undefined
                    ? `${m.temperature_c}°C / ${m.humidity_rh}%`
                    : '—'}
                </td>
                <td style={{ padding: '0.75rem 1rem', color: '#64748B' }}>
                  {device.elapsed_seconds_since_telemetry !== null && device.elapsed_seconds_since_telemetry !== undefined
                    ? `${device.elapsed_seconds_since_telemetry}s ago`
                    : 'Awaiting'}
                </td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  {device.problems && device.problems.length > 0 ? (
                    <span style={{ color: '#DC2626', fontWeight: 600 }}>
                      {device.problems[0]}
                    </span>
                  ) : (
                    <span style={{ color: '#059669', fontSize: '0.75rem' }}>All Sensors OK</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
