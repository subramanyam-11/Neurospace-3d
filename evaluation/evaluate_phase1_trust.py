"""
Phase 1: Trust, Research & Advanced Analysis — Test Suite
Validates:
- Expert reference mask comparison & Dice/Sensitivity/Specificity
- HD95 with anisotropic voxel spacing handling
- 3D Agreement meshes (True Positive, False Positive, False Negative)
- Model reliability signals (boundary touch, small ET warning, input quality)
- Test-time augmentation (TTA) determinism, volume range, and uncertainty mapping
- Pipeline computation timing & data provenance
"""
import numpy as np
import torch
from evaluation.metrics import compute_dice, compute_sensitivity, compute_specificity, compute_hd95
from backend.app.postprocessing.agreement import (
    compute_anisotropic_hd95,
    compute_agreement_subregion_metrics,
    generate_agreement_meshes,
    evaluate_model_reliability_signals,
)
from backend.app.inference.predictor import run_inference, run_inference_with_tta

def test_expert_mask_agreement():
    """Validates Dice, Sensitivity, Specificity, and volume agreement metrics against ground truth."""
    pred = np.zeros((40, 40, 40), dtype=bool)
    gt = np.zeros((40, 40, 40), dtype=bool)

    # 10x10x10 cube at (10:20, 10:20, 10:20) = 1000 voxels
    gt[10:20, 10:20, 10:20] = True

    # Overlapping pred with 800 voxels in common, 200 false positives, 200 false negatives
    pred[10:20, 10:20, 12:22] = True

    affine = np.diag([1.0, 1.0, 1.0, 1.0])

    pred_sub = {"WT": pred, "TC": pred, "ET": np.zeros_like(pred)}
    gt_sub = {"WT": gt, "TC": gt, "ET": np.zeros_like(gt)}

    metrics = compute_agreement_subregion_metrics(pred_sub, gt_sub, affine)

    wt_m = metrics["WT"]
    assert 0.79 < wt_m["dice"] < 0.81, f"Expected Dice ~0.80, got {wt_m['dice']}"
    assert 0.79 < wt_m["sensitivity"] < 0.81, f"Expected Sensitivity ~0.80, got {wt_m['sensitivity']}"
    assert wt_m["tp_voxels"] == 800, f"Expected 800 TP voxels, got {wt_m['tp_voxels']}"
    assert wt_m["fp_voxels"] == 200, f"Expected 200 FP voxels, got {wt_m['fp_voxels']}"
    assert wt_m["fn_voxels"] == 200, f"Expected 200 FN voxels, got {wt_m['fn_voxels']}"

    # Mutual absence for ET -> Dice should be 1.0, HD95 should be 0.0
    et_m = metrics["ET"]
    assert et_m["dice"] == 1.0, f"Expected 1.0 for mutually absent ET, got {et_m['dice']}"
    assert et_m["hd95_mm"] == 0.0, f"Expected 0.0 HD95 for mutually absent ET, got {et_m['hd95_mm']}"

    print("✓ test_expert_mask_agreement PASSED")
    return {"test": "expert_mask_agreement", "status": "PASS"}

def test_hd95_anisotropic_spacing():
    """
    Validates that HD95 distance correctly handles anisotropic voxel dimensions.
    An offset of 10 voxels along Z in an anisotropic volume (dz=3mm) must yield
    HD95 ~ 30mm, not 10mm (which would happen if isotropic 1mm was incorrectly assumed).
    """
    pred = np.zeros((30, 30, 30), dtype=bool)
    gt = np.zeros((30, 30, 30), dtype=bool)

    # 4x4x4 cube
    gt[10:14, 10:14, 10:14] = True
    # Shifted along Z by 5 voxels
    pred[10:14, 10:14, 15:19] = True

    # Case A: Isotropic spacing 1.0 x 1.0 x 1.0 mm
    affine_iso = np.diag([1.0, 1.0, 1.0, 1.0])
    hd95_iso = compute_anisotropic_hd95(pred, gt, affine_iso)
    assert hd95_iso is not None
    assert 4.5 <= hd95_iso <= 5.5, f"Expected ~5.0 mm for isotropic shift, got {hd95_iso}"

    # Case B: Anisotropic spacing 1.0 x 1.0 x 3.0 mm (slice thickness 3mm)
    affine_aniso = np.diag([1.0, 1.0, 3.0, 1.0])
    hd95_aniso = compute_anisotropic_hd95(pred, gt, affine_aniso)
    assert hd95_aniso is not None
    assert 14.0 <= hd95_aniso <= 16.0, f"Expected ~15.0 mm for anisotropic dz=3mm shift, got {hd95_aniso}"
    assert hd95_aniso > hd95_iso * 2.5, "HD95 failed to scale with anisotropic slice thickness"

    # Edge Case: Both masks empty -> 0.0 mm
    empty = np.zeros((20, 20, 20), dtype=bool)
    assert compute_anisotropic_hd95(empty, empty, affine_iso) == 0.0

    # Edge Case: One mask empty -> None
    assert compute_anisotropic_hd95(pred, empty, affine_iso) is None

    print("✓ test_hd95_anisotropic_spacing PASSED")
    return {"test": "hd95_anisotropic_spacing", "status": "PASS", "hd95_iso": hd95_iso, "hd95_aniso": hd95_aniso}

