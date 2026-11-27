import React, { useEffect, useState, useMemo } from 'react';
import { DeviceFleetResponse, DeviceListItem } from './types/device';
import { fetchFleet, subscribeToFleetStream } from './services/api';
import { Header } from './components/Header';
import { SummaryBar } from './components/SummaryBar';
import { DeviceFilter } from './components/DeviceFilter';
import { DeviceCard } from './components/DeviceCard';
import { DeviceTable } from './components/DeviceTable';
import { DeviceDetailModal } from './components/DeviceDetailModal';
import { KioskDashboard } from './components/KioskDashboard';
import { ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const [fleet, setFleet] = useState<DeviceFleetResponse | null>(null);
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isKiosk, setIsKiosk] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedDevice, setSelectedDevice] = useState<DeviceListItem | null>(null);

  // Initial load & SSE streaming with automatic polling fallback
  useEffect(() => {
    let unsubscribeStream: (() => void) | null = null;
    let pollInterval: any = null;

    const loadInitialData = async () => {
      try {
        setIsRefreshing(true);
        const initial = await fetchFleet();
        setFleet(initial);
        setErrorMessage(null);
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to connect to VAYU backend.');
      } finally {
        setIsRefreshing(false);
      }
    };

    loadInitialData();

    // Start SSE stream
    try {
      unsubscribeStream = subscribeToFleetStream(
        (updatedFleet) => {
          setFleet(updatedFleet);
          setIsLiveStreaming(true);
          setErrorMessage(null);
        },
        () => {
          // Fallback to polling if SSE encounters an error
          setIsLiveStreaming(false);
          if (!pollInterval) {
            pollInterval = setInterval(async () => {
              try {
                const polled = await fetchFleet();
                setFleet(polled);
                setErrorMessage(null);
              } catch (e: any) {
                setErrorMessage('Local backend unreachable. Retrying connection...');
              }
            }, 3000);
          }
        }
      );
    } catch {
      setIsLiveStreaming(false);
    }

    return () => {
      if (unsubscribeStream) unsubscribeStream();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  const handleManualRefresh = async () => {
    try {
      setIsRefreshing(true);
      const data = await fetchFleet();
      setFleet(data);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter & Search Logic
  const filteredDevices = useMemo(() => {
    if (!fleet) return [];
    return fleet.devices.filter((device) => {
      // 1. Search query match
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        device.device_id.toLowerCase().includes(query) ||
        (device.room && device.room.toLowerCase().includes(query));

      if (!matchesSearch) return false;

      // 2. Status filter match
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'ONLINE') return device.connection_state === 'ONLINE' && device.health_state === 'HEALTHY';
      if (statusFilter === 'OFFLINE') return device.connection_state === 'OFFLINE';
      if (statusFilter === 'STALE') return device.health_state === 'STALE';
      if (statusFilter === 'SENSOR_FAULT') return device.health_state === 'SENSOR_FAULT';
      if (statusFilter === 'WAITING_FOR_DATA') return device.health_state === 'WAITING_FOR_DATA';

      return true;
    });
  }, [fleet, searchQuery, statusFilter]);

  // If in Kiosk Mode, render fullscreen high-contrast TV view
  if (isKiosk) {
    return (
      <KioskDashboard
        fleet={fleet}
        onExitKiosk={() => setIsKiosk(false)}
        onSelectDevice={(dev) => setSelectedDevice(dev)}
      />
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Industrial Navigation Header */}
      <Header
        siteName={fleet?.site_name || 'SOCHI Facility'}
        isLiveStreaming={isLiveStreaming}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isKiosk={isKiosk}
        setIsKiosk={setIsKiosk}
        onRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Main Container */}
      <main style={{ flex: 1, padding: '1.75rem', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
        
        {/* Error Banner if connection fails */}
        {errorMessage && (
          <div style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.25rem',
            color: '#991B1B',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <AlertCircle size={20} color="#DC2626" />
            <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
              {errorMessage}
            </div>
          </div>
        )}

        {/* Local Network Data Boundary Banner */}
        <section style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          padding: '0.85rem 1.25rem',
          border: '1px solid var(--color-border)',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              backgroundColor: 'rgba(11, 31, 58, 0.06)',
              padding: '0.5rem',
              borderRadius: '6px',
              color: 'var(--color-navy)'
            }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-navy)' }}>
                Autonomous Local In-Memory Monitoring
              </span>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>
                Data remains on premises. Telemetry stored strictly in volatile memory. No cloud egress.
              </p>
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
            Last fleet sync: <strong>{fleet ? new Date(fleet.timestamp).toLocaleTimeString() : 'Connecting...'}</strong>
          </div>
        </section>

        {/* Summary Metric KPI Bar */}
        <SummaryBar
          summary={fleet?.summary || null}
          activeFilter={statusFilter}
          onSelectFilter={(newFilter) => setStatusFilter(newFilter)}
        />

        {/* Filter & Search Bar */}
        <DeviceFilter
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          totalFiltered={filteredDevices.length}
          totalConfigured={fleet?.summary.total_devices || 0}
        />

        {/* Devices Display (Grid or Table) */}
        {!fleet ? (
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            padding: '3rem',
            textAlign: 'center',
            color: '#64748B'
          }}>
            <RefreshCw size={28} className="spin-icon" style={{ margin: '0 auto 1rem auto', color: 'var(--color-orange)' }} />
            <h3 style={{ fontSize: '1.1rem', color: 'var(--color-navy)', marginBottom: '0.35rem' }}>
              Connecting to Local Monitoring Core...
            </h3>
            <p style={{ fontSize: '0.85rem' }}>
              Subscribing to real-time air quality metrics via local Mosquitto broker.
            </p>
          </div>
        ) : filteredDevices.length === 0 ? (
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            padding: '3rem',
            textAlign: 'center',
            color: '#64748B'
          }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--color-navy)', marginBottom: '0.35rem' }}>
              No Devices Match Filter Criteria
            </h3>
            <p style={{ fontSize: '0.85rem' }}>
              Try adjusting your search query or reset the status filter to "All Statuses".
            </p>
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); }}
              style={{
                marginTop: '1rem',
                backgroundColor: 'var(--color-orange)',
                color: '#FFFFFF',
                border: 'none',
                padding: '0.45rem 1rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem'
          }}>
            {filteredDevices.map((device) => (
              <DeviceCard
                key={device.device_id}
                device={device}
                onSelect={(dev) => setSelectedDevice(dev)}
              />
            ))}
          </div>
        ) : (
          <DeviceTable
            devices={filteredDevices}
            onSelect={(dev) => setSelectedDevice(dev)}
          />
        )}
      </main>

      {/* Device Detail Slide-Over Modal */}
      <DeviceDetailModal
        device={selectedDevice}
        onClose={() => setSelectedDevice(null)}
      />

      {/* Industrial Footer */}
      <footer style={{
        borderTop: '1px solid var(--color-border)',
        padding: '1rem 1.75rem',
        backgroundColor: '#FFFFFF',
        fontSize: '0.75rem',
        color: '#64748B',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div>
          SOCHI VAYU Industrial Air Quality Management Platform &bull; On-Premise Installation
        </div>
        <div>
          Autonomous Embedded Failsafe Active &bull; Zero Cloud Telemetry Archive
        </div>
      </footer>
    </div>
  );
};
