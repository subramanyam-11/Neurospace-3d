# Model Card: NeuroScope 3D — SegResNet for Brain Tumour Segmentation

## Model Details
- **Model Name**: MONAI BraTS SegResNet (v0.5.4)
- **Model Type**: 3D Encoder-Decoder Convolutional Neural Network with Residual Connections
- **Architecture**: `SegResNet` (MONAI implementation based on Myronenko, 2018)
  - Initial Filters: 16
  - Blocks Down: `[1, 2, 2, 4]`
  - Blocks Up: `[1, 1, 1]`
  - Dropout Probability: 0.2
  - Input Channels: 4
  - Output Channels: 3 (sigmoid-activated multi-label subregions)
- **Inference Runtime**: PyTorch 2.8.0 with Apple Silicon MPS GPU acceleration (with fallback to CPU)
- **Framework**: MONAI (Medical Open Network for AI) 1.5.2

## Input Specifications
- **Modalities**: 4 structural 3D Magnetic Resonance Imaging (MRI) sequences:
  1. **T1-weighted (T1)**: Native anatomy and tissue contrast
  2. **T1-weighted Contrast-Enhanced (T1Gd / T1ce)**: Gadolinium-enhanced tumor boundaries and vascularization
  3. **T2-weighted (T2)**: Fluid, tissue water content, and peritumoral edema
  4. **Fluid-Attenuated Inversion Recovery (FLAIR)**: Lesion hyperintensity with suppressed free CSF
- **Channel Ordering (Strict)**:
  `[T1Gd, T1, T2, FLAIR]` (Channel 0: T1Gd, Channel 1: T1, Channel 2: T2, Channel 3: FLAIR)
- **Input Preprocessing**:
  - Non-zero brain voxel intensity normalization per channel: zero-mean and unit variance $\frac{x - \mu}{\sigma}$.
  - Spatial tensor shape: `(1, 4, H, W, D)`.
  - Inferer sliding window ROI size: `(min(240, H), min(240, W), min(160, D))` with multiples of 16 for encoder downsampling, 25% Gaussian overlap.

## Output Specifications
- **Subregion Binary Masks**:
  - **Whole Tumour (WT)**: Channel 1 (`pred_sigmoid > 0.5`) — encompasses all abnormal tumor tissue (necrosis, edema, and enhancing core).
  - **Tumour Core (TC)**: Channel 0 (`pred_sigmoid > 0.5`) — necrotic core plus enhancing tumor.
  - **Enhancing Tumour (ET)**: Channel 2 (`pred_sigmoid > 0.5`) — active enhancing tumor core.
- **BraTS Multi-Label Map Mapping**:
  - Label 0: Background / healthy brain parenchyma
  - Label 1: Necrotic / non-enhancing core ($\text{TC} \setminus \text{ET}$)
  - Label 2: Peritumoral edema ($\text{WT} \setminus \text{TC}$)
  - Label 4: GD-enhancing tumor ($\text{ET}$)

## Intended Use
- **Primary Use Case**: Research and educational visualization prototype for 3D multi-planar exploration of model-predicted brain tumor subregions.
- **Out of Scope & Prohibited Uses**:
  - Clinical diagnosis or primary diagnostic assessment.
  - Clinical decision support, treatment recommendation, or patient triage.
  - Radiotherapy planning, stereotactic radiosurgery targeting, or surgical resection planning.
  - Any real-patient clinical deployment without formal regulatory clearance (FDA, CE-MDR).

## Evaluation Methodology & Held-Out Results
Evaluated on **11 held-out labelled subjects from the BraTS 2021 dataset** (`BraTS2021_00002` through `BraTS2021_00017`), strictly isolated from the training and demo pipeline. Ground truth segmentations were loaded exclusively post-inference for metric calculation.

### Quantitative Results (11 Held-Out Cases)

| Metric | Whole Tumour (WT) | Tumour Core (TC) | Enhancing Tumour (ET) |
|---|---|---|---|
| **Mean Dice** | **0.8757 $\pm$ 0.1104** | **0.8370 $\pm$ 0.1811** | **0.7399 $\pm$ 0.2493** |
| **Median Dice** | **0.9445** | **0.9263** | **0.8464** |
| **Min / Max Dice** | 0.6620 / 0.9739 | 0.4184 / 0.9749 | 0.0244 / 0.9251 |
| **Mean Sensitivity (Recall)** | 0.8561 $\pm$ 0.1686 | 0.9166 $\pm$ 0.0885 | 0.7390 $\pm$ 0.2260 |
| **Specificity** | 0.9995 | 0.9996 | 0.9999 |
| **Mean Abs. Volume Difference** | 13.08 cm³ | 2.28 cm³ | 2.15 cm³ |
| **Volume Pearson Correlation ($r$)** | **0.9342** | **0.9970** | **0.9435** |

### System & Engineering Benchmarks
- **Average Inference Runtime**: 6.45 seconds per 4-channel volume on Apple Silicon GPU (`mps`).
- **Reproducibility**: Repeated inference yielded $\text{Dice} = 1.0000$ across all subregions with 0 voxel difference and identical mesh vertex/face counts.
- **Coordinate System Invariance**: Affine inversion and 2D/3D crosshair roundtrip discrepancy: $0.00$ voxels ($< 1.42 \times 10^{-14}$ mm error).
- **Anisotropic Voxel Handling**: Verified physical volume calculation and mesh geometry scaling across non-isotropic resolutions ($0.5$, $1.0$, $3.0$ mm³/voxel).
- **Robustness**: 100% graceful rejection of corrupted bytes, dimension mismatches, empty files, NaNs, and zero volumes.

## Known Limitations & Considerations
1. **Small Enhancing Lesions (< 1 cm³)**: Enhancing tumor (ET) regions with small volumes (e.g. `BraTS2021_00012` with 224 voxels / 0.22 cm³) experience high relative boundary sensitivity, resulting in lower Dice scores even when whole tumor and core boundaries are accurately segmented.
2. **Scanner & Acquisition Variability**: Performance may vary across non-standard MRI field strengths, scanner vendors, slice thickness variations, or protocols lacking adequate skull-stripping or co-registration.
3. **Tumour Heterogeneity**: Pretrained weights are optimized for glioblastoma / diffuse gliomas and may not generalize to other intracranial neoplasms (e.g., meningiomas, metastases, acoustic neuromas) or non-neoplastic inflammatory lesions.

## Safety & Ethics Statement
NeuroScope 3D does not provide medical diagnoses or replace clinical radiologists. All volumetric figures represent *estimated volumes* derived from *suspected tumour regions predicted by the model*.
