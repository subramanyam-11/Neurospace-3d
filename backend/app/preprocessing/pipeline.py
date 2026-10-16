import io
import os
import tempfile
import numpy as np
import nibabel as nib
import torch

class MRIValidationError(ValueError):
    """Raised when an uploaded MRI fails validation."""
    pass

def load_nifti_from_bytes(file_bytes: bytes, filename: str) -> nib.Nifti1Image:
    """
    Safely loads a NIfTI volume from in-memory bytes or temporary file.
    """
    if not file_bytes:
        raise MRIValidationError(f"File {filename} is empty.")

    # Write to a named temporary file to allow nibabel to parse gzip / header correctly
    suffix = ".nii.gz" if filename.endswith(".nii.gz") else ".nii"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp_name = tmp.name
        tmp.write(file_bytes)

    try:
        nii = nib.load(tmp_name)
        # Force loading data into memory before unlinking
        data = nii.get_fdata(dtype=np.float32)
        affine = nii.affine.copy()
        header = nii.header.copy()
        return nib.Nifti1Image(data, affine, header)
    except Exception as e:
        raise MRIValidationError(f"Invalid NIfTI file '{filename}': {str(e)}")
    finally:
        if os.path.exists(tmp_name):
            try:
                os.remove(tmp_name)
            except OSError:
                pass

def validate_volume_data(data: np.ndarray, modality_name: str):
    """Validates that a 3D MRI volume is finite, 3D, and non-empty."""
    if data.ndim != 3:
        raise MRIValidationError(
            f"Invalid {modality_name} volume: expected 3D volume, got {data.ndim}D shape {data.shape}."
        )
    if np.isnan(data).any() or np.isinf(data).any():
        raise MRIValidationError(
            f"Invalid {modality_name} volume: contains NaN or Inf values. Please provide a valid NIfTI MRI volume."
        )
    if not (data > 0).any():
        raise MRIValidationError(
            f"Invalid {modality_name} volume: volume is completely zero or empty."
        )

def preprocess_modalities(
    t1_bytes: bytes, t1_name: str,
    t1gd_bytes: bytes, t1gd_name: str,
    t2_bytes: bytes, t2_name: str,
    flair_bytes: bytes, flair_name: str
):
    """
    Loads, validates, and arranges the 4 MRI modalities into the SegResNet input tensor.
    Order: T1Gd (0), T1 (1), T2 (2), FLAIR (3)
    """
    print("[NeuroScope] Loading MRI volumes...")
    t1_nii = load_nifti_from_bytes(t1_bytes, t1_name)
    t1gd_nii = load_nifti_from_bytes(t1gd_bytes, t1gd_name)
    t2_nii = load_nifti_from_bytes(t2_bytes, t2_name)
    flair_nii = load_nifti_from_bytes(flair_bytes, flair_name)

    t1_data = t1_nii.get_fdata(dtype=np.float32)
    t1gd_data = t1gd_nii.get_fdata(dtype=np.float32)
    t2_data = t2_nii.get_fdata(dtype=np.float32)
    flair_data = flair_nii.get_fdata(dtype=np.float32)

    validate_volume_data(t1_data, "T1")
    validate_volume_data(t1gd_data, "T1Gd")
    validate_volume_data(t2_data, "T2")
    validate_volume_data(flair_data, "FLAIR")

    # Dimensions consistency check
    base_shape = t1_data.shape
    if not (t1gd_data.shape == base_shape and t2_data.shape == base_shape and flair_data.shape == base_shape):
        raise MRIValidationError(
            f"MRI volumes have incompatible dimensions: "
            f"T1={t1_data.shape}, T1Gd={t1gd_data.shape}, T2={t2_data.shape}, FLAIR={flair_data.shape}."
        )

    print(f"[NeuroScope] T1 shape: {t1_data.shape}")
    print(f"[NeuroScope] T1Gd shape: {t1gd_data.shape}")
    print(f"[NeuroScope] T2 shape: {t2_data.shape}")
    print(f"[NeuroScope] FLAIR shape: {flair_data.shape}")

    # Retain raw un-normalized MRI volumes for multi-planar 2D slice visualization
    raw_volumes = {
        "flair": flair_data,
        "t1": t1_data,
        "t1gd": t1gd_data,
        "t2": t2_data,
    }

    print("[NeuroScope] Preprocessing...")
    # Model channel order: T1Gd (0), T1 (1), T2 (2), FLAIR (3)
    stacked = np.stack([t1gd_data, t1_data, t2_data, flair_data], axis=0)

    # Normalize non-zero brain voxels for each channel individually
    for c in range(4):
        mask = stacked[c] > 0
        if mask.any():
            mean = stacked[c][mask].mean()
            std = stacked[c][mask].std()
            if std > 0:
                stacked[c][mask] = (stacked[c][mask] - mean) / std

    tensor_input = torch.from_numpy(stacked).unsqueeze(0)  # (1, 4, H, W, D)
    print(f"[NeuroScope] Input tensor shape: {tensor_input.shape}")

    return tensor_input, t1_nii.affine, t1_nii.header, base_shape, raw_volumes
