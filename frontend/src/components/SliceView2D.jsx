import React, { useRef, useEffect } from "react";

const PLANE_METADATA = {
  axial: {
    title: "AXIAL",
    subtitle: "Horizontal (Z-axis)",
    normalAxis: "Z",
    labels: { top: "A", bottom: "P", left: "R", right: "L" },
  },
  coronal: {
    title: "CORONAL",
    subtitle: "Frontal (Y-axis)",
    normalAxis: "Y",
    labels: { top: "S", bottom: "I", left: "R", right: "L" },
  },
  sagittal: {
    title: "SAGITTAL",
    subtitle: "Profile (X-axis)",
    normalAxis: "X",
    labels: { top: "S", bottom: "I", left: "A", right: "P" },
  },
};

export default function SliceView2D({
  plane,
  sliceData,
  currentIndex,
  maxIndex,
  crosshairPixel, // { col, row }
  onIndexChange,
  onSliceClick,
  isLoading,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const meta = PLANE_METADATA[plane] || {
    title: plane.toUpperCase(),
    subtitle: "",
    normalAxis: "",
    labels: { top: "", bottom: "", left: "", right: "" },
  };

  // High-DPI Canvas Rendering with scientific linear interpolation
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !sliceData?.image) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let isCancelled = false;
    const img = new Image();
    img.onload = () => {
      if (isCancelled) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const rect = container.getBoundingClientRect();
      const displayW = Math.max(1, rect.width || 320);
      const displayH = Math.max(1, rect.height || 320);

      // Backing store matching physical device pixels for ultra-sharp rendering
      canvas.width = Math.round(displayW * dpr);
      canvas.height = Math.round(displayH * dpr);
      canvas.style.width = "100%";
      canvas.style.height = "100%";

      ctx.save();
      ctx.scale(dpr, dpr);

      // Professional research image interpolation: high-quality linear smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Clear dark background
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, displayW, displayH);

      // Fit image preserving exact geometry
      ctx.drawImage(img, 0, 0, displayW, displayH);
      ctx.restore();
    };

    img.src = sliceData.image;

    return () => {
      isCancelled = true;
    };
  }, [sliceData]);

  const handlePointerInteraction = (e) => {
    if (!containerRef.current || !sliceData?.width || !sliceData?.height) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    const normX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    const col = Math.round(normX * (sliceData.width - 1));
    const row = Math.round(normY * (sliceData.height - 1));

    onSliceClick(col, row);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      onIndexChange(Math.min(maxIndex, currentIndex + 1));
    } else if (e.deltaY > 0) {
      onIndexChange(Math.max(0, currentIndex - 1));
    }
  };

  // Convert crosshair (col, row) to percentages
  let crosshairXPercent = 50;
  let crosshairYPercent = 50;
  if (sliceData?.width && sliceData?.height && crosshairPixel) {
    crosshairXPercent = (crosshairPixel.col / (sliceData.width - 1)) * 100;
    crosshairYPercent = (crosshairPixel.row / (sliceData.height - 1)) * 100;
  }

  const worldStr =
    sliceData?.world_coord_mm !== undefined
      ? `${meta.normalAxis}: ${sliceData.world_coord_mm >= 0 ? "+" : ""}${sliceData.world_coord_mm} mm`
      : "";

  return (
    <div className="slice-card">
      {/* Header matching professional neuroimaging specs */}
      <div className="slice-header">
        <div>
          <div className="slice-title-row">
            <span className="slice-title">{meta.title}</span>
            <span className="slice-subtitle">{meta.subtitle}</span>
          </div>
          {worldStr && <div className="slice-coord-text">{worldStr}</div>}
        </div>

        <div className="slice-index-pill">
          {currentIndex + 1} / {maxIndex + 1}
        </div>
      </div>

      {/* Viewport with Canvas backing */}
      <div
        ref={containerRef}
        className="slice-viewport"
        onMouseDown={(e) => {
          handlePointerInteraction(e);
          const handleMove = (moveEvent) => handlePointerInteraction(moveEvent);
          const handleUp = () => {
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseup", handleUp);
          };
          window.addEventListener("mousemove", handleMove);
          window.addEventListener("mouseup", handleUp);
        }}
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} className="slice-canvas" />

        {isLoading && (
          <div className="slice-loading">
            <div className="spinner" />
          </div>
        )}

        {/* Anatomical Orientation Markers (A, P, S, I, R, L) */}
        <span className="anatomical-label top">{meta.labels.top}</span>
        <span className="anatomical-label bottom">{meta.labels.bottom}</span>
        <span className="anatomical-label left">{meta.labels.left}</span>
        <span className="anatomical-label right">{meta.labels.right}</span>

        {/* Synchronized Crosshair Overlay */}
        {sliceData?.image && (
          <svg className="crosshair-overlay">
            <line
              x1={`${crosshairXPercent}%`}
              y1="0%"
              x2={`${crosshairXPercent}%`}
              y2="100%"
              className="crosshair-line"
            />
            <line
              x1="0%"
              y1={`${crosshairYPercent}%`}
              x2="100%"
              y2={`${crosshairYPercent}%`}
              className="crosshair-line"
            />
            <circle
              cx={`${crosshairXPercent}%`}
              cy={`${crosshairYPercent}%`}
              r="4"
              className="crosshair-center"
            />
          </svg>
        )}

        {/* Subregion Indicator Badge */}
        {sliceData?.has_mask && (
          <div className="mask-active-badge">
            <span className="pulse-dot" />
            <span>Suspected Region ({sliceData.active_voxels} vox)</span>
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      <div className="slice-controls-row">
        <button
          onClick={() => onIndexChange(Math.max(0, currentIndex - 1))}
          disabled={currentIndex <= 0}
          className="btn-slice-step"
          title="Previous slice (or scroll wheel)"
        >
          ◀
        </button>

        <input
          type="range"
          min="0"
          max={maxIndex}
          value={currentIndex}
          onChange={(e) => onIndexChange(parseInt(e.target.value, 10))}
          className="slice-slider"
        />

        <button
          onClick={() => onIndexChange(Math.min(maxIndex, currentIndex + 1))}
          disabled={currentIndex >= maxIndex}
          className="btn-slice-step"
          title="Next slice (or scroll wheel)"
        >
          ▶
        </button>
      </div>
    </div>
  );
}
