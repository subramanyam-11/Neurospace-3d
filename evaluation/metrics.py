"""
Quantitative evaluation metrics for brain tumor segmentation and volume agreement.
"""
import numpy as np

def compute_dice(pred: np.ndarray, gt: np.ndarray, eps: float = 1e-6) -> float:
    """
    Computes the Sørensen–Dice coefficient between binary predicted and ground-truth masks:
    Dice = 2 * |P ∩ G| / (|P| + |G| + eps)
    """
    pred_bool = pred.astype(bool)
    gt_bool = gt.astype(bool)
    pred_sum = int(pred_bool.sum())
    gt_sum = int(gt_bool.sum())
    total = pred_sum + gt_sum
    if total == 0:
        return 1.0  # Both empty -> perfect agreement
    intersection = int(np.logical_and(pred_bool, gt_bool).sum())
    if intersection == pred_sum and intersection == gt_sum:
        return 1.0  # Exact match
    return float((2.0 * intersection) / (total + eps))

def compute_sensitivity(pred: np.ndarray, gt: np.ndarray, eps: float = 1e-6) -> float:
    """
    Computes sensitivity (true positive rate / recall):
    Sensitivity = |P ∩ G| / (|G| + eps)
    """
    pred_bool = pred.astype(bool)
    gt_bool = gt.astype(bool)
    gt_sum = gt_bool.sum()
    if gt_sum == 0:
        return 1.0 if pred_bool.sum() == 0 else 0.0
    intersection = np.logical_and(pred_bool, gt_bool).sum()
    return float(intersection / (gt_sum + eps))

def compute_specificity(pred: np.ndarray, gt: np.ndarray, eps: float = 1e-6) -> float:
    """
    Computes specificity (true negative rate):
    Specificity = |TN| / (|TN| + |FP| + eps)
    """
    pred_bool = pred.astype(bool)
    gt_bool = gt.astype(bool)
    tn = np.logical_and(~pred_bool, ~gt_bool).sum()
    actual_neg = (~gt_bool).sum()
    if actual_neg == 0:
        return 1.0
    return float(tn / (actual_neg + eps))

def compute_volume_metrics(pred: np.ndarray, gt: np.ndarray, affine: np.ndarray) -> dict:
    """
    Computes physical volume agreement in cm³ using voxel dimensions derived from affine column norms:
    - Pred Volume (cm³)
    - Ground Truth Volume (cm³)
    - Absolute Volume Difference (cm³)
    - Relative Volume Error (%) = |V_pred - V_gt| / V_gt * 100
    """
    voxel_dims = np.sqrt((affine[:3, :3] ** 2).sum(axis=0))
    voxel_volume_cm3 = float(np.prod(voxel_dims)) / 1000.0

    pred_count = int(pred.astype(bool).sum())
    gt_count = int(gt.astype(bool).sum())

    pred_vol = round(pred_count * voxel_volume_cm3, 3)
    gt_vol = round(gt_count * voxel_volume_cm3, 3)
    abs_diff = round(abs(pred_vol - gt_vol), 3)

    if gt_vol > 0:
        rve_pct = round((abs_diff / gt_vol) * 100.0, 2)
    else:
        rve_pct = 0.0 if pred_vol == 0 else 100.0

    return {
        "pred_voxel_count": pred_count,
        "gt_voxel_count": gt_count,
        "pred_volume_cm3": pred_vol,
        "gt_volume_cm3": gt_vol,
        "abs_diff_cm3": abs_diff,
        "relative_volume_error_pct": rve_pct,
    }

def extract_ground_truth_subregions(seg: np.ndarray) -> dict:
    """
    Extracts canonical BraTS subregions from ground truth label volume:
    - WT (Whole Tumour): Labels 1, 2, 4
    - TC (Tumour Core): Labels 1, 4
    - ET (Enhancing Tumour): Label 4
    """
    gt_wt = (seg == 1) | (seg == 2) | (seg == 4)
    gt_tc = (seg == 1) | (seg == 4)
    gt_et = (seg == 4)
    return {
        "WT": gt_wt,
        "TC": gt_tc,
        "ET": gt_et,
    }
