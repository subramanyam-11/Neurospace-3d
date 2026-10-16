import io
import base64
import numpy as np
from PIL import Image

def slice_3d_volume(vol: np.ndarray, plane: str, index: int) -> np.ndarray:
    """Extracts a 2D slice from a 3D volume according to anatomical viewing conventions."""
    dimX, dimY, dimZ = vol.shape
    if plane == "axial":
        k = max(0, min(index, dimZ - 1))
        return vol[:, :, k].T
    elif plane == "coronal":
        j = max(0, min(index, dimY - 1))
        return np.flipud(vol[:, j, :].T)
    elif plane == "sagittal":
        i = max(0, min(index, dimX - 1))
        return np.flipud(vol[i, :, :].T)
    else:
        raise ValueError(f"Unknown plane: '{plane}'. Expected 'axial', 'coronal', or 'sagittal'.")

def extract_slice_data(
    volume: np.ndarray,
    seg_volume: np.ndarray,
    plane: str,
    index: int,
):
    """
    Extracts 2D slices from 3D MRI and segmentation volumes along an orthogonal plane.
    Returns: (mri_slice, seg_slice, actual_idx, max_idx)
    """
    dimX, dimY, dimZ = volume.shape

    if plane == "axial":
        actual_idx = max(0, min(index, dimZ - 1))
        max_idx = dimZ - 1
    elif plane == "coronal":
        actual_idx = max(0, min(index, dimY - 1))
        max_idx = dimY - 1
    elif plane == "sagittal":
        actual_idx = max(0, min(index, dimX - 1))
        max_idx = dimX - 1
    else:
        raise ValueError(f"Unknown plane: '{plane}'. Expected 'axial', 'coronal', or 'sagittal'.")

    mri_slice = slice_3d_volume(volume, plane, actual_idx)
    seg_slice = slice_3d_volume(seg_volume, plane, actual_idx) if seg_volume is not None else None

    return mri_slice, seg_slice, actual_idx, max_idx

