"""
Milestone 4 — Core Evaluation: Quantitative Evaluation on 11 Held-out BraTS Cases.
Computes WT/TC/ET Dice, Sensitivity, Volume Agreement, and Correlation without accessing labels during inference.
"""
import os
import json
import time
import numpy as np
import nibabel as nib
from scipy.stats import pearsonr
from backend.app.preprocessing.pipeline import preprocess_modalities
from backend.app.inference.predictor import run_inference
from evaluation.metrics import (
    compute_dice,
    compute_sensitivity,
    compute_specificity,
    compute_volume_metrics,
    extract_ground_truth_subregions,
)

EVAL_CASES = [
    "BraTS2021_00002",
    "BraTS2021_00003",
    "BraTS2021_00005",
    "BraTS2021_00006",
    "BraTS2021_00008",
    "BraTS2021_00009",
    "BraTS2021_00011",
    "BraTS2021_00012",
    "BraTS2021_00014",
    "BraTS2021_00016",
    "BraTS2021_00017",
]

def evaluate_case(case_id: str, data_dir: str = "./evaluation/data") -> dict:
    case_path = os.path.join(data_dir, case_id)
    t1_path = os.path.join(case_path, f"{case_id}_t1.nii.gz")
    t1ce_path = os.path.join(case_path, f"{case_id}_t1ce.nii.gz")
    t2_path = os.path.join(case_path, f"{case_id}_t2.nii.gz")
    flair_path = os.path.join(case_path, f"{case_id}_flair.nii.gz")
    seg_path = os.path.join(case_path, f"{case_id}_seg.nii.gz")

    assert os.path.exists(t1_path), f"Missing T1 for {case_id}"
    assert os.path.exists(t1ce_path), f"Missing T1ce for {case_id}"
    assert os.path.exists(t2_path), f"Missing T2 for {case_id}"
    assert os.path.exists(flair_path), f"Missing FLAIR for {case_id}"
    assert os.path.exists(seg_path), f"Missing Ground Truth Seg for {case_id}"

    with open(t1_path, "rb") as f: t1_bytes = f.read()
    with open(t1ce_path, "rb") as f: t1ce_bytes = f.read()
    with open(t2_path, "rb") as f: t2_bytes = f.read()
    with open(flair_path, "rb") as f: flair_bytes = f.read()

    # 1. Inference pipeline (ZERO knowledge of ground truth labels)
    start_t = time.time()
    tensor_input, affine, header, base_shape, _ = preprocess_modalities(
        t1_bytes, f"{case_id}_t1.nii.gz",
        t1ce_bytes, f"{case_id}_t1ce.nii.gz",
        t2_bytes, f"{case_id}_t2.nii.gz",
        flair_bytes, f"{case_id}_flair.nii.gz"
    )
    pred_wt, pred_tc, pred_et = run_inference(tensor_input)
    infer_duration = round(time.time() - start_t, 2)

    # 2. Load ground truth segmentation post-inference
    seg_nii = nib.load(seg_path)
    seg_data = np.asanyarray(seg_nii.dataobj, dtype=np.int32)
    gt = extract_ground_truth_subregions(seg_data)

    # 3. Calculate metrics for each subregion
    subregions = ["WT", "TC", "ET"]
    case_results = {
        "case_id": case_id,
        "inference_seconds": infer_duration,
        "volume_shape": list(base_shape),
        "metrics": {},
    }

    preds = {"WT": pred_wt, "TC": pred_tc, "ET": pred_et}

    for sub in subregions:
        p = preds[sub]
        g = gt[sub]

        dice = round(compute_dice(p, g), 4)
        sens = round(compute_sensitivity(p, g), 4)
        spec = round(compute_specificity(p, g), 4)
        vol_info = compute_volume_metrics(p, g, affine)

        case_results["metrics"][sub] = {
            "dice": dice,
            "sensitivity": sens,
            "specificity": spec,
            "pred_volume_cm3": vol_info["pred_volume_cm3"],
            "gt_volume_cm3": vol_info["gt_volume_cm3"],
            "abs_diff_cm3": vol_info["abs_diff_cm3"],
            "relative_volume_error_pct": vol_info["relative_volume_error_pct"],
            "pred_voxel_count": vol_info["pred_voxel_count"],
            "gt_voxel_count": vol_info["gt_voxel_count"],
        }

    return case_results

