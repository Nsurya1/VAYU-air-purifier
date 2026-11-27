import React, { useState } from 'react';
import { DeviceSummary } from '../types/device';
import { IconSearch, IconSliders, IconWifi, IconWifiOff, IconAlertTriangle } from './Icons';

interface DeviceTableProps {
  devices: DeviceSummary[];
  onSelectDevice: (device: DeviceSummary) => void;
  activeIncidentsMap?: Record<string, number>;
  onOpenIncidentForDevice?: (deviceId: string) => void;
}

export const DeviceTable: React.FC<DeviceTableProps> = ({
  devices,
  onSelectDevice,
  activeIncidentsMap,
  onOpenIncidentForDevice,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filtered = devices.filter((d) => {
    const matchesSearch =
      d.deviceId.toLowerCase().includes(search.toLowerCase()) ||
      d.model.toLowerCase().includes(search.toLowerCase()) ||
      d.siteId.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'ONLINE') return d.onlineStatus === 'ONLINE';
    if (statusFilter === 'OFFLINE') return d.onlineStatus === 'OFFLINE' || d.healthBadge === 'OFFLINE';
    if (statusFilter === 'CRITICAL') return d.healthBadge === 'CRITICAL';
    if (statusFilter === 'WARNING') return d.healthBadge === 'WARNING';
    return true;
  });

  const getAqiColor = (aqi: number | null) => {
    if (aqi === null) return '#64748B';
    if (aqi <= 50) return '#059669'; // Good
    if (aqi <= 100) return '#D97706'; // Moderate
    if (aqi <= 150) return '#EA580C'; // Unhealthy Sensitive
    if (aqi <= 200) return '#DC2626'; // Unhealthy
    return '#7C2D12'; // Very Unhealthy / Hazardous
  };

  return (
    <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
      {/* Table Toolbar */}
      <div
        style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: '#FAFAFA',
        }}
      >
        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `All (${devices.length})` },
            { id: 'ONLINE', label: `Online (${devices.filter((d) => d.onlineStatus === 'ONLINE').length})` },
            { id: 'CRITICAL', label: `Critical (${devices.filter((d) => d.healthBadge === 'CRITICAL').length})` },
            { id: 'WARNING', label: `Warning (${devices.filter((d) => d.healthBadge === 'WARNING').length})` },
            { id: 'OFFLINE', label: `Offline (${devices.filter((d) => d.onlineStatus === 'OFFLINE' || d.healthBadge === 'OFFLINE').length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                backgroundColor: statusFilter === tab.id ? '#0B1F3A' : '#FFFFFF',
                color: statusFilter === tab.id ? '#FFFFFF' : '#475569',
                border: statusFilter === tab.id ? '1px solid #0B1F3A' : '1px solid #CBD5E1',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', minWidth: '240px' }}>
          <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>
            <IconSearch size={15} />
          </div>
          <input
            type="text"
            placeholder="Search device ID, site, model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.75rem 0.45rem 2.1rem',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '0.85rem',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* Responsive Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={{ padding: '0.75rem 1rem' }}>Device ID</th>
              <th style={{ padding: '0.75rem 1rem' }}>Site</th>
              <th style={{ padding: '0.75rem 1rem' }}>Health &amp; Status</th>
              <th style={{ padding: '0.75rem 1rem' }}>PM2.5 (µg/m³)</th>
              <th style={{ padding: '0.75rem 1rem' }}>AQI (EPA)</th>
              <th style={{ padding: '0.75rem 1rem' }}>Fan %</th>
              <th style={{ padding: '0.75rem 1rem' }}>Mode</th>
              <th style={{ padding: '0.75rem 1rem' }}>Filter Life</th>
              <th style={{ padding: '0.75rem 1rem' }}>RSSI</th>
              <th style={{ padding: '0.75rem 1rem' }}>Last Seen</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748B' }}>
                  No devices match your selected filter criteria.
                </td>
              </tr>
            ) : (
              filtered.map((d) => (
                <tr
                  key={d.deviceId}
                  style={{
                    borderBottom: '1px solid #F1F5F9',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  onClick={() => onSelectDevice(d)}
                >
                  {/* Device ID */}
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#0B1F3A' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span>{d.deviceId}</span>
                      {d.simulated && <span className="badge badge-simulated" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>SIM</span>}
                      {activeIncidentsMap && activeIncidentsMap[d.deviceId] > 0 && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenIncidentForDevice) onOpenIncidentForDevice(d.deviceId);
                          }}
                          style={{
                            backgroundColor: '#FEE2E2',
                            color: '#B91C1C',
                            border: '1px solid #FCA5A5',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: '0.1rem 0.35rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                          }}
                          title="Active incident ticket open. Click to inspect triage."
                        >
                          <IconAlertTriangle size={10} color="#B91C1C" />
                          <span>FAULT</span>
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Site */}
                  <td style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: 500 }}>
                    {d.siteId === 'SITE-HQ-PUNE' ? 'Pune HQ' : 'Bangalore R&D'}
                  </td>

                  {/* Status Badge */}
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span className={`badge badge-${d.healthBadge.toLowerCase()}`}>
                      {d.healthBadge}
                    </span>
                  </td>

                  {/* PM2.5 */}
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {d.pm25 !== null ? (
                      <span style={{ color: d.pm25 > 55 ? '#DC2626' : d.pm25 > 35 ? '#D97706' : '#059669' }}>
                        {d.pm25.toFixed(1)}
                      </span>
                    ) : (
                      <span style={{ color: '#EF4444', fontStyle: 'italic', fontSize: '0.75rem' }}>FAULT (NULL)</span>
                    )}
                  </td>

                  {/* AQI */}
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {d.aqi !== null ? (
                      <span
                        style={{
                          backgroundColor: `${getAqiColor(d.aqi)}15`,
                          color: getAqiColor(d.aqi),
                          border: `1px solid ${getAqiColor(d.aqi)}40`,
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          fontWeight: 800,
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {d.aqi}
                      </span>
                    ) : (
                      <span style={{ color: '#94A3B8' }}>--</span>
                    )}
                  </td>

                  {/* Fan Speed */}
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {d.fanPct !== null ? `${d.fanPct}%` : '--'}
                  </td>

                  {/* Mode */}
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: d.mode === 'ERROR_SAFE' ? '#DC2626' : d.mode === 'TURBO' ? '#F47721' : '#334155',
                      }}
                    >
                      {d.mode || '--'}
                    </span>
                  </td>

                  {/* Filter Hours */}
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)', color: '#475569' }}>
                    {d.filterHoursLeft !== null ? `${d.filterHoursLeft}h` : '--'}
                  </td>

                  {/* RSSI */}
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)' }}>
                    {d.rssi !== null ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: d.rssi < -85 ? '#EF4444' : '#64748B' }}>
                        {d.rssi < -85 ? <IconWifiOff size={13} color="#EF4444" /> : <IconWifi size={13} color="#10B981" />}
                        <span>{d.rssi} dBm</span>
                      </div>
                    ) : (
                      <span style={{ color: '#94A3B8' }}>--</span>
                    )}
                  </td>

                  {/* Last Seen */}
                  <td style={{ padding: '0.75rem 1rem', color: '#64748B', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                    {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleTimeString() : 'Never'}
                  </td>

                  {/* Action */}
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDevice(d);
                      }}
                      className="btn-secondary"
                      style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                    >
                      <IconSliders size={13} />
                      <span>Inspect</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
