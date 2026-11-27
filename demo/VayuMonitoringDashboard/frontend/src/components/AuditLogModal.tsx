import React, { useState, useEffect } from 'react';
import { AuditLogEntry } from '../types/auth';
import { fetchAuditLogs } from '../services/api';
import { IconShield, IconRefresh, IconClose, IconCheckCircle, IconAlertTriangle } from './Icons';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAuditLogs();
      setLogs(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getActionBadgeClass = (action: string) => {
    if (action.includes('DENIED') || action.includes('FAILED')) {
      return 'bg-red-500/20 text-red-400 border border-red-500/30';
    }
    if (action.includes('COMMAND') || action.includes('DISPATCH')) {
      return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
    }
    return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0f172a] border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#0B1F3A] border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-[#F47721] flex items-center justify-center border border-orange-500/30">
              <IconShield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                System Security & Command Audit Trail
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  {logs.length} events
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Immutable chronological log of authentication, site-level authorization barriers, and remote command executions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadLogs}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <IconRefresh className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <IconClose className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-sm flex items-center gap-3">
              <IconAlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div>
                <p className="font-semibold">Security Access Restriction</p>
                <p className="text-xs text-red-300/80">{error}</p>
              </div>
            </div>
          )}

          {loading && logs.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <div className="w-8 h-8 border-2 border-[#F47721] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm">Querying immutable audit logs from PostgreSQL...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <IconShield className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm">No audit log entries recorded yet.</p>
            </div>
          ) : (
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#1e293b]/70 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-700/60">
                  <tr>
                    <th className="py-3 px-4">Timestamp (UTC)</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Target Resource</th>
                    <th className="py-3 px-4">Execution Details / Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {logs.map((entry) => {
                    let formattedPayload = null;
                    if (entry.payload) {
                      try {
                        const parsed = typeof entry.payload === 'string' ? JSON.parse(entry.payload) : entry.payload;
                        formattedPayload = JSON.stringify(parsed, null, 1).replace(/[\{\}"]/g, '').trim();
                      } catch {
                        formattedPayload = entry.payload;
                      }
                    }

                    return (
                      <tr key={entry.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                          {new Date(entry.createdAt).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          <span className="text-[10px] text-slate-500 block">
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-white whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px]">
                            {entry.actor}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold tracking-wide ${getActionBadgeClass(entry.action)}`}>
                            {entry.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-300 font-mono">
                          <span className="text-slate-500">{entry.resourceType}:</span>
                          <span className="text-orange-400 font-semibold ml-1">{entry.resourceId}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                          {formattedPayload ? (
                            <span className="bg-black/30 px-2 py-0.5 rounded border border-slate-800 inline-block max-w-md truncate">
                              {formattedPayload}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-[#0B1F3A]/70 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <IconCheckCircle className="w-4 h-4 text-emerald-400" />
            <span>Audit events cryptographically bound and timestamped on PostgreSQL 16</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
