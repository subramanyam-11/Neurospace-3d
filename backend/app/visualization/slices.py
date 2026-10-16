import io
import base64
import numpy as np
from PIL import Image

def extract_slice_data(volume: np.ndarray, seg_volume: np.ndarray, plane: str, index: int):
    """
    Extracts a 2D slice from the 3D MRI volume and segmentation volume
    along the specified orthogonal plane with correct radiological orientation.
    
    Plane definitions:
    - axial: constant Z (axis 2, index k). Horizontal plane (X=col, Y=row).
             Anterior on top, Posterior on bottom.
    - coronal: constant Y (axis 1, index j). Frontal plane (X=col, Z=row).
               Superior on top, Inferior on bottom.
    - sagittal: constant X (axis 0, index i). Profile plane (Y=col, Z=row).
                Superior on top, Inferior on bottom.
    """
    dimX, dimY, dimZ = volume.shape

    if plane == "axial":
        k = max(0, min(index, dimZ - 1))
        # volume[:, :, k] has shape (dimX, dimY).
        # In LPS: Y=0 is Anterior, Y=239 is Posterior.
        # Transpose so rows are Y (Anterior->Posterior) and cols are X.
        mri_slice = volume[:, :, k].T
        seg_slice = seg_volume[:, :, k].T if seg_volume is not None else None
        return mri_slice, seg_slice, k, dimZ - 1

    elif plane == "coronal":
        j = max(0, min(index, dimY - 1))
        # volume[:, j, :] has shape (dimX, dimZ).
        # We want Superior (higher Z) on top, so transpose and flip vertical.
        mri_slice = np.flipud(volume[:, j, :].T)
        seg_slice = np.flipud(seg_volume[:, j, :].T) if seg_volume is not None else None
        return mri_slice, seg_slice, j, dimY - 1

    elif plane == "sagittal":
        i = max(0, min(index, dimX - 1))
        # volume[i, :, :] has shape (dimY, dimZ).
        # Superior (higher Z) on top, so transpose and flip vertical.
        mri_slice = np.flipud(volume[i, :, :].T)
        seg_slice = np.flipud(seg_volume[i, :, :].T) if seg_volume is not None else None
        return mri_slice, seg_slice, i, dimX - 1

    else:
        raise ValueError(f"Unknown plane: '{plane}'. Expected 'axial', 'coronal', or 'sagittal'.")

def render_slice_image_b64(
    mri_slice: np.ndarray,
    seg_slice: np.ndarray = None,
    show_wt: bool = True,
    show_tc: bool = True,
    show_et: bool = True,
    wt_opacity: float = 0.35,
    tc_opacity: float = 0.65,
    et_opacity: float = 0.85,
    vmin: float = None,
    vmax: float = None,
) -> tuple:
    """
    Renders an orthogonal MRI slice as a base64-encoded PNG data URL with optional
    semi-transparent segmentation overlays for WT, TC, and ET.
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

    # 2. Apply segmentation overlays
    # BraTS conventions:
    # 1: Necrotic / non-enhancing core (TC)
    # 2: Peritumoural oedema (WT)
    # 4: Enhancing tumour (ET)
    if seg_slice is not None:
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

    # 3. Encode to PNG
    img = Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")
    data_url = f"data:image/png;base64,{b64_str}"

    height, width = mri_slice.shape
    return data_url, width, height, has_mask, active_voxels
