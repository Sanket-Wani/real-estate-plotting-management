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
      background: 'rgba(23, 23, 23, 0.45)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100
    }}>
      <div style={{
        width: '500px',
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-xl)',
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
              background: mode === 'SPLIT_BLOCK' ? 'var(--status-compound-bg)' : 'var(--bg-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {mode === 'SPLIT_BLOCK' ? (
                <SplitSquareVertical size={18} color="var(--status-compound)" />
              ) : (
                <Edit3 size={18} color="var(--dark-primary)" />
              )}
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                {mode === 'SPLIT_BLOCK' ? `Subdivide Compound Block #${plot.plotNumber}` : `Manual Boundary Correction #${plot.plotNumber}`}
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Auditor Manual Override & Reconciliation Engine
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {success ? (
            <div style={{
              padding: '24px',
              textAlign: 'center',
              color: 'var(--status-unbooked)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px'
            }}>
              <CheckCircle size={36} color="var(--status-unbooked)" />
              <div style={{ fontSize: '15px', fontWeight: 700 }}>
                Correction Recorded Successfully!
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '340px' }}>
                Recorded in audit history and saved separately in `manual_corrections.json` without modifying original CAD vectors.
              </div>
            </div>
          ) : (
            <>
              <div style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '12px',
                color: 'var(--text-muted)',
                lineHeight: 1.6
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Target Plot / Block:</span>
                  <strong style={{ color: 'var(--text-main)' }}>Plot #{plot.plotNumber}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Candidate Polygon Area:</span>
                  <strong style={{ color: 'var(--dark-primary)', fontFamily: 'var(--font-mono)' }}>{plot.calculatedArea?.toFixed(2)} m²</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>CAD Annotated Unit Area:</span>
                  <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{plot.annotatedArea?.toFixed(2)} m²</strong>
                </div>
              </div>

              {mode === 'SPLIT_BLOCK' && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
                    Number of Sub-Plots to Partition:
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={25}
                    value={numSubPlots}
                    onChange={e => setNumSubPlots(parseInt(e.target.value) || 2)}
                    className="input-field"
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Approx. {((plot.calculatedArea || 1000) / numSubPlots).toFixed(1)} m² per sub-plot
                  </span>
                </div>
              )}

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
                  Auditor Engineering Notes & Rationale:
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="input-field"
                  style={{ resize: 'none' }}
                />
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                fontSize: '11px',
                color: 'var(--text-muted)'
              }}>
                <AlertCircle size={15} color="var(--dark-primary)" />
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
