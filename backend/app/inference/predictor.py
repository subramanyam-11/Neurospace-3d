import numpy as np
import torch
from monai.inferers import sliding_window_inference
from backend.app.core.config import DEVICE
from backend.app.models.segresnet import get_segresnet_model

def _predict_single_pass(model, tensor_input: torch.Tensor, roi_size: tuple) -> torch.Tensor:
    """Helper for a single deterministic sliding window inference pass."""
    pred_logits = sliding_window_inference(
        inputs=tensor_input,
        roi_size=roi_size,
        sw_batch_size=1,
        predictor=model,
        overlap=0.25,
        mode="gaussian",
    )
    return torch.sigmoid(pred_logits).squeeze(0)  # (3, H, W, D)

def run_inference(tensor_input: torch.Tensor, device: torch.device = None):
    """
    Executes sliding window inference using the pretrained SegResNet model.
    Returns binary masks for WT, TC, and ET. Exactly reproducible and deterministic.
    """
    if device is None:
        device = DEVICE

    model = get_segresnet_model(device=device)
    print(f"[NeuroScope] Using device: {device}")
    print("[NeuroScope] Running SegResNet (Standard Deterministic)...")

    tensor_input = tensor_input.to(device)

    with torch.no_grad():
        H, W, D = tensor_input.shape[2:]
        roi_size = (min(240, H), min(240, W), min(160, D))
        roi_size = (
            roi_size[0] - roi_size[0] % 16,
            roi_size[1] - roi_size[1] % 16,
            roi_size[2] - roi_size[2] % 16,
        )
        pred_sigmoid = _predict_single_pass(model, tensor_input, roi_size)
        pred_binary = (pred_sigmoid > 0.5).float().cpu().numpy()  # (3, H, W, D)

    # MONAI brats_mri_segmentation: 0: TC, 1: WT, 2: ET
    tc_mask = pred_binary[0] > 0
    wt_mask = pred_binary[1] > 0
    et_mask = pred_binary[2] > 0

    print("[NeuroScope] Predicted mask statistics:")
    print(f"  Whole Tumour (WT) active voxels:    {wt_mask.sum():,} voxels")
    print(f"  Tumour Core (TC) active voxels:     {tc_mask.sum():,} voxels")
    print(f"  Enhancing Tumour (ET) active voxels: {et_mask.sum():,} voxels")

    return wt_mask, tc_mask, et_mask

def run_inference_with_tta(tensor_input: torch.Tensor, voxel_volume_cm3: float, device: torch.device = None):
    """
    Executes a deterministic test-time augmentation pipeline:
    1. Standard pass
    2. Left-Right spatial flip along the sagittal axis (dim 2), mapped back to original coordinates.

    Calculates voxel-wise disagreement map across runs and robustness volume ranges.
    Research reliability signal — not clinical probability.
    """
    if device is None:
        device = DEVICE

    model = get_segresnet_model(device=device)
    print(f"[NeuroScope] Using device: {device}")
    print("[NeuroScope] Running SegResNet with Test-Time Augmentation (Original + Left-Right Flip)...")

    tensor_input = tensor_input.to(device)

    with torch.no_grad():
        H, W, D = tensor_input.shape[2:]
        roi_size = (min(240, H), min(240, W), min(160, D))
        roi_size = (
            roi_size[0] - roi_size[0] % 16,
            roi_size[1] - roi_size[1] % 16,
            roi_size[2] - roi_size[2] % 16,
        )

        # Pass 1: Original input (standard deterministic prediction)
        sig_orig = _predict_single_pass(model, tensor_input, roi_size)  # (3, H, W, D)

        # Pass 2: Left-Right flip along sagittal axis (dim 2 of tensor: (B, C, H, W, D))
        input_flipped = torch.flip(tensor_input, dims=[2])
        sig_flipped = _predict_single_pass(model, input_flipped, roi_size)
        # Map back to original coordinate system
        sig_flipped_back = torch.flip(sig_flipped, dims=[1])  # dims=[1] of (3, H, W, D) is H

        # Disagreement map across all channels (0.0 to 1.0)
        disagreement_tensor = torch.abs(sig_orig - sig_flipped_back).max(dim=0)[0]  # (H, W, D)
        disagreement_np = disagreement_tensor.cpu().numpy().astype(np.float32)

        # Standard masks from original pass
        pred_binary_orig = (sig_orig > 0.5).float().cpu().numpy()
        pred_binary_flip = (sig_flipped_back > 0.5).float().cpu().numpy()

    # Masks (0: TC, 1: WT, 2: ET)
    tc_mask = pred_binary_orig[0] > 0
    wt_mask = pred_binary_orig[1] > 0
    et_mask = pred_binary_orig[2] > 0

    tc_mask_flip = pred_binary_flip[0] > 0
    wt_mask_flip = pred_binary_flip[1] > 0
    et_mask_flip = pred_binary_flip[2] > 0

    # Calculate volume ranges (cm³) across the two deterministic runs
    def _vol_range(mask1, mask2):
        v1 = round(float(mask1.sum()) * voxel_volume_cm3, 2)
        v2 = round(float(mask2.sum()) * voxel_volume_cm3, 2)
        return {
            "run1_cm3": v1,
            "run2_cm3": v2,
            "min_cm3": min(v1, v2),
            "max_cm3": max(v1, v2),
            "range_str": f"{min(v1, v2):.1f} – {max(v1, v2):.1f} mL",
        }

    volume_ranges = {
        "WT": _vol_range(wt_mask, wt_mask_flip),
        "TC": _vol_range(tc_mask, tc_mask_flip),
        "ET": _vol_range(et_mask, et_mask_flip),
    }

    # Summary statistics of disagreement
    if wt_mask.sum() > 0:
        mean_disagree = float(disagreement_np[wt_mask].mean()) * 100.0
    else:
        mean_disagree = 0.0
    max_disagree = float(disagreement_np.max()) * 100.0

    tta_info = {
        "enabled": True,
        "runs": 2,
        "description": "Deterministic augmented runs (Original + Left-Right sagittal reflection)",
        "mean_disagreement_pct": round(mean_disagree, 2),
        "max_disagreement_pct": round(max_disagree, 2),
        "volume_ranges": volume_ranges,
        "disclaimer": "Range across deterministic augmented inference runs. Research reliability signal — not clinical probability.",
    }

    print(f"[NeuroScope] TTA complete. Mean disagreement in WT: {mean_disagree:.2f}%, Max: {max_disagree:.2f}%")
    return wt_mask, tc_mask, et_mask, disagreement_np, tta_info

