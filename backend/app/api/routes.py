import uuid
import time
import datetime
import hashlib
import subprocess
import traceback
from typing import Dict, Any, Optional
import numpy as np
from fastapi import APIRouter, File, UploadFile, HTTPException, Query, status
from fastapi.responses import JSONResponse, FileResponse

from backend.app.core.config import SERVICE_NAME, DISCLAIMER, BASE_DIR
from backend.app.preprocessing.pipeline import preprocess_modalities, load_nifti_from_bytes, MRIValidationError
from backend.app.inference.predictor import run_inference, run_inference_with_tta
from backend.app.postprocessing.labels import create_brats_label_map, calculate_region_metrics
from backend.app.postprocessing.agreement import (
    compute_agreement_subregion_metrics,
    generate_agreement_meshes,
    generate_expert_meshes,
    evaluate_model_reliability_signals,
)
from evaluation.metrics import extract_ground_truth_subregions
from backend.app.visualization.mesh import generate_all_region_meshes
from backend.app.visualization.slices import extract_slice_data, slice_3d_volume, render_slice_image_b64
from backend.app.postprocessing.simulation import simulate_hypothetical_expansion

router = APIRouter()

# In-memory temporary cache for prediction results, raw volumes, and overlays (max 5 recent jobs)
_JOBS_CACHE: Dict[str, Dict[str, Any]] = {}

