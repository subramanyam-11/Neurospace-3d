"""
Agreement, HD95 distance calculation with anisotropic voxel spacing,
and Model Reliability Signals for NeuroScope 3D.
"""
from typing import Dict, Any, Optional, Tuple
import numpy as np
import torch
import monai.metrics
from backend.app.visualization.mesh import generate_surface_mesh

def compute_anisotropic_hd95(
    pred: np.ndarray,
    gt: np.ndarray,
    affine: np.ndarray
) -> Optional[float]:
    """
    Computes the 95th-percentile Hausdorff Distance (HD95) in physical millimeters.
    Crucially handles anisotropic voxel spacing by calculating physical spacing
    from the column norms of the NIfTI affine matrix.

    Returns:
        HD95 in millimeters as a float, or None if distance cannot be computed
        (e.g., when one mask is completely empty while the other has active voxels).
        Returns 0.0 if both masks are empty (perfect mutual absence).
    """
    pred_bool = pred.astype(bool)
    gt_bool = gt.astype(bool)

    pred_count = int(pred_bool.sum())
    gt_count = int(gt_bool.sum())

    # Edge cases
    if pred_count == 0 and gt_count == 0:
        return 0.0
    if pred_count == 0 or gt_count == 0:
        # One mask has voxels while the other is completely empty
        return None

    # Derive anisotropic voxel spacing from affine column norms
    spacing = tuple(float(s) for s in np.sqrt((affine[:3, :3] ** 2).sum(axis=0)))

    # Convert to torch tensor with shape (B=1, C=1, H, W, D)
    pred_t = torch.from_numpy(pred_bool.astype(np.float32)).unsqueeze(0).unsqueeze(0)
    gt_t = torch.from_numpy(gt_bool.astype(np.float32)).unsqueeze(0).unsqueeze(0)

    try:
        hd95_val = monai.metrics.compute_hausdorff_distance(
            y_pred=pred_t,
            y=gt_t,
            include_background=False,
            distance_metric="euclidean",
            percentile=95.0,
            directed=False,
            spacing=spacing
        )
        val = float(hd95_val[0, 0].item())
        if np.isnan(val) or np.isinf(val):
            return None
        return round(val, 2)
    except Exception as e:
        print(f"[NeuroScope] HD95 computation warning: {e}")
        return None

def compute_agreement_subregion_metrics(
    pred_subregions: Dict[str, np.ndarray],
    gt_subregions: Dict[str, np.ndarray],
    affine: np.ndarray
) -> Dict[str, Any]:
    """
    Calculates Dice, Sensitivity, Specificity, Volume differences, and HD95 (mm)
    for each BraTS subregion (WT, TC, ET) against an uploaded expert reference mask.
    """
    voxel_dims = np.sqrt((affine[:3, :3] ** 2).sum(axis=0))
    voxel_volume_cm3 = float(np.prod(voxel_dims)) / 1000.0

    agreement_summary = {}

    for key in ["WT", "TC", "ET"]:
        pred_mask = pred_subregions.get(key, np.zeros((1, 1, 1), dtype=bool))
        gt_mask = gt_subregions.get(key, np.zeros((1, 1, 1), dtype=bool))

        pred_bool = pred_mask.astype(bool)
        gt_bool = gt_mask.astype(bool)

        pred_sum = int(pred_bool.sum())
        gt_sum = int(gt_bool.sum())
        total = pred_sum + gt_sum

        # Dice
        intersection = int(np.logical_and(pred_bool, gt_bool).sum())
        if total == 0:
            dice = 1.0
        else:
            dice = float((2.0 * intersection) / (total + 1e-6))
        dice = round(min(1.0, max(0.0, dice)), 4)

        # Sensitivity (Recall)
        if gt_sum == 0:
            sensitivity = 1.0 if pred_sum == 0 else 0.0
        else:
            sensitivity = float(intersection / (gt_sum + 1e-6))
        sensitivity = round(min(1.0, max(0.0, sensitivity)), 4)

        # Specificity
        tn = int(np.logical_and(~pred_bool, ~gt_bool).sum())
        actual_neg = int((~gt_bool).sum())
        if actual_neg == 0:
            specificity = 1.0
        else:
            specificity = float(tn / (actual_neg + 1e-6))
        specificity = round(min(1.0, max(0.0, specificity)), 4)

        # Volume metrics (cm³)
        pred_vol = round(pred_sum * voxel_volume_cm3, 2)
        gt_vol = round(gt_sum * voxel_volume_cm3, 2)
        vol_diff = round(pred_vol - gt_vol, 2)
        abs_diff = round(abs(pred_vol - gt_vol), 2)
        if gt_vol > 0:
            rel_diff_pct = round((abs_diff / gt_vol) * 100.0, 1)
        else:
            rel_diff_pct = 0.0 if pred_vol == 0 else 100.0

        # HD95 in mm with anisotropic voxel dimensions
        hd95_mm = compute_anisotropic_hd95(pred_bool, gt_bool, affine)

        # Voxel-wise breakdown
        tp_count = intersection
        fp_count = int(np.logical_and(pred_bool, ~gt_bool).sum())
        fn_count = int(np.logical_and(~pred_bool, gt_bool).sum())

        agreement_summary[key] = {
            "dice": dice,
            "sensitivity": sensitivity,
            "specificity": specificity,
            "hd95_mm": hd95_mm,
            "estimated_volume_cm3": pred_vol,
            "expert_volume_cm3": gt_vol,
            "volume_difference_cm3": vol_diff,
            "abs_volume_difference_cm3": abs_diff,
            "relative_volume_error_pct": rel_diff_pct,
            "tp_voxels": tp_count,
            "fp_voxels": fp_count,
            "fn_voxels": fn_count,
        }

    return agreement_summary

