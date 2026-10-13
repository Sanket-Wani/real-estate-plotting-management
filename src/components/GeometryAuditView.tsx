import React, { useState, useMemo, useRef, useEffect } from 'react';
import { PlotData, CADLayers, ExtractionStatus, InfrastructureData, PlotStatus, CustomerInfo } from '../types';
import { 
  ZoomIn, ZoomOut, Maximize2, Filter, Eye, Layers, CheckCircle2, 
  AlertTriangle, XCircle, HelpCircle, Edit3, 
  Download, Search, Info, Save, X, CheckCircle
} from 'lucide-react';

interface GeometryAuditViewProps {
  plots: PlotData[];
  cadLayers: CADLayers | null;
  infrastructure: InfrastructureData | null;
  selectedPlot: PlotData | null;
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
      setSuccessToast(null);
    } else {
      setIsEditing(false);
    }
  }, [selectedPlot]);

  const handleCancelEdit = () => {
    if (!selectedPlot) return;
    setIsEditing(false);
    setEditStatus(selectedPlot.status);
    setEditBaseRate(selectedPlot.baseRatePerSqm || 15000);
    setCustomerName(selectedPlot.customer?.name || '');
    setCustomerPhone(selectedPlot.customer?.contact || '');
  };

  const handleSaveStatusRecord = async () => {
    if (!selectedPlot) return;
    setIsSaving(true);
    let customerPayload: CustomerInfo | null = null;
    if (editStatus === 'BOOKED_UNREGISTERED') {
      customerPayload = {
        name: customerName || 'Booked Client',
        contact: customerPhone || '+91 98000 00000',
        bookingRef: bookingRef || `BK-KES-${selectedPlot.plotNumber.toString().padStart(3, '0')}`,
        bookingDate: selectedPlot.customer?.bookingDate || new Date().toISOString().split('T')[0]
      };
    } else if (editStatus === 'BOOKED_REGISTERED') {
      customerPayload = {
        name: customerName || 'Registered Owner',
        contact: customerPhone || '+91 98000 00000',
        regNo: regNo || `PUN/HAV/2026/${1000 + selectedPlot.plotNumber}`,
        regDate: selectedPlot.customer?.regDate || new Date().toISOString().split('T')[0]
      };
    }

    try {
      await onSaveStatus(selectedPlot.plotNumber, editStatus, customerPayload, editBaseRate);
      setIsEditing(false);
      setSuccessToast(`Plot #${selectedPlot.plotNumber} status successfully updated to ${editStatus}!`);
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

  // Status Styling Colors
  const getStatusColor = (status: ExtractionStatus, isSelected: boolean) => {
    if (isSelected) return '#38bdf8'; // Electric cyan when selected
    switch (status) {
      case 'INDIVIDUALLY_RECONSTRUCTED_VALIDATED':
        return '#10b981'; // Emerald Green
      case 'COMPOUND_BLOCK_REQUIRING_SUBDIVISION':
        return '#ea580c'; // Vibrant Orange
      case 'INCOMPLETE_BOUNDARY':
        return '#a855f7'; // Purple / Violet (adjusted from red)
      case 'RECONSTRUCTED_AWAITING_REVIEW':
        return '#06b6d4'; // Cyan (adjusted from yellow)
      case 'DUPLICATE_OR_AMBIGUOUS_IDENTITY':
        return '#ec4899'; // Pink
      default:
        return '#64748b';
    }
  };

  const getPlotBadgeDotColor = (plot: PlotData) => {
    if (plot.status === 'BOOKED_REGISTERED') return '#ef4444'; // Red
    if (plot.status === 'BOOKED_UNREGISTERED') return '#eab308'; // Yellow
    if (plot.extractionStatus === 'COMPOUND_BLOCK_REQUIRING_SUBDIVISION') return '#ea580c'; // Orange
    if (plot.extractionStatus === 'INCOMPLETE_BOUNDARY') return '#a855f7'; // Purple
    if (plot.extractionStatus === 'RECONSTRUCTED_AWAITING_REVIEW') return '#06b6d4'; // Cyan
    return '#10b981'; // Green
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Left Control & Filter Sidebar */}
      <div style={{
        width: '320px',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 20,
        flexShrink: 0,
        overflow: 'hidden'
      }}>
        {/* Search & Filter Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Layers size={18} color="#06b6d4" />
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
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
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px',
                outline: 'none'
              }}
            />
          </div>

          {/* Category Filter Pills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
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
                style={{ padding: '5px 8px', fontSize: '11px', justifyContent: 'flex-start', color: statusFilter === 'INDIVIDUALLY_RECONSTRUCTED_VALIDATED' ? '#fff' : '#34d399' }}
                onClick={() => setStatusFilter('INDIVIDUALLY_RECONSTRUCTED_VALIDATED')}
              >
                Validated ({validatedCount})
              </button>
              <button
                className={`btn ${statusFilter === 'COMPOUND_BLOCK_REQUIRING_SUBDIVISION' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '5px 8px', fontSize: '11px', justifyContent: 'flex-start', color: statusFilter === 'COMPOUND_BLOCK_REQUIRING_SUBDIVISION' ? '#fff' : '#fb923c' }}
                onClick={() => setStatusFilter('COMPOUND_BLOCK_REQUIRING_SUBDIVISION')}
              >
                Blocks ({compoundCount})
              </button>
              <button
                className={`btn ${statusFilter === 'INCOMPLETE_BOUNDARY' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '5px 8px', fontSize: '11px', justifyContent: 'flex-start', color: statusFilter === 'INCOMPLETE_BOUNDARY' ? '#fff' : '#c084fc' }}
                onClick={() => setStatusFilter('INCOMPLETE_BOUNDARY')}
              >
                Incomplete ({incompleteCount})
              </button>
              <button
                className={`btn ${statusFilter === 'RECONSTRUCTED_AWAITING_REVIEW' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '5px 8px', fontSize: '11px', justifyContent: 'flex-start', color: statusFilter === 'RECONSTRUCTED_AWAITING_REVIEW' ? '#fff' : '#38bdf8' }}
                onClick={() => setStatusFilter('RECONSTRUCTED_AWAITING_REVIEW')}
              >
                Review ({reviewCount})
              </button>
              <button
                className={`btn ${statusFilter === 'DUPLICATE_OR_AMBIGUOUS_IDENTITY' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '5px 8px', fontSize: '11px', justifyContent: 'flex-start', color: statusFilter === 'DUPLICATE_OR_AMBIGUOUS_IDENTITY' ? '#fff' : '#c084fc' }}
                onClick={() => setStatusFilter('DUPLICATE_OR_AMBIGUOUS_IDENTITY')}
              >
                Ambiguous ({ambiguousCount})
              </button>
            </div>
          </div>
        </div>

        {/* CAD Layer Toggles */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
            LAYER VISIBILITY OVERLAYS:
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
              <input type="checkbox" checked={showRawCad} onChange={e => setShowRawCad(e.target.checked)} />
              <span>Raw CAD Geometry (WALL, DIM, 0)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
              <input type="checkbox" checked={showPolygons} onChange={e => setShowPolygons(e.target.checked)} />
              <span>Reconstructed Plot Polygons</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
              <input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)} />
              <span>Plot Number & Area Labels</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
              <input type="checkbox" checked={showRoads} onChange={e => setShowRoads(e.target.checked)} />
              <span>Road Corridors & Centerlines</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
              <input type="checkbox" checked={showAmenities} onChange={e => setShowAmenities(e.target.checked)} />
              <span>Designated Amenities & Open Spaces</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
              <input type="checkbox" checked={showBoundary} onChange={e => setShowBoundary(e.target.checked)} />
              <span>Site Perimeter (4E35: 102,566 m²)</span>
            </label>
          </div>
        </div>

        {/* Plots Directory List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
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
                    background: isSelected ? 'rgba(6, 182, 212, 0.2)' : 'var(--bg-card)',
                    border: isSelected ? '1px solid #06b6d4' : '1px solid transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: isSelected ? '#38bdf8' : '#f8fafc' }}>
                      Plot #{plot.plotNumber}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                      {plot.calculatedArea ? `${plot.calculatedArea.toFixed(1)} m²` : 'Open Gap'}
                    </span>
                  </div>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: getPlotBadgeDotColor(plot)
                  }} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Center: Main 2D CAD/Vector Canvas */}
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
          background: '#070b13',
          cursor: isDragging ? 'grabbing' : 'grab',
          overflow: 'hidden'
        }}
      >
        {/* Floating View Controls */}
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          display: 'flex',
          gap: '8px',
          zIndex: 30
        }}>
          <button className="btn btn-secondary" onClick={() => setScale(s => s * 1.25)} title="Zoom In">
            <ZoomIn size={16} />
          </button>
          <button className="btn btn-secondary" onClick={() => setScale(s => s * 0.8)} title="Zoom Out">
            <ZoomOut size={16} />
          </button>
          <button className="btn btn-secondary" onClick={fitToScreen} title="Fit Entire Site to Viewport">
            <Maximize2 size={16} />
          </button>
        </div>

        {/* Viewport Scale Indicator */}
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          padding: '6px 12px',
          background: 'rgba(15, 23, 42, 0.85)',
          borderRadius: '6px',
          border: '1px solid var(--border-color)',
          fontSize: '11px',
          color: 'var(--text-muted)',
          zIndex: 30,
          fontFamily: 'var(--font-mono)'
        }}>
          Working Units: Meters (1:1) • Scale: {(scale * 100).toFixed(0)}% • Plots: {filteredPlots.length}
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
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
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
                        stroke="#334155"
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
                        stroke="#334155"
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
                        stroke="#475569"
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
                fill="rgba(99, 102, 241, 0.05)"
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
                    stroke="#475569"
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
                  fill={am.type === 'AMENITY_SPACE' ? 'rgba(6, 182, 212, 0.25)' : 'rgba(52, 211, 153, 0.25)'}
                  stroke={am.type === 'AMENITY_SPACE' ? '#06b6d4' : '#10b981'}
                  strokeWidth="0.9"
                />
              </g>
            ))}

            {/* 5. Compound Blocks Outline */}
            {infrastructure?.compoundBlocks && infrastructure.compoundBlocks.map(block => (
              <polygon
                key={block.blockId}
                points={block.coordinates.map(p => `${p[0]},${p[1]}`).join(' ')}
                fill="rgba(245, 158, 11, 0.12)"
                stroke="#ea580c"
                strokeWidth="1.2"
                strokeDasharray="3,1.5"
              />
            ))}

            {/* 6. Individual Reconstructed Plot Polygons */}
            {showPolygons && filteredPlots.map(plot => {
              if (!plot.coordinates || plot.coordinates.length < 3) return null;
              const isSelected = selectedPlot?.plotNumber === plot.plotNumber;
              
              let strokeColor = '#10b981';
              let fillColor = 'rgba(16, 185, 129, 0.30)';

              if (isSelected) {
                strokeColor = '#38bdf8';
                fillColor = 'rgba(56, 189, 248, 0.45)';
              } else if (plot.status === 'BOOKED_REGISTERED') {
                strokeColor = '#ef4444';
                fillColor = 'rgba(239, 68, 68, 0.45)';
              } else if (plot.status === 'BOOKED_UNREGISTERED') {
                strokeColor = '#eab308';
                fillColor = 'rgba(234, 179, 8, 0.45)';
              } else if (plot.extractionStatus === 'COMPOUND_BLOCK_REQUIRING_SUBDIVISION') {
                strokeColor = '#ea580c';
                fillColor = 'rgba(234, 88, 12, 0.25)';
              } else if (plot.extractionStatus === 'INCOMPLETE_BOUNDARY') {
                strokeColor = '#a855f7';
                fillColor = 'rgba(168, 85, 247, 0.25)';
              } else if (plot.extractionStatus === 'RECONSTRUCTED_AWAITING_REVIEW') {
                strokeColor = '#06b6d4';
                fillColor = 'rgba(6, 182, 212, 0.25)';
              }

              const ptsStr = plot.coordinates.map(p => `${p[0]},${p[1]}`).join(' ');

              return (
                <polygon
                  key={plot.plotNumber}
                  points={ptsStr}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 1.6 : 0.6}
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
                  <circle cx={plot.markerX} cy={plot.markerY} r={1.8} fill="#a855f7" opacity={0.85} />
                  <line x1={plot.markerX - 2} y1={plot.markerY} x2={plot.markerX + 2} y2={plot.markerY} stroke="#fff" strokeWidth="0.4" />
                  <line x1={plot.markerX} y1={plot.markerY - 2} x2={plot.markerX} y2={plot.markerY + 2} stroke="#fff" strokeWidth="0.4" />
                </g>
              );
            })}

            {/* 8. Plot Number Text Labels */}
            {showLabels && scale > 1.1 && filteredPlots.map(plot => {
              if (plot.markerX === null || plot.markerY === null) return null;
              const isSelected = selectedPlot?.plotNumber === plot.plotNumber;
              return (
                <g key={`lbl-${plot.plotNumber}`} transform={`translate(${plot.markerX}, ${plot.markerY}) scale(1, -1)`}>
                  <text
                    x={0}
                    y={1.2}
                    fill={isSelected ? '#38bdf8' : '#ffffff'}
                    fontSize={2.2}
                    fontWeight="700"
                    textAnchor="middle"
                    style={{ pointerEvents: 'none', fontFamily: 'var(--font-sans)' }}
                  >
                    {plot.plotNumber}
                  </text>
                  {scale > 2.2 && plot.calculatedArea && (
                    <text
                      x={0}
                      y={-1.8}
                      fill="rgba(255,255,255,0.7)"
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

      {/* Right: Animated Plot Details & Inventory Status Edit Panel */}
      {selectedPlot && (
        <div
          key={selectedPlot.plotNumber}
          className="animate-slide-right"
          style={{
            width: '380px',
            background: 'var(--bg-secondary)',
            borderLeft: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 35,
            flexShrink: 0,
            overflowY: 'auto',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          {/* Top Header with Action */}
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
                  onClick={handleCancelEdit}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  title="Cancel Edits"
                >
                  <X size={14} />
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
                  fontSize: '16px'
                }}
                title="Close Plot Details"
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
          <div className="animate-card-enter" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* 1. Inventory & Customer Details Card (SHIFTED TO TOP) */}
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: '10px',
              padding: '14px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.04em' }}>
                INVENTORY OWNERSHIP & BOOKING RECORDS
              </div>

              {/* Status Selection (Editable) */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  CURRENT INVENTORY STATUS:
                </label>
                {isEditing ? (
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value as PlotStatus)}
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
                    <option value="BOOKED_UNREGISTERED">BOOKED UNREGISTERED (Token Paid - Yellow)</option>
                    <option value="BOOKED_REGISTERED">BOOKED REGISTERED (Deed Executed - Red)</option>
                  </select>
                ) : (
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: 800, 
                    color: selectedPlot.status === 'BOOKED_REGISTERED' 
                      ? '#f87171' 
                      : selectedPlot.status === 'BOOKED_UNREGISTERED' 
                      ? '#facc15' 
                      : '#34d399' 
                  }}>
                    {selectedPlot.status.replace(/_/g, ' ')}
                  </div>
                )}
              </div>

              {/* Status-Specific Form Fields */}
              {(editStatus === 'BOOKED_UNREGISTERED' || editStatus === 'BOOKED_REGISTERED') && (
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
                        {selectedPlot.customer?.name || 'Customer Assigned'}
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
                        {selectedPlot.customer?.contact || '+91 98220 12345'}
                      </div>
                    )}
                  </div>

                  {editStatus === 'BOOKED_UNREGISTERED' && (
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
                        <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#facc15' }}>
                          {bookingRef}
                        </div>
                      )}
                    </div>
                  )}

                  {editStatus === 'BOOKED_REGISTERED' && (
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
                        <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#f87171' }}>
                          {regNo}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {editStatus === 'UNBOOKED' && !isEditing && (
                <div style={{ fontSize: '12px', color: '#34d399', padding: '6px 0', lineHeight: 1.5 }}>
                  ✓ Plot is open in inventory. Click <strong>Edit</strong> above to create a customer booking.
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
                  style={{ flex: 1, padding: '10px' }}
                >
                  <Save size={15} />
                  {isSaving ? 'Persisting...' : 'Save & Persist Status'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleCancelEdit}
                  style={{ padding: '10px 16px' }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* 2. Commercial Pricing Card */}
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: '10px',
              padding: '14px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.04em' }}>
                COMMERCIAL PRICING
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Base Rate (₹/m²):</span>
                {isEditing ? (
                  <input
                    type="number"
                    value={editBaseRate}
                    onChange={e => setEditBaseRate(parseFloat(e.target.value) || 0)}
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
                    ₹{editBaseRate.toLocaleString('en-IN')}/m²
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

            {/* 3. Geometric Details Card */}
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: '10px',
              padding: '14px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.04em' }}>
                LAND GEOMETRY & MEASUREMENTS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Calculated Area</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#38bdf8' }}>
                    {selectedPlot.calculatedArea ? `${selectedPlot.calculatedArea.toFixed(2)} m²` : 'N/A'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>CAD Annotated Area</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>
                    {selectedPlot.annotatedArea ? `${selectedPlot.annotatedArea.toFixed(2)} m²` : 'N/A'}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.4 }}>
                Discrepancy: {selectedPlot.areaDiffPct !== null ? `${selectedPlot.areaDiffPct.toFixed(2)}%` : '0.00%'} • Verification:
                <div style={{ color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                  {selectedPlot.extractionStatus}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
