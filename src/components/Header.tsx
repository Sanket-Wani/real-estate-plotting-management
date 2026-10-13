import React from 'react';
import { Layers, Download, ShieldCheck, AlertTriangle, FileText } from 'lucide-react';

interface HeaderProps {
  totalPlots: number;
  validatedCount: number;
  compoundCount: number;
  incompleteCount: number;
  onExportCsv: () => void;
  onOpenAuditLogs: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  totalPlots,
  validatedCount,
  compoundCount,
  incompleteCount,
  onExportCsv,
  onOpenAuditLogs,
}) => {
  return (
    <header style={{
      height: '64px',
      background: 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      zIndex: 50,
      flexShrink: 0,
    }}>
      {/* Left: Branding & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #06b6d4, #6366f1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 10px rgba(6, 182, 212, 0.4)',
        }}>
          <Layers size={22} color="#ffffff" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: '#f8fafc' }}>
              KESNAND TOWNSHIP
            </h1>
            <span style={{
              fontSize: '10px',
              padding: '2px 6px',
              background: 'rgba(6, 182, 212, 0.2)',
              color: '#38bdf8',
              borderRadius: '4px',
              fontWeight: 600,
              border: '1px solid rgba(6, 182, 212, 0.4)'
            }}>
              AUDIT SUITE V1
            </span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Tal. Haveli, Dist. Pune • CAD SUB-KESNAND-13.11.2025
          </p>
        </div>
      </div>

      {/* Center: Active Module Badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'var(--bg-primary)',
        padding: '6px 16px',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        color: '#38bdf8',
        fontSize: '13px',
        fontWeight: 600,
        boxShadow: 'var(--shadow-sm)'
      }}>
        <Layers size={16} />
        2D Geometric Audit & Review Platform
      </div>

      {/* Right: Quick KPI badges & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="badge badge-unbooked" title="Individually Reconstructed & Validated">
            <ShieldCheck size={12} />
            {validatedCount} Validated
          </div>
          <div className="badge badge-compound" title="Compound Blocks Requiring Subdivision">
            <AlertTriangle size={12} />
            {compoundCount} In Blocks
          </div>
          <div className="badge badge-incomplete" title="Incomplete Perimeter Boundaries">
            {incompleteCount} Incomplete
          </div>
        </div>

        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />

        <button
          className="btn btn-secondary"
          onClick={onExportCsv}
          style={{ padding: '6px 12px', fontSize: '12px' }}
          title="Export 523 Plot Reconciliation Table (CSV)"
        >
          <Download size={14} />
          Export CSV
        </button>

        <button
          className="btn btn-secondary"
          onClick={onOpenAuditLogs}
          style={{ padding: '6px 12px', fontSize: '12px' }}
          title="View Persistent Audit Logs"
        >
          <FileText size={14} />
          Audit Logs
        </button>
      </div>
    </header>
  );
};
