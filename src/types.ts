export type PlotStatus = 'UNBOOKED' | 'BOOKED_UNREGISTERED' | 'BOOKED_REGISTERED';

export type ExtractionStatus = 
  | 'INDIVIDUALLY_RECONSTRUCTED_VALIDATED'
  | 'RECONSTRUCTED_AWAITING_REVIEW'
  | 'COMPOUND_BLOCK_REQUIRING_SUBDIVISION'
  | 'INCOMPLETE_BOUNDARY'
  | 'DUPLICATE_OR_AMBIGUOUS_IDENTITY'
  | 'NON_PLOT_MARKER_OR_OTHER';

export interface CustomerInfo {
  name: string;
  contact: string;
  bookingRef?: string;
  bookingDate?: string;
  regNo?: string;
  regDate?: string;
}

export interface PlotData {
  plotNumber: number;
  markerHandle: string;
  markerX: number | null;
  markerY: number | null;
  status: PlotStatus;
  extractionStatus: ExtractionStatus;
  calculatedArea: number | null;
  annotatedArea: number | null;
  areaDiffPct: number | null;
  candidatePolygonId: string | null;
  boundaryCompleteness: string;
  sourceHandles: string[];
  unresolvedReason: string | null;
  baseRatePerSqm: number;
  totalPrice: number;
  customer?: CustomerInfo | null;
  coordinates: [number, number][];
  isCompoundBlock?: boolean;
  compoundBlockId?: string | null;
}

export interface CADLayerEntity {
  type: 'LINE' | 'ARC' | 'LWPOLYLINE' | 'ELLIPSE';
  handle: string;
  start?: [number, number];
  end?: [number, number];
  points?: [number, number][];
  center?: [number, number];
  closed?: boolean;
}

export type CADLayers = Record<string, CADLayerEntity[]>;

export interface AmenityZone {
  id: string;
  handle?: string;
  name?: string;
  area: number;
  type: 'AMENITY_SPACE' | 'OPEN_SPACE';
  coordinates: [number, number][];
}

export interface CompoundBlock {
  blockId: string;
  area: number;
  containedPlotNumbers: number[];
  coordinates: [number, number][];
}

export interface InfrastructureData {
  amenities: AmenityZone[];
  siteBoundary: [number, number][];
  roadLines?: [number, number][][];
  compoundBlocks?: CompoundBlock[];
}

export interface ReconciliationRow {
  plot_number: number;
  marker_entity_handle: string;
  marker_x: number | null;
  marker_y: number | null;
  matched_text: string | null;
  annotated_area: number | null;
  candidate_polygon_id: string | null;
  calculated_area: number | null;
  area_difference_pct: number | null;
  boundary_completeness: string;
  is_in_multi_plot_polygon: boolean;
  multiple_polygons_claim_plot: boolean;
  extraction_status: ExtractionStatus;
  unresolved_reason: string | null;
}

export interface AuditLog {
  id: string;
  plotNumber: number;
  action: string;
  previousStatus: string;
  newStatus: string;
  timestamp: string;
  user: string;
}

export type ViewMode = '2D_AUDIT' | '3D_SCENE';
