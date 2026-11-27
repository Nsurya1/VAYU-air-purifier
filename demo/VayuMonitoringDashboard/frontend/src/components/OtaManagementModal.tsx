import React, { useState, useEffect } from 'react';
import {
  FirmwareRelease,
  OtaDeployment,
  DeviceOtaHistory,
  CreateDeploymentRequest,
  CreateReleaseRequest,
} from '../types/ota';
import { AuthUser } from '../types/auth';
import {
  fetchFirmwareReleases,
  createFirmwareReleaseApi,
  fetchOtaDeployments,
  createOtaDeploymentApi,
  startCanaryDeploymentApi,
  evaluateCanaryDeploymentApi,
  approveFleetDeploymentApi,
  fetchDeviceOtaHistoryApi,
} from '../services/api';
import {
  IconClose,
  IconShield,
  IconCheckCircle,
  IconAlertTriangle,
  IconRefresh,
  IconUploadCloud,
  IconLayers,
  IconLock,
} from './Icons';

interface OtaManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
}

export const OtaManagementModal: React.FC<OtaManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'deployments' | 'catalog' | 'history'>('deployments');
  const [deployments, setDeployments] = useState<OtaDeployment[]>([]);
  const [releases, setReleases] = useState<FirmwareRelease[]>([]);
  const [historyList, setHistoryList] = useState<DeviceOtaHistory[]>([]);
  const [historyDeviceId, setHistoryDeviceId] = useState<string>('VAYU-DEV-001');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Deployment Form State
  const [showNewDeploymentForm, setShowNewDeploymentForm] = useState<boolean>(false);
  const [newDeployName, setNewDeployName] = useState<string>('');
  const [newDeployVersion, setNewDeployVersion] = useState<string>('');
  const [newDeployStrategy, setNewDeployStrategy] = useState<'CANARY' | 'FULL_ROLLOUT'>('CANARY');
  const [newDeployCanaryDev, setNewDeployCanaryDev] = useState<string>('VAYU-DEV-001');
  const [newDeployDuration, setNewDeployDuration] = useState<number>(60);

  // New Release Form State
  const [showNewReleaseForm, setShowNewReleaseForm] = useState<boolean>(false);
  const [newRelVersion, setNewRelVersion] = useState<string>('');
  const [newRelBuildId, setNewRelBuildId] = useState<string>('');
  const [newRelSha256, setNewRelSha256] = useState<string>('');
  const [newRelSize, setNewRelSize] = useState<number>(1048576);
  const [newRelUrl, setNewRelUrl] = useState<string>('');
  const [newRelNotes, setNewRelNotes] = useState<string>('');

  const isOperator =
    currentUser?.role === 'ROLE_ADMIN' || currentUser?.role === 'ROLE_DEV_ENGINEER';

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [deps, rels] = await Promise.all([
        fetchOtaDeployments(),
        fetchFirmwareReleases(),
      ]);
      setDeployments(deps);
      setReleases(rels);
      if (rels.length > 0 && !newDeployVersion) {
        setNewDeployVersion(rels[0].version);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load OTA orchestration data.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDeviceHistory = async (devId: string) => {
    if (!devId) return;
    try {
      const hist = await fetchDeviceOtaHistoryApi(devId);
      setHistoryList(hist);
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to fetch history for ${devId}`);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      if (activeTab === 'history') {
        loadDeviceHistory(historyDeviceId);
      }
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleCreateDeployment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeployName || !newDeployVersion) {
      setErrorMsg('Deployment name and firmware version are required.');
      return;
    }

    try {
      const req: CreateDeploymentRequest = {
        deploymentName: newDeployName,
        firmwareVersion: newDeployVersion,
        rolloutStrategy: newDeployStrategy,
        canaryDeviceId: newDeployStrategy === 'CANARY' ? newDeployCanaryDev : undefined,
        canaryDurationSeconds: newDeployDuration,
      };
      await createOtaDeploymentApi(req);
      setSuccessMsg(`Deployment '${newDeployName}' successfully created.`);
      setShowNewDeploymentForm(false);
      setNewDeployName('');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create deployment.');
    }
  };

  const handleStartCanary = async (depId: number) => {
    try {
      await startCanaryDeploymentApi(depId);
      setSuccessMsg(`Canary trial initiated for Deployment #${depId}. OTA command dispatched.`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch canary command.');
    }
  };

  const handleEvaluateCanary = async (depId: number) => {
    try {
      const res = await evaluateCanaryDeploymentApi(depId);
      if (res.status === 'CANARY_PASSED') {
        setSuccessMsg(`Canary trial #${depId} PASSED! Telemetry confirmed nominal on target version.`);
      } else {
        setErrorMsg(`Canary trial #${depId} FAILED! Device reported diagnostic errors or offline state.`);
      }
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error evaluating canary health.');
    }
  };

  const handleApproveFleet = async (depId: number) => {
    if (!window.confirm('Confirm fleet-wide rollout? This will dispatch OTA update commands to all remaining purifiers.')) {
      return;
    }
    try {
      await approveFleetDeploymentApi(depId);
      setSuccessMsg(`Fleet rollout approved for Deployment #${depId}! OTA commands broadcast.`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to approve fleet rollout.');
    }
  };

  const handleCreateRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRelVersion || !newRelBuildId || !newRelSha256) {
      setErrorMsg('Version, Build ID, and SHA-256 digest are required.');
      return;
    }

    try {
      const req: CreateReleaseRequest = {
        version: newRelVersion,
        buildId: newRelBuildId,
        targetHardware: 'REV-B-ESP32',
        sha256: newRelSha256,
        binarySize: Number(newRelSize),
        binaryUrl: newRelUrl || `/binaries/vayu-${newRelVersion}.bin`,
        releaseNotes: newRelNotes,
      };
      await createFirmwareReleaseApi(req);
      setSuccessMsg(`Release '${newRelVersion}' registered in catalog.`);
      setShowNewReleaseForm(false);
      setNewRelVersion('');
      setNewRelBuildId('');
      setNewRelSha256('');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register release.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CREATED':
        return { bg: 'rgba(148, 163, 184, 0.2)', text: '#94A3B8', border: '#475569', label: '1. Created' };
      case 'CANARY_ACTIVE':
        return { bg: 'rgba(245, 158, 11, 0.2)', text: '#FBBF24', border: '#D97706', label: '2. Canary Active' };
      case 'CANARY_PASSED':
        return { bg: 'rgba(16, 185, 129, 0.2)', text: '#34D399', border: '#059669', label: '3. Canary Passed' };
      case 'CANARY_FAILED':
        return { bg: 'rgba(239, 68, 68, 0.2)', text: '#F87171', border: '#DC2626', label: 'Canary Failed (Aborted)' };
      case 'FULL_ROLLOUT':
        return { bg: 'rgba(59, 130, 246, 0.2)', text: '#60A5FA', border: '#2563EB', label: '4. Fleet Rollout Active' };
      case 'COMPLETED':
        return { bg: 'rgba(16, 185, 129, 0.2)', text: '#10B981', border: '#10B981', label: 'Completed' };
      default:
        return { bg: '#334155', text: '#E2E8F0', border: '#64748B', label: status };
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
        backgroundColor: 'rgba(11, 31, 58, 0.85)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#0F2444',
          border: '2px solid #1E3A63',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '1050px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          color: '#FFFFFF',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid #1E3A63',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#0B1F3A',
            borderTopLeftRadius: '10px',
            borderTopRightRadius: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                backgroundColor: '#F47721',
                padding: '0.45rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconUploadCloud size={22} color="#FFFFFF" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                Safe OTA Orchestration &amp; Dual-Partition Rollout Center
              </h2>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#94A3B8' }}>
                Canary validation, automatic A/B partition rollback, and cryptographic image verification
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              onClick={loadData}
              disabled={isLoading}
              style={{
                backgroundColor: '#162C4E',
                color: '#94A3B8',
                border: '1px solid #2A4365',
                borderRadius: '6px',
                padding: '0.4rem 0.7rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.8rem',
              }}
            >
              <IconRefresh size={14} />
              <span>Refresh</span>
            </button>
            <button
              onClick={onClose}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '0.4rem',
              }}
            >
              <IconClose size={20} />
            </button>
          </div>
        </div>

        {/* Operator Banner / Read-Only Warning */}
        {!isOperator && (
          <div
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
              padding: '0.6rem 1.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#FBBF24',
              fontSize: '0.82rem',
            }}
          >
            <IconLock size={15} />
            <span>
              <strong>Read-Only Mode:</strong> Your persona ({currentUser?.role}) has inspection privileges.
              OTA deployments, canary dispatches, and fleet approvals require Administrator or Dev Engineer roles.
            </span>
          </div>
        )}

        {/* Notifications */}
        {errorMsg && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
              padding: '0.6rem 1.75rem',
              color: '#FCA5A5',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <IconAlertTriangle size={16} color="#EF4444" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer' }}
            >
              &times;
            </button>
          </div>
        )}

        {successMsg && (
          <div
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              borderBottom: '1px solid rgba(16, 185, 129, 0.3)',
              padding: '0.6rem 1.75rem',
              color: '#6EE7B7',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <IconCheckCircle size={16} color="#10B981" />
              <span>{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg(null)}
              style={{ background: 'none', border: 'none', color: '#6EE7B7', cursor: 'pointer' }}
            >
              &times;
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #1E3A63',
            backgroundColor: '#0B1F3A',
            padding: '0 1.75rem',
          }}
        >
          <button
            onClick={() => setActiveTab('deployments')}
            style={{
              padding: '0.85rem 1.25rem',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'deployments' ? '3px solid #F47721' : '3px solid transparent',
              color: activeTab === 'deployments' ? '#FFFFFF' : '#94A3B8',
              fontWeight: activeTab === 'deployments' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <IconUploadCloud size={16} />
            <span>Active Deployments &amp; Canaries ({deployments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('catalog')}
            style={{
              padding: '0.85rem 1.25rem',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'catalog' ? '3px solid #F47721' : '3px solid transparent',
              color: activeTab === 'catalog' ? '#FFFFFF' : '#94A3B8',
              fontWeight: activeTab === 'catalog' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <IconLayers size={16} />
            <span>Firmware Catalog ({releases.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('history');
              loadDeviceHistory(historyDeviceId);
            }}
            style={{
              padding: '0.85rem 1.25rem',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'history' ? '3px solid #F47721' : '3px solid transparent',
              color: activeTab === 'history' ? '#FFFFFF' : '#94A3B8',
              fontWeight: activeTab === 'history' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <IconShield size={16} />
            <span>Device History &amp; Rollback Logs</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1.75rem' }}>
          {/* ========================================================================= */}
          {/* TAB 1: DEPLOYMENTS & CANARIES */}
          {/* ========================================================================= */}
          {activeTab === 'deployments' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1.25rem',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Fleet Rollout Pipeline</h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#94A3B8' }}>
                    Strict two-phase canary protocol: 1 trial device must demonstrate zero diagnostic faults before fleet rollout is unlocked.
                  </p>
                </div>
                {isOperator && (
                  <button
                    onClick={() => setShowNewDeploymentForm(!showNewDeploymentForm)}
                    style={{
                      backgroundColor: showNewDeploymentForm ? '#334155' : '#F47721',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.45rem 0.9rem',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    {showNewDeploymentForm ? 'Cancel' : '+ New Canary Deployment'}
                  </button>
                )}
              </div>

              {/* New Deployment Creation Card */}
              {showNewDeploymentForm && (
                <form
                  onSubmit={handleCreateDeployment}
                  style={{
                    backgroundColor: '#132B4F',
                    border: '1px solid #2A4365',
                    borderRadius: '8px',
                    padding: '1.25rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#F47721' }}>
                    Configure Safe Canary Deployment
                  </h4>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '1rem',
                      marginBottom: '1rem',
                    }}
                  >
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8', marginBottom: '0.3rem' }}>
                        Deployment Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Production Patch v1.1.0-rc1"
                        value={newDeployName}
                        onChange={(e) => setNewDeployName(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          backgroundColor: '#0B1F3A',
                          border: '1px solid #2A4365',
                          borderRadius: '4px',
                          color: '#FFFFFF',
                          padding: '0.45rem 0.6rem',
                          fontSize: '0.82rem',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8', marginBottom: '0.3rem' }}>
                        Firmware Release Version
                      </label>
                      <select
                        value={newDeployVersion}
                        onChange={(e) => setNewDeployVersion(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          backgroundColor: '#0B1F3A',
                          border: '1px solid #2A4365',
                          borderRadius: '4px',
                          color: '#FFFFFF',
                          padding: '0.45rem 0.6rem',
                          fontSize: '0.82rem',
                        }}
                      >
                        {releases.map((r) => (
                          <option key={r.id} value={r.version}>
                            {r.version} ({r.buildId}) - {r.status}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8', marginBottom: '0.3rem' }}>
                        Rollout Strategy
                      </label>
                      <select
                        value={newDeployStrategy}
                        onChange={(e) => setNewDeployStrategy(e.target.value as any)}
                        style={{
                          width: '100%',
                          backgroundColor: '#0B1F3A',
                          border: '1px solid #2A4365',
                          borderRadius: '4px',
                          color: '#FFFFFF',
                          padding: '0.45rem 0.6rem',
                          fontSize: '0.82rem',
                        }}
                      >
                        <option value="CANARY">CANARY (Single trial device first)</option>
                        <option value="FULL_ROLLOUT">FULL_ROLLOUT (Emergency Fleet-Wide)</option>
                      </select>
                    </div>

                    {newDeployStrategy === 'CANARY' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8', marginBottom: '0.3rem' }}>
                          Canary Test Device ID
                        </label>
                        <input
                          type="text"
                          value={newDeployCanaryDev}
                          onChange={(e) => setNewDeployCanaryDev(e.target.value)}
                          placeholder="e.g. VAYU-DEV-001"
                          style={{
                            width: '100%',
                            backgroundColor: '#0B1F3A',
                            border: '1px solid #2A4365',
                            borderRadius: '4px',
                            color: '#FFFFFF',
                            padding: '0.45rem 0.6rem',
                            fontSize: '0.82rem',
                          }}
                        />
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8', marginBottom: '0.3rem' }}>
                        Canary Trial Duration (Seconds)
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={3600}
                        value={newDeployDuration}
                        onChange={(e) => setNewDeployDuration(Number(e.target.value))}
                        style={{
                          width: '100%',
                          backgroundColor: '#0B1F3A',
                          border: '1px solid #2A4365',
                          borderRadius: '4px',
                          color: '#FFFFFF',
                          padding: '0.45rem 0.6rem',
                          fontSize: '0.82rem',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowNewDeploymentForm(false)}
                      style={{
                        backgroundColor: 'transparent',
                        color: '#94A3B8',
                        border: '1px solid #2A4365',
                        borderRadius: '4px',
                        padding: '0.4rem 0.8rem',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={{
                        backgroundColor: '#F47721',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '0.4rem 1rem',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                      }}
                    >
                      Create Deployment
                    </button>
                  </div>
                </form>
              )}

              {/* Deployments List */}
              {deployments.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '3rem 1rem',
                    color: '#94A3B8',
                    backgroundColor: '#132B4F',
                    borderRadius: '8px',
                    border: '1px dashed #2A4365',
                  }}
                >
                  <IconUploadCloud size={40} color="#475569" />
                  <p style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
                    No OTA deployments configured yet. Create a canary deployment to start.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {deployments.map((d) => {
                    const badge = getStatusBadge(d.status);
                    return (
                      <div
                        key={d.id}
                        style={{
                          backgroundColor: '#132B4F',
                          border: '1px solid #1E3A63',
                          borderRadius: '8px',
                          padding: '1.25rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.85rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.75rem',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{d.deploymentName}</h4>
                              <span
                                style={{
                                  backgroundColor: '#0B1F3A',
                                  color: '#F47721',
                                  border: '1px solid rgba(244, 119, 33, 0.4)',
                                  borderRadius: '4px',
                                  padding: '0.1rem 0.45rem',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                }}
                              >
                                Target: {d.firmwareVersion}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                              Deployment #{d.id} &bull; Strategy: {d.rolloutStrategy} &bull; Canary Target:{' '}
                              <strong>{d.canaryDeviceId || 'N/A'}</strong> &bull; Created by {d.createdBy}
                            </span>
                          </div>

                          <div
                            style={{
                              backgroundColor: badge.bg,
                              color: badge.text,
                              border: `1px solid ${badge.border}`,
                              borderRadius: '20px',
                              padding: '0.25rem 0.75rem',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                            }}
                          >
                            {badge.label}
                          </div>
                        </div>

                        {/* Pipeline Progress Stages */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            backgroundColor: '#0B1F3A',
                            padding: '0.6rem 0.85rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                          }}
                        >
                          <span
                            style={{
                              color: '#10B981',
                              fontWeight: 700,
                            }}
                          >
                            ✓ 1. Configured
                          </span>
                          <span style={{ color: '#475569' }}>&rarr;</span>

                          <span
                            style={{
                              color:
                                d.status === 'CANARY_ACTIVE'
                                  ? '#FBBF24'
                                  : d.status === 'CANARY_PASSED' || d.status === 'FULL_ROLLOUT'
                                  ? '#10B981'
                                  : d.status === 'CANARY_FAILED'
                                  ? '#EF4444'
                                  : '#64748B',
                              fontWeight: d.status === 'CANARY_ACTIVE' ? 800 : 600,
                            }}
                          >
                            {d.status === 'CANARY_FAILED' ? '✗ 2. Canary Failed' : '2. Canary Trial'}
                          </span>
                          <span style={{ color: '#475569' }}>&rarr;</span>

                          <span
                            style={{
                              color:
                                d.status === 'CANARY_PASSED' || d.status === 'FULL_ROLLOUT'
                                  ? '#10B981'
                                  : d.status === 'CANARY_FAILED'
                                  ? '#EF4444'
                                  : '#64748B',
                              fontWeight: d.status === 'CANARY_PASSED' ? 800 : 600,
                            }}
                          >
                            3. Telemetry Verification
                          </span>
                          <span style={{ color: '#475569' }}>&rarr;</span>

                          <span
                            style={{
                              color: d.status === 'FULL_ROLLOUT' ? '#3B82F6' : '#64748B',
                              fontWeight: d.status === 'FULL_ROLLOUT' ? 800 : 600,
                            }}
                          >
                            4. Fleet Rollout
                          </span>
                        </div>

                        {/* Rollout Actions based on state */}
                        {isOperator && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: '0.6rem',
                              borderTop: '1px solid #1E3A63',
                              paddingTop: '0.75rem',
                            }}
                          >
                            {d.status === 'CREATED' && (
                              <button
                                onClick={() => handleStartCanary(d.id)}
                                style={{
                                  backgroundColor: '#0284C7',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '0.35rem 0.85rem',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                ⚡ Start Canary Trial ({d.canaryDeviceId})
                              </button>
                            )}

                            {d.status === 'CANARY_ACTIVE' && (
                              <button
                                onClick={() => handleEvaluateCanary(d.id)}
                                style={{
                                  backgroundColor: '#D97706',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '0.35rem 0.85rem',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                🔍 Evaluate Canary Telemetry Health
                              </button>
                            )}

                            {d.status === 'CANARY_PASSED' && (
                              <button
                                onClick={() => handleApproveFleet(d.id)}
                                style={{
                                  backgroundColor: '#F47721',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '0.35rem 0.95rem',
                                  fontSize: '0.78rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  boxShadow: '0 2px 8px rgba(244, 119, 33, 0.4)',
                                }}
                              >
                                🚀 Approve &amp; Broadcast Fleet Rollout
                              </button>
                            )}

                            {d.status === 'CANARY_FAILED' && (
                              <div
                                style={{
                                  color: '#F87171',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                }}
                              >
                                ⚠️ Rollout aborted by safety controller. Check device diagnostics below.
                              </div>
                            )}

                            {d.status === 'FULL_ROLLOUT' && (
                              <div style={{ color: '#60A5FA', fontSize: '0.75rem', fontWeight: 600 }}>
                                ✓ Fleet rollout active (Approved by {d.approvedBy})
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: FIRMWARE CATALOG */}
          {/* ========================================================================= */}
          {activeTab === 'catalog' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1.25rem',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Cryptographic Firmware Releases</h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#94A3B8' }}>
                    Immutable binaries verified with SHA-256 digests. Only published builds can be deployed to the purifier fleet.
                  </p>
                </div>
                {isOperator && (
                  <button
                    onClick={() => setShowNewReleaseForm(!showNewReleaseForm)}
                    style={{
                      backgroundColor: showNewReleaseForm ? '#334155' : '#F47721',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.45rem 0.9rem',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    {showNewReleaseForm ? 'Cancel' : '+ Publish New Release'}
                  </button>
                )}
              </div>

              {/* New Release Form */}
              {showNewReleaseForm && (
                <form
                  onSubmit={handleCreateRelease}
                  style={{
                    backgroundColor: '#132B4F',
                    border: '1px solid #2A4365',
                    borderRadius: '8px',
                    padding: '1.25rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#F47721' }}>
                    Register Verified Firmware Image
                  </h4>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '1rem',
                      marginBottom: '1rem',
                    }}
                  >
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8', marginBottom: '0.3rem' }}>
                        Version String
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. v1.2.0-prod"
                        value={newRelVersion}
                        onChange={(e) => setNewRelVersion(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          backgroundColor: '#0B1F3A',
                          border: '1px solid #2A4365',
                          borderRadius: '4px',
                          color: '#FFFFFF',
                          padding: '0.45rem 0.6rem',
                          fontSize: '0.82rem',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8', marginBottom: '0.3rem' }}>
                        Build ID
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. bld-20261022-03"
                        value={newRelBuildId}
                        onChange={(e) => setNewRelBuildId(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          backgroundColor: '#0B1F3A',
                          border: '1px solid #2A4365',
                          borderRadius: '4px',
                          color: '#FFFFFF',
                          padding: '0.45rem 0.6rem',
                          fontSize: '0.82rem',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8', marginBottom: '0.3rem' }}>
                        SHA-256 Checksum Digest (64 Hex)
                      </label>
                      <input
                        type="text"
                        placeholder="64-character hex digest"
                        value={newRelSha256}
                        onChange={(e) => setNewRelSha256(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          backgroundColor: '#0B1F3A',
                          border: '1px solid #2A4365',
                          borderRadius: '4px',
                          color: '#FFFFFF',
                          padding: '0.45rem 0.6rem',
                          fontSize: '0.82rem',
                          fontFamily: 'monospace',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8', marginBottom: '0.3rem' }}>
                        Binary URL / Path
                      </label>
                      <input
                        type="text"
                        placeholder="/binaries/vayu-node.bin"
                        value={newRelUrl}
                        onChange={(e) => setNewRelUrl(e.target.value)}
                        style={{
                          width: '100%',
                          backgroundColor: '#0B1F3A',
                          border: '1px solid #2A4365',
                          borderRadius: '4px',
                          color: '#FFFFFF',
                          padding: '0.45rem 0.6rem',
                          fontSize: '0.82rem',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8', marginBottom: '0.3rem' }}>
                        Binary Image Size (Bytes)
                      </label>
                      <input
                        type="number"
                        value={newRelSize}
                        onChange={(e) => setNewRelSize(Number(e.target.value))}
                        style={{
                          width: '100%',
                          backgroundColor: '#0B1F3A',
                          border: '1px solid #2A4365',
                          borderRadius: '4px',
                          color: '#FFFFFF',
                          padding: '0.45rem 0.6rem',
                          fontSize: '0.82rem',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8', marginBottom: '0.3rem' }}>
                      Release Notes
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Summary of bug fixes, algorithm changes, and safety updates..."
                      value={newRelNotes}
                      onChange={(e) => setNewRelNotes(e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: '#0B1F3A',
                        border: '1px solid #2A4365',
                        borderRadius: '4px',
                        color: '#FFFFFF',
                        padding: '0.45rem 0.6rem',
                        fontSize: '0.82rem',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowNewReleaseForm(false)}
                      style={{
                        backgroundColor: 'transparent',
                        color: '#94A3B8',
                        border: '1px solid #2A4365',
                        borderRadius: '4px',
                        padding: '0.4rem 0.8rem',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={{
                        backgroundColor: '#F47721',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '0.4rem 1rem',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                      }}
                    >
                      Publish Release
                    </button>
                  </div>
                </form>
              )}

              {/* Releases Table */}
              <div
                style={{
                  backgroundColor: '#132B4F',
                  border: '1px solid #1E3A63',
                  borderRadius: '8px',
                  overflowX: 'auto',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0B1F3A', color: '#94A3B8', borderBottom: '1px solid #1E3A63' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Version</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Build ID</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Hardware Target</th>
                      <th style={{ padding: '0.75rem 1rem' }}>SHA-256 Digest</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {releases.map((rel) => (
                      <tr key={rel.id} style={{ borderBottom: '1px solid #1E3A63' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#F47721' }}>
                          {rel.version}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace' }}>
                          {rel.buildId}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          {rel.targetHardware}
                        </td>
                        <td
                          style={{
                            padding: '0.75rem 1rem',
                            fontFamily: 'monospace',
                            fontSize: '0.72rem',
                            color: '#94A3B8',
                          }}
                          title={rel.sha256}
                        >
                          {rel.sha256.substring(0, 16)}...{rel.sha256.substring(56)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            style={{
                              backgroundColor:
                                rel.status === 'PUBLISHED'
                                  ? 'rgba(16, 185, 129, 0.2)'
                                  : 'rgba(245, 158, 11, 0.2)',
                              color: rel.status === 'PUBLISHED' ? '#34D399' : '#FBBF24',
                              borderRadius: '4px',
                              padding: '0.15rem 0.45rem',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                            }}
                          >
                            {rel.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#CBD5E1', maxWidth: '250px' }}>
                          {rel.releaseNotes || 'Baseline release'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: DEVICE OTA HISTORY & ROLLBACK */}
          {/* ========================================================================= */}
          {activeTab === 'history' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1.25rem',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Device Dual-Partition Boot History</h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#94A3B8' }}>
                    Audit trail of partition A/B slot swaps, post-boot health verification, and rollback events.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={historyDeviceId}
                    onChange={(e) => setHistoryDeviceId(e.target.value)}
                    placeholder="Enter Device ID"
                    style={{
                      backgroundColor: '#0B1F3A',
                      border: '1px solid #2A4365',
                      borderRadius: '4px',
                      color: '#FFFFFF',
                      padding: '0.4rem 0.6rem',
                      fontSize: '0.8rem',
                    }}
                  />
                  <button
                    onClick={() => loadDeviceHistory(historyDeviceId)}
                    style={{
                      backgroundColor: '#0284C7',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Query
                  </button>
                </div>
              </div>

              {historyList.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '3rem 1rem',
                    color: '#94A3B8',
                    backgroundColor: '#132B4F',
                    borderRadius: '8px',
                    border: '1px dashed #2A4365',
                  }}
                >
                  <IconShield size={36} color="#475569" />
                  <p style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
                    No OTA event records found for '{historyDeviceId}'.
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: '#132B4F',
                    border: '1px solid #1E3A63',
                    borderRadius: '8px',
                    overflowX: 'auto',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#0B1F3A', color: '#94A3B8', borderBottom: '1px solid #1E3A63' }}>
                        <th style={{ padding: '0.75rem 1rem' }}>Device</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Target Version</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Previous Version</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Outcome Status</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Failure / Rollback Reason</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyList.map((h) => {
                        const isSuccess = h.status === 'SUCCESS';
                        const isRollback = h.status === 'FAILED_ROLLBACK';
                        return (
                          <tr key={h.id} style={{ borderBottom: '1px solid #1E3A63' }}>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>
                              {h.deviceId}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: '#F47721', fontWeight: 600 }}>
                              {h.targetVersion}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: '#94A3B8' }}>
                              {h.previousVersion}
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span
                                style={{
                                  backgroundColor: isSuccess
                                    ? 'rgba(16, 185, 129, 0.2)'
                                    : isRollback
                                    ? 'rgba(239, 68, 68, 0.2)'
                                    : 'rgba(245, 158, 11, 0.2)',
                                  color: isSuccess ? '#34D399' : isRollback ? '#F87171' : '#FBBF24',
                                  borderRadius: '4px',
                                  padding: '0.15rem 0.45rem',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                }}
                              >
                                {h.status}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: isRollback ? '#FCA5A5' : '#CBD5E1' }}>
                              {h.failureReason || 'Nominal execution'}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: '#94A3B8', fontSize: '0.72rem' }}>
                              {new Date(h.updatedAt).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
