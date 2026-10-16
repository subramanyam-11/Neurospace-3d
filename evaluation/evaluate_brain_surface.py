"""
Evaluation and Unit Test Suite: Patient-Specific 3D Brain Anatomy.
Validates:
1. Extraction of patient-specific brain mask from uploaded T1 NIfTI volume.
2. Marching cubes isosurface mesh generation in physical world coordinates (mm).
3. Preservation of affine transform and exact spatial alignment with WT/TC/ET and 3D crosshair.
4. Backward compatibility of generate_all_region_meshes.
"""
import os
import numpy as np
import nibabel as nib
from backend.app.visualization.mesh import (
    extract_brain_mask,
    generate_brain_mesh,
    generate_all_region_meshes,
    generate_surface_mesh,
)

def test_brain_mask_extraction():
    """Validates patient-specific brain mask extraction from T1 MRI."""
    # 1. Edge case: empty volume
    empty_vol = np.zeros((20, 20, 20), dtype=np.float32)
    empty_mask = extract_brain_mask(empty_vol)
    assert empty_mask.shape == (20, 20, 20)
    assert empty_mask.sum() == 0, "Empty volume should produce empty mask"

    # 2. Synthetic head volume: sphere with interior cavity
    vol = np.zeros((60, 60, 60), dtype=np.float32)
    z, y, x = np.ogrid[:60, :60, :60]
    dist = np.sqrt((x - 30)**2 + (y - 30)**2 + (z - 30)**2)
    vol[dist < 20] = 600.0  # brain tissue
    vol[dist < 5] = 50.0    # simulated ventricle

    mask = extract_brain_mask(vol)
    assert mask.sum() > 0, "Mask should have active voxels"
    # Ventricle should be filled
    assert mask[30, 30, 30] == True, "Internal ventricle should be filled"

    # 3. Patient sample case T1
    sample_t1_path = "./test_data/sample_case/BraTS2021_00000_t1.nii.gz"
    if os.path.exists(sample_t1_path):
        t1_nii = nib.load(sample_t1_path)
        t1_data = t1_nii.get_fdata()
        patient_mask = extract_brain_mask(t1_data)
        assert patient_mask.sum() > 100000, f"Expected substantial brain mask, got {patient_mask.sum()}"
        assert patient_mask.shape == t1_data.shape

    return {"test": "brain_mask_extraction", "status": "PASS"}

def test_patient_specific_brain_mesh_generation():
    """Validates brain surface mesh structure, vertex count, and physical coordinates."""
    sample_t1_path = "./test_data/sample_case/BraTS2021_00000_t1.nii.gz"
    assert os.path.exists(sample_t1_path), "Sample case required"

    t1_nii = nib.load(sample_t1_path)
    t1_data = t1_nii.get_fdata()
    affine = t1_nii.affine

    mesh = generate_brain_mesh(t1_data, affine, step_size=2)
    assert mesh["region"] == "brain"
    assert mesh["name"] == "Patient-specific MRI anatomy"
    assert mesh["vertex_count"] > 1000, f"Expected >= 1000 vertices, got {mesh['vertex_count']}"
    assert mesh["face_count"] > 2000, f"Expected >= 2000 faces, got {mesh['face_count']}"
    assert len(mesh["vertices"]) == mesh["vertex_count"]
    assert len(mesh["faces"]) == mesh["face_count"]
    assert mesh["bbox"] is not None

    # Check that vertices are in expected physical millimeter range for BraTS
    verts = np.array(mesh["vertices"])
    # X range: approx -188 to -51 mm
    # Y range: approx 28 to 200 mm
    # Z range: approx 3 to 150 mm
    assert -220 <= verts[:, 0].min() <= -150
    assert -80 <= verts[:, 0].max() <= -30
    assert 10 <= verts[:, 1].min() <= 50
    assert 170 <= verts[:, 1].max() <= 220
    assert -10 <= verts[:, 2].min() <= 20
    assert 120 <= verts[:, 2].max() <= 170

    return {
        "test": "patient_specific_brain_mesh_generation",
        "status": "PASS",
        "vertex_count": mesh["vertex_count"],
        "face_count": mesh["face_count"],
        "bbox": mesh["bbox"]
    }

def test_spatial_alignment_tumour_and_crosshair():
    """
    Validates that the patient-specific brain surface aligns precisely with
    tumour subregions (WT, TC, ET) and the default 3D crosshair.
    """
    sample_case = "./test_data/sample_case"
    t1_nii = nib.load(os.path.join(sample_case, "BraTS2021_00000_t1.nii.gz"))
    t1_data = t1_nii.get_fdata()
    affine = t1_nii.affine

    # Generate synthetic tumour mask centered at voxel (140, 160, 75)
    wt_mask = np.zeros(t1_data.shape, dtype=bool)
    wt_mask[130:150, 150:170, 65:85] = True
    tc_mask = np.zeros(t1_data.shape, dtype=bool)
    tc_mask[135:145, 155:165, 70:80] = True
    et_mask = tc_mask.copy()

    meshes = generate_all_region_meshes(wt_mask, tc_mask, et_mask, affine, t1_data=t1_data)
    assert "brain" in meshes
    assert "WT" in meshes
    assert "TC" in meshes
    assert "ET" in meshes

    brain_bbox = meshes["brain"]["bbox"]
    wt_bbox = meshes["WT"]["bbox"]

    # In BraTS coordinate system (X negative, Y positive, Z positive)
    b_min = np.array(brain_bbox["min"])
    b_max = np.array(brain_bbox["max"])
    w_min = np.array(wt_bbox["min"])
    w_max = np.array(wt_bbox["max"])

    # Tumour must be strictly within the brain anatomical bounding box
    assert (w_min >= b_min - 1.0).all(), f"WT min out of bounds: {w_min} vs {b_min}"
    assert (w_max <= b_max + 1.0).all(), f"WT max out of bounds: {w_max} vs {b_max}"

    # Verify crosshair centroid lands inside both tumour and brain
    wt_centroid_vox = np.array([140.0, 160.0, 75.0, 1.0])
    wt_centroid_world = (affine @ wt_centroid_vox)[:3]
    assert (wt_centroid_world >= b_min).all() and (wt_centroid_world <= b_max).all()
    assert (wt_centroid_world >= w_min).all() and (wt_centroid_world <= w_max).all()

    return {
        "test": "spatial_alignment_tumour_and_crosshair",
        "status": "PASS",
        "wt_bbox": wt_bbox,
        "brain_bbox": brain_bbox,
        "crosshair_world_mm": wt_centroid_world.tolist()
    }

def test_backward_compatibility():
    """Validates that calling generate_all_region_meshes without t1_data preserves original behavior."""
    wt = np.zeros((30, 30, 30), dtype=bool)
    wt[10:20, 10:20, 10:20] = True
    affine = np.eye(4)

    # Call with 4 arguments as previously used in existing tests
    meshes = generate_all_region_meshes(wt, wt, wt, affine)
    assert set(meshes.keys()) == {"WT", "TC", "ET"}, f"Unexpected keys: {meshes.keys()}"
    assert meshes["WT"]["vertex_count"] > 0
    return {"test": "backward_compatibility", "status": "PASS"}

def run_brain_surface_tests():
    print("\n--- Running Patient-Specific Brain Anatomy Mesh Tests ---")
    results = [
        test_brain_mask_extraction(),
        test_patient_specific_brain_mesh_generation(),
        test_spatial_alignment_tumour_and_crosshair(),
        test_backward_compatibility(),
    ]
    for r in results:
        print(f"[{r['status']}] {r['test']}")
    return results

if __name__ == "__main__":
    run_brain_surface_tests()
