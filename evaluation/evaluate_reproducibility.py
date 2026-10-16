"""
Milestone 4 — Test Suite: Reproducibility & Determinism.
Validates that model inference and mesh generation produce identical outputs across repeat runs.
"""
import os
import numpy as np
import nibabel as nib
from backend.app.preprocessing.pipeline import preprocess_modalities
from backend.app.inference.predictor import run_inference
from backend.app.visualization.mesh import generate_all_region_meshes
from evaluation.metrics import compute_dice

def test_inference_and_mesh_reproducibility(case_dir: str):
    """Runs end-to-end inference and mesh extraction twice and checks determinism."""
    case_name = os.path.basename(case_dir.rstrip("/"))
    print(f"[NeuroScope Evaluation] Testing reproducibility on {case_name}...")

    flair_path = os.path.join(case_dir, f"{case_name}_flair.nii.gz")
    t1_path = os.path.join(case_dir, f"{case_name}_t1.nii.gz")
    t1ce_path = os.path.join(case_dir, f"{case_name}_t1ce.nii.gz")
    t2_path = os.path.join(case_dir, f"{case_name}_t2.nii.gz")

    with open(t1_path, "rb") as f: t1_bytes = f.read()
    with open(t1ce_path, "rb") as f: t1ce_bytes = f.read()
    with open(t2_path, "rb") as f: t2_bytes = f.read()
    with open(flair_path, "rb") as f: flair_bytes = f.read()

    # Run 1
    tensor_1, affine_1, _, _, _ = preprocess_modalities(
        t1_bytes, "t1.nii.gz",
        t1ce_bytes, "t1ce.nii.gz",
        t2_bytes, "t2.nii.gz",
        flair_bytes, "flair.nii.gz"
    )
    wt_1, tc_1, et_1 = run_inference(tensor_1)
    meshes_1 = generate_all_region_meshes(wt_1, tc_1, et_1, affine_1)

    # Run 2
    tensor_2, affine_2, _, _, _ = preprocess_modalities(
        t1_bytes, "t1.nii.gz",
        t1ce_bytes, "t1ce.nii.gz",
        t2_bytes, "t2.nii.gz",
        flair_bytes, "flair.nii.gz"
    )
    wt_2, tc_2, et_2 = run_inference(tensor_2)
    meshes_2 = generate_all_region_meshes(wt_2, tc_2, et_2, affine_2)

    # 1. Compare binary masks
    dice_wt = compute_dice(wt_1, wt_2)
    dice_tc = compute_dice(tc_1, tc_2)
    dice_et = compute_dice(et_1, et_2)

    assert dice_wt == 1.0, f"WT not reproducible: Dice={dice_wt}"
    assert dice_tc == 1.0, f"TC not reproducible: Dice={dice_tc}"
    assert dice_et == 1.0, f"ET not reproducible: Dice={dice_et}"

    diff_voxels = (wt_1 != wt_2).sum() + (tc_1 != tc_2).sum() + (et_1 != et_2).sum()
    assert diff_voxels == 0, f"Voxel mismatch across runs: {diff_voxels}"

    # 2. Compare mesh vertex counts and face counts
    for r in ["WT", "TC", "ET"]:
        vc1, vc2 = meshes_1[r]["vertex_count"], meshes_2[r]["vertex_count"]
        fc1, fc2 = meshes_1[r]["face_count"], meshes_2[r]["face_count"]
        assert vc1 == vc2, f"Mesh {r} vertex count mismatch: {vc1} vs {vc2}"
        assert fc1 == fc2, f"Mesh {r} face count mismatch: {fc1} vs {fc2}"

    return {
        "test": "inference_and_mesh_reproducibility",
        "case": case_name,
        "status": "PASS",
        "dice_wt_repeat": dice_wt,
        "dice_tc_repeat": dice_tc,
        "dice_et_repeat": dice_et,
        "voxel_difference_count": int(diff_voxels),
        "mesh_vertex_counts": {r: meshes_1[r]["vertex_count"] for r in ["WT", "TC", "ET"]},
    }

def run_reproducibility_tests(eval_data_dir: str = "./evaluation/data"):
    print("\n--- Running Reproducibility & Determinism Tests ---")
    case_dir = os.path.join(eval_data_dir, "BraTS2021_00002")
    res = test_inference_and_mesh_reproducibility(case_dir)
    print(f"[{res['status']}] {res['test']} on {res['case']}")
    return [res]

if __name__ == "__main__":
    run_reproducibility_tests()
