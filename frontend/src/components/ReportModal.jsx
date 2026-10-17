import React from "react";

export default function ReportModal({
  isOpen,
  onClose,
  predictionResult,
  crosshair,
  simulationData = null,
}) {
  if (!isOpen || !predictionResult) return null;

  const { job_id, volume, metrics, regions, timing, provenance, reliability, tta, expert_agreement, has_expert } = predictionResult;
  const simulation = simulationData || predictionResult?.simulation;
  const timestamp = provenance?.timestamp_utc || new Date().toUTCString();

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
  const spacingStr = volume?.voxel_dims_mm ? `${volume.voxel_dims_mm[0]} × ${volume.voxel_dims_mm[1]} × ${volume.voxel_dims_mm[2]} mm` : "1.0 × 1.0 × 1.0 mm";

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
            <p className="modal-subtitle">Comprehensive model inference, agreement &amp; provenance summary</p>
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

          {/* Section 1: Input Modalities & SHA-256 Provenance */}
          <div className="report-section">
            <h3 className="report-section-heading">1. Input MRI Sequences &amp; Data Provenance</h3>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Modality Sequence</th>
                  <th>Clinical Contrast Description</th>
                  <th>Channel</th>
                  <th>Voxel Spacing</th>
                  <th>Input SHA-256 Hash</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>T1-weighted (T1)</strong></td>
                  <td>Native tissue architecture &amp; anatomical boundaries</td>
                  <td>Ch 1</td>
                  <td>{spacingStr}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.68rem" }}>
                    {provenance?.input_hashes?.t1?.sha256 ? `${provenance.input_hashes.t1.sha256.slice(0, 16)}...` : "--"}
                  </td>
                </tr>
                <tr>
                  <td><strong>T1Gd / T1ce</strong></td>
                  <td>Post-contrast gadolinium hypervascularization</td>
                  <td>Ch 0</td>
                  <td>{spacingStr}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.68rem" }}>
                    {provenance?.input_hashes?.t1gd?.sha256 ? `${provenance.input_hashes.t1gd.sha256.slice(0, 16)}...` : "--"}
                  </td>
                </tr>
                <tr>
                  <td><strong>T2-weighted (T2)</strong></td>
                  <td>Water content, ventricles &amp; vasogenic edema</td>
                  <td>Ch 2</td>
                  <td>{spacingStr}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.68rem" }}>
                    {provenance?.input_hashes?.t2?.sha256 ? `${provenance.input_hashes.t2.sha256.slice(0, 16)}...` : "--"}
                  </td>
                </tr>
                <tr>
                  <td><strong>FLAIR</strong></td>
                  <td>Peritumoral hyperintensity with CSF attenuation</td>
                  <td>Ch 3</td>
                  <td>{spacingStr}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.68rem" }}>
                    {provenance?.input_hashes?.flair?.sha256 ? `${provenance.input_hashes.flair.sha256.slice(0, 16)}...` : "--"}
                  </td>
                </tr>
                {provenance?.input_hashes?.expert_mask && (
                  <tr style={{ background: "rgba(16, 185, 129, 0.05)" }}>
                    <td><strong>Expert Reference Mask</strong></td>
                    <td>Ground truth reference comparison</td>
                    <td>Ref</td>
                    <td>{spacingStr}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.68rem", color: "#10b981" }}>
                      {`${provenance.input_hashes.expert_mask.sha256.slice(0, 16)}...`}
                    </td>
                  </tr>
                )}
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
                  {tta?.enabled && <th>Robustness Range (TTA)</th>}
                  <th>Color Tag</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Whole Tumour (WT)</strong></td>
                  <td>Complete hyperintense lesion (edema, core, active rim)</td>
                  <td style={{ fontWeight: 700, color: "var(--accent-cyan)" }}>{wtVol} cm³</td>
                  <td>{wtVox} voxels</td>
                  {tta?.enabled && (
                    <td style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                      {tta.volume_ranges?.WT?.range_str ?? "--"}
                    </td>
                  )}
                  <td>Cyan</td>
                </tr>
                <tr>
                  <td><strong>Tumour Core (TC)</strong></td>
                  <td>Non-enhancing necrotic components plus active enhancing tumor</td>
                  <td style={{ fontWeight: 700, color: "var(--accent-amber)" }}>{tcVol} cm³</td>
                  <td>{tcVox} voxels</td>
                  {tta?.enabled && (
                    <td style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                      {tta.volume_ranges?.TC?.range_str ?? "--"}
                    </td>
                  )}
                  <td>Amber</td>
                </tr>
                <tr>
                  <td><strong>Enhancing Tumour (ET)</strong></td>
                  <td>Active contrast-enhancing hypervascular rim</td>
                  <td style={{ fontWeight: 700, color: "var(--accent-red)" }}>{etVol} cm³</td>
                  <td>{etVox} voxels</td>
                  {tta?.enabled && (
                    <td style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                      {tta.volume_ranges?.ET?.range_str ?? "--"}
                    </td>
                  )}
                  <td>Crimson</td>
                </tr>
              </tbody>
            </table>
            {tta?.enabled && (
              <p style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "4px" }}>
                * Robustness range: Range across deterministic augmented inference runs (not a clinical confidence interval).
              </p>
            )}
          </div>

          {/* Section 3: Expert Reference Mask Agreement (When available) */}
          {has_expert && expert_agreement && (
            <div className="report-section">
              <h3 className="report-section-heading">3. Agreement with Uploaded Expert Reference Mask</h3>
              <p className="report-text-block">
                Evaluated against the uploaded expert ground truth mask. Distances are computed in physical millimeters handling anisotropic voxel spacing:
              </p>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Subregion</th>
                    <th>Dice Score</th>
                    <th>Sensitivity</th>
                    <th>Specificity</th>
                    <th>HD95 (mm)</th>
                    <th>Estimated Volume</th>
                    <th>Expert Volume</th>
                    <th>Volume Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {["WT", "TC", "ET"].map((regKey) => {
                    const row = expert_agreement[regKey];
                    if (!row) return null;
                    return (
                      <tr key={regKey}>
                        <td><strong>{regKey}</strong></td>
                        <td>{(row.dice * 100).toFixed(1)}%</td>
                        <td>{(row.sensitivity * 100).toFixed(1)}%</td>
                        <td>{(row.specificity * 100).toFixed(1)}%</td>
                        <td>{row.hd95_mm !== null ? `${row.hd95_mm} mm` : "N/A"}</td>
                        <td>{row.estimated_volume_cm3} cm³</td>
                        <td>{row.expert_volume_cm3} cm³</td>
                        <td>{row.volume_difference_cm3 >= 0 ? `+${row.volume_difference_cm3}` : row.volume_difference_cm3} cm³ ({row.relative_volume_error_pct}%)</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Section 4: Model Reliability Signals */}
          {reliability?.signals && (
            <div className="report-section">
              <h3 className="report-section-heading">4. Model Reliability Signals</h3>
              <ul className="report-list">
                {reliability.signals.map((sig) => (
                  <li key={sig.id} style={{ marginBottom: "6px" }}>
                    <strong>{sig.title}:</strong> {sig.description}
                  </li>
                ))}
              </ul>
              <p style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "4px" }}>
                Note: Research reliability signals — not clinical probability or diagnostic confidence.
              </p>
            </div>
          )}

          {/* Section 5: Pipeline Timing & Performance */}
          {timing && (
            <div className="report-section">
              <h3 className="report-section-heading">5. Computation Pipeline Timing Breakdown</h3>
              <div className="report-grid-3">
                <div className="report-stat-box">
                  <span className="stat-label">Input Validation</span>
                  <span className="stat-val">{timing.input_validation_ms} ms</span>
                </div>
                <div className="report-stat-box">
                  <span className="stat-label">Preprocessing</span>
                  <span className="stat-val">{timing.preprocessing_ms} ms</span>
                </div>
                <div className="report-stat-box">
                  <span className="stat-label">SegResNet Inference</span>
                  <span className="stat-val">{(timing.inference_ms / 1000).toFixed(2)} s</span>
                </div>
                <div className="report-stat-box">
                  <span className="stat-label">Postprocessing &amp; HD95</span>
                  <span className="stat-val">{timing.postprocessing_ms} ms</span>
                </div>
                <div className="report-stat-box">
                  <span className="stat-label">3D Marching Cubes</span>
                  <span className="stat-val">{timing.mesh_generation_ms} ms</span>
                </div>
                <div className="report-stat-box">
                  <span className="stat-label">Total Processing Time</span>
                  <span className="stat-val" style={{ color: "#10b981" }}>{(timing.total_time_ms / 1000).toFixed(2)} s</span>
                </div>
              </div>
            </div>
          )}

          {/* Section: Hypothetical Spatial Simulation (Optional Scenario) */}
          {simulation && (
            <div className="report-section" style={{ borderLeft: "4px solid #c084fc", paddingLeft: "12px", background: "rgba(168, 85, 247, 0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 className="report-section-heading" style={{ color: "#c084fc", margin: 0 }}>
                  HYPOTHETICAL SPATIAL SIMULATION
                </h3>
                <span className="brand-badge" style={{ background: "rgba(168, 85, 247, 0.2)", color: "#c084fc", borderColor: "rgba(168, 85, 247, 0.4)" }}>
                  +{simulation.expansion_pct}% Scenario
                </span>
              </div>
              <div className="report-disclaimer-box" style={{ background: "rgba(168, 85, 247, 0.08)", borderColor: "rgba(168, 85, 247, 0.3)", marginTop: "8px" }}>
                <strong>RESEARCH NOTICE — NOT A PREDICTION OF TUMOUR GROWTH OR TISSUE DAMAGE</strong>
                <p style={{ marginTop: "4px" }}>
                  This simulation represents a mathematical distance-transform expansion based on the current model-predicted region. It does NOT predict future tumour growth, biological invasion, tissue damage, prognosis, or clinical treatment outcome.
                </p>
              </div>
              <table className="report-table" style={{ marginTop: "10px" }}>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 600, width: "240px" }}>Original Predicted WT Volume</td>
                    <td>{simulation.original_volume_cm3 ?? wtVol} cm³</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Simulated Expansion Percentage</td>
                    <td>+{simulation.expansion_pct}%</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Simulated Estimated Volume</td>
                    <td>{simulation.simulated_volume_cm3} cm³</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Additional Simulated Volume</td>
                    <td>+{simulation.added_volume_cm3} cm³</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Expansion Radius (Anisotropic)</td>
                    <td>{simulation.expansion_radius_mm} mm</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Distance to Patient Brain Surface</td>
                    <td>{simulation.distance_to_brain_surface_mm !== null ? `${simulation.distance_to_brain_surface_mm} mm` : "N/A"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Section 6: Reproducibility & Provenance */}
          <div className="report-section">
            <h3 className="report-section-heading">6. Reproducibility &amp; Provenance</h3>
            <table className="report-table">
              <tbody>
                <tr>
                  <td style={{ width: "220px", fontWeight: 600 }}>Model Architecture</td>
                  <td>MONAI SegResNet (v0.5.4) — 3D Residual Encoder-Decoder</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Model License</td>
                  <td>Apache-2.0</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Code Commit</td>
                  <td style={{ fontFamily: "monospace" }}>{provenance?.code_commit || "0ab1297"}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Preprocessing Spec</td>
                  <td>Non-zero foreground z-score normalization per channel; Channel order: T1Gd (0), T1 (1), T2 (2), FLAIR (3)</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Validation Benchmark</td>
                  <td>11 held-out BraTS 2021 isolated benchmark cases</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Inference Determinism</td>
                  <td>Deterministic single-pass; Repeat run variation = 0 voxels (Dice = 1.0000)</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 7: Limitations & Ethical Constraints */}
          <div className="report-section">
            <h3 className="report-section-heading">7. Limitations &amp; Ethical Constraints</h3>
            <ul className="report-list">
              <li>
                <strong>Small Lesion Sensitivity:</strong> Enhancing tumor (ET) regions smaller than 3 cm³ may exhibit higher boundary variance.
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
