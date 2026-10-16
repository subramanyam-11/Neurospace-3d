import numpy as np

def create_brats_label_map(wt_mask: np.ndarray, tc_mask: np.ndarray, et_mask: np.ndarray) -> np.ndarray:
    """
    Constructs the standard BraTS multi-label volume:
    0 = background
    1 = necrotic core (TC minus ET)
    2 = oedema (WT minus TC)
    4 = enhancing tumour (ET)
    """
    label_map = np.zeros(wt_mask.shape, dtype=np.uint8)
    label_map[wt_mask] = 2  # Oedema (WT)
    label_map[tc_mask] = 1  # Necrotic / non-enhancing core (TC)
    label_map[et_mask] = 4  # Enhancing tumour (ET)
    return label_map

def calculate_region_metrics(wt_mask: np.ndarray, tc_mask: np.ndarray, et_mask: np.ndarray, affine: np.ndarray):
    """
    Calculates estimated voxel counts and physical volumes in cm³ (ml) using voxel sizes from affine.
    """
    # Voxel volume in mm³ from affine column norms
    voxel_dims = np.sqrt((affine[:3, :3] ** 2).sum(axis=0))
    voxel_volume_mm3 = float(np.prod(voxel_dims))
    voxel_volume_cm3 = voxel_volume_mm3 / 1000.0

    wt_count = int(wt_mask.sum())
    tc_count = int(tc_mask.sum())
    et_count = int(et_mask.sum())

    return {
        "voxel_volume_mm3": round(voxel_volume_mm3, 4),
        "regions": {
            "WT": {
                "name": "Whole Tumour",
                "voxel_count": wt_count,
                "estimated_volume_cm3": round(wt_count * voxel_volume_cm3, 2),
            },
            "TC": {
                "name": "Tumour Core",
                "voxel_count": tc_count,
                "estimated_volume_cm3": round(tc_count * voxel_volume_cm3, 2),
            },
            "ET": {
                "name": "Enhancing Tumour",
                "voxel_count": et_count,
                "estimated_volume_cm3": round(et_count * voxel_volume_cm3, 2),
            },
        },
    }
