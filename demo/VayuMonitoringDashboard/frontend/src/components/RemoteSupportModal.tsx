import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RemoteSession, RequestRemoteSessionRequest } from '../types/remote';
import { AuthUser } from '../types/auth';
import {
  fetchRemoteSessions,
  requestRemoteSessionApi,
  approveRemoteSessionApi,
  rejectRemoteSessionApi,
  revokeRemoteSessionApi,
} from '../services/api';
import {
  IconClose,
  IconShield,
  IconCheckCircle,
  IconAlertTriangle,
  IconRefresh,
  IconLock,
  IconLifeBuoy,
  IconKey,
} from './Icons';

interface RemoteSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
}

export const RemoteSupportModal: React.FC<RemoteSupportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [sessions, setSessions] = useState<RemoteSession[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Request form state
  const [showRequestForm, setShowRequestForm] = useState<boolean>(false);
  const [targetSiteId, setTargetSiteId] = useState<string>('SITE-HQ-PUNE');
  const [reason, setReason] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Copied token indicator
  const [copiedToken, setCopiedToken] = useState<boolean>(false);

  // Killswitch confirmation
  const [killswitchSessionId, setKillswitchSessionId] = useState<number | null>(null);
  const [killswitchReason, setKillswitchReason] = useState<string>('Emergency administrator killswitch');

  const isAdmin = currentUser?.role === 'ROLE_ADMIN';
  const canRequest =
    currentUser?.role === 'ROLE_ADMIN' ||
    currentUser?.role === 'ROLE_DEV_ENGINEER' ||
    currentUser?.role === 'ROLE_SERVICE_TECH';

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchRemoteSessions();
      setSessions(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load remote troubleshooting sessions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load and periodic refresh when open
  useEffect(() => {
    if (!isOpen) return;
    loadSessions();
    const interval = setInterval(loadSessions, 4000);
    return () => clearInterval(interval);
  }, [isOpen, loadSessions]);

  // Tick active session countdown timer locally every second
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.status === 'APPROVED_ACTIVE' && s.remainingSeconds > 0) {
            const nextSec = s.remainingSeconds - 1;
            return {
              ...s,
              remainingSeconds: nextSec,
              status: nextSec === 0 ? 'EXPIRED' : s.status,
            };
          }
          return s;
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  const activeSession = useMemo(() => {
    return sessions.find((s) => s.status === 'APPROVED_ACTIVE');
  }, [sessions]);

  const pendingSessions = useMemo(() => {
    return sessions.filter((s) => s.status === 'REQUESTED');
  }, [sessions]);

  const pastSessions = useMemo(() => {
    return sessions.filter(
      (s) => s.status !== 'REQUESTED' && s.status !== 'APPROVED_ACTIVE'
    );
  }, [sessions]);

  // Form submit handler
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg('Please specify a diagnostic reason for requesting remote access.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const req: RequestRemoteSessionRequest = {
        targetSiteId,
        reason: reason.trim(),
        durationMinutes,
      };
      await requestRemoteSessionApi(req);
      setSuccessMsg('Remote troubleshooting session requested. Awaiting administrator consent.');
      setShowRequestForm(false);
      setReason('');
      await loadSessions();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to request remote troubleshooting session');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Consent approval handler
  const handleApprove = async (sessionId: number) => {
    setErrorMsg(null);
    try {
      await approveRemoteSessionApi(sessionId);
      setSuccessMsg(`Session #${sessionId} approved! Ephemeral token generated and outbound tunnel authorized.`);
      await loadSessions();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to approve remote session');
    }
  };

  // Rejection handler
  const handleReject = async (sessionId: number) => {
    setErrorMsg(null);
    try {
      await rejectRemoteSessionApi(sessionId);
      setSuccessMsg(`Session #${sessionId} denied.`);
      await loadSessions();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reject remote session');
    }
  };

  // Killswitch revocation handler
  const handleRevoke = async (sessionId: number) => {
    setErrorMsg(null);
    try {
      await revokeRemoteSessionApi(sessionId, killswitchReason);
      setSuccessMsg(`EMERGENCY KILLSWITCH: Remote session #${sessionId} revoked and disconnected immediately.`);
      setKillswitchSessionId(null);
      await loadSessions();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to revoke remote session');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2500);
  };

  const formatRemaining = (seconds: number) => {
    if (seconds <= 0) return '00:00 (Expired)';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(11, 31, 58, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '920px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          border: '1px solid #CBD5E1',
          overflow: 'hidden',
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
            borderBottom: '3px solid #F47721',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                backgroundColor: 'rgba(244, 119, 33, 0.2)',
                borderRadius: '8px',
                padding: '0.4rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconLifeBuoy size={22} color="#F47721" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                Remote Troubleshooting &amp; Secure Access Center
              </h2>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94A3B8' }}>
                Consent-Governed &bull; Ephemeral Outbound Reverse Tunnels &bull; Cryptographically Audited
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={loadSessions}
              disabled={isLoading}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '0.4rem',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Refresh session statuses"
            >
              <IconRefresh size={16} />
            </button>
            <button
              onClick={onClose}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '0.4rem',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Close modal"
            >
              <IconClose size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
          {/* Notifications */}
          {errorMsg && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#991B1B',
                borderRadius: '6px',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <IconAlertTriangle size={18} color="#DC2626" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#065F46',
                borderRadius: '6px',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <IconCheckCircle size={18} color="#059669" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ACTIVE LIVE SESSION BANNER (WITH EMERGENCY KILLSWITCH) */}
          {activeSession && (
            <div
              style={{
                backgroundColor: '#FFFBEB',
                border: '2px solid #F59E0B',
                borderRadius: '8px',
                padding: '1.25rem',
                marginBottom: '1.5rem',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  marginBottom: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <span
                      style={{
                        backgroundColor: '#10B981',
                        color: '#FFFFFF',
                        borderRadius: '4px',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        letterSpacing: '0.05em',
                      }}
                    >
                      ● ACTIVE TUNNEL
                    </span>
                    <strong style={{ fontSize: '1.1rem', color: '#0B1F3A' }}>
                      {activeSession.sessionCode}
                    </strong>
                    <span style={{ fontSize: '0.85rem', color: '#64748B' }}>
                      ({activeSession.targetSiteId})
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#334155' }}>
                    <strong>Engineer:</strong> {activeSession.requestedBy} &bull;{' '}
                    <strong>Approved By:</strong> {activeSession.approvedBy} &bull;{' '}
                    <strong>Reason:</strong> {activeSession.reason}
                  </div>
                </div>

                {/* Countdown Timer */}
                <div
                  style={{
                    backgroundColor: '#FEF3C7',
                    border: '1px solid #FCD34D',
                    borderRadius: '8px',
                    padding: '0.5rem 1rem',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.7rem', color: '#92400E', fontWeight: 700, textTransform: 'uppercase' }}>
                    Time Remaining
                  </div>
                  <div
                    style={{
                      fontSize: '1.4rem',
                      fontWeight: 800,
                      color: activeSession.remainingSeconds < 300 ? '#DC2626' : '#B45309',
                      fontFamily: 'monospace',
                    }}
                  >
                    {formatRemaining(activeSession.remainingSeconds)}
                  </div>
                </div>
              </div>

              {/* Ephemeral Tunnel Token Credential */}
              {activeSession.ephemeralToken && (
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    padding: '0.75rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                      <IconKey size={14} color="#F47721" />
                      <span>EPHEMERAL TUNNEL AUTH TOKEN (High-Entropy Single-Use)</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(activeSession.ephemeralToken!)}
                      style={{
                        backgroundColor: copiedToken ? '#10B981' : '#F1F5F9',
                        color: copiedToken ? '#FFFFFF' : '#0B1F3A',
                        border: '1px solid #CBD5E1',
                        borderRadius: '4px',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {copiedToken ? '✓ Copied Token' : 'Copy Token'}
                    </button>
                  </div>
                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      backgroundColor: '#F8FAFC',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '4px',
                      wordBreak: 'break-all',
                      color: '#0F172A',
                      border: '1px dashed #CBD5E1',
                    }}
                  >
                    {activeSession.ephemeralToken}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.35rem' }}>
                    Provide this token to the diagnostic client to authenticate the outbound WSS tunnel to the site gateway.
                  </div>
                </div>
              )}

              {/* Emergency Killswitch Action */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid #FDE68A',
                  paddingTop: '0.75rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#92400E' }}>
                  <strong>Safety Guarantee:</strong> Either party can terminate access instantly.
                </div>
                {isAdmin ? (
                  <button
                    onClick={() => setKillswitchSessionId(activeSession.id)}
                    style={{
                      backgroundColor: '#DC2626',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.5rem 1rem',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      boxShadow: '0 2px 6px rgba(220, 38, 38, 0.4)',
                    }}
                    title="Immediately sever remote tunnel and revoke token"
                  >
                    <IconAlertTriangle size={15} color="#FFFFFF" />
                    <span>EMERGENCY KILLSWITCH: Revoke Immediately</span>
                  </button>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontStyle: 'italic' }}>
                    (Emergency killswitch restricted to Customer Admin)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* KILLSWITCH CONFIRMATION MODAL OVERLAY */}
          {killswitchSessionId !== null && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '2px solid #DC2626',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#991B1B', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <IconAlertTriangle size={18} color="#DC2626" />
                Confirm Emergency Killswitch Revocation
              </h4>
              <p style={{ fontSize: '0.8rem', color: '#7F1D1D', margin: '0 0 0.75rem 0' }}>
                This will immediately close the outbound reverse tunnel, invalidate the ephemeral token in memory and database, and record an audit event.
              </p>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#991B1B', marginBottom: '0.25rem' }}>
                  Revocation Reason:
                </label>
                <input
                  type="text"
                  value={killswitchReason}
                  onChange={(e) => setKillswitchReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '4px',
                    border: '1px solid #F87171',
                    fontSize: '0.85rem',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  onClick={() => setKillswitchSessionId(null)}
                  style={{
                    backgroundColor: '#E2E8F0',
                    border: 'none',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRevoke(killswitchSessionId)}
                  style={{
                    backgroundColor: '#DC2626',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '0.4rem 0.9rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Confirm Emergency Revocation
                </button>
              </div>
            </div>
          )}

          {/* CONSENT APPROVAL QUEUE (PENDING REQUESTS) */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0B1F3A', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <IconShield size={16} color="#F47721" />
                Customer Consent Queue (Pending Approval)
                {pendingSessions.length > 0 && (
                  <span
                    style={{
                      backgroundColor: '#F59E0B',
                      color: '#FFFFFF',
                      borderRadius: '10px',
                      padding: '0.1rem 0.45rem',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                    }}
                  >
                    {pendingSessions.length}
                  </span>
                )}
              </h3>

              {!showRequestForm && canRequest && !activeSession && (
                <button
                  onClick={() => setShowRequestForm(true)}
                  style={{
                    backgroundColor: '#0B1F3A',
                    color: '#FFFFFF',
                    border: '1px solid #1E3A63',
                    borderRadius: '6px',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <span>+ Request Remote Session</span>
                </button>
              )}
            </div>

            {pendingSessions.length === 0 ? (
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px dashed #CBD5E1',
                  borderRadius: '6px',
                  padding: '1rem',
                  textAlign: 'center',
                  fontSize: '0.8rem',
                  color: '#64748B',
                }}
              >
                No pending troubleshooting access requests. The system is operating in complete isolation.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {pendingSessions.map((session) => (
                  <div
                    key={session.id}
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderLeft: '4px solid #F59E0B',
                      borderRadius: '6px',
                      padding: '0.85rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0B1F3A', fontSize: '0.9rem' }}>
                          {session.sessionCode}
                        </span>
                        <span
                          style={{
                            backgroundColor: '#E2E8F0',
                            color: '#334155',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                          }}
                        >
                          {session.targetSiteId}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                          TTL: {session.durationMinutes} mins
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#1E293B' }}>
                        <strong>Requester:</strong> {session.requestedBy} &bull;{' '}
                        <strong>Reason:</strong> {session.reason}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.2rem' }}>
                        Requested: {new Date(session.createdAt).toLocaleString()}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {isAdmin ? (
                        <>
                          <button
                            onClick={() => handleReject(session.id)}
                            style={{
                              backgroundColor: '#FFFFFF',
                              color: '#DC2626',
                              border: '1px solid #FCA5A5',
                              borderRadius: '4px',
                              padding: '0.35rem 0.7rem',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Deny
                          </button>
                          <button
                            onClick={() => handleApprove(session.id)}
                            style={{
                              backgroundColor: '#10B981',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '0.35rem 0.85rem',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                          >
                            <IconCheckCircle size={14} color="#FFFFFF" />
                            <span>Grant Consent (Approve)</span>
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#64748B', fontStyle: 'italic' }}>
                          Awaiting Admin Consent
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* REQUEST FORM MODAL / DRAWER */}
          {showRequestForm && (
            <div
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#0B1F3A' }}>
                  Request New Ephemeral Troubleshooting Session
                </h4>
                <button
                  onClick={() => setShowRequestForm(false)}
                  style={{ backgroundColor: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer' }}
                >
                  <IconClose size={16} />
                </button>
              </div>

              <form onSubmit={handleRequestSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                      Target Site:
                    </label>
                    <select
                      value={targetSiteId}
                      onChange={(e) => setTargetSiteId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '4px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.8rem',
                        backgroundColor: '#FFFFFF',
                      }}
                    >
                      <option value="SITE-HQ-PUNE">SITE-HQ-PUNE (HQ Pune Cleanroom)</option>
                      <option value="SITE-BLR-DEV">SITE-BLR-DEV (Bangalore R&amp;D Wing B)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                      Session Duration (Auto-Expiry TTL):
                    </label>
                    <select
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '4px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.8rem',
                        backgroundColor: '#FFFFFF',
                      }}
                    >
                      <option value={15}>15 Minutes</option>
                      <option value={30}>30 Minutes (Recommended)</option>
                      <option value={45}>45 Minutes</option>
                      <option value={60}>60 Minutes (Max Bound)</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    Diagnostic Justification &amp; Incident Context:
                  </label>
                  <textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Triage persistent tachometer stall alerts and inspect raw BME688 bus registers on Node 007"
                    style={{
                      width: '100%',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '4px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.8rem',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowRequestForm(false)}
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: '4px',
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      backgroundColor: '#F47721',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.35rem 0.9rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* HISTORICAL SESSIONS & AUDIT TRAIL TABLE */}
          <div>
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 800, color: '#0B1F3A' }}>
              Troubleshooting Access Audit History
            </h3>

            <div
              style={{
                border: '1px solid #E2E8F0',
                borderRadius: '6px',
                overflow: 'hidden',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Session Code</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Target Site</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Requester</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Status</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>TTL</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Approved By</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {pastSessions.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '1rem', textAlign: 'center', color: '#94A3B8' }}>
                        No past session history recorded.
                      </td>
                    </tr>
                  ) : (
                    pastSessions.map((s) => {
                      let badgeBg = '#E2E8F0';
                      let badgeColor = '#475569';
                      if (s.status === 'REVOKED') {
                        badgeBg = '#FEE2E2';
                        badgeColor = '#991B1B';
                      } else if (s.status === 'REJECTED') {
                        badgeBg = '#FEF3C7';
                        badgeColor = '#92400E';
                      } else if (s.status === 'EXPIRED') {
                        badgeBg = '#F1F5F9';
                        badgeColor = '#64748B';
                      }

                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', fontWeight: 700 }}>
                            {s.sessionCode}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{s.targetSiteId}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{s.requestedBy}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <span
                              style={{
                                backgroundColor: badgeBg,
                                color: badgeColor,
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                              }}
                            >
                              {s.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{s.durationMinutes}m</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{s.approvedBy || '—'}</td>
                          <td style={{ padding: '0.5rem 0.75rem', color: '#64748B' }}>
                            {new Date(s.createdAt).toLocaleDateString()}{' '}
                            {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer / Architecture Disclaimers */}
        <div
          style={{
            backgroundColor: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            padding: '0.75rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.72rem',
            color: '#64748B',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <IconLock size={14} color="#F47721" />
            <span>
              <strong>Zero Inbound Public Exposure:</strong> Purifiers &amp; site gateways only connect outbound when customer consent is granted.
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#0B1F3A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '0.4rem 0.9rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Close Console
          </button>
        </div>
      </div>
    </div>
  );
};
