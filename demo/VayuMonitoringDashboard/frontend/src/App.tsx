import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DeviceSummary, SystemHealth } from './types/device';
import { AuthUser } from './types/auth';
import { Incident } from './types/incident';
import { fetchDevices, fetchHealth, fetchIncidents, fetchRemoteSessions, loginApi, getStoredUser } from './services/api';
import { Header } from './components/Header';
import { KpiCards } from './components/KpiCards';
import { DeviceTable } from './components/DeviceTable';
import { TvKioskView } from './components/TvKioskView';
import { DeviceDetailModal } from './components/DeviceDetailModal';
import { AuditLogModal } from './components/AuditLogModal';
import { IncidentCenterModal } from './components/IncidentCenterModal';
import { OtaManagementModal } from './components/OtaManagementModal';
import { RemoteSupportModal } from './components/RemoteSupportModal';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(getStoredUser());
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DeviceSummary | null>(null);
  const [selectedSite, setSelectedSite] = useState<string>('ALL');
  const [isTvMode, setIsTvMode] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [isIncidentsModalOpen, setIsIncidentsModalOpen] = useState<boolean>(false);
  const [isOtaModalOpen, setIsOtaModalOpen] = useState<boolean>(false);
  const [isRemoteModalOpen, setIsRemoteModalOpen] = useState<boolean>(false);
  const [hasActiveRemoteSession, setHasActiveRemoteSession] = useState<boolean>(false);
  const [incidentFilterDeviceId, setIncidentFilterDeviceId] = useState<string | undefined>(undefined);

  // Auto-authenticate default Admin persona if no saved user session exists
  useEffect(() => {
    const initAuth = async () => {
      if (!currentUser) {
        try {
          const user = await loginApi('admin', 'SochiAdmin2026!');
          setCurrentUser(user);
        } catch (e) {
          console.error('Default persona initialization failed:', e);
        }
      }
    };
    initAuth();
  }, [currentUser]);

  const loadFleetData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const siteForIncidents =
        currentUser?.role === 'ROLE_SERVICE_TECH' && currentUser.siteScope !== '*'
          ? currentUser.siteScope
          : selectedSite;

      const [fleet, health, incList, sessions] = await Promise.all([
        fetchDevices(selectedSite),
        fetchHealth(),
        fetchIncidents(siteForIncidents).catch((e) => {
          console.warn('Incident fetch warning:', e);
          return [] as Incident[];
        }),
        fetchRemoteSessions().catch((e) => {
          console.warn('Remote sessions fetch warning:', e);
          return [];
        }),
      ]);

      setDevices(fleet);
      setSystemHealth(health);
      setIncidents(incList);
      setHasActiveRemoteSession(sessions.some((s: any) => s.status === 'APPROVED_ACTIVE'));
      setLastUpdated(new Date());
      setErrorMsg(null);

      // Keep selected device state synchronized with latest telemetry
      if (selectedDevice) {
        const updated = fleet.find((d) => d.deviceId === selectedDevice.deviceId);
        if (updated) setSelectedDevice(updated);
      }
    } catch (err) {
      console.error('Failed to poll fleet:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Connection to VAYU backend failed');
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedDevice, selectedSite, currentUser]);

  // Periodic polling every 3.5s
  useEffect(() => {
    loadFleetData();
    const interval = setInterval(loadFleetData, 3500);
    return () => clearInterval(interval);
  }, [loadFleetData]);

  // Quick Persona Switcher Handler
  const handleSwitchPersona = async (username: string, pass: string) => {
    try {
      const user = await loginApi(username, pass);
      setCurrentUser(user);
      if (user.role === 'ROLE_SERVICE_TECH' && user.siteScope !== '*') {
        setSelectedSite(user.siteScope);
      } else {
        setSelectedSite('ALL');
      }
      setTimeout(loadFleetData, 200);
    } catch (e: any) {
      alert(`Persona switch error: ${e.message}`);
    }
  };

  // Map active incidents by deviceId
  const activeIncidentsMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const inc of incidents) {
      if (inc.status !== 'RESOLVED') {
        map[inc.deviceId] = (map[inc.deviceId] || 0) + 1;
      }
    }
    return map;
  }, [incidents]);

  const activeIncidentCount = useMemo(() => {
    return incidents.filter((i) => i.status !== 'RESOLVED').length;
  }, [incidents]);

  // Filter devices by site in UI
  const filteredDevices = devices.filter((d) => {
    if (selectedSite === 'ALL') return true;
    return d.siteId === selectedSite;
  });

  return (
    <div className={isTvMode ? 'tv-kiosk-mode' : ''} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Application Bar */}
      <Header
        isTvMode={isTvMode}
        onToggleTvMode={() => setIsTvMode(!isTvMode)}
        selectedSite={selectedSite}
        onSelectSite={setSelectedSite}
        systemHealth={systemHealth}
        lastUpdated={lastUpdated}
        onManualRefresh={loadFleetData}
        isRefreshing={isRefreshing}
        currentUser={currentUser}
        onSwitchPersona={handleSwitchPersona}
        onOpenAuditModal={() => setIsAuditModalOpen(true)}
        onOpenIncidentsModal={() => {
          setIncidentFilterDeviceId(undefined);
          setIsIncidentsModalOpen(true);
        }}
        onOpenOtaModal={() => setIsOtaModalOpen(true)}
        onOpenRemoteSupportModal={() => setIsRemoteModalOpen(true)}
        activeIncidentCount={activeIncidentCount}
        hasActiveRemoteSession={hasActiveRemoteSession}
      />

      {/* Main Body Container */}
      <main style={{ flex: 1, padding: isTvMode ? '1.5rem 2rem' : '1.5rem' }}>
        {/* Error Alert Banner */}
        {errorMsg && (
          <div
            style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#991B1B',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>
              <strong>Gateway Connection Issue:</strong> {errorMsg}.
            </span>
            <button
              onClick={loadFleetData}
              style={{
                backgroundColor: '#991B1B',
                color: '#FFFFFF',
                borderRadius: '4px',
                padding: '0.2rem 0.6rem',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* High-Level Fleet KPIs */}
        <KpiCards devices={filteredDevices} isTvMode={isTvMode} />

        {/* Main Content Area: TV Kiosk vs Desktop Table */}
        {isTvMode ? (
          <TvKioskView devices={filteredDevices} onSelectDevice={setSelectedDevice} />
        ) : (
          <DeviceTable
            devices={filteredDevices}
            onSelectDevice={setSelectedDevice}
            activeIncidentsMap={activeIncidentsMap}
            onOpenIncidentForDevice={(devId) => {
              setIncidentFilterDeviceId(devId);
              setIsIncidentsModalOpen(true);
            }}
          />
        )}
      </main>

      {/* Detail / Control Drawer */}
      {selectedDevice && (
        <DeviceDetailModal
          device={selectedDevice}
          currentUser={currentUser}
          onClose={() => setSelectedDevice(null)}
          onRefreshParent={loadFleetData}
          onOpenIncidentCenter={(devId) => {
            setIncidentFilterDeviceId(devId);
            setIsIncidentsModalOpen(true);
          }}
        />
      )}

      {/* Audit Log Modal */}
      <AuditLogModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
      />

      {/* Fleet Incident & Diagnostics Center Modal */}
      <IncidentCenterModal
        isOpen={isIncidentsModalOpen}
        onClose={() => setIsIncidentsModalOpen(false)}
        currentUser={currentUser}
        initialDeviceId={incidentFilterDeviceId}
      />

      {/* Safe OTA & Firmware Orchestration Modal */}
      <OtaManagementModal
        isOpen={isOtaModalOpen}
        onClose={() => setIsOtaModalOpen(false)}
        currentUser={currentUser}
      />

      {/* Ephemeral Remote Troubleshooting & Consent Modal */}
      <RemoteSupportModal
        isOpen={isRemoteModalOpen}
        onClose={() => {
          setIsRemoteModalOpen(false);
          loadFleetData();
        }}
        currentUser={currentUser}
      />

      {/* Footer */}
      <footer
        style={{
          borderTop: isTvMode ? '1px solid #1E3A63' : '1px solid #E2E8F0',
          padding: '0.85rem 1.5rem',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: isTvMode ? '#94A3B8' : '#64748B',
          backgroundColor: isTvMode ? '#071324' : '#FFFFFF',
        }}
      >
        <span>
          SOCHI VAYU &copy; 2026 SOCHI Consulting. Local-First Industrial Air Quality Monitoring &amp; Control.
        </span>
      </footer>
    </div>
  );
};
