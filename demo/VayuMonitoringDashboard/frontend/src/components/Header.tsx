import React from 'react';
import { IconWind, IconTv, IconMonitor, IconRefresh, IconActivity, IconShield, IconUser, IconAlertTriangle, IconUploadCloud, IconLifeBuoy } from './Icons';
import { SystemHealth } from '../types/device';
import { AuthUser } from '../types/auth';

interface HeaderProps {
  isTvMode: boolean;
  onToggleTvMode: () => void;
  selectedSite: string;
  onSelectSite: (site: string) => void;
  systemHealth: SystemHealth | null;
  lastUpdated: Date;
  onManualRefresh: () => void;
  isRefreshing: boolean;
  currentUser: AuthUser | null;
  onSwitchPersona: (username: string, pass: string) => void;
  onOpenAuditModal: () => void;
  onOpenIncidentsModal: () => void;
  onOpenOtaModal?: () => void;
  onOpenRemoteSupportModal?: () => void;
  activeIncidentCount?: number;
  hasActiveRemoteSession?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  isTvMode,
  onToggleTvMode,
  selectedSite,
  onSelectSite,
  systemHealth,
  lastUpdated,
  onManualRefresh,
  isRefreshing,
  currentUser,
  onSwitchPersona,
  onOpenAuditModal,
  onOpenIncidentsModal,
  onOpenOtaModal,
  onOpenRemoteSupportModal,
  activeIncidentCount = 0,
  hasActiveRemoteSession = false,
}) => {
  const isPuneTech = currentUser?.role === 'ROLE_SERVICE_TECH';
  const canViewAudit = currentUser?.role === 'ROLE_ADMIN' || currentUser?.role === 'ROLE_DEV_ENGINEER';
  const canAccessRemote = currentUser?.role === 'ROLE_ADMIN' || currentUser?.role === 'ROLE_DEV_ENGINEER' || currentUser?.role === 'ROLE_SERVICE_TECH';

  return (
    <header
      style={{
        backgroundColor: '#0B1F3A',
        color: '#FFFFFF',
        borderBottom: '2px solid #162C4E',
        padding: isTvMode ? '1.25rem 2rem' : '0.85rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
      }}
    >
      {/* Brand Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
        <div
          style={{
            backgroundColor: '#F47721',
            borderRadius: '8px',
            padding: '0.45rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(244, 119, 33, 0.4)',
          }}
        >
          <IconWind size={isTvMode ? 32 : 24} color="#FFFFFF" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: isTvMode ? '1.6rem' : '1.2rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: '#FFFFFF',
              }}
            >
              SOCHI VAYU
            </span>
            <span
              style={{
                backgroundColor: 'rgba(244, 119, 33, 0.2)',
                color: '#F47721',
                border: '1px solid rgba(244, 119, 33, 0.4)',
                borderRadius: '4px',
                fontSize: isTvMode ? '0.85rem' : '0.7rem',
                fontWeight: 700,
                padding: '0.15rem 0.45rem',
              }}
            >
              LOCAL-FIRST
            </span>

            {/* Role & Site Scope Badge */}
            {currentUser && (
              <span
                style={{
                  backgroundColor:
                    currentUser.role === 'ROLE_ADMIN'
                      ? 'rgba(168, 85, 247, 0.2)'
                      : currentUser.role === 'ROLE_SERVICE_TECH'
                      ? 'rgba(14, 165, 233, 0.2)'
                      : currentUser.role === 'ROLE_DEV_ENGINEER'
                      ? 'rgba(249, 115, 22, 0.2)'
                      : 'rgba(148, 163, 184, 0.2)',
                  color:
                    currentUser.role === 'ROLE_ADMIN'
                      ? '#D8B4FE'
                      : currentUser.role === 'ROLE_SERVICE_TECH'
                      ? '#7DD3FC'
                      : currentUser.role === 'ROLE_DEV_ENGINEER'
                      ? '#FDBA74'
                      : '#CBD5E1',
                  border: `1px solid ${
                    currentUser.role === 'ROLE_ADMIN'
                      ? 'rgba(168, 85, 247, 0.4)'
                      : currentUser.role === 'ROLE_SERVICE_TECH'
                      ? 'rgba(14, 165, 233, 0.4)'
                      : currentUser.role === 'ROLE_DEV_ENGINEER'
                      ? 'rgba(249, 115, 22, 0.4)'
                      : 'rgba(148, 163, 184, 0.4)'
                  }`,
                  borderRadius: '4px',
                  fontSize: isTvMode ? '0.85rem' : '0.7rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.45rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <IconUser size={12} />
                <span>
                  {currentUser.role.replace('ROLE_', '')} ({currentUser.siteScope === '*' ? 'Fleet-Wide' : currentUser.siteScope})
                </span>
              </span>
            )}
          </div>
          <p
            style={{
              fontSize: isTvMode ? '0.95rem' : '0.75rem',
              color: '#94A3B8',
              margin: 0,
            }}
          >
            Air Purifier Fleet Telemetry, Diagnostics &amp; Health Triage
          </p>
        </div>
      </div>

      {/* Controls, Quick Persona Switcher & Mode Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        {/* Quick Persona Switcher */}
        {!isTvMode && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              backgroundColor: '#162C4E',
              padding: '0.25rem 0.45rem',
              borderRadius: '6px',
              border: '1px solid #2A4365',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: '#94A3B8', marginRight: '0.2rem' }}>Persona:</span>
            <button
              onClick={() => onSwitchPersona('admin', 'SochiAdmin2026!')}
              style={{
                fontSize: '0.7rem',
                fontWeight: currentUser?.username === 'admin' ? 800 : 500,
                color: currentUser?.username === 'admin' ? '#FFFFFF' : '#94A3B8',
                backgroundColor: currentUser?.username === 'admin' ? '#A855F7' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                padding: '0.2rem 0.45rem',
                cursor: 'pointer',
              }}
              title="Full fleet-wide administration and audit access"
            >
              Admin
            </button>
            <button
              onClick={() => onSwitchPersona('tech_pune', 'TechPune2026!')}
              style={{
                fontSize: '0.7rem',
                fontWeight: currentUser?.username === 'tech_pune' ? 800 : 500,
                color: currentUser?.username === 'tech_pune' ? '#FFFFFF' : '#94A3B8',
                backgroundColor: currentUser?.username === 'tech_pune' ? '#0284C7' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                padding: '0.2rem 0.45rem',
                cursor: 'pointer',
              }}
              title="Restricted to Pune site devices; commands to Bengaluru are blocked"
            >
              Pune Tech
            </button>
            <button
              onClick={() => onSwitchPersona('dev_eng', 'DevEng2026!')}
              style={{
                fontSize: '0.7rem',
                fontWeight: currentUser?.username === 'dev_eng' ? 800 : 500,
                color: currentUser?.username === 'dev_eng' ? '#FFFFFF' : '#94A3B8',
                backgroundColor: currentUser?.username === 'dev_eng' ? '#EA580C' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                padding: '0.2rem 0.45rem',
                cursor: 'pointer',
              }}
              title="R&D Engineer: Full diagnostics and audit logging"
            >
              Dev Eng
            </button>
            <button
              onClick={() => onSwitchPersona('kiosk', 'KioskView2026!')}
              style={{
                fontSize: '0.7rem',
                fontWeight: currentUser?.username === 'kiosk' ? 800 : 500,
                color: currentUser?.username === 'kiosk' ? '#FFFFFF' : '#94A3B8',
                backgroundColor: currentUser?.username === 'kiosk' ? '#64748B' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                padding: '0.2rem 0.45rem',
                cursor: 'pointer',
              }}
              title="Wall display read-only view; actuator commands are forbidden"
            >
              Kiosk
            </button>
          </div>
        )}

        {/* Incidents & Diagnostics Center Button */}
        {!isTvMode && (
          <button
            onClick={onOpenIncidentsModal}
            style={{
              backgroundColor: activeIncidentCount > 0 ? 'rgba(239, 68, 68, 0.15)' : '#162C4E',
              color: activeIncidentCount > 0 ? '#FCA5A5' : '#FFFFFF',
              border: activeIncidentCount > 0 ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid #2A4365',
              borderRadius: '6px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
            title="Open Fleet Incident & Diagnostics Center"
          >
            <IconAlertTriangle size={15} color={activeIncidentCount > 0 ? '#EF4444' : '#F47721'} />
            <span>Incidents</span>
            {activeIncidentCount > 0 && (
              <span
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  borderRadius: '10px',
                  padding: '0.1rem 0.4rem',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                }}
              >
                {activeIncidentCount}
              </span>
            )}
          </button>
        )}

        {/* Audit Trail Button (Admin & Dev Eng only) */}
        {!isTvMode && canViewAudit && (
          <button
            onClick={onOpenAuditModal}
            style={{
              backgroundColor: '#162C4E',
              color: '#F47721',
              border: '1px solid rgba(244, 119, 33, 0.4)',
              borderRadius: '6px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
            title="Inspect cryptographic action audit logs"
          >
            <IconShield size={14} color="#F47721" />
            <span>Audit Trail</span>
          </button>
        )}

        {/* Safe OTA Orchestrator Button (Admin & Dev Eng only) */}
        {!isTvMode && canViewAudit && onOpenOtaModal && (
          <button
            onClick={onOpenOtaModal}
            style={{
              backgroundColor: '#162C4E',
              color: '#F47721',
              border: '1px solid rgba(244, 119, 33, 0.4)',
              borderRadius: '6px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
            title="Safe OTA Canary Rollout & Firmware Center"
          >
            <IconUploadCloud size={14} color="#F47721" />
            <span>Firmware / OTA</span>
          </button>
        )}

        {/* Remote Support & Ephemeral Access Button */}
        {!isTvMode && canAccessRemote && onOpenRemoteSupportModal && (
          <button
            onClick={onOpenRemoteSupportModal}
            style={{
              backgroundColor: hasActiveRemoteSession ? 'rgba(245, 158, 11, 0.2)' : '#162C4E',
              color: hasActiveRemoteSession ? '#FDE68A' : '#F47721',
              border: hasActiveRemoteSession ? '1px solid #F59E0B' : '1px solid rgba(244, 119, 33, 0.4)',
              borderRadius: '6px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
            title="Manage ephemeral remote troubleshooting sessions & customer consent"
          >
            <IconLifeBuoy size={14} color={hasActiveRemoteSession ? '#F59E0B' : '#F47721'} />
            <span>Remote Support</span>
            {hasActiveRemoteSession && (
              <span
                style={{
                  backgroundColor: '#10B981',
                  color: '#FFFFFF',
                  borderRadius: '10px',
                  padding: '0.1rem 0.4rem',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                }}
              >
                LIVE
              </span>
            )}
          </button>
        )}

        {/* Site Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <label htmlFor="site-filter" style={{ fontSize: isTvMode ? '1rem' : '0.8rem', color: '#94A3B8' }}>
            Site:
          </label>
          <select
            id="site-filter"
            value={selectedSite}
            onChange={(e) => onSelectSite(e.target.value)}
            disabled={isPuneTech}
            style={{
              backgroundColor: '#162C4E',
              color: '#FFFFFF',
              border: isPuneTech ? '1px dashed #0284C7' : '1px solid #2A4365',
              borderRadius: '6px',
              padding: isTvMode ? '0.6rem 1rem' : '0.35rem 0.75rem',
              fontSize: isTvMode ? '1rem' : '0.85rem',
              fontWeight: 600,
              cursor: isPuneTech ? 'not-allowed' : 'pointer',
              opacity: isPuneTech ? 0.9 : 1,
            }}
            title={isPuneTech ? 'Locked: Service technician scope is restricted to Pune site' : 'Select site'}
          >
            {!isPuneTech && <option value="ALL">All Deployment Sites</option>}
            <option value="SITE-HQ-PUNE">HQ Pune Cleanroom {isPuneTech ? '(Scoped)' : ''}</option>
            {!isPuneTech && <option value="SITE-BLR-DEV">Bangalore R&amp;D Wing B</option>}
          </select>
        </div>

        {/* Backend Heartbeat */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            backgroundColor: '#162C4E',
            padding: isTvMode ? '0.6rem 0.9rem' : '0.35rem 0.7rem',
            borderRadius: '6px',
            fontSize: isTvMode ? '0.95rem' : '0.75rem',
            fontFamily: 'var(--font-mono)',
            color: systemHealth?.status === 'UP' ? '#10B981' : '#EF4444',
          }}
          title={`Backend status: ${systemHealth?.status || 'Connecting...'} | Database: ${systemHealth?.database || 'Unknown'}`}
        >
          <IconActivity size={14} color={systemHealth?.status === 'UP' ? '#10B981' : '#EF4444'} />
          <span>{systemHealth?.status === 'UP' ? 'ONLINE' : 'CONNECTING'}</span>
        </div>

        {/* Manual Refresh Button */}
        <button
          onClick={onManualRefresh}
          className="btn-secondary"
          style={{
            backgroundColor: '#162C4E',
            color: '#FFFFFF',
            borderColor: '#2A4365',
            padding: isTvMode ? '0.6rem 0.9rem' : '0.35rem 0.65rem',
          }}
          title={`Last poll: ${lastUpdated.toLocaleTimeString()}`}
        >
          <IconRefresh size={isTvMode ? 18 : 14} className={isRefreshing ? 'animate-spin' : ''} />
          <span style={{ fontSize: isTvMode ? '0.95rem' : '0.8rem' }}>Poll</span>
        </button>

        {/* View Switcher: Desktop Triage vs TV Kiosk */}
        <button
          onClick={onToggleTvMode}
          style={{
            backgroundColor: isTvMode ? '#F47721' : '#162C4E',
            color: '#FFFFFF',
            border: isTvMode ? '1px solid #F47721' : '1px solid #2A4365',
            padding: isTvMode ? '0.6rem 1.1rem' : '0.45rem 0.85rem',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 700,
            fontSize: isTvMode ? '1rem' : '0.85rem',
          }}
        >
          {isTvMode ? (
            <>
              <IconMonitor size={18} />
              <span>Desktop View</span>
            </>
          ) : (
            <>
              <IconTv size={18} color="#F47721" />
              <span>TV Kiosk Mode</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
