import React, { useState, useEffect } from 'react';
import { PlotData, CADLayers, InfrastructureData, PlotStatus, CustomerInfo } from './types';
import { Header } from './components/Header';
import { GeometryAuditView } from './components/GeometryAuditView';
import { ManualCorrectionModal } from './components/ManualCorrectionModal';
import { AuditLogsModal } from './components/AuditLogsModal';

export const App: React.FC = () => {
  const [plots, setPlots] = useState<PlotData[]>([]);
  const [cadLayers, setCadLayers] = useState<CADLayers | null>(null);
  const [infrastructure, setInfrastructure] = useState<InfrastructureData | null>(null);
  const [selectedPlot, setSelectedPlot] = useState<PlotData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [canvasMode, setCanvasMode] = useState<'light' | 'dark'>('light');

  // Modals state
  const [correctionTarget, setCorrectionTarget] = useState<{ plot: PlotData; mode: 'SPLIT_BLOCK' | 'EDIT_BOUNDARY' } | null>(null);
  const [showAuditLogs, setShowAuditLogs] = useState<boolean>(false);

  // Fetch initial data
  useEffect(() => {
    Promise.all([
      fetch('/api/plots').then(res => res.json()),
      fetch('/data/cad_layers.json').then(res => res.json()),
      fetch('/data/infrastructure.json').then(res => res.json()),
    ])
      .then(([plotsData, cadData, infraData]) => {
        setPlots(plotsData);
        setCadLayers(cadData);
        setInfrastructure(infraData);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load prototype data:', err);
        setLoading(false);
      });
  }, []);

  // Save Status to backend API (persistent storage)
  const handleSaveStatus = async (
    plotNumber: number,
    newStatus: PlotStatus,
    customer: CustomerInfo | null,
    baseRate: number
  ) => {
    const res = await fetch(`/api/plots/${plotNumber}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: newStatus,
        customer,
        baseRatePerSqm: baseRate,
        updatedBy: 'Audit Officer (Antigravity)'
      })
    });

    if (res.ok) {
      const data = await res.json();
      setPlots(prev => prev.map(p => p.plotNumber === plotNumber ? data.plot : p));
      if (selectedPlot?.plotNumber === plotNumber) {
        setSelectedPlot(data.plot);
      }
    }
  };

  // Save Manual Correction
  const handleSaveCorrection = async (
    plotNumber: number,
    correctionType: string,
    notes: string,
    coordinates: [number, number][]
  ) => {
    await fetch(`/api/plots/${plotNumber}/manual-correction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        correctionType,
        notes,
        coordinates
      })
    });
  };

  // Export CSV Action
  const handleExportCsv = () => {
    const link = document.createElement('a');
    link.href = '/data/reconciliation.json';
    link.download = 'master_plot_reconciliation.json';
    link.click();
  };

  // Calculated Stats
  const validatedCount = plots.filter(p => p.extractionStatus === 'INDIVIDUALLY_RECONSTRUCTED_VALIDATED').length;
  const compoundCount = plots.filter(p => p.extractionStatus === 'COMPOUND_BLOCK_REQUIRING_SUBDIVISION').length;
  const incompleteCount = plots.filter(p => p.extractionStatus === 'INCOMPLETE_BOUNDARY').length;

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        background: '#fafafa',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#171717',
        gap: '16px'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          border: '3px solid rgba(23, 23, 23, 0.12)',
          borderTopColor: '#171717',
          borderRadius: '50%',
          animation: 'spin 0.75s linear infinite'
        }} />
        <div style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '-0.01em', color: '#171717' }}>
          Loading Vishal Chugera Properties CAD Geometry & Master Inventory...
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Top Application Header */}
      <Header
        totalPlots={plots.length}
        validatedCount={validatedCount}
        compoundCount={compoundCount}
        incompleteCount={incompleteCount}
        onExportCsv={handleExportCsv}
        onOpenAuditLogs={() => setShowAuditLogs(true)}
        canvasMode={canvasMode}
        onToggleCanvasMode={() => setCanvasMode(prev => prev === 'light' ? 'dark' : 'light')}
      />

      {/* Main View Area: 2D Geometry Audit & Review with Left Plot Details */}
      <div style={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden' }}>
        <GeometryAuditView
          plots={plots}
          cadLayers={cadLayers}
          infrastructure={infrastructure}
          selectedPlot={selectedPlot}
          canvasMode={canvasMode}
          onSelectPlot={setSelectedPlot}
          onOpenManualCorrection={(plot) => setCorrectionTarget({ plot, mode: 'EDIT_BOUNDARY' })}
          onOpenBlockSplitter={(plot) => setCorrectionTarget({ plot, mode: 'SPLIT_BLOCK' })}
          onExportCsv={handleExportCsv}
          onSaveStatus={handleSaveStatus}
        />
      </div>

      {/* Modals */}
      {correctionTarget && (
        <ManualCorrectionModal
          plot={correctionTarget.plot}
          mode={correctionTarget.mode}
          onClose={() => setCorrectionTarget(null)}
          onSaveCorrection={handleSaveCorrection}
        />
      )}

      {showAuditLogs && (
        <AuditLogsModal onClose={() => setShowAuditLogs(false)} />
      )}
    </div>
  );
};
export default App;
