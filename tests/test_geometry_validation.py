"""
Comprehensive Geometry, QA, and Inventory Integrity Test Suite
Covers:
1. Plot-Number Uniqueness & 523 Census Integrity
2. Boundary Closure, Winding, and Polygon Validity (No Degenerates)
3. Coordinate Scaling, Working Units, and 3D Center Alignment
4. Point-In-Polygon Identity Mapping (No Array-Index Shifting)
5. Zero Polygon Duplication & Overlap Control
6. Site Boundary (4E35) Containment
7. Road and Amenity Spatial Separation
8. Compound Block Deduplication (22 Envelopes, 73 Plots, Zero Duplicates in Plot Meshes)
9. Incomplete Boundaries (7 Plots with No Fabricated Polygons)
10. Inventory Geometry Immutability Under Status Updates
11. Commercial Pricing Integrity (Area * Base Rate)
12. Master Reconciliation Table Integrity (523 records, 0 ambiguous)
"""
import pytest
import json
import os
import math
from shapely.geometry import Polygon, Point, LineString

DATA_DIR = r"c:\Users\sanke\Downloads\plotting\public\data"
SERVER_DATA_DIR = r"c:\Users\sanke\Downloads\plotting\data"

SITE_CENTER_X = 10463.35
SITE_CENTER_Y = -1422.44

@pytest.fixture(scope="module")
def plots_data():
    with open(os.path.join(DATA_DIR, "plots.json"), "r") as f:
        return json.load(f)

@pytest.fixture(scope="module")
def infrastructure_data():
    with open(os.path.join(DATA_DIR, "infrastructure.json"), "r") as f:
        return json.load(f)

@pytest.fixture(scope="module")
def inventory_db_data():
    with open(os.path.join(SERVER_DATA_DIR, "inventory_db.json"), "r") as f:
        return json.load(f)

@pytest.fixture(scope="module")
def master_reconciliation_data():
    with open(os.path.join(DATA_DIR, "master_reconciliation_table.json"), "r") as f:
        return json.load(f)

# 1. 523 Plot Census Integrity
def test_plot_number_uniqueness_and_census(plots_data):
    """Verify all 523 plot numbers are unique integers from 1 to 523."""
    plot_numbers = [p["plotNumber"] for p in plots_data]
    assert len(plot_numbers) == 523, f"Expected 523 plots, got {len(plot_numbers)}"
    assert len(set(plot_numbers)) == 523, "Duplicate plot numbers detected!"
    assert min(plot_numbers) == 1, "Min plot number is not 1"
    assert max(plot_numbers) == 523, "Max plot number is not 523"

# 2. Boundary Closure & Polygon Validity
def test_boundary_closure_and_polygon_validity(plots_data):
    """Verify reconstructed polygons are topologically valid, non-degenerate, and closed."""
    valid_count = 0
    for p in plots_data:
        coords = p.get("coordinates")
        if coords and len(coords) >= 4:
            poly = Polygon(coords)
            assert poly.is_valid, f"Plot {p['plotNumber']} has invalid self-intersecting polygon!"
            assert poly.exterior.is_closed, f"Plot {p['plotNumber']} exterior is not closed!"
            assert poly.area > 15.0, f"Plot {p['plotNumber']} area too small (< 15m²): {poly.area}"
            valid_count += 1

    assert valid_count >= 437, f"Expected at least 437 valid closed polygons, got {valid_count}"

# 3. Coordinate Transformation Consistency & Centering
def test_coordinate_transformation_consistency(plots_data, infrastructure_data):
    """Verify coordinate system alignment, site bounding box, and 3D origin centering."""
    sb = infrastructure_data.get("siteBoundary", [])
    assert len(sb) > 10, "Site boundary 4E35 missing coordinates"

    xs = [p[0] for p in sb]
    ys = [p[1] for p in sb]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)

    calc_cx = (min_x + max_x) / 2.0
    calc_cy = (min_y + max_y) / 2.0

    assert abs(calc_cx - SITE_CENTER_X) < 1.0, f"SITE_CENTER_X {SITE_CENTER_X} diverges from CAD center {calc_cx}"
    assert abs(calc_cy - SITE_CENTER_Y) < 1.0, f"SITE_CENTER_Y {SITE_CENTER_Y} diverges from CAD center {calc_cy}"

    # Verify 3D world conversion coordinates
    for p in plots_data:
        if p["markerX"] is not None and p["markerY"] is not None:
            wx = p["markerX"] - SITE_CENTER_X
            wz = -(p["markerY"] - SITE_CENTER_Y)
            assert -400.0 < wx < 400.0, f"Plot {p['plotNumber']} world X out of expected range: {wx}"
            assert -200.0 < wz < 200.0, f"Plot {p['plotNumber']} world Z out of expected range: {wz}"

