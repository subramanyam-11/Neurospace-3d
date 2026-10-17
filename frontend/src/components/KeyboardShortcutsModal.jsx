import React from "react";

const SHORTCUTS = [
  { key: "R", action: "Reset 3D camera to default orientation" },
  { key: "B", action: "Toggle Patient-Specific Brain Surface Shell" },
  { key: "W", action: "Toggle Whole Tumour (WT) subregion" },
  { key: "T", action: "Toggle Tumour Core (TC) subregion" },
  { key: "E", action: "Toggle Enhancing Tumour (ET) subregion" },
  { key: "1", action: "Center / jump to Axial plane focus" },
  { key: "2", action: "Center / jump to Coronal plane focus" },
  { key: "3", action: "Center / jump to Sagittal plane focus" },
  { key: "Space", action: "Cycle teaching layer reveal / next step" },
  { key: "D", action: "Open Guided 5-Minute Hackathon Demo" },
  { key: "Q", action: "Open Trainee Interactive Quiz Mode" },
  { key: "S", action: "Open MRI Sequence Explorer (Why 4 MRI Sequences)" },
];

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth: "560px", width: "90%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Keyboard Shortcuts</h2>
            <p className="modal-subtitle">Quick keyboard navigation for rapid research inspection</p>
          </div>
          <button onClick={onClose} className="modal-close-btn">✕</button>
        </div>

        <div style={{ margin: "16px 0", display: "flex", flexDirection: "column", gap: "8px" }}>
          {SHORTCUTS.map((item) => (
            <div
              key={item.key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                borderRadius: "6px",
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.05)",
              }}
            >
              <span style={{ fontSize: "0.82rem", color: "var(--text-main)" }}>
                {item.action}
              </span>
              <kbd
                style={{
                  background: "rgba(30, 41, 59, 0.9)",
                  color: "var(--accent-cyan)",
                  border: "1px solid rgba(56, 189, 248, 0.4)",
                  borderRadius: "4px",
                  padding: "2px 8px",
                  fontSize: "0.78rem",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700,
                  boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
                }}
              >
                {item.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-predict" style={{ padding: "8px 20px" }}>
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
