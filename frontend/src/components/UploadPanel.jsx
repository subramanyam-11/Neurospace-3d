import React, { useState } from "react";
import { fetchSampleFiles } from "../services/api";

const MODALITIES = [
  { key: "t1", label: "T1", desc: "Native T1-weighted anatomical reference", channel: "Ch 1" },
  { key: "t1gd", label: "T1Gd", desc: "Post-contrast (Gadolinium) enhancing volume", channel: "Ch 0" },
  { key: "t2", label: "T2", desc: "T2-weighted hyperintense lesion signal", channel: "Ch 2" },
  { key: "flair", label: "FLAIR", desc: "Fluid-attenuated inversion recovery (oedema)", channel: "Ch 3" },
];

export default function UploadPanel({
  files,
  setFiles,
  useTta,
  setUseTta,
  onPredict,
  isProcessing,
  processingStep,
  error,
}) {
  const [loadingDemo, setLoadingDemo] = useState(false);

  const handleFileChange = (key, event) => {
    const file = event.target.files?.[0] || null;
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const handleLoadDemo = async () => {
    try {
      setLoadingDemo(true);
      const demoFiles = await fetchSampleFiles(true);
      setFiles({
        t1: demoFiles.t1,
        t1gd: demoFiles.t1gd,
        t2: demoFiles.t2,
        flair: demoFiles.flair,
        expert_mask: demoFiles.seg || null,
      });
    } catch (err) {
      alert("Failed to load sample demo case: " + err.message);
    } finally {
      setLoadingDemo(false);
    }
  };

  const allFilesSelected = Boolean(files.t1 && files.t1gd && files.t2 && files.flair);

  const formatSize = (bytes) => {
    if (!bytes) return "";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="panel-card">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">MRI Modality Inputs</h2>
          <p className="panel-desc">Upload 4 complementary 3D NIfTI sequences</p>
        </div>
        <button
          onClick={handleLoadDemo}
          disabled={isProcessing || loadingDemo}
          className="btn-demo"
          title="Preload verified BraTS2021_00000 benchmark case into inputs"
        >
          {loadingDemo ? "Fetching..." : "⚡ Load BraTS Demo Case"}
        </button>
      </div>

      {/* 4 Required Modality Selectors */}
      <div className="modality-list">
        {MODALITIES.map((mod) => {
          const currentFile = files[mod.key];
          return (
            <div
              key={mod.key}
              className={`modality-row ${currentFile ? "has-file" : ""}`}
            >
              <div className="modality-left">
                <span className="modality-badge">{mod.label}</span>
                <div className="modality-meta">
                  <div className="modality-filename">
                    {currentFile ? currentFile.name : `Select ${mod.label} file`}
                  </div>
                  <div className="modality-subtitle">
                    {currentFile ? formatSize(currentFile.size) : mod.desc}
                  </div>
                </div>
              </div>

              <label className="btn-browse">
                Browse
                <input
                  type="file"
                  accept="*/*"
                  onChange={(e) => handleFileChange(mod.key, e)}
                  disabled={isProcessing}
                  style={{ display: "none" }}
                />
              </label>
            </div>
          );
        })}
      </div>

      {/* Optional Expert Reference Mask Input */}
      <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed rgba(255, 255, 255, 0.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
          <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", fontWeight: 600 }}>
            Reference Comparison (Optional)
          </span>
          <span style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", background: "rgba(56, 189, 248, 0.1)", padding: "1px 6px", borderRadius: "4px" }}>
            Enables HD95 &amp; Dice
          </span>
        </div>

        <div className={`modality-row ${files.expert_mask ? "has-file" : ""}`} style={{ borderColor: files.expert_mask ? "rgba(16, 185, 129, 0.4)" : undefined }}>
          <div className="modality-left">
            <span className="modality-badge" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#10b981", borderColor: "rgba(16, 185, 129, 0.4)" }}>
              Ref
            </span>
            <div className="modality-meta">
              <div className="modality-filename">
                {files.expert_mask ? files.expert_mask.name : "Expert Reference Mask"}
              </div>
              <div className="modality-subtitle">
                {files.expert_mask ? formatSize(files.expert_mask.size) : "Optional .nii/.nii.gz ground truth segmentation"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "4px" }}>
            {files.expert_mask && (
              <button
                type="button"
                onClick={() => setFiles((prev) => ({ ...prev, expert_mask: null }))}
                className="btn-browse"
                style={{ padding: "4px 8px", background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}
                title="Remove expert mask"
              >
                ✕
              </button>
            )}
            <label className="btn-browse">
              {files.expert_mask ? "Change" : "Browse"}
              <input
                type="file"
                accept="*/*"
                onChange={(e) => handleFileChange("expert_mask", e)}
                disabled={isProcessing}
                style={{ display: "none" }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Test-Time Augmentation (Robustness / Uncertainty) Toggle */}
      <div style={{ marginTop: "10px", padding: "8px 10px", background: "rgba(11, 15, 25, 0.6)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontSize: "0.76rem" }}>
          <div>
            <div style={{ fontWeight: 600, color: "var(--text-main)" }}>
              Robustness &amp; Uncertainty (TTA)
            </div>
            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "1px" }}>
              Deterministic left-right reflection for model disagreement
            </div>
          </div>
          <input
            type="checkbox"
            checked={Boolean(useTta)}
            onChange={(e) => setUseTta(e.target.checked)}
            disabled={isProcessing}
            style={{ width: "16px", height: "16px", cursor: "pointer" }}
          />
        </label>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="status-banner error">
          <span>⚠️</span>
          <div>
            <strong>Prediction Failed: </strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Processing State */}
      {isProcessing && (
        <div className="status-banner processing">
          <div className="spinner" />
          <div>
            <strong>Processing MRI Volumes...</strong>
            <div style={{ fontSize: "0.7rem", opacity: 0.85, marginTop: "2px" }}>
              {processingStep}
            </div>
          </div>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={onPredict}
        disabled={!allFilesSelected || isProcessing}
        className="btn-predict"
      >
        {isProcessing ? (
          <>
            <div className="spinner" />
            <span>Running SegResNet Pipeline...</span>
          </>
        ) : (
          <span>▶ Run Prediction</span>
        )}
      </button>
    </div>
  );
}
