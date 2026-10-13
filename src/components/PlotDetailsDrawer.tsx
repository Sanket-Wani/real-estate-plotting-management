import React, { useState, useEffect } from 'react';
import { PlotData, PlotStatus, CustomerInfo } from '../types';
import { 
  Building2, User, Phone, Calendar, FileText, CheckCircle, 
  Edit3, Save, X, IndianRupee, Layers, ShieldCheck, Clock
} from 'lucide-react';

interface PlotDetailsDrawerProps {
  plot: PlotData;
  onClose: () => void;
  onSaveStatus: (plotNumber: number, newStatus: PlotStatus, customer: CustomerInfo | null, baseRate: number) => Promise<void>;
}

export const PlotDetailsDrawer: React.FC<PlotDetailsDrawerProps> = ({
  plot,
  onClose,
  onSaveStatus
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [status, setStatus] = useState<PlotStatus>(plot.status);
  const [baseRate, setBaseRate] = useState<number>(plot.baseRatePerSqm || 15000);
  const [customerName, setCustomerName] = useState<string>(plot.customer?.name || '');
  const [customerPhone, setCustomerPhone] = useState<string>(plot.customer?.contact || '');
  const [bookingRef, setBookingRef] = useState<string>(plot.customer?.bookingRef || `BK-KES-${plot.plotNumber.toString().padStart(3, '0')}`);
  const [regNo, setRegNo] = useState<string>(plot.customer?.regNo || `PUN/HAV/2026/${1000 + plot.plotNumber}`);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Synchronize when plot changes
  useEffect(() => {
    setIsEditing(false);
    setStatus(plot.status);
    setBaseRate(plot.baseRatePerSqm || 15000);
    setCustomerName(plot.customer?.name || '');
    setCustomerPhone(plot.customer?.contact || '');
    setBookingRef(plot.customer?.bookingRef || `BK-KES-${plot.plotNumber.toString().padStart(3, '0')}`);
    setRegNo(plot.customer?.regNo || `PUN/HAV/2026/${1000 + plot.plotNumber}`);
    setSuccessToast(null);
  }, [plot]);

  const handleSave = async () => {
    setIsSaving(true);
    let customerPayload: CustomerInfo | null = null;
    if (status === 'BOOKED_UNREGISTERED') {
      customerPayload = {
        name: customerName || 'Booked Client',
        contact: customerPhone || '+91 98000 00000',
        bookingRef,
        bookingDate: plot.customer?.bookingDate || new Date().toISOString().split('T')[0]
      };
    } else if (status === 'BOOKED_REGISTERED') {
      customerPayload = {
        name: customerName || 'Registered Owner',
        contact: customerPhone || '+91 98000 00000',
        regNo,
        regDate: plot.customer?.regDate || new Date().toISOString().split('T')[0]
      };
    }

    try {
      await onSaveStatus(plot.plotNumber, status, customerPayload, baseRate);
      setIsEditing(false);
      setSuccessToast(`Plot #${plot.plotNumber} status successfully updated to ${status}!`);
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err) {
      console.error('Failed to save plot status:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setStatus(plot.status);
    setBaseRate(plot.baseRatePerSqm || 15000);
    setCustomerName(plot.customer?.name || '');
    setCustomerPhone(plot.customer?.contact || '');
  };

  const getStatusBadge = (st: PlotStatus) => {
    switch (st) {
      case 'UNBOOKED':
        return <span className="badge badge-unbooked">Available (Unbooked)</span>;
      case 'BOOKED_UNREGISTERED':
        return <span className="badge badge-booked-unreg">Booked (Unregistered)</span>;
      case 'BOOKED_REGISTERED':
        return <span className="badge badge-booked-reg">Booked (Registered)</span>;
    }
  };

  const effectiveArea = plot.calculatedArea || plot.annotatedArea || 120.0;
  const calculatedTotal = Math.round(effectiveArea * baseRate);

  return (
    <div style={{
      width: '380px',
      background: 'var(--bg-secondary)',
      borderLeft: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 40,
      flexShrink: 0,
      overflowY: 'auto',
      boxShadow: 'var(--shadow-lg)'
    }} className="animate-fade-in">
      {/* Top Drawer Header with Action */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(30, 41, 59, 0.4)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>
              Plot #{plot.plotNumber}
            </h2>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              (Gat No. 91/1)
            </span>
          </div>
          <div style={{ marginTop: '4px' }}>
            {getStatusBadge(isEditing ? status : plot.status)}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isEditing ? (
            <button
              className="btn btn-secondary"
              onClick={() => setIsEditing(true)}
              style={{ padding: '6px 12px', fontSize: '12px' }}
              title="Edit Plot Inventory Record"
            >
              <Edit3 size={14} />
              Edit
            </button>
          ) : (
            <button
              className="btn btn-secondary"
              onClick={handleCancel}
              style={{ padding: '6px 12px', fontSize: '12px' }}
              title="Cancel Edits"
            >
              <X size={14} />
              Cancel
            </button>
          )}

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Success Toast */}
      {successToast && (
        <div style={{
          padding: '10px 16px',
          background: 'rgba(16, 185, 129, 0.2)',
          borderBottom: '1px solid rgba(16, 185, 129, 0.4)',
          color: '#34d399',
          fontSize: '12px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle size={15} />
          {successToast}
        </div>
      )}

      {/* Content Body */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* 1. Geometric Details Card */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '10px',
          padding: '14px',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
            Land Geometry & Measurements
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Calculated Area</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#38bdf8' }}>
                {plot.calculatedArea ? `${plot.calculatedArea.toFixed(2)} m²` : 'N/A'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CAD Annotated Area</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>
                {plot.annotatedArea ? `${plot.annotatedArea.toFixed(2)} m²` : 'N/A'}
              </div>
            </div>
          </div>
          {plot.areaDiffPct !== null && (
            <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-dim)' }}>
              Discrepancy: {plot.areaDiffPct.toFixed(2)}% • Verification: {plot.extractionStatus}
            </div>
          )}
        </div>

        {/* 2. Commercial Pricing Card */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '10px',
          padding: '14px',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
            Commercial Pricing
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Base Rate (₹/m²):</span>
            {isEditing ? (
              <input
                type="number"
                value={baseRate}
                onChange={e => setBaseRate(parseFloat(e.target.value) || 0)}
                style={{
                  width: '120px',
                  padding: '4px 8px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '13px',
                  textAlign: 'right'
                }}
              />
            ) : (
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                ₹{baseRate.toLocaleString('en-IN')}/m²
              </span>
            )}
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '8px',
            borderTop: '1px solid rgba(255,255,255,0.06)'
          }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>Total Plot Value:</span>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#34d399' }}>
              ₹{(calculatedTotal / 100000).toFixed(2)} Lakhs
            </span>
          </div>
        </div>

        {/* 3. Inventory & Customer Details Card */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '10px',
          padding: '14px',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>
            Inventory Ownership & Booking Records
          </div>

          {/* Status Selection (Editable) */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              CURRENT INVENTORY STATUS:
            </label>
            {isEditing ? (
              <select
                value={status}
                onChange={e => setStatus(e.target.value as PlotStatus)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--bg-primary)',
                  border: '1px solid #38bdf8',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none'
                }}
              >
                <option value="UNBOOKED">UNBOOKED (Available)</option>
                <option value="BOOKED_UNREGISTERED">BOOKED UNREGISTERED (Token Paid)</option>
                <option value="BOOKED_REGISTERED">BOOKED REGISTERED (Deed Executed)</option>
              </select>
            ) : (
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                {status.replace(/_/g, ' ')}
              </div>
            )}
          </div>

          {/* Status-Specific Form Fields */}
          {(status === 'BOOKED_UNREGISTERED' || status === 'BOOKED_REGISTERED') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Customer Name:
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={customerName}
                    placeholder="e.g. Ramesh Kulkarni"
                    onChange={e => setCustomerName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                  />
                ) : (
                  <div style={{ fontSize: '13px', color: '#fff' }}>
                    {plot.customer?.name || 'Customer Assigned'}
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Contact Phone:
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={customerPhone}
                    placeholder="e.g. +91 98220 12345"
                    onChange={e => setCustomerPhone(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                  />
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {plot.customer?.contact || '+91 98220 12345'}
                  </div>
                )}
              </div>

              {status === 'BOOKED_UNREGISTERED' && (
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Booking Reference Token:
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={bookingRef}
                      onChange={e => setBookingRef(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '12px'
                      }}
                    />
                  ) : (
                    <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#fbbf24' }}>
                      {bookingRef}
                    </div>
                  )}
                </div>
              )}

              {status === 'BOOKED_REGISTERED' && (
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Sub-Registrar Doc Number:
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={regNo}
                      onChange={e => setRegNo(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '12px'
                      }}
                    />
                  ) : (
                    <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#a5b4fc' }}>
                      {regNo}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {status === 'UNBOOKED' && !isEditing && (
            <div style={{ fontSize: '12px', color: '#34d399', padding: '6px 0' }}>
              ✓ Plot is open in inventory. Click <strong>Edit</strong> above to create a customer booking.
            </div>
          )}
        </div>

        {/* Save / Cancel Footer (Only in Edit Mode) */}
        {isEditing && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={isSaving}
              style={{ flex: 1, padding: '10px' }}
            >
              <Save size={15} />
              {isSaving ? 'Persisting...' : 'Save & Persist Status'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleCancel}
              style={{ padding: '10px 16px' }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
