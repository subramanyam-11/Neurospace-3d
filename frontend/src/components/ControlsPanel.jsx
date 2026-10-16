import React, { useState } from "react";

const REGIONS = [
  {
    key: "WT",
    label: "Whole Tumour (WT)",
    desc: "Complete hyperintense tumour volume",
    dotClass: "dot-wt",
  },
  {
    key: "TC",
    label: "Tumour Core (TC)",
    desc: "Non-enhancing necrotic components + enhancing rim",
    dotClass: "dot-tc",
  },
  {
    key: "ET",
    label: "Enhancing Tumour (ET)",
    desc: "Active hypervascular rim",
    dotClass: "dot-et",
  },
];

const AGREEMENT_REGIONS = [
  {
    key: "TP",
    label: "True Positive (TP)",
    desc: "prediction ∩ expert",
    color: "#10b981",
  },
  {
    key: "FP",
    label: "False Positive (FP)",
    desc: "prediction - expert",
    color: "#8b5cf6",
  },
  {
    key: "FN",
    label: "False Negative (FN)",
    desc: "expert - prediction",
    color: "#f59e0b",
  },
];

export default function ControlsPanel({
  visibleRegions,
  setVisibleRegions,
  opacities,
  setOpacities,
  predictionResult = null,
  viewMode = "predicted", // "predicted", "expert", "agreement"
  setViewMode,
  showDisagreement = false,
  setShowDisagreement,
  disagreementOpacity = 0.70,
  setDisagreementOpacity,
  wireframe,
  setWireframe,
  onResetView,
  onGenerateReport,
  onOpenEvaluation,
}) {
  const [showReliabilityDetails, setShowReliabilityDetails] = useState(false);
  const [showTimingDetails, setShowTimingDetails] = useState(false);

  const metrics = predictionResult?.metrics;
  const reliability = predictionResult?.reliability;
  const tta = predictionResult?.tta;
  const timing = predictionResult?.timing;
  const hasExpert = Boolean(predictionResult?.has_expert && predictionResult?.expert_agreement);
  const agreement = predictionResult?.expert_agreement;

  const toggleRegion = (key) => {
    setVisibleRegions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleOpacityChange = (key, val) => {
    setOpacities((prev) => ({ ...prev, [key]: parseFloat(val) }));
  };

  return (
    <div className="panel-card">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Inspection &amp; Controls</h2>
          <p className="panel-desc">Model estimation, agreement &amp; trust signals</p>
        </div>
        <button onClick={onResetView} className="btn-reset-view">
          Reset View
        </button>
      </div>

      {/* FEATURE GROUP A: Prediction vs Expert Reference Toggle */}
      {hasExpert && (
        <div style={{ marginBottom: "14px", padding: "10px", background: "rgba(16, 185, 129, 0.08)", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#10b981", fontWeight: 700 }}>
              Prediction vs Expert
            </span>
            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
              Reference Mask Active
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginBottom: "6px" }}>
            <button
              type="button"
              onClick={() => setViewMode("predicted")}
              className="btn-browse"
              style={{
                background: viewMode === "predicted" ? "#0284c7" : "#1e293b",
                color: viewMode === "predicted" ? "#ffffff" : "#94a3b8",
                fontWeight: viewMode === "predicted" ? 700 : 500,
                textAlign: "center",
                padding: "6px 4px",
                fontSize: "0.75rem",
              }}
            >
              Predicted
            </button>
            <button
              type="button"
              onClick={() => setViewMode("expert")}
              className="btn-browse"
              style={{
                background: viewMode === "expert" ? "#059669" : "#1e293b",
                color: viewMode === "expert" ? "#ffffff" : "#94a3b8",
                fontWeight: viewMode === "expert" ? 700 : 500,
                textAlign: "center",
                padding: "6px 4px",
                fontSize: "0.75rem",
              }}
            >
              Expert
            </button>
            <button
              type="button"
              onClick={() => setViewMode("agreement")}
              className="btn-browse"
              style={{
                background: viewMode === "agreement" ? "#8b5cf6" : "#1e293b",
                color: viewMode === "agreement" ? "#ffffff" : "#94a3b8",
                fontWeight: viewMode === "agreement" ? 700 : 500,
                textAlign: "center",
                padding: "6px 4px",
                fontSize: "0.75rem",
              }}
            >
              Agreement
            </button>
          </div>

          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", lineHeight: 1.3 }}>
            Agreement with uploaded expert reference mask. (Not diagnostic accuracy).
          </div>
        </div>
      )}

      {/* FEATURE GROUP A & B: Quantitative Agreement Summary Table */}
      {hasExpert && agreement && (
        <div style={{ marginBottom: "14px", padding: "10px", background: "rgba(11, 15, 25, 0.75)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", fontWeight: 700 }}>
              Expert Reference Agreement
            </span>
            <span style={{ fontSize: "0.68rem", color: "var(--accent-cyan)" }}>
              HD95 (anisotropic)
            </span>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)", color: "var(--text-muted)" }}>
                <th style={{ padding: "3px 2px" }}>Region</th>
                <th style={{ padding: "3px 2px" }}>Dice</th>
                <th style={{ padding: "3px 2px" }}>Sens</th>
                <th style={{ padding: "3px 2px" }}>HD95</th>
                <th style={{ padding: "3px 2px" }}>Vol Δ</th>
              </tr>
            </thead>
            <tbody>
              {["WT", "TC", "ET"].map((regKey) => {
                const row = agreement[regKey];
                if (!row) return null;
                return (
                  <tr key={regKey} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <td style={{ padding: "4px 2px", fontWeight: 700, color: regKey === "WT" ? "var(--accent-cyan)" : regKey === "TC" ? "var(--accent-amber)" : "var(--accent-red)" }}>
                      {regKey}
                    </td>
                    <td style={{ padding: "4px 2px" }}>{(row.dice * 100).toFixed(1)}%</td>
                    <td style={{ padding: "4px 2px" }}>{(row.sensitivity * 100).toFixed(1)}%</td>
                    <td style={{ padding: "4px 2px" }}>
                      {row.hd95_mm !== null ? `${row.hd95_mm} mm` : "N/A"}
                    </td>
                    <td style={{ padding: "4px 2px" }}>
                      {row.volume_difference_cm3 >= 0 ? `+${row.volume_difference_cm3}` : row.volume_difference_cm3} mL
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ fontSize: "0.65rem", color: "var(--text-dim)", marginTop: "6px" }}>
            * Distances calculated in physical mm with patient anisotropic spacing.
          </div>
        </div>
      )}

      {/* FEATURE GROUP C: Model Reliability / Trust Signals Panel */}
      {reliability && (
        <div style={{ marginBottom: "14px", padding: "10px", background: "rgba(11, 15, 25, 0.8)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", fontWeight: 700 }}>
              Model Reliability Signals
            </span>
            <button
              type="button"
              onClick={() => setShowReliabilityDetails((prev) => !prev)}
              style={{ background: "none", border: "none", color: "var(--accent-cyan)", fontSize: "0.7rem", cursor: "pointer", textDecoration: "underline" }}
            >
              {showReliabilityDetails ? "Collapse" : "Details"}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
            <span style={{
              display: "inline-block",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: reliability.overall_status === "nominal" ? "#10b981" : "#f59e0b"
            }} />
            <span style={{ fontSize: "0.76rem", fontWeight: 600, color: reliability.overall_status === "nominal" ? "#10b981" : "#fbbf24" }}>
              {reliability.overall_status === "nominal" ? "Reliability Signals Nominal" : "Research Attention Signals Present"}
            </span>
          </div>

          {/* Expanded or compact signal list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {reliability.signals.map((sig) => {
              if (!showReliabilityDetails && sig.level === "nominal") return null;
              return (
                <div
                  key={sig.id}
                  style={{
                    padding: "6px 8px",
                    borderRadius: "6px",
                    background: sig.level === "warning" ? "rgba(239, 68, 68, 0.1)" : sig.level === "caution" ? "rgba(245, 158, 11, 0.1)" : "rgba(16, 185, 129, 0.05)",
                    borderLeft: `3px solid ${sig.level === "warning" ? "#ef4444" : sig.level === "caution" ? "#f59e0b" : "#10b981"}`,
                    fontSize: "0.7rem",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{sig.title}</div>
                  <div style={{ color: "var(--text-muted)", marginTop: "2px", lineHeight: 1.3 }}>{sig.description}</div>
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: "0.64rem", color: "var(--text-dim)", marginTop: "6px" }}>
            Research reliability signal — not clinical probability or diagnostic confidence.
          </div>
        </div>
      )}

      {/* FEATURE GROUP D, E, F: Test-Time Augmentation / Disagreement / Volume Range */}
      {tta?.enabled && (
        <div style={{ marginBottom: "14px", padding: "10px", background: "rgba(11, 15, 25, 0.8)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", fontWeight: 700 }}>
              Robustness &amp; Volume Range
            </span>
            <span style={{ fontSize: "0.68rem", color: "#a855f7" }}>
              TTA 2-Run Range
            </span>
          </div>

          {/* Volume ranges across runs */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "8px", fontSize: "0.72rem" }}>
            {["WT", "TC", "ET"].map((k) => {
              const vr = tta.volume_ranges?.[k];
              const estVol = metrics?.regions?.[k]?.estimated_volume_cm3 ?? "--";
              if (!vr) return null;
              return (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                  <span style={{ fontWeight: 600, color: k === "WT" ? "var(--accent-cyan)" : k === "TC" ? "var(--accent-amber)" : "var(--accent-red)" }}>
                    {k} Volume:
                  </span>
                  <span>
                    <strong>{estVol} mL</strong> &nbsp;
                    <span style={{ color: "var(--text-muted)" }}>(Range: {vr.range_str})</span>
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: "8px" }}>
            Range across deterministic augmented inference runs. (Never a clinical confidence interval).
          </div>

          {/* 2D Disagreement Overlay Toggle & Opacity Slider */}
          <div style={{ paddingTop: "8px", borderTop: "1px dashed rgba(255, 255, 255, 0.1)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.74rem" }}>
                <input
                  type="checkbox"
                  checked={showDisagreement}
                  onChange={(e) => setShowDisagreement(e.target.checked)}
                />
                <span style={{ fontWeight: 600 }}>Show Model Disagreement</span>
              </label>
              <span style={{ fontSize: "0.68rem", color: "var(--accent-amber)" }}>
                {tta.mean_disagreement_pct}% mean
              </span>
            </div>

            {showDisagreement && (
              <div className="slider-container" style={{ marginTop: "4px" }}>
                <span>Heatmap Opacity</span>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={disagreementOpacity}
                  onChange={(e) => setDisagreementOpacity(parseFloat(e.target.value))}
                />
                <span className="slider-val">{Math.round(disagreementOpacity * 100)}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Patient-Specific Brain Anatomy Shell Section */}
      <div className="anatomy-section" style={{ marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
          <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", fontWeight: 600 }}>
            Patient Anatomy Shell
          </span>
          <span className="badge-patient-anatomy">
            Patient-specific MRI anatomy
          </span>
        </div>

        <div
          className={`region-card ${visibleRegions.brain !== false ? "active" : "inactive"}`}
          style={{ borderColor: visibleRegions.brain !== false ? "rgba(148, 163, 184, 0.45)" : "var(--border-color)" }}
        >
          <div className="region-header">
            <label className="region-checkbox-label">
              <input
                type="checkbox"
                checked={visibleRegions.brain !== false}
                onChange={() => toggleRegion("brain")}
                style={{ cursor: "pointer" }}
              />
              <span className="region-color-dot dot-brain" />
              <span style={{ fontWeight: 600 }}>Brain Surface</span>
            </label>
            <span className="volume-tag" style={{ background: "rgba(148, 163, 184, 0.15)", color: "#cbd5e1" }}>
              T1 Volume
            </span>
          </div>

          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: "2px 0 8px 24px" }}>
            Translucent reference shell extracted from patient T1 MRI
          </div>

          <div className="slider-container">
            <span>Opacity</span>
            <input
              type="range"
              min="0.05"
              max="1.0"
              step="0.01"
              value={opacities.brain ?? 0.18}
              disabled={visibleRegions.brain === false}
              onChange={(e) => handleOpacityChange("brain", e.target.value)}
            />
            <span className="slider-val">
              {Math.round((opacities.brain ?? 0.18) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Region Toggles (Different cards when in Agreement mode vs Standard/Expert mode) */}
      <div className="region-list">
        {viewMode === "agreement" ? (
          AGREEMENT_REGIONS.map((reg) => {
            const isVisible = visibleRegions[reg.key] !== false;
            const currentOpacity = opacities[reg.key] ?? 0.75;
            return (
              <div key={reg.key} className={`region-card ${isVisible ? "active" : "inactive"}`}>
                <div className="region-header">
                  <label className="region-checkbox-label">
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => toggleRegion(reg.key)}
                      style={{ cursor: "pointer" }}
                    />
                    <span className="region-color-dot" style={{ background: reg.color }} />
                    <span style={{ fontWeight: 600 }}>{reg.label}</span>
                  </label>
                  <span className="volume-tag" style={{ background: "rgba(255, 255, 255, 0.08)" }}>
                    {reg.desc}
                  </span>
                </div>

                <div className="slider-container">
                  <span>Opacity</span>
                  <input
                    type="range"
                    min="0.05"
                    max="1.0"
                    step="0.05"
                    value={currentOpacity}
                    disabled={!isVisible}
                    onChange={(e) => handleOpacityChange(reg.key, e.target.value)}
                  />
                  <span className="slider-val">{Math.round(currentOpacity * 100)}%</span>
                </div>
              </div>
            );
          })
        ) : (
          REGIONS.map((reg) => {
            const isVisible = visibleRegions[reg.key] !== false;
            const currentOpacity = opacities[reg.key] ?? 0.7;
            const regMetrics = metrics?.regions?.[reg.key];

            return (
              <div
                key={reg.key}
                className={`region-card ${isVisible ? "active" : "inactive"}`}
              >
                <div className="region-header">
                  <label className="region-checkbox-label">
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => toggleRegion(reg.key)}
                      style={{ cursor: "pointer" }}
                    />
                    <span className={`region-color-dot ${reg.dotClass}`} />
                    <span>{reg.label}</span>
                  </label>

                  {regMetrics && (
                    <span className="volume-tag">
                      {regMetrics.estimated_volume_cm3} cm³
                    </span>
                  )}
                </div>

                <div className="slider-container">
                  <span>Opacity</span>
                  <input
                    type="range"
                    min="0.05"
                    max="1.0"
                    step="0.05"
                    value={currentOpacity}
                    disabled={!isVisible}
                    onChange={(e) => handleOpacityChange(reg.key, e.target.value)}
                  />
                  <span className="slider-val">
                    {Math.round(currentOpacity * 100)}%
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Rendering Mode Toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "rgba(11, 15, 25, 0.6)", borderRadius: "8px", border: "1px solid var(--border-color)", fontSize: "0.78rem" }}>
        <span style={{ color: "var(--text-muted)" }}>Wireframe Surface</span>
        <button
          onClick={() => setWireframe((prev) => !prev)}
          className="btn-browse"
          style={{
            background: wireframe ? "#38bdf8" : "#1e293b",
            color: wireframe ? "#090d16" : "#f1f5f9",
            fontWeight: "bold",
          }}
        >
          {wireframe ? "ON" : "OFF"}
        </button>
      </div>

      {/* FEATURE GROUP G: Computation Pipeline Timing Breakdown */}
      {timing && (
        <div style={{ marginTop: "10px", padding: "8px 12px", background: "rgba(11, 15, 25, 0.6)", borderRadius: "8px", border: "1px solid var(--border-color)", fontSize: "0.74rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Total Processing:</span>
            <span style={{ fontWeight: 700, color: "#10b981" }}>
              {(timing.total_time_ms / 1000).toFixed(2)}s
            </span>
          </div>

          <div style={{ marginTop: "4px", display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-dim)", fontSize: "0.68rem" }}>
              Inference: {(timing.inference_ms / 1000).toFixed(2)}s | Preproc: {timing.preprocessing_ms}ms
            </span>
            <button
              type="button"
              onClick={() => setShowTimingDetails((prev) => !prev)}
              style={{ background: "none", border: "none", color: "var(--accent-cyan)", fontSize: "0.68rem", cursor: "pointer", textDecoration: "underline" }}
            >
              {showTimingDetails ? "Hide" : "Breakdown"}
            </button>
          </div>

          {showTimingDetails && (
            <div style={{ marginTop: "6px", paddingTop: "6px", borderTop: "1px dashed rgba(255, 255, 255, 0.08)", fontSize: "0.68rem", display: "flex", flexDirection: "column", gap: "2px", color: "var(--text-muted)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Input Validation:</span>
                <span>{timing.input_validation_ms} ms</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Preprocessing:</span>
                <span>{timing.preprocessing_ms} ms</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>SegResNet Inference:</span>
                <span>{timing.inference_ms} ms</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Postprocessing &amp; HD95:</span>
                <span>{timing.postprocessing_ms} ms</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Marching Cubes Meshing:</span>
                <span>{timing.mesh_generation_ms} ms</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quantitative Summary Table */}
      {metrics && (
        <div className="metrics-summary">
          <div className="metrics-header">
            <span>Model Estimation Summary</span>
            <span className="metrics-badge">Complete ✓</span>
          </div>

          <div className="metrics-grid">
            <div className="metric-col">
              <div className="metric-col-title">WT Vol</div>
              <div className="metric-col-vol vol-wt">
                {metrics.regions?.WT?.estimated_volume_cm3 ?? "--"} cm³
              </div>
              <div className="metric-col-vox">
                {metrics.regions?.WT?.voxel_count?.toLocaleString()} vox
              </div>
            </div>

            <div className="metric-col">
              <div className="metric-col-title">TC Vol</div>
              <div className="metric-col-vol vol-tc">
                {metrics.regions?.TC?.estimated_volume_cm3 ?? "--"} cm³
              </div>
              <div className="metric-col-vox">
                {metrics.regions?.TC?.voxel_count?.toLocaleString()} vox
              </div>
            </div>

            <div className="metric-col">
              <div className="metric-col-title">ET Vol</div>
              <div className="metric-col-vol vol-et">
                {metrics.regions?.ET?.estimated_volume_cm3 ?? "--"} cm³
              </div>
              <div className="metric-col-vox">
                {metrics.regions?.ET?.voxel_count?.toLocaleString()} vox
              </div>
            </div>
          </div>

          <button
            onClick={onGenerateReport}
            className="btn-predict"
            style={{
              marginTop: "12px",
              background: "linear-gradient(135deg, #0284c7, #2563eb)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "10px 14px",
              fontSize: "0.82rem",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Generate Research &amp; Provenance Report</span>
          </button>
        </div>
      )}

      {/* Evaluation Dashboard Quick Link */}
      <button
        onClick={onOpenEvaluation}
        className="btn-demo"
        style={{ width: "100%", textAlign: "center", padding: "8px 12px", marginTop: "4px" }}
      >
        📊 View 11-Case Evaluation Benchmarks
      </button>
    </div>
  );
}
