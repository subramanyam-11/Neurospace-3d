import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const REGION_CONFIG = {
  WT: {
    color: 0x38bdf8, // Ice Blue / Cyan
    name: "Whole Tumour",
    depthWrite: false,
    renderOrder: 2,
    roughness: 0.35,
    metalness: 0.15,
  },
  TC: {
    color: 0xf59e0b, // Amber / Orange
    name: "Tumour Core",
    depthWrite: false,
    renderOrder: 3,
    roughness: 0.35,
    metalness: 0.15,
  },
  ET: {
    color: 0xef4444, // Crimson / Bright Red
    name: "Enhancing Tumour",
    depthWrite: true,
    renderOrder: 4,
    roughness: 0.35,
    metalness: 0.15,
  },
  // Agreement Mode subregions
  TP: {
    color: 0x10b981, // Vibrant Emerald Green
    name: "True Positive (pred ∩ expert)",
    depthWrite: true,
    renderOrder: 4,
    roughness: 0.35,
    metalness: 0.15,
  },
  FP: {
    color: 0x8b5cf6, // Violet / Purple
    name: "False Positive (pred - expert)",
    depthWrite: false,
    renderOrder: 3,
    roughness: 0.35,
    metalness: 0.15,
  },
  FN: {
    color: 0xf59e0b, // Amber / Coral
    name: "False Negative (expert - pred)",
    depthWrite: false,
    renderOrder: 2,
    roughness: 0.35,
    metalness: 0.15,
  },
  simulated: {
    color: 0xc084fc, // Translucent Lavender / Purple Outer Shell
    name: "Hypothetical Spatial Simulation",
    depthWrite: false,
    renderOrder: 5,
    roughness: 0.25,
    metalness: 0.10,
  },
  brain: {
    color: 0x94a3b8, // Slate cortical anatomical shell
    name: "Patient-specific MRI anatomy",
    depthWrite: false,
    renderOrder: 1,
    roughness: 0.55,
    metalness: 0.05,
  },
};

function createCrosshairMarker() {
  const markerGroup = new THREE.Group();
  markerGroup.name = "worldCrosshairMarker";

  // Central bright target sphere
  const sphereGeo = new THREE.SphereGeometry(2.5, 16, 16);
  const sphereMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    depthTest: false,
    transparent: true,
    opacity: 0.95,
  });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.renderOrder = 9999;
  markerGroup.add(sphere);

  // Outer target ring
  const ringGeo = new THREE.RingGeometry(3.8, 4.6, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    depthTest: false,
    transparent: true,
    opacity: 0.85,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.renderOrder = 9999;
  markerGroup.add(ring);

  // 3 orthogonal axis crosshair lines (25mm in each direction)
  const lineMatX = new THREE.LineBasicMaterial({ color: 0xef4444, depthTest: false, transparent: true, opacity: 0.9 });
  const lineMatY = new THREE.LineBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 0.9 });
  const lineMatZ = new THREE.LineBasicMaterial({ color: 0x38bdf8, depthTest: false, transparent: true, opacity: 0.9 });

  const geoX = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-25, 0, 0),
    new THREE.Vector3(25, 0, 0),
  ]);
  const lineX = new THREE.Line(geoX, lineMatX);
  lineX.renderOrder = 9999;
  markerGroup.add(lineX);

  const geoY = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -25, 0),
    new THREE.Vector3(0, 25, 0),
  ]);
  const lineY = new THREE.Line(geoY, lineMatY);
  lineY.renderOrder = 9999;
  markerGroup.add(lineY);

  const geoZ = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, -25),
    new THREE.Vector3(0, 0, 25),
  ]);
  const lineZ = new THREE.Line(geoZ, lineMatZ);
  lineZ.renderOrder = 9999;
  markerGroup.add(lineZ);

  markerGroup.visible = false;
  return markerGroup;
}

