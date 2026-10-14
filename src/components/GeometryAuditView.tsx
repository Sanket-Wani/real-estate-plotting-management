import React, { useState, useMemo, useRef, useEffect } from 'react';
import { PlotData, CADLayers, ExtractionStatus, InfrastructureData, PlotStatus, CustomerInfo } from '../types';
import { 
  ZoomIn, ZoomOut, Maximize2, Filter, Eye, Layers, CheckCircle2, 
  AlertTriangle, XCircle, HelpCircle, Edit3, 
  Download, Search, Info, Save, X, CheckCircle, SplitSquareVertical,
  AlertCircle, ShieldCheck
} from 'lucide-react';

interface GeometryAuditViewProps {
  plots: PlotData[];
  cadLayers: CADLayers | null;
  infrastructure: InfrastructureData | null;
  selectedPlot: PlotData | null;
  canvasMode: 'light' | 'dark';
  onSelectPlot: (plot: PlotData | null) => void;
  onOpenManualCorrection: (plot: PlotData) => void;
  onOpenBlockSplitter: (plot: PlotData) => void;
  onExportCsv: () => void;
  onSaveStatus: (plotNumber: number, newStatus: PlotStatus, customer: CustomerInfo | null, baseRate: number) => Promise<void>;
}

const SITE_CENTER_X = 10463.35;
const SITE_CENTER_Y = -1422.44;
const SITE_WIDTH = 680;
const SITE_HEIGHT = 326;

