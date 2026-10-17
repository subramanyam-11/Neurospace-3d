import React, { useState } from "react";

const REGIONS = [
  {
    key: "WT",
    label: "Whole Tumour (WT)",
    desc: "Complete hyperintense tumour volume & oedema",
    dotClass: "dot-wt",
    color: "#38bdf8",
  },
  {
    key: "TC",
    label: "Tumour Core (TC)",
    desc: "Non-enhancing necrotic components + enhancing rim",
    dotClass: "dot-tc",
    color: "#f59e0b",
  },
  {
    key: "ET",
    label: "Enhancing Tumour (ET)",
    desc: "Active hypervascular rim",
    dotClass: "dot-et",
    color: "#ef4444",
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
  tumourScales = { WT: 1.0, TC: 1.0, ET: 1.0 },
  setTumourScales,
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
  onOpenSequenceExplorer,
  onOpenGuidedDemo,
}) {
  const [activeTeachingStep, setActiveTeachingStep] = useState(null); // null or 0, 1, 2

  const hasExpert = Boolean(predictionResult?.has_expert && predictionResult?.expert_agreement);

  const toggleRegion = (key) => {
    setVisibleRegions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleOpacityChange = (key, val) => {
    setOpacities((prev) => ({ ...prev, [key]: parseFloat(val) }));
  };

  const handleScaleChange = (key, val) => {
    setTumourScales((prev) => ({ ...prev, [key]: parseFloat(val) }));
  };

  const handleResetScales = () => {
    setTumourScales({ WT: 1.0, TC: 1.0, ET: 1.0 });
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

  const isAnyScaleAdjusted =
    Math.abs((tumourScales?.WT ?? 1.0) - 1.0) > 0.01 ||
    Math.abs((tumourScales?.TC ?? 1.0) - 1.0) > 0.01 ||
    Math.abs((tumourScales?.ET ?? 1.0) - 1.0) > 0.01;

  return (
    <div className="controls-panel-root">
      {/* Top Header Card */}
      <div className="panel-top-bar">
        <div>
          <h2 className="panel-title">Workspace Controls</h2>
          <p className="panel-desc">Anatomy view modes, subregions &amp; variable scale</p>
        </div>
        <button
          onClick={onResetView}
          className="btn-reset-view"
          title="Reset 3D camera to optimal axial/anterior framing"
        >
          Reset View
        </button>
      </div>

      {/* SECTION: VIEW MODES */}
      <div className="control-section">
        <div className="section-label-bar">
          <span className="section-title">VIEW MODES</span>
        </div>
        <div className="view-modes-grid">
          <button
            onClick={() => handleSetQuickMode("full")}
            className="btn-view-mode"
          >
            Full Anatomy
          </button>
          <button
            onClick={() => handleSetQuickMode("tumour_only")}
            className="btn-view-mode"
          >
            Tumour Only
          </button>
          <button
            onClick={() => handleSetQuickMode("anatomy_only")}
            className="btn-view-mode"
          >
            Anatomy Only
          </button>
          <button
            onClick={() => handleSetQuickMode("inside_brain")}
            className="btn-view-mode"
          >
            Tumour Inside Brain
          </button>
          <button
            onClick={() => handleSetQuickMode("cutaway")}
            className={`btn-view-mode full-width ${cutaway ? "active-cutaway" : ""}`}
          >
            {cutaway ? "✕ Disable Section Cutaway" : "✂ 3D Anatomy Cutaway / Section View"}
          </button>
        </div>
      </div>

      {/* SECTION: TEACHING & EXPLORATION */}
      <div className="control-section">
        <div className="section-label-bar">
          <span className="section-title">TEACHING &amp; EXPLORATION</span>
          <span className="section-badge">Interactive</span>
        </div>

        <div className="teaching-actions-grid">
          <button
            onClick={activeTeachingStep !== null ? handleExitTeaching : handleStartTeaching}
            className={`btn-teaching-action ${activeTeachingStep !== null ? "active-step" : ""}`}
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

      {/* SECTION: SEGMENTATION SUBREGIONS (OPACITIES & VISIBILITY) */}
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

      {/* NEW SECTION: VARIABLE TUMOUR SIZE / VOLUME (3 SLIDERS) */}
      <div className="control-section variable-size-section">
        <div className="section-label-bar">
          <span className="section-title">VARIABLE TUMOUR SIZE / VOLUME</span>
          {isAnyScaleAdjusted && (
            <button
              type="button"
              onClick={handleResetScales}
              className="btn-reset-scales"
              title="Reset all tumour subregions to 1.00x original predicted volume"
            >
              ↺ Reset Sizes
            </button>
          )}
        </div>
        <p className="section-subtitle-hint">
          Simulate variable tumour scale in 3D &amp; live quantitative volume
        </p>

        <div className="size-sliders-list">
          {/* Slider 1: Whole Tumour (WT) Size */}
          <div className="size-slider-card wt-slider-card">
            <div className="size-slider-header">
              <div className="size-label-group">
                <span className="size-dot dot-wt" />
                <span className="size-title">WT Tumour Size</span>
              </div>
              <span className="size-val-pill wt-pill">
                {(tumourScales?.WT ?? 1.0).toFixed(2)}× ({Math.round((tumourScales?.WT ?? 1.0) * 100)}%)
              </span>
            </div>
            <div className="slider-track-wrap">
              <input
                type="range"
                min="0.20"
                max="2.00"
                step="0.05"
                value={tumourScales?.WT ?? 1.0}
                onChange={(e) => handleScaleChange("WT", e.target.value)}
                className="tumour-scale-slider wt-slider"
              />
              <div className="scale-marks-row">
                <span>0.2×</span>
                <span className="mark-center">1.0× (Base)</span>
                <span>2.0×</span>
              </div>
            </div>
          </div>

          {/* Slider 2: Tumour Core (TC) Size */}
          <div className="size-slider-card tc-slider-card">
            <div className="size-slider-header">
              <div className="size-label-group">
                <span className="size-dot dot-tc" />
                <span className="size-title">TC Core Size</span>
              </div>
              <span className="size-val-pill tc-pill">
                {(tumourScales?.TC ?? 1.0).toFixed(2)}× ({Math.round((tumourScales?.TC ?? 1.0) * 100)}%)
              </span>
            </div>
            <div className="slider-track-wrap">
              <input
                type="range"
                min="0.20"
                max="2.00"
                step="0.05"
                value={tumourScales?.TC ?? 1.0}
                onChange={(e) => handleScaleChange("TC", e.target.value)}
                className="tumour-scale-slider tc-slider"
              />
              <div className="scale-marks-row">
                <span>0.2×</span>
                <span className="mark-center">1.0× (Base)</span>
                <span>2.0×</span>
              </div>
            </div>
          </div>

          {/* Slider 3: Enhancing Tumour (ET) Size */}
          <div className="size-slider-card et-slider-card">
            <div className="size-slider-header">
              <div className="size-label-group">
                <span className="size-dot dot-et" />
                <span className="size-title">ET Enhancing Size</span>
              </div>
              <span className="size-val-pill et-pill">
                {(tumourScales?.ET ?? 1.0).toFixed(2)}× ({Math.round((tumourScales?.ET ?? 1.0) * 100)}%)
              </span>
            </div>
            <div className="slider-track-wrap">
              <input
                type="range"
                min="0.20"
                max="2.00"
                step="0.05"
                value={tumourScales?.ET ?? 1.0}
                onChange={(e) => handleScaleChange("ET", e.target.value)}
                className="tumour-scale-slider et-slider"
              />
              <div className="scale-marks-row">
                <span>0.2×</span>
                <span className="mark-center">1.0× (Base)</span>
                <span>2.0×</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
