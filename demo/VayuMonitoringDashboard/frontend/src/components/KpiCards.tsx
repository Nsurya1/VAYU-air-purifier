import React from 'react';
import { DeviceSummary } from '../types/device';
import { IconCheckCircle, IconAlertTriangle, IconWifiOff, IconWind } from './Icons';

interface KpiCardsProps {
  devices: DeviceSummary[];
  isTvMode?: boolean;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ devices, isTvMode = false }) => {
  const total = devices.length;
  const online = devices.filter((d) => d.onlineStatus === 'ONLINE').length;
  const critical = devices.filter((d) => d.healthBadge === 'CRITICAL').length;
  const warning = devices.filter((d) => d.healthBadge === 'WARNING').length;
  const offline = devices.filter((d) => d.healthBadge === 'OFFLINE' || d.onlineStatus === 'OFFLINE').length;

  const validAqis = devices.map((d) => d.aqi).filter((a): a is number => a !== null && a !== undefined);
  const avgAqi = validAqis.length > 0 ? Math.round(validAqis.reduce((sum, v) => sum + v, 0) / validAqis.length) : 0;

  const cards = [
    {
      title: 'ONLINE PURIFIERS',
      count: online,
      total: total,
      subtext: `${total > 0 ? Math.round((online / total) * 100) : 0}% fleet active`,
      color: '#10B981',
      bg: isTvMode ? '#07271E' : '#ECFDF5',
      border: '#059669',
      icon: <IconCheckCircle size={isTvMode ? 28 : 22} color="#10B981" />,
    },
    {
      title: 'CRITICAL HARDWARE ALARMS',
      count: critical,
      subtext: critical > 0 ? 'Fan motor stall / safety lock' : 'All motors healthy',
      color: '#EF4444',
      bg: isTvMode ? '#341212' : '#FEF2F2',
      border: '#DC2626',
      icon: <IconAlertTriangle size={isTvMode ? 28 : 22} color="#EF4444" />,
    },
    {
      title: 'WARNING / DEGRADED',
      count: warning,
      subtext: warning > 0 ? 'Sensor faults / pollution surges' : 'Zero sensor faults',
      color: '#F59E0B',
      bg: isTvMode ? '#312108' : '#FFFBEB',
      border: '#D97706',
      icon: <IconAlertTriangle size={isTvMode ? 28 : 22} color="#F59E0B" />,
    },
    {
      title: 'OFFLINE / UNREACHABLE',
      count: offline,
      subtext: offline > 0 ? 'Wi-Fi / LWT disconnects' : 'All devices connected',
      color: '#64748B',
      bg: isTvMode ? '#182433' : '#F1F5F9',
      border: '#475569',
      icon: <IconWifiOff size={isTvMode ? 28 : 22} color="#64748B" />,
    },
    {
      title: 'AVG FLEET AQI (EPA)',
      count: avgAqi,
      subtext: avgAqi <= 50 ? 'Good Clean Air' : avgAqi <= 100 ? 'Moderate' : 'Unhealthy / Spiking',
      color: avgAqi <= 50 ? '#10B981' : avgAqi <= 100 ? '#F59E0B' : '#EF4444',
      bg: isTvMode ? '#0F223D' : '#FFFFFF',
      border: '#0B1F3A',
      icon: <IconWind size={isTvMode ? 28 : 22} color="#F47721" />,
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isTvMode ? 'repeat(5, 1fr)' : 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: isTvMode ? '1.25rem' : '1rem',
        marginBottom: '1.5rem',
      }}
    >
      {cards.map((c, i) => (
        <div
          key={i}
          className="card"
          style={{
            backgroundColor: c.bg,
            borderLeft: `5px solid ${c.border}`,
            borderTop: '1px solid var(--border-color)',
            borderRight: '1px solid var(--border-color)',
            borderBottom: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: isTvMode ? '1.25rem' : '1rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontSize: isTvMode ? '0.85rem' : '0.72rem',
                fontWeight: 700,
                color: isTvMode ? '#94A3B8' : '#475569',
                letterSpacing: '0.05em',
              }}
            >
              {c.title}
            </span>
            {c.icon}
          </div>
          <div style={{ margin: '0.5rem 0' }}>
            <span
              style={{
                fontSize: isTvMode ? '2.5rem' : '1.85rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: c.color,
                lineHeight: 1,
              }}
            >
              {c.count}
            </span>
            {c.total !== undefined && (
              <span
                style={{
                  fontSize: isTvMode ? '1.2rem' : '0.95rem',
                  color: isTvMode ? '#94A3B8' : '#64748B',
                  fontWeight: 600,
                  marginLeft: '0.35rem',
                }}
              >
                / {c.total}
              </span>
            )}
          </div>
          <p
            style={{
              fontSize: isTvMode ? '0.9rem' : '0.75rem',
              color: isTvMode ? '#CBD5E1' : '#64748B',
              margin: 0,
            }}
          >
            {c.subtext}
          </p>
        </div>
      ))}
    </div>
  );
};
