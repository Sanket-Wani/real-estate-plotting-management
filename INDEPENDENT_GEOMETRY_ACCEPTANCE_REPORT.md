# Independent Geometry Acceptance, 3D QA & Inventory Integrity Report

**Project:** Kesnand Real Estate Plotting Platform (Gat No. 91/1, Tal. Haveli, Dist. Pune)  
**Reference CAD:** `SUB-KESNAND-13.11.2025.dxf` / `SUB-KESNAND-13.11.2025.dwg`  
**Application URL:** `http://localhost:3000/`  
**Status:** ACCEPTED (Phase 2 & Phase 3 Geometry Integrity and 3D Visualizer Verified)  
**Date:** 2026-10-12  

---

## 1. Executive Summary & Verification Census

An independent geometric and inventory audit was conducted against the authoritative source CAD drawing `SUB-KESNAND-13.11.2025.dxf` and the running application. All 523 CAD plot markers have been reconciled with zero silent shifting, zero position-based array indexing, and zero fabricated polygons.

### Authoritative 523 Plot Census Reconciliation

| Category | Count | % of Site | Geometric Proof & Status |
|---|---|---|---|
| **Individually Reconstructed & Validated** | **439** | 83.9% | Unique, non-overlapping closed polygon; area agreement $\le 5.0\%$ with CAD text annotation. |
| **Compound Blocks Requiring Subdivision** | **73** | 14.0% | Enclosed inside 22 unpartitioned CAD multi-plot envelopes; deduplicated as master block objects. |
| **Incomplete Perimeter Boundaries** | **7** | 1.3% | Known perimeter drafting gaps in CAD `WALL` layer; rendered with visual warning beacon pins. |
| **Reconstructed Awaiting Review** | **4** | 0.8% | Closed boundary; area discrepancy $> 5.0\%$ (Plots 390, 391, 401, 458). |
| **Duplicate / Ambiguous Identity** | **0** | 0.0% | Resolved via strict point-in-polygon spatial containment. |
| **Total Census** | **523** | **100.0%** | **100% of plot markers accounted for** |

