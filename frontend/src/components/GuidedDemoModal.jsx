import React, { useState } from "react";

const DEMO_STEPS = [
  {
    step: 1,
    title: "1. Patient-Specific Brain Anatomy",
    description:
      "NeuroScope extracts a patient-specific anatomical cortical shell directly from the subject's native T1 volume using local marching cubes. No generic atlas or external cloud model is used.",
    tip: "Translucent slate shell allows seeing internal spatial relationships.",
    actionName: "Show Brain Anatomy Only",
    config: {
      visible: { brain: true, WT: false, TC: false, ET: false },
      cutaway: false,
    },
  },
  {
    step: 2,
    title: "2. Whole Tumour (WT) Delineation",
    description:
      "The model delineates the entire abnormal tissue compartment (WT), incorporating central necrosis, active tumour rim, and surrounding hyperintense vasogenic oedema.",
    tip: "Visualized as cyan isosurface with 0.35 opacity.",
    actionName: "Reveal Whole Tumour",
    config: {
      visible: { brain: true, WT: true, TC: false, ET: false },
      cutaway: false,
    },
  },
  {
    step: 3,
    title: "3. Tumour Core (TC) Subregion",
    description:
      "Inside the whole tumour, the model identifies the Tumour Core (TC), which comprises non-enhancing necrotic/cystic components plus the hypervascular rim.",
    tip: "Visualized as amber/orange isosurface nested within WT.",
    actionName: "Reveal Tumour Core",
    config: {
      visible: { brain: false, WT: true, TC: true, ET: false },
      cutaway: false,
    },
  },
  {
    step: 4,
    title: "4. Enhancing Tumour (ET) Subregion",
    description:
      "The active hypervascular periphery (ET) is resolved where blood-brain barrier disruption causes intense post-gadolinium contrast accumulation.",
    tip: "Visualized as crimson red solid core.",
    actionName: "Reveal Enhancing Subregion",
    config: {
      visible: { brain: true, WT: true, TC: true, ET: true },
      cutaway: true,
    },
  },
  {
    step: 5,
    title: "5. Smart Centroid Navigation",
    description:
      "With a single click, the 3D crosshair computes the exact 3D center of mass of the largest predicted region and links all 2D multiplanar slices to that coordinate.",
    tip: "Aligns orthogonal planes to the core of the lesion.",
    actionName: "Center on Region",
    centerTumour: true,
  },
  {
    step: 6,
    title: "6. Linked Multiplanar Orthogonal Views",
    description:
      "Axial, coronal, and sagittal 2D slices dynamically follow the crosshair with millimeter accuracy. Clicking anywhere on a 2D slice moves the 3D crosshair and re-slices all views.",
    tip: "Multi-modality selector allows switching between FLAIR, T1Gd, T1, and T2.",
  },
  {
    step: 7,
    title: "7. Millimeter Volume Quantification",
    description:
      "Estimates total volume (cm³) and voxel counts for WT, TC, and ET using physical voxel spacing from the NIfTI affine matrix. Respects anisotropic slice thickness.",
    tip: "Accurate physical metric computation, non-isotropic aware.",
  },
  {
    step: 8,
    title: "8. Trust, Reliability & Agreement",
    description:
      "NeuroScope assesses signal confidence, including test-time augmentation (TTA) disagreement and overlap metrics (Dice, Sensitivity, HD95) against expert reference masks when provided.",
    tip: "Transparent model introspection, highlighting potential boundary variance.",
  },
  {
    step: 9,
    title: "9. Responsible Research Disclaimer",
    description:
      "NeuroScope is strictly a research and teaching prototype. Displayed regions represent suspected tumour regions predicted by the model. It does not provide primary clinical diagnoses.",
    tip: "Ethical AI with complete local data sovereignty.",
  },
];

export default function GuidedDemoModal({
  isOpen,
  onClose,
  onApplyStepConfig,
  onCenterTumour,
}) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  if (!isOpen) return null;

  const stepData = DEMO_STEPS[currentStepIdx];
  const isFirst = currentStepIdx === 0;
  const isLast = currentStepIdx === DEMO_STEPS.length - 1;

  const handleNext = () => {
    if (!isLast) {
      const nextIdx = currentStepIdx + 1;
      setCurrentStepIdx(nextIdx);
      const nextStep = DEMO_STEPS[nextIdx];
      if (nextStep.config && onApplyStepConfig) {
        onApplyStepConfig(nextStep.config);
      }
      if (nextStep.centerTumour && onCenterTumour) {
        onCenterTumour();
      }
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      const prevIdx = currentStepIdx - 1;
      setCurrentStepIdx(prevIdx);
      const prevStep = DEMO_STEPS[prevIdx];
      if (prevStep.config && onApplyStepConfig) {
        onApplyStepConfig(prevStep.config);
      }
    }
  };

  const handleApplyCurrent = () => {
    if (stepData.config && onApplyStepConfig) {
      onApplyStepConfig(stepData.config);
    }
    if (stepData.centerTumour && onCenterTumour) {
      onCenterTumour();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth: "620px", width: "92%" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 className="modal-title">Guided Hackathon Demo</h2>
              <span className="brand-badge" style={{ background: "rgba(2, 132, 199, 0.2)", color: "#38bdf8" }}>
                Step {currentStepIdx + 1} of {DEMO_STEPS.length}
              </span>
            </div>
            <p className="modal-subtitle">
              5-minute end-to-end interactive demonstration walkthrough
            </p>
          </div>
          <button onClick={onClose} className="modal-close-btn">✕</button>
        </div>

        {/* Progress Bar */}
        <div style={{ width: "100%", height: "4px", background: "rgba(255, 255, 255, 0.1)", borderRadius: "2px", margin: "14px 0" }}>
          <div
            style={{
              width: `${((currentStepIdx + 1) / DEMO_STEPS.length) * 100}%`,
              height: "100%",
              background: "linear-gradient(90deg, #38bdf8, #818cf8)",
              borderRadius: "2px",
              transition: "width 0.25s ease",
            }}
          />
        </div>

        {/* Step Content */}
        <div style={{ minHeight: "160px", padding: "16px", background: "rgba(15, 23, 42, 0.7)", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <h3 style={{ fontSize: "1.05rem", color: "var(--accent-cyan)", marginBottom: "8px" }}>
            {stepData.title}
          </h3>
          <p style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "var(--text-main)" }}>
            {stepData.description}
          </p>

          <div style={{ marginTop: "12px", padding: "8px 12px", background: "rgba(30, 41, 59, 0.6)", borderRadius: "6px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
            💡 <strong>Presenter Tip:</strong> {stepData.tip}
          </div>

          {stepData.actionName && (
            <button
              onClick={handleApplyCurrent}
              style={{
                marginTop: "12px",
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                background: "rgba(56, 189, 248, 0.15)",
                color: "var(--accent-cyan)",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ▶ Apply View: {stepData.actionName}
            </button>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="modal-footer" style={{ marginTop: "18px", display: "flex", justifyContent: "space-between" }}>
          <button onClick={onClose} className="btn-demo" style={{ padding: "8px 16px" }}>
            Exit Demo
          </button>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handlePrev}
              disabled={isFirst}
              className="btn-reset-view"
              style={{ opacity: isFirst ? 0.4 : 1 }}
            >
              ← Previous
            </button>
            <button
              onClick={handleNext}
              disabled={isLast}
              className="btn-predict"
              style={{ padding: "8px 20px" }}
            >
              {isLast ? "Finished ✓" : "Next Step →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
