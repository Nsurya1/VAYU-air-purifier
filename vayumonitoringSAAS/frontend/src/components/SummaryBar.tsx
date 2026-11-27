import React from 'react';
import { DeviceSummary } from '../types/device';
import { Cpu, CheckCircle2, AlertTriangle, AlertOctagon, PowerOff } from 'lucide-react';

interface SummaryBarProps {
  summary: DeviceSummary | null;
  activeFilter: string;
  onSelectFilter: (filter: string) => void;
}

export const SummaryBar: React.FC<SummaryBarProps> = ({ summary, activeFilter, onSelectFilter }) => {
  if (!summary) return null;

  const kpis = [
    {
      id: 'ALL',
      label: 'TOTAL CONFIGURED',
      count: summary.total_devices,
      icon: Cpu,
      color: 'var(--color-navy)',
      bgColor: '#F1F5F9',
      borderColor: '#CBD5E1'
    },
    {
      id: 'ONLINE',
      label: 'ONLINE / ACTIVE',
      count: summary.online_devices,
      icon: CheckCircle2,
      color: '#059669',
      bgColor: '#ECFDF5',
      borderColor: '#A7F3D0'
    },
    {
      id: 'STALE',
      label: 'STALE TELEMETRY',
      count: summary.stale_devices,
      icon: AlertTriangle,
      color: '#D97706',
      bgColor: '#FFFBEB',
      borderColor: '#FDE68A'
    },
    {
      id: 'SENSOR_FAULT',
      label: 'SENSOR FAULTS',
      count: summary.fault_devices,
      icon: AlertOctagon,
      color: '#DC2626',
      bgColor: '#FEF2F2',
      borderColor: '#FECACA'
    },
    {
      id: 'OFFLINE',
      label: 'OFFLINE / DISCONNECTED',
      count: summary.offline_devices,
      icon: PowerOff,
      color: '#475569',
      bgColor: '#F8FAFC',
      borderColor: '#E2E8F0'
    }
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '1rem',
      marginBottom: '1.5rem'
    }}>
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        const isSelected = activeFilter === kpi.id;
        return (
          <div
            key={kpi.id}
            onClick={() => onSelectFilter(kpi.id)}
            style={{
              backgroundColor: '#FFFFFF',
              border: `2px solid ${isSelected ? 'var(--color-orange)' : kpi.borderColor}`,
              borderRadius: '8px',
              padding: '1rem 1.15rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: isSelected ? '0 4px 12px rgba(244,119,33,0.18)' : '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            <div>
              <div style={{
                fontSize: '0.725rem',
                fontWeight: 700,
                color: '#64748B',
                letterSpacing: '0.4px',
                marginBottom: '0.25rem'
              }}>
                {kpi.label}
              </div>
              <div style={{
                fontSize: '1.75rem',
                fontWeight: 800,
                color: kpi.color,
                lineHeight: 1
              }}>
                {kpi.count}
              </div>
            </div>
            <div style={{
              backgroundColor: kpi.bgColor,
              color: kpi.color,
              padding: '0.65rem',
              borderRadius: '8px'
            }}>
              <Icon size={22} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