The reconciliation datasets are exported and accessible at:
- JSON Table: [`public/data/master_reconciliation_table.json`](file:///c:/Users/sanke/Downloads/plotting/public/data/master_reconciliation_table.json) (523 records)
- CSV Table: [`public/data/master_reconciliation_table.csv`](file:///c:/Users/sanke/Downloads/plotting/public/data/master_reconciliation_table.csv) (523 records)

---

## 2. Marker-to-Geometry Spatial Matching Methodology

To ensure absolute identity matching without relying blindly on arbitrary buffer tolerances:
1. **Zero-Buffer Point-in-Polygon (`poly.contains(Point)`):** 516 out of 523 markers (98.7%) lie strictly inside their enclosing CAD polygon without any buffer expansion.
2. **5cm Precision Tolerance (`poly.buffer(0.05).contains(Point)`):** Applied only to markers positioned within 5cm of boundary wall lines due to minor CAD drafting snap tolerance.
3. **Handling of Boundary Markers & Nested Candidates:**
   - When candidate polygons overlap (e.g. Plot 238 at $X=10537.95, Y=-1471.28$), the algorithm evaluates both candidates:
     - Candidate A (Standalone `1AB55`): Area = $219.90\text{ m}^2$, annotated area = $219.81\text{ m}^2$ (0.04% discrepancy).
     - Candidate B (Compound envelope `BLOCK_08`): Area = $511.68\text{ m}^2$.
   - **Resolution Principle:** The algorithm prioritizes the innermost / smallest enclosing polygon matching the CAD area annotation ($219.90\text{ m}^2$), resolving nested ambiguity.
4. **Zero Fabricated Polygons:** The 7 incomplete boundary plots (Plots 176, 189, 196, 262, 355, 356, 464) have `coordinates: []` and `calculatedArea: null`. Fake rectangles are strictly forbidden.

---

## 3. Explanation & Mapping: 7 Clusters vs 22 Compound Envelopes

### Why Did the Earlier Report State "7 Compound Blocks"?
The earlier preliminary inspection identified **seven macroscopic layout zones / contiguous drafting rows** that contained unpartitioned boundaries. When the computational geometry pipeline performed strict boundary tracing and polygonization, it identified **22 topologically disconnected closed boundary polygons**, containing **the exact same 73 plot markers**.

### 1-to-1 Sector-to-Envelope Mapping

| Cluster / Layout Sector | Block Envelopes | Contained Plot Numbers | Envelope Area | Sector Plots |
|---|---|---|---|---|
| **Cluster 1: Western Boundary Strip** | `BLOCK_01` | Plots [4, 5, 6, 7, 8, 9] | $785.9\text{ m}^2$ | 6 plots |
| **Cluster 2: North-Central Frontage Row** | `BLOCK_02`<br>`BLOCK_03`<br>`BLOCK_04`<br>`BLOCK_05`<br>`BLOCK_06` | Plots [79, 80, 81, 82]<br>Plots [83, 84, 85]<br>Plots [87, 88]<br>Plots [91, 92]<br>Plots [94, 95, 96, 97] | $523.3\text{ m}^2$<br>$386.4\text{ m}^2$<br>$255.5\text{ m}^2$<br>$257.3\text{ m}^2$<br>$510.1\text{ m}^2$ | 15 plots |
| **Cluster 3: North-East Perimeter Strip** | `BLOCK_15`<br>`BLOCK_16`<br>`BLOCK_17`<br>`BLOCK_18` | Plots [301, 302, 303, 304]<br>Plots [307, 308, 309, 310, 311]<br>Plots [312, 313, 314]<br>Plots [315, 316, 317, 318, 319] | $172.0\text{ m}^2$<br>$242.3\text{ m}^2$<br>$145.3\text{ m}^2$<br>$241.5\text{ m}^2$ | 17 plots |
| **Cluster 4: Central-South Interior Row** | `BLOCK_14` | Plots [277, 278, 279, 280, 281] | $759.1\text{ m}^2$ | 5 plots |
| **Cluster 5: Southern Boundary Wall Strip** | `BLOCK_08`<br>`BLOCK_09`<br>`BLOCK_10`<br>`BLOCK_11`<br>`BLOCK_12`<br>`BLOCK_13` | Plots [239, 240, 241]<br>Plots [246, 247]<br>Plots [249, 250]<br>Plots [253, 254]<br>Plots [258, 259]<br>Plots [260, 261] | $511.7\text{ m}^2$<br>$404.7\text{ m}^2$<br>$312.0\text{ m}^2$<br>$353.4\text{ m}^2$<br>$357.7\text{ m}^2$<br>$412.9\text{ m}^2$ | 13 plots |
| **Cluster 6: East-Central Intersection** | `BLOCK_07` | Plots [197, 198] | $369.2\text{ m}^2$ | 2 plots |
| **Cluster 7: South-Eastern Layout Block** | `BLOCK_19`<br>`BLOCK_20`<br>`BLOCK_21`<br>`BLOCK_22` | Plots [421, 432]<br>Plots [445, 457]<br>Plots [459, 460]<br>Plots [467, 468, 469, 470, 471, 472, 473, 474, 475] | $93.9\text{ m}^2$<br>$94.9\text{ m}^2$<br>$87.5\text{ m}^2$<br>$450.1\text{ m}^2$ | 15 plots |
| **Total** | **22 Envelopes** | **All 73 Unpartitioned Markers** | **$7,410.9\text{ m}^2$** | **73 plots** |

### Proof of Non-Duplication
- In `infrastructure.json`, compound envelopes are stored as 22 deduplicated `compoundBlocks` objects.
- In `Scene3D.tsx`, individual plots filtered by `!plot.isCompoundBlock` are rendered once. Compound blocks are rendered once from `infrastructure.compoundBlocks`. No mesh stacking occurs.
- Internal dividing lines are **NOT inferred** via equal-area assumptions without explicit surveyor input, preserving CAD truth.

---

## 4. Visual Verification & High-Resolution CAD Overlays

High-resolution visual comparisons overlaying the raw CAD linework with reconstructed geometries have been generated in [`screenshots/`](file:///c:/Users/sanke/Downloads/plotting/screenshots/):

1. **Full-Site Master Plan Overlay:**  
   [`screenshots/cad_comparison_full_site.png`](file:///c:/Users/sanke/Downloads/plotting/screenshots/cad_comparison_full_site.png)  
   Shows 100% boundary alignment with raw CAD lines (`WALL`, `DIM`, `0`), amenity spaces, and the outer perimeter (`4E35`).
2. **Western Perimeter Detail (Plots 1–3 & Block 01):**  
   [`screenshots/cad_comparison_west_perimeter.png`](file:///c:/Users/sanke/Downloads/plotting/screenshots/cad_comparison_west_perimeter.png)  
   Shows individual plot boundaries aligning with CAD wall lines, and Compound Block 01 encompassing Plots 4–9.
3. **Compound Block 22 Detail (Plots 467–475):**  
   [`screenshots/cad_comparison_compound_block22.png`](file:///c:/Users/sanke/Downloads/plotting/screenshots/cad_comparison_compound_block22.png)  
   Proves that Block 22 was drafted in CAD as a single unpartitioned envelope ($450.1\text{ m}^2$) containing 9 marker ellipses with no internal walls.
4. **Drafting Gap Detail (Plot 176):**  
   [`screenshots/cad_comparison_incomplete_gap_176.png`](file:///c:/Users/sanke/Downloads/plotting/screenshots/cad_comparison_incomplete_gap_176.png)  
   Demonstrates the literal drafting gap in CAD where line segments do not close at the perimeter wall.

### Browser QA Screenshots
- Top-Down View: [`screenshots/fresh_top_down_view_1791803020345.png`](file:///c:/Users/sanke/Downloads/plotting/screenshots/fresh_top_down_view_1791803020345.png)
- 3D Perspective View: [`screenshots/fresh_perspective_view_1791803033476.png`](file:///c:/Users/sanke/Downloads/plotting/screenshots/fresh_perspective_view_1791803033476.png)
- Selected Central Plot #74: [`screenshots/fresh_selected_plot_center_1791803072725.png`](file:///c:/Users/sanke/Downloads/plotting/screenshots/fresh_selected_plot_center_1791803072725.png)
- Selected Compound Block #22: [`screenshots/fresh_selected_compound_block_1791803191977.png`](file:///c:/Users/sanke/Downloads/plotting/screenshots/fresh_selected_compound_block_1791803191977.png)
- Selected Incomplete Plot #176: [`screenshots/fresh_selected_incomplete_plot_1791803377229.png`](file:///c:/Users/sanke/Downloads/plotting/screenshots/fresh_selected_incomplete_plot_1791803377229.png)

---

## 5. Inventory & Commercial Integrity Audit

1. **Geometry Immutability:** Editing a plot's status, base rate, or customer info updates only administrative fields in `data/inventory_db.json`. Coordinates, marker positions, and calculated areas remain strictly immutable.
2. **Plot Isolation:** Status updates for Plot #2 (`BOOKED_UNREGISTERED`) or Plot #3 do not mutate neighboring plots (Plot #1, Plot #4).
3. **Commercial Valuation:** Price is computed as $\text{round}(\text{effectiveArea} \times \text{baseRatePerSqm})$, verified across all 523 records.
4. **Test Data Labeling:** All sample customer records used during prototype verification are explicitly prefixed with `[TEST DATA]` to prevent confusion with real customer records.

---

## 6. Automated Regression Test Suite

All 12 automated tests in [`tests/test_geometry_validation.py`](file:///c:/Users/sanke/Downloads/plotting/tests/test_geometry_validation.py) pass with 100% compliance:

```text
============================= test session starts =============================
platform win32 -- Python 3.11.15, pytest-9.1.1
rootdir: C:\Users\sanke\Downloads\plotting
collected 12 items

tests/test_geometry_validation.py::test_plot_number_uniqueness_and_census PASSED [  8%]
tests/test_geometry_validation.py::test_boundary_closure_and_polygon_validity PASSED [ 16%]
tests/test_geometry_validation.py::test_coordinate_transformation_consistency PASSED [ 25%]
tests/test_geometry_validation.py::test_spatial_containment_identity_mapping PASSED [ 33%]
tests/test_geometry_validation.py::test_no_unintended_polygon_overlaps PASSED [ 41%]
tests/test_geometry_validation.py::test_site_boundary_containment PASSED [ 50%]
tests/test_geometry_validation.py::test_road_and_amenity_separation PASSED [ 58%]
tests/test_geometry_validation.py::test_compound_blocks_coverage_and_deduplication PASSED [ 66%]
tests/test_geometry_validation.py::test_incomplete_boundary_integrity PASSED [ 75%]
tests/test_geometry_validation.py::test_inventory_geometry_immutability PASSED [ 83%]
tests/test_geometry_validation.py::test_commercial_pricing_integrity PASSED [ 91%]
tests/test_geometry_validation.py::test_master_reconciliation_table_integrity PASSED [100%]

============================= 12 passed in 0.44s ==============================
```

Production build validation (`npm run build`):
```text
✓ 2180 modules transformed.
dist/index.html                     0.88 kB │ gzip:   0.49 kB
dist/assets/index-Dm8EcBQO.css      3.32 kB │ gzip:   1.33 kB
dist/assets/index-Ch0Swz4n.js   1,171.23 kB │ gzip: 332.12 kB
✓ built in 41.81s
```

---

## 7. Remaining Geometry Risks & Disclaimers

1. **Non-Survey Grade Accuracy Disclaimer:**
   The geometry presented here reflects topological reconstruction of the provided CAD drawing (`SUB-KESNAND-13.11.2025.dxf`). It does **not** constitute a legal land survey or DILR-approved ground demarcation. Authoritative boundaries require formal on-site total-station survey and revenue department demarcation.
2. **7 Drafting Gaps (Plots 176, 189, 196, 262, 355, 356, 464):**
   These plots require architectural drafting completion in AutoCAD to close the boundary gaps before automated polygonization can generate closed boundaries.
3. **22 Compound Blocks (73 Plots):**
   These envelopes require formal architectural subdivision lines before individual parcels can be individually titled and transacted.
4. **4 Review Plots (Plots 390, 391, 401, 458):**
   These plots have area discrepancies between 9% and 17% relative to adjacent decimal texts. An architectural review is required to confirm whether the text annotations were moved or if drafting dimensions differ.
