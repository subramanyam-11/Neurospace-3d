import React, { useState, useEffect } from "react";
import { fetchSlice } from "../services/api";

const MODALITY_DETAILS = {
  flair: {
    name: "FLAIR (Fluid-Attenuated Inversion Recovery)",
    tag: "Free-Water Suppressed Oedema",
    color: "#38bdf8",
    description:
      "Uses a 180° inversion recovery pulse timed to null the high T2 signal of cerebrospinal fluid (CSF) in brain ventricles and sulci. Hyperintense signal cleanly delineates the Whole Tumour (WT) boundary, including surrounding vasogenic oedema, without CSF bleed-through.",
    visualClue:
      "Ventricles appear dark black, while peritumoural oedema and infiltrate glow bright white/grey.",
    targetRegion: "Whole Tumour (WT)",
  },
  t1gd: {
    name: "T1Gd (T1-Weighted Post-Contrast / T1CE)",
    tag: "Blood-Brain Barrier Disruption",
    color: "#ef4444",
    description:
      "Administered intravenous gadolinium contrast agent cannot penetrate an intact blood-brain barrier (BBB). Where aggressive tumour neoangiogenesis has disrupted vascular tight junctions, gadolinium extravasates, markedly shortening T1 relaxation and highlighting the Enhancing Tumour (ET) rim.",
    visualClue:
      "Bright glowing rim surrounding central non-enhancing necrosis (Tumour Core / TC).",
    targetRegion: "Enhancing Tumour (ET) & Core (TC)",
  },
  t1: {
    name: "T1-Weighted (T1 Native)",
    tag: "Cortical Anatomy & Baseline Contrast",
    color: "#94a3b8",
    description:
      "Provides optimal contrast between cerebral cortex (grey matter) and myelinated tracts (white matter). Essential for establishing patient-specific anatomical landmarks, stereotactic registration, and verifying that non-tumour brain architecture is preserved.",
    visualClue:
      "White matter appears bright, grey matter intermediate, and CSF appears dark.",
    targetRegion: "Patient Anatomical Shell",
  },
  t2: {
    name: "T2-Weighted (T2)",
    tag: "Bound Water & Hyperintense Edema",
    color: "#f59e0b",
    description:
      "Sensitive to proton spin-spin dephasing times. Areas of high fluid content, tissue inflammation, and interstitial fluid accumulation remain hyperintense. Used in conjunction with FLAIR to confirm non-cystic fluid expansion and vasogenic edema.",
    visualClue:
      "Both free CSF and pathological vasogenic edema show pronounced hyperintensity.",
    targetRegion: "Vasogenic Oedema & Core",
  },
};

