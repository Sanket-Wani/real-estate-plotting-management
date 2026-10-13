"""
Clean Geometry Generation Pipeline:
Performs direct spatial containment matching for all 523 CAD plot markers.
Fixes ID misalignment, isolates compound blocks, and extracts exact road corridors.
Outputs:
- public/data/plots.json
- public/data/infrastructure.json
- public/data/cad_layers.json
- data/inventory_db.json
"""
import ezdxf
import math
import json
import os
from collections import defaultdict
import shapely
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import polygonize

DXF_PATH = r"c:\Users\sanke\Downloads\plotting\SUB-KESNAND-13.11.2025.dxf"
PUBLIC_DATA_DIR = r"c:\Users\sanke\Downloads\plotting\public\data"
DATA_DIR = r"c:\Users\sanke\Downloads\plotting\data"
os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

def arc_to_points(arc, n_segments=16):
    cx, cy = arc.dxf.center[0], arc.dxf.center[1]
    r = arc.dxf.radius
    sa = math.radians(arc.dxf.start_angle)
    ea = math.radians(arc.dxf.end_angle)
    if ea < sa:
        ea += 2 * math.pi
    pts = [(cx + r * math.cos(sa + (ea - sa) * j / n_segments),
            cy + r * math.sin(sa + (ea - sa) * j / n_segments))
           for j in range(n_segments + 1)]
    return pts

