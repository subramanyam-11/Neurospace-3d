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
    Calculates estimated voxel counts, physical volumes in cm³ (ml),
    centroids (voxel and physical world mm), and 3D bounding boxes using voxel sizes from affine.
    """
    # Voxel volume in mm³ from affine column norms
    voxel_dims = np.sqrt((affine[:3, :3] ** 2).sum(axis=0))
    voxel_volume_mm3 = float(np.prod(voxel_dims))
    voxel_volume_cm3 = voxel_volume_mm3 / 1000.0

    def _extract_geometry(mask):
        count = int(mask.sum())
        if count == 0:
            return {
                "voxel_count": 0,
                "estimated_volume_cm3": 0.0,
                "centroid_voxel": None,
                "centroid_world_mm": None,
                "bounding_box": None,
            }
        coords = np.where(mask)
        c_vox = [
            int(round(float(np.mean(coords[0])))),
            int(round(float(np.mean(coords[1])))),
            int(round(float(np.mean(coords[2])))),
        ]
        homo = np.array([c_vox[0], c_vox[1], c_vox[2], 1.0])
        c_world = (affine @ homo)[:3].tolist()
        c_world = [round(float(c), 1) for c in c_world]
        bbox = {
            "min_voxel": [int(coords[0].min()), int(coords[1].min()), int(coords[2].min())],
            "max_voxel": [int(coords[0].max()), int(coords[1].max()), int(coords[2].max())],
        }
        return {
            "voxel_count": count,
            "estimated_volume_cm3": round(count * voxel_volume_cm3, 2),
            "centroid_voxel": c_vox,
            "centroid_world_mm": c_world,
            "bounding_box": bbox,
        }

    wt_geom = _extract_geometry(wt_mask)
    tc_geom = _extract_geometry(tc_mask)
    et_geom = _extract_geometry(et_mask)

    return {
        "voxel_volume_mm3": round(voxel_volume_mm3, 4),
        "regions": {
            "WT": {
                "name": "Whole Tumour",
                **wt_geom,
            },
            "TC": {
                "name": "Tumour Core",
                **tc_geom,
            },
            "ET": {
                "name": "Enhancing Tumour",
                **et_geom,
            },
        },
    }