def _get_git_commit() -> str:
    """Retrieves current short git commit hash for provenance."""
    try:
        commit = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=str(BASE_DIR),
            stderr=subprocess.DEVNULL
        ).decode("utf-8").strip()
        return commit
    except Exception:
        return "0ab1297"

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
    expert_mask: Optional[UploadFile] = File(None, description="Optional expert reference mask (.nii or .nii.gz)"),
    use_tta: bool = Query(False, description="Enable deterministic Test-Time Augmentation (Left-Right reflection)"),
):
    """
    Processes 4 uploaded brain MRI modalities, validates inputs, executes SegResNet model,
    optionally evaluates against an expert reference mask, computes model reliability signals,
    and returns 3D surface meshes in physical coordinates (mm), volumetric metrics, and slice data.
    """
    t_start_total = time.perf_counter()
    print(f"\n[NeuroScope] Received MRI upload: T1='{t1.filename}', T1Gd='{t1gd.filename}', T2='{t2.filename}', FLAIR='{flair.filename}', TTA={use_tta}")

    # 1. Read file bytes and compute SHA-256 for reproducibility / provenance
    t_val_start = time.perf_counter()
    try:
        t1_bytes = await t1.read()
        t1gd_bytes = await t1gd.read()
        t2_bytes = await t2.read()
        flair_bytes = await flair.read()

        expert_bytes = None
        if expert_mask is not None and expert_mask.filename:
            expert_bytes = await expert_mask.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded files: {str(e)}"
        )

    file_hashes = {
        "t1": {"filename": t1.filename, "sha256": hashlib.sha256(t1_bytes).hexdigest()},
        "t1gd": {"filename": t1gd.filename, "sha256": hashlib.sha256(t1gd_bytes).hexdigest()},
        "t2": {"filename": t2.filename, "sha256": hashlib.sha256(t2_bytes).hexdigest()},
        "flair": {"filename": flair.filename, "sha256": hashlib.sha256(flair_bytes).hexdigest()},
    }
    if expert_bytes:
        file_hashes["expert_mask"] = {
            "filename": expert_mask.filename,
            "sha256": hashlib.sha256(expert_bytes).hexdigest()
        }

    # 2. Validation & Preprocessing
    t_prep_start = time.perf_counter()
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
            detail={"error": "Invalid MRI input", "details": str(ve)}
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

    t_prep_end = time.perf_counter()
    val_time_ms = round((t_prep_start - t_val_start) * 1000, 1)
    prep_time_ms = round((t_prep_end - t_prep_start) * 1000, 1)

    # Voxel physical spacing in mm
    voxel_dims = np.sqrt((affine[:3, :3] ** 2).sum(axis=0)).tolist()
    voxel_dims = [round(float(d), 3) for d in voxel_dims]
    voxel_vol_cm3 = float(np.prod(voxel_dims)) / 1000.0

    # 3. Model Inference (Standard Deterministic or Deterministic TTA)
    t_infer_start = time.perf_counter()
    disagreement_volume = None
    tta_info = None

    try:
        if use_tta:
            wt_mask, tc_mask, et_mask, disagreement_volume, tta_info = run_inference_with_tta(
                tensor_input=tensor_input,
                voxel_volume_cm3=voxel_vol_cm3
            )
        else:
            wt_mask, tc_mask, et_mask = run_inference(tensor_input)
    except Exception as e:
        print(f"[NeuroScope] Inference failure: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Inference failure",
                "details": "Prediction could not be completed. Please verify the uploaded MRI files."
            }
        )
    t_infer_end = time.perf_counter()
    infer_time_ms = round((t_infer_end - t_infer_start) * 1000, 1)

    # 4. Postprocessing metrics & meshes
    t_post_start = time.perf_counter()
    try:
        metrics = calculate_region_metrics(wt_mask, tc_mask, et_mask, affine)
        label_map = create_brats_label_map(wt_mask, tc_mask, et_mask)
        inv_affine = np.linalg.inv(affine)

        # Precompute intensity percentiles for each raw volume
        percentiles = {}
        for mod_name, mod_vol in raw_volumes.items():
            nz = mod_vol[mod_vol > 0]
            if len(nz) > 0:
                p1, p99 = float(np.percentile(nz, 1)), float(np.percentile(nz, 99))
            else:
                p1, p99 = 0.0, 1.0
            percentiles[mod_name] = (p1, p99)

        # 5. Expert Mask Comparison (Feature Group A & B)
        has_expert = False
        agreement_metrics = None
        expert_meshes = None
        agreement_meshes = None
        expert_label_map = None
        agreement_volume = None

        if expert_bytes:
            try:
                print("[NeuroScope] Parsing uploaded expert reference mask...")
                expert_nii = load_nifti_from_bytes(expert_bytes, expert_mask.filename or "seg.nii.gz")
                expert_data = np.round(expert_nii.get_fdata(dtype=np.float32)).astype(np.int32)

                if expert_data.shape != shape:
                    print(f"[NeuroScope] Warning: Expert mask dimensions {expert_data.shape} do not match MRI {shape}.")
                else:
                    has_expert = True
                    gt_subregions = extract_ground_truth_subregions(expert_data)
                    pred_subregions = {"WT": wt_mask, "TC": tc_mask, "ET": et_mask}

                    # Quantitative agreement metrics (Dice, Sensitivity, Specificity, Volume diff, HD95 in mm)
                    agreement_metrics = compute_agreement_subregion_metrics(
                        pred_subregions=pred_subregions,
                        gt_subregions=gt_subregions,
                        affine=affine
                    )

                    # 3D Agreement Isosurfaces (TP green, FP purple, FN coral)
                    agreement_meshes = generate_agreement_meshes(
                        pred_subregions=pred_subregions,
                        gt_subregions=gt_subregions,
                        affine=affine,
                        target_region="WT"
                    )

                    # 3D Expert Isosurfaces
                    expert_meshes = generate_expert_meshes(gt_subregions=gt_subregions, affine=affine)

                    # Multi-label volume for 2D slicing
                    expert_label_map = create_brats_label_map(
                        gt_subregions["WT"], gt_subregions["TC"], gt_subregions["ET"]
                    )

                    # Voxel-wise agreement volume: 1=TP, 2=FP, 3=FN
                    agreement_volume = np.zeros(shape, dtype=np.uint8)
                    tp = np.logical_and(wt_mask, gt_subregions["WT"])
                    fp = np.logical_and(wt_mask, ~gt_subregions["WT"])
                    fn = np.logical_and(~wt_mask, gt_subregions["WT"])
                    agreement_volume[tp] = 1
                    agreement_volume[fp] = 2
                    agreement_volume[fn] = 3

                    print("[NeuroScope] Expert reference agreement computed successfully.")
            except Exception as ex:
                print(f"[NeuroScope] Warning: Failed to process expert mask: {traceback.format_exc()}")
                has_expert = False

        # 6. Model Reliability Signals (Feature Group C)
        reliability = evaluate_model_reliability_signals(
            raw_volumes=raw_volumes,
            wt_mask=wt_mask,
            tc_mask=tc_mask,
            et_mask=et_mask,
            shape=shape,
            voxel_dims_mm=voxel_dims,
            tta_info=tta_info
        )

        t_post_end = time.perf_counter()
        post_time_ms = round((t_post_end - t_post_start) * 1000, 1)

        # 7. Mesh Generation (Standard predicted + patient-specific brain surface)
        t_mesh_start = time.perf_counter()
        meshes = generate_all_region_meshes(wt_mask, tc_mask, et_mask, affine, t1_data=raw_volumes.get("t1"))
        t_mesh_end = time.perf_counter()
        mesh_time_ms = round((t_mesh_end - t_mesh_start) * 1000, 1)

        # Default crosshair location
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

        # Full volume world bounds
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

        t_end_total = time.perf_counter()
        total_time_ms = round((t_end_total - t_start_total) * 1000, 1)

        # Provenance metadata
        timing = {
            "input_validation_ms": val_time_ms,
            "preprocessing_ms": prep_time_ms,
            "inference_ms": infer_time_ms,
            "postprocessing_ms": post_time_ms,
            "mesh_generation_ms": mesh_time_ms,
            "total_time_ms": total_time_ms,
        }

        provenance = {
            "model_name": "MONAI SegResNet",
            "model_version": "v0.5.4",
            "license": "Apache-2.0",
            "code_commit": _get_git_commit(),
            "timestamp_utc": datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "input_hashes": file_hashes,
            "timing": timing,
        }

        # 8. Hypothetical Spatial Impact Simulation (Phase 4)
        simulation_data = simulate_hypothetical_expansion(
            wt_mask=wt_mask,
            affine=affine,
            expansion_pct=25.0,
            t1_data=raw_volumes.get("t1")
        )

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
            "timing": timing,
            "provenance": provenance,
            "reliability": reliability,
            "tta": tta_info,
            "has_expert": has_expert,
            "expert_agreement": agreement_metrics,
            "expert_meshes": expert_meshes,
            "agreement_meshes": agreement_meshes,
            "simulation": simulation_data,
        }

        # Cache in memory
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
            "disagreement_volume": disagreement_volume,
            "expert_label_map": expert_label_map,
            "agreement_volume": agreement_volume,
            "result_summary": result,
        }

        print(f"[NeuroScope] Prediction complete for job {job_id} in {total_time_ms} ms.\n")
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

