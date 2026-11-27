import React from 'react';
import { Radio, Tv, LayoutGrid, List, RefreshCw } from 'lucide-react';

interface HeaderProps {
  siteName: string;
  isLiveStreaming: boolean;
  viewMode: 'grid' | 'table';
  setViewMode: (mode: 'grid' | 'table') => void;
  isKiosk: boolean;
  setIsKiosk: (kiosk: boolean) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  siteName,
  isLiveStreaming,
  viewMode,
  setViewMode,
  isKiosk,
  setIsKiosk,
  onRefresh,
  isRefreshing
}) => {
  return (
    <header style={{
      backgroundColor: 'var(--color-navy)',
      color: '#FFFFFF',
      padding: '0.75rem 1.75rem',
      borderBottom: '3px solid var(--color-orange)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      {/* Brand & Platform Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <div style={{
          background: 'var(--color-orange)',
          borderRadius: '5px',
          padding: '4px 10px',
          fontWeight: 800,
          letterSpacing: '0.5px',
          fontSize: '0.95rem',
          color: '#FFFFFF'
        }}>
          SOCHI
        </div>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, letterSpacing: '0.2px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            VAYU <span style={{ fontWeight: 400, opacity: 0.8, fontSize: '0.85rem' }}>| Real-Time Purifier Diagnostics</span>
          </h1>
          <p style={{ fontSize: '0.725rem', color: '#CBD5E1', margin: 0 }}>
            On-Premise Industrial Air Quality &bull; Isolated LAN
          </p>
        </div>
      </div>

      {/* Control Actions & Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
        {/* Site Identifier */}
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.08)',
          padding: '0.35rem 0.75rem',
          borderRadius: '6px',
          fontSize: '0.8rem',
          border: '1px solid rgba(255,255,255,0.15)'
        }}>
          <span style={{ color: '#94A3B8' }}>Facility: </span>
          <strong style={{ color: '#FFFFFF' }}>{siteName || 'Connecting...'}</strong>
        </div>

        {/* Live SSE / Polling Stream Status Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          backgroundColor: isLiveStreaming ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
          color: isLiveStreaming ? '#34D399' : '#FBBF24',
          padding: '0.35rem 0.75rem',
          borderRadius: '6px',
          fontSize: '0.775rem',
          fontWeight: 600,
          border: `1px solid ${isLiveStreaming ? 'rgba(52, 211, 153, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
        }}>
          <Radio size={14} className={isLiveStreaming ? 'pulse-icon' : ''} />
          <span>{isLiveStreaming ? 'LIVE SSE' : 'REST POLLING'}</span>
        </div>

        {/* Manual Refresh Button */}
        <button
          onClick={onRefresh}
          title="Force telemetry refresh"
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#FFFFFF',
            borderRadius: '6px',
            padding: '0.4rem 0.6rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <RefreshCw size={15} className={isRefreshing ? 'spin-icon' : ''} />
        </button>

        {/* Grid / Table Toggle */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '6px',
          padding: '2px',
          border: '1px solid rgba(255,255,255,0.15)'
        }}>
          <button
            onClick={() => setViewMode('grid')}
            title="Grid Card View"
            style={{
              background: viewMode === 'grid' ? 'var(--color-orange)' : 'transparent',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '4px',
              padding: '0.3rem 0.5rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => setViewMode('table')}
            title="Dense Table View"
            style={{
              background: viewMode === 'table' ? 'var(--color-orange)' : 'transparent',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '4px',
              padding: '0.3rem 0.5rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <List size={15} />
          </button>
        </div>

        {/* TV / Kiosk Mode Toggle */}
        <button
          onClick={() => setIsKiosk(!isKiosk)}
          style={{
            backgroundColor: isKiosk ? 'var(--color-orange)' : 'rgba(255,255,255,0.1)',
            color: '#FFFFFF',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '0.35rem 0.75rem',
            borderRadius: '6px',
            fontSize: '0.775rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <Tv size={14} />
          <span>{isKiosk ? 'Exit Kiosk' : 'TV Kiosk'}</span>
        </button>
      </div>
    </header>
  );
};