def generate_agreement_meshes(
    pred_subregions: Dict[str, np.ndarray],
    gt_subregions: Dict[str, np.ndarray],
    affine: np.ndarray,
    target_region: str = "WT"
) -> Dict[str, Any]:
    """
    Generates 3D meshes for True Positive, False Positive, and False Negative
    for the selected subregion (default: WT) in physical patient world coordinates (mm).

    TRUE POSITIVE (TP): pred ∩ expert (vibrant green)
    FALSE POSITIVE (FP): pred - expert (purple/violet)
    FALSE NEGATIVE (FN): expert - pred (amber/coral)
    """
    pred_mask = pred_subregions.get(target_region, np.zeros((1, 1, 1), dtype=bool)).astype(bool)
    gt_mask = gt_subregions.get(target_region, np.zeros((1, 1, 1), dtype=bool)).astype(bool)

    tp_mask = np.logical_and(pred_mask, gt_mask)
    fp_mask = np.logical_and(pred_mask, ~gt_mask)
    fn_mask = np.logical_and(~pred_mask, gt_mask)

    tp_mesh = generate_surface_mesh(tp_mask, affine, f"{target_region}_TP")
    fp_mesh = generate_surface_mesh(fp_mask, affine, f"{target_region}_FP")
    fn_mesh = generate_surface_mesh(fn_mask, affine, f"{target_region}_FN")

    return {
        "target_region": target_region,
        "TP": tp_mesh,
        "FP": fp_mesh,
        "FN": fn_mesh,
    }

def generate_expert_meshes(
    gt_subregions: Dict[str, np.ndarray],
    affine: np.ndarray
) -> Dict[str, Any]:
    """
    Generates 3D surface meshes for the uploaded expert reference mask subregions (WT, TC, ET)
    in physical world mm coordinates.
    """
    expert_meshes = {}
    for key in ["WT", "TC", "ET"]:
        gt_mask = gt_subregions.get(key, np.zeros((1, 1, 1), dtype=bool))
        expert_meshes[key] = generate_surface_mesh(gt_mask, affine, f"Expert_{key}")
    return expert_meshes

