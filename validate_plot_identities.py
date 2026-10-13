"""
Independent Plot Identity and Geometry Acceptance Pipeline
Validates all 523 CAD plot markers against the source DXF geometry:
- Tests point-in-polygon containment (zero-buffer, 5cm tolerance, boundary distance)
- Counts candidate polygons containing/intersecting each marker
- Extracts source CAD line/arc handles forming each polygon boundary
- Reconciles calculated area vs annotated area with distance and percentage discrepancy
- Outputs master_reconciliation_table.json and master_reconciliation_table.csv
"""
import ezdxf
import math
import json
import csv
import os
from collections import defaultdict
import shapely
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import polygonize

DXF_PATH = r"c:\Users\sanke\Downloads\plotting\SUB-KESNAND-13.11.2025.dxf"
PUBLIC_DATA_DIR = r"c:\Users\sanke\Downloads\plotting\public\data"
OUTPUT_JSON = os.path.join(PUBLIC_DATA_DIR, "master_reconciliation_table.json")
OUTPUT_CSV = os.path.join(PUBLIC_DATA_DIR, "master_reconciliation_table.csv")

def arc_to_points(arc, n_segments=16):
    cx, cy = arc.dxf.center[0], arc.dxf.center[1]
    r = arc.dxf.radius
    sa = math.radians(arc.dxf.start_angle)
    ea = math.radians(arc.dxf.end_angle)
    if ea < sa:
        ea += 2 * math.pi
    return [(cx + r * math.cos(sa + (ea - sa) * j / n_segments),
             cy + r * math.sin(sa + (ea - sa) * j / n_segments))
            for j in range(n_segments + 1)]

