"""
Hypothetical Spatial Impact Simulator for NeuroScope 3D.

IMPORTANT SAFETY & COMPLIANCE NOTICE:
- Research visualization only.
- Mathematical spatial simulation based on the current model-predicted region.
- DOES NOT predict future tumour growth, tissue damage, prognosis, or treatment outcome.
"""
from typing import Dict, Any, Optional
import numpy as np
from scipy.ndimage import distance_transform_edt, binary_erosion
from backend.app.visualization.mesh import generate_surface_mesh, extract_brain_mask

SIMULATION_DISCLAIMER = (
    "Hypothetical spatial simulation — not a prediction of tumour growth, tissue damage, prognosis, or treatment outcome."
)

def compute_distance_to_brain_surface(
    wt_mask: np.ndarray,
    brain_mask: np.ndarray,
    voxel_dims: tuple
) -> Optional[float]:
    """
    Computes the minimum Euclidean distance in physical millimeters from the
    model-predicted whole tumour (WT) boundary to the exterior brain surface.
    """
    if wt_mask.sum() == 0 or brain_mask.sum() == 0:
        return None

    # Brain exterior boundary
    eroded_brain = binary_erosion(brain_mask)
    brain_surface = np.logical_and(brain_mask, ~eroded_brain)

    if brain_surface.sum() == 0:
        return None

    # Distance transform from brain surface to all voxels in physical mm
    dist_from_brain = distance_transform_edt(~brain_surface, sampling=voxel_dims)

    # Minimum distance among all WT voxels to brain surface
    min_dist = float(dist_from_brain[wt_mask].min())
    return round(min_dist, 2)

def simulate_hypothetical_expansion(
    wt_mask: np.ndarray,
    affine: np.ndarray,
    expansion_pct: float = 25.0,
    t1_data: Optional[np.ndarray] = None
) -> Dict[str, Any]:
    """
    Computes a purely mathematical hypothetical expansion around the model-predicted WT region
    in physical millimeters using anisotropic voxel spacing.

    The original model prediction is NEVER modified.
    """
    assert wt_mask is not None, "wt_mask must not be None"
    # Defensive copy to guarantee original prediction remains completely untouched
    orig_mask = wt_mask.copy().astype(bool)

    voxel_dims = tuple(float(d) for d in np.sqrt((affine[:3, :3] ** 2).sum(axis=0)))
    voxel_vol_cm3 = float(np.prod(voxel_dims)) / 1000.0

    orig_voxels = int(orig_mask.sum())
    orig_vol_cm3 = round(orig_voxels * voxel_vol_cm3, 2)

    # Brain surface distance calculation if T1 data is available
    dist_to_brain_mm = None
    if t1_data is not None:
        try:
            brain_mask = extract_brain_mask(t1_data)
            dist_to_brain_mm = compute_distance_to_brain_surface(orig_mask, brain_mask, voxel_dims)
        except Exception as e:
            print(f"[NeuroScope Simulator] Brain distance calculation warning: {e}")

    # Case 1: 0% expansion or empty mask
    if expansion_pct <= 0 or orig_voxels == 0:
        orig_mesh = generate_surface_mesh(orig_mask, affine, "Simulated_0%", step_size=1)
        return {
            "status": "success",
            "disclaimer": SIMULATION_DISCLAIMER,
            "expansion_pct": 0.0,
            "expansion_radius_mm": 0.0,
            "original_volume_cm3": orig_vol_cm3,
            "simulated_volume_cm3": orig_vol_cm3,
            "additional_volume_cm3": 0.0,
            "added_volume_cm3": 0.0,
            "distance_to_brain_surface_mm": dist_to_brain_mm,
            "simulated_voxel_count": orig_voxels,
            "mesh": orig_mesh,
        }


    # Case 2: Mathematical expansion using Euclidean distance transform with anisotropic sampling
    dist_map = distance_transform_edt(~orig_mask, sampling=voxel_dims)

    # Determine target voxel count: V_target = V_orig * (1 + pct / 100)
    target_voxels = int(round(orig_voxels * (1.0 + float(expansion_pct) / 100.0)))
    target_voxels = min(target_voxels, orig_mask.size)

    # Search for distance threshold that yields target voxel count
    bg_distances = dist_map[~orig_mask]
    added_needed = max(0, min(target_voxels - orig_voxels, len(bg_distances)))

    if added_needed > 0:
        bg_coords = np.where(~orig_mask)
        # O(N) partition to select precisely the closest added_needed voxels in physical mm
        closest_k = np.argpartition(bg_distances, added_needed - 1)[:added_needed]
        threshold_radius_mm = float(np.max(bg_distances[closest_k]))
        simulated_mask = orig_mask.copy()
        simulated_mask[bg_coords[0][closest_k], bg_coords[1][closest_k], bg_coords[2][closest_k]] = True
    else:
        threshold_radius_mm = 0.0
        simulated_mask = orig_mask.copy()

    sim_voxels = int(simulated_mask.sum())
    sim_vol_cm3 = round(sim_voxels * voxel_vol_cm3, 2)
    add_vol_cm3 = round(max(0.0, sim_vol_cm3 - orig_vol_cm3), 2)

    # Generate 3D surface mesh in physical world coordinates (mm)
    sim_mesh = generate_surface_mesh(simulated_mask, affine, f"Simulated_{int(expansion_pct)}%", step_size=1)

    return {
        "status": "success",
        "disclaimer": SIMULATION_DISCLAIMER,
        "expansion_pct": float(expansion_pct),
        "expansion_radius_mm": round(threshold_radius_mm, 2),
        "original_volume_cm3": orig_vol_cm3,
        "simulated_volume_cm3": sim_vol_cm3,
        "additional_volume_cm3": add_vol_cm3,
        "added_volume_cm3": add_vol_cm3,
        "distance_to_brain_surface_mm": dist_to_brain_mm,
        "simulated_voxel_count": sim_voxels,
        "mesh": sim_mesh,
    }

