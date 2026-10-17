import React, { useState, useEffect, useRef } from "react";
import { fetchSlice } from "../services/api";

export default function TraineeQuizModal({
  isOpen,
  onClose,
  jobId,
  predictionResult,
  crosshair,
}) {
  const [sliceIndex, setSliceIndex] = useState(75);
  const [modality, setModality] = useState("flair");
  const [sliceData, setSliceData] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [clickedCoord, setClickedCoord] = useState(null); // { i, j }
  const [distanceFeedback, setDistanceFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  const canvasRef = useRef(null);

  const wtCentroid = predictionResult?.metrics?.regions?.WT?.centroid_voxel;
  const wtCentroidWorld = predictionResult?.metrics?.regions?.WT?.centroid_world_mm;
  const affine = predictionResult?.volume?.affine;
  const voxelDims = predictionResult?.volume?.voxel_dims_mm || [1.0, 1.0, 1.0];

  // Initialize slice index to centroid k if available
  useEffect(() => {
    if (wtCentroid && Array.isArray(wtCentroid) && wtCentroid.length === 3) {
      setSliceIndex(wtCentroid[2]);
    } else if (crosshair?.voxel?.[2] != null) {
      setSliceIndex(crosshair.voxel[2]);
    }
  }, [wtCentroid, crosshair]);

  // Reset quiz state when opened
  useEffect(() => {
    if (isOpen) {
      setRevealed(false);
      setClickedCoord(null);
      setDistanceFeedback(null);
    }
  }, [isOpen]);

  // Fetch slice image
  useEffect(() => {
    if (!isOpen || !jobId) return;
    let isCancelled = false;
    setLoading(true);

    fetchSlice({
      jobId,
      plane: "axial",
      index: sliceIndex,
      modality,
      showWt: revealed,
      showTc: revealed,
      showEt: revealed,
      wtOpacity: 0.45,
      tcOpacity: 0.70,
      etOpacity: 0.90,
      renderMode: "predicted",
    })
      .then((data) => {
        if (!isCancelled) setSliceData(data);
      })
      .catch((err) => console.error("Quiz slice error:", err))
      .finally(() => {
        if (!isCancelled) setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, jobId, sliceIndex, modality, revealed]);

  if (!isOpen) return null;

  const handleImageClick = (e) => {
    if (revealed) return; // Prevent clicking after reveal
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const normX = clickX / rect.width;
    const normY = clickY / rect.height;

    // MRI image dimension is usually 240x240
    const imgI = Math.round(normX * 240);
    const imgJ = Math.round(normY * 240);

    setClickedCoord({ x: clickX, y: clickY, voxelI: imgI, voxelJ: imgJ });
  };

  const handleReveal = () => {
    setRevealed(true);

    if (clickedCoord && wtCentroid) {
      // Calculate physical distance in mm
      const dxMm = (clickedCoord.voxelI - wtCentroid[0]) * voxelDims[0];
      const dyMm = (clickedCoord.voxelJ - wtCentroid[1]) * voxelDims[1];
      const dzMm = (sliceIndex - wtCentroid[2]) * voxelDims[2];
      const distMm = Math.sqrt(dxMm * dxMm + dyMm * dyMm + dzMm * dzMm);

      let accuracyCategory = "Excellent Spatial Localization";
      let badgeColor = "#10b981";
      if (distMm > 35) {
        accuracyCategory = "Distant Localization";
        badgeColor = "#ef4444";
      } else if (distMm > 18) {
        accuracyCategory = "Approximate Region Identified";
        badgeColor = "#f59e0b";
      }

      setDistanceFeedback({
        distanceMm: distMm.toFixed(1),
        accuracyCategory,
        badgeColor,
        centroidVoxel: wtCentroid,
        centroidWorld: wtCentroidWorld,
      });
    }
  };

  const handleResetQuiz = () => {
    setRevealed(false);
    setClickedCoord(null);
    setDistanceFeedback(null);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth: "800px", width: "95%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 className="modal-title">Trainee Interactive Quiz Mode</h2>
              <span className="brand-badge" style={{ background: "rgba(168, 85, 247, 0.2)", color: "#c084fc", borderColor: "rgba(168, 85, 247, 0.4)" }}>
                Teaching Exercise Only
              </span>
            </div>
            <p className="modal-subtitle">
              Inspect multi-contrast slices, hypothesize the lesion site, and compare with model inference
            </p>
          </div>
          <button onClick={onClose} className="modal-close-btn">✕</button>
        </div>

        {/* Instructions banner */}
        <div style={{ background: "rgba(15, 23, 42, 0.7)", padding: "10px 14px", borderRadius: "8px", margin: "14px 0", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <div style={{ fontSize: "0.82rem", color: "var(--text-main)", fontWeight: 600 }}>
            {!revealed ? (
              clickedCoord ? (
                <span>📍 Target selected! Click <strong>"Reveal Model Prediction"</strong> to check spatial agreement.</span>
              ) : (
                <span>👆 Click directly on the MRI slice below where you suspect the model-predicted lesion center is located.</span>
              )
            ) : (
              <span>✓ Prediction revealed. Review spatial distance metrics and subregion boundaries below.</span>
            )}
          </div>
        </div>

        {/* Sequence & Slice Selector Controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            {["flair", "t1gd", "t2", "t1"].map((m) => (
              <button
                key={m}
                onClick={() => setModality(m)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  border: modality === m ? "1px solid var(--accent-cyan)" : "1px solid rgba(255, 255, 255, 0.1)",
                  background: modality === m ? "rgba(56, 189, 248, 0.2)" : "rgba(15, 23, 42, 0.5)",
                  color: modality === m ? "var(--accent-cyan)" : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Axial Slice:</span>
            <input
              type="range"
              min={0}
              max={154}
              value={sliceIndex}
              onChange={(e) => setSliceIndex(parseInt(e.target.value, 10))}
              style={{ width: "120px" }}
            />
            <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--accent-cyan)" }}>
              #{sliceIndex}
            </span>
          </div>
        </div>

        {/* Interactive Slice Box */}
        <div
          style={{
            position: "relative",
            background: "#000",
            borderRadius: "8px",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: revealed ? "default" : "crosshair",
            minHeight: "320px",
          }}
          onClick={handleImageClick}
        >
          {loading && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0, 0, 0, 0.5)", zIndex: 10 }}>
              <span style={{ fontSize: "0.8rem", color: "var(--accent-cyan)" }}>Loading slice...</span>
            </div>
          )}

          {sliceData?.image_base64 ? (
            <img
              src={`data:image/png;base64,${sliceData.image_base64}`}
              alt="Quiz MRI Slice"
              style={{ maxHeight: "360px", width: "100%", objectFit: "contain", userSelect: "none" }}
            />
          ) : (
            <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>MRI slice not available</div>
          )}

          {/* User's Click Marker */}
          {clickedCoord && (
            <div
              style={{
                position: "absolute",
                left: `${clickedCoord.x}px`,
                top: `${clickedCoord.y}px`,
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  border: "2px solid #a855f7",
                  background: "rgba(168, 85, 247, 0.4)",
                  boxShadow: "0 0 10px #a855f7",
                }}
              />
              <span style={{ fontSize: "0.65rem", color: "#c084fc", fontWeight: 700, background: "rgba(0,0,0,0.8)", padding: "1px 4px", borderRadius: "3px", marginTop: "2px" }}>
                Your Target
              </span>
            </div>
          )}
        </div>

        {/* Feedback Section */}
        {revealed && distanceFeedback && (
          <div
            style={{
              marginTop: "14px",
              padding: "12px 16px",
              background: "rgba(30, 41, 59, 0.5)",
              borderRadius: "8px",
              border: `1px solid ${distanceFeedback.badgeColor}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: distanceFeedback.badgeColor }}>
                {distanceFeedback.accuracyCategory}
              </span>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)", fontFamily: "var(--font-mono)" }}>
                Distance to Centroid: {distanceFeedback.distanceMm} mm
              </span>
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
              Model-predicted Whole Tumour centroid is at voxel [{wtCentroid?.join(", ")}], physical world coordinates ({wtCentroidWorld?.join(", ")} mm).
            </p>
          </div>
        )}

        {/* Mandatory Educational Disclaimer */}
        <div style={{ marginTop: "12px", padding: "8px 12px", background: "rgba(245, 158, 11, 0.08)", borderRadius: "6px", border: "1px solid rgba(245, 158, 11, 0.2)", fontSize: "0.7rem", color: "var(--accent-amber)" }}>
          ⚠️ <strong>Research &amp; Teaching Notice:</strong> Training exercise only — not clinical assessment. No diagnostic scoring or diagnostic certainty is implied.
        </div>

        {/* Footer Actions */}
        <div className="modal-footer" style={{ marginTop: "16px", display: "flex", justifyContent: "space-between" }}>
          <div>
            {revealed && (
              <button onClick={handleResetQuiz} className="btn-reset-view">
                Try Another Location
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            {!revealed ? (
              <button
                onClick={handleReveal}
                disabled={!clickedCoord}
                className="btn-predict"
                style={{
                  padding: "8px 20px",
                  opacity: clickedCoord ? 1 : 0.5,
                  cursor: clickedCoord ? "pointer" : "not-allowed",
                }}
              >
                Reveal Model Prediction
              </button>
            ) : (
              <button onClick={onClose} className="btn-predict" style={{ padding: "8px 20px" }}>
                Done
              </button>
            )}
            <button onClick={onClose} className="btn-demo">
              Exit Quiz
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
