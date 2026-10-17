import React, { useState } from "react";
import { fetchSimulation } from "../services/api";

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
  onOpenQuiz,
  onOpenGuidedDemo,
  onOpenShortcuts,
  onCrosshairChange,
  crosshair,
  showSimulation = false,
  setShowSimulation,
  simulationData = null,
  setSimulationData,
  simulationOpacity = 0.35,
  setSimulationOpacity,
  onFocusScenario,
}) {
  const [showReliabilityDetails, setShowReliabilityDetails] = useState(false);
  const [showResearchSafety, setShowResearchSafety] = useState(false);
  const [activeTeachingStep, setActiveTeachingStep] = useState(null); // null or 0, 1, 2
  const [selectedInspectorRegion, setSelectedInspectorRegion] = useState("WT");
  const [jumpNotification, setJumpNotification] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);

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

  // Quick View Modes
  const handleSetQuickMode = (mode) => {
    setActiveTeachingStep(null);
    if (mode === "full") {
      setVisibleRegions({ brain: true, WT: true, TC: true, ET: true, TP: true, FP: true, FN: true, simulated: true });
      setOpacities((prev) => ({ ...prev, brain: 0.20, WT: 0.35, TC: 0.65, ET: 0.85 }));
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
      setOpacities((prev) => ({ ...prev, brain: 0.30, WT: 0.40, TC: 0.75, ET: 0.95 }));
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

  // Simulation Expansion Change
  const handleExpansionSelect = async (pct) => {
    if (!predictionResult?.job_id) return;
    try {
      setIsSimulating(true);
      const sim = await fetchSimulation({ jobId: predictionResult.job_id, expansionPct: pct });
      setSimulationData(sim);
      setShowSimulation(true);
    } catch (err) {
      console.error("Simulation error:", err);
    } finally {
      setIsSimulating(false);
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

      {/* QUICK VIEW MODES BAR */}
      <div style={{ marginBottom: "14px" }}>
        <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", fontWeight: 700, marginBottom: "6px" }}>
          Quick View Modes
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "6px" }}>
          <button
            onClick={() => handleSetQuickMode("full")}
            className="btn-browse"
            style={{ fontSize: "0.72rem", padding: "6px 8px", textAlign: "center" }}
            title="Brain shell + all tumour subregions"
          >
            Full Anatomy
          </button>
          <button
            onClick={() => handleSetQuickMode("tumour_only")}
            className="btn-browse"
            style={{ fontSize: "0.72rem", padding: "6px 8px", textAlign: "center" }}
            title="Hide cortical brain shell"
          >
            Tumour Only
          </button>
          <button
            onClick={() => handleSetQuickMode("anatomy_only")}
            className="btn-browse"
            style={{ fontSize: "0.72rem", padding: "6px 8px", textAlign: "center" }}
            title="Hide all tumour subregions"
          >
            Anatomy Only
          </button>
          <button
            onClick={() => handleSetQuickMode("inside_brain")}
            className="btn-browse"
            style={{ fontSize: "0.72rem", padding: "6px 8px", textAlign: "center" }}
            title="Translucent brain shell with high-contrast core"
          >
            Tumour Inside Brain
          </button>
        </div>
        <button
          onClick={() => handleSetQuickMode("cutaway")}
          className="btn-browse"
          style={{
            width: "100%",
            fontSize: "0.72rem",
            padding: "6px 8px",
            textAlign: "center",
            background: cutaway ? "rgba(56, 189, 248, 0.25)" : "rgba(15, 23, 42, 0.6)",
            borderColor: cutaway ? "var(--accent-cyan)" : "var(--border-color)",
            color: cutaway ? "var(--accent-cyan)" : "var(--text-muted)",
          }}
          title="Section view clipping plane through brain anatomy"
        >
          {cutaway ? "✓ Cutaway / Section View Active" : "✂ 3D Anatomy Cutaway / Section View"}
        </button>
      </div>

      {/* TEACHING MODULES LAUNCHPAD */}
      <div style={{ marginBottom: "14px", padding: "10px", background: "rgba(30, 41, 59, 0.35)", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
        <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--accent-cyan)", fontWeight: 700, marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Teaching &amp; Exploration Modes</span>
          <span className="brand-badge" style={{ fontSize: "0.6rem" }}>Interactive</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          <button
            onClick={activeTeachingStep !== null ? handleExitTeaching : handleStartTeaching}
            className="btn-browse"
            style={{
              fontSize: "0.72rem",
              padding: "6px",
              textAlign: "center",
              background: activeTeachingStep !== null ? "rgba(56, 189, 248, 0.25)" : undefined,
              borderColor: activeTeachingStep !== null ? "var(--accent-cyan)" : undefined,
              color: activeTeachingStep !== null ? "var(--accent-cyan)" : undefined,
            }}
          >
            {activeTeachingStep !== null ? "Exit Tumour Reveal" : "🔬 Explore Tumour Layers"}
          </button>

          <button
            onClick={onOpenSequenceExplorer}
            className="btn-browse"
            style={{ fontSize: "0.72rem", padding: "6px", textAlign: "center" }}
          >
            🧠 Why 4 MRI Sequences?
          </button>

          <button
            onClick={onOpenQuiz}
            className="btn-browse"
            style={{ fontSize: "0.72rem", padding: "6px", textAlign: "center" }}
          >
            🎯 Trainee Quiz Mode
          </button>

          <button
            onClick={onOpenGuidedDemo}
            className="btn-browse"
            style={{ fontSize: "0.72rem", padding: "6px", textAlign: "center", color: "#38bdf8", fontWeight: 700 }}
          >
            ⚡ Start Guided Demo
          </button>
        </div>

        {/* LAYER-BY-LAYER TUMOUR REVEAL HUD */}
        {activeTeachingStep !== null && (
          <div style={{ marginTop: "10px", padding: "10px", background: "rgba(15, 23, 42, 0.85)", borderRadius: "6px", border: `1px solid ${TEACHING_STEPS[activeTeachingStep].color}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: TEACHING_STEPS[activeTeachingStep].color }}>
                Step {activeTeachingStep + 1} of 3: {TEACHING_STEPS[activeTeachingStep].title}
              </span>
              <button onClick={handleExitTeaching} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: "0.75rem" }}>
                ✕ Exit
              </button>
            </div>
            <p style={{ fontSize: "0.74rem", color: "var(--text-main)", margin: "6px 0", lineHeight: 1.4 }}>
              {TEACHING_STEPS[activeTeachingStep].description}
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "6px", marginTop: "8px" }}>
              <button
                onClick={handlePrevTeaching}
                disabled={activeTeachingStep === 0}
                className="btn-reset-view"
                style={{ fontSize: "0.68rem", padding: "4px 8px", opacity: activeTeachingStep === 0 ? 0.4 : 1 }}
              >
                ← Previous
              </button>
              <button
                onClick={handleNextTeaching}
                disabled={activeTeachingStep === TEACHING_STEPS.length - 1}
                className="btn-predict"
                style={{ fontSize: "0.68rem", padding: "4px 12px", opacity: activeTeachingStep === TEACHING_STEPS.length - 1 ? 0.4 : 1 }}
              >
                Next Step →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SMART CROSSHAIR NAVIGATION */}
      {metrics?.regions && (
        <div style={{ marginBottom: "14px", padding: "10px", background: "rgba(15, 23, 42, 0.65)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
          <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", fontWeight: 700, marginBottom: "6px" }}>
            Smart Crosshair Navigation
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
            <button
              onClick={() => handleJumpToCentroid("WT")}
              className="btn-browse"
              style={{ fontSize: "0.72rem", padding: "5px 4px", textAlign: "center" }}
              title="Jump crosshair to Whole Tumour centroid"
            >
              Jump to WT
            </button>
            <button
              onClick={() => handleJumpToCentroid("TC")}
              className="btn-browse"
              style={{ fontSize: "0.72rem", padding: "5px 4px", textAlign: "center" }}
              title="Jump crosshair to Tumour Core centroid"
            >
              Jump to TC
            </button>
            <button
              onClick={() => handleJumpToCentroid("ET")}
              className="btn-browse"
              style={{ fontSize: "0.72rem", padding: "5px 4px", textAlign: "center" }}
              title="Jump crosshair to Enhancing Tumour centroid"
            >
              Jump to ET
            </button>
          </div>
          {jumpNotification && (
            <div style={{ marginTop: "6px", fontSize: "0.7rem", color: "var(--accent-cyan)", fontStyle: "italic" }}>
              ✓ {jumpNotification}
            </div>
          )}
        </div>
      )}

      {/* REGION INSPECTOR */}
      {metrics?.regions && (
        <div style={{ marginBottom: "14px", padding: "10px", background: "rgba(11, 15, 25, 0.75)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", fontWeight: 700 }}>
              Region Inspector
            </span>
            <div style={{ display: "flex", gap: "4px" }}>
              {["WT", "TC", "ET"].map((k) => (
                <button
                  key={k}
                  onClick={() => setSelectedInspectorRegion(k)}
                  style={{
                    background: selectedInspectorRegion === k ? "rgba(56, 189, 248, 0.25)" : "transparent",
                    color: selectedInspectorRegion === k ? "var(--accent-cyan)" : "var(--text-dim)",
                    border: selectedInspectorRegion === k ? "1px solid var(--accent-cyan)" : "1px solid transparent",
                    borderRadius: "4px",
                    padding: "1px 6px",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          {inspectedRegion && (
            <div style={{ fontSize: "0.72rem", display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-dim)" }}>Subregion:</span>
                <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{inspectedRegion.name}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-dim)" }}>Estimated Volume:</span>
                <span style={{ fontWeight: 700, color: "var(--accent-cyan)" }}>{inspectedRegion.estimated_volume_cm3} cm³</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-dim)" }}>Active Voxels:</span>
                <span style={{ color: "var(--text-main)" }}>{inspectedRegion.voxel_count?.toLocaleString()} voxels</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-dim)" }}>Estimated Centroid:</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                  [{inspectedRegion.centroid_voxel?.join(", ") || "--"}]
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-dim)" }}>World Coordinates:</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                  {inspectedRegion.centroid_world_mm ? `(${inspectedRegion.centroid_world_mm.join(", ")}) mm` : "--"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-dim)" }}>Crosshair Distance:</span>
                <span style={{ color: "var(--accent-amber)", fontWeight: 600 }}>{getInspectorDistance()}</span>
              </div>

              {hasExpert && agreement?.[selectedInspectorRegion] && (
                <div style={{ marginTop: "4px", paddingTop: "4px", borderTop: "1px dashed rgba(255, 255, 255, 0.1)", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#10b981" }}>Reference Dice:</span>
                  <span style={{ fontWeight: 700, color: "#10b981" }}>
                    {(agreement[selectedInspectorRegion].dice * 100).toFixed(1)}% (Δ {agreement[selectedInspectorRegion].volume_difference_cm3} cm³)
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* HYPOTHETICAL SPATIAL IMPACT SIMULATOR (PHASE 4) */}
      <div style={{ marginBottom: "14px", padding: "10px", background: "rgba(168, 85, 247, 0.08)", borderRadius: "8px", border: "1px solid rgba(168, 85, 247, 0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#c084fc", fontWeight: 700 }}>
            Hypothetical Spatial Impact
          </span>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.7rem", color: "#c084fc" }}>
            <input
              type="checkbox"
              checked={showSimulation}
              onChange={(e) => setShowSimulation(e.target.checked)}
            />
            <span>{showSimulation ? "Enabled" : "Off"}</span>
          </label>
        </div>

        {showSimulation && (
          <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Simulated Expansion:</span>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#c084fc" }}>
                +{simulationData?.expansion_pct ?? 25}%
              </span>
            </div>

            {/* Expansion Percent Buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "4px" }}>
              {[0, 10, 25, 50, 100].map((pct) => {
                const isSelected = (simulationData?.expansion_pct ?? 25) === pct;
                return (
                  <button
                    key={pct}
                    onClick={() => handleExpansionSelect(pct)}
                    disabled={isSimulating}
                    style={{
                      padding: "4px 0",
                      textAlign: "center",
                      borderRadius: "4px",
                      fontSize: "0.68rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: isSelected ? "1px solid #c084fc" : "1px solid rgba(255, 255, 255, 0.1)",
                      background: isSelected ? "rgba(168, 85, 247, 0.35)" : "rgba(15, 23, 42, 0.6)",
                      color: isSelected ? "#fff" : "var(--text-muted)",
                    }}
                  >
                    {pct}%
                  </button>
                );
              })}
            </div>

            {/* Simulation Metrics Readout */}
            <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "8px", borderRadius: "6px", fontSize: "0.7rem", display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-dim)" }}>Original WT Volume:</span>
                <span style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>{simulationData?.original_volume_cm3 ?? metrics?.regions?.WT?.estimated_volume_cm3 ?? "--"} cm³</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-dim)" }}>Simulated Volume:</span>
                <span style={{ color: "#c084fc", fontWeight: 700 }}>{simulationData?.simulated_volume_cm3 ?? "--"} cm³</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-dim)" }}>Additional Volume:</span>
                <span style={{ color: "var(--text-main)" }}>+{simulationData?.added_volume_cm3 ?? "--"} cm³</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-dim)" }}>Distance to Brain Surface:</span>
                <span style={{ color: "var(--accent-amber)", fontWeight: 600 }}>
                  {simulationData?.distance_to_brain_surface_mm !== null ? `${simulationData?.distance_to_brain_surface_mm} mm` : "--"}
                </span>
              </div>
            </div>

            <button
              onClick={onFocusScenario}
              className="btn-browse"
              style={{ fontSize: "0.72rem", padding: "5px 8px", textAlign: "center", color: "#c084fc", borderColor: "rgba(192, 132, 252, 0.4)" }}
            >
              Focus Scenario Camera
            </button>

            {/* Phase 4 Strict Safety Disclaimer */}
            <div style={{ fontSize: "0.66rem", color: "var(--text-dim)", lineHeight: 1.3, fontStyle: "italic" }}>
              Hypothetical spatial simulation — not a prediction of tumour growth, tissue damage, prognosis, or treatment outcome.
            </div>
          </div>
        )}
      </div>

      {/* FEATURE GROUP A: Prediction vs Expert Reference Toggle */}
      {hasExpert && (
        <div style={{ marginBottom: "14px", padding: "10px", background: "rgba(16, 185, 129, 0.08)", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#10b981", fontWeight: 700 }}>
              Prediction vs Expert
            </span>
            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
              Reference Active
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
        </div>
      )}

      {/* STANDARD REGION TOGGLES & OPACITY SLIDERS */}
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
              {Math.round((opacities.brain ?? 0.18) * 100)}%
            </span>
          </div>

          <div className="slider-row">
            <span className="slider-hint">Opacity</span>
            <input
              type="range"
              min="0.02"
              max="0.8"
              step="0.02"
              value={opacities.brain ?? 0.18}
              onChange={(e) => handleOpacityChange("brain", e.target.value)}
              className="opacity-slider"
            />
          </div>
        </div>
      </div>

      {/* Model Estimation Summary Card */}
      {metrics?.regions && (
        <div className="metrics-card">
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

      {/* Keyboard Shortcuts Button */}
      <button
        onClick={onOpenShortcuts}
        className="btn-browse"
        style={{ width: "100%", textAlign: "center", padding: "6px 12px", marginTop: "6px", fontSize: "0.72rem" }}
      >
        ⌨️ View Keyboard Shortcuts (R, B, W, T, E, 1, 2, 3)
      </button>

      {/* Privacy & Local Processing Indicator */}
      <div style={{ marginTop: "12px", padding: "8px 10px", background: "rgba(16, 185, 129, 0.08)", borderRadius: "6px", border: "1px solid rgba(16, 185, 129, 0.2)", fontSize: "0.68rem", color: "#10b981", display: "flex", alignItems: "center", gap: "6px" }}>
        <span>🔒</span>
        <span>
          <strong>LOCAL PROCESSING:</strong> Your MRI volumes are processed strictly on this machine. No external AI cloud service is used.
        </span>
      </div>

      {/* Collapsible Research & Safety Panel */}
      <div style={{ marginTop: "8px" }}>
        <button
          onClick={() => setShowResearchSafety(!showResearchSafety)}
          style={{ width: "100%", background: "none", border: "none", color: "var(--text-dim)", fontSize: "0.7rem", cursor: "pointer", display: "flex", justifyContent: "space-between", padding: "4px 0" }}
        >
          <span>Research &amp; Safety Disclosures</span>
          <span>{showResearchSafety ? "▲" : "▼"}</span>
        </button>
        {showResearchSafety && (
          <div style={{ marginTop: "4px", padding: "8px", background: "rgba(15, 23, 42, 0.6)", borderRadius: "6px", fontSize: "0.68rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
            <p>• <strong>Research &amp; Teaching Prototype:</strong> Displayed regions represent suspected tumour regions predicted by the model.</p>
            <p style={{ marginTop: "4px" }}>• <strong>Estimated Volumes:</strong> Derived mathematically from voxel dimensions in the NIfTI header.</p>
            <p style={{ marginTop: "4px" }}>• <strong>De-identified Data:</strong> Intended solely for public, de-identified research data.</p>
            <p style={{ marginTop: "4px" }}>• <strong>No Medical Diagnosis:</strong> This tool is not clinically validated for patient diagnosis or treatment planning.</p>
          </div>
        )}
      </div>
    </div>
  );
}
