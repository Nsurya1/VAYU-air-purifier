import React from 'react';
import { DeviceListItem } from '../types/device';
import { X, CheckCircle2, AlertOctagon, ShieldCheck } from 'lucide-react';

interface DeviceDetailModalProps {
  device: DeviceListItem | null;
  onClose: () => void;
}

export const DeviceDetailModal: React.FC<DeviceDetailModalProps> = ({ device, onClose }) => {
  if (!device) return null;

  const m = device.metrics;
  const d = device.diagnostics;
  const s = device.system;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(11, 31, 58, 0.65)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 100,
      padding: '1.5rem'
    }}>
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '10px',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Modal Header */}
        <div style={{
          backgroundColor: 'var(--color-navy)',
          color: '#FFFFFF',
          padding: '1.25rem 1.5rem',
          borderBottom: '3px solid var(--color-orange)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                {device.device_id}
              </h2>
              {device.is_simulated && (
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  backgroundColor: 'var(--color-orange)',
                  color: '#FFFFFF',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}>
                  SIMULATED DEVICE
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.825rem', color: '#CBD5E1', margin: '3px 0 0 0' }}>
              Location: <strong>{device.room || 'Unassigned'}</strong> &bull; Status: <strong>{device.health_state}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#FFFFFF',
              borderRadius: '6px',
              padding: '0.4rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Active Problems / Diagnosis */}
          {device.problems && device.problems.length > 0 ? (
            <div style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '8px',
              padding: '1rem',
              color: '#991B1B'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                <AlertOctagon size={18} color="#DC2626" />
                <span>Detected Diagnostics & Faults:</span>
              </div>
              <ul style={{ paddingLeft: '1.5rem', fontSize: '0.85rem', lineHeight: 1.5 }}>
                {device.problems.map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div style={{
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              color: '#065F46',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              fontWeight: 600
            }}>
              <CheckCircle2 size={18} color="#059669" />
              <span>All telemetry sensors, operating modes, and connection metrics are normal.</span>
            </div>
          )}

          {/* Sensor Health Verification Table */}
          <div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#475569', marginBottom: '0.65rem' }}>
              Subsystem & Sensor Diagnostics
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem'
            }}>
              <div style={{
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '0.75rem',
                backgroundColor: '#F8FAFC'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>PM Laser Sensor</div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontWeight: 700,
                  color: d?.pm_sensor_valid ? '#059669' : '#DC2626',
                  marginTop: '0.25rem'
                }}>
                  {d?.pm_sensor_valid ? <CheckCircle2 size={15} /> : <AlertOctagon size={15} />}
                  <span>{d?.pm_sensor_valid ? 'OPERATIONAL' : 'INVALID / FAULT'}</span>
                </div>
              </div>

              <div style={{
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '0.75rem',
                backgroundColor: '#F8FAFC'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Temperature / RH</div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontWeight: 700,
                  color: d?.temperature_sensor_valid ? '#059669' : '#DC2626',
                  marginTop: '0.25rem'
                }}>
                  {d?.temperature_sensor_valid ? <CheckCircle2 size={15} /> : <AlertOctagon size={15} />}
                  <span>{d?.temperature_sensor_valid ? 'OPERATIONAL' : 'INVALID / FAULT'}</span>
                </div>
              </div>

              <div style={{
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '0.75rem',
                backgroundColor: '#F8FAFC'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>VOC / Gas Sensor</div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontWeight: 700,
                  color: d?.voc_sensor_valid ? '#059669' : '#DC2626',
                  marginTop: '0.25rem'
                }}>
                  {d?.voc_sensor_valid ? <CheckCircle2 size={15} /> : <AlertOctagon size={15} />}
                  <span>{d?.voc_sensor_valid ? 'OPERATIONAL' : 'INVALID / FAULT'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Metric Details Grid */}
          <div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#475569', marginBottom: '0.65rem' }}>
              Current Validated Readings
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.75rem',
              backgroundColor: '#F8FAFC',
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid var(--color-border)'
            }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748B' }}>PM2.5 (Fine Particles)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-navy)' }}>
                  {m?.pm25 !== null && m?.pm25 !== undefined ? `${m.pm25} µg/m³` : '—'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748B' }}>PM10 (Coarse Dust)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-navy)' }}>
                  {m?.pm10 !== null && m?.pm10 !== undefined ? `${m.pm10} µg/m³` : '—'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748B' }}>PM1.0 (Ultra-Fine)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-navy)' }}>
                  {m?.pm1 !== null && m?.pm1 !== undefined ? `${m.pm1} µg/m³` : '—'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748B' }}>VOC Index</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-navy)' }}>
                  {m?.voc_index !== null && m?.voc_index !== undefined ? `${m.voc_index}` : '—'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Temperature</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-navy)' }}>
                  {m?.temperature_c !== null && m?.temperature_c !== undefined ? `${m.temperature_c} °C` : '—'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Relative Humidity</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-navy)' }}>
                  {m?.humidity_rh !== null && m?.humidity_rh !== undefined ? `${m.humidity_rh} %` : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* System & Hardware Controller State */}
          <div style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '1rem',
            fontSize: '0.8rem',
            color: '#475569',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem'
          }}>
            <div>
              <span style={{ color: '#94A3B8' }}>Firmware Version: </span>
              <strong>{s?.firmware_version || '1.0.0'}</strong>
            </div>
            <div>
              <span style={{ color: '#94A3B8' }}>Operating Mode: </span>
              <strong>{s?.operating_mode || 'AUTO'}</strong>
            </div>
            <div>
              <span style={{ color: '#94A3B8' }}>Hardware Error Code: </span>
              <strong>{s?.error_code ?? 0}</strong>
            </div>
            <div>
              <span style={{ color: '#94A3B8' }}>Last Telemetry Time: </span>
              <strong>{device.last_seen_at ? new Date(device.last_seen_at).toLocaleTimeString() : 'None'}</strong>
            </div>
          </div>

          {/* Fail-Safe Boundary Guarantee Notice */}
          <div style={{
            backgroundColor: '#F1F5F9',
            borderRadius: '6px',
            padding: '0.75rem',
            fontSize: '0.725rem',
            color: '#475569',
            lineHeight: 1.4,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <ShieldCheck size={16} color="var(--color-navy)" style={{ flexShrink: 0 }} />
            <span>
              <strong>Autonomous Safety Guarantee:</strong> The purifier embedded controller maintains independent local safety functions. If this monitoring station shuts down or network drops, air purification continues unaffected.
            </span>
          </div>

        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'flex-end',
          backgroundColor: '#F8FAFC'
        }}>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'var(--color-navy)',
              color: '#FFFFFF',
              border: 'none',
              padding: '0.5rem 1.25rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Close Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
};
