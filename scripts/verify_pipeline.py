"""
Verification script for NeuroScope 3D Milestone 1:
Validates loading 4 MRI volumes, preprocessing, running pretrained SegResNet,
and extracting WT, TC, and ET masks.
"""

import os
import torch
import numpy as np
import nibabel as nib
from monai.networks.nets import SegResNet
from monai.transforms import (
    Compose,
    EnsureChannelFirstd,
    EnsureTyped,
    Orientationd,
    Spacingd,
    NormalizeIntensityd,
)
from monai.inferers import sliding_window_inference

def run_test():
    data_dir = "./test_data/sample_case"
    t1_path = os.path.join(data_dir, "BraTS2021_00000_t1.nii.gz")
    t1gd_path = os.path.join(data_dir, "BraTS2021_00000_t1ce.nii.gz")
    t2_path = os.path.join(data_dir, "BraTS2021_00000_t2.nii.gz")
    flair_path = os.path.join(data_dir, "BraTS2021_00000_flair.nii.gz")

    print("[NeuroScope] Loading MRI volumes...")
    t1_nii = nib.load(t1_path)
    t1gd_nii = nib.load(t1gd_path)
    t2_nii = nib.load(t2_path)
    flair_nii = nib.load(flair_path)

    t1_data = t1_nii.get_fdata(dtype=np.float32)
    t1gd_data = t1gd_nii.get_fdata(dtype=np.float32)
    t2_data = t2_nii.get_fdata(dtype=np.float32)
    flair_data = flair_nii.get_fdata(dtype=np.float32)

    print(f"[NeuroScope] T1 shape: {t1_data.shape}, affine diagonal: {np.diag(t1_nii.affine)[:3]}")
    print(f"[NeuroScope] T1Gd shape: {t1gd_data.shape}")
    print(f"[NeuroScope] T2 shape: {t2_data.shape}")
    print(f"[NeuroScope] FLAIR shape: {flair_data.shape}")

    # Validation checks
    assert t1_data.shape == t1gd_data.shape == t2_data.shape == flair_data.shape, "Shape mismatch across modalities"
    assert not np.isnan(t1_data).any(), "NaN found in T1"
    assert not np.isnan(t1gd_data).any(), "NaN found in T1Gd"
    assert not np.isnan(t2_data).any(), "NaN found in T2"
    assert not np.isnan(flair_data).any(), "NaN found in FLAIR"

    print("[NeuroScope] Preprocessing...")
    # Channel order specified by model: T1Gd (0), T1 (1), T2 (2), FLAIR (3)
    # Stack along first dimension: (4, H, W, D)
    stacked = np.stack([t1gd_data, t1_data, t2_data, flair_data], axis=0)

    # Normalize non-zero brain voxels for each channel individually
    for c in range(4):
        mask = stacked[c] > 0
        if mask.any():
            mean = stacked[c][mask].mean()
            std = stacked[c][mask].std()
            if std > 0:
                stacked[c][mask] = (stacked[c][mask] - mean) / std

    tensor_input = torch.from_numpy(stacked).unsqueeze(0) # (1, 4, H, W, D)
    print(f"[NeuroScope] Input tensor shape: {tensor_input.shape}")

    # Device selection: MPS if available, otherwise CPU
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    print(f"[NeuroScope] Using device: {device}")

    # Initialize model
    model = SegResNet(
        blocks_down=[1, 2, 2, 4],
        blocks_up=[1, 1, 1],
        init_filters=16,
        in_channels=4,
        out_channels=3,
        dropout_prob=0.2,
    )
    model_path = "./models/brats_mri_segmentation/models/model.pt"
    state_dict = torch.load(model_path, map_location="cpu")
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()

    print("[NeuroScope] Running SegResNet...")
    tensor_input = tensor_input.to(device)

    with torch.no_grad():
        # Sliding window inference matching MONAI BraTS bundle config: roi_size=[240, 240, 160], sw_batch_size=1
        # If input is already 240x240x155 (standard BraTS), sliding window or direct inference can run
        H, W, D = tensor_input.shape[2:]
        # ROI size must be <= volume dimensions for sliding window, or pad if smaller
        roi_size = (min(240, H), min(240, W), min(160, D))
        # Ensure roi_size dimensions are multiples of 8 or 16
        roi_size = (roi_size[0] - roi_size[0] % 16, roi_size[1] - roi_size[1] % 16, roi_size[2] - roi_size[2] % 16)
        print(f"[NeuroScope] Inferer ROI size: {roi_size}")

        pred_logits = sliding_window_inference(
            inputs=tensor_input,
            roi_size=roi_size,
            sw_batch_size=1,
            predictor=model,
            overlap=0.25,
            mode="gaussian",
        )
        pred_sigmoid = torch.sigmoid(pred_logits)
        pred_binary = (pred_sigmoid > 0.5).float().squeeze(0).cpu().numpy() # (3, H, W, D)

    # In MONAI brats_mri_segmentation metadata:
    # Channel 0: TC (Tumor Core)
    # Channel 1: WT (Whole Tumor)
    # Channel 2: ET (Enhancing Tumor)
    tc_mask = pred_binary[0] > 0
    wt_mask = pred_binary[1] > 0
    et_mask = pred_binary[2] > 0

    print(f"[NeuroScope] Predicted mask statistics:")
    print(f"  Whole Tumour (WT) active voxels:    {wt_mask.sum():,} voxels")
    print(f"  Tumour Core (TC) active voxels:     {tc_mask.sum():,} voxels")
    print(f"  Enhancing Tumour (ET) active voxels: {et_mask.sum():,} voxels")

    # BraTS-compatible label map:
    # 0 = background
    # 1 = necrotic core (TC minus ET)
    # 2 = oedema (WT minus TC)
    # 4 = enhancing tumour (ET)
    label_map = np.zeros(wt_mask.shape, dtype=np.uint8)
    label_map[wt_mask] = 2          # oedema (initially all WT)
    label_map[tc_mask] = 1          # necrotic core (all TC)
    label_map[et_mask] = 4          # enhancing tumour (all ET)

    print(f"[NeuroScope] BraTS label map composition:")
    print(f"  Label 0 (Background):     {(label_map == 0).sum():,} voxels")
    print(f"  Label 1 (Necrotic core):  {(label_map == 1).sum():,} voxels")
    print(f"  Label 2 (Oedema):         {(label_map == 2).sum():,} voxels")
    print(f"  Label 4 (Enhancing):      {(label_map == 4).sum():,} voxels")

    # Save output NIfTI for inspection
    out_dir = "./test_data/output_test"
    os.makedirs(out_dir, exist_ok=True)
    out_nii = nib.Nifti1Image(label_map, t1_nii.affine, t1_nii.header)
    out_path = os.path.join(out_dir, "predicted_brats_seg.nii.gz")
    nib.save(out_nii, out_path)
    print(f"[NeuroScope] Saved predicted segmentation to {out_path}")
    print("[NeuroScope] Complete.")

if __name__ == "__main__":
    run_test()
