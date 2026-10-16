import numpy as np
from skimage import measure

def generate_surface_mesh(mask: np.ndarray, affine: np.ndarray, region_name: str, step_size: int = 1) -> dict:
    """
    Extracts an isosurface mesh using Marching Cubes and transforms vertices
    into physical / world coordinates (in millimeters) using the NIfTI affine.
    """
    if mask.sum() == 0:
        return {
            "region": region_name,
            "vertices": [],
            "faces": [],
            "vertex_count": 0,
            "face_count": 0,
            "bbox": None,
        }

    # Marching cubes
    # Note: mask must have float or bool values
    verts, faces, normals, values = measure.marching_cubes(
        mask.astype(np.float32), level=0.5, step_size=step_size
    )

    # Affine transformation to physical / world coordinates (mm)
    rot_zoom = np.ascontiguousarray(affine[:3, :3], dtype=np.float32)
    trans = np.ascontiguousarray(affine[:3, 3], dtype=np.float32)
    # Clean zero-sign representation to avoid numpy 2.0 warnings
    rot_zoom[rot_zoom == 0] = 0.0
    trans[trans == 0] = 0.0

    # (N, 3) @ (3, 3).T + (3,)
    world_verts = (verts.astype(np.float32) @ rot_zoom.T) + trans

    # Calculate physical bounding box
    bbox_min = world_verts.min(axis=0).tolist()
    bbox_max = world_verts.max(axis=0).tolist()

    return {
        "region": region_name,
        "vertices": np.round(world_verts, 2).tolist(),
        "faces": faces.astype(int).tolist(),
        "vertex_count": int(world_verts.shape[0]),
        "face_count": int(faces.shape[0]),
        "bbox": {
            "min": [round(x, 2) for x in bbox_min],
            "max": [round(x, 2) for x in bbox_max],
        },
    }

def generate_all_region_meshes(wt_mask: np.ndarray, tc_mask: np.ndarray, et_mask: np.ndarray, affine: np.ndarray) -> dict:
    """
    Generates world-coordinate surface meshes for all 3 suspected tumour subregions:
    - WT (Whole Tumour)
    - TC (Tumour Core)
    - ET (Enhancing Tumour)
    """
    print("[NeuroScope] Generating WT mesh...")
    wt_mesh = generate_surface_mesh(wt_mask, affine, "WT")
    print(f"[NeuroScope] WT mesh: {wt_mesh['vertex_count']:,} vertices, {wt_mesh['face_count']:,} faces")

    print("[NeuroScope] Generating TC mesh...")
    tc_mesh = generate_surface_mesh(tc_mask, affine, "TC")
    print(f"[NeuroScope] TC mesh: {tc_mesh['vertex_count']:,} vertices, {tc_mesh['face_count']:,} faces")

    print("[NeuroScope] Generating ET mesh...")
    et_mesh = generate_surface_mesh(et_mask, affine, "ET")
    print(f"[NeuroScope] ET mesh: {et_mesh['vertex_count']:,} vertices, {et_mesh['face_count']:,} faces")

    return {
        "WT": wt_mesh,
        "TC": tc_mesh,
        "ET": et_mesh,
    }
