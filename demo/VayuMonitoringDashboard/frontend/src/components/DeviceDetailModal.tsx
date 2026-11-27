import React, { useState, useEffect } from 'react';
import { DeviceDetail, DeviceSummary, TelemetryRecord } from '../types/device';
import { AuthUser } from '../types/auth';
import { fetchDevice, fetchDeviceTelemetry, sendDeviceCommand } from '../services/api';
import { TelemetryChart } from './TelemetryChart';
import { IconX, IconSliders, IconAlertTriangle, IconCheckCircle, IconLock } from './Icons';

interface DeviceDetailModalProps {
  device: DeviceSummary;
  currentUser: AuthUser | null;
  onClose: () => void;
  onRefreshParent: () => void;
  onOpenIncidentCenter?: (deviceId: string) => void;
}

export const DeviceDetailModal: React.FC<DeviceDetailModalProps> = ({
  device,
  currentUser,
  onClose,
  onRefreshParent,
  onOpenIncidentCenter,
}) => {
  const [detail, setDetail] = useState<DeviceDetail | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryRecord[]>([]);

  // Command Controls
  const [fanSpeed, setFanSpeed] = useState<number>(device.fanPct ?? 50);
  const [selectedMode, setSelectedMode] = useState<string>(device.mode ?? 'AUTO');
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);
  const [isSendingCmd, setIsSendingCmd] = useState(false);

  // Authorization checks
  const isKiosk = currentUser?.role === 'ROLE_KIOSK';
  const isSiteRestricted =
    currentUser?.role === 'ROLE_SERVICE_TECH' &&
    currentUser.siteScope !== '*' &&
    currentUser.siteScope !== device.siteId;
  const controlsDisabled = isKiosk || isSiteRestricted;

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 4000);
    return () => clearInterval(timer);
  }, [device.deviceId]);

  const loadData = async () => {
    try {
      const [devDetail, telemHistory] = await Promise.all([
        fetchDevice(device.deviceId),
        fetchDeviceTelemetry(device.deviceId, 40),
      ]);
      setDetail(devDetail);
      setTelemetry(telemHistory);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendFan = async () => {
    if (controlsDisabled) return;
    setIsSendingCmd(true);
    setCommandFeedback(null);
    try {
      await sendDeviceCommand(device.deviceId, {
        command: 'SET_FAN',
        fanPct: fanSpeed,
      });
      setCommandFeedback(`Dispatched SET_FAN: ${fanSpeed}% duty cycle. (Logged in Audit Trail)`);
      setTimeout(() => {
        loadData();
        onRefreshParent();
      }, 1000);
    } catch (e) {
      setCommandFeedback(`Command failed: ${e instanceof Error ? e.message : 'Unknown'}`);
    } finally {
      setIsSendingCmd(false);
    }
  };

  const handleSendMode = async (mode: string) => {
    if (controlsDisabled) return;
    setIsSendingCmd(true);
    setCommandFeedback(null);
    try {
      await sendDeviceCommand(device.deviceId, {
        command: 'SET_MODE',
        mode: mode,
      });
      setSelectedMode(mode);
      setCommandFeedback(`Dispatched SET_MODE: ${mode}. (Logged in Audit Trail)`);
      setTimeout(() => {
        loadData();
        onRefreshParent();
      }, 1000);
    } catch (e) {
      setCommandFeedback(`Command failed: ${e instanceof Error ? e.message : 'Unknown'}`);
    } finally {
      setIsSendingCmd(false);
    }
  };

  const handleResetFilter = async () => {
    if (controlsDisabled) return;
    if (!window.confirm('Reset HEPA filter lifespan counter to 4320 hours?')) return;
    setIsSendingCmd(true);
    try {
      await sendDeviceCommand(device.deviceId, { command: 'FILTER_RESET' });
      setCommandFeedback('Dispatched FILTER_RESET (4320 hours). (Logged in Audit Trail)');
      setTimeout(() => {
        loadData();
        onRefreshParent();
      }, 1000);
    } catch (e) {
      setCommandFeedback(`Filter reset failed: ${e instanceof Error ? e.message : 'Unknown'}`);
    } finally {
      setIsSendingCmd(false);
    }
  };

  const latest = telemetry.length > 0 ? telemetry[0] : null;
  const err = latest ? latest.errCode : device.errCode ?? 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(11, 31, 58, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 50,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '750px',
          height: '100%',
          backgroundColor: '#FFFFFF',
          boxShadow: '-4px 0 25px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: '#0B1F3A',
            color: '#FFFFFF',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2px solid #F47721',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
                {device.deviceId}
              </h2>
              <span
                style={{
                  backgroundColor: device.onlineStatus === 'ONLINE' ? '#10B981' : '#64748B',
                  color: '#FFFFFF',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                }}
              >
                {device.onlineStatus}
              </span>
              <span
                style={{
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {device.siteId}
              </span>
            </div>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94A3B8' }}>
              {detail?.model || 'VAYU-AirPurifier-Pro'} | Hardware {detail?.hardwareRev || 'REV-A'} | Firmware {detail?.currentFwVersion || 'v1.0.0-rc1'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '4px',
            }}
          >
            <IconX size={22} />
          </button>
        </div>

        {/* Content Container */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Quick Metrics Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '0.75rem',
              backgroundColor: '#F8F9FA',
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
            }}
          >
            <div>
              <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>CURRENT AQI</span>
              <p style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0.2rem 0 0', color: '#0B1F3A' }}>
                {latest?.aqi ?? '--'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>PM2.5 DENSITY</span>
              <p style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0.2rem 0 0', color: latest?.pm25 === null ? '#EF4444' : '#0B1F3A' }}>
                {latest?.pm25 !== null && latest?.pm25 !== undefined ? `${latest.pm25} µg/m³` : 'FAULT'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>TEMP / HUMIDITY</span>
              <p style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0.4rem 0 0', color: latest?.tempC === null ? '#EF4444' : '#0B1F3A' }}>
                {latest?.tempC !== null && latest?.tempC !== undefined ? `${latest.tempC}°C` : 'FAULT'} / {latest?.rh !== null && latest?.rh !== undefined ? `${latest.rh}%` : 'FAULT'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>FAN SPEED</span>
              <p style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0.2rem 0 0', color: '#F47721' }}>
                {latest?.fanPct ?? '--'}%
              </p>
            </div>
          </div>

          {/* Device Hardware Identity & Network */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              padding: '1rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '1rem',
            }}
          >
            <div>
              <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>IP ADDRESS</span>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                {detail?.ipAddress || '--'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>MAC ADDRESS</span>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                {detail?.macAddress || '--'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>FILTER HOURS LEFT</span>
              <p style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#0B1F3A' }}>
                {latest ? `${latest.filterHoursLeft} hrs` : '--'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>WI-FI SIGNAL</span>
              <p style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: latest && latest.rssi && latest.rssi < -80 ? '#F59E0B' : '#0B1F3A' }}>
                {latest?.rssi !== null ? `${latest?.rssi} dBm` : '--'}
              </p>
            </div>
          </div>

          {/* Fault & Safety Diagnostics */}
          <div
            style={{
              backgroundColor: err !== 0 ? '#FEF2F2' : '#F0FDF4',
              border: `1px solid ${err !== 0 ? '#FECACA' : '#BBF7D0'}`,
              borderRadius: '8px',
              padding: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              {err !== 0 ? (
                <IconAlertTriangle size={18} color="#EF4444" />
              ) : (
                <IconCheckCircle size={18} color="#10B981" />
              )}
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: err !== 0 ? '#991B1B' : '#166534' }}>
                Hardware Diagnostic Bitmask: {err === 0 ? '0x00 (Normal Operation)' : `0x${err.toString(16).toUpperCase()}`}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: err !== 0 ? '#7F1D1D' : '#14532D', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <span>Fan Stall: <strong>{(err & 0x01) ? 'ALERT: 0 RPM STALL' : 'PASS'}</strong></span>
                <span>PM Sensor: <strong>{(err & 0x02) ? 'ALERT: COMM FAULT' : 'PASS'}</strong></span>
                <span>Temp/RH Sensor: <strong>{(err & 0x04) ? 'ALERT: BUS TIMEOUT' : 'PASS'}</strong></span>
                <span>Brownout Reset: <strong>{(err & 0x10) ? 'ALERT: WDT CRASH' : 'PASS'}</strong></span>
              </div>
              {onOpenIncidentCenter && (
                <button
                  onClick={() => onOpenIncidentCenter(device.deviceId)}
                  style={{
                    backgroundColor: err !== 0 ? '#DC2626' : '#162C4E',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.3rem 0.65rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <IconAlertTriangle size={13} color="#FFFFFF" />
                  <span>{err !== 0 ? 'Triage Incident Ticket' : 'View Incident History'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Time-Series Charts */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0B1F3A', marginBottom: '0.75rem' }}>
              Real-Time Telemetry Trends (Last 40 Points)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <TelemetryChart
                data={telemetry}
                metricKey="pm25"
                title="Particulate Matter PM2.5 (µg/m³)"
                strokeColor="#EF4444"
                unit=" µg/m³"
              />
              <TelemetryChart
                data={telemetry}
                metricKey="aqi"
                title="Air Quality Index (US-EPA Standard)"
                strokeColor="#8B5CF6"
                unit=""
              />
              <TelemetryChart
                data={telemetry}
                metricKey="tempC"
                title="Chamber Temperature (°C)"
                strokeColor="#F59E0B"
                unit="°C"
              />
              <TelemetryChart
                data={telemetry}
                metricKey="fanPct"
                title="Fan PWM Duty Cycle (%)"
                strokeColor="#3B82F6"
                unit="%"
              />
            </div>
          </div>

          {/* Actuator Controls (Secured with RBAC & Site Barrier) */}
          <div
            style={{
              backgroundColor: '#F8F9FA',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <IconSliders size={18} color="#0B1F3A" />
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0B1F3A', margin: 0 }}>
                Actuator &amp; Mode Remote Control
              </h3>
            </div>

            {/* Role & Site Barriers Notification */}
            {isKiosk && (
              <div
                style={{
                  backgroundColor: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  padding: '0.65rem 0.9rem',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  color: '#475569',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <IconLock size={16} color="#64748B" />
                <span>
                  <strong>Read-Only Terminal:</strong> Kiosk displays have read-only access and cannot issue device commands.
                </span>
              </div>
            )}

            {isSiteRestricted && (
              <div
                style={{
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  padding: '0.65rem 0.9rem',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  color: '#991B1B',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <IconLock size={16} color="#EF4444" />
                <span>
                  <strong>Site Authorization Denied:</strong> Your technician persona is restricted to{' '}
                  <strong>{currentUser?.siteScope}</strong>. You cannot command devices deployed at{' '}
                  <strong>{device.siteId}</strong>.
                </span>
              </div>
            )}

            {/* Fan PWM Speed Slider */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                  Target Fan Duty Cycle:
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#F47721', fontFamily: 'var(--font-mono)' }}>
                  {fanSpeed}%
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={fanSpeed}
                  disabled={controlsDisabled || isSendingCmd}
                  onChange={(e) => setFanSpeed(Number(e.target.value))}
                  style={{
                    flex: 1,
                    accentColor: '#F47721',
                    cursor: controlsDisabled ? 'not-allowed' : 'pointer',
                    opacity: controlsDisabled ? 0.5 : 1,
                  }}
                />
                <button
                  onClick={handleSendFan}
                  disabled={controlsDisabled || isSendingCmd}
                  className="btn-primary"
                  style={{
                    padding: '0.4rem 0.9rem',
                    fontSize: '0.85rem',
                    opacity: controlsDisabled ? 0.5 : 1,
                    cursor: controlsDisabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  Apply Speed
                </button>
              </div>
            </div>

            {/* Mode Selection */}
            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
                Operating Mode:
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['AUTO', 'MANUAL', 'NIGHT', 'TURBO', 'OFF'].map((m) => (
                  <button
                    key={m}
                    onClick={() => handleSendMode(m)}
                    disabled={controlsDisabled || isSendingCmd}
                    style={{
                      padding: '0.35rem 0.85rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      backgroundColor: selectedMode === m ? '#0B1F3A' : '#F1F5F9',
                      color: selectedMode === m ? '#FFFFFF' : '#334155',
                      border: '1px solid #CBD5E1',
                      opacity: controlsDisabled ? 0.5 : 1,
                      cursor: controlsDisabled ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Maintenance Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid #F1F5F9', paddingTop: '1rem' }}>
              <button
                onClick={handleResetFilter}
                disabled={controlsDisabled || isSendingCmd}
                className="btn-secondary"
                style={{
                  fontSize: '0.8rem',
                  padding: '0.4rem 0.8rem',
                  opacity: controlsDisabled ? 0.5 : 1,
                  cursor: controlsDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                Reset Filter Life
              </button>
            </div>

            {/* Feedback Message */}
            {commandFeedback && (
              <div
                style={{
                  marginTop: '0.85rem',
                  padding: '0.55rem 0.85rem',
                  borderRadius: '6px',
                  backgroundColor: commandFeedback.includes('failed') ? '#FEF2F2' : '#EFF6FF',
                  color: commandFeedback.includes('failed') ? '#B91C1C' : '#1D4ED8',
                  fontSize: '0.8rem',
                }}
              >
                {commandFeedback}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