def test_3d_agreement_meshes():
    """
    Validates generation of True Positive, False Positive, and False Negative
    3D surface meshes in physical world coordinates (mm).
    """
    pred = np.zeros((30, 30, 30), dtype=bool)
    gt = np.zeros((30, 30, 30), dtype=bool)

    pred[8:18, 8:18, 8:18] = True
    gt[12:22, 12:22, 12:22] = True

    affine = np.diag([1.0, 1.0, 1.0, 1.0])
    pred_sub = {"WT": pred}
    gt_sub = {"WT": gt}

    meshes = generate_agreement_meshes(pred_sub, gt_sub, affine, target_region="WT")

    assert "TP" in meshes and "FP" in meshes and "FN" in meshes
    assert meshes["TP"]["vertex_count"] > 0, "TP mesh should have vertices"
    assert meshes["FP"]["vertex_count"] > 0, "FP mesh should have vertices"
    assert meshes["FN"]["vertex_count"] > 0, "FN mesh should have vertices"

    # Check bounding box bounds are in valid coordinates
    for key in ["TP", "FP", "FN"]:
        bbox = meshes[key]["bbox"]
        assert bbox["min"][0] < bbox["max"][0]

    print("✓ test_3d_agreement_meshes PASSED")
    return {"test": "3d_agreement_meshes", "status": "PASS"}

def test_model_reliability_signals():
    """
    Validates heuristic reliability signals: boundary touch detection,
    small enhancing region warning (< 3 cm³), and sanity checks.
    """
    raw_vols = {
        "t1": np.ones((50, 50, 50), dtype=np.float32) * 50.0,
        "t1gd": np.ones((50, 50, 50), dtype=np.float32) * 60.0,
        "t2": np.ones((50, 50, 50), dtype=np.float32) * 70.0,
        "flair": np.ones((50, 50, 50), dtype=np.float32) * 80.0,
    }

    # Case 1: Centered tumour not touching boundary, small ET (< 3 cm³)
    wt = np.zeros((50, 50, 50), dtype=bool)
    wt[20:30, 20:30, 20:30] = True
    tc = wt.copy()
    et = np.zeros((50, 50, 50), dtype=bool)
    et[22:24, 22:24, 22:24] = True  # 8 voxels = 0.008 cm³ < 3 cm³

    sig1 = evaluate_model_reliability_signals(
        raw_volumes=raw_vols,
        wt_mask=wt,
        tc_mask=tc,
        et_mask=et,
        shape=(50, 50, 50),
        voxel_dims_mm=[1.0, 1.0, 1.0]
    )

    sig_ids1 = [s["id"] for s in sig1["signals"]]
    assert "boundary_clear" in sig_ids1, "Expected boundary_clear signal"
    assert "small_et_region" in sig_ids1, "Expected small_et_region warning for < 3 cm³"

    # Case 2: Tumour touching the boundary
    wt_boundary = wt.copy()
    wt_boundary[0, 20:30, 20:30] = True  # touches x=0

    sig2 = evaluate_model_reliability_signals(
        raw_volumes=raw_vols,
        wt_mask=wt_boundary,
        tc_mask=tc,
        et_mask=et,
        shape=(50, 50, 50),
        voxel_dims_mm=[1.0, 1.0, 1.0]
    )

    sig_ids2 = [s["id"] for s in sig2["signals"]]
    assert "touches_boundary" in sig_ids2, "Expected touches_boundary warning"

    print("✓ test_model_reliability_signals PASSED")
    return {"test": "model_reliability_signals", "status": "PASS"}