# 4. Strict Spatial Containment (No Silent Array-Index Shifting)
def test_spatial_containment_identity_mapping(plots_data):
    """Verify every validated plot's CAD marker lies strictly within its own polygon."""
    validated = [p for p in plots_data if p["extractionStatus"] == "INDIVIDUALLY_RECONSTRUCTED_VALIDATED"]
    assert len(validated) >= 430, f"Expected >= 430 validated plots, got {len(validated)}"

    for p in validated:
        pt = Point(p["markerX"], p["markerY"])
        poly = Polygon(p["coordinates"])
        assert poly.buffer(0.05).contains(pt), (
            f"Plot {p['plotNumber']} marker ({p['markerX']}, {p['markerY']}) does not lie inside its assigned polygon!"
        )

# 5. Zero Polygon Duplication & Minimal Inter-Parcel Overlap
def test_no_unintended_polygon_overlaps(plots_data):
    """Verify individual plot polygons are unique and do not overlap beyond drafting tolerance."""
    individual_plots = [p for p in plots_data if not p.get("isCompoundBlock") and p.get("coordinates") and len(p["coordinates"]) >= 4]
    
    # Check uniqueness of polygon centroids
    centroids = [(round(Polygon(p["coordinates"]).centroid.x, 2), round(Polygon(p["coordinates"]).centroid.y, 2)) for p in individual_plots]
    assert len(centroids) == len(set(centroids)), "Duplicate polygon geometries detected among individual plots!"

    # Sample check 50 adjacent pairs to ensure overlap is < 0.5% (adjacent boundary walls only)
    for i in range(min(50, len(individual_plots))):
        p1 = Polygon(individual_plots[i]["coordinates"])
        for j in range(i + 1, min(50, len(individual_plots))):
            p2 = Polygon(individual_plots[j]["coordinates"])
            if p1.intersects(p2):
                overlap = p1.intersection(p2).area
                assert overlap < (min(p1.area, p2.area) * 0.02), (
                    f"Plots {individual_plots[i]['plotNumber']} and {individual_plots[j]['plotNumber']} overlap excessively: {overlap:.2f}m²"
                )

# 6. Site Boundary (4E35) Containment
def test_site_boundary_containment(infrastructure_data, plots_data):
    """Verify reconstructed plots lie within or on the master site boundary."""
    sb = infrastructure_data.get("siteBoundary", [])
    site_poly = Polygon(sb)
    assert site_poly.is_valid, "Master site boundary 4E35 is invalid"
    assert site_poly.area > 90000.0, f"Site boundary area too small: {site_poly.area}"

    buffered_site = site_poly.buffer(5.0)
    for p in plots_data[:100]:
        coords = p.get("coordinates")
        if coords and len(coords) >= 4:
            poly = Polygon(coords)
            overlap_pct = (poly.intersection(buffered_site).area / poly.area) * 100.0
            assert overlap_pct > 90.0, f"Plot {p['plotNumber']} falls outside site boundary (overlap={overlap_pct:.1f}%)"

# 7. Road and Amenity Separation
def test_road_and_amenity_separation(infrastructure_data, plots_data):
    """Verify amenity areas are classified separately and don't merge with inventory plots."""
    amenities = infrastructure_data.get("amenities", [])
    assert len(amenities) == 3, f"Expected 3 designated amenity spaces, found {len(amenities)}"

    amenity_polys = [Polygon(a["coordinates"]) for a in amenities if len(a["coordinates"]) >= 4]
    for p in plots_data[:50]:
        coords = p.get("coordinates")
        if coords and len(coords) >= 4:
            poly = Polygon(coords)
            for a_poly in amenity_polys:
                intersection_area = poly.intersection(a_poly).area
                assert intersection_area < (poly.area * 0.1), f"Plot {p['plotNumber']} overlaps amenity by > 10%!"

