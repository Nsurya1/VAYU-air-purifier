import React from 'react';
import { Search, Filter, X } from 'lucide-react';

interface DeviceFilterProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  totalFiltered: number;
  totalConfigured: number;
}

export const DeviceFilter: React.FC<DeviceFilterProps> = ({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  totalFiltered,
  totalConfigured
}) => {
  return (
    <div style={{
      backgroundColor: '#FFFFFF',
      borderRadius: '8px',
      border: '1px solid var(--color-border)',
      padding: '0.85rem 1.25rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '1rem',
      marginBottom: '1.25rem'
    }}>
      {/* Search Input */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        backgroundColor: '#F8FAFC',
        border: '1px solid var(--color-border)',
        borderRadius: '6px',
        padding: '0.45rem 0.75rem',
        width: '100%',
        maxWidth: '340px'
      }}>
        <Search size={16} color="#94A3B8" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter by device ID or room..."
          style={{
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: '0.825rem',
            width: '100%',
            color: 'var(--color-navy)'
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
          >
            <X size={14} color="#94A3B8" />
          </button>
        )}
      </div>

      {/* Filter Dropdown & Match Stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={15} color="#64748B" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              backgroundColor: '#FFFFFF',
              fontSize: '0.825rem',
              color: 'var(--color-navy)',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ONLINE">Online Only</option>
            <option value="STALE">Stale Data Only</option>
            <option value="SENSOR_FAULT">Sensor Faults Only</option>
            <option value="OFFLINE">Offline Only</option>
            <option value="WAITING_FOR_DATA">Waiting For Data</option>
          </select>
        </div>

        <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
          Showing <strong>{totalFiltered}</strong> of <strong>{totalConfigured}</strong> devices
        </div>
      </div>
    </div>
  );
};