def run_independent_validation():
    print("=== STARTING INDEPENDENT GEOMETRY VALIDATION ===")
    doc = ezdxf.readfile(DXF_PATH)
    msp = doc.modelspace()

    # 1. Harvest all 523 ellipse markers and text numbers
    ellipses = [e for e in msp if e.dxftype() == 'ELLIPSE' and e.dxf.layer == 'PLOT TEXT']
    texts = [e for e in msp if e.dxftype() in ('TEXT', 'MTEXT') and e.dxf.layer == 'PLOT TEXT']

    markers = {}
    for el in ellipses:
        cx, cy = el.dxf.center[0], el.dxf.center[1]
        for t in texts:
            txt = (t.dxf.text if t.dxftype() == 'TEXT' else t.text).replace('\\A1;', '').replace('\\A0;', '').strip()
            if txt.isdigit() and math.hypot(t.dxf.insert[0] - cx, t.dxf.insert[1] - cy) < 0.15:
                pnum = int(txt)
                markers[pnum] = {
                    'plotNumber': pnum,
                    'markerHandle': el.dxf.handle,
                    'markerX': round(cx, 3),
                    'markerY': round(cy, 3),
                    'textHandle': t.dxf.handle
                }
                break

    print(f"Total markers resolved: {len(markers)} / 523")

    # 2. Harvest candidate area annotations (decimals)
    all_area_texts = []
    for e in msp:
        if e.dxftype() in ('TEXT', 'MTEXT') and e.dxf.layer in ('PLOT TEXT', 'Text', 'TEXT-1'):
            t = (e.dxf.text if e.dxftype() == 'TEXT' else e.text).replace('\\A1;', '').replace('\\A0;', '').strip()
            try:
                v = float(t)
                if '.' in t and 15.0 <= v <= 30000.0:
                    all_area_texts.append({'val': v, 'pos': (e.dxf.insert[0], e.dxf.insert[1]), 'handle': e.dxf.handle})
            except:
                pass

    # 3. Assemble linear geometry across layers
    lines = []
    source_entities = []

    for e in msp:
        if e.dxf.layer == 'WALL' and e.dxftype() == 'LINE':
            geom = LineString([(e.dxf.start[0], e.dxf.start[1]), (e.dxf.end[0], e.dxf.end[1])])
            lines.append(geom)
            source_entities.append((geom, e.dxf.handle, 'WALL'))

    for e in msp:
        if e.dxf.layer == 'WALL' and e.dxftype() == 'ARC':
            pts = arc_to_points(e, n_segments=16)
            for j in range(len(pts) - 1):
                seg = LineString([pts[j], pts[j + 1]])
                lines.append(seg)
                source_entities.append((seg, e.dxf.handle, 'WALL'))

    poly_4e35 = [e for e in msp if e.dxf.handle == '4E35'][0]
    pts_4e35 = [(p[0], p[1]) for p in poly_4e35.get_points()]
    for j in range(len(pts_4e35)):
        seg = LineString([pts_4e35[j], pts_4e35[(j + 1) % len(pts_4e35)]])
        lines.append(seg)
        source_entities.append((seg, '4E35', 'WALL'))

    for e in msp:
        if e.dxf.layer in ('DIM', '0') and e.dxftype() == 'LINE':
            geom = LineString([(e.dxf.start[0], e.dxf.start[1]), (e.dxf.end[0], e.dxf.end[1])])
            lines.append(geom)
            source_entities.append((geom, e.dxf.handle, e.dxf.layer))

    for e in msp:
        if e.dxf.layer == '0' and e.dxftype() == 'LWPOLYLINE':
            pts = [(p[0], p[1]) for p in e.get_points()]
            for j in range(len(pts) - 1):
                seg = LineString([pts[j], pts[j + 1]])
                lines.append(seg)
                source_entities.append((seg, e.dxf.handle, '0'))
            if e.closed:
                seg = LineString([pts[-1], pts[0]])
                lines.append(seg)
                source_entities.append((seg, e.dxf.handle, '0'))

    # Precision noding & polygonization
    mls = shapely.MultiLineString(lines)
    snapped = shapely.set_precision(mls, grid_size=0.005)
    noded = shapely.node(snapped)
    polys = list(polygonize(noded))

    # Add standalone closed polylines
    standalone_closed = []
    for e in msp:
        if e.dxf.layer == 'WALL' and e.dxftype() == 'LWPOLYLINE' and e.closed and e.dxf.handle != '4E35':
            pts = [(p[0], p[1]) for p in e.get_points()]
            p = Polygon(pts)
            if p.is_valid and 15 <= p.area < 50000:
                standalone_closed.append((e.dxf.handle, p))

    raw_polys = polys + [p for h, p in standalone_closed]
    seen_keys = set()
    all_polys = []
    for p in raw_polys:
        k = (round(p.centroid.x, 2), round(p.centroid.y, 2), round(p.area, 1))
        if k not in seen_keys:
            seen_keys.add(k)
            all_polys.append(p)

    print(f"Total candidate polygons (deduplicated): {len(all_polys)}")

    # 4. Strict Spatial Containment Analysis for all 523 markers
    reconciliation_table = []
    poly_marker_groups = defaultdict(list)

    for num in range(1, 524):
        m = markers.get(num)
        if not m:
            continue
        pt = Point(m['markerX'], m['markerY'])

        # Find ALL candidate polygons containing or intersecting within 5cm tolerance
        strict_containing = []
        buffered_containing = []
        for idx, p in enumerate(all_polys):
            if 15.0 <= p.area <= 3500.0:
                if p.contains(pt):
                    strict_containing.append((idx, p))
                elif p.buffer(0.05).contains(pt):
                    buffered_containing.append((idx, p))

        total_candidates_count = len(strict_containing) + len(buffered_containing)
        
        # Best polygon selection
        best_poly = None
        match_type = "NONE"
        dist_to_geom = None

        if strict_containing:
            strict_containing.sort(key=lambda x: x[1].area) # smallest enclosing polygon
            best_idx, best_poly = strict_containing[0]
            match_type = "STRICT_CONTAINMENT"
            dist_to_geom = 0.0
        elif buffered_containing:
            buffered_containing.sort(key=lambda x: x[1].area)
            best_idx, best_poly = buffered_containing[0]
            match_type = "BUFFER_5CM_CONTAINMENT"
            dist_to_geom = round(best_poly.distance(pt), 4)

        if best_poly is not None:
            poly_key = (round(best_poly.centroid.x, 3), round(best_poly.centroid.y, 3), round(best_poly.area, 2))
            poly_marker_groups[poly_key].append(num)

    # Determine compound block IDs
    block_counter = 1
    poly_key_to_block = {}
    for k, num_list in poly_marker_groups.items():
        if len(num_list) > 1:
            poly_key_to_block[k] = f"BLOCK_{block_counter:02d}"
            block_counter += 1

    print(f"Total compound blocks resolved: {len(poly_key_to_block)} envelopes")

    # 5. Build Master Reconciliation Rows
    csv_rows = []
    status_counts = defaultdict(int)

    for num in range(1, 524):
        m = markers[num]
        pt = Point(m['markerX'], m['markerY'])

        strict_containing = [p for p in all_polys if 15.0 <= p.area <= 3500.0 and p.contains(pt)]
        buffered_containing = [p for p in all_polys if 15.0 <= p.area <= 3500.0 and not p.contains(pt) and p.buffer(0.05).contains(pt)]
        
        num_candidates = len(strict_containing) + len(buffered_containing)

        best_poly = None
        dist_to_geom = None
        if strict_containing:
            strict_containing.sort(key=lambda p: p.area)
            best_poly = strict_containing[0]
            dist_to_geom = 0.0
        elif buffered_containing:
            buffered_containing.sort(key=lambda p: p.area)
            best_poly = buffered_containing[0]
            dist_to_geom = round(best_poly.distance(pt), 4)

        # Nearest area annotation
        best_ann = None
        ann_dist = 999.0
        ann_handle = None
        for aa in all_area_texts:
            d = math.hypot(aa['pos'][0] - m['markerX'], aa['pos'][1] - m['markerY'])
            if d < 12.0 and d < ann_dist:
                ann_dist = d
                best_ann = aa['val']
                ann_handle = aa['handle']

        if best_poly is not None:
            k = (round(best_poly.centroid.x, 3), round(best_poly.centroid.y, 3), round(best_poly.area, 2))
            contained_markers = poly_marker_groups[k]
            is_compound = len(contained_markers) > 1
            block_id = poly_key_to_block.get(k)

            calc_area = round(best_poly.area, 2)
            area_diff_pct = round(abs(calc_area - best_ann) / best_ann * 100.0, 2) if best_ann else None

            # Trace boundary source handles
            src_handles = set()
            for seg, h, lay in source_entities:
                if best_poly.exterior.distance(seg) < 0.05:
                    src_handles.add(h)

            matched_geom_id = block_id if is_compound else f"POLYGON_{round(best_poly.centroid.x)}_{round(best_poly.centroid.y)}"

            if is_compound:
                classification = "COMPOUND_BLOCK_REQUIRING_SUBDIVISION"
                reason = f"Shares CAD envelope {block_id} ({calc_area:.1f}m²) with {len(contained_markers)} markers: {contained_markers}"
            elif area_diff_pct is not None and area_diff_pct <= 5.0:
                classification = "INDIVIDUALLY_RECONSTRUCTED_VALIDATED"
                reason = f"Unique closed polygon matches annotated area within {area_diff_pct}% tolerance"
            else:
                classification = "RECONSTRUCTED_AWAITING_REVIEW"
                reason = f"Area difference {area_diff_pct}% > 5.0% threshold (calc={calc_area:.1f}m², ann={best_ann}m²)" if area_diff_pct else "No nearby area annotation found"

            row = {
                'plotNumber': num,
                'markerHandle': m['markerHandle'],
                'markerX': m['markerX'],
                'markerY': m['markerY'],
                'matchedGeometryId': matched_geom_id,
                'sourceHandles': sorted(list(src_handles))[:10],
                'calculatedArea': calc_area,
                'annotatedArea': best_ann,
                'areaDiffPct': area_diff_pct,
                'distanceToMatchedGeom': dist_to_geom,
                'candidatePolygonsCount': num_candidates,
                'classification': classification,
                'reason': reason
            }
        else:
            classification = "INCOMPLETE_BOUNDARY"
            reason = "Open boundary: drafting gap in CAD WALL layer prevents topological polygonization"
            row = {
                'plotNumber': num,
                'markerHandle': m['markerHandle'],
                'markerX': m['markerX'],
                'markerY': m['markerY'],
                'matchedGeometryId': "NONE",
                'sourceHandles': [],
                'calculatedArea': None,
                'annotatedArea': best_ann,
                'areaDiffPct': None,
                'distanceToMatchedGeom': None,
                'candidatePolygonsCount': 0,
                'classification': classification,
                'reason': reason
            }

        reconciliation_table.append(row)
        status_counts[classification] += 1

        csv_rows.append({
            'plot_number': row['plotNumber'],
            'marker_handle': row['markerHandle'],
            'marker_x': row['markerX'],
            'marker_y': row['markerY'],
            'matched_geometry_id': row['matchedGeometryId'],
            'source_handles': ";".join(row['sourceHandles']),
            'calculated_area': row['calculatedArea'] if row['calculatedArea'] is not None else '',
            'annotated_area': row['annotatedArea'] if row['annotatedArea'] is not None else '',
            'area_diff_pct': row['areaDiffPct'] if row['areaDiffPct'] is not None else '',
            'distance_to_geom': row['distanceToMatchedGeom'] if row['distanceToMatchedGeom'] is not None else '',
            'candidate_polygons_count': row['candidatePolygonsCount'],
            'classification': row['classification'],
            'reason': row['reason']
        })

    # Save to JSON & CSV
    with open(OUTPUT_JSON, 'w') as f:
        json.dump(reconciliation_table, f, indent=2)

    with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'plot_number', 'marker_handle', 'marker_x', 'marker_y',
            'matched_geometry_id', 'source_handles', 'calculated_area',
            'annotated_area', 'area_diff_pct', 'distance_to_geom',
            'candidate_polygons_count', 'classification', 'reason'
        ])
        writer.writeheader()
        writer.writerows(csv_rows)

    print("\n=== MASTER RECONCILIATION SUMMARY ===")
    for k, v in sorted(status_counts.items(), key=lambda x: -x[1]):
        print(f"  {k:45s}: {v:4d} plots ({v/523*100:.1f}%)")
    print(f"  Total Accounted: {sum(status_counts.values())} / 523")
    print(f"[OK] Successfully wrote {OUTPUT_JSON} and {OUTPUT_CSV}")

if __name__ == '__main__':
    run_independent_validation()
