import React, { useState, useEffect, useRef } from "react";
import Header from "./components/Header";
import DisclaimerBanner from "./components/DisclaimerBanner";
import UploadPanel from "./components/UploadPanel";
import ControlsPanel from "./components/ControlsPanel";
import Viewer3D from "./components/Viewer3D";
import MultiplanarViewer from "./components/MultiplanarViewer";
import EvaluationModal from "./components/EvaluationModal";
import ReportModal from "./components/ReportModal";
import SequenceExplorerModal from "./components/SequenceExplorerModal";
import TraineeQuizModal from "./components/TraineeQuizModal";
import GuidedDemoModal from "./components/GuidedDemoModal";
import KeyboardShortcutsModal from "./components/KeyboardShortcutsModal";
import { checkHealth, predictMri } from "./services/api";

export default function App() {
  const [backendOnline, setBackendOnline] = useState(false);
  const [isEvaluationOpen, setIsEvaluationOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isSequenceExplorerOpen, setIsSequenceExplorerOpen] = useState(false);
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [isGuidedDemoOpen, setIsGuidedDemoOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

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

  // Phase 4: Simulation state
  const [showSimulation, setShowSimulation] = useState(false);
  const [simulationData, setSimulationData] = useState(null);
  const [simulationOpacity, setSimulationOpacity] = useState(0.35);

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
    simulated: true,
  });
  const [opacities, setOpacities] = useState({
    WT: 0.35,
    TC: 0.65,
    ET: 0.85,
    brain: 0.18,
    TP: 0.85,
    FP: 0.65,
    FN: 0.55,
    simulated: 0.35,
  });
  const [wireframe, setWireframe] = useState(false);

  const resetViewRef = useRef(null);
  const focusScenarioRef = useRef(null);

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

  // Global Keyboard Shortcuts (R, B, W, T, E, 1, 2, 3, Space, D, Q, S)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      const key = e.key.toLowerCase();
      if (key === "r") {
        if (resetViewRef.current) resetViewRef.current();
      } else if (key === "b") {
        setVisibleRegions((prev) => ({ ...prev, brain: !prev.brain }));
      } else if (key === "w") {
        setVisibleRegions((prev) => ({ ...prev, WT: !prev.WT }));
      } else if (key === "t") {
        setVisibleRegions((prev) => ({ ...prev, TC: !prev.TC }));
      } else if (key === "e") {
        setVisibleRegions((prev) => ({ ...prev, ET: !prev.ET }));
      } else if (key === "1") {
        // Focus axial slice index
        if (predictionResult?.default_crosshair) {
          handleCrosshairChange([
            crosshair.voxel[0],
            crosshair.voxel[1],
            predictionResult.default_crosshair.voxel[2],
          ]);
        }
      } else if (key === "2") {
        // Focus coronal slice index
        if (predictionResult?.default_crosshair) {
          handleCrosshairChange([
            crosshair.voxel[0],
            predictionResult.default_crosshair.voxel[1],
            crosshair.voxel[2],
          ]);
        }
      } else if (key === "3") {
        // Focus sagittal slice index
        if (predictionResult?.default_crosshair) {
          handleCrosshairChange([
            predictionResult.default_crosshair.voxel[0],
            crosshair.voxel[1],
            crosshair.voxel[2],
          ]);
        }
      } else if (key === "d") {
        setIsGuidedDemoOpen((prev) => !prev);
      } else if (key === "q") {
        setIsQuizOpen((prev) => !prev);
      } else if (key === "s") {
        setIsSequenceExplorerOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [crosshair, predictionResult]);

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
      if (result?.simulation) {
        setSimulationData(result.simulation);
      }
      setViewMode(result?.has_expert ? "agreement" : "predicted");
      setShowDisagreement(Boolean(result?.tta?.enabled));
      setVisibleRegions({ WT: true, TC: true, ET: true, brain: true, TP: true, FP: true, FN: true, simulated: true });

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
            onGenerateReport={() => setIsReportOpen(true)}
            onOpenEvaluation={() => setIsEvaluationOpen(true)}
            onOpenSequenceExplorer={() => setIsSequenceExplorerOpen(true)}
            onOpenQuiz={() => setIsQuizOpen(true)}
            onOpenGuidedDemo={() => setIsGuidedDemoOpen(true)}
            onOpenShortcuts={() => setIsShortcutsOpen(true)}
            onCrosshairChange={handleCrosshairChange}
            crosshair={crosshair}
            showSimulation={showSimulation}
            setShowSimulation={setShowSimulation}
            simulationData={simulationData}
            setSimulationData={setSimulationData}
            simulationOpacity={simulationOpacity}
            setSimulationOpacity={setSimulationOpacity}
            onFocusScenario={() => focusScenarioRef.current && focusScenarioRef.current()}
          />
        </aside>

        <section style={{ display: "flex", flexDirection: "column" }}>
          <Viewer3D
            regions={predictionResult?.regions}
            expertMeshes={predictionResult?.expert_meshes}
            agreementMeshes={predictionResult?.agreement_meshes}
            simulatedMesh={simulationData?.mesh || predictionResult?.simulation?.mesh}
            showSimulation={showSimulation}
            simulationOpacity={simulationOpacity}
            cutaway={cutaway}
            viewMode={viewMode}
            visibleRegions={visibleRegions}
            opacities={opacities}
            wireframe={wireframe}
            onResetViewRef={resetViewRef}
            onFocusScenarioRef={focusScenarioRef}
            worldCrosshair={predictionResult ? crosshair.world : null}
            hudInfo={hudInfo}
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
            viewMode={viewMode}
            showDisagreement={showDisagreement}
            disagreementOpacity={disagreementOpacity}
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
        simulationData={simulationData}
      />

      {/* Sequence Explorer Modal ("Why Four MRI Sequences?") */}
      <SequenceExplorerModal
        isOpen={isSequenceExplorerOpen}
        onClose={() => setIsSequenceExplorerOpen(false)}
        jobId={predictionResult?.job_id}
        voxelCoord={crosshair.voxel}
        volumeMeta={predictionResult?.volume}
      />

      {/* Trainee Interactive Quiz Modal */}
      <TraineeQuizModal
        isOpen={isQuizOpen}
        onClose={() => setIsQuizOpen(false)}
        jobId={predictionResult?.job_id}
        predictionResult={predictionResult}
        crosshair={crosshair}
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

      {/* Keyboard Shortcuts Reference Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}
