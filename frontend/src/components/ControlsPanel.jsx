import React, { useState } from "react";

const REGIONS = [
  {
    key: "WT",
    label: "Whole Tumour (WT)",
    desc: "Complete hyperintense tumour volume & oedema",
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

const TEACHING_STEPS = [
  {
    step: 1,
    title: "Whole Tumour (WT)",
    color: "#38bdf8",
    description:
      "Represents the complete model-predicted tumour-related region, including surrounding abnormal signal and vasogenic oedema.",
    focusRegion: "WT",
    visible: { brain: true, WT: true, TC: false, ET: false },
    opacities: { brain: 0.12, WT: 0.55, TC: 0.0, ET: 0.0 },
  },
  {
    step: 2,
    title: "Tumour Core (TC)",
    color: "#f59e0b",
    description:
      "Represents the model-predicted core region within the whole tumour, enclosing non-enhancing necrotic/cystic tissue plus the vascular rim.",
    focusRegion: "TC",
    visible: { brain: false, WT: true, TC: true, ET: false },
    opacities: { brain: 0.0, WT: 0.18, TC: 0.75, ET: 0.0 },
  },
  {
    step: 3,
    title: "Enhancing Tumour (ET)",
    color: "#ef4444",
    description:
      "Represents the model-predicted enhancing subregion where blood-brain barrier disruption causes acute contrast hyperintensity.",
    focusRegion: "ET",
    visible: { brain: true, WT: true, TC: true, ET: true },
    opacities: { brain: 0.10, WT: 0.15, TC: 0.35, ET: 0.90 },
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
  cutaway = false,
  setCutaway,
  onResetView,
  onGenerateReport,
  onOpenEvaluation,
  onOpenSequenceExplorer,
  onOpenGuidedDemo,
  onCrosshairChange,
  crosshair,
}) {
  const [showResearchSafety, setShowResearchSafety] = useState(false);
  const [activeTeachingStep, setActiveTeachingStep] = useState(null); // null or 0, 1, 2
  const [selectedInspectorRegion, setSelectedInspectorRegion] = useState("WT");
  const [jumpNotification, setJumpNotification] = useState("");

  const metrics = predictionResult?.metrics;
  const hasExpert = Boolean(predictionResult?.has_expert && predictionResult?.expert_agreement);
  const agreement = predictionResult?.expert_agreement;

  const toggleRegion = (key) => {
    setVisibleRegions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleOpacityChange = (key, val) => {
    setOpacities((prev) => ({ ...prev, [key]: parseFloat(val) }));
  };

  // Quick View Modes
  const handleSetQuickMode = (mode) => {
    setActiveTeachingStep(null);
    if (mode === "full") {
      setVisibleRegions({ brain: true, WT: true, TC: true, ET: true, TP: true, FP: true, FN: true });
      setOpacities((prev) => ({ ...prev, brain: 0.22, WT: 0.35, TC: 0.65, ET: 0.85 }));
      setCutaway(false);
      setWireframe(false);
    } else if (mode === "tumour_only") {
      setVisibleRegions((prev) => ({ ...prev, brain: false, WT: true, TC: true, ET: true }));
      setCutaway(false);
    } else if (mode === "anatomy_only") {
      setVisibleRegions((prev) => ({ ...prev, brain: true, WT: false, TC: false, ET: false }));
      setOpacities((prev) => ({ ...prev, brain: 0.65 }));
      setCutaway(false);
    } else if (mode === "inside_brain") {
      setVisibleRegions((prev) => ({ ...prev, brain: true, WT: true, TC: true, ET: true }));
      setOpacities((prev) => ({ ...prev, brain: 0.12, WT: 0.35, TC: 0.70, ET: 0.90 }));
      setCutaway(false);
    } else if (mode === "cutaway") {
      setVisibleRegions((prev) => ({ ...prev, brain: true, WT: true, TC: true, ET: true }));
      setOpacities((prev) => ({ ...prev, brain: 0.28, WT: 0.40, TC: 0.75, ET: 0.95 }));
      setCutaway(!cutaway);
    }
  };

  // Layer-by-Layer Reveal Teaching Mode
  const handleStartTeaching = () => {
    setActiveTeachingStep(0);
    applyTeachingStep(0);
  };

  const applyTeachingStep = (stepIdx) => {
    const step = TEACHING_STEPS[stepIdx];
    if (!step) return;
    setVisibleRegions((prev) => ({ ...prev, ...step.visible }));
    setOpacities((prev) => ({ ...prev, ...step.opacities }));
    setSelectedInspectorRegion(step.focusRegion);
  };

  const handleNextTeaching = () => {
    if (activeTeachingStep < TEACHING_STEPS.length - 1) {
      const next = activeTeachingStep + 1;
      setActiveTeachingStep(next);
      applyTeachingStep(next);
    }
  };

  const handlePrevTeaching = () => {
    if (activeTeachingStep > 0) {
      const prev = activeTeachingStep - 1;
      setActiveTeachingStep(prev);
      applyTeachingStep(prev);
    }
  };

  const handleExitTeaching = () => {
    setActiveTeachingStep(null);
    handleSetQuickMode("full");
  };

  // Smart Crosshair Navigation
  const handleJumpToCentroid = (regKey) => {
    const regData = metrics?.regions?.[regKey];
    if (regData?.centroid_voxel && onCrosshairChange) {
      onCrosshairChange(regData.centroid_voxel);
      setJumpNotification(`Crosshair moved to estimated ${regKey} region centroid.`);
      setTimeout(() => setJumpNotification(""), 3500);
    }
  };

  // Inspector distance calculation
  const getInspectorDistance = () => {
    const reg = metrics?.regions?.[selectedInspectorRegion];
    if (!reg?.centroid_world_mm || !crosshair?.world) return "--";
    const dx = crosshair.world[0] - reg.centroid_world_mm[0];
    const dy = crosshair.world[1] - reg.centroid_world_mm[1];
    const dz = crosshair.world[2] - reg.centroid_world_mm[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return `${dist.toFixed(1)} mm`;
  };

  const inspectedRegion = metrics?.regions?.[selectedInspectorRegion];

  return (
    <div className="panel-card workstation-controls-card">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Workspace Controls</h2>
          <p className="panel-desc">Anatomy view modes, subregions &amp; quantitative inspection</p>
        </div>
        <button onClick={onResetView} className="btn-reset-view">
          Reset View
        </button>
      </div>

      {/* SECTION: VIEW MODES */}
      <div className="control-section">
        <div className="section-label-bar">
          <span className="section-title">VIEW MODES</span>
        </div>
        <div className="quick-modes-grid">
          <button
            onClick={() => handleSetQuickMode("full")}
            className="btn-quick-mode"
            title="Brain shell + all tumour subregions"
          >
            Full Anatomy
          </button>
          <button
            onClick={() => handleSetQuickMode("tumour_only")}
            className="btn-quick-mode"
            title="Hide cortical brain shell"
          >
            Tumour Only
          </button>
          <button
            onClick={() => handleSetQuickMode("anatomy_only")}
            className="btn-quick-mode"
            title="Hide all tumour subregions"
          >
            Anatomy Only
          </button>
          <button
            onClick={() => handleSetQuickMode("inside_brain")}
            className="btn-quick-mode"
            title="Translucent brain shell with high-contrast core"
          >
            Tumour Inside Brain
          </button>
        </div>
        <button
          onClick={() => handleSetQuickMode("cutaway")}
          className={`btn-cutaway-toggle ${cutaway ? "active" : ""}`}
          title="Section view clipping plane through brain anatomy"
        >
          {cutaway ? "✓ Cutaway / Section View Active" : "✂ 3D Anatomy Cutaway / Section View"}
        </button>
      </div>

      {/* SECTION: TEACHING & DEMO */}
      <div className="control-section">
        <div className="section-label-bar">
          <span className="section-title">TEACHING &amp; EXPLORATION</span>
          <span className="section-badge">Interactive</span>
        </div>

        <div className="teaching-buttons-grid">
          <button
            onClick={activeTeachingStep !== null ? handleExitTeaching : handleStartTeaching}
            className={`btn-teaching-action ${activeTeachingStep !== null ? "active" : ""}`}
          >
            {activeTeachingStep !== null ? "Exit Tumour Reveal" : "🔬 Explore Tumour Layers"}
          </button>

          <button
            onClick={onOpenSequenceExplorer}
            className="btn-teaching-action"
          >
            🧠 Why 4 MRI Sequences?
          </button>

          <button
            onClick={onOpenGuidedDemo}
            className="btn-teaching-action highlight"
            style={{ gridColumn: "span 2" }}
          >
            ⚡ Start Guided Demo (5-Min Walkthrough)
          </button>
        </div>

        {/* Layer-by-Layer Tumour Reveal Stepper */}
        {activeTeachingStep !== null && (
          <div className="teaching-stepper-box" style={{ borderColor: TEACHING_STEPS[activeTeachingStep].color }}>
            <div className="stepper-header">
              <span className="stepper-title" style={{ color: TEACHING_STEPS[activeTeachingStep].color }}>
                Step {activeTeachingStep + 1} of 3: {TEACHING_STEPS[activeTeachingStep].title}
              </span>
              <button onClick={handleExitTeaching} className="btn-exit-step">✕ Exit</button>
            </div>
            <p className="stepper-desc">
              {TEACHING_STEPS[activeTeachingStep].description}
            </p>
            <div className="stepper-nav-row">
              <button
                onClick={handlePrevTeaching}
                disabled={activeTeachingStep === 0}
                className="btn-step-nav"
                style={{ opacity: activeTeachingStep === 0 ? 0.4 : 1 }}
              >
                ← Previous
              </button>
              <button
                onClick={handleNextTeaching}
                disabled={activeTeachingStep === TEACHING_STEPS.length - 1}
                className="btn-step-nav next"
                style={{ opacity: activeTeachingStep === TEACHING_STEPS.length - 1 ? 0.4 : 1 }}
              >
                Next Step →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SECTION: SEGMENTATION SUBREGIONS */}
      <div className="control-section">
        <div className="section-label-bar">
          <span className="section-title">SEGMENTATION SUBREGIONS</span>
        </div>

        {/* Prediction vs Expert Toggle (if expert reference provided) */}
        {hasExpert && (
          <div className="expert-toggle-card">
            <div className="expert-header-row">
              <span className="expert-header-tag">Prediction vs Expert</span>
              <span className="expert-status-text">Reference Loaded</span>
            </div>
            <div className="view-mode-button-group">
              <button
                type="button"
                onClick={() => setViewMode("predicted")}
                className={`btn-mode-pill ${viewMode === "predicted" ? "active-pred" : ""}`}
              >
                Predicted
              </button>
              <button
                type="button"
                onClick={() => setViewMode("expert")}
                className={`btn-mode-pill ${viewMode === "expert" ? "active-expert" : ""}`}
              >
                Expert
              </button>
              <button
                type="button"
                onClick={() => setViewMode("agreement")}
                className={`btn-mode-pill ${viewMode === "agreement" ? "active-agree" : ""}`}
              >
                Agreement
              </button>
            </div>
          </div>
        )}

        {/* Region Toggles and Opacity Sliders */}
        <div className="regions-list">
          {REGIONS.map((r) => (
            <div key={r.key} className="region-card">
              <div className="region-header">
                <label className="region-checkbox-label">
                  <input
                    type="checkbox"
                    checked={visibleRegions[r.key] ?? true}
                    onChange={() => toggleRegion(r.key)}
                    className="region-checkbox"
                  />
                  <span className={`region-dot ${r.dotClass}`} />
                  <span className="region-name">{r.label}</span>
                </label>
                <span className="region-opacity-val">
                  {Math.round((opacities[r.key] ?? 0.5) * 100)}%
                </span>
              </div>

              <div className="slider-row">
                <span className="slider-hint">Opacity</span>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={opacities[r.key] ?? 0.5}
                  onChange={(e) => handleOpacityChange(r.key, e.target.value)}
                  className="opacity-slider"
                />
              </div>
            </div>
          ))}

          {/* Brain Surface Shell Card */}
          <div className="region-card">
            <div className="region-header">
              <label className="region-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleRegions.brain ?? true}
                  onChange={() => toggleRegion("brain")}
                  className="region-checkbox"
                />
                <span className="region-dot dot-brain" />
                <span className="region-name">Brain Anatomy (T1)</span>
              </label>
              <span className="region-opacity-val">
                {Math.round((opacities.brain ?? 0.22) * 100)}%
              </span>
            </div>

            <div className="slider-row">
              <span className="slider-hint">Opacity</span>
              <input
                type="range"
                min="0.02"
                max="0.8"
                step="0.02"
                value={opacities.brain ?? 0.22}
                onChange={(e) => handleOpacityChange("brain", e.target.value)}
                className="opacity-slider"
              />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: QUANTITATIVE ANALYSIS & VOLUME CARDS */}
      {metrics?.regions && (
        <div className="control-section">
          <div className="section-label-bar">
            <span className="section-title">QUANTITATIVE ANALYSIS</span>
          </div>

          {/* High-visibility Volume Summary Cards (Requirement 8) */}
          <div className="prominent-volumes-container">
            <div className="volume-card-item wt-card">
              <div className="volume-card-title">WHOLE TUMOUR (WT)</div>
              <div className="volume-card-val">{metrics.regions?.WT?.estimated_volume_cm3 ?? "--"} cm³</div>
              <div className="volume-card-vox">{metrics.regions?.WT?.voxel_count?.toLocaleString()} voxels</div>
              <div className="volume-card-desc">Complete lesion &amp; vasogenic oedema</div>
            </div>

            <div className="volume-card-item tc-card">
              <div className="volume-card-title">TUMOUR CORE (TC)</div>
              <div className="volume-card-val">{metrics.regions?.TC?.estimated_volume_cm3 ?? "--"} cm³</div>
              <div className="volume-card-vox">{metrics.regions?.TC?.voxel_count?.toLocaleString()} voxels</div>
              <div className="volume-card-desc">Necrotic components + active rim</div>
            </div>

            <div className="volume-card-item et-card">
              <div className="volume-card-title">ENHANCING TUMOUR (ET)</div>
              <div className="volume-card-val">{metrics.regions?.ET?.estimated_volume_cm3 ?? "--"} cm³</div>
              <div className="volume-card-vox">{metrics.regions?.ET?.voxel_count?.toLocaleString()} voxels</div>
              <div className="volume-card-desc">Hypervascular enhancing periphery</div>
            </div>
          </div>

          {/* Smart Crosshair Navigation Buttons */}
          <div className="smart-nav-box">
            <div className="smart-nav-title">Smart Centroid Targeting</div>
            <div className="smart-nav-grid">
              <button onClick={() => handleJumpToCentroid("WT")} className="btn-jump-target">
                Jump to WT
              </button>
              <button onClick={() => handleJumpToCentroid("TC")} className="btn-jump-target">
                Jump to TC
              </button>
              <button onClick={() => handleJumpToCentroid("ET")} className="btn-jump-target">
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
                  <span className="data-val-accent">{inspectedRegion.estimated_volume_cm3} cm³</span>
                </div>
                <div className="inspector-data-row">
                  <span className="data-key">Voxel Count:</span>
                  <span className="data-val">{inspectedRegion.voxel_count?.toLocaleString()} voxels</span>
                </div>
                <div className="inspector-data-row">
                  <span className="data-key">Estimated Centroid:</span>
                  <span className="data-val-mono">[{inspectedRegion.centroid_voxel?.join(", ") || "--"}]</span>
                </div>
                <div className="inspector-data-row">
                  <span className="data-key">World Coordinates:</span>
                  <span className="data-val-mono">
                    {inspectedRegion.centroid_world_mm ? `(${inspectedRegion.centroid_world_mm.join(", ")}) mm` : "--"}
                  </span>
                </div>
                <div className="inspector-data-row">
                  <span className="data-key">Crosshair Distance:</span>
                  <span className="data-val-dist">{getInspectorDistance()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Evaluation Benchmarks Dashboard Quick Link */}
          <button
            onClick={onOpenEvaluation}
            className="btn-benchmarks-link"
          >
            📊 View 11-Case Evaluation Benchmarks
          </button>
        </div>
      )}

      {/* SECTION: REPORT GENERATION */}
      <div className="control-section">
        <button
          onClick={onGenerateReport}
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