export const GeometryAuditView: React.FC<GeometryAuditViewProps> = ({
  plots,
  cadLayers,
  infrastructure,
  selectedPlot,
  canvasMode,
  onSelectPlot,
  onOpenManualCorrection,
  onOpenBlockSplitter,
  onExportCsv,
  onSaveStatus,
}) => {
  // Viewport Transform State
  const [scale, setScale] = useState<number>(1.5);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: -15000, y: -1700 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Filter & Layer Visibility Controls
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showRawCad, setShowRawCad] = useState<boolean>(true);
  const [showPolygons, setShowPolygons] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showRoads, setShowRoads] = useState<boolean>(true);
  const [showBoundary, setShowBoundary] = useState<boolean>(true);
  const [showAmenities, setShowAmenities] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-fit to viewport on mount and window resize
  const fitToScreen = () => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth || 1000;
    const h = containerRef.current.clientHeight || 700;
    const s = Math.min((w - 80) / SITE_WIDTH, (h - 80) / SITE_HEIGHT);
    const px = w / 2 - s * SITE_CENTER_X;
    const py = h / 2 + s * SITE_CENTER_Y;
    setScale(s);
    setPan({ x: px, y: py });
  };

  useEffect(() => {
    fitToScreen();
  }, []);

  // Filtered Plots
  const filteredPlots = useMemo(() => {
    return plots.filter(p => {
      const matchesStatus = statusFilter === 'ALL' || p.extractionStatus === statusFilter;
      const matchesSearch = !searchQuery || p.plotNumber.toString().includes(searchQuery);
      return matchesStatus && matchesSearch;
    });
  }, [plots, statusFilter, searchQuery]);

  // Census counts
  const validatedCount = useMemo(() => plots.filter(p => p.extractionStatus === 'INDIVIDUALLY_RECONSTRUCTED_VALIDATED').length, [plots]);
  const compoundCount = useMemo(() => plots.filter(p => p.extractionStatus === 'COMPOUND_BLOCK_REQUIRING_SUBDIVISION').length, [plots]);
  const incompleteCount = useMemo(() => plots.filter(p => p.extractionStatus === 'INCOMPLETE_BOUNDARY').length, [plots]);
  const reviewCount = useMemo(() => plots.filter(p => p.extractionStatus === 'RECONSTRUCTED_AWAITING_REVIEW').length, [plots]);
  const ambiguousCount = useMemo(() => plots.filter(p => p.extractionStatus === 'DUPLICATE_OR_AMBIGUOUS_IDENTITY').length, [plots]);

  // Handle Mouse Pan & Zoom
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newScale = Math.max(0.3, Math.min(10.0, scale * zoomFactor));

    // Zoom centered on cursor
    const newPanX = mouseX - (mouseX - pan.x) * (newScale / scale);
    const newPanY = mouseY - (mouseY - pan.y) * (newScale / scale);

    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  };

  // Edit Plot Status Form State
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editStatus, setEditStatus] = useState<PlotStatus>(selectedPlot?.status || 'UNBOOKED');
  const [editBaseRate, setEditBaseRate] = useState<number>(selectedPlot?.baseRatePerSqm || 15000);
  const [customerName, setCustomerName] = useState<string>(selectedPlot?.customer?.name || '');
  const [customerPhone, setCustomerPhone] = useState<string>(selectedPlot?.customer?.contact || '');
  const [bookingRef, setBookingRef] = useState<string>(
    selectedPlot?.customer?.bookingRef || `BK-KES-${selectedPlot?.plotNumber.toString().padStart(3, '0') || '001'}`
  );
  const [regNo, setRegNo] = useState<string>(
    selectedPlot?.customer?.regNo || `PUN/HAV/2026/${1000 + (selectedPlot?.plotNumber || 1)}`
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Sync edit form whenever selectedPlot changes
  useEffect(() => {
    if (selectedPlot) {
      setIsEditing(false);
      setEditStatus(selectedPlot.status);
      setEditBaseRate(selectedPlot.baseRatePerSqm || 15000);
      setCustomerName(selectedPlot.customer?.name || '');
      setCustomerPhone(selectedPlot.customer?.contact || '');
      setBookingRef(selectedPlot.customer?.bookingRef || `BK-KES-${selectedPlot.plotNumber.toString().padStart(3, '0')}`);
      setRegNo(selectedPlot.customer?.regNo || `PUN/HAV/2026/${1000 + selectedPlot.plotNumber}`);
      setFieldErrors({});
      setSuccessToast(null);
    } else {
      setIsEditing(false);
      setFieldErrors({});
    }
  }, [selectedPlot]);

  const handleCancelEdit = () => {
    if (!selectedPlot) return;
    setIsEditing(false);
    setEditStatus(selectedPlot.status);
    setEditBaseRate(selectedPlot.baseRatePerSqm || 15000);
    setCustomerName(selectedPlot.customer?.name || '');
    setCustomerPhone(selectedPlot.customer?.contact || '');
    setFieldErrors({});
  };

  const scrollToErrorField = (fieldKey: string) => {
    setTimeout(() => {
      const el = document.getElementById(`field-${fieldKey}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
    }, 50);
  };

  const handleSaveStatusRecord = async () => {
    if (!selectedPlot) return;

    // Validation (DESIGN_SYSTEM.md §4)
    const errors: Record<string, string> = {};
    if (editStatus !== 'UNBOOKED') {
      if (!customerName.trim()) {
        errors.customerName = 'Customer or Owner name is required for booking.';
      }
      if (!customerPhone.trim()) {
        errors.customerPhone = 'Contact phone number is required.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstError = Object.keys(errors)[0];
      scrollToErrorField(firstError);
      return;
    }

    setFieldErrors({});
    setIsSaving(true);
    let customerPayload: CustomerInfo | null = null;
    if (editStatus === 'BOOKED_UNREGISTERED') {
      customerPayload = {
        name: customerName.trim(),
        contact: customerPhone.trim(),
        bookingRef: bookingRef.trim(),
        bookingDate: selectedPlot.customer?.bookingDate || new Date().toISOString().split('T')[0]
      };
    } else if (editStatus === 'BOOKED_REGISTERED') {
      customerPayload = {
        name: customerName.trim(),
        contact: customerPhone.trim(),
        regNo: regNo.trim(),
        regDate: selectedPlot.customer?.regDate || new Date().toISOString().split('T')[0]
      };
    }

    try {
      await onSaveStatus(selectedPlot.plotNumber, editStatus, customerPayload, editBaseRate);
      setIsEditing(false);
      setSuccessToast(`Plot #${selectedPlot.plotNumber} successfully updated to ${editStatus.replace(/_/g, ' ')}!`);
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err) {
      console.error('Failed to save plot status:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (st: PlotStatus) => {
    switch (st) {
      case 'UNBOOKED':
        return <span className="badge badge-unbooked">AVAILABLE (UNBOOKED)</span>;
      case 'BOOKED_UNREGISTERED':
        return <span className="badge badge-booked-unreg">BOOKED (UNREGISTERED)</span>;
      case 'BOOKED_REGISTERED':
        return <span className="badge badge-booked-reg">BOOKED (REGISTERED)</span>;
    }
  };

  const effectiveArea = selectedPlot ? (selectedPlot.calculatedArea || selectedPlot.annotatedArea || 120.0) : 120.0;
  const currentRate = isEditing ? editBaseRate : (selectedPlot?.baseRatePerSqm || 15000);
  const calculatedTotal = Math.round(effectiveArea * currentRate);

  // Status Styling Colors for Plot Dots & Directory
  const getPlotBadgeDotColor = (plot: PlotData) => {
    if (plot.status === 'BOOKED_REGISTERED') return 'var(--status-booked-reg)';
    if (plot.status === 'BOOKED_UNREGISTERED') return 'var(--status-booked-unreg)';
    if (plot.extractionStatus === 'COMPOUND_BLOCK_REQUIRING_SUBDIVISION') return 'var(--status-compound)';
    if (plot.extractionStatus === 'INCOMPLETE_BOUNDARY') return 'var(--status-incomplete)';
    if (plot.extractionStatus === 'RECONSTRUCTED_AWAITING_REVIEW') return 'var(--status-review)';
    return 'var(--status-unbooked)';
  };

  const isLight = canvasMode === 'light';

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Left Control & Filter Sidebar (DESIGN_SYSTEM.md §2 & §4) */}
      <div style={{
        width: '320px',
        background: '#ffffff',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 20,
        flexShrink: 0,
        overflow: 'hidden',
        boxShadow: '1px 0 2px 0 rgba(0, 0, 0, 0.02)'
      }}>
        {/* Search & Filter Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Layers size={16} color="var(--dark-primary)" />
            <h2 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-main)' }}>
              Geometry Validation Pipeline
            </h2>
          </div>

          {/* Search Plot Number */}
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Search plot number (1 - 523)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '32px' }}
            />
          </div>

          {/* Category Filter Pills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              FILTER BY AUDIT STATUS:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                className={`btn ${statusFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '5px 8px', fontSize: '11px', justifyContent: 'flex-start' }}
                onClick={() => setStatusFilter('ALL')}
              >
                All ({plots.length})
              </button>
              <button
                className={`btn ${statusFilter === 'INDIVIDUALLY_RECONSTRUCTED_VALIDATED' ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  padding: '5px 8px',
                  fontSize: '11px',
                  justifyContent: 'flex-start',
                  color: statusFilter === 'INDIVIDUALLY_RECONSTRUCTED_VALIDATED' ? '#fff' : 'var(--status-unbooked)'
                }}
                onClick={() => setStatusFilter('INDIVIDUALLY_RECONSTRUCTED_VALIDATED')}
              >
                Validated ({validatedCount})
              </button>
              <button
                className={`btn ${statusFilter === 'COMPOUND_BLOCK_REQUIRING_SUBDIVISION' ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  padding: '5px 8px',
                  fontSize: '11px',
                  justifyContent: 'flex-start',
                  color: statusFilter === 'COMPOUND_BLOCK_REQUIRING_SUBDIVISION' ? '#fff' : 'var(--status-compound)'
                }}
                onClick={() => setStatusFilter('COMPOUND_BLOCK_REQUIRING_SUBDIVISION')}
              >
                Blocks ({compoundCount})
              </button>
              <button
                className={`btn ${statusFilter === 'INCOMPLETE_BOUNDARY' ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  padding: '5px 8px',
                  fontSize: '11px',
                  justifyContent: 'flex-start',
                  color: statusFilter === 'INCOMPLETE_BOUNDARY' ? '#fff' : 'var(--status-incomplete)'
                }}
                onClick={() => setStatusFilter('INCOMPLETE_BOUNDARY')}
              >
                Incomplete ({incompleteCount})
              </button>
              <button
                className={`btn ${statusFilter === 'RECONSTRUCTED_AWAITING_REVIEW' ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  padding: '5px 8px',
                  fontSize: '11px',
                  justifyContent: 'flex-start',
                  color: statusFilter === 'RECONSTRUCTED_AWAITING_REVIEW' ? '#fff' : 'var(--text-main)'
                }}
                onClick={() => setStatusFilter('RECONSTRUCTED_AWAITING_REVIEW')}
              >
                Review ({reviewCount})
              </button>
              <button
                className={`btn ${statusFilter === 'DUPLICATE_OR_AMBIGUOUS_IDENTITY' ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  padding: '5px 8px',
                  fontSize: '11px',
                  justifyContent: 'flex-start',
                  color: statusFilter === 'DUPLICATE_OR_AMBIGUOUS_IDENTITY' ? '#fff' : 'var(--status-incomplete)'
                }}
                onClick={() => setStatusFilter('DUPLICATE_OR_AMBIGUOUS_IDENTITY')}
              >
                Ambiguous ({ambiguousCount})
              </button>
            </div>
          </div>
        </div>

        {/* CAD Layer Toggles */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', display: 'block' }}>
            LAYER VISIBILITY OVERLAYS:
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-main)' }}>
              <input type="checkbox" checked={showRawCad} onChange={e => setShowRawCad(e.target.checked)} style={{ accentColor: 'var(--dark-primary)' }} />
              <span>Raw CAD Linework (WALL, 0, DIM)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-main)' }}>
              <input type="checkbox" checked={showPolygons} onChange={e => setShowPolygons(e.target.checked)} style={{ accentColor: 'var(--dark-primary)' }} />
              <span>Reconstructed Plot Polygons</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-main)' }}>
              <input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)} style={{ accentColor: 'var(--dark-primary)' }} />
              <span>Plot Number & Area Labels</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-main)' }}>
              <input type="checkbox" checked={showRoads} onChange={e => setShowRoads(e.target.checked)} style={{ accentColor: 'var(--dark-primary)' }} />
              <span>Road Corridors & Centerlines</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-main)' }}>
              <input type="checkbox" checked={showAmenities} onChange={e => setShowAmenities(e.target.checked)} style={{ accentColor: 'var(--dark-primary)' }} />
              <span>Designated Amenities & Open Spaces</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-main)' }}>
              <input type="checkbox" checked={showBoundary} onChange={e => setShowBoundary(e.target.checked)} style={{ accentColor: 'var(--dark-primary)' }} />
              <span>Site Perimeter (4E35: 102,566 m²)</span>
            </label>
          </div>
        </div>

        {/* Plots Directory List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
            PLOTS DIRECTORY ({filteredPlots.length}):
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filteredPlots.map(plot => {
              const isSelected = selectedPlot?.plotNumber === plot.plotNumber;
              return (
                <div
                  key={plot.plotNumber}
                  onClick={() => onSelectPlot(plot)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: isSelected ? 'var(--bg-subtle)' : '#ffffff',
                    border: isSelected ? '1px solid var(--dark-primary)' : '1px solid var(--border-color)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: isSelected ? 800 : 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                      Plot #{plot.plotNumber}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px', fontFamily: 'var(--font-mono)' }}>
                      {plot.calculatedArea ? `${plot.calculatedArea.toFixed(1)} m²` : 'Open Gap'}
                    </span>
                  </div>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: getPlotBadgeDotColor(plot),
                    boxShadow: isSelected ? '0 0 0 2px rgba(23,23,23,0.1)' : 'none'
                  }} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Center: Main 2D CAD/Vector Canvas (Dual Canvas Mode) */}
      <div 
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        style={{
          flex: 1,
          height: '100%',
          position: 'relative',
          background: isLight ? '#f8fafc' : '#070b13',
          cursor: isDragging ? 'grabbing' : 'grab',
          overflow: 'hidden',
          transition: 'background-color 0.2s ease'
        }}
      >
        {/* Floating View Controls (DESIGN_SYSTEM.md §3) */}
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          display: 'flex',
          gap: '6px',
          zIndex: 30,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(8px)',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <button className="btn btn-secondary" onClick={() => setScale(s => s * 1.25)} title="Zoom In" style={{ padding: '6px 8px' }}>
            <ZoomIn size={15} />
          </button>
          <button className="btn btn-secondary" onClick={() => setScale(s => s * 0.8)} title="Zoom Out" style={{ padding: '6px 8px' }}>
            <ZoomOut size={15} />
          </button>
          <button className="btn btn-secondary" onClick={fitToScreen} title="Fit Entire Site to Viewport" style={{ padding: '6px 8px' }}>
            <Maximize2 size={15} />
          </button>
        </div>

        {/* Viewport Scale Indicator HUD */}
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          padding: '6px 14px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(8px)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          fontSize: '11px',
          color: 'var(--text-muted)',
          zIndex: 30,
          fontFamily: 'var(--font-mono)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--status-unbooked)' }}></span>
          <span>Working Units: Meters (1:1) • Scale: {(scale * 100).toFixed(0)}% • Plots: {filteredPlots.length}</span>
        </div>

        {/* SVG Drawing Canvas */}
        <svg
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'all'
          }}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale}, ${-scale})`}>
            {/* Grid background reference lines */}
            <defs>
              <pattern id="cadGrid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke={isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)'} strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect x="9600" y="-1700" width="1300" height="500" fill="url(#cadGrid)" />

            {/* 1. Raw CAD Lines & Arcs Layer */}
            {showRawCad && cadLayers && (
              <g id="raw-cad-geometry">
                {cadLayers['WALL']?.map((e, idx) => {
                  if (e.type === 'LINE' && e.start && e.end) {
                    return (
                      <line
                        key={`wall-l-${idx}`}
                        x1={e.start[0]}
                        y1={e.start[1]}
                        x2={e.end[0]}
                        y2={e.end[1]}
                        stroke={isLight ? '#cbd5e1' : '#334155'}
                        strokeWidth="0.3"
                      />
                    );
                  }
                  if (e.type === 'ARC' && e.points) {
                    return (
                      <polyline
                        key={`wall-a-${idx}`}
                        points={e.points.map(p => `${p[0]},${p[1]}`).join(' ')}
                        fill="none"
                        stroke={isLight ? '#cbd5e1' : '#334155'}
                        strokeWidth="0.3"
                      />
                    );
                  }
                  return null;
                })}

                {/* Layer 0 auxiliary lines */}
                {cadLayers['0']?.map((e, idx) => {
                  if (e.type === 'LINE' && e.start && e.end) {
                    return (
                      <line
                        key={`zero-l-${idx}`}
                        x1={e.start[0]}
                        y1={e.start[1]}
                        x2={e.end[0]}
                        y2={e.end[1]}
                        stroke={isLight ? '#e2e8f0' : '#475569'}
                        strokeWidth="0.3"
                        strokeDasharray="1,1"
                      />
                    );
                  }
                  return null;
                })}
              </g>
            )}

            {/* 2. Site Perimeter Boundary 4E35 */}
            {showBoundary && infrastructure?.siteBoundary && (
              <polygon
                points={infrastructure.siteBoundary.map(p => `${p[0]},${p[1]}`).join(' ')}
                fill={isLight ? 'rgba(99, 102, 241, 0.04)' : 'rgba(99, 102, 241, 0.05)'}
                stroke="#6366f1"
                strokeWidth="1.2"
                strokeDasharray="4,2"
              />
            )}

            {/* 3. Roadway Network Lines */}
            {showRoads && infrastructure?.roadLines && (
              <g id="roads-network">
                {infrastructure.roadLines.map((line, idx) => (
                  <polyline
                    key={`rd-${idx}`}
                    points={line.map(p => `${p[0]},${p[1]}`).join(' ')}
                    fill="none"
                    stroke={isLight ? '#94a3b8' : '#475569'}
                    strokeWidth="1.4"
                  />
                ))}
              </g>
            )}

            {/* 4. Amenities & Open Spaces */}
            {showAmenities && infrastructure?.amenities && infrastructure.amenities.map(am => (
              <g key={am.id}>
                <polygon
                  points={am.coordinates.map(p => `${p[0]},${p[1]}`).join(' ')}
                  fill={am.type === 'AMENITY_SPACE' 
                    ? (isLight ? 'rgba(14, 165, 233, 0.18)' : 'rgba(6, 182, 212, 0.25)')
                    : (isLight ? 'rgba(16, 185, 129, 0.18)' : 'rgba(52, 211, 153, 0.25)')
                  }
                  stroke={am.type === 'AMENITY_SPACE' ? '#0284c7' : '#059669'}
                  strokeWidth="0.9"
                />
              </g>
            ))}

            {/* 5. Compound Blocks Outline */}
            {infrastructure?.compoundBlocks && infrastructure.compoundBlocks.map(block => (
              <polygon
                key={block.blockId}
                points={block.coordinates.map(p => `${p[0]},${p[1]}`).join(' ')}
                fill={isLight ? 'rgba(234, 88, 12, 0.08)' : 'rgba(245, 158, 11, 0.12)'}
                stroke="#c2410c"
                strokeWidth="1.2"
                strokeDasharray="3,1.5"
              />
            ))}

            {/* 6. Individual Reconstructed Plot Polygons */}
            {showPolygons && filteredPlots.map(plot => {
              if (!plot.coordinates || plot.coordinates.length < 3) return null;
              const isSelected = selectedPlot?.plotNumber === plot.plotNumber;
              
              let strokeColor = isLight ? '#059669' : '#10b981';
              let fillColor = isLight ? 'rgba(5, 150, 105, 0.15)' : 'rgba(16, 185, 129, 0.30)';

              if (isSelected) {
                strokeColor = isLight ? '#171717' : '#38bdf8';
                fillColor = isLight ? 'rgba(23, 23, 23, 0.18)' : 'rgba(56, 189, 248, 0.45)';
              } else if (plot.status === 'BOOKED_REGISTERED') {
                strokeColor = isLight ? '#dc2626' : '#ef4444';
                fillColor = isLight ? 'rgba(220, 38, 38, 0.22)' : 'rgba(239, 68, 68, 0.45)';
              } else if (plot.status === 'BOOKED_UNREGISTERED') {
                strokeColor = isLight ? '#d97706' : '#eab308';
                fillColor = isLight ? 'rgba(217, 119, 6, 0.22)' : 'rgba(234, 179, 8, 0.45)';
              } else if (plot.extractionStatus === 'COMPOUND_BLOCK_REQUIRING_SUBDIVISION') {
                strokeColor = isLight ? '#c2410c' : '#ea580c';
                fillColor = isLight ? 'rgba(194, 65, 12, 0.15)' : 'rgba(234, 88, 12, 0.25)';
              } else if (plot.extractionStatus === 'INCOMPLETE_BOUNDARY') {
                strokeColor = isLight ? '#7c3aed' : '#a855f7';
                fillColor = isLight ? 'rgba(124, 58, 237, 0.15)' : 'rgba(168, 85, 247, 0.25)';
              } else if (plot.extractionStatus === 'RECONSTRUCTED_AWAITING_REVIEW') {
                strokeColor = isLight ? '#475569' : '#06b6d4';
                fillColor = isLight ? 'rgba(71, 85, 105, 0.15)' : 'rgba(6, 182, 212, 0.25)';
              }

              const ptsStr = plot.coordinates.map(p => `${p[0]},${p[1]}`).join(' ');

              return (
                <polygon
                  key={plot.plotNumber}
                  points={ptsStr}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 1.8 : 0.6}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPlot(plot);
                  }}
                  style={{ cursor: 'pointer' }}
                />
              );
            })}

            {/* 7. Incomplete Marker Indicators (Purple Crosses) */}
            {filteredPlots.filter(p => p.extractionStatus === 'INCOMPLETE_BOUNDARY').map(plot => {
              if (plot.markerX === null || plot.markerY === null) return null;
              return (
                <g key={`incomp-${plot.plotNumber}`}>
                  <circle cx={plot.markerX} cy={plot.markerY} r={1.8} fill="var(--status-incomplete)" opacity={0.85} />
                  <line x1={plot.markerX - 2} y1={plot.markerY} x2={plot.markerX + 2} y2={plot.markerY} stroke="#fff" strokeWidth="0.4" />
                  <line x1={plot.markerX} y1={plot.markerY - 2} x2={plot.markerX} y2={plot.markerY + 2} stroke="#fff" strokeWidth="0.4" />
                </g>
              );
            })}

            {/* 8. Plot Number Text Labels */}
            {showLabels && scale > 1.1 && filteredPlots.map(plot => {
              if (plot.markerX === null || plot.markerY === null) return null;
              const isSelected = selectedPlot?.plotNumber === plot.plotNumber;
              const labelColor = isLight ? (isSelected ? '#171717' : '#0f172a') : (isSelected ? '#38bdf8' : '#ffffff');
              const subLabelColor = isLight ? '#64748b' : 'rgba(255,255,255,0.7)';

              return (
                <g key={`lbl-${plot.plotNumber}`} transform={`translate(${plot.markerX}, ${plot.markerY}) scale(1, -1)`}>
                  <text
                    x={0}
                    y={1.2}
                    fill={labelColor}
                    fontSize={2.2}
                    fontWeight="800"
                    textAnchor="middle"
                    style={{ pointerEvents: 'none', fontFamily: 'var(--font-sans)' }}
                  >
                    {plot.plotNumber}
                  </text>
                  {scale > 2.2 && plot.calculatedArea && (
                    <text
                      x={0}
                      y={-1.8}
                      fill={subLabelColor}
                      fontSize={1.2}
                      textAnchor="middle"
                      style={{ pointerEvents: 'none', fontFamily: 'var(--font-mono)' }}
                    >
                      {plot.calculatedArea.toFixed(0)}m²
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Right: Animated Plot Details & Inventory Status Edit Panel (DESIGN_SYSTEM.md §4) */}
      {selectedPlot && (
        <div
          key={selectedPlot.plotNumber}
          className="animate-slide-right"
          style={{
            width: '380px',
            background: '#ffffff',
            borderLeft: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 35,
            flexShrink: 0,
            overflowY: 'auto',
            boxShadow: 'var(--shadow-xl)'
          }}
        >
          {/* Top Header with Action */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff',
            position: 'sticky',
            top: 0,
            zIndex: 10
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>
                  Plot #{selectedPlot.plotNumber}
                </h2>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  (Gat No. 91/1)
                </span>
              </div>
              <div style={{ marginTop: '4px' }}>
                {getStatusBadge(isEditing ? editStatus : selectedPlot.status)}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {!isEditing ? (
                <button
                  className="btn btn-secondary"
                  onClick={() => setIsEditing(true)}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  title="Edit Plot Inventory Record"
                >
                  <Edit3 size={13} />
                  Edit
                </button>
              ) : (
                <button
                  className="btn btn-secondary"
                  onClick={handleCancelEdit}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  title="Cancel Edits"
                >
                  <X size={13} />
                  Cancel
                </button>
              )}

              <button
                onClick={() => onSelectPlot(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px'
                }}
                title="Close Plot Details"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Success Toast */}
          {successToast && (
            <div style={{
              padding: '10px 16px',
              background: 'var(--status-unbooked-bg)',
              borderBottom: '1px solid var(--status-unbooked-border)',
              color: 'var(--status-unbooked)',
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
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-primary)' }}>
            
            {/* 1. Inventory & Customer Details Card (DESIGN_SYSTEM.md §4) */}
            <div className="section-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                <ShieldCheck size={15} color="var(--dark-primary)" />
                <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  INVENTORY OWNERSHIP & BOOKING RECORDS
                </h3>
              </div>

              {/* Status Selection (Editable) */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  CURRENT INVENTORY STATUS <span style={{ color: 'var(--status-booked-reg)' }}>*</span>
                </label>
                {isEditing ? (
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value as PlotStatus)}
                    className="input-field"
                    style={{ fontWeight: 600 }}
                  >
                    <option value="UNBOOKED">UNBOOKED (Available)</option>
                    <option value="BOOKED_UNREGISTERED">BOOKED UNREGISTERED (Token Paid - Amber)</option>
                    <option value="BOOKED_REGISTERED">BOOKED REGISTERED (Deed Executed - Red)</option>
                  </select>
                ) : (
                  <div style={{ 
                    fontSize: '13px', 
                    fontWeight: 700, 
                    color: selectedPlot.status === 'BOOKED_REGISTERED' 
                      ? 'var(--status-booked-reg)' 
                      : selectedPlot.status === 'BOOKED_UNREGISTERED' 
                      ? 'var(--status-booked-unreg)' 
                      : 'var(--status-unbooked)' 
                  }}>
                    {selectedPlot.status.replace(/_/g, ' ')}
                  </div>
                )}
              </div>

              {/* Status-Specific Form Fields */}
              {(editStatus === 'BOOKED_UNREGISTERED' || editStatus === 'BOOKED_REGISTERED') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                      Customer Name <span style={{ color: 'var(--status-booked-reg)' }}>*</span>
                    </label>
                    {isEditing ? (
                      <div>
                        <input
                          id="field-customerName"
                          type="text"
                          value={customerName}
                          placeholder="e.g. Ramesh Kulkarni"
                          onChange={e => {
                            setCustomerName(e.target.value);
                            if (fieldErrors.customerName) setFieldErrors(prev => ({ ...prev, customerName: '' }));
                          }}
                          className={`input-field ${fieldErrors.customerName ? 'input-field-error' : ''}`}
                        />
                        {fieldErrors.customerName && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', padding: '6px 10px', borderRadius: '6px', background: 'var(--status-booked-reg-bg)', border: '1px solid var(--status-booked-reg-border)', color: 'var(--status-booked-reg)', fontSize: '11px', fontWeight: 600 }}>
                            <AlertCircle size={14} />
                            <span>{fieldErrors.customerName}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                        {selectedPlot.customer?.name || 'Customer Assigned'}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                      Contact Phone <span style={{ color: 'var(--status-booked-reg)' }}>*</span>
                    </label>
                    {isEditing ? (
                      <div>
                        <input
                          id="field-customerPhone"
                          type="text"
                          value={customerPhone}
                          placeholder="e.g. +91 98220 12345"
                          onChange={e => {
                            setCustomerPhone(e.target.value);
                            if (fieldErrors.customerPhone) setFieldErrors(prev => ({ ...prev, customerPhone: '' }));
                          }}
                          className={`input-field ${fieldErrors.customerPhone ? 'input-field-error' : ''}`}
                        />
                        {fieldErrors.customerPhone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', padding: '6px 10px', borderRadius: '6px', background: 'var(--status-booked-reg-bg)', border: '1px solid var(--status-booked-reg-border)', color: 'var(--status-booked-reg)', fontSize: '11px', fontWeight: 600 }}>
                            <AlertCircle size={14} />
                            <span>{fieldErrors.customerPhone}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {selectedPlot.customer?.contact || '+91 98220 12345'}
                      </div>
                    )}
                  </div>

                  {editStatus === 'BOOKED_UNREGISTERED' && (
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                        Booking Reference Token:
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={bookingRef}
                          onChange={e => setBookingRef(e.target.value)}
                          className="input-field"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        />
                      ) : (
                        <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--status-booked-unreg)', fontWeight: 600 }}>
                          {bookingRef}
                        </div>
                      )}
                    </div>
                  )}

                  {editStatus === 'BOOKED_REGISTERED' && (
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                        Sub-Registrar Doc Number:
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={regNo}
                          onChange={e => setRegNo(e.target.value)}
                          className="input-field"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        />
                      ) : (
                        <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--status-booked-reg)', fontWeight: 600 }}>
                          {regNo}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {editStatus === 'UNBOOKED' && !isEditing && (
                <div style={{ fontSize: '12px', color: 'var(--status-unbooked)', padding: '6px 0', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={14} />
                  <span>Plot is open in inventory. Click <strong>Edit</strong> above to create a customer booking.</span>
                </div>
              )}
            </div>

            {/* Save / Cancel Footer (Only in Edit Mode) */}
            {isEditing && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveStatusRecord}
                  disabled={isSaving}
                  style={{ flex: 1, padding: '10px', fontSize: '12px' }}
                >
                  <Save size={14} />
                  {isSaving ? 'Persisting...' : 'Save & Persist Status'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleCancelEdit}
                  style={{ padding: '10px 16px', fontSize: '12px' }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* 2. Commercial Pricing Card */}
            <div className="section-card">
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.04em' }}>
                COMMERCIAL PRICING
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Base Rate (₹/m²):</span>
                {isEditing ? (
                  <input
                    type="number"
                    value={editBaseRate}
                    onChange={e => setEditBaseRate(parseFloat(e.target.value) || 0)}
                    className="input-field"
                    style={{ width: '120px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}
                  />
                ) : (
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                    ₹{editBaseRate.toLocaleString('en-IN')}/m²
                  </span>
                )}
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '8px',
                borderTop: '1px solid var(--border-color)'
              }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>Total Plot Value:</span>
                <span style={{ fontSize: '17px', fontWeight: 800, color: 'var(--status-unbooked)', fontFamily: 'var(--font-mono)' }}>
                  ₹{(calculatedTotal / 100000).toFixed(2)} Lakhs
                </span>
              </div>
            </div>

            {/* 3. Geometric Details Card */}
            <div className="section-card">
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.04em' }}>
                LAND GEOMETRY & MEASUREMENTS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Calculated Area</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--dark-primary)', fontFamily: 'var(--font-mono)' }}>
                    {selectedPlot.calculatedArea ? `${selectedPlot.calculatedArea.toFixed(2)} m²` : 'N/A'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>CAD Annotated Area</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                    {selectedPlot.annotatedArea ? `${selectedPlot.annotatedArea.toFixed(2)} m²` : 'N/A'}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Discrepancy: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-main)' }}>{selectedPlot.areaDiffPct !== null ? `${selectedPlot.areaDiffPct.toFixed(2)}%` : '0.00%'}</span> • Status:
                <div style={{ color: 'var(--text-main)', fontWeight: 600, marginTop: '2px' }}>
                  {selectedPlot.extractionStatus}
                </div>
              </div>

              {/* Subdivide or Manual Correction Quick Buttons */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                {selectedPlot.extractionStatus === 'COMPOUND_BLOCK_REQUIRING_SUBDIVISION' && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => onOpenBlockSplitter(selectedPlot)}
                    style={{ flex: 1, padding: '7px', fontSize: '11px' }}
                  >
                    <SplitSquareVertical size={13} color="var(--status-compound)" />
                    Subdivide Block
                  </button>
                )}
                <button
                  className="btn btn-secondary"
                  onClick={() => onOpenManualCorrection(selectedPlot)}
                  style={{ flex: 1, padding: '7px', fontSize: '11px' }}
                >
                  <Edit3 size={13} />
                  Boundary Correction
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
