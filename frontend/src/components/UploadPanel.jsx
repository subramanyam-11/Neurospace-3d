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
      const demoFiles = await fetchSampleFiles();
      setFiles({
        t1: demoFiles.t1,
        t1gd: demoFiles.t1gd,
        t2: demoFiles.t2,
        flair: demoFiles.flair,
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

      {/* 4 Modality Selectors */}
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
