import React, { useRef } from "react";

const PLANE_METADATA = {
  axial: {
    title: "AXIAL",
    subtitle: "Horizontal (Z-Axis)",
    normalAxis: "Z",
    labels: { top: "A", bottom: "P", left: "R", right: "L" },
  },
  coronal: {
    title: "CORONAL",
    subtitle: "Frontal (Y-Axis)",
    normalAxis: "Y",
    labels: { top: "S", bottom: "I", left: "R", right: "L" },
  },
  sagittal: {
    title: "SAGITTAL",
    subtitle: "Profile (X-Axis)",
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
  const meta = PLANE_METADATA[plane] || {
    title: plane.toUpperCase(),
    subtitle: "",
    normalAxis: "",
    labels: { top: "", bottom: "", left: "", right: "" },
  };

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

  return (
    <div className="slice-card">
      {/* Header */}
      <div className="slice-header">
        <div>
          <div className="slice-title-row">
            <span className="slice-title">{meta.title}</span>
            <span className="slice-subtitle">{meta.subtitle}</span>
          </div>
          <div className="slice-coord-text">
            {sliceData?.world_coord_mm !== undefined
              ? `${meta.normalAxis}: ${sliceData.world_coord_mm >= 0 ? "+" : ""}${sliceData.world_coord_mm} mm`
              : ""}
          </div>
        </div>

        <div className="slice-index-pill">
          {currentIndex + 1} / {maxIndex + 1}
        </div>
      </div>

      {/* Viewport */}
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
        {sliceData?.image ? (
          <img
            src={sliceData.image}
            alt={`${plane} MRI slice`}
            className="slice-image"
            draggable={false}
          />
        ) : (
          <div className="slice-loading">
            <div className="spinner" />
          </div>
        )}

        {/* Anatomical Orientation Markers */}
        <span className="anatomical-label top">{meta.labels.top}</span>
        <span className="anatomical-label bottom">{meta.labels.bottom}</span>
        <span className="anatomical-label left">{meta.labels.left}</span>
        <span className="anatomical-label right">{meta.labels.right}</span>

        {/* Crosshair Overlay */}
        {sliceData?.image && (
          <svg className="crosshair-overlay">
            {/* Vertical crosshair line */}
            <line
              x1={`${crosshairXPercent}%`}
              y1="0%"
              x2={`${crosshairXPercent}%`}
              y2="100%"
              className="crosshair-line"
            />
            {/* Horizontal crosshair line */}
            <line
              x1="0%"
              y1={`${crosshairYPercent}%`}
              x2="100%"
              y2={`${crosshairYPercent}%`}
              className="crosshair-line"
            />
            {/* Center target circle */}
            <circle
              cx={`${crosshairXPercent}%`}
              cy={`${crosshairYPercent}%`}
              r="4.5"
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
