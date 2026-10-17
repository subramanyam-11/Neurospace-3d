import React, { useState } from "react";

export default function AnalysisPanel({
  predictionResult = null,
  tumourScales = { WT: 1.0, TC: 1.0, ET: 1.0 },
  crosshair = { voxel: [120, 120, 75], world: [0, 0, 0] },
  onCrosshairChange,
  onOpenEvaluation,
  onGenerateReport,
}) {
  const [selectedInspectorRegion, setSelectedInspectorRegion] = useState("WT");
  const [jumpNotification, setJumpNotification] = useState("");
  const [showResearchSafety, setShowResearchSafety] = useState(false);

  const metrics = predictionResult?.metrics;

  const handleJumpToCentroid = (regionKey) => {
    const reg = metrics?.regions?.[regionKey];
    if (reg?.centroid_voxel && onCrosshairChange) {
      onCrosshairChange(reg.centroid_voxel);
      setJumpNotification(`Centered crosshair on ${reg.name || regionKey}`);
      setTimeout(() => setJumpNotification(""), 3500);
    }
  };

  const inspectedRegion = metrics?.regions?.[selectedInspectorRegion];

  // Helper for computing Euclidean distance from current crosshair to region centroid
  const getInspectorDistance = () => {
    if (!inspectedRegion?.centroid_world_mm || !crosshair?.world) return "--";
    const [cx, cy, cz] = inspectedRegion.centroid_world_mm;
    const [wx, wy, wz] = crosshair.world;
    const dist = Math.sqrt((cx - wx) ** 2 + (cy - wy) ** 2 + (cz - wz) ** 2);
    return `${dist.toFixed(1)} mm`;
  };

  // Helper to compute volume & voxels adjusted by variable scale slider
  const getScaledMetrics = (key) => {
    const reg = metrics?.regions?.[key];
    const baseVol = reg?.estimated_volume_cm3 ?? 0;
    const baseVox = reg?.voxel_count ?? 0;
    const scale = tumourScales[key] ?? 1.0;
    const volScale = Math.pow(scale, 3);
    const adjVol = (baseVol * volScale).toFixed(2);
    const adjVox = Math.round(baseVox * volScale);
    const isAdjusted = Math.abs(scale - 1.0) > 0.01;
    return {
      baseVol,
      baseVox,
      scale,
      adjVol,
      adjVox,
      isAdjusted,
    };
  };

  const wtMetrics = getScaledMetrics("WT");
  const tcMetrics = getScaledMetrics("TC");
  const etMetrics = getScaledMetrics("ET");

  return (
    <div className="analysis-panel-root">
      {/* SECTION: QUANTITATIVE ANALYSIS & VOLUME CARDS */}
      <div className="control-section">
        <div className="section-label-bar">
          <span className="section-title">QUANTITATIVE ANALYSIS</span>
          {metrics && (
            <span className="analysis-status-pill">BraTS SegResNet</span>
          )}
        </div>

        {!metrics ? (
          <div className="analysis-empty-placeholder">
            <div className="empty-icon">📊</div>
            <div className="empty-title">Awaiting Prediction</div>
            <p className="empty-desc">
              Upload MRI sequences on the left and run prediction to view quantitative subregion volume measurements, centroid navigation, and region metrics.
            </p>
          </div>
        ) : (
          <>
            {/* High-visibility Volume Summary Cards */}
            <div className="prominent-volumes-container">
              {/* WT Card */}
              <div className="volume-card-item wt-card">
                <div className="volume-card-header">
                  <span className="volume-card-title">WHOLE TUMOUR (WT)</span>
                  {wtMetrics.isAdjusted && (
                    <span className="vol-scale-badge cyan">
                      {wtMetrics.scale.toFixed(2)}×
                    </span>
                  )}
                </div>
                <div className="volume-card-val">
                  {wtMetrics.adjVol} <span className="vol-unit">cm³</span>
                </div>
                <div className="volume-card-vox">
                  {wtMetrics.adjVox.toLocaleString()} voxels
                </div>
                {wtMetrics.isAdjusted && (
                  <div className="volume-card-base-note">
                    Base: {wtMetrics.baseVol} cm³ ({wtMetrics.baseVox.toLocaleString()} vox)
                  </div>
                )}
                <div className="volume-card-desc">Complete lesion &amp; vasogenic oedema</div>
              </div>

              {/* TC Card */}
              <div className="volume-card-item tc-card">
                <div className="volume-card-header">
                  <span className="volume-card-title">TUMOUR CORE (TC)</span>
                  {tcMetrics.isAdjusted && (
                    <span className="vol-scale-badge amber">
                      {tcMetrics.scale.toFixed(2)}×
                    </span>
                  )}
                </div>
                <div className="volume-card-val">
                  {tcMetrics.adjVol} <span className="vol-unit">cm³</span>
                </div>
                <div className="volume-card-vox">
                  {tcMetrics.adjVox.toLocaleString()} voxels
                </div>
                {tcMetrics.isAdjusted && (
                  <div className="volume-card-base-note">
                    Base: {tcMetrics.baseVol} cm³ ({tcMetrics.baseVox.toLocaleString()} vox)
                  </div>
                )}
                <div className="volume-card-desc">Necrotic components + active rim</div>
              </div>

              {/* ET Card */}
              <div className="volume-card-item et-card">
                <div className="volume-card-header">
                  <span className="volume-card-title">ENHANCING TUMOUR (ET)</span>
                  {etMetrics.isAdjusted && (
                    <span className="vol-scale-badge red">
                      {etMetrics.scale.toFixed(2)}×
                    </span>
                  )}
                </div>
                <div className="volume-card-val">
                  {etMetrics.adjVol} <span className="vol-unit">cm³</span>
                </div>
                <div className="volume-card-vox">
                  {etMetrics.adjVox.toLocaleString()} voxels
                </div>
                {etMetrics.isAdjusted && (
                  <div className="volume-card-base-note">
                    Base: {etMetrics.baseVol} cm³ ({etMetrics.baseVox.toLocaleString()} vox)
                  </div>
                )}
                <div className="volume-card-desc">Hypervascular enhancing periphery</div>
              </div>
            </div>

            {/* Smart Crosshair Navigation Buttons */}
            <div className="smart-nav-box">
              <div className="smart-nav-title">Smart Centroid Targeting</div>
              <div className="smart-nav-grid">
                <button
                  type="button"
                  onClick={() => handleJumpToCentroid("WT")}
                  className="btn-jump-target wt"
                >
                  Jump to WT
                </button>
                <button
                  type="button"
                  onClick={() => handleJumpToCentroid("TC")}
                  className="btn-jump-target tc"
                >
                  Jump to TC
                </button>
                <button
                  type="button"
                  onClick={() => handleJumpToCentroid("ET")}
                  className="btn-jump-target et"
                >
                  Jump to ET
                </button>
              </div>
              {jumpNotification && (
                <div className="jump-notification-text">✓ {jumpNotification}</div>
              )}
            </div>

            {/* Region Inspector Card */}
            <div className="region-inspector-box">
              <div className="inspector-header">
                <span className="inspector-title">REGION INSPECTOR</span>
                <div className="inspector-tabs">
                  {["WT", "TC", "ET"].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSelectedInspectorRegion(k)}
                      className={`inspector-tab-btn ${selectedInspectorRegion === k ? "selected" : ""}`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>

              {inspectedRegion && (
                <div className="inspector-data-list">
                  <div className="inspector-data-row">
                    <span className="data-key">Subregion:</span>
                    <span className="data-val-bold">{inspectedRegion.name}</span>
                  </div>
                  <div className="inspector-data-row">
                    <span className="data-key">Estimated Volume:</span>
                    <span className="data-val-accent">
                      {getScaledMetrics(selectedInspectorRegion).adjVol} cm³
                      {getScaledMetrics(selectedInspectorRegion).isAdjusted && (
                        <span className="data-val-sub">
                          &nbsp;(Base: {inspectedRegion.estimated_volume_cm3} cm³)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="inspector-data-row">
                    <span className="data-key">Voxel Count:</span>
                    <span className="data-val">
                      {getScaledMetrics(selectedInspectorRegion).adjVox.toLocaleString()} voxels
                    </span>
                  </div>
                  <div className="inspector-data-row">
                    <span className="data-key">Centroid Voxel:</span>
                    <span className="data-val-mono">
                      [{inspectedRegion.centroid_voxel?.join(", ") || "--"}]
                    </span>
                  </div>
                  <div className="inspector-data-row">
                    <span className="data-key">World Coordinates:</span>
                    <span className="data-val-mono">
                      {inspectedRegion.centroid_world_mm
                        ? `(${inspectedRegion.centroid_world_mm.join(", ")}) mm`
                        : "--"}
                    </span>
                  </div>
                  <div className="inspector-data-row">
                    <span className="data-key">Crosshair Distance:</span>
                    <span className="data-val-dist">{getInspectorDistance()}</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* SECTION: RESEARCH BENCHMARKS & REPORT */}
      <div className="control-section">
        <div className="section-label-bar">
          <span className="section-title">RESEARCH &amp; REPORTING</span>
        </div>

        <button
          type="button"
          onClick={onOpenEvaluation}
          className="btn-benchmarks-link"
        >
          📊 View 11-Case Evaluation Benchmarks
        </button>

        <button
          type="button"
          onClick={onGenerateReport}
          disabled={!predictionResult}
          className="btn-generate-report"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Generate Research &amp; Provenance Report</span>
        </button>
      </div>

      {/* SECTION: SAFETY & PROVENANCE */}
      <div className="control-section safety-section">
        {/* Local Processing Badge */}
        <div className="local-processing-card">
          <span className="lock-icon">🔒</span>
          <div>
            <div className="local-proc-title">LOCAL PROCESSING</div>
            <div className="local-proc-desc">
              Your MRI volumes are processed strictly on this machine. No external cloud AI service is contacted.
            </div>
          </div>
        </div>

        {/* Collapsible Research & Safety Panel */}
        <div className="safety-disclosure-wrap">
          <button
            type="button"
            onClick={() => setShowResearchSafety(!showResearchSafety)}
            className="btn-safety-disclosure-toggle"
          >
            <span>Research &amp; Safety Disclosures</span>
            <span>{showResearchSafety ? "▲" : "▼"}</span>
          </button>
          {showResearchSafety && (
            <div className="safety-disclosure-content">
              <p>• <strong>Research &amp; Teaching Prototype:</strong> Displayed regions represent suspected tumour regions predicted by the model.</p>
              <p>• <strong>Estimated Volumes:</strong> Derived mathematically from voxel dimensions in the NIfTI header.</p>
              <p>• <strong>De-identified Data:</strong> Intended solely for public, de-identified research data.</p>
              <p>• <strong>No Medical Diagnosis:</strong> This tool is not clinically validated for patient diagnosis or treatment planning.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
