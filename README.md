# NeuroScope 3D: 3D Brain MRI Segmentation & Multiplanar Exploration

> **CRITICAL MEDICAL DISCLAIMER**: 
> **Research and teaching prototype only. The displayed region is a suspected tumour region predicted by the model and is not a medical diagnosis.**
> 
> *Never use this prototype for clinical diagnosis, patient triage, surgical planning, or treatment decisions. All inference outputs and volumetric approximations are experimental research estimates.*

---

## What NeuroScope 3D Does

**NeuroScope 3D** is a local medical image computing application that transforms four structural brain MRI sequences into synchronized 2D multiplanar orthogonal slices and an interactive 3D physical surface model:

```text
4 NIfTI Sequences (T1, T1Gd, T2, FLAIR)
              ↓
Header Validation & Canonical Ordering [T1Gd, T1, T2, FLAIR]
              ↓
Non-Zero Brain Voxel Intensity Normalization
              ↓
Pretrained MONAI SegResNet (Apple Silicon MPS GPU / CPU)
              ↓
Subregion Extraction: WT (Whole Tumour), TC (Tumour Core), ET (Enhancing Tumour)
              ↓
Marching Cubes Meshes in Patient World Coordinates (mm)
              ↓
Linked Orthogonal 2D Views (Axial, Coronal, Sagittal) + 3D Crosshair Synchronization
              ↓
Interactive Three.js Exploration + Estimated Volumes + Sample Research Report
```

---

## Project Architecture

- **Backend**: FastAPI + MONAI (v1.5.2) + PyTorch 2.8.0 (Apple Silicon MPS GPU accelerated) + NiBabel + scikit-image + Pillow.
- **Frontend**: React + Vite + Three.js (WebGL with OrbitControls, multi-label transparency, wireframe mode, and synchronized 3D crosshair marker).
- **2D Multiplanar Viewer**: Linked Axial, Coronal, and Sagittal orthogonal slice renderers with SVG crosshair overlays, anatomical labels (A/P, S/I, R/L), and subregion masks.
- **Shared World Frame**: Bidirectional physical millimeter synchronization between 2D cursor clicks and 3D Three.js space via the NIfTI affine matrix ($A \cdot A^{-1} = I$).
- **100% Local & Private**: No cloud services, external databases, or third-party language-model APIs. Zero patient data or MRI volumes ever leave the local machine.

---

## Model Information

- **Architecture**: `SegResNet` (MONAI implementation based on Myronenko, 2018)
- **Model Checkpoint**: Official MONAI `brats_mri_segmentation` bundle (v0.5.4)
- **Input Channels (Strict Order)**:
  1. `T1Gd / T1ce` — Post-contrast hypervascular rim & viable tumor boundaries
  2. `T1` — Native tissue anatomy
  3. `T2` — Free fluid, ventricles & vasogenic edema
  4. `FLAIR` — Lesion hyperintensity with CSF attenuation
- **Output Subregions**:
  - **WT (Whole Tumour)**: Cyan (`#38bdf8`) — complete lesion envelope (edema, necrotic core, active tumor)
  - **TC (Tumour Core)**: Amber (`#f59e0b`) — non-enhancing necrosis plus active tumor
  - **ET (Enhancing Tumour)**: Crimson (`#ef4444`) — active contrast-enhancing rim
- **Detailed Specification**: See [`docs/model_card.md`](docs/model_card.md).

---

## Quantitative Evaluation Results (11 Held-Out BraTS Cases)

Evaluated blindly on 11 held-out labelled subjects from the BraTS 2021 cohort (`BraTS2021_00002` through `BraTS2021_00017`), strictly isolated under `evaluation/data` with zero label access during inference:

| Subregion | Mean Dice $\pm$ Std | Median Dice | Sensitivity (Recall) | Specificity | Volume Pearson $r$ |
|---|---|---|---|---|---|
| **Whole Tumour (WT)** | **0.8757 $\pm$ 0.1104** | **0.9445** | 0.8561 $\pm$ 0.1686 | 0.9995 | **0.9342** |
| **Tumour Core (TC)** | **0.8370 $\pm$ 0.1811** | **0.9263** | 0.9166 $\pm$ 0.0885 | 0.9996 | **0.9970** |
| **Enhancing Tumour (ET)**| **0.7399 $\pm$ 0.2493** | **0.8464** | 0.7390 $\pm$ 0.2260 | 0.9999 | **0.9435** |

### System & Engineering Validation
- **Average Inference Runtime**: 6.45 seconds per 4-modality scan on Apple Silicon GPU (`mps`).
- **Reproducibility**: Dice = 1.0000 across repeat runs with 0 voxel difference.
- **Crosshair Discrepancy**: 0.00 voxel discrepancy across 100 random coordinate triples ($< 10^{-10}$ mm).
- **Coordinate Handling**: Orientation, affine matrix inversion ($0.00$ error), and anisotropic spacing ($0.5$, $1.0$, $3.0$ mm³/voxel) all verified **PASS**.
- **Input Robustness**: 100% graceful rejection of corrupted files, mismatched shapes, NaNs, and blank scans.

---

## How to Run

### Prerequisites
- macOS Apple Silicon or Linux / Windows with Python 3.9+
- Node.js (v18+) and npm
- PyTorch with MPS, CUDA, or CPU support

### 1. Start Backend Server
```bash
cd "/Users/subramanyam/Aura 1"
source .venv/bin/activate
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```
Backend will be live at: `http://127.0.0.1:8000`  
Health check: `http://127.0.0.1:8000/health`  
Interactive OpenAPI documentation: `http://127.0.0.1:8000/docs`

### 2. Start Frontend Application
In a separate terminal:
```bash
cd "/Users/subramanyam/Aura 1/frontend"
npm run dev -- --host 127.0.0.1 --port 5174
```
Frontend will be accessible at: `http://127.0.0.1:5174`

---

## Judge / Hackathon Demo Instructions

1. Open `http://127.0.0.1:5174` in your web browser.
2. Verify the green **Backend Connected** indicator in the top header.
3. Click **⚡ Use Demo MRI Scan** in the Upload Panel to instantly load pre-validated BraTS sequences.
4. Click **▶ Run 3D Segmentation (SegResNet)**.
5. In ~7–10 seconds, explore:
   - **Interactive 3D Tumour Meshes**: Rotate (left-click), Pan (right-click), and Zoom (scroll wheel).
   - **Subregion Toggles & Opacity Sliders**: Inspect WT (Cyan), TC (Amber), and ET (Red).
   - **Estimated Physical Volumes**: Read live cm³ and voxel counts.
   - **Linked 2D Multiplanar MRI View**: Scroll or drag crosshairs in Axial, Coronal, or Sagittal views; observe the 3D target marker track in real time.
   - **Sequence Selector**: Toggle background MRI between FLAIR, T1, T1Gd, and T2.
   - **Center on Suspected Tumour**: Jump crosshair directly to the lesion centroid.
6. Click **📄 Generate Sample Research Report** to view and print/export the clinical-research report.
7. Click **📊 Evaluation Benchmarks** in the header to review the 11 held-out validation results.

---

## Known Limitations

- **Small Enhancing Lesions (< 1 cm³)**: Enhancing tumor (ET) regions smaller than 1 cm³ experience higher discrete boundary sensitivity, leading to lower Dice overlap scores despite accurate whole-tumor envelope segmentation.
- **Rigid Preprocessing**: Inputs must be co-registered intracranial NIfTI volumes adhering to standard orientation conventions.
- **Diagnostic Boundaries**: NeuroScope 3D is strictly an educational/research tool. It does not provide medical diagnoses or replace licensed clinical radiologists.