@router.get("/api/result/{job_id}/simulate")
async def simulate_expansion(
    job_id: str,
    expansion_pct: float = Query(25.0, description="Hypothetical expansion percentage (0, 10, 25, 50, 100)")
):
    """
    Computes a mathematical hypothetical expansion around the model-predicted WT region
    in physical millimeters.
    Research visualization only — not a prediction of tumour growth, tissue damage, or prognosis.
    """
    if job_id not in _JOBS_CACHE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Result for job '{job_id}' not found or expired."
        )

    job_data = _JOBS_CACHE[job_id]
    wt_mask = job_data["wt_mask"]
    affine = job_data["affine"]
    t1_data = job_data["volumes"].get("t1")

    try:
        sim_result = simulate_hypothetical_expansion(
            wt_mask=wt_mask,
            affine=affine,
            expansion_pct=expansion_pct,
            t1_data=t1_data,
        )
        return JSONResponse(content=sim_result)
    except Exception as e:
        print(f"[NeuroScope] Error during hypothetical simulation: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compute simulation: {str(e)}"
        )

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
    show_disagreement: bool = Query(False, description="Show model disagreement / uncertainty heatmap overlay"),
    disagreement_opacity: float = Query(0.70, description="Disagreement heatmap opacity (0.0 to 1.0)"),
    render_mode: str = Query("predicted", description="Overlay mode: 'predicted', 'expert', or 'agreement'"),
):
    """
    Extracts and renders an orthogonal 2D MRI slice with model-predicted or reference overlays.
    Returns base64 PNG image, slice dimensions, and physical world position along normal axis.
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

    # Modality volume selection
    modality_lower = modality.lower()
    volumes = job_data["volumes"]
    if modality_lower not in volumes:
        modality_lower = "flair"
    vol = volumes.get(modality_lower, volumes["flair"])

    # Determine segmentation volume based on render_mode
    if render_mode == "expert" and job_data.get("expert_label_map") is not None:
        seg_vol = job_data["expert_label_map"]
    else:
        seg_vol = job_data["label_map"]

    disagree_vol = job_data.get("disagreement_volume")
    agree_vol = job_data.get("agreement_volume")

    affine = job_data["affine"]
    p1, p99 = job_data["percentiles"].get(modality_lower, (None, None))

    try:
        mri_slice, seg_slice, actual_idx, max_idx = extract_slice_data(
            volume=vol,
            seg_volume=seg_vol,
            plane=plane_lower,
            index=index,
        )

        disagree_slice = slice_3d_volume(disagree_vol, plane_lower, actual_idx) if disagree_vol is not None else None
        agree_slice = slice_3d_volume(agree_vol, plane_lower, actual_idx) if agree_vol is not None else None

        data_url, width, height, has_mask, active_voxels = render_slice_image_b64(
            mri_slice=mri_slice,
            seg_slice=seg_slice,
            show_wt=show_wt,
            show_tc=show_tc,
            show_et=show_et,
            wt_opacity=wt_opacity,
            tc_opacity=tc_opacity,
            et_opacity=et_opacity,
            disagree_slice=disagree_slice,
            show_disagreement=show_disagreement,
            disagreement_opacity=disagreement_opacity,
            agree_slice=agree_slice,
            render_mode=render_mode,
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
        "seg": sample_dir / "BraTS2021_00000_seg.nii.gz",
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