def render_slice_image_b64(
    mri_slice: np.ndarray,
    seg_slice: np.ndarray = None,
    show_wt: bool = True,
    show_tc: bool = True,
    show_et: bool = True,
    wt_opacity: float = 0.35,
    tc_opacity: float = 0.65,
    et_opacity: float = 0.85,
    disagree_slice: np.ndarray = None,
    show_disagreement: bool = False,
    disagreement_opacity: float = 0.70,
    agree_slice: np.ndarray = None,
    render_mode: str = "predicted",  # 'predicted', 'expert', 'agreement'
    vmin: float = None,
    vmax: float = None,
) -> tuple:
    """
    Renders an orthogonal MRI slice as a base64-encoded PNG data URL with:
    - Model-predicted tumour subregion overlays (WT, TC, ET)
    - Optional Test-Time Augmentation disagreement / uncertainty heatmap overlay
    - Optional Reference agreement overlay (TP green, FP purple, FN coral)
    """
    # 1. Intensity windowing for MRI slice (1st to 99th percentile)
    if vmin is None or vmax is None:
        nz = mri_slice[mri_slice > 0]
        if len(nz) > 0:
            vmin = float(np.percentile(nz, 1))
            vmax = float(np.percentile(nz, 99))
        else:
            vmin, vmax = 0.0, 1.0

    denom = vmax - vmin if vmax > vmin else 1e-5
    norm = np.clip((mri_slice - vmin) / denom, 0, 1) * 255.0
    gray = norm.astype(np.uint8)

    # Base RGBA canvas
    rgba = np.stack([gray, gray, gray, np.full_like(gray, 255)], axis=-1).astype(np.float32)

    has_mask = False
    active_voxels = 0

    # 2. Agreement mode overlay (TP, FP, FN)
    if render_mode == "agreement" and agree_slice is not None:
        # agree_slice: 1 = TP (pred & gt), 2 = FP (pred & ~gt), 3 = FN (~pred & gt)
        active_voxels = int((agree_slice > 0).sum())
        has_mask = active_voxels > 0

        # True Positive: Vibrant Emerald Green [16, 185, 129]
        tp_mask = agree_slice == 1
        if tp_mask.any():
            op = max(0.0, min(1.0, wt_opacity * 1.2))
            rgba[tp_mask, 0] = (1.0 - op) * rgba[tp_mask, 0] + op * 16.0
            rgba[tp_mask, 1] = (1.0 - op) * rgba[tp_mask, 1] + op * 185.0
            rgba[tp_mask, 2] = (1.0 - op) * rgba[tp_mask, 2] + op * 129.0

        # False Positive: Violet / Purple [139, 92, 246]
        fp_mask = agree_slice == 2
        if fp_mask.any():
            op = max(0.0, min(1.0, wt_opacity * 1.3))
            rgba[fp_mask, 0] = (1.0 - op) * rgba[fp_mask, 0] + op * 139.0
            rgba[fp_mask, 1] = (1.0 - op) * rgba[fp_mask, 1] + op * 92.0
            rgba[fp_mask, 2] = (1.0 - op) * rgba[fp_mask, 2] + op * 246.0

        # False Negative: Coral / Amber [245, 158, 11]
        fn_mask = agree_slice == 3
        if fn_mask.any():
            op = max(0.0, min(1.0, wt_opacity * 1.3))
            rgba[fn_mask, 0] = (1.0 - op) * rgba[fn_mask, 0] + op * 245.0
            rgba[fn_mask, 1] = (1.0 - op) * rgba[fn_mask, 1] + op * 158.0
            rgba[fn_mask, 2] = (1.0 - op) * rgba[fn_mask, 2] + op * 11.0

    # 3. Standard / Expert segmentation overlays (WT, TC, ET)
    elif seg_slice is not None:
        active_voxels = int((seg_slice > 0).sum())
        has_mask = active_voxels > 0

        # Layer 1: Whole Tumour (WT) - Cyan [56, 189, 248]
        if show_wt and (seg_slice > 0).any():
            wt_mask = seg_slice > 0
            w_op = max(0.0, min(1.0, wt_opacity))
            rgba[wt_mask, 0] = (1.0 - w_op) * rgba[wt_mask, 0] + w_op * 56.0
            rgba[wt_mask, 1] = (1.0 - w_op) * rgba[wt_mask, 1] + w_op * 189.0
            rgba[wt_mask, 2] = (1.0 - w_op) * rgba[wt_mask, 2] + w_op * 248.0

        # Layer 2: Tumour Core (TC) - Amber [245, 158, 11] (labels 1 and 4)
        if show_tc and np.isin(seg_slice, [1, 4]).any():
            tc_mask = np.isin(seg_slice, [1, 4])
            t_op = max(0.0, min(1.0, tc_opacity))
            rgba[tc_mask, 0] = (1.0 - t_op) * rgba[tc_mask, 0] + t_op * 245.0
            rgba[tc_mask, 1] = (1.0 - t_op) * rgba[tc_mask, 1] + t_op * 158.0
            rgba[tc_mask, 2] = (1.0 - t_op) * rgba[tc_mask, 2] + t_op * 11.0

        # Layer 3: Enhancing Tumour (ET) - Crimson Red [239, 68, 68] (label 4)
        if show_et and (seg_slice == 4).any():
            et_mask = seg_slice == 4
            e_op = max(0.0, min(1.0, et_opacity))
            rgba[et_mask, 0] = (1.0 - e_op) * rgba[et_mask, 0] + e_op * 239.0
            rgba[et_mask, 1] = (1.0 - e_op) * rgba[et_mask, 1] + e_op * 68.0
            rgba[et_mask, 2] = (1.0 - e_op) * rgba[et_mask, 2] + e_op * 68.0

    # 4. Optional Model Disagreement / Uncertainty Overlay
    if show_disagreement and disagree_slice is not None and (disagree_slice > 0.05).any():
        # Heatmap colormap: stronger visual intensity where predictions disagree
        # Disagreement is between 0.0 and 1.0. Higher disagreement -> bright hot yellow/magenta
        d_mask = disagree_slice > 0.05
        d_val = np.clip(disagree_slice[d_mask], 0.0, 1.0)
        d_op = max(0.0, min(1.0, disagreement_opacity)) * d_val

        # Color ramp: 0.1 (gold/orange) -> 1.0 (bright yellow/white)
        # R: 255, G: 140 -> 240, B: 0 -> 80
        r_col = 255.0
        g_col = 140.0 + 100.0 * d_val
        b_col = 20.0 + 60.0 * d_val

        rgba[d_mask, 0] = (1.0 - d_op) * rgba[d_mask, 0] + d_op * r_col
        rgba[d_mask, 1] = (1.0 - d_op) * rgba[d_mask, 1] + d_op * g_col
        rgba[d_mask, 2] = (1.0 - d_op) * rgba[d_mask, 2] + d_op * b_col

    # 5. Encode to PNG
    img = Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")
    data_url = f"data:image/png;base64,{b64_str}"

    height, width = mri_slice.shape
    return data_url, width, height, has_mask, active_voxels
