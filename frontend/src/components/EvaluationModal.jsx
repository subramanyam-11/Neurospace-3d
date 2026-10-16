import React from "react";

const BENCHMARKS = [
  {
    region: "Whole Tumour (WT)",
    tag: "WT",
    dotClass: "dot-wt",
    color: "var(--accent-cyan)",
    meanDice: "0.8757 ± 0.1104",
    medianDice: "0.9445",
    rangeDice: "0.6620 – 0.9739",
    sensitivity: "0.8561 ± 0.1686",
    specificity: "0.9995",
    volumeCorr: "r = 0.9342",
    volumeDiff: "13.08 cm³",
  },
  {
    region: "Tumour Core (TC)",
    tag: "TC",
    dotClass: "dot-tc",
    color: "var(--accent-amber)",
    meanDice: "0.8370 ± 0.1811",
    medianDice: "0.9263",
    rangeDice: "0.4184 – 0.9749",
    sensitivity: "0.9166 ± 0.0885",
    specificity: "0.9996",
    volumeCorr: "r = 0.9970",
    volumeDiff: "2.28 cm³",
  },
  {
    region: "Enhancing Tumour (ET)",
    tag: "ET",
    dotClass: "dot-et",
    color: "var(--accent-red)",
    meanDice: "0.7399 ± 0.2493",
    medianDice: "0.8464",
    rangeDice: "0.0244 – 0.9251",
    sensitivity: "0.7390 ± 0.2260",
    specificity: "0.9999",
    volumeCorr: "r = 0.9435",
    volumeDiff: "2.15 cm³",
  },
];

const SYSTEM_TESTS = [
  { test: "Reproducibility & Determinism", result: "Dice = 1.0000 (0 voxel diff across repeat runs)", status: "PASS" },
  { test: "Crosshair Roundtrip & Sync", result: "0.00 voxel error across 100 sample points (< 10⁻¹⁰ mm)", status: "PASS" },
  { test: "Affine & Orientation Preservation", result: "Exact physical coordinate preservation across rotations/inversion", status: "PASS" },
  { test: "Anisotropic Spacing Handling", result: "Exact physical volume calculation (0.5, 1.0, 3.0 mm³) & 3.0× Z aspect ratio", status: "PASS" },
  { test: "Adversarial Robustness & Failures", result: "100% graceful rejection of corrupted bytes, dimension mismatches, NaNs", status: "PASS" },
];

export default function EvaluationModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2 className="modal-title">Milestone 4 — Model Validation &amp; Evaluation Dashboard</h2>
              <span className="brand-badge">11 Held-Out Cases</span>
            </div>
            <p className="modal-subtitle">
              Quantitative benchmark results on held-out BraTS 2021 cohort (strictly isolated from training &amp; demo)
            </p>
          </div>
          <button onClick={onClose} className="modal-close-btn" title="Close modal">
            ✕
          </button>
        </div>

        {/* Disclaimer Banner */}
        <div className="modal-disclaimer">
          ⚠️ <strong>RESEARCH &amp; TEACHING EVALUATION RESULTS ONLY:</strong> These performance metrics reflect retrospective validation on public BraTS challenge data. NeuroScope 3D is a research prototype and is not FDA/CE cleared for clinical diagnosis, patient triage, or surgical planning.
        </div>

        {/* Quick Highlights Bar */}
        <div className="eval-highlights-bar">
          <div className="eval-highlight-item">
            <span className="eval-highlight-val">11</span>
            <span className="eval-highlight-lbl">Held-Out Cases</span>
          </div>
          <div className="eval-highlight-item">
            <span className="eval-highlight-val">6.45 s</span>
            <span className="eval-highlight-lbl">Avg Inference (MPS)</span>
          </div>
          <div className="eval-highlight-item">
            <span className="eval-highlight-val">1.0000</span>
            <span className="eval-highlight-lbl">Reproducibility Dice</span>
          </div>
          <div className="eval-highlight-item">
            <span className="eval-highlight-val">0.00 vox</span>
            <span className="eval-highlight-lbl">Crosshair Discrepancy</span>
          </div>
          <div className="eval-highlight-item">
            <span className="eval-highlight-val" style={{ color: "var(--accent-emerald)" }}>5 / 5</span>
            <span className="eval-highlight-lbl">System Test Suites PASS</span>
          </div>
        </div>

        {/* Quantitative Subregion Cards */}
        <div className="eval-cards-grid">
          {BENCHMARKS.map((b) => (
            <div key={b.tag} className="eval-card">
              <div className="eval-card-header">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className={`region-color-dot ${b.dotClass}`} />
                  <span style={{ fontWeight: 700, color: "#fff", fontSize: "0.95rem" }}>{b.region}</span>
                </div>
                <span className="brand-badge" style={{ color: b.color, borderColor: b.color }}>
                  {b.tag}
                </span>
              </div>

              <div className="eval-stats-grid">
                <div className="eval-stat-cell primary">
                  <span className="stat-label">Mean Dice</span>
                  <span className="stat-value" style={{ color: b.color }}>{b.meanDice}</span>
                </div>
                <div className="eval-stat-cell primary">
                  <span className="stat-label">Median Dice</span>
                  <span className="stat-value" style={{ color: "#f1f5f9" }}>{b.medianDice}</span>
                </div>
                <div className="eval-stat-cell">
                  <span className="stat-label">Sensitivity (Recall)</span>
                  <span className="stat-value">{b.sensitivity}</span>
                </div>
                <div className="eval-stat-cell">
                  <span className="stat-label">Specificity</span>
                  <span className="stat-value">{b.specificity}</span>
                </div>
                <div className="eval-stat-cell">
                  <span className="stat-label">Volume Pearson r</span>
                  <span className="stat-value" style={{ color: "var(--accent-emerald)" }}>{b.volumeCorr}</span>
                </div>
                <div className="eval-stat-cell">
                  <span className="stat-label">Mean Abs. Volume Diff</span>
                  <span className="stat-value">{b.volumeDiff}</span>
                </div>
              </div>

              <div className="eval-range-text">
                Observed Dice Range: {b.rangeDice}
              </div>
            </div>
          ))}
        </div>

        {/* System & Engineering Validation Table */}
        <div className="eval-table-wrapper">
          <h3 className="eval-section-title">System &amp; Architectural Validation Suites</h3>
          <table className="eval-table">
            <thead>
              <tr>
                <th>Test Suite</th>
                <th>Validation Criteria &amp; Outcome</th>
                <th style={{ textAlign: "right" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {SYSTEM_TESTS.map((t, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600, color: "#fff" }}>{t.test}</td>
                  <td style={{ color: "var(--text-muted)" }}>{t.result}</td>
                  <td style={{ textAlign: "right" }}>
                    <span className="badge-pass">{t.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
            Evaluation artifact: <code>evaluation/validation_master_report.json</code>
          </div>
          <button onClick={onClose} className="btn-demo" style={{ padding: "8px 20px" }}>
            Close Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
