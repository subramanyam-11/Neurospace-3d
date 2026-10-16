"""
Milestone 4 — Test Suite: Anisotropic Spacing Handling.
Validates that physical volume calculations and 3D surface meshes accurately respect non-isotropic voxel spacings.
"""
import numpy as np
from backend.app.postprocessing.labels import calculate_region_metrics
from backend.app.visualization.mesh import generate_surface_mesh

def test_anisotropic_volume_calculation():
    """
    Validates physical volume calculation across isotropic vs anisotropic voxel resolutions:
    Case A: Isotropic 1.0 x 1.0 x 1.0 mm (1 voxel = 1.0 mm³ = 0.001 cm³)
    Case B: Anisotropic 0.5 x 0.5 x 2.0 mm (1 voxel = 0.5 mm³ = 0.0005 cm³)
    Case C: Anisotropic 1.0 x 1.0 x 3.0 mm (1 voxel = 3.0 mm³ = 0.003 cm³)
    """
    # 1,000 voxels active in each mask
    mask = np.zeros((50, 50, 50), dtype=bool)
    mask[10:20, 10:20, 10:20] = True  # exactly 10x10x10 = 1000 voxels

    # Case A: Isotropic 1.0 mm
    affine_iso = np.diag([1.0, 1.0, 1.0, 1.0])
    metrics_iso = calculate_region_metrics(mask, mask, mask, affine_iso)
    assert metrics_iso["voxel_volume_mm3"] == 1.0
    assert metrics_iso["regions"]["WT"]["estimated_volume_cm3"] == 1.0, f"Expected 1.0 cm³, got {metrics_iso['regions']['WT']['estimated_volume_cm3']}"

    # Case B: Anisotropic 0.5 x 0.5 x 2.0 mm (0.5 mm³ per voxel)
    affine_aniso_b = np.diag([0.5, 0.5, 2.0, 1.0])
    metrics_aniso_b = calculate_region_metrics(mask, mask, mask, affine_aniso_b)
    assert abs(metrics_aniso_b["voxel_volume_mm3"] - 0.5) < 1e-5
    assert metrics_aniso_b["regions"]["WT"]["estimated_volume_cm3"] == 0.5, f"Expected 0.5 cm³, got {metrics_aniso_b['regions']['WT']['estimated_volume_cm3']}"

    # Case C: Anisotropic 1.0 x 1.0 x 3.0 mm (3.0 mm³ per voxel)
    affine_aniso_c = np.diag([1.0, 1.0, 3.0, 1.0])
    metrics_aniso_c = calculate_region_metrics(mask, mask, mask, affine_aniso_c)
    assert abs(metrics_aniso_c["voxel_volume_mm3"] - 3.0) < 1e-5
    assert metrics_aniso_c["regions"]["WT"]["estimated_volume_cm3"] == 3.0, f"Expected 3.0 cm³, got {metrics_aniso_c['regions']['WT']['estimated_volume_cm3']}"

    return {
        "test": "anisotropic_volume_calculation",
        "status": "PASS",
        "iso_1mm_vol": metrics_iso["regions"]["WT"]["estimated_volume_cm3"],
        "aniso_0.5mm_vol": metrics_aniso_b["regions"]["WT"]["estimated_volume_cm3"],
        "aniso_3mm_vol": metrics_aniso_c["regions"]["WT"]["estimated_volume_cm3"],
    }

def test_anisotropic_mesh_vertex_scaling():
    """
    Validates that Marching Cubes mesh vertices are scaled to physical millimeters correctly
    when slice thickness is anisotropic (e.g. 1mm x 1mm in-plane, 3mm thick slices).
    """
    # Sphere of radius 10 voxels
    x, y, z = np.ogrid[-15:16, -15:16, -15:16]
    mask = (x**2 + y**2 + z**2) <= 10**2  # Radius ~ 10 voxels (diameter 20 voxels)

    # Anisotropic spacing: dx=1mm, dy=1mm, dz=3mm
    affine_aniso = np.diag([1.0, 1.0, 3.0, 1.0])
    mesh = generate_surface_mesh(mask, affine_aniso, "AnisoSphere")

    verts = np.array(mesh["vertices"])
    # Extent along X, Y should be ~ 20 mm, but extent along Z must be ~ 60 mm (20 voxels * 3mm)
    extent_x = verts[:, 0].max() - verts[:, 0].min()
    extent_y = verts[:, 1].max() - verts[:, 1].min()
    extent_z = verts[:, 2].max() - verts[:, 2].min()

    assert 18.0 <= extent_x <= 22.0, f"X physical extent mismatch: {extent_x}"
    assert 18.0 <= extent_y <= 22.0, f"Y physical extent mismatch: {extent_y}"
    assert 56.0 <= extent_z <= 64.0, f"Z physical extent mismatch: {extent_z} (expected ~60mm)"

    z_to_xy_ratio = extent_z / ((extent_x + extent_y) / 2.0)
    assert 2.8 <= z_to_xy_ratio <= 3.2, f"Expected 3x aspect ratio along Z, got {z_to_xy_ratio}"

    return {
        "test": "anisotropic_mesh_vertex_scaling",
        "status": "PASS",
        "extent_x_mm": round(extent_x, 2),
        "extent_y_mm": round(extent_y, 2),
        "extent_z_mm": round(extent_z, 2),
        "z_to_xy_ratio": round(z_to_xy_ratio, 2),
    }

def run_anisotropy_tests():
    print("\n--- Running Anisotropic Spacing Tests ---")
    results = [
        test_anisotropic_volume_calculation(),
        test_anisotropic_mesh_vertex_scaling(),
    ]
    for r in results:
        print(f"[{r['status']}] {r['test']}")
    return results

if __name__ == "__main__":
    run_anisotropy_tests()
