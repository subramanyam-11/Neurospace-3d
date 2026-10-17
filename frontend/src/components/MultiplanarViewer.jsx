import React, { useState, useEffect } from "react";
import SliceView2D from "./SliceView2D";
import { fetchSlice } from "../services/api";

const MODALITIES = [
  { key: "t1", label: "T1", desc: "Native anatomical baseline" },
  { key: "t1gd", label: "T1Gd", desc: "Post-contrast active enhancement" },
  { key: "t2", label: "T2", desc: "T2 hyperintense fluid & edema" },
  { key: "flair", label: "FLAIR", desc: "Free-water suppressed oedema" },
];

export default function MultiplanarViewer({
  jobId,
  volumeMeta,
  voxelCoord = [120, 120, 75],
  worldCoord = [0, 0, 0],
  visibleRegions = { WT: true, TC: true, ET: true },
  opacities = { WT: 0.35, TC: 0.65, ET: 0.85 },
  viewMode = "predicted", // "predicted", "expert", "agreement"
  showDisagreement = false,
  disagreementOpacity = 0.70,
  onCrosshairChange,
  onCenterTumour,
}) {
  const [modality, setModality] = useState("flair");
  const [axialData, setAxialData] = useState(null);
  const [coronalData, setCoronalData] = useState(null);
  const [sagittalData, setSagittalData] = useState(null);
  const [loadingPlanes, setLoadingPlanes] = useState({
    axial: false,
    coronal: false,
    sagittal: false,
  });

  const shape = volumeMeta?.shape || [240, 240, 155];
  const dimX = shape[0];
  const dimY = shape[1];
  const dimZ = shape[2];

  const i = Math.max(0, Math.min(dimX - 1, voxelCoord[0] ?? Math.floor(dimX / 2)));
  const j = Math.max(0, Math.min(dimY - 1, voxelCoord[1] ?? Math.floor(dimY / 2)));
  const k = Math.max(0, Math.min(dimZ - 1, voxelCoord[2] ?? Math.floor(dimZ / 2)));

  // Fetch Axial Slice
  useEffect(() => {
    if (!jobId) return;
    let isCancelled = false;
    setLoadingPlanes((prev) => ({ ...prev, axial: true }));

    fetchSlice({
      jobId,
      plane: "axial",
      index: k,
      modality,
      showWt: visibleRegions.WT,
      showTc: visibleRegions.TC,
      showEt: visibleRegions.ET,
      wtOpacity: opacities.WT,
      tcOpacity: opacities.TC,
      etOpacity: opacities.ET,
      showDisagreement,
      disagreementOpacity,
      renderMode: viewMode,
    })
      .then((data) => {
        if (!isCancelled) setAxialData(data);
      })
      .catch((err) => console.error("Axial slice error:", err))
      .finally(() => {
        if (!isCancelled) setLoadingPlanes((prev) => ({ ...prev, axial: false }));
      });

    return () => {
      isCancelled = true;
    };
  }, [jobId, k, modality, visibleRegions, opacities, viewMode, showDisagreement, disagreementOpacity]);

  // Fetch Coronal Slice
  useEffect(() => {
    if (!jobId) return;
    let isCancelled = false;
    setLoadingPlanes((prev) => ({ ...prev, coronal: true }));

    fetchSlice({
      jobId,
      plane: "coronal",
      index: j,
      modality,
      showWt: visibleRegions.WT,
      showTc: visibleRegions.TC,
      showEt: visibleRegions.ET,
      wtOpacity: opacities.WT,
      tcOpacity: opacities.TC,
      etOpacity: opacities.ET,
      showDisagreement,
      disagreementOpacity,
      renderMode: viewMode,
    })
      .then((data) => {
        if (!isCancelled) setCoronalData(data);
      })
      .catch((err) => console.error("Coronal slice error:", err))
      .finally(() => {
        if (!isCancelled) setLoadingPlanes((prev) => ({ ...prev, coronal: false }));
      });

    return () => {
      isCancelled = true;
    };
  }, [jobId, j, modality, visibleRegions, opacities, viewMode, showDisagreement, disagreementOpacity]);

  // Fetch Sagittal Slice
  useEffect(() => {
    if (!jobId) return;
    let isCancelled = false;
    setLoadingPlanes((prev) => ({ ...prev, sagittal: true }));

    fetchSlice({
      jobId,
      plane: "sagittal",
      index: i,
      modality,
      showWt: visibleRegions.WT,
      showTc: visibleRegions.TC,
      showEt: visibleRegions.ET,
      wtOpacity: opacities.WT,
      tcOpacity: opacities.TC,
      etOpacity: opacities.ET,
      showDisagreement,
      disagreementOpacity,
      renderMode: viewMode,
    })
      .then((data) => {
        if (!isCancelled) setSagittalData(data);
      })
      .catch((err) => console.error("Sagittal slice error:", err))
      .finally(() => {
        if (!isCancelled) setLoadingPlanes((prev) => ({ ...prev, sagittal: false }));
      });

    return () => {
      isCancelled = true;
    };
  }, [jobId, i, modality, visibleRegions, opacities, viewMode, showDisagreement, disagreementOpacity]);

  // Crosshair pixel calculations
  const axialPixel = { col: i, row: j };
  const coronalPixel = { col: i, row: (dimZ - 1) - k };
  const sagittalPixel = { col: j, row: (dimZ - 1) - k };

  const handleAxialClick = (col, row) => {
    const nextI = Math.max(0, Math.min(dimX - 1, col));
    const nextJ = Math.max(0, Math.min(dimY - 1, row));
    onCrosshairChange([nextI, nextJ, k]);
  };

  const handleCoronalClick = (col, row) => {
    const nextI = Math.max(0, Math.min(dimX - 1, col));
    const nextK = Math.max(0, Math.min(dimZ - 1, (dimZ - 1) - row));
    onCrosshairChange([nextI, j, nextK]);
  };

  const handleSagittalClick = (col, row) => {
    const nextJ = Math.max(0, Math.min(dimY - 1, col));
    const nextK = Math.max(0, Math.min(dimZ - 1, (dimZ - 1) - row));
    onCrosshairChange([i, nextJ, nextK]);
  };

  return (
    <div className="panel-card multiplanar-panel">
      {/* Multiplanar Header & Crosshair Status */}
      <div className="multiplanar-header">
        <div className="multiplanar-title-group">
          <div>
            <h2 className="panel-title">Linked Orthogonal 2D MRI Views</h2>
            <p className="panel-desc">
              Synchronized Axial, Coronal, and Sagittal planes with model-predicted subregion overlays
            </p>
          </div>
          <button onClick={onCenterTumour} className="btn-center-tumour" title="Jump crosshair to suspected tumour centroid">
            🎯 Center on Suspected Tumour
          </button>
        </div>

        <div className="multiplanar-controls-group">
          {/* Segmented Sequence Selector */}
          <div className="sequence-segmented-bar">
            <span className="sequence-selector-label">Sequence:</span>
            <div className="segmented-control">
              {MODALITIES.map((m) => {
                const isSelected = modality === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setModality(m.key)}
                    className={`segmented-btn ${isSelected ? "selected" : ""}`}
                    title={m.desc}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Coordinate Readout HUD */}
          <div className="coordinate-hud-card">
            <div className="hud-line">
              <span className="hud-label">WORLD:</span>
              <span className="hud-val">
                X: {worldCoord[0] >= 0 ? "+" : ""}{worldCoord[0]} mm &nbsp;|&nbsp;
                Y: {worldCoord[1] >= 0 ? "+" : ""}{worldCoord[1]} mm &nbsp;|&nbsp;
                Z: {worldCoord[2] >= 0 ? "+" : ""}{worldCoord[2]} mm
              </span>
            </div>
            <div className="hud-line">
              <span className="hud-label">VOXEL:</span>
              <span className="hud-voxel-val">[{i}, {j}, {k}]</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Orthogonal Views in 3 Columns */}
      <div className="multiplanar-grid">
        <SliceView2D
          plane="axial"
          sliceData={axialData}
          currentIndex={k}
          maxIndex={dimZ - 1}
          crosshairPixel={axialPixel}
          onIndexChange={(newK) => onCrosshairChange([i, j, newK])}
          onSliceClick={handleAxialClick}
          isLoading={loadingPlanes.axial}
        />

        <SliceView2D
          plane="coronal"
          sliceData={coronalData}
          currentIndex={j}
          maxIndex={dimY - 1}
          crosshairPixel={coronalPixel}
          onIndexChange={(newJ) => onCrosshairChange([i, newJ, k])}
          onSliceClick={handleCoronalClick}
          isLoading={loadingPlanes.coronal}
        />

        <SliceView2D
          plane="sagittal"
          sliceData={sagittalData}
          currentIndex={i}
          maxIndex={dimX - 1}
          crosshairPixel={sagittalPixel}
          onIndexChange={(newI) => onCrosshairChange([newI, j, k])}
          onSliceClick={handleSagittalClick}
          isLoading={loadingPlanes.sagittal}
        />
      </div>
    </div>
  );
}