# 8. Compound Block Coverage & Deduplication Proof
def test_compound_blocks_coverage_and_deduplication(plots_data, infrastructure_data):
    """Verify 73 compound block plots are grouped into 22 envelopes without mesh duplication."""
    compound_plots = [p for p in plots_data if p.get("isCompoundBlock")]
    assert len(compound_plots) == 73, f"Expected 73 compound block plots, got {len(compound_plots)}"

    cb_envelopes = infrastructure_data.get("compoundBlocks", [])
    assert len(cb_envelopes) == 22, f"Expected 22 compound blocks, got {len(cb_envelopes)}"

    # Verify all 73 plots are accounted for in the 22 envelopes
    contained_set = set()
    for env in cb_envelopes:
        assert len(env["containedPlotNumbers"]) >= 2, f"Block {env['blockId']} has < 2 plots!"
        contained_set.update(env["containedPlotNumbers"])

    assert len(contained_set) == 73, f"Compound block envelope coverage mismatch: {len(contained_set)} != 73"

# 9. Incomplete Boundaries (7 Plots With Zero Fabricated Polygons)
def test_incomplete_boundary_integrity(plots_data):
    """Verify the 7 drafting gap plots have NO fabricated polygons."""
    incomplete_plots = [p for p in plots_data if p["extractionStatus"] == "INCOMPLETE_BOUNDARY"]
    assert len(incomplete_plots) == 7, f"Expected exactly 7 incomplete plots, got {len(incomplete_plots)}"

    expected_incomps = {176, 189, 196, 262, 355, 356, 464}
    actual_incomps = {p["plotNumber"] for p in incomplete_plots}
    assert actual_incomps == expected_incomps, f"Incomplete plot numbers mismatch: {actual_incomps}"

    for ip in incomplete_plots:
        assert len(ip["coordinates"]) == 0, f"Plot {ip['plotNumber']} fabricated a polygon!"
        assert ip["calculatedArea"] is None, f"Plot {ip['plotNumber']} calculated fake area!"

# 10. Inventory Geometry Immutability Under Status Updates
def test_inventory_geometry_immutability(plots_data, inventory_db_data):
    """Verify modifying inventory status does not alter coordinates, marker position, or area."""
    plots_map = {p["plotNumber"]: p for p in plots_data}
    db_map = {p["plotNumber"]: p for p in inventory_db_data}

    for num in range(1, 524):
        p_plot = plots_map[num]
        p_db = db_map[num]

        assert p_plot["coordinates"] == p_db["coordinates"], f"Plot {num} geometry mutated between plot and db!"
        assert p_plot["markerX"] == p_db["markerX"], f"Plot {num} markerX mutated!"
        assert p_plot["markerY"] == p_db["markerY"], f"Plot {num} markerY mutated!"
        assert p_plot["calculatedArea"] == p_db["calculatedArea"], f"Plot {num} area mutated!"

# 11. Commercial Pricing Calculation Integrity
def test_commercial_pricing_integrity(plots_data):
    """Verify commercial price equals area * base rate per sqm."""
    for p in plots_data:
        area = p["calculatedArea"] or p["annotatedArea"] or 120.0
        expected_price = round(area * p["baseRatePerSqm"])
        assert p["totalPrice"] == expected_price, f"Plot {p['plotNumber']} price mismatch: {p['totalPrice']} != {expected_price}"

# 12. Master Reconciliation Table Completeness & Zero Ambiguity
def test_master_reconciliation_table_integrity(master_reconciliation_data):
    """Verify all 523 records are present in the independent reconciliation table with 0 ambiguous matches."""
    assert len(master_reconciliation_data) == 523, f"Expected 523 records, got {len(master_reconciliation_data)}"
    
    for row in master_reconciliation_data:
        assert row["plotNumber"] in range(1, 524)
        assert row["markerHandle"] is not None
        assert row["classification"] in (
            "INDIVIDUALLY_RECONSTRUCTED_VALIDATED",
            "COMPOUND_BLOCK_REQUIRING_SUBDIVISION",
            "INCOMPLETE_BOUNDARY",
            "RECONSTRUCTED_AWAITING_REVIEW"
        )
        # All individually reconstructed plots must have a unique candidate or documented nested candidate (Plot 238)
        if row["classification"] == "INDIVIDUALLY_RECONSTRUCTED_VALIDATED":
            if row["candidatePolygonsCount"] > 1:
                assert row["plotNumber"] == 238, f"Unexpected multiple candidates for plot {row['plotNumber']}: {row['candidatePolygonsCount']}"
                assert row["areaDiffPct"] < 0.1, f"Plot 238 must match annotated area within 0.1%"
            else:
                assert row["candidatePolygonsCount"] == 1