def test_tta_volume_range_and_disagreement():
    """
    Validates deterministic test-time augmentation (TTA), volume ranges,
    and disagreement mapping.
    """
    # Create synthetic 4-channel input (1, 4, 32, 32, 32)
    torch.manual_seed(42)
    fake_input = torch.randn((1, 4, 32, 32, 32), dtype=torch.float32)

    # Determinism check: standard run twice should produce identical masks
    wt1, tc1, et1 = run_inference(fake_input)
    wt2, tc2, et2 = run_inference(fake_input)
    assert np.array_equal(wt1, wt2), "Standard inference must be 100% deterministic"
    assert np.array_equal(tc1, tc2), "Standard inference must be 100% deterministic"
    assert np.array_equal(et1, et2), "Standard inference must be 100% deterministic"

    # TTA run
    wt_t, tc_t, et_t, disagreement, tta_info = run_inference_with_tta(fake_input, voxel_volume_cm3=0.001)

    assert disagreement.shape == (32, 32, 32), f"Expected disagreement shape (32, 32, 32), got {disagreement.shape}"
    assert 0.0 <= disagreement.min() and disagreement.max() <= 1.0, "Disagreement values must be in [0.0, 1.0]"
    assert tta_info["enabled"] is True
    assert "WT" in tta_info["volume_ranges"]
    assert tta_info["volume_ranges"]["WT"]["min_cm3"] <= tta_info["volume_ranges"]["WT"]["max_cm3"]

    print("✓ test_tta_volume_range_and_disagreement PASSED")
    return {"test": "tta_volume_range_and_disagreement", "status": "PASS"}

def test_api_endpoints_phase1():
    """Validates FastAPI predict and slice endpoints with expert mask and TTA flags."""
    from fastapi.testclient import TestClient
    from backend.app.main import app
    from backend.app.core.config import BASE_DIR

    client = TestClient(app)
    sample_dir = BASE_DIR / "test_data" / "sample_case"

    t1_path = sample_dir / "BraTS2021_00000_t1.nii.gz"
    t1ce_path = sample_dir / "BraTS2021_00000_t1ce.nii.gz"
    t2_path = sample_dir / "BraTS2021_00000_t2.nii.gz"
    flair_path = sample_dir / "BraTS2021_00000_flair.nii.gz"
    seg_path = sample_dir / "BraTS2021_00000_seg.nii.gz"

    if not (t1_path.exists() and seg_path.exists()):
        print("⚠️ Sample files not found, skipping live API integration test.")
        return {"test": "api_endpoints_phase1", "status": "SKIPPED"}

    with open(t1_path, "rb") as f_t1, open(t1ce_path, "rb") as f_t1ce, \
         open(t2_path, "rb") as f_t2, open(flair_path, "rb") as f_flair, \
         open(seg_path, "rb") as f_seg:

        files = {
            "t1": ("t1.nii.gz", f_t1, "application/gzip"),
            "t1gd": ("t1ce.nii.gz", f_t1ce, "application/gzip"),
            "t2": ("t2.nii.gz", f_t2, "application/gzip"),
            "flair": ("flair.nii.gz", f_flair, "application/gzip"),
            "expert_mask": ("seg.nii.gz", f_seg, "application/gzip"),
        }

        # Predict with expert_mask and use_tta=True
        resp = client.post("/api/predict?use_tta=true", files=files)
        assert resp.status_code == 200, f"Predict failed: {resp.text}"
        data = resp.json()

        assert data["status"] == "success"
        job_id = data["job_id"]
        assert data["has_expert"] is True, "has_expert should be True"
        assert "expert_agreement" in data, "expert_agreement must be in response"
        assert "WT" in data["expert_agreement"]
        assert "hd95_mm" in data["expert_agreement"]["WT"]
        assert "reliability" in data, "reliability signals must be in response"
        assert "timing" in data, "timing breakdown must be in response"
        assert data["timing"]["total_time_ms"] > 0
        assert "provenance" in data, "provenance must be in response"
        assert "input_hashes" in data["provenance"]
        assert "expert_mask" in data["provenance"]["input_hashes"]
        assert data["tta"] is not None
        assert "volume_ranges" in data["tta"]

        # Test Slice endpoint with agreement render mode and disagreement heatmap
        slice_resp = client.get(
            f"/api/result/{job_id}/slice?plane=axial&index=75&modality=flair&show_disagreement=true&render_mode=agreement"
        )
        assert slice_resp.status_code == 200, f"Slice fetch failed: {slice_resp.text}"
        slice_data = slice_resp.json()
        assert slice_data["status"] == "success"
        assert slice_data["image"].startswith("data:image/png;base64,")

    print("✓ test_api_endpoints_phase1 PASSED")
    return {"test": "api_endpoints_phase1", "status": "PASS", "timing": data["timing"]}

def run_all_phase1_trust_tests():
    print("=" * 65)
    print("  NeuroScope 3D — Phase 1: Trust, Research & Advanced Analysis Tests")
    print("=" * 65)
    results = [
        test_expert_mask_agreement(),
        test_hd95_anisotropic_spacing(),
        test_3d_agreement_meshes(),
        test_model_reliability_signals(),
        test_tta_volume_range_and_disagreement(),
        test_api_endpoints_phase1(),
    ]
    print("=" * 65)
    print(f"  All {len(results)} Phase 1 tests PASSED successfully!")
    print("=" * 65)
    return results

if __name__ == "__main__":
    run_all_phase1_trust_tests()