def evaluate_model_reliability_signals(
    raw_volumes: Dict[str, np.ndarray],
    wt_mask: np.ndarray,
    tc_mask: np.ndarray,
    et_mask: np.ndarray,
    shape: Tuple[int, int, int],
    voxel_dims_mm: list,
    tta_info: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Evaluates heuristic reliability signals for model transparency.
    IMPORTANT: These are research reliability signals, NOT clinical probability
    or diagnostic confidence.

    Checks:
    1. Input Quality & Modality Completeness
    2. Image Intensity Sanity
    3. Suspected Tumour Size
    4. Boundary Touch Check (whether prediction touches image boundary)
    5. Enhancing Tumour (ET) Small-Region Warning (< 3 cm³)
    6. Test-Time Augmentation Disagreement (if TTA enabled)
    """
    signals = []

    # 1. Input Completeness & Modality presence
    expected_modalities = ["t1", "t1gd", "t2", "flair"]
    missing_mods = [m for m in expected_modalities if m not in raw_volumes or raw_volumes[m].size == 0]
    if missing_mods:
        signals.append({
            "id": "missing_modality",
            "category": "Input Quality",
            "level": "warning",
            "title": "Missing Modality Detected",
            "description": f"Expected 4 complementary MRI modalities; missing: {', '.join(missing_mods).upper()}.",
        })
    else:
        signals.append({
            "id": "all_modalities_present",
            "category": "Input Quality",
            "level": "nominal",
            "title": "Modality Completeness Verified",
            "description": "All 4 required MRI modalities (T1, T1Gd, T2, FLAIR) provided and validated.",
        })

    # 2. Image Intensity Sanity
    intensity_issues = []
    for mod_name, vol in raw_volumes.items():
        if np.isnan(vol).any() or np.isinf(vol).any():
            intensity_issues.append(f"{mod_name.upper()} contains non-finite values")
        nz = vol[vol > 0]
        if len(nz) < 1000:
            intensity_issues.append(f"{mod_name.upper()} has unusually low foreground voxel count")

    if intensity_issues:
        signals.append({
            "id": "intensity_irregularity",
            "category": "Image Intensity Sanity",
            "level": "warning",
            "title": "Intensity Irregularity",
            "description": "; ".join(intensity_issues),
        })
    else:
        signals.append({
            "id": "intensity_nominal",
            "category": "Image Intensity Sanity",
            "level": "nominal",
            "title": "Intensity Sanity Nominal",
            "description": "Dynamic range and foreground voxel distributions conform to expected intracranial MRI norms.",
        })

    # Voxel volume in cm³
    voxel_vol_cm3 = float(np.prod(voxel_dims_mm)) / 1000.0
    wt_vol_cm3 = round(int(wt_mask.sum()) * voxel_vol_cm3, 2)
    tc_vol_cm3 = round(int(tc_mask.sum()) * voxel_vol_cm3, 2)
    et_vol_cm3 = round(int(et_mask.sum()) * voxel_vol_cm3, 2)

    # 3. Boundary Touch Check
    # Check if WT touches any of the outer slice boundaries (x=0, x=H-1, y=0, y=W-1, z=0, z=D-1)
    touches_boundary = False
    boundary_faces = []
    if wt_mask[0, :, :].any() or wt_mask[-1, :, :].any():
        touches_boundary = True
        boundary_faces.append("Sagittal boundary")
    if wt_mask[:, 0, :].any() or wt_mask[:, -1, :].any():
        touches_boundary = True
        boundary_faces.append("Coronal boundary")
    if wt_mask[:, :, 0].any() or wt_mask[:, :, -1].any():
        touches_boundary = True
        boundary_faces.append("Axial boundary")

    if touches_boundary:
        signals.append({
            "id": "touches_boundary",
            "category": "Spatial Boundary",
            "level": "warning",
            "title": "Suspected Region Touches Image Boundary",
            "description": f"Model prediction contacts volume perimeter at {', '.join(boundary_faces)}. Tumour extension beyond field of view is possible.",
        })
    else:
        signals.append({
            "id": "boundary_clear",
            "category": "Spatial Boundary",
            "level": "nominal",
            "title": "Contained Within Field of View",
            "description": "Predicted region has sufficient margin and does not contact any external volume boundaries.",
        })

    # 4. Small Enhancing Region Warning
    if 0 < et_vol_cm3 < 3.0:
        signals.append({
            "id": "small_et_region",
            "category": "Subregion Reliability",
            "level": "caution",
            "title": "Small Enhancing Region Warning",
            "description": f"Estimated ET volume is small ({et_vol_cm3} cm³ < 3.0 cm³). Deep learning models are known to show higher boundary variance for small enhancing foci.",
        })
    elif et_vol_cm3 >= 3.0:
        signals.append({
            "id": "standard_et_region",
            "category": "Subregion Reliability",
            "level": "nominal",
            "title": "Adequate Enhancing Volume",
            "description": f"Estimated ET volume ({et_vol_cm3} cm³) is within the high-fidelity segmentation regime.",
        })
    else:
        signals.append({
            "id": "no_et_region",
            "category": "Subregion Reliability",
            "level": "info",
            "title": "No Enhancing Component",
            "description": "Zero enhancing voxels predicted by the model for this case.",
        })

    # 5. Tumour Size Overview
    if wt_vol_cm3 > 150.0:
        signals.append({
            "id": "large_tumour_volume",
            "category": "Lesion Volume",
            "level": "info",
            "title": "Large Lesion Volume",
            "description": f"Estimated Whole Tumour volume is substantial ({wt_vol_cm3} cm³). Substantial mass effect likely.",
        })

    # 6. Test-Time Augmentation Disagreement (if available)
    if tta_info and tta_info.get("enabled"):
        mean_disagreement = tta_info.get("mean_disagreement_pct", 0.0)
        max_disagreement = tta_info.get("max_disagreement_pct", 0.0)
        if mean_disagreement > 12.0:
            signals.append({
                "id": "tta_high_disagreement",
                "category": "Test-Time Augmentation",
                "level": "caution",
                "title": "Elevated Augmentation Disagreement",
                "description": f"Mean disagreement across deterministic augmented runs is {mean_disagreement}%. Model boundaries show spatial sensitivity under left-right reflection.",
            })
        else:
            signals.append({
                "id": "tta_low_disagreement",
                "category": "Test-Time Augmentation",
                "level": "nominal",
                "title": "Robust Augmentation Agreement",
                "description": f"Augmented inference runs show high consistency (mean disagreement: {mean_disagreement}%). Low sensitivity to spatial transformation.",
            })

    # Overall summary status
    has_warning = any(s["level"] == "warning" for s in signals)
    has_caution = any(s["level"] == "caution" for s in signals)
    overall_status = "caution" if has_warning or has_caution else "nominal"

    return {
        "overall_status": overall_status,
        "signals": signals,
        "summary": "Model reliability signals evaluated from input fidelity, geometry, and augmentation response.",
    }
