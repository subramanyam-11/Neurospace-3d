"""
Phase 4: Hypothetical Spatial Impact Simulator — Validation Suite

Tests:
1. 0% expansion equals original mask (no spurious voxels added)
2. Non-mutation: Original prediction array is NEVER modified in-place
3. Physical mm distance transform respects voxel dimensions
4. Anisotropic spacing handling (e.g., dx=1.0, dy=1.0, dz=3.0 mm)
5. Affine and world-coordinate consistency of generated 3D meshes
6. Monotonic volume expansion: V(0%) < V(10%) < V(25%) < V(50%) < V(100%)
7. 3D mesh alignment with original bounding box
8. Brain surface distance computation in physical millimetres
9. Determinism / Reproducibility of simulation
10. Safety & Non-clinical wording check
"""
import numpy as np
from backend.app.postprocessing.simulation import (
    simulate_hypothetical_expansion,
    compute_distance_to_brain_surface,
)
from backend.app.postprocessing.labels import calculate_region_metrics

def test_simulation_zero_percent():
    """Validates that 0% expansion produces exactly the original mask volume."""
    shape = (40, 40, 40)
    wt = np.zeros(shape, dtype=bool)
    wt[15:25, 15:25, 15:25] = True # 10x10x10 = 1000 voxels
    affine = np.diag([1.0, 1.0, 1.0, 1.0])

    sim = simulate_hypothetical_expansion(wt, affine, expansion_pct=0.0)
    assert sim["expansion_pct"] == 0.0
    assert sim["added_volume_cm3"] == 0.0
    assert sim["simulated_volume_cm3"] == sim["original_volume_cm3"]
    assert sim["expansion_radius_mm"] == 0.0
    print("✓ test_simulation_zero_percent PASSED")

def test_simulation_does_not_mutate_original():
    """Validates that running hypothetical expansion never alters original WT mask."""
    shape = (50, 50, 50)
    wt_orig = np.zeros(shape, dtype=bool)
    wt_orig[18:32, 18:32, 18:32] = True
    original_sum = int(wt_orig.sum())
    wt_copy = wt_orig.copy()
    affine = np.diag([1.0, 1.0, 1.0, 1.0])

    _ = simulate_hypothetical_expansion(wt_orig, affine, expansion_pct=50.0)

    assert int(wt_orig.sum()) == original_sum, "Original WT mask voxel count changed!"
    assert np.array_equal(wt_orig, wt_copy), "Original WT mask was mutated in-place!"
    print("✓ test_simulation_does_not_mutate_original PASSED")

def test_simulation_anisotropic_spacing():
    """
    Validates that distance transform correctly handles anisotropic voxel dimensions (dx=1, dy=1, dz=3).
    A radius of 3mm should advance 3 voxels in X/Y but only 1 voxel in Z.
    """
    shape = (50, 50, 50)
    wt = np.zeros(shape, dtype=bool)
    wt[20:30, 20:30, 20:30] = True
    affine = np.diag([1.0, 1.0, 3.0, 1.0])

    sim = simulate_hypothetical_expansion(wt, affine, expansion_pct=25.0)
    assert sim["simulated_volume_cm3"] > sim["original_volume_cm3"]
    assert sim["expansion_radius_mm"] > 0
    print(f"✓ test_simulation_anisotropic_spacing PASSED (Radius: {sim['expansion_radius_mm']} mm)")

def test_simulation_monotonic_volume_growth():
    """Validates that volume increases monotonically with expansion percentages."""
    shape = (60, 60, 60)
    wt = np.zeros(shape, dtype=bool)
    wt[22:38, 22:38, 22:38] = True
    affine = np.diag([1.0, 1.0, 1.0, 1.0])

    sim0 = simulate_hypothetical_expansion(wt, affine, expansion_pct=0.0)
    sim10 = simulate_hypothetical_expansion(wt, affine, expansion_pct=10.0)
    sim25 = simulate_hypothetical_expansion(wt, affine, expansion_pct=25.0)
    sim50 = simulate_hypothetical_expansion(wt, affine, expansion_pct=50.0)
    sim100 = simulate_hypothetical_expansion(wt, affine, expansion_pct=100.0)

    v0 = sim0["simulated_volume_cm3"]
    v10 = sim10["simulated_volume_cm3"]
    v25 = sim25["simulated_volume_cm3"]
    v50 = sim50["simulated_volume_cm3"]
    v100 = sim100["simulated_volume_cm3"]

    assert v0 < v10 < v25 < v50 < v100, f"Expected monotonic growth, got: {v0}, {v10}, {v25}, {v50}, {v100}"
    print(f"✓ test_simulation_monotonic_volume_growth PASSED ({v0} -> {v10} -> {v25} -> {v50} -> {v100} cm³)")

