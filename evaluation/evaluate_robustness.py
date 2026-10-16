"""
Milestone 4 — Test Suite: Invalid-Input Failure & Robustness Tests.
Ensures the application gracefully catches, reports, and rejects invalid, corrupted,
mismatched, or out-of-bounds inputs without crashing.
"""
import io
import gzip
import numpy as np
import nibabel as nib
from backend.app.preprocessing.pipeline import (
    preprocess_modalities,
    validate_volume_data,
    load_nifti_from_bytes,
    MRIValidationError,
)
from backend.app.visualization.slices import extract_slice_data

def create_mock_nifti_bytes(shape=(30, 30, 30), fill_val=100.0, affine=None) -> bytes:
    """Creates in-memory gzip-compressed NIfTI bytes for testing."""
    if affine is None:
        affine = np.eye(4)
    data = np.full(shape, fill_val, dtype=np.float32)
    nii = nib.Nifti1Image(data, affine)
    bio = io.BytesIO()
    # Write using nibabel to bytes
    with gzip.GzipFile(fileobj=bio, mode='wb') as gz:
        # Serialise nifti
        header_bytes = nii.header.write_to(io.BytesIO())
        # We can use nib.FileHolder
    # Cleaner way: save to temporary bio with nibabel
    file_map = nii.make_file_map()
    file_map['image'].fileobj = io.BytesIO()
    nii.to_file_map(file_map)
    # The image fileobj contains the compressed or uncompressed bytes
    return file_map['image'].fileobj.getvalue()

def test_corrupted_file_bytes():
    """Validates that random non-NIfTI byte streams raise MRIValidationError."""
    corrupted_bytes = b"CORRUPTED_NOT_A_NIFTI_FILE_RANDOM_GARBAGE_BYTES_12345"
    msg = ""
    try:
        load_nifti_from_bytes(corrupted_bytes, "corrupted.nii.gz")
        assert False, "Failed to raise MRIValidationError on corrupted bytes"
    except MRIValidationError as e:
        msg = str(e)
        assert "Invalid NIfTI file" in msg
    return {"test": "corrupted_file_bytes", "status": "PASS", "rejection_message": msg}

def test_empty_file_bytes():
    """Validates that empty files (0 bytes) raise MRIValidationError."""
    msg = ""
    try:
        load_nifti_from_bytes(b"", "empty.nii.gz")
        assert False, "Failed to raise MRIValidationError on empty bytes"
    except MRIValidationError as e:
        msg = str(e)
        assert "is empty" in msg
    return {"test": "empty_file_bytes", "status": "PASS", "rejection_message": msg}

def test_dimension_mismatch():
    """Validates that dimension mismatches between modalities are caught and rejected."""
    t1_data = np.ones((60, 60, 30), dtype=np.float32)
    t1_nii = nib.Nifti1Image(t1_data, np.eye(4))
    t1_bytes = t1_nii.to_bytes()

    # Mismatched shape (60, 60, 25)
    mismatch_data = np.ones((60, 60, 25), dtype=np.float32)
    mismatch_nii = nib.Nifti1Image(mismatch_data, np.eye(4))
    mismatch_bytes = mismatch_nii.to_bytes()

    msg = ""
    try:
        preprocess_modalities(
            t1_bytes=t1_bytes, t1_name="t1.nii",
            t1gd_bytes=t1_bytes, t1gd_name="t1ce.nii",
            t2_bytes=t1_bytes, t2_name="t2.nii",
            flair_bytes=mismatch_bytes, flair_name="flair.nii"
        )
        assert False, "Failed to reject dimension mismatch"
    except MRIValidationError as e:
        msg = str(e)
        assert "incompatible dimensions" in msg
    return {"test": "dimension_mismatch", "status": "PASS", "rejection_message": msg}

def test_nan_and_inf_detection():
    """Validates that volumes with NaN or Inf values are rejected."""
    data_nan = np.ones((30, 30, 30), dtype=np.float32)
    data_nan[15, 15, 15] = np.nan
    try:
        validate_volume_data(data_nan, "T1")
        assert False, "Failed to reject NaN values"
    except MRIValidationError as e:
        assert "contains NaN or Inf" in str(e)

    data_inf = np.ones((30, 30, 30), dtype=np.float32)
    data_inf[15, 15, 15] = np.inf
    try:
        validate_volume_data(data_inf, "FLAIR")
        assert False, "Failed to reject Inf values"
    except MRIValidationError as e:
        assert "contains NaN or Inf" in str(e)

    return {"test": "nan_and_inf_detection", "status": "PASS"}

def test_all_zero_empty_volume():
    """Validates that all-zero volumes (empty background only) are rejected."""
    data_zero = np.zeros((30, 30, 30), dtype=np.float32)
    msg = ""
    try:
        validate_volume_data(data_zero, "T2")
        assert False, "Failed to reject all-zero volume"
    except MRIValidationError as e:
        msg = str(e)
        assert "completely zero or empty" in msg
    return {"test": "all_zero_empty_volume", "status": "PASS", "rejection_message": msg}

def test_slice_out_of_bounds_handling():
    """Validates that negative or out-of-bounds slice indices are clamped safely."""
    volume = np.ones((100, 100, 50), dtype=np.float32)

    # Negative index
    slice_neg, _, clamped_k_neg, max_k = extract_slice_data(volume, None, "axial", -10)
    assert slice_neg is not None, "Negative index should return a valid slice"
    assert clamped_k_neg == 0, f"Negative index should clamp to 0, got {clamped_k_neg}"

    # Index exceeding depth
    slice_high, _, clamped_k_high, max_k = extract_slice_data(volume, None, "axial", 999)
    assert slice_high is not None, "High index should return a valid slice"
    assert clamped_k_high == 49, f"High index should clamp to max (49), got {clamped_k_high}"

    return {"test": "slice_out_of_bounds_handling", "status": "PASS"}

def run_robustness_tests():
    print("\n--- Running Invalid-Input Failure & Robustness Tests ---")
    results = [
        test_corrupted_file_bytes(),
        test_empty_file_bytes(),
        test_dimension_mismatch(),
        test_nan_and_inf_detection(),
        test_all_zero_empty_volume(),
        test_slice_out_of_bounds_handling(),
    ]
    for r in results:
        print(f"[{r['status']}] {r['test']}")
    return results

if __name__ == "__main__":
    run_robustness_tests()
