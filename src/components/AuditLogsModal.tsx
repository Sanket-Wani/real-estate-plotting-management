import React, { useEffect, useState } from 'react';
import { AuditLog } from '../types';
import { ShieldCheck, X, Clock, FileText, ArrowRight } from 'lucide-react';

interface AuditLogsModalProps {
  onClose: () => void;
}

export const AuditLogsModal: React.FC<AuditLogsModalProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetch('/api/audit-logs')
      .then(res => res.json())
      .then(data => {
        setLogs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setLogs([]);
        setLoading(false);
      });
  }, []);

  const getStatusBadge = (status: string) => {
    if (status === 'UNBOOKED') return <span className="badge badge-unbooked">UNBOOKED</span>;
    if (status === 'BOOKED_UNREGISTERED') return <span className="badge badge-booked-unreg">BOOKED (UNREG)</span>;
    if (status === 'BOOKED_REGISTERED') return <span className="badge badge-booked-reg">BOOKED (REG)</span>;
    return <span className="badge badge-review">{status}</span>;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(23, 23, 23, 0.45)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100
    }}>
      <div style={{
        width: '680px',
        maxHeight: '82vh',
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-xl)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }} className="animate-fade-in">
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--bg-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FileText size={18} color="var(--dark-primary)" />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                Persistent Plot Audit Logs & Governance History
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Immutable Ledger • Stored in `data/audit_log.json`
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: 'var(--bg-primary)' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Loading audit logs...
            </div>
          ) : logs.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px 24px',
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)'
            }}>
              <ShieldCheck size={32} style={{ margin: '0 auto 12px auto', color: 'var(--status-unbooked)' }} />
              <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px', fontSize: '14px' }}>
                No Governance Modifications Yet
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Edit a plot status or commercial price in the right panel to record persistent audit entries.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {logs.slice().reverse().map(log => (
                <div
                  key={log.id}
                  style={{
                    background: '#ffffff',
                    padding: '14px 18px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: 'var(--shadow-xs)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                        Plot #{log.plotNumber}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        background: 'var(--bg-subtle)',
                        color: 'var(--text-muted)',
                        borderRadius: '4px',
                        border: '1px solid var(--border-color)',
                        letterSpacing: '0.04em'
                      }}>
                        {log.action}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span>Changed from</span>
                      {getStatusBadge(log.previousStatus)}
                      <ArrowRight size={12} color="var(--text-dim)" />
                      {getStatusBadge(log.newStatus)}
                      <span>by <strong style={{ color: 'var(--text-main)' }}>{log.user}</strong></span>
                    </div>
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'var(--bg-subtle)',
                    padding: '4px 8px',
                    borderRadius: '6px'
                  }}>
                    <Clock size={12} />
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
