import uuid
import traceback
from typing import Dict, Any, Optional
import numpy as np
from fastapi import APIRouter, File, UploadFile, HTTPException, Query, status
from fastapi.responses import JSONResponse, FileResponse

from backend.app.core.config import SERVICE_NAME, DISCLAIMER, BASE_DIR
from backend.app.preprocessing.pipeline import preprocess_modalities, MRIValidationError
from backend.app.inference.predictor import run_inference
from backend.app.postprocessing.labels import create_brats_label_map, calculate_region_metrics
from backend.app.visualization.mesh import generate_all_region_meshes
from backend.app.visualization.slices import extract_slice_data, render_slice_image_b64

router = APIRouter()

# In-memory temporary cache for prediction results and raw volumes for 2D slicing (max 5 recent jobs)
_JOBS_CACHE: Dict[str, Dict[str, Any]] = {}

@router.get("/health")
async def health_check():
    """
    Lightweight health check endpoint. Does not load MRI data or model weights.
    """
    return {
        "status": "ok",
        "service": SERVICE_NAME,
    }

@router.post("/api/predict")
async def predict_mri(
    t1: UploadFile = File(..., description="T1 NIfTI MRI volume (.nii or .nii.gz)"),
    t1gd: UploadFile = File(..., description="T1Gd / T1-Contrast NIfTI MRI volume (.nii or .nii.gz)"),
    t2: UploadFile = File(..., description="T2 NIfTI MRI volume (.nii or .nii.gz)"),
    flair: UploadFile = File(..., description="FLAIR NIfTI MRI volume (.nii or .nii.gz)"),
):
    """
    Processes 4 uploaded brain MRI modalities, validates inputs, executes the
    pretrained SegResNet model, and returns 3D surface meshes in physical coordinates (mm),
    volumetric metrics, and orientation metadata for linked 2D orthogonal slice viewing.
    """
    print(f"\n[NeuroScope] Received MRI upload: T1='{t1.filename}', T1Gd='{t1gd.filename}', T2='{t2.filename}', FLAIR='{flair.filename}'")

    # Read file bytes
    try:
        t1_bytes = await t1.read()
        t1gd_bytes = await t1gd.read()
        t2_bytes = await t2.read()
        flair_bytes = await flair.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded files: {str(e)}"
        )

    # Validation & Preprocessing
    try:
        tensor_input, affine, header, shape, raw_volumes = preprocess_modalities(
            t1_bytes=t1_bytes, t1_name=t1.filename or "t1.nii.gz",
            t1gd_bytes=t1gd_bytes, t1gd_name=t1gd.filename or "t1gd.nii.gz",
            t2_bytes=t2_bytes, t2_name=t2.filename or "t2.nii.gz",
            flair_bytes=flair_bytes, flair_name=flair.filename or "flair.nii.gz",
        )
        print("[NeuroScope] Validation passed.")
    except MRIValidationError as ve:
        print(f"[NeuroScope] Validation error: {ve}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "Invalid MRI input",
                "details": str(ve)
            }
        )
    except Exception as e:
        print(f"[NeuroScope] Preprocessing unexpected error: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Invalid NIfTI file",
                "details": "Could not read one or more uploaded NIfTI volumes. Please ensure files are valid uncorrupted .nii or .nii.gz images."
            }
        )

    # Inference
    try:
        print("[NeuroScope] Starting inference...")
        wt_mask, tc_mask, et_mask = run_inference(tensor_input)
        print("[NeuroScope] Inference complete.")
    except Exception as e:
        print(f"[NeuroScope] Inference failure: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Inference failure",
                "details": "Prediction could not be completed. Please verify the uploaded MRI files."
            }
        )

    # Postprocessing metrics & meshes
    try:
        print("[NeuroScope] Calculating region metrics...")
        metrics = calculate_region_metrics(wt_mask, tc_mask, et_mask, affine)

        print("[NeuroScope] Generating 3D meshes in physical coordinates (tumour subregions and patient-specific brain surface)...")
        meshes = generate_all_region_meshes(wt_mask, tc_mask, et_mask, affine, t1_data=raw_volumes.get("t1"))

        # Multi-label volume
        label_map = create_brats_label_map(wt_mask, tc_mask, et_mask)

        # Coordinate mappings & inverse affine
        inv_affine = np.linalg.inv(affine)

        # Precompute intensity percentiles for each raw volume to ensure ultra-fast 2D slice response
        percentiles = {}
        for mod_name, mod_vol in raw_volumes.items():
            nz = mod_vol[mod_vol > 0]
            if len(nz) > 0:
                p1, p99 = float(np.percentile(nz, 1)), float(np.percentile(nz, 99))
            else:
                p1, p99 = 0.0, 1.0
            percentiles[mod_name] = (p1, p99)

        # Determine default crosshair location (centroid of suspected whole tumour if present, else center of volume)
        if wt_mask.sum() > 0:
            wt_coords = np.where(wt_mask)
            center_vox = [
                int(round(float(np.mean(wt_coords[0])))),
                int(round(float(np.mean(wt_coords[1])))),
                int(round(float(np.mean(wt_coords[2])))),
            ]
        else:
            center_vox = [shape[0] // 2, shape[1] // 2, shape[2] // 2]

        center_homo = np.array([center_vox[0], center_vox[1], center_vox[2], 1.0])
        center_world = (affine @ center_homo)[:3].tolist()
        center_world = [round(float(c), 2) for c in center_world]

        # Calculate full volume world bounds
        corners = np.array([
            [0, 0, 0, 1.0],
            [shape[0] - 1, 0, 0, 1.0],
            [0, shape[1] - 1, 0, 1.0],
            [0, 0, shape[2] - 1, 1.0],
            [shape[0] - 1, shape[1] - 1, shape[2] - 1, 1.0],
        ])
        world_corners = (corners @ affine.T)[:, :3]
        world_bounds = {
            "min": [round(float(x), 2) for x in world_corners.min(axis=0).tolist()],
            "max": [round(float(x), 2) for x in world_corners.max(axis=0).tolist()],
        }

        # Voxel dimensions in mm from affine column norms
        voxel_dims = np.sqrt((affine[:3, :3] ** 2).sum(axis=0)).tolist()
        voxel_dims = [round(float(d), 3) for d in voxel_dims]

        job_id = uuid.uuid4().hex[:12]
        result = {
            "status": "success",
            "job_id": job_id,
            "disclaimer": DISCLAIMER,
            "volume": {
                "shape": list(shape),
                "voxel_dims_mm": voxel_dims,
                "affine": affine.tolist(),
                "inv_affine": inv_affine.tolist(),
                "world_bounds": world_bounds,
            },
            "default_crosshair": {
                "voxel": center_vox,
                "world": center_world,
            },
            "metrics": metrics,
            "regions": meshes,
            "brain": meshes.get("brain"),
        }

        # Cache in memory (keep last 5 jobs)
        if len(_JOBS_CACHE) >= 5:
            _JOBS_CACHE.pop(next(iter(_JOBS_CACHE)))

        _JOBS_CACHE[job_id] = {
            "volumes": raw_volumes,
            "label_map": label_map,
            "wt_mask": wt_mask,
            "tc_mask": tc_mask,
            "et_mask": et_mask,
            "affine": affine,
            "inv_affine": inv_affine,
            "shape": list(shape),
            "percentiles": percentiles,
            "result_summary": result,
        }

        print(f"[NeuroScope] Prediction complete for job {job_id}.\n")
        return JSONResponse(content=result)

    except Exception as e:
        print(f"[NeuroScope] Postprocessing / Mesh generation error: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Postprocessing failure",
                "details": "Could not generate 3D surfaces and slices for the predicted regions."
            }
        )