def run_all_segmentation_evaluations(cases=EVAL_CASES, data_dir="./evaluation/data") -> dict:
    print(f"\n=======================================================")
    print(f"  NeuroScope 3D — Milestone 4: Held-out Segmentation Evaluation")
    print(f"  Evaluating {len(cases)} held-out labelled BraTS cases")
    print(f"=======================================================\n")

    case_summaries = []
    for idx, cid in enumerate(cases, 1):
        print(f"\n[{idx}/{len(cases)}] Processing {cid}...")
        res = evaluate_case(cid, data_dir=data_dir)
        case_summaries.append(res)
        m = res["metrics"]
        print(f"  -> WT: Dice={m['WT']['dice']:.4f}, Sens={m['WT']['sensitivity']:.4f}, Vol(Pred/GT)={m['WT']['pred_volume_cm3']}/{m['WT']['gt_volume_cm3']} cm³")
        print(f"  -> TC: Dice={m['TC']['dice']:.4f}, Sens={m['TC']['sensitivity']:.4f}, Vol(Pred/GT)={m['TC']['pred_volume_cm3']}/{m['TC']['gt_volume_cm3']} cm³")
        print(f"  -> ET: Dice={m['ET']['dice']:.4f}, Sens={m['ET']['sensitivity']:.4f}, Vol(Pred/GT)={m['ET']['pred_volume_cm3']}/{m['ET']['gt_volume_cm3']} cm³")

    # Compute Aggregate Statistics
    aggregates = {}
    for sub in ["WT", "TC", "ET"]:
        dices = [c["metrics"][sub]["dice"] for c in case_summaries]
        senss = [c["metrics"][sub]["sensitivity"] for c in case_summaries]
        specs = [c["metrics"][sub]["specificity"] for c in case_summaries]
        pred_vols = [c["metrics"][sub]["pred_volume_cm3"] for c in case_summaries]
        gt_vols = [c["metrics"][sub]["gt_volume_cm3"] for c in case_summaries]
        rves = [c["metrics"][sub]["relative_volume_error_pct"] for c in case_summaries]
        abs_diffs = [c["metrics"][sub]["abs_diff_cm3"] for c in case_summaries]

        # Pearson correlation for volume agreement
        corr, _ = pearsonr(pred_vols, gt_vols) if len(pred_vols) > 1 else (1.0, 0.0)

        aggregates[sub] = {
            "dice_mean": round(float(np.mean(dices)), 4),
            "dice_std": round(float(np.std(dices)), 4),
            "dice_median": round(float(np.median(dices)), 4),
            "dice_min": round(float(np.min(dices)), 4),
            "dice_max": round(float(np.max(dices)), 4),
            "sensitivity_mean": round(float(np.mean(senss)), 4),
            "sensitivity_std": round(float(np.std(senss)), 4),
            "specificity_mean": round(float(np.mean(specs)), 4),
            "mean_abs_volume_diff_cm3": round(float(np.mean(abs_diffs)), 2),
            "mean_relative_volume_error_pct": round(float(np.mean(rves)), 2),
            "volume_pearson_r": round(float(corr), 4),
        }

    total_time = sum(c["inference_seconds"] for c in case_summaries)
    mean_time = round(total_time / len(case_summaries), 2)

    report = {
        "num_cases_evaluated": len(cases),
        "mean_inference_seconds": mean_time,
        "cases": case_summaries,
        "aggregates": aggregates,
    }

    # Save to disk
    out_path = "./evaluation/segmentation_results.json"
    with open(out_path, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\nSaved quantitative results to {out_path}")
    return report

if __name__ == "__main__":
    run_all_segmentation_evaluations()
