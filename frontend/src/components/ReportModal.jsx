import React from "react";

export default function ReportModal({
  isOpen,
  onClose,
  predictionResult,
  crosshair,
}) {
  if (!isOpen || !predictionResult) return null;

  const { job_id, volume, metrics, regions } = predictionResult;
  const timestamp = new Date().toUTCString();

  const handlePrint = () => {
    window.print();
  };

  const wtVol = metrics?.regions?.WT?.estimated_volume_cm3 ?? "--";
  const tcVol = metrics?.regions?.TC?.estimated_volume_cm3 ?? "--";
  const etVol = metrics?.regions?.ET?.estimated_volume_cm3 ?? "--";

  const wtVox = metrics?.regions?.WT?.voxel_count?.toLocaleString() ?? "--";
  const tcVox = metrics?.regions?.TC?.voxel_count?.toLocaleString() ?? "--";
  const etVox = metrics?.regions?.ET?.voxel_count?.toLocaleString() ?? "--";

  const wtVerts = regions?.WT?.vertex_count?.toLocaleString() ?? "--";
  const tcVerts = regions?.TC?.vertex_count?.toLocaleString() ?? "--";
  const etVerts = regions?.ET?.vertex_count?.toLocaleString() ?? "--";

  const shapeStr = volume?.shape ? `${volume.shape[0]} × ${volume.shape[1]} × ${volume.shape[2]}` : "240 × 240 × 155";
  const spacingStr = volume?.spacing ? `${volume.spacing[0]} × ${volume.spacing[1]} × ${volume.spacing[2]} mm` : "1.0 × 1.0 × 1.0 mm";

  const worldX = crosshair?.world?.[0] ?? 0;
  const worldY = crosshair?.world?.[1] ?? 0;
  const worldZ = crosshair?.world?.[2] ?? 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container report-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header Actions */}
        <div className="modal-header report-header-bar">
          <div>
            <h2 className="modal-title">Sample Research Report</h2>
            <p className="modal-subtitle">Comprehensive model inference &amp; estimated volume summary</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button onClick={handlePrint} className="btn-predict" style={{ padding: "6px 14px", fontSize: "0.8rem" }}>
              🖨️ Print / Save as PDF
            </button>
            <button onClick={onClose} className="modal-close-btn" title="Close report">
              ✕
            </button>
          </div>
        </div>

        {/* Printable Report Content */}
        <div className="printable-report-content" id="neuroscope-printable-report">
          {/* Report Title Header */}
          <div className="report-title-section">
            <div className="report-brand-row">
              <span className="report-brand-name">NeuroScope 3D</span>
              <span className="report-doc-badge">Research &amp; Teaching Report</span>
            </div>
            <p className="report-meta-text">
              <strong>Job Identifier:</strong> {job_id} &nbsp;|&nbsp; <strong>Generated:</strong> {timestamp}
            </p>
          </div>

          {/* Mandatory Research Disclaimer */}
          <div className="report-disclaimer-box">
            <strong>MANDATORY NOTICE — RESEARCH &amp; TEACHING PROTOTYPE ONLY</strong>
            <p style={{ marginTop: "4px" }}>
              This document is generated automatically by an experimental research tool. All subregions, boundaries, and figures represent <em>suspected tumour regions predicted by the model</em> and <em>estimated volumes</em>. This software is not certified as a diagnostic system, has not undergone prospective clinical trials, and does NOT replace the diagnostic assessment or clinical judgment of a licensed radiologist or physician.
            </p>
          </div>

          {/* Section 1: Input Modalities */}
          <div className="report-section">
            <h3 className="report-section-heading">1. Input MRI Sequences</h3>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Modality Sequence</th>
                  <th>Clinical Contrast Description</th>
                  <th>Channel Order</th>
                  <th>Voxel Spacing</th>
                  <th>Matrix Dimensions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>T1-weighted (T1)</strong></td>
                  <td>Native tissue architecture &amp; anatomical boundaries</td>
                  <td>Channel 1</td>
                  <td>{spacingStr}</td>
                  <td>{shapeStr}</td>
                </tr>
                <tr>
                  <td><strong>T1Gd / T1ce</strong></td>
                  <td>Post-contrast gadolinium hypervascularization</td>
                  <td>Channel 0</td>
                  <td>{spacingStr}</td>
                  <td>{shapeStr}</td>
                </tr>
                <tr>
                  <td><strong>T2-weighted (T2)</strong></td>
                  <td>Water content, ventricles &amp; vasogenic edema</td>
                  <td>Channel 2</td>
                  <td>{spacingStr}</td>
                  <td>{shapeStr}</td>
                </tr>
                <tr>
                  <td><strong>FLAIR</strong></td>
                  <td>Peritumoral hyperintensity with CSF attenuation</td>
                  <td>Channel 3</td>
                  <td>{spacingStr}</td>
                  <td>{shapeStr}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 2: Model-Predicted Regions & Estimated Volumes */}
          <div className="report-section">
            <h3 className="report-section-heading">2. Suspected Tumour Regions Predicted by the Model</h3>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Subregion</th>
                  <th>Anatomical Description</th>
                  <th>Estimated Volume</th>
                  <th>Active Voxel Count</th>
                  <th>Color Tag</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Whole Tumour (WT)</strong></td>
                  <td>Complete hyperintense lesion (edema, non-enhancing core, enhancing rim)</td>
                  <td style={{ fontWeight: 700, color: "var(--accent-cyan)" }}>{wtVol} cm³</td>
                  <td>{wtVox} voxels</td>
                  <td>Cyan</td>
                </tr>
                <tr>
                  <td><strong>Tumour Core (TC)</strong></td>
                  <td>Non-enhancing necrotic components plus active enhancing tumor</td>
                  <td style={{ fontWeight: 700, color: "var(--accent-amber)" }}>{tcVol} cm³</td>
                  <td>{tcVox} voxels</td>
                  <td>Amber</td>
                </tr>
                <tr>
                  <td><strong>Enhancing Tumour (ET)</strong></td>
                  <td>Active contrast-enhancing hypervascular rim</td>
                  <td style={{ fontWeight: 700, color: "var(--accent-red)" }}>{etVol} cm³</td>
                  <td>{etVox} voxels</td>
                  <td>Crimson</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 3: 3D Visualization Summary */}
          <div className="report-section">
            <h3 className="report-section-heading">3. 3D Surface Visualization Summary</h3>
            <p className="report-text-block">
              Isosurface meshes were extracted via Marching Cubes at level 0.5 and mapped directly into physical patient millimeter space via the NIfTI affine matrix:
            </p>
            <div className="report-grid-3">
              <div className="report-stat-box">
                <span className="stat-label">Whole Tumour (WT) Mesh</span>
                <span className="stat-val">{wtVerts} vertices</span>
              </div>
              <div className="report-stat-box">
                <span className="stat-label">Tumour Core (TC) Mesh</span>
                <span className="stat-val">{tcVerts} vertices</span>
              </div>
              <div className="report-stat-box">
                <span className="stat-label">Enhancing Tumour (ET) Mesh</span>
                <span className="stat-val">{etVerts} vertices</span>
              </div>
            </div>
          </div>

          {/* Section 4: Linked Multiplanar MRI View Summary */}
          <div className="report-section">
            <h3 className="report-section-heading">4. Linked Multiplanar 2D Slice Inspection</h3>
            <p className="report-text-block">
              Three orthogonal views (Axial, Coronal, Sagittal) were co-registered in real time with the 3D world space coordinate system:
            </p>
            <div className="report-grid-3">
              <div className="report-stat-box">
                <span className="stat-label">Crosshair World X (Sagittal)</span>
                <span className="stat-val">{worldX >= 0 ? "+" : ""}{worldX} mm</span>
              </div>
              <div className="report-stat-box">
                <span className="stat-label">Crosshair World Y (Coronal)</span>
                <span className="stat-val">{worldY >= 0 ? "+" : ""}{worldY} mm</span>
              </div>
              <div className="report-stat-box">
                <span className="stat-label">Crosshair World Z (Axial)</span>
                <span className="stat-val">{worldZ >= 0 ? "+" : ""}{worldZ} mm</span>
              </div>
            </div>
          </div>

          {/* Section 5: Model Information & Evaluation Summary */}
          <div className="report-section">
            <h3 className="report-section-heading">5. Model Architecture &amp; Independent Benchmark</h3>
            <table className="report-table">
              <tbody>
                <tr>
                  <td style={{ width: "220px", fontWeight: 600 }}>Architecture</td>
                  <td>MONAI SegResNet (v0.5.4) — 3D Encoder-Decoder with residual connections</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Training Corpus</td>
                  <td>Pretrained on multimodal brain tumor segmentation (BraTS) benchmark</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Held-Out Validation</td>
                  <td>11 held-out BraTS 2021 cases (isolated evaluation harness)</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Whole Tumour Accuracy</td>
                  <td>Mean Dice: <strong>0.8757 ± 0.1104</strong> &nbsp;|&nbsp; Median: <strong>0.9445</strong> &nbsp;|&nbsp; Pearson r: <strong>0.9342</strong></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Tumour Core Accuracy</td>
                  <td>Mean Dice: <strong>0.8370 ± 0.1811</strong> &nbsp;|&nbsp; Median: <strong>0.9263</strong> &nbsp;|&nbsp; Pearson r: <strong>0.9970</strong></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Enhancing Tumour Accuracy</td>
                  <td>Mean Dice: <strong>0.7399 ± 0.2493</strong> &nbsp;|&nbsp; Median: <strong>0.8464</strong> &nbsp;|&nbsp; Pearson r: <strong>0.9435</strong></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Reproducibility</td>
                  <td>Dice = 1.0000 across repeat runs (0 voxel difference, deterministic)</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 6: Limitations & Medical Disclaimer */}
          <div className="report-section">
            <h3 className="report-section-heading">6. Limitations &amp; Ethical Constraints</h3>
            <ul className="report-list">
              <li>
                <strong>Small Lesion Sensitivity:</strong> Enhancing tumor (ET) regions smaller than 1 cm³ may exhibit substantially lower Dice scores due to discrete boundary partial volume effects.
              </li>
              <li>
                <strong>Skull-Stripping Requirement:</strong> Preprocessing expects rigidly co-registered, skull-stripped intracranial NIfTI volumes adhering to BraTS coordinate conventions.
              </li>
              <li>
                <strong>Diagnostic Limitation:</strong> This report is for research and teaching purposes only. It must never be used for radiotherapy planning, surgical resection guidance, or primary patient diagnosis.
              </li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button onClick={onClose} className="btn-demo" style={{ padding: "8px 24px" }}>
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}
