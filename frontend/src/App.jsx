import React, { useState, useEffect, useRef } from "react";
import Header from "./components/Header";
import DisclaimerBanner from "./components/DisclaimerBanner";
import UploadPanel from "./components/UploadPanel";
import ControlsPanel from "./components/ControlsPanel";
import Viewer3D from "./components/Viewer3D";
import MultiplanarViewer from "./components/MultiplanarViewer";
import EvaluationModal from "./components/EvaluationModal";
import ReportModal from "./components/ReportModal";
import { checkHealth, predictMri } from "./services/api";

export default function App() {
  const [backendOnline, setBackendOnline] = useState(false);
  const [isEvaluationOpen, setIsEvaluationOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [files, setFiles] = useState({
    t1: null,
    t1gd: null,
    t2: null,
    flair: null,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [error, setError] = useState(null);

  const [predictionResult, setPredictionResult] = useState(null);
  const [crosshair, setCrosshair] = useState({
    voxel: [120, 120, 75],
    world: [0, 0, 0],
  });
  const [visibleRegions, setVisibleRegions] = useState({
    WT: true,
    TC: true,
    ET: true,
  });
  const [opacities, setOpacities] = useState({
    WT: 0.35,
    TC: 0.65,
    ET: 0.85,
  });
  const [wireframe, setWireframe] = useState(false);

  const resetViewRef = useRef(null);

  // Check backend health on mount
  useEffect(() => {
    async function verifyBackend() {
      try {
        const res = await checkHealth();
        if (res.status === "ok") {
          setBackendOnline(true);
        }
      } catch (err) {
        console.warn("Backend not reachable:", err.message);
        setBackendOnline(false);
      }
    }
    verifyBackend();
    const interval = setInterval(verifyBackend, 8000);
    return () => clearInterval(interval);
  }, []);

  const handlePredict = async () => {
    if (!files.t1 || !files.t1gd || !files.t2 || !files.flair) {
      setError("Please select all four MRI sequences before running prediction.");
      return;
    }

    try {
      setError(null);
      setIsProcessing(true);
      setProcessingStep("Uploading NIfTI volumes & validating headers...");

      const stepTimer1 = setTimeout(() => {
        setProcessingStep("Running pretrained SegResNet (MPS GPU accelerated)...");
      }, 1500);

      const stepTimer2 = setTimeout(() => {
        setProcessingStep("Generating 3D surface meshes in physical world mm...");
      }, 5000);

      const result = await predictMri({
        t1File: files.t1,
        t1gdFile: files.t1gd,
        t2File: files.t2,
        flairFile: files.flair,
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      setPredictionResult(result);
      setVisibleRegions({ WT: true, TC: true, ET: true });

      if (result?.default_crosshair) {
        setCrosshair({
          voxel: result.default_crosshair.voxel,
          world: result.default_crosshair.world,
        });
      }
    } catch (err) {
      console.error("Prediction error:", err);
      setError(err.message || "An unexpected error occurred during prediction.");
    } finally {
      setIsProcessing(false);
      setProcessingStep("");
    }
  };

  const handleCrosshairChange = (newVoxel) => {
    const affine = predictionResult?.volume?.affine;
    if (affine && Array.isArray(newVoxel) && newVoxel.length === 3) {
      const [i, j, k] = newVoxel;
      const wx = affine[0][0] * i + affine[0][1] * j + affine[0][2] * k + affine[0][3];
      const wy = affine[1][0] * i + affine[1][1] * j + affine[1][2] * k + affine[1][3];
      const wz = affine[2][0] * i + affine[2][1] * j + affine[2][2] * k + affine[2][3];
      setCrosshair({
        voxel: [i, j, k],
        world: [
          parseFloat(wx.toFixed(1)),
          parseFloat(wy.toFixed(1)),
          parseFloat(wz.toFixed(1)),
        ],
      });
    } else {
      setCrosshair((prev) => ({ ...prev, voxel: newVoxel }));
    }
  };

  const handleCenterTumour = () => {
    if (predictionResult?.default_crosshair) {
      setCrosshair({
        voxel: predictionResult.default_crosshair.voxel,
        world: predictionResult.default_crosshair.world,
      });
    }
  };

  const handleResetView = () => {
    if (resetViewRef.current) {
      resetViewRef.current();
    }
  };

  return (
    <div>
      <Header
        backendOnline={backendOnline}
        onOpenEvaluation={() => setIsEvaluationOpen(true)}
      />
      <DisclaimerBanner />

      <main className="app-main">
        <aside className="sidebar">
          <UploadPanel
            files={files}
            setFiles={setFiles}
            onPredict={handlePredict}
            isProcessing={isProcessing}
            processingStep={processingStep}
            error={error}
          />

          <ControlsPanel
            visibleRegions={visibleRegions}
            setVisibleRegions={setVisibleRegions}
            opacities={opacities}
            setOpacities={setOpacities}
            metrics={predictionResult?.metrics}
            wireframe={wireframe}
            setWireframe={setWireframe}
            onResetView={handleResetView}
            onGenerateReport={() => setIsReportOpen(true)}
            onOpenEvaluation={() => setIsEvaluationOpen(true)}
          />
        </aside>

        <section style={{ display: "flex", flexDirection: "column" }}>
          <Viewer3D
            regions={predictionResult?.regions}
            visibleRegions={visibleRegions}
            opacities={opacities}
            wireframe={wireframe}
            onResetViewRef={resetViewRef}
            worldCrosshair={predictionResult ? crosshair.world : null}
          />
        </section>
      </main>

      {/* Linked Orthogonal 2D Multiplanar MRI View */}
      {predictionResult && (
        <section className="multiplanar-section">
          <MultiplanarViewer
            jobId={predictionResult.job_id}
            volumeMeta={predictionResult.volume}
            voxelCoord={crosshair.voxel}
            worldCoord={crosshair.world}
            visibleRegions={visibleRegions}
            opacities={opacities}
            onCrosshairChange={handleCrosshairChange}
            onCenterTumour={handleCenterTumour}
          />
        </section>
      )}

      {/* Evaluation Benchmarks Dashboard Modal */}
      <EvaluationModal
        isOpen={isEvaluationOpen}
        onClose={() => setIsEvaluationOpen(false)}
      />

      {/* Sample Research Report Modal */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        predictionResult={predictionResult}
        crosshair={crosshair}
      />
    </div>
  );
}
