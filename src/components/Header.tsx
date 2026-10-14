import React from 'react';
import { Layers, Download, ShieldCheck, AlertTriangle, FileText, Sun, Moon } from 'lucide-react';

interface HeaderProps {
  totalPlots: number;
  validatedCount: number;
  compoundCount: number;
  incompleteCount: number;
  onExportCsv: () => void;
  onOpenAuditLogs: () => void;
  canvasMode: 'light' | 'dark';
  onToggleCanvasMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  totalPlots,
  validatedCount,
  compoundCount,
  incompleteCount,
  onExportCsv,
  onOpenAuditLogs,
  canvasMode,
  onToggleCanvasMode,
}) => {
  return (
    <header style={{
      height: '64px',
      background: '#ffffff',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      zIndex: 40,
      flexShrink: 0,
      position: 'relative',
      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.02)',
    }}>
      {/* Left: Brand Icon + Title (DESIGN_SYSTEM.md §3A) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '8px',
          background: 'var(--dark-primary)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: '15px',
          letterSpacing: '-0.03em',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        }}>
          VC
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
              VISHAL CHUGERA PROPERTIES
            </span>
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'var(--bg-subtle)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-color)',
              letterSpacing: '0.04em'
            }}>
              AUDIT SUITE
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', lineHeight: 1.2 }}>
            Tal. Haveli, Dist. Pune • CAD Geometry & Inventory Audit ({totalPlots} Total Plots)
          </span>
        </div>
      </div>

      {/* Center: Module Status Indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'var(--bg-subtle)',
        padding: '6px 14px',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        color: 'var(--text-main)',
        fontSize: '12px',
        fontWeight: 600,
      }}>
        <Layers size={14} style={{ color: 'var(--dark-primary)' }} />
        <span>2D Geometric Audit & Inventory Governance</span>
      </div>

      {/* Right: KPI Chips, Theme Toggle, & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <div className="badge badge-unbooked" title="Individually Reconstructed & Validated">
            <ShieldCheck size={12} />
            {validatedCount} Validated
          </div>
          <div className="badge badge-compound" title="Compound Blocks Requiring Subdivision">
            <AlertTriangle size={12} />
            {compoundCount} In Blocks
          </div>
          <div className="badge badge-incomplete" title="Incomplete Perimeter Boundaries">
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--status-incomplete)' }}></span>
            {incompleteCount} Incomplete
          </div>
        </div>

        <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 2px' }} />

        {/* Canvas Mode Toggle: Dual Canvas Mode */}
        <button
          className="btn btn-secondary"
          onClick={onToggleCanvasMode}
          style={{ padding: '6px 10px', fontSize: '11px' }}
          title={canvasMode === 'light' ? 'Switch Canvas to Dark CAD Drafting Mode' : 'Switch Canvas to Light Blueprint Mode'}
        >
          {canvasMode === 'light' ? <Moon size={13} /> : <Sun size={13} />}
          <span>{canvasMode === 'light' ? 'Dark Canvas' : 'Light Canvas'}</span>
        </button>

        <button
          className="btn btn-secondary"
          onClick={onExportCsv}
          style={{ padding: '6px 12px', fontSize: '12px' }}
          title="Export 523 Plot Reconciliation Table (CSV)"
        >
          <Download size={13} />
          Export CSV
        </button>

        <button
          className="btn btn-primary"
          onClick={onOpenAuditLogs}
          style={{ padding: '6px 12px', fontSize: '12px' }}
          title="View Persistent Audit Logs"
        >
          <FileText size={13} />
          Audit Logs
        </button>
      </div>
    </header>
  );
};
