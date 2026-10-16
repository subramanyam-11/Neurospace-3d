import React from "react";

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

export default function ControlsPanel({
  visibleRegions,
  setVisibleRegions,
  opacities,
  setOpacities,
  metrics,
  hasBrain = true,
  wireframe,
  setWireframe,
  onResetView,
  onGenerateReport,
  onOpenEvaluation,
}) {
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
          <h2 className="panel-title">Suspected Tumour Regions</h2>
          <p className="panel-desc">Model-predicted subregions &amp; surface opacity</p>
        </div>
        <button onClick={onResetView} className="btn-reset-view">
          Reset View
        </button>
      </div>

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

          {/* Opacity Control */}
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

      {/* Region Toggles and Opacity Sliders */}
      <div className="region-list">
        {REGIONS.map((reg) => {
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

              {/* Opacity Control */}
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
        })}
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

      {/* Quantitative Summary Table */}
      {metrics && (
        <div className="metrics-summary">
          <div className="metrics-header">
            <span>Model Estimation Summary</span>
            <span className="metrics-badge">Prediction Complete ✓</span>
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
            <span>Generate Sample Research Report</span>
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
