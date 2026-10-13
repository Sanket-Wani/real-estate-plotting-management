import React, { useEffect, useState } from 'react';
import { AuditLog } from '../types';
import { ShieldCheck, X, Clock, FileText } from 'lucide-react';

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

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100
    }}>
      <div style={{
        width: '650px',
        maxHeight: '80vh',
        background: 'var(--bg-secondary)',
        borderRadius: '14px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-lg)',
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
          background: 'rgba(30, 41, 59, 0.5)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={20} color="#06b6d4" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
              Persistent Plot Audit Logs & Governance History
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Loading audit logs...
            </div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              No status changes recorded yet. Edit a plot status to see audit entries appear here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {logs.slice().reverse().map(log => (
                <div
                  key={log.id}
                  style={{
                    background: 'var(--bg-card)',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                        Plot #{log.plotNumber}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        background: 'rgba(6, 182, 212, 0.2)',
                        color: '#38bdf8',
                        borderRadius: '4px'
                      }}>
                        {log.action}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Changed from <strong style={{ color: '#fbbf24' }}>{log.previousStatus}</strong> to <strong style={{ color: '#34d399' }}>{log.newStatus}</strong> by {log.user}
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} />
                    {new Date(log.timestamp).toLocaleTimeString()}
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