export default function SequenceExplorerModal({
  isOpen,
  onClose,
  jobId,
  voxelCoord = [120, 120, 75],
  volumeMeta,
}) {
  const [selectedModality, setSelectedModality] = useState("flair");
  const [sliceData, setSliceData] = useState(null);
  const [loading, setLoading] = useState(false);

  const k = voxelCoord?.[2] ?? 75;
  const current = MODALITY_DETAILS[selectedModality];

  useEffect(() => {
    if (!isOpen || !jobId) return;
    let isCancelled = false;
    setLoading(true);

    fetchSlice({
      jobId,
      plane: "axial",
      index: k,
      modality: selectedModality,
      showWt: true,
      showTc: true,
      showEt: true,
      wtOpacity: 0.35,
      tcOpacity: 0.65,
      etOpacity: 0.85,
    })
      .then((data) => {
        if (!isCancelled) setSliceData(data);
      })
      .catch((err) => console.error("Sequence explorer slice error:", err))
      .finally(() => {
        if (!isCancelled) setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, jobId, selectedModality, k]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth: "860px", width: "95%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 className="modal-title">Why Four MRI Sequences?</h2>
              <span className="brand-badge">Educational Teaching</span>
            </div>
            <p className="modal-subtitle">
              Explore how complementary multi-modal contrast enables 3D subregion deconvolution
            </p>
          </div>
          <button onClick={onClose} className="modal-close-btn">✕</button>
        </div>

        {/* Modality Selector Tabs */}
        <div style={{ display: "flex", gap: "8px", margin: "16px 0", flexWrap: "wrap" }}>
          {Object.entries(MODALITY_DETAILS).map(([key, info]) => {
            const isSelected = selectedModality === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedModality(key)}
                style={{
                  flex: "1 1 180px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: isSelected ? `2px solid ${info.color}` : "1px solid rgba(255, 255, 255, 0.1)",
                  background: isSelected ? "rgba(30, 41, 59, 0.85)" : "rgba(15, 23, 42, 0.6)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: info.color }}>
                  {key.toUpperCase()}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  {info.tag}
                </div>
              </button>
            );
          })}
        </div>

        {/* Two-Column Comparison View */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
          {/* Left: Slice Preview */}
          <div style={{ background: "rgba(0, 0, 0, 0.5)", borderRadius: "8px", padding: "12px", border: "1px solid rgba(255, 255, 255, 0.08)", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "8px" }}>
              <span>Axial Slice #{k}</span>
              <span style={{ color: current.color, fontWeight: 600 }}>{selectedModality.toUpperCase()}</span>
            </div>

            <div style={{ position: "relative", minHeight: "260px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {loading && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0, 0, 0, 0.6)", zIndex: 5 }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--accent-cyan)" }}>Loading slice...</span>
                </div>
              )}
              {sliceData?.image_base64 ? (
                <img
                  src={`data:image/png;base64,${sliceData.image_base64}`}
                  alt={`${selectedModality} slice`}
                  style={{ width: "100%", maxHeight: "300px", objectFit: "contain", borderRadius: "4px" }}
                />
              ) : (
                <div style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>Slice unavailable</div>
              )}
            </div>
            <p style={{ fontSize: "0.7rem", color: "var(--text-dim)", marginTop: "8px" }}>
              Crosshair linked to Axial plane. Overlaid with model-predicted WT (cyan), TC (amber), ET (crimson).
            </p>
          </div>

          {/* Right: Modality Teaching Card */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ padding: "14px", background: "rgba(30, 41, 59, 0.4)", borderRadius: "8px", borderLeft: `3px solid ${current.color}` }}>
              <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: current.color, fontWeight: 700 }}>
                Modality Role in BraTS Deconvolution
              </div>
              <h3 style={{ fontSize: "1.05rem", color: "#fff", marginTop: "4px", marginBottom: "8px" }}>
                {current.name}
              </h3>
              <p style={{ fontSize: "0.82rem", lineHeight: 1.5, color: "var(--text-muted)" }}>
                {current.description}
              </p>
            </div>

            <div style={{ padding: "12px", background: "rgba(15, 23, 42, 0.6)", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600 }}>
                Key Visual Characteristics
              </div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-main)", marginTop: "4px" }}>
                {current.visualClue}
              </p>
            </div>

            <div style={{ padding: "12px", background: "rgba(15, 23, 42, 0.6)", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600 }}>
                Target Model Region
              </div>
              <p style={{ fontSize: "0.8rem", color: current.color, fontWeight: 600, marginTop: "4px" }}>
                {current.targetRegion}
              </p>
            </div>

            {/* Teaching Disclaimer */}
            <div style={{ padding: "8px 12px", borderRadius: "6px", background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.2)", fontSize: "0.7rem", color: "var(--accent-amber)" }}>
              ⚠️ <strong>Educational Visualization:</strong> Intensity differences across modalities provide complementary physical tissue signals. Visual intensity alone does not constitute a diagnostic determination.
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ marginTop: "20px" }}>
          <button onClick={onClose} className="btn-demo" style={{ padding: "8px 24px" }}>
            Done Exploring
          </button>
        </div>
      </div>
    </div>
  );
}