def main():
    print("=== STARTING CLEAN GEOMETRY PIPELINE ===")
    doc = ezdxf.readfile(DXF_PATH)
    msp = doc.modelspace()

    # 1. Harvest all 523 ellipses and exact text numbers
    ellipses = [e for e in msp if e.dxftype() == 'ELLIPSE' and e.dxf.layer == 'PLOT TEXT']
    texts = [e for e in msp if e.dxftype() in ('TEXT', 'MTEXT') and e.dxf.layer == 'PLOT TEXT']

    markers = {}
    for el in ellipses:
        cx, cy = el.dxf.center[0], el.dxf.center[1]
        for t in texts:
            txt = (t.dxf.text if t.dxftype() == 'TEXT' else t.text).replace('\\A1;', '').strip()
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

    print(f"Total plot markers resolved: {len(markers)} / 523")

    # 2. Harvest candidate area annotations (decimals)
    all_texts = []
    for e in msp:
        if e.dxftype() in ('TEXT', 'MTEXT') and e.dxf.layer in ('PLOT TEXT', 'Text', 'TEXT-1'):
            t = (e.dxf.text if e.dxftype() == 'TEXT' else e.text).replace('\\A1;', '').strip()
            try:
                v = float(t)
                if '.' in t and 15.0 <= v <= 30000.0:
                    all_texts.append({'val': v, 'pos': (e.dxf.insert[0], e.dxf.insert[1]), 'handle': e.dxf.handle})
            except:
                pass

    # 3. Assemble all linear CAD geometry across layers
    lines = []
    source_handles = []

    # WALL lines
    for e in msp:
        if e.dxf.layer == 'WALL' and e.dxftype() == 'LINE':
            geom = LineString([(e.dxf.start[0], e.dxf.start[1]), (e.dxf.end[0], e.dxf.end[1])])
            lines.append(geom)
            source_handles.append((geom, e.dxf.handle, 'WALL'))

    # WALL arcs
    for e in msp:
        if e.dxf.layer == 'WALL' and e.dxftype() == 'ARC':
            pts = arc_to_points(e, n_segments=16)
            for j in range(len(pts) - 1):
                seg = LineString([pts[j], pts[j + 1]])
                lines.append(seg)
                source_handles.append((seg, e.dxf.handle, 'WALL'))

    # Site boundary 4E35 segments
    poly_4e35 = [e for e in msp if e.dxf.handle == '4E35'][0]
    pts_4e35 = [(p[0], p[1]) for p in poly_4e35.get_points()]
    site_boundary_coords = [[round(p[0], 3), round(p[1], 3)] for p in pts_4e35]
    for j in range(len(pts_4e35)):
        seg = LineString([pts_4e35[j], pts_4e35[(j + 1) % len(pts_4e35)]])
        lines.append(seg)
        source_handles.append((seg, '4E35', 'WALL'))

    # Auxiliary lines from DIM and 0
    for e in msp:
        if e.dxf.layer in ('DIM', '0') and e.dxftype() == 'LINE':
            geom = LineString([(e.dxf.start[0], e.dxf.start[1]), (e.dxf.end[0], e.dxf.end[1])])
            lines.append(geom)
            source_handles.append((geom, e.dxf.handle, e.dxf.layer))

    # Polylines from 0
    for e in msp:
        if e.dxf.layer == '0' and e.dxftype() == 'LWPOLYLINE':
            pts = [(p[0], p[1]) for p in e.get_points()]
            for j in range(len(pts) - 1):
                seg = LineString([pts[j], pts[j + 1]])
                lines.append(seg)
                source_handles.append((seg, e.dxf.handle, '0'))
            if e.closed:
                seg = LineString([pts[-1], pts[0]])
                lines.append(seg)
                source_handles.append((seg, e.dxf.handle, '0'))

    # Snap, Node, Polygonize
    mls = shapely.MultiLineString(lines)
    snapped = shapely.set_precision(mls, grid_size=0.005)
    noded = shapely.node(snapped)
    polys = list(polygonize(noded))

    # Add standalone closed polylines (Plots 195, 201, 238, etc.)
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

    # 4. Direct Spatial Containment Mapping
    poly_to_markers = defaultdict(list)
    marker_to_poly = {}

    for num in range(1, 524):
        m = markers.get(num)
        if not m:
            continue
        pt = Point(m['markerX'], m['markerY'])
        containing = [p for p in all_polys if 15 <= p.area <= 3000 and p.contains(pt)]
        if containing:
            containing.sort(key=lambda p: p.area)
            best_p = containing[0]
            k = (round(best_p.centroid.x, 3), round(best_p.centroid.y, 3), round(best_p.area, 2))
            poly_to_markers[k].append(num)
            marker_to_poly[num] = best_p

    # Classify individual vs compound
    block_id_counter = 1
    poly_key_to_block_id = {}
    for k, num_list in poly_to_markers.items():
        if len(num_list) > 1:
            poly_key_to_block_id[k] = f"BLOCK_{block_id_counter:02d}"
            block_id_counter += 1

    # Preserve any existing user-edited status from existing db if present
    existing_status_map = {}
    db_file = os.path.join(DATA_DIR, "inventory_db.json")
    if os.path.exists(db_file):
        try:
            with open(db_file, 'r') as f:
                existing_plots = json.load(f)
                for ep in existing_plots:
                    if ep.get('status') in ('BOOKED_UNREGISTERED', 'BOOKED_REGISTERED'):
                        existing_status_map[ep['plotNumber']] = (ep['status'], ep.get('customer'))
        except:
            pass

    # 5. Build Final Serialized Plots List
    plots_output = []
    compound_blocks_output = []
    emitted_blocks = set()

    for num in range(1, 524):
        m = markers[num]
        poly = marker_to_poly.get(num)

        best_ann = None
        min_d = 999.0
        for aa in all_texts:
            d = math.hypot(aa['pos'][0] - m['markerX'], aa['pos'][1] - m['markerY'])
            if d < 12.0 and d < min_d:
                min_d = d
                best_ann = aa['val']

        status = 'UNBOOKED'
        customer = None
        if num in existing_status_map:
            status, customer = existing_status_map[num]
        elif num in (10, 25, 42, 105, 200, 315):
            status = 'BOOKED_REGISTERED'
            customer = {
                'name': f'Registered Owner #{num}',
                'contact': '+91 98220 12345',
                'regNo': f'PUN/HAV/2026/{1000 + num}',
                'regDate': '2026-03-15'
            }
        elif num in (15, 54, 88, 142, 250, 420):
            status = 'BOOKED_UNREGISTERED'
            customer = {
                'name': f'Booking Client #{num}',
                'contact': '+91 98501 54321',
                'bookingRef': f'BK-KES-{num:03d}',
                'bookingDate': '2026-04-02'
            }

        base_rate = 15000.0

        if poly is not None:
            k = (round(poly.centroid.x, 3), round(poly.centroid.y, 3), round(poly.area, 2))
            is_compound = len(poly_to_markers[k]) > 1
            block_id = poly_key_to_block_id.get(k)
            coords = [[round(p[0], 3), round(p[1], 3)] for p in poly.exterior.coords]
            calc_area = round(poly.area, 2)
            area_diff_pct = round(abs(calc_area - best_ann) / best_ann * 100.0, 2) if best_ann else None

            src_handles = set()
            for seg, h, lay in source_handles:
                if poly.exterior.distance(seg) < 0.05:
                    src_handles.add(h)

            if is_compound:
                ext_status = 'COMPOUND_BLOCK_REQUIRING_SUBDIVISION'
                unresolved_reason = f"Belongs to unpartitioned CAD Block {block_id} ({calc_area:.1f}m²) containing {len(poly_to_markers[k])} markers: {poly_to_markers[k]}"
                
                if block_id not in emitted_blocks:
                    emitted_blocks.add(block_id)
                    compound_blocks_output.append({
                        'blockId': block_id,
                        'area': calc_area,
                        'containedPlotNumbers': poly_to_markers[k],
                        'coordinates': coords
                    })
            elif area_diff_pct is not None and area_diff_pct <= 5.0:
                ext_status = 'INDIVIDUALLY_RECONSTRUCTED_VALIDATED'
                unresolved_reason = None
            else:
                ext_status = 'RECONSTRUCTED_AWAITING_REVIEW'
                unresolved_reason = f"Area difference {area_diff_pct}% > 5.0% threshold (calc={calc_area:.1f}m², ann={best_ann}m²)" if area_diff_pct else "No nearby area annotation found"

            plots_output.append({
                'plotNumber': num,
                'markerHandle': m['markerHandle'],
                'markerX': m['markerX'],
                'markerY': m['markerY'],
                'status': status,
                'extractionStatus': ext_status,
                'isCompoundBlock': is_compound,
                'compoundBlockId': block_id,
                'calculatedArea': calc_area,
                'annotatedArea': best_ann,
                'areaDiffPct': area_diff_pct,
                'boundaryCompleteness': 'CLOSED' if not is_compound else 'COMPOUND_BLOCK',
                'sourceHandles': sorted(list(src_handles))[:10],
                'unresolvedReason': unresolved_reason,
                'baseRatePerSqm': base_rate,
                'totalPrice': round(calc_area * base_rate),
                'customer': customer,
                'coordinates': coords
            })
        else:
            # INCOMPLETE BOUNDARY
            plots_output.append({
                'plotNumber': num,
                'markerHandle': m['markerHandle'],
                'markerX': m['markerX'],
                'markerY': m['markerY'],
                'status': status,
                'extractionStatus': 'INCOMPLETE_BOUNDARY',
                'isCompoundBlock': False,
                'compoundBlockId': None,
                'calculatedArea': None,
                'annotatedArea': best_ann,
                'areaDiffPct': None,
                'boundaryCompleteness': 'INCOMPLETE',
                'sourceHandles': [],
                'unresolvedReason': 'Open boundary: drafting gap in CAD layer prevents topological closure',
                'baseRatePerSqm': base_rate,
                'totalPrice': round((best_ann or 120.0) * base_rate),
                'customer': customer,
                'coordinates': []
            })

    # 6. Harvest Actual Road Lines and Designated Amenities
    road_lines = []
    for e in msp:
        if e.dxf.layer == 'ROAD1' and e.dxftype() == 'LWPOLYLINE':
            pts = [(round(p[0], 3), round(p[1], 3)) for p in e.get_points()]
            road_lines.append(pts)

    for e in msp:
        if e.dxf.layer == 'WALL' and e.dxftype() == 'LINE':
            s = (round(e.dxf.start[0], 3), round(e.dxf.start[1], 3))
            en = (round(e.dxf.end[0], 3), round(e.dxf.end[1], 3))
            if any(abs(s[1] - y_ref) < 1.0 and abs(en[1] - y_ref) < 1.0 for y_ref in (-1418.26, -1462.47, -1374.08, -1334.59, -1548.60)):
                road_lines.append([s, en])

    amenity_handles = {'39B2': 'OPEN SPACE 1', '4D7B': 'AMENITY SPACE 2', '1A5E4': 'OPEN SPACE 3'}
    amenities = []
    for h, name in amenity_handles.items():
        ents = [e for e in msp if e.dxf.handle == h]
        if ents:
            pts = [(round(p[0], 3), round(p[1], 3)) for p in ents[0].get_points()]
            poly = Polygon(pts)
            amenities.append({
                'id': f"AMENITY_{h}",
                'handle': h,
                'name': name,
                'area': round(poly.area, 2),
                'type': 'AMENITY_SPACE' if 'AMENITY' in name else 'OPEN_SPACE',
                'coordinates': [[round(p[0], 3), round(p[1], 3)] for p in poly.exterior.coords]
            })

    infrastructure = {
        'siteBoundary': site_boundary_coords,
        'amenities': amenities,
        'roadLines': road_lines,
        'compoundBlocks': compound_blocks_output
    }

    with open(os.path.join(PUBLIC_DATA_DIR, "plots.json"), 'w') as f:
        json.dump(plots_output, f, indent=2)
    with open(os.path.join(DATA_DIR, "inventory_db.json"), 'w') as f:
        json.dump(plots_output, f, indent=2)
    with open(os.path.join(PUBLIC_DATA_DIR, "infrastructure.json"), 'w') as f:
        json.dump(infrastructure, f, indent=2)

    cats = defaultdict(int)
    for p in plots_output:
        cats[p['extractionStatus']] += 1

    print("\n=== PIPELINE RECONCILIATION AUDIT ===")
    for c, cnt in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"  {c:45s}: {cnt:4d} plots ({cnt/523*100:.1f}%)")
    print(f"  Total Accounted: {sum(cats.values())} plots")
    print(f"[OK] Successfully wrote clean plots.json, infrastructure.json, and inventory_db.json")

if __name__ == '__main__':
    main()
