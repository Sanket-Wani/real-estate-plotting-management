import React, { useState } from 'react';
import { PlotData } from '../types';
import { SplitSquareVertical, Edit3, X, Save, AlertCircle, CheckCircle } from 'lucide-react';

interface ManualCorrectionModalProps {
  plot: PlotData;
  mode: 'SPLIT_BLOCK' | 'EDIT_BOUNDARY';
  onClose: () => void;
  onSaveCorrection: (plotNumber: number, correctionType: string, notes: string, coordinates: [number, number][]) => Promise<void>;
}

export const ManualCorrectionModal: React.FC<ManualCorrectionModalProps> = ({
  plot,
  mode,
  onClose,
  onSaveCorrection
}) => {
  const [numSubPlots, setNumSubPlots] = useState<number>(mode === 'SPLIT_BLOCK' ? 10 : 1);
  const [notes, setNotes] = useState<string>(
    mode === 'SPLIT_BLOCK' 
      ? `Subdividing Block #${plot.plotNumber} (${plot.calculatedArea?.toFixed(1)} m²) into individual residential plots.` 
      : `Manual boundary refinement for Plot #${plot.plotNumber}.`
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // In a real editor, coordinates are adjusted or partitioned
      await onSaveCorrection(
        plot.plotNumber,
        mode,
        notes,
        plot.coordinates
      );
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

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
        width: '500px',
        background: 'var(--bg-secondary)',
        borderRadius: '14px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-lg)',
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
            {mode === 'SPLIT_BLOCK' ? (
              <SplitSquareVertical size={20} color="#ea580c" />
            ) : (
              <Edit3 size={20} color="#06b6d4" />
            )}
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
              {mode === 'SPLIT_BLOCK' ? `Subdivide Compound Block #${plot.plotNumber}` : `Manual Boundary Correction #${plot.plotNumber}`}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {success ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: '#34d399',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px'
            }}>
              <CheckCircle size={36} />
              <div style={{ fontSize: '14px', fontWeight: 700 }}>
                Correction Recorded Successfully!
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Recorded in audit history and saved separately without modifying original CAD vectors.
              </div>
            </div>
          ) : (
            <>
              <div style={{
                background: 'var(--bg-card)',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '12px',
                color: 'var(--text-muted)',
                lineHeight: 1.5
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Target Plot / Block:</span>
                  <strong style={{ color: '#fff' }}>Plot #{plot.plotNumber}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Candidate Polygon Area:</span>
                  <strong style={{ color: '#38bdf8' }}>{plot.calculatedArea?.toFixed(2)} m²</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>CAD Annotated Unit Area:</span>
                  <strong style={{ color: '#fff' }}>{plot.annotatedArea?.toFixed(2)} m²</strong>
                </div>
              </div>

              {mode === 'SPLIT_BLOCK' && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#fff', display: 'block', marginBottom: '6px' }}>
                    Number of Sub-Plots to Partition:
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={25}
                    value={numSubPlots}
                    onChange={e => setNumSubPlots(parseInt(e.target.value) || 2)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '13px'
                    }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                    Approx. {((plot.calculatedArea || 1000) / numSubPlots).toFixed(1)} m² per sub-plot
                  </span>
                </div>
              )}

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#fff', display: 'block', marginBottom: '6px' }}>
                  Auditor Engineering Notes & Rationale:
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                    resize: 'none'
                  }}
                />
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '6px',
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                fontSize: '11px',
                color: '#93c5fd'
              }}>
                <AlertCircle size={15} />
                Original CAD geometry will be preserved. Corrections are isolated in `manual_corrections.json`.
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  style={{ flex: 1, padding: '10px' }}
                >
                  <Save size={15} />
                  {isSubmitting ? 'Saving...' : 'Record Correction'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                  style={{ padding: '10px 16px' }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