@router.get("/api/result/{job_id}")
async def get_result(job_id: str):
    """
    Retrieves a cached prediction result by job ID.
    """
    if job_id not in _JOBS_CACHE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Result for job '{job_id}' not found or expired."
        )
    return JSONResponse(content=_JOBS_CACHE[job_id]["result_summary"])

@router.get("/api/result/{job_id}/slice")
async def get_slice(
    job_id: str,
    plane: str = Query(..., description="Orthogonal plane: 'axial', 'coronal', or 'sagittal'"),
    index: int = Query(..., description="Zero-indexed slice number along the plane"),
    modality: str = Query("flair", description="MRI modality: 'flair', 't1', 't1gd', 't2'"),
    show_wt: bool = Query(True, description="Render Whole Tumour overlay"),
    show_tc: bool = Query(True, description="Render Tumour Core overlay"),
    show_et: bool = Query(True, description="Render Enhancing Tumour overlay"),
    wt_opacity: float = Query(0.35, description="WT layer opacity (0.0 to 1.0)"),
    tc_opacity: float = Query(0.65, description="TC layer opacity (0.0 to 1.0)"),
    et_opacity: float = Query(0.85, description="ET layer opacity (0.0 to 1.0)"),
):
    """
    Extracts and renders an orthogonal 2D MRI slice with model-predicted tumour subregion overlays.
    Returns base64 PNG image, slice dimensions, and physical world position along the normal axis.
    """
    if job_id not in _JOBS_CACHE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found or expired."
        )

    job_data = _JOBS_CACHE[job_id]
    plane_lower = plane.lower()
    if plane_lower not in ["axial", "coronal", "sagittal"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid plane '{plane}'. Must be 'axial', 'coronal', or 'sagittal'."
        )

    # Modality volume selection (default to flair)
    modality_lower = modality.lower()
    volumes = job_data["volumes"]
    if modality_lower not in volumes:
        modality_lower = "flair"
    vol = volumes.get(modality_lower, volumes["flair"])
    label_map = job_data["label_map"]
    affine = job_data["affine"]
    p1, p99 = job_data["percentiles"].get(modality_lower, (None, None))

    try:
        mri_slice, seg_slice, actual_idx, max_idx = extract_slice_data(
            volume=vol,
            seg_volume=label_map,
            plane=plane_lower,
            index=index,
        )

        data_url, width, height, has_mask, active_voxels = render_slice_image_b64(
            mri_slice=mri_slice,
            seg_slice=seg_slice,
            show_wt=show_wt,
            show_tc=show_tc,
            show_et=show_et,
            wt_opacity=wt_opacity,
            tc_opacity=tc_opacity,
            et_opacity=et_opacity,
            vmin=p1,
            vmax=p99,
        )

        # Physical coordinate along slice normal
        if plane_lower == "axial":
            world_normal_pos = float((affine @ np.array([0, 0, actual_idx, 1.0]))[2])
        elif plane_lower == "coronal":
            world_normal_pos = float((affine @ np.array([0, actual_idx, 0, 1.0]))[1])
        else:  # sagittal
            world_normal_pos = float((affine @ np.array([actual_idx, 0, 0, 1.0]))[0])

        return JSONResponse(content={
            "status": "success",
            "job_id": job_id,
            "plane": plane_lower,
            "index": actual_idx,
            "max_index": max_idx,
            "width": width,
            "height": height,
            "image": data_url,
            "has_mask": has_mask,
            "active_voxels": active_voxels,
            "world_coord_mm": round(world_normal_pos, 2),
        })

    except Exception as e:
        print(f"[NeuroScope] Error generating slice: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate slice: {str(e)}"
        )

@router.get("/api/sample-files/{modality}")
async def get_sample_file(modality: str):
    """
    Convenience endpoint for local demonstration: provides sample NIfTI files
    so the user can load them into the browser upload inputs.
    """
    sample_dir = BASE_DIR / "test_data" / "sample_case"

    mapping = {
        "t1": sample_dir / "BraTS2021_00000_t1.nii.gz",
        "t1gd": sample_dir / "BraTS2021_00000_t1ce.nii.gz",
        "t2": sample_dir / "BraTS2021_00000_t2.nii.gz",
        "flair": sample_dir / "BraTS2021_00000_flair.nii.gz",
    }
    file_path = mapping.get(modality.lower())
    if not file_path or not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sample file for '{modality}' not found on server."
        )
    return FileResponse(
        path=str(file_path),
        filename=file_path.name,
        media_type="application/gzip"
    )
