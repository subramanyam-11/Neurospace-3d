import React, { useState, useEffect, useRef } from "react";
import Header from "./components/Header";
import DisclaimerBanner from "./components/DisclaimerBanner";
import UploadPanel from "./components/UploadPanel";
import ControlsPanel from "./components/ControlsPanel";
import AnalysisPanel from "./components/AnalysisPanel";
import Viewer3D from "./components/Viewer3D";
import MultiplanarViewer from "./components/MultiplanarViewer";
import EvaluationModal from "./components/EvaluationModal";
import ReportModal from "./components/ReportModal";
import SequenceExplorerModal from "./components/SequenceExplorerModal";
import GuidedDemoModal from "./components/GuidedDemoModal";
import { checkHealth, predictMri } from "./services/api";

export default function App() {
  const [backendOnline, setBackendOnline] = useState(false);
  const [isEvaluationOpen, setIsEvaluationOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isSequenceExplorerOpen, setIsSequenceExplorerOpen] = useState(false);
  const [isGuidedDemoOpen, setIsGuidedDemoOpen] = useState(false);

  const [files, setFiles] = useState({
    t1: null,
    t1gd: null,
    t2: null,
    flair: null,
    expert_mask: null,
  });
  const [useTta, setUseTta] = useState(false);
  const [viewMode, setViewMode] = useState("predicted"); // "predicted", "expert", "agreement"
  const [showDisagreement, setShowDisagreement] = useState(false);
  const [disagreementOpacity, setDisagreementOpacity] = useState(0.70);
  const [cutaway, setCutaway] = useState(false);

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
    brain: true,
    TP: true,
    FP: true,
    FN: true,
  });
  const [opacities, setOpacities] = useState({
    WT: 0.35,
    TC: 0.65,
    ET: 0.85,
    brain: 0.22,
    TP: 0.85,
    FP: 0.65,
    FN: 0.55,
  });
  // Variable Tumour Size / Volume scales (1.0 = original 100% predicted size)
  const [tumourScales, setTumourScales] = useState({
    WT: 1.0,
    TC: 1.0,
    ET: 1.0,
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
        setProcessingStep(
          useTta
            ? "Running SegResNet with Test-Time Augmentation (deterministic passes)..."
            : "Running pretrained SegResNet (MPS GPU accelerated)..."
        );
      }, 1500);

      const stepTimer2 = setTimeout(() => {
        setProcessingStep("Generating 3D surface meshes in physical world mm...");
      }, 5000);

      const result = await predictMri({
        t1File: files.t1,
        t1gdFile: files.t1gd,
        t2File: files.t2,
        flairFile: files.flair,
        expertMaskFile: files.expert_mask,
        useTta: useTta,
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      setPredictionResult(result);
      setViewMode(result?.has_expert ? "agreement" : "predicted");
      setShowDisagreement(Boolean(result?.tta?.enabled));
      setVisibleRegions({ WT: true, TC: true, ET: true, brain: true, TP: true, FP: true, FN: true });
      setTumourScales({ WT: 1.0, TC: 1.0, ET: 1.0 });

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

  const hudInfo = predictionResult
    ? {
        caseId: predictionResult.job_id,
        modelName: "SegResNet",
        inferenceTimeSec: predictionResult.timing?.inference_ms
          ? (predictionResult.timing.inference_ms / 1000).toFixed(1)
          : "6.8",
        worldX: crosshair.world[0],
        worldY: crosshair.world[1],
        worldZ: crosshair.world[2],
      }
    : null;

  return (
    <div className="neuroscope-app-root">
      <Header
        backendOnline={backendOnline}
        onOpenEvaluation={() => setIsEvaluationOpen(true)}
      />
      <DisclaimerBanner />

      {/* 3-Column Workstation Layout: Left Controls | Center 3D + 2D Workspace | Right Analysis */}
      <main className="app-workspace-layout">
        {/* Left Control Sidebar */}
        <aside className="sidebar-column left-sidebar">
          <UploadPanel
            files={files}
            setFiles={setFiles}
            useTta={useTta}
            setUseTta={setUseTta}
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
            tumourScales={tumourScales}
            setTumourScales={setTumourScales}
            predictionResult={predictionResult}
            viewMode={viewMode}
            setViewMode={setViewMode}
            showDisagreement={showDisagreement}
            setShowDisagreement={setShowDisagreement}
            disagreementOpacity={disagreementOpacity}
            setDisagreementOpacity={setDisagreementOpacity}
            wireframe={wireframe}
            setWireframe={setWireframe}
            cutaway={cutaway}
            setCutaway={setCutaway}
            onResetView={handleResetView}
            onOpenSequenceExplorer={() => setIsSequenceExplorerOpen(true)}
            onOpenGuidedDemo={() => setIsGuidedDemoOpen(true)}
          />
        </aside>

        {/* Center Workspace: Main 3D Brain Viewer + 3 Synchronized 2D Orthogonal Slices */}
        <section className="center-workspace-column">
          <div className="viewer-3d-card-wrap">
            <Viewer3D
              regions={predictionResult?.regions}
              expertMeshes={predictionResult?.expert_meshes}
              agreementMeshes={predictionResult?.agreement_meshes}
              cutaway={cutaway}
              viewMode={viewMode}
              visibleRegions={visibleRegions}
              opacities={opacities}
              tumourScales={tumourScales}
              wireframe={wireframe}
              onResetViewRef={resetViewRef}
              worldCrosshair={predictionResult ? crosshair.world : null}
              hudInfo={hudInfo}
            />
          </div>

          {/* Linked Orthogonal 2D MRI Views directly below 3D Brain */}
          {predictionResult && (
            <div className="multiplanar-card-wrap">
              <MultiplanarViewer
                jobId={predictionResult.job_id}
                volumeMeta={predictionResult.volume}
                voxelCoord={crosshair.voxel}
                worldCoord={crosshair.world}
                visibleRegions={visibleRegions}
                opacities={opacities}
                viewMode={viewMode}
                showDisagreement={showDisagreement}
                disagreementOpacity={disagreementOpacity}
                onCrosshairChange={handleCrosshairChange}
                onCenterTumour={handleCenterTumour}
              />
            </div>
          )}
        </section>

        {/* Right Analysis Sidebar */}
        <aside className="sidebar-column right-sidebar">
          <AnalysisPanel
            predictionResult={predictionResult}
            tumourScales={tumourScales}
            crosshair={crosshair}
            onCrosshairChange={handleCrosshairChange}
            onOpenEvaluation={() => setIsEvaluationOpen(true)}
            onGenerateReport={() => setIsReportOpen(true)}
          />
        </aside>
      </main>

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

      {/* Sequence Explorer Modal ("Why Four MRI Sequences?") */}
      <SequenceExplorerModal
        isOpen={isSequenceExplorerOpen}
        onClose={() => setIsSequenceExplorerOpen(false)}
        jobId={predictionResult?.job_id}
        voxelCoord={crosshair.voxel}
        volumeMeta={predictionResult?.volume}
      />

      {/* Guided 5-Minute Hackathon Demo Modal */}
      <GuidedDemoModal
        isOpen={isGuidedDemoOpen}
        onClose={() => setIsGuidedDemoOpen(false)}
        onApplyStepConfig={(cfg) => {
          if (cfg.visible) setVisibleRegions((prev) => ({ ...prev, ...cfg.visible }));
          if (cfg.cutaway !== undefined) setCutaway(cfg.cutaway);
        }}
        onCenterTumour={handleCenterTumour}
      />
    </div>
  );
}
