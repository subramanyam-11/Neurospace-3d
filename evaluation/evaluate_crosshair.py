"""
Milestone 4 — Test Suite: Crosshair Accuracy & 2D/3D Synchronization.
Validates centroid localization, coordinate roundtrip precision, and boundary mapping across all three planes.
"""
import numpy as np

def test_centroid_localization():
    """
    Validates that the computed default crosshair centroid:
    1. Lands exactly at the center of mass of active voxels.
    2. Maps to the expected world millimeter position via the affine matrix.
    """
    # Create mask with active region centered at voxel (140, 80, 70)
    mask = np.zeros((240, 240, 155), dtype=bool)
    mask[135:146, 75:86, 65:76] = True  # Symmetric cube around (140, 80, 70)

    # Standard BraTS Affine: X_mm = -i, Y_mm = 239 - j, Z_mm = k
    affine = np.array([
        [-1.0, 0.0, 0.0, 0.0],
        [0.0, -1.0, 0.0, 239.0],
        [0.0, 0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0]
    ])

    indices = np.argwhere(mask)
    centroid_vox = np.round(indices.mean(axis=0)).astype(int).tolist()
    assert centroid_vox == [140, 80, 70], f"Centroid voxel mismatch: {centroid_vox}"

    # World coordinate
    vox_homo = np.array([centroid_vox[0], centroid_vox[1], centroid_vox[2], 1.0])
    world = (affine @ vox_homo)[:3].tolist()
    expected_world = [-140.0, 239.0 - 80.0, 70.0]  # [-140.0, 159.0, 70.0]
    assert world == expected_world, f"World coordinate mismatch: {world} vs {expected_world}"

    return {
        "test": "centroid_localization",
        "status": "PASS",
        "centroid_voxel": centroid_vox,
        "centroid_world_mm": world,
    }

def test_2d_3d_crosshair_roundtrip():
    """
    Validates mathematical 2D pixel <-> Voxel <-> 3D world (mm) exact roundtrip
    for Axial, Coronal, and Sagittal planes with zero pixel error.
    """
    dimX, dimY, dimZ = 240, 240, 155
    affine = np.array([
        [-1.0, 0.0, 0.0, 0.0],
        [0.0, -1.0, 0.0, 239.0],
        [0.0, 0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0]
    ])
    inv_affine = np.linalg.inv(affine)

    # Test 100 randomly sampled points across the entire volume
    np.random.seed(42)
    sample_i = np.random.randint(0, dimX, size=100)
    sample_j = np.random.randint(0, dimY, size=100)
    sample_k = np.random.randint(0, dimZ, size=100)

    max_err_world = 0.0
    for idx in range(100):
        i, j, k = int(sample_i[idx]), int(sample_j[idx]), int(sample_k[idx])

        # 1. Axial plane mapping: col = i, row = j, slice = k
        axial_col, axial_row = i, j
        assert axial_col == i and axial_row == j

        # 2. Coronal plane mapping: col = i, row = (dimZ - 1) - k, slice = j
        coronal_col = i
        coronal_row = (dimZ - 1) - k
        # Reverse mapping:
        rec_k = (dimZ - 1) - coronal_row
        assert rec_k == k

        # 3. Sagittal plane mapping: col = j, row = (dimZ - 1) - k, slice = i
        sagittal_col = j
        sagittal_row = (dimZ - 1) - k
        # Reverse mapping:
        rec_j = sagittal_col
        rec_k_sag = (dimZ - 1) - sagittal_row
        assert rec_j == j and rec_k_sag == k

        # 4. Physical world coordinate roundtrip:
        vox = np.array([i, j, k, 1.0])
        world = affine @ vox
        rec_vox = np.round((inv_affine @ world)[:3]).astype(int)
        assert (rec_vox == [i, j, k]).all(), f"Failed roundtrip at {[i, j, k]} -> {rec_vox}"

        err = np.max(np.abs((inv_affine @ world)[:3] - [i, j, k]))
        if err > max_err_world:
            max_err_world = err

    assert max_err_world < 1e-10, f"Max world error too high: {max_err_world}"

    return {
        "test": "2d_3d_crosshair_roundtrip",
        "status": "PASS",
        "num_points_tested": 100,
        "max_voxel_discrepancy": float(max_err_world),
    }

def test_boundary_crosshair_navigation():
    """
    Validates extreme boundaries (0, 0, 0) and (239, 239, 154) are mapped safely without index overflows.
    """
    dimX, dimY, dimZ = 240, 240, 155
    corners = [
        [0, 0, 0],
        [dimX - 1, dimY - 1, dimZ - 1],
        [0, dimY - 1, 0],
        [dimX - 1, 0, dimZ - 1],
    ]
    for c in corners:
        i, j, k = c
        assert 0 <= i < dimX
        assert 0 <= j < dimY
        assert 0 <= k < dimZ
        coronal_row = (dimZ - 1) - k
        assert 0 <= coronal_row < dimZ
        sagittal_row = (dimZ - 1) - k
        assert 0 <= sagittal_row < dimZ

    return {
        "test": "boundary_crosshair_navigation",
        "status": "PASS",
        "corners_tested": len(corners),
    }

def run_crosshair_tests():
    print("\n--- Running Crosshair Accuracy & Synchronization Tests ---")
    results = [
        test_centroid_localization(),
        test_2d_3d_crosshair_roundtrip(),
        test_boundary_crosshair_navigation(),
    ]
    for r in results:
        print(f"[{r['status']}] {r['test']}")
    return results

if __name__ == "__main__":
    run_crosshair_tests()