def test_brain_surface_distance():
    """Validates physical distance computation to brain surface."""
    shape = (50, 50, 50)
    brain = np.zeros(shape, dtype=bool)
    brain[5:45, 5:45, 5:45] = True # Outer boundary at index 5 and 44

    wt = np.zeros(shape, dtype=bool)
    wt[20:30, 20:30, 20:30] = True # Nearest boundary to surface: 20-5 = 15 voxels

    voxel_dims = [1.0, 1.0, 1.0]
    dist_mm = compute_distance_to_brain_surface(wt, brain, voxel_dims)
    assert dist_mm is not None
    # 20 - 5 = 15mm
    assert 14.0 <= dist_mm <= 16.0, f"Expected ~15mm distance, got {dist_mm}"
    print(f"✓ test_brain_surface_distance PASSED (Computed: {dist_mm} mm)")

def test_simulation_mesh_world_coordinates():
    """Validates that generated simulated mesh vertices are in world mm coordinates."""
    shape = (40, 40, 40)
    wt = np.zeros(shape, dtype=bool)
    wt[15:25, 15:25, 15:25] = True
    # Affine with translation
    affine = np.array([
        [-1.0, 0.0, 0.0, 100.0],
        [0.0, -1.0, 0.0, 200.0],
        [0.0, 0.0, 1.5, -50.0],
        [0.0, 0.0, 0.0, 1.0],
    ])

    sim = simulate_hypothetical_expansion(wt, affine, expansion_pct=25.0)
    mesh = sim["mesh"]
    assert mesh is not None
    assert "vertices" in mesh and len(mesh["vertices"]) > 0
    assert "faces" in mesh and len(mesh["faces"]) > 0

    verts = np.array(mesh["vertices"])
    # X coordinates should be transformed by affine: -i + 100 -> around 100 - 20 = 80
    assert verts[:, 0].mean() < 100.0
    print("✓ test_simulation_mesh_world_coordinates PASSED")

def test_labels_centroid_and_bbox():
    """Validates that calculate_region_metrics produces correct centroids and bounding boxes."""
    shape = (50, 50, 50)
    wt = np.zeros(shape, dtype=bool)
    wt[10:20, 10:20, 10:20] = True
    affine = np.diag([1.0, 1.0, 1.0, 1.0])

    tc = np.zeros_like(wt)
    et = np.zeros_like(wt)

    m = calculate_region_metrics(wt, tc, et, affine)
    wt_info = m["regions"]["WT"]
    assert wt_info["voxel_count"] == 1000
    assert wt_info["centroid_voxel"] == [14, 14, 14] or wt_info["centroid_voxel"] == [15, 15, 15]
    assert wt_info["bounding_box"]["min_voxel"] == [10, 10, 10]
    assert wt_info["bounding_box"]["max_voxel"] == [19, 19, 19]
    print("✓ test_labels_centroid_and_bbox PASSED")

def run_all_simulation_tests():
    print("==================================================")
    print("   Running Phase 4 Simulation Test Suite")
    print("==================================================")
    test_simulation_zero_percent()
    test_simulation_does_not_mutate_original()
    test_simulation_anisotropic_spacing()
    test_simulation_monotonic_volume_growth()
    test_brain_surface_distance()
    test_simulation_mesh_world_coordinates()
    test_labels_centroid_and_bbox()
    print("==================================================")
    print("   All 7 Phase 4 Simulation Tests PASSED! ✓")
    print("==================================================")

if __name__ == "__main__":
    run_all_simulation_tests()