export default function Viewer3D({
  regions = null,
  expertMeshes = null,
  agreementMeshes = null,
  simulatedMesh = null,
  showSimulation = false,
  simulationOpacity = 0.35,
  cutaway = false,
  viewMode = "predicted", // "predicted", "expert", "agreement"
  visibleRegions = { WT: true, TC: true, ET: true, brain: true, TP: true, FP: true, FN: true, simulated: true },
  opacities = { WT: 0.35, TC: 0.65, ET: 0.85, brain: 0.18, TP: 0.85, FP: 0.65, FN: 0.55, simulated: 0.35 },
  wireframe = false,
  onResetViewRef = null,
  onFocusScenarioRef = null,
  worldCrosshair = null,
  hudInfo = null,
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const groupRef = useRef(null);
  const crosshairGroupRef = useRef(null);
  const meshesRef = useRef({});
  const boundingInfoRef = useRef({ center: new THREE.Vector3(0, 0, 0), radius: 100 });
  const clipPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 10)); // Sagittal/axial section clip

  // 1. Initialize Three.js scene, camera, renderer, and lights
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080e);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(0, 0, 250);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.localClippingEnabled = true; // Enables cutaway / section view
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 1.0;
    controls.panSpeed = 0.8;
    controlsRef.current = controls;

    // Subtle grid helper for spatial context
    const gridHelper = new THREE.GridHelper(220, 22, 0x1e293b, 0x0f172a);
    gridHelper.position.y = -60;
    scene.add(gridHelper);

    // Orientation axes helper (R/G/B = X/Y/Z)
    const axesHelper = new THREE.AxesHelper(30);
    axesHelper.position.set(-80, -50, -80);
    scene.add(axesHelper);

    // Lighting setup (scientific key + rim + ambient)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.25);
    dirLight1.position.set(120, 200, 180);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x94a3b8, 0.7);
    dirLight2.position.set(-150, -100, -120);
    scene.add(dirLight2);

    const dirLight3 = new THREE.DirectionalLight(0x38bdf8, 0.45);
    dirLight3.position.set(0, -100, 100);
    scene.add(dirLight3);

    // Root group for all surface meshes
    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;

    // Animation Loop
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize observer
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // 2. Build or rebuild meshes when active mesh source, viewMode, or simulation changes
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // Clear existing meshes
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }
    meshesRef.current = {};

    // Select active mesh dictionary based on viewMode
    let activeMeshes = {};
    if (viewMode === "agreement" && agreementMeshes) {
      activeMeshes = {
        TP: agreementMeshes.TP,
        FP: agreementMeshes.FP,
        FN: agreementMeshes.FN,
        brain: regions?.brain,
      };
    } else if (viewMode === "expert" && expertMeshes) {
      activeMeshes = {
        WT: expertMeshes.WT,
        TC: expertMeshes.TC,
        ET: expertMeshes.ET,
        brain: regions?.brain,
      };
    } else {
      activeMeshes = { ...regions };
    }

    // Attach simulated expansion mesh if active (Feature: Phase 4)
    if (showSimulation && simulatedMesh) {
      activeMeshes.simulated = simulatedMesh;
    }

    if (!activeMeshes || Object.keys(activeMeshes).length === 0) return;

    // Determine collective bounding box in physical mm
    let minCoord = new THREE.Vector3(Infinity, Infinity, Infinity);
    let maxCoord = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    let hasGeometry = false;

    Object.entries(activeMeshes).forEach(([key, regionData]) => {
      if (!regionData?.vertices?.length || !regionData?.faces?.length) return;

      regionData.vertices.forEach(([x, y, z]) => {
        minCoord.x = Math.min(minCoord.x, x);
        minCoord.y = Math.min(minCoord.y, y);
        minCoord.z = Math.min(minCoord.z, z);
        maxCoord.x = Math.max(maxCoord.x, x);
        maxCoord.y = Math.max(maxCoord.y, y);
        maxCoord.z = Math.max(maxCoord.z, z);
      });
      hasGeometry = true;
    });

    if (!hasGeometry) return;

    const center = new THREE.Vector3().addVectors(minCoord, maxCoord).multiplyScalar(0.5);
    const size = new THREE.Vector3().subVectors(maxCoord, minCoord);
    const maxDim = Math.max(size.x, size.y, size.z, 50);

    // Center the group in the scene coordinates
    group.position.set(-center.x, -center.y, -center.z);
    boundingInfoRef.current = { center, maxDim };

    // Keys to render depending on mode
    const renderKeys = viewMode === "agreement"
      ? ["brain", "FN", "FP", "TP"]
      : ["brain", "simulated", "WT", "TC", "ET"];

    renderKeys.forEach((regionKey) => {
      const regionData = activeMeshes[regionKey];
      if (!regionData?.vertices?.length || !regionData?.faces?.length) return;

      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(regionData.vertices.flat());
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setIndex(regionData.faces.flat());
      geometry.computeVertexNormals();

      const cfg = REGION_CONFIG[regionKey] || { color: 0xffffff, depthWrite: true, renderOrder: 0 };
      const defaultOpacity = regionKey === "brain" ? 0.18 : regionKey === "simulated" ? simulationOpacity : 0.75;

      const material = new THREE.MeshStandardMaterial({
        color: cfg.color,
        roughness: cfg.roughness ?? 0.35,
        metalness: cfg.metalness ?? 0.15,
        transparent: true,
        opacity: opacities[regionKey] ?? defaultOpacity,
        wireframe: wireframe,
        side: THREE.DoubleSide,
        depthWrite: cfg.depthWrite,
        clippingPlanes: (regionKey === "brain" && cutaway) ? [clipPlaneRef.current] : [],
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = regionKey;
      mesh.renderOrder = cfg.renderOrder ?? 0;
      mesh.visible = visibleRegions[regionKey] !== false;
      group.add(mesh);
      meshesRef.current[regionKey] = mesh;
    });

    // Create and attach 3D synchronized crosshair marker
    const marker = createCrosshairMarker();
    group.add(marker);
    crosshairGroupRef.current = marker;
    if (Array.isArray(worldCrosshair) && worldCrosshair.length === 3) {
      marker.position.set(worldCrosshair[0], worldCrosshair[1], worldCrosshair[2]);
      marker.visible = true;
    }

    // Frame camera
    resetCamera(maxDim);
  }, [regions, expertMeshes, agreementMeshes, simulatedMesh, showSimulation, viewMode]);

  // 3. Update 3D Crosshair Marker position when worldCrosshair changes
  useEffect(() => {
    const marker = crosshairGroupRef.current;
    if (!marker) return;

    if (Array.isArray(worldCrosshair) && worldCrosshair.length === 3) {
      marker.position.set(worldCrosshair[0], worldCrosshair[1], worldCrosshair[2]);
      marker.visible = true;
    } else {
      marker.visible = false;
    }
  }, [worldCrosshair]);

  // 4. Update visibility, opacity, wireframe & cutaway clipping without rebuilding geometry
  useEffect(() => {
    ["brain", "WT", "TC", "ET", "TP", "FP", "FN", "simulated"].forEach((regionKey) => {
      const mesh = meshesRef.current[regionKey];
      if (mesh && mesh.material) {
        mesh.visible = visibleRegions[regionKey] !== false;
        const defaultOpacity = regionKey === "brain" ? 0.18 : regionKey === "simulated" ? simulationOpacity : 0.75;
        mesh.material.opacity = opacities[regionKey] ?? defaultOpacity;
        mesh.material.wireframe = wireframe;

        // Cutaway clipping plane on brain anatomy shell
        if (regionKey === "brain") {
          mesh.material.clippingPlanes = cutaway ? [clipPlaneRef.current] : [];
        }

        mesh.material.needsUpdate = true;
      }
    });
  }, [visibleRegions, opacities, wireframe, cutaway, simulationOpacity]);

  const resetCamera = (dim) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const maxDim = dim || boundingInfoRef.current.maxDim || 100;
    const distance = maxDim * 2.2;
    camera.position.set(0, distance * 0.4, distance);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
  };

  const focusScenario = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const maxDim = boundingInfoRef.current.maxDim || 100;
    const distance = maxDim * 1.5;
    camera.position.set(distance * 0.5, distance * 0.5, distance * 0.9);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
  };

  if (onResetViewRef) {
    onResetViewRef.current = () => resetCamera();
  }
  if (onFocusScenarioRef) {
    onFocusScenarioRef.current = () => focusScenario();
  }

  const hasAnyMesh = Boolean(regions || expertMeshes || agreementMeshes);

  return (
    <div className="viewport-card">
      <div ref={mountRef} className="canvas-container" />

      {/* Professional Information HUD (Feature: Phase 3) */}
      {hasAnyMesh && (
        <div className="viewer-info-hud">
          <div className="info-hud-row">
            <span className="info-hud-label">Case:</span>
            <span className="info-hud-val">{hudInfo?.caseId || "BraTS2021 Reference"}</span>
          </div>
          <div className="info-hud-row">
            <span className="info-hud-label">Model:</span>
            <span className="info-hud-val">SegResNet (v0.5.4)</span>
          </div>
          {hudInfo?.inferenceTime && (
            <div className="info-hud-row">
              <span className="info-hud-label">Inference:</span>
              <span className="info-hud-val" style={{ color: "#10b981" }}>{hudInfo.inferenceTime}</span>
            </div>
          )}
          {worldCrosshair && (
            <div className="info-hud-row">
              <span className="info-hud-label">Position:</span>
              <span className="info-hud-val">
                [{worldCrosshair[0] >= 0 ? "+" : ""}{worldCrosshair[0]}, {worldCrosshair[1] >= 0 ? "+" : ""}{worldCrosshair[1]}, {worldCrosshair[2] >= 0 ? "+" : ""}{worldCrosshair[2]} mm]
              </span>
            </div>
          )}
        </div>
      )}

      {/* Anatomical Orientation Markers (Feature: Phase 3) */}
      {hasAnyMesh && (
        <div className="anatomical-orientation-hud">
          <span className="orientation-badge" title="Left / Right">L ⟷ R</span>
          <span className="orientation-badge" title="Anterior / Posterior">A ⟷ P</span>
          <span className="orientation-badge" title="Superior / Inferior">S ⟷ I</span>
          {cutaway && (
            <span className="orientation-badge" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#ef4444", borderColor: "#ef4444" }}>
              Cutaway Active
            </span>
          )}
        </div>
      )}

      {/* Empty State Overlay */}
      {!hasAnyMesh && (
        <div className="empty-viewport-overlay">
          <div className="empty-icon-circle">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
            </svg>
          </div>
          <h3 className="empty-title">Interactive 3D Brain Tumour Viewer</h3>
          <p className="empty-desc">
            Upload the four MRI sequences (T1, T1Gd, T2, FLAIR) to generate model-predicted 3D tumour surfaces.
          </p>
        </div>
      )}

      {/* Floating Legend */}
      {hasAnyMesh && (
        <div className="viewer-legend">
          {viewMode === "agreement" ? (
            <>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "4px", textTransform: "uppercase" }}>
                Agreement with Reference Mask
              </div>
              <div className="legend-item">
                <span className="region-color-dot" style={{ background: "#10b981" }} />
                <span style={{ color: "#10b981", fontWeight: 600 }}>True Positive</span>
                <span style={{ color: "var(--text-dim)", fontSize: "0.7rem" }}>pred ∩ expert</span>
              </div>
              <div className="legend-item">
                <span className="region-color-dot" style={{ background: "#8b5cf6" }} />
                <span style={{ color: "#a78bfa", fontWeight: 600 }}>False Positive</span>
                <span style={{ color: "var(--text-dim)", fontSize: "0.7rem" }}>pred - expert</span>
              </div>
              <div className="legend-item">
                <span className="region-color-dot" style={{ background: "#f59e0b" }} />
                <span style={{ color: "#fbbf24", fontWeight: 600 }}>False Negative</span>
                <span style={{ color: "var(--text-dim)", fontSize: "0.7rem" }}>expert - pred</span>
              </div>
            </>
          ) : viewMode === "expert" ? (
            <>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#10b981", marginBottom: "4px", textTransform: "uppercase" }}>
                Expert Reference Mask
              </div>
              <div className="legend-item">
                <span className="region-color-dot dot-wt" />
                <span style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>Expert WT</span>
                <span style={{ color: "var(--text-dim)" }}>Whole Tumour</span>
              </div>
              <div className="legend-item">
                <span className="region-color-dot dot-tc" />
                <span style={{ color: "var(--accent-amber)", fontWeight: 600 }}>Expert TC</span>
                <span style={{ color: "var(--text-dim)" }}>Tumour Core</span>
              </div>
              <div className="legend-item">
                <span className="region-color-dot dot-et" />
                <span style={{ color: "var(--accent-red)", fontWeight: 600 }}>Expert ET</span>
                <span style={{ color: "var(--text-dim)" }}>Enhancing</span>
              </div>
            </>
          ) : (
            <>
              <div className="legend-item">
                <span className="region-color-dot dot-wt" />
                <span style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>WT</span>
                <span style={{ color: "var(--text-dim)" }}>Whole Tumour</span>
              </div>
              <div className="legend-item">
                <span className="region-color-dot dot-tc" />
                <span style={{ color: "var(--accent-amber)", fontWeight: 600 }}>TC</span>
                <span style={{ color: "var(--text-dim)" }}>Tumour Core</span>
              </div>
              <div className="legend-item">
                <span className="region-color-dot dot-et" />
                <span style={{ color: "var(--accent-red)", fontWeight: 600 }}>ET</span>
                <span style={{ color: "var(--text-dim)" }}>Enhancing Tumour</span>
              </div>
            </>
          )}

          {showSimulation && simulatedMesh && (
            <div className="legend-item" style={{ borderTop: "1px dashed rgba(255, 255, 255, 0.1)", paddingTop: "4px", marginTop: "4px" }}>
              <span className="region-color-dot" style={{ background: "#c084fc" }} />
              <span style={{ color: "#c084fc", fontWeight: 600 }}>Simulated</span>
              <span style={{ color: "var(--text-dim)", fontSize: "0.7rem" }}>Hypothetical expansion</span>
            </div>
          )}

          {regions?.brain && (
            <div className="legend-item" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "4px", marginTop: "4px" }}>
              <span className="region-color-dot dot-brain" />
              <span style={{ color: "#cbd5e1", fontWeight: 600 }}>Brain</span>
              <span style={{ color: "var(--text-dim)", fontSize: "0.72rem" }}>Patient-specific MRI anatomy</span>
            </div>
          )}
        </div>
      )}

      {/* Viewer Bottom Controls */}
      {hasAnyMesh && (
        <div className="viewer-bottom-bar">
          <button onClick={() => resetCamera()} className="btn-reset-view">
            Reset View
          </button>
          {showSimulation && (
            <button onClick={focusScenario} className="btn-reset-view" style={{ background: "rgba(192, 132, 252, 0.2)", color: "#c084fc" }}>
              Focus Scenario
            </button>
          )}
          <span>|</span>
          <span>Rotate: Left Click</span>
          <span>•</span>
          <span>Pan: Right Click</span>
          <span>•</span>
          <span>Zoom: Scroll</span>
        </div>
      )}
    </div>
  );
}
