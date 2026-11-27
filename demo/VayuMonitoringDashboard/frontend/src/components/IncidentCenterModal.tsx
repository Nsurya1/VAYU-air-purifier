import React, { useState, useEffect, useMemo } from 'react';
import { Incident, IncidentEvidenceData } from '../types/incident';
import { AuthUser } from '../types/auth';
import {
  fetchIncidents,
  acknowledgeIncidentApi,
  assignIncidentApi,
  resolveIncidentApi,
} from '../services/api';
import {
  IconClose,
  IconAlertTriangle,
  IconCheckCircle,
  IconRefresh,
  IconSearch,
  IconCpu,
  IconWrench,
  IconLock,
} from './Icons';

interface IncidentCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  initialDeviceId?: string;
}

export const IncidentCenterModal: React.FC<IncidentCenterModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  initialDeviceId,
}) => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>(initialDeviceId || '');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL'); // ALL | HARDWARE | FIRMWARE
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE'); // ACTIVE | ALL | RESOLVED
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [assigneeInput, setAssigneeInput] = useState<string>(currentUser?.username || 'tech_pune');

  const loadIncidents = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const siteScope = currentUser?.role === 'ROLE_SERVICE_TECH' && currentUser.siteScope !== '*'
        ? currentUser.siteScope
        : undefined;
      const data = await fetchIncidents(siteScope);
      setIncidents(data);

      if (data.length > 0) {
        if (selectedIncidentId) {
          const stillExists = data.some((i) => i.id === selectedIncidentId);
          if (!stillExists) setSelectedIncidentId(data[0].id);
        } else if (initialDeviceId) {
          const match = data.find((i) => i.deviceId === initialDeviceId);
          setSelectedIncidentId(match ? match.id : data[0].id);
        } else {
          setSelectedIncidentId(data[0].id);
        }
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to load incidents');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadIncidents();
    }
  }, [isOpen]);

  const selectedIncident = useMemo(() => {
    return incidents.find((i) => i.id === selectedIncidentId) || null;
  }, [incidents, selectedIncidentId]);

  const parsedEvidence: IncidentEvidenceData | null = useMemo(() => {
    if (!selectedIncident?.evidence) return null;
    try {
      return JSON.parse(selectedIncident.evidence);
    } catch {
      return null;
    }
  }, [selectedIncident]);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      // Category filter
      if (categoryFilter !== 'ALL' && inc.category !== categoryFilter) return false;

      // Status filter
      if (statusFilter === 'ACTIVE' && inc.status === 'RESOLVED') return false;
      if (statusFilter === 'RESOLVED' && inc.status !== 'RESOLVED') return false;

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesId = inc.id.toString().includes(q);
        const matchesDevice = inc.deviceId.toLowerCase().includes(q);
        const matchesTitle = inc.title.toLowerCase().includes(q);
        const matchesRule = inc.diagnosticRule.toLowerCase().includes(q);
        if (!matchesId && !matchesDevice && !matchesTitle && !matchesRule) return false;
      }

      return true;
    });
  }, [incidents, categoryFilter, statusFilter, search]);

  if (!isOpen) return null;

  // RBAC checks
  const isKiosk = currentUser?.role === 'ROLE_KIOSK';
  const isPuneTech = currentUser?.role === 'ROLE_SERVICE_TECH';
  const isBlockedBySite = isPuneTech &&
    selectedIncident?.siteId &&
    selectedIncident.siteId !== currentUser?.siteScope;

  const canActOnIncident = !isKiosk && !isBlockedBySite;

  const handleAcknowledge = async () => {
    if (!selectedIncident) return;
    setIsActionLoading(true);
    setErrorMessage(null);
    try {
      const updated = await acknowledgeIncidentApi(selectedIncident.id);
      setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setActionSuccessMessage(`Incident #${updated.id} marked as ACKNOWLEDGED.`);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to acknowledge incident');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedIncident || !assigneeInput.trim()) return;
    setIsActionLoading(true);
    setErrorMessage(null);
    try {
      const updated = await assignIncidentApi(selectedIncident.id, assigneeInput.trim());
      setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setActionSuccessMessage(`Incident #${updated.id} assigned to '${assigneeInput.trim()}'.`);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to assign incident');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedIncident) return;
    if (resolutionNotes.trim().length < 5) {
      setErrorMessage('Resolution notes must be at least 5 characters describing the fix.');
      return;
    }
    setIsActionLoading(true);
    setErrorMessage(null);
    try {
      const updated = await resolveIncidentApi(selectedIncident.id, resolutionNotes.trim());
      setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setResolutionNotes('');
      setActionSuccessMessage(`Incident #${updated.id} successfully marked as RESOLVED.`);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to resolve incident');
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(11, 31, 58, 0.75)',
        backdropFilter: 'blur(3px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '10px',
          width: '100%',
          maxWidth: '1200px',
          height: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          border: '1px solid #CBD5E1',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            backgroundColor: '#0B1F3A',
            color: '#FFFFFF',
            padding: '1rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2px solid #F47721',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                backgroundColor: '#F47721',
                borderRadius: '6px',
                padding: '0.4rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconAlertTriangle size={20} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                  Fleet Incident Management &amp; Diagnostics Center
                </h2>
                <span
                  style={{
                    backgroundColor: 'rgba(244, 119, 33, 0.2)',
                    color: '#F47721',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    border: '1px solid rgba(244, 119, 33, 0.4)',
                  }}
                >
                  PHASE 6
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94A3B8' }}>
                Automated Fault Detection, Root-Cause Evidence Snapshots &amp; Technician Triage
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={loadIncidents}
              disabled={isLoading}
              style={{
                backgroundColor: '#162C4E',
                color: '#FFFFFF',
                border: '1px solid #2A4365',
                borderRadius: '6px',
                padding: '0.35rem 0.65rem',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer',
              }}
              title="Refresh incidents"
            >
              <IconRefresh size={14} className={isLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <IconClose size={22} />
            </button>
          </div>
        </div>

        {/* Global Alert Notification Banners */}
        {errorMessage && (
          <div
            style={{
              backgroundColor: '#FEF2F2',
              borderBottom: '1px solid #FECACA',
              color: '#991B1B',
              padding: '0.6rem 1.5rem',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>
              <strong>Error:</strong> {errorMessage}
            </span>
            <button
              onClick={() => setErrorMessage(null)}
              style={{ background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer', fontWeight: 700 }}
            >
              ✕
            </button>
          </div>
        )}
        {actionSuccessMessage && (
          <div
            style={{
              backgroundColor: '#ECFDF5',
              borderBottom: '1px solid #A7F3D0',
              color: '#065F46',
              padding: '0.6rem 1.5rem',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <IconCheckCircle size={16} color="#059669" />
            <span>{actionSuccessMessage}</span>
          </div>
        )}

        {/* Filter & Search Toolbar */}
        <div
          style={{
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            padding: '0.65rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {[
              { id: 'ACTIVE', label: `Active (${incidents.filter((i) => i.status !== 'RESOLVED').length})` },
              { id: 'ALL', label: `All (${incidents.length})` },
              { id: 'RESOLVED', label: `Resolved (${incidents.filter((i) => i.status === 'RESOLVED').length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  padding: '0.3rem 0.65rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: statusFilter === tab.id ? '#0B1F3A' : '#FFFFFF',
                  color: statusFilter === tab.id ? '#FFFFFF' : '#475569',
                  border: statusFilter === tab.id ? '1px solid #0B1F3A' : '1px solid #CBD5E1',
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Category Tabs */}
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Category:</span>
            {[
              { id: 'ALL', label: 'All' },
              { id: 'HARDWARE', label: 'Hardware' },
              { id: 'FIRMWARE', label: 'Firmware' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                style={{
                  padding: '0.25rem 0.55rem',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  backgroundColor: categoryFilter === cat.id ? '#EA580C' : '#FFFFFF',
                  color: categoryFilter === cat.id ? '#FFFFFF' : '#64748B',
                  border: categoryFilter === cat.id ? '1px solid #EA580C' : '1px solid #E2E8F0',
                  cursor: 'pointer',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div style={{ position: 'relative', width: '240px' }}>
            <div style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>
              <IconSearch size={14} />
            </div>
            <input
              type="text"
              placeholder="Search ID, device, rule..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.35rem 0.65rem 0.35rem 1.8rem',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Master-Detail Split Pane */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Left Panel: Incident List */}
          <div
            style={{
              width: '38%',
              borderRight: '1px solid #E2E8F0',
              overflowY: 'auto',
              backgroundColor: '#FFFFFF',
            }}
          >
            {filteredIncidents.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748B', fontSize: '0.85rem' }}>
                <IconCheckCircle size={32} color="#10B981" />
                <p style={{ marginTop: '0.5rem', fontWeight: 600 }}>No incidents match criteria</p>
                <p style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                  All systems operating within nominal limits.
                </p>
              </div>
            ) : (
              filteredIncidents.map((inc) => {
                const isSelected = inc.id === selectedIncidentId;
                return (
                  <div
                    key={inc.id}
                    onClick={() => setSelectedIncidentId(inc.id)}
                    style={{
                      padding: '0.85rem 1.15rem',
                      borderBottom: '1px solid #F1F5F9',
                      backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                      borderLeft: isSelected ? '4px solid #F47721' : '4px solid transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.85rem', color: '#0B1F3A' }}>
                          #{inc.id}
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor: '#F1F5F9',
                            color: '#334155',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '4px',
                          }}
                        >
                          {inc.deviceId}
                        </span>
                      </div>

                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.4rem',
                          borderRadius: '4px',
                          backgroundColor:
                            inc.severity === 'CRITICAL'
                              ? '#FEE2E2'
                              : inc.severity === 'HIGH'
                              ? '#FFEDD5'
                              : '#FEF3C7',
                          color:
                            inc.severity === 'CRITICAL'
                              ? '#991B1B'
                              : inc.severity === 'HIGH'
                              ? '#9A3412'
                              : '#92400E',
                        }}
                      >
                        {inc.severity}
                      </span>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1E293B', marginBottom: '0.35rem' }}>
                      {inc.title}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748B' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span
                          style={{
                            backgroundColor: inc.category === 'HARDWARE' ? '#E0E7FF' : '#F3E8FF',
                            color: inc.category === 'HARDWARE' ? '#3730A3' : '#6B21A8',
                            padding: '0.05rem 0.3rem',
                            borderRadius: '3px',
                            fontWeight: 600,
                          }}
                        >
                          {inc.category}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>
                          {inc.diagnosticRule}
                        </span>
                      </div>

                      <span
                        style={{
                          fontWeight: 700,
                          color:
                            inc.status === 'RESOLVED'
                              ? '#059669'
                              : inc.status === 'ACKNOWLEDGED'
                              ? '#0284C7'
                              : '#DC2626',
                        }}
                      >
                        {inc.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Panel: Incident Detail & Triage Inspector */}
          <div
            style={{
              width: '62%',
              overflowY: 'auto',
              padding: '1.25rem 1.5rem',
              backgroundColor: '#F8FAFC',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {selectedIncident ? (
              <>
                {/* Detail Header Banner */}
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    padding: '1.15rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          backgroundColor: '#0B1F3A',
                          color: '#FFFFFF',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                        }}
                      >
                        TICKET #{selectedIncident.id}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>
                        Site: {selectedIncident.siteId || 'Unknown'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor:
                            selectedIncident.status === 'RESOLVED'
                              ? '#DCFCE7'
                              : selectedIncident.status === 'ACKNOWLEDGED'
                              ? '#E0F2FE'
                              : '#FEE2E2',
                          color:
                            selectedIncident.status === 'RESOLVED'
                              ? '#15803D'
                              : selectedIncident.status === 'ACKNOWLEDGED'
                              ? '#0369A1'
                              : '#B91C1C',
                        }}
                      >
                        {selectedIncident.status}
                      </span>
                    </div>
                  </div>

                  <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.1rem', fontWeight: 800, color: '#0B1F3A' }}>
                    {selectedIncident.title}
                  </h3>
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#475569' }}>
                    {selectedIncident.description}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '1rem',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid #F1F5F9',
                      fontSize: '0.75rem',
                      color: '#64748B',
                    }}
                  >
                    <div>
                      <strong>Created:</strong>{' '}
                      {new Date(selectedIncident.createdAt).toLocaleString()}
                    </div>
                    {selectedIncident.acknowledgedAt && (
                      <div>
                        <strong>Ack by:</strong> {selectedIncident.acknowledgedBy} (
                        {new Date(selectedIncident.acknowledgedAt).toLocaleTimeString()})
                      </div>
                    )}
                    {selectedIncident.assignedTo && (
                      <div>
                        <strong>Assigned to:</strong> {selectedIncident.assignedTo}
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 1: Step-by-Step Triage Checklist */}
                {parsedEvidence?.triage_checklist && (
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      padding: '1.15rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.75rem' }}>
                      <IconWrench size={16} color="#F47721" />
                      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#0B1F3A' }}>
                        Service &amp; Engineering Triage Protocol
                      </h4>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {parsedEvidence.triage_checklist.map((step, idx) => (
                        <div
                          key={idx}
                          style={{
                            backgroundColor: '#F8FAFC',
                            padding: '0.55rem 0.85rem',
                            borderRadius: '6px',
                            border: '1px solid #E2E8F0',
                            fontSize: '0.8rem',
                            color: '#334155',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.5rem',
                          }}
                        >
                          <span
                            style={{
                              backgroundColor: '#E2E8F0',
                              color: '#475569',
                              fontWeight: 800,
                              fontSize: '0.7rem',
                              borderRadius: '50%',
                              width: '18px',
                              height: '18px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              marginTop: '1px',
                            }}
                          >
                            {idx + 1}
                          </span>
                          <span>{step.replace(/^\d+\.\s*/, '')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section 2: Developer Evidence & Telemetry Snapshot */}
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    padding: '1.15rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.75rem' }}>
                    <IconCpu size={16} color="#0284C7" />
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#0B1F3A' }}>
                      Diagnostic Evidence &amp; Telemetry Snapshot
                    </h4>
                  </div>

                  {parsedEvidence ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {/* Metric Grid */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, 1fr)',
                          gap: '0.5rem',
                          fontSize: '0.75rem',
                        }}
                      >
                        <div style={{ backgroundColor: '#F8FAFC', padding: '0.5rem', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                          <span style={{ color: '#64748B', display: 'block' }}>Error Bitmask</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#DC2626' }}>
                            {parsedEvidence.telemetry_metrics?.err_code_hex || 'N/A'} (
                            {parsedEvidence.telemetry_metrics?.err_code ?? 0})
                          </span>
                        </div>
                        <div style={{ backgroundColor: '#F8FAFC', padding: '0.5rem', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                          <span style={{ color: '#64748B', display: 'block' }}>PM2.5 Level</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                            {parsedEvidence.telemetry_metrics?.pm25 !== null && parsedEvidence.telemetry_metrics?.pm25 !== undefined
                              ? `${parsedEvidence.telemetry_metrics.pm25} µg/m³`
                              : 'FAULT (NULL)'}
                          </span>
                        </div>
                        <div style={{ backgroundColor: '#F8FAFC', padding: '0.5rem', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                          <span style={{ color: '#64748B', display: 'block' }}>Fan Duty Cycle</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                            {parsedEvidence.telemetry_metrics?.fan_pct ?? 'N/A'}%
                          </span>
                        </div>
                        <div style={{ backgroundColor: '#F8FAFC', padding: '0.5rem', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                          <span style={{ color: '#64748B', display: 'block' }}>Wi-Fi RSSI</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                            {parsedEvidence.telemetry_metrics?.rssi ?? 'N/A'} dBm
                          </span>
                        </div>
                      </div>

                      {/* Device Environment Context */}
                      <div
                        style={{
                          backgroundColor: '#F8FAFC',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '6px',
                          border: '1px solid #E2E8F0',
                          fontSize: '0.75rem',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '1rem',
                        }}
                      >
                        <div>
                          <strong>Firmware:</strong> {parsedEvidence.firmware_version || 'N/A'}
                        </div>
                        <div>
                          <strong>IP:</strong> {parsedEvidence.ip_address || 'N/A'}
                        </div>
                        <div>
                          <strong>MAC:</strong> {parsedEvidence.mac_address || 'N/A'}
                        </div>
                        <div>
                          <strong>Triggered:</strong> {parsedEvidence.snapshot_timestamp || 'N/A'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#64748B' }}>
                      {selectedIncident.evidence || 'No evidence snapshot recorded.'}
                    </div>
                  )}
                </div>

                {/* Section 3: Resolution Status OR Action Controls */}
                {selectedIncident.status === 'RESOLVED' ? (
                  <div
                    style={{
                      backgroundColor: '#F0FDF4',
                      borderRadius: '8px',
                      border: '1px solid #BBF7D0',
                      padding: '1.15rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.5rem' }}>
                      <IconCheckCircle size={18} color="#16A34A" />
                      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#166534' }}>
                        Incident Resolved
                      </h4>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#166534', marginBottom: '0.4rem' }}>
                      <strong>Resolved By:</strong> {selectedIncident.resolvedBy} on{' '}
                      {selectedIncident.resolvedAt ? new Date(selectedIncident.resolvedAt).toLocaleString() : 'N/A'}
                    </div>
                    <div
                      style={{
                        backgroundColor: '#FFFFFF',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '6px',
                        border: '1px solid #DCFCE7',
                        fontSize: '0.82rem',
                        color: '#1E293B',
                      }}
                    >
                      <strong>Resolution Notes:</strong> {selectedIncident.resolutionNotes}
                    </div>
                  </div>
                ) : (
                  /* Action Controls Box */
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      padding: '1.15rem',
                    }}
                  >
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: 700, color: '#0B1F3A' }}>
                      Incident Triage &amp; Resolution Actions
                    </h4>

                    {/* RBAC Warnings */}
                    {isKiosk && (
                      <div
                        style={{
                          backgroundColor: '#F1F5F9',
                          border: '1px solid #CBD5E1',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          color: '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          marginBottom: '0.75rem',
                        }}
                      >
                        <IconLock size={14} color="#64748B" />
                        <span>Kiosk displays have read-only access. Incident modifications are disabled.</span>
                      </div>
                    )}

                    {isBlockedBySite && (
                      <div
                        style={{
                          backgroundColor: '#FFF7ED',
                          border: '1px solid #FED7AA',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          color: '#9A3412',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          marginBottom: '0.75rem',
                        }}
                      >
                        <IconAlertTriangle size={14} color="#EA580C" />
                        <span>
                          Technician Site Isolation: This device is deployed at {selectedIncident.siteId}. Your
                          credentials only permit servicing {currentUser?.siteScope}.
                        </span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {/* Step A: Acknowledge & Assign */}
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {selectedIncident.status === 'OPEN' && (
                          <button
                            onClick={handleAcknowledge}
                            disabled={!canActOnIncident || isActionLoading}
                            style={{
                              backgroundColor: '#0284C7',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.45rem 0.9rem',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              cursor: canActOnIncident && !isActionLoading ? 'pointer' : 'not-allowed',
                              opacity: canActOnIncident ? 1 : 0.6,
                            }}
                          >
                            Acknowledge Incident
                          </button>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Assign:</span>
                          <select
                            value={assigneeInput}
                            onChange={(e) => setAssigneeInput(e.target.value)}
                            disabled={!canActOnIncident || isActionLoading}
                            style={{
                              padding: '0.4rem 0.6rem',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              fontSize: '0.75rem',
                            }}
                          >
                            <option value="tech_pune">tech_pune (Pune Service Tech)</option>
                            <option value="dev_eng">dev_eng (Firmware Engineer)</option>
                            <option value="admin">admin (Operations Lead)</option>
                          </select>
                          <button
                            onClick={handleAssign}
                            disabled={!canActOnIncident || isActionLoading}
                            style={{
                              backgroundColor: '#1E293B',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.4rem 0.75rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: canActOnIncident && !isActionLoading ? 'pointer' : 'not-allowed',
                              opacity: canActOnIncident ? 1 : 0.6,
                            }}
                          >
                            Assign
                          </button>
                        </div>
                      </div>

                      {/* Step B: Resolution Notes and Close */}
                      <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '0.75rem' }}>
                        <label
                          htmlFor="res-notes"
                          style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}
                        >
                          Resolution Notes &amp; Repair Evidence:
                        </label>
                        <textarea
                          id="res-notes"
                          rows={2}
                          placeholder="e.g., Cleared blower cavity, verified tachometer PWM, and re-tested nominal RPM..."
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          disabled={!canActOnIncident || isActionLoading}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            fontSize: '0.8rem',
                            outline: 'none',
                            resize: 'vertical',
                            boxSizing: 'border-box',
                            marginBottom: '0.5rem',
                          }}
                        />
                        <button
                          onClick={handleResolve}
                          disabled={!canActOnIncident || isActionLoading || resolutionNotes.trim().length < 5}
                          style={{
                            backgroundColor: '#059669',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '0.45rem 1rem',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor:
                              canActOnIncident && !isActionLoading && resolutionNotes.trim().length >= 5
                                ? 'pointer'
                                : 'not-allowed',
                            opacity:
                              canActOnIncident && resolutionNotes.trim().length >= 5 ? 1 : 0.6,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <IconCheckCircle size={15} color="#FFFFFF" />
                          <span>Resolve &amp; Close Ticket</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ margin: 'auto', textAlign: 'center', color: '#94A3B8' }}>
                <p>Select an incident from the left to view diagnostics and triage recommendations.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
