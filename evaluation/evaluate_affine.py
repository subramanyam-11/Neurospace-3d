"""
Milestone 4 — Test Suite: Orientation and Affine Matrix Handling.
Verifies coordinate transform inversion, orientation preservation, and physical millimeter mapping.
"""
import numpy as np
import nibabel as nib
from backend.app.visualization.mesh import generate_surface_mesh

def test_affine_inversion_precision():
    """Validates that NIfTI affine matrices invert with numerical error < 1e-6."""
    # Standard BraTS affine
    affine = np.array([
        [-1.0, 0.0, 0.0, 0.0],
        [0.0, -1.0, 0.0, 239.0],
        [0.0, 0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0]
    ], dtype=np.float64)

    inv_affine = np.linalg.inv(affine)
    identity = affine @ inv_affine
    max_err = np.max(np.abs(identity - np.eye(4)))

    assert max_err < 1e-6, f"Affine inversion error too high: {max_err}"
    return {"test": "affine_inversion_precision", "status": "PASS", "max_error": float(max_err)}

def test_oblique_and_rotated_affine():
    """Validates arbitrary oblique/rotated affines maintain physical spatial bounds."""
    # 45-degree rotation around Z axis + anisotropic scaling + translation
    theta = np.radians(45)
    rot_z = np.array([
        [np.cos(theta), -np.sin(theta), 0, 100.0],
        [np.sin(theta),  np.cos(theta), 0, -50.0],
        [0,              0,             1.5, 25.0],
        [0,              0,             0,   1.0]
    ])

    inv_rot_z = np.linalg.inv(rot_z)
    roundtrip = rot_z @ inv_rot_z
    max_err = np.max(np.abs(roundtrip - np.eye(4)))
    assert max_err < 1e-6, f"Rotated affine inversion error too high: {max_err}"

    # Test coordinate mapping of voxel [10, 20, 30]
    vox = np.array([10.0, 20.0, 30.0, 1.0])
    world = rot_z @ vox
    vox_rec = inv_rot_z @ world
    err_vox = np.max(np.abs(vox[:3] - vox_rec[:3]))
    assert err_vox < 1e-5, f"Voxel recovery error too high: {err_vox}"

    return {"test": "oblique_and_rotated_affine", "status": "PASS", "max_error": float(err_vox)}

def test_surface_mesh_affine_preservation():
    """Verifies that generate_surface_mesh applies affine translation and rotation precisely."""
    # Synthetic cube mask (10x10x10) from voxel (20, 20, 20) to (30, 30, 30)
    mask = np.zeros((60, 60, 60), dtype=bool)
    mask[20:31, 20:31, 20:31] = True

    # Affine: -1 mm X, -1 mm Y, +2 mm Z, translation [100, 200, 300]
    affine = np.diag([-1.0, -1.0, 2.0, 1.0])
    affine[0, 3] = 100.0
    affine[1, 3] = 200.0
    affine[2, 3] = 300.0

    mesh = generate_surface_mesh(mask, affine, "TestCube")
    assert mesh["vertex_count"] > 0, "No vertices generated"
    assert mesh["face_count"] > 0, "No faces generated"

    verts = np.array(mesh["vertices"])
    # Marching cubes isosurface at 0.5 level produces bounds ~ [20, 30] in voxels
    # In world coordinates:
    # X_world = 100 - X_vox -> bounds ~ [100 - 30, 100 - 20] = [70, 80]
    # Y_world = 200 - Y_vox -> bounds ~ [200 - 30, 200 - 20] = [170, 180]
    # Z_world = 300 + 2*Z_vox -> bounds ~ [300 + 40, 300 + 60] = [340, 360]

    assert 68.0 <= verts[:, 0].min() <= 71.0, f"X min mismatch: {verts[:, 0].min()}"
    assert 79.0 <= verts[:, 0].max() <= 82.0, f"X max mismatch: {verts[:, 0].max()}"
    assert 168.0 <= verts[:, 1].min() <= 171.0, f"Y min mismatch: {verts[:, 1].min()}"
    assert 179.0 <= verts[:, 1].max() <= 182.0, f"Y max mismatch: {verts[:, 1].max()}"
    assert 338.0 <= verts[:, 2].min() <= 342.0, f"Z min mismatch: {verts[:, 2].min()}"
    assert 358.0 <= verts[:, 2].max() <= 362.0, f"Z max mismatch: {verts[:, 2].max()}"

    return {
        "test": "surface_mesh_affine_preservation",
        "status": "PASS",
        "vertex_count": mesh["vertex_count"],
        "bbox": mesh["bbox"]
    }

def run_affine_tests():
    print("\n--- Running Orientation and Affine Handling Tests ---")
    results = [
        test_affine_inversion_precision(),
        test_oblique_and_rotated_affine(),
        test_surface_mesh_affine_preservation(),
    ]
    for r in results:
        print(f"[{r['status']}] {r['test']}")
    return results

if __name__ == "__main__":
    run_affine_tests()
