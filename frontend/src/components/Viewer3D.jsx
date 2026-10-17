import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const REGION_CONFIG = {
  WT: {
    color: 0x38bdf8, // Cyan / Ice Blue
    name: "Whole Tumour",
    depthWrite: false,
    renderOrder: 2,
    roughness: 0.30,
    metalness: 0.20,
  },
  TC: {
    color: 0xf59e0b, // Amber / Warm Orange
    name: "Tumour Core",
    depthWrite: false,
    renderOrder: 3,
    roughness: 0.30,
    metalness: 0.20,
  },
  ET: {
    color: 0xef4444, // Crimson / Red
    name: "Enhancing Tumour",
    depthWrite: true,
    renderOrder: 4,
    roughness: 0.30,
    metalness: 0.20,
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
  brain: {
    color: 0x94a3b8, // Slate cortical anatomical shell
    name: "Patient-specific MRI anatomy",
    depthWrite: false,
    renderOrder: 1,
    roughness: 0.40,
    metalness: 0.15,
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
  cutaway = false,
  viewMode = "predicted", // "predicted", "expert", "agreement"
  visibleRegions = { WT: true, TC: true, ET: true, brain: true, TP: true, FP: true, FN: true },
  opacities = { WT: 0.35, TC: 0.65, ET: 0.85, brain: 0.22, TP: 0.85, FP: 0.65, FN: 0.55 },
  wireframe = false,
  onResetViewRef = null,
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
    const height = container.clientHeight || 520;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080e);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(0, 0, 180);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
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

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.35);
    dirLight1.position.set(120, 200, 180);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x94a3b8, 0.75);
    dirLight2.position.set(-150, -100, -120);
    scene.add(dirLight2);

    const dirLight3 = new THREE.DirectionalLight(0x38bdf8, 0.5);
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

  // 2. Build / Update 3D Meshes
  useEffect(() => {
    const scene = sceneRef.current;
    const group = groupRef.current;
    if (!scene || !group) return;

    // Clear old meshes
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    }
    meshesRef.current = {};

    let targetRegions = regions;
    if (viewMode === "expert" && expertMeshes) {
      targetRegions = { ...expertMeshes, brain: regions?.brain };
    } else if (viewMode === "agreement" && agreementMeshes) {
      targetRegions = { ...agreementMeshes, brain: regions?.brain };
    }

    if (!targetRegions) return;

    const globalBox = new THREE.Box3();
    let hasValidMesh = false;

    // Primary meshes to load
    const meshKeys = ["brain", "WT", "TC", "ET", "TP", "FP", "FN"];

    meshKeys.forEach((regionKey) => {
      const meshData = targetRegions[regionKey];
      if (!meshData || !meshData.vertices || !meshData.faces) return;

      const vertices = meshData.vertices;
      const faces = meshData.faces;
      if (vertices.length === 0 || faces.length === 0) return;

      const cfg = REGION_CONFIG[regionKey] || {
        color: 0x38bdf8,
        depthWrite: false,
        renderOrder: 2,
        roughness: 0.35,
        metalness: 0.15,
      };

      const geometry = new THREE.BufferGeometry();
      const posArray = new Float32Array(vertices.length * 3);
      for (let i = 0; i < vertices.length; i++) {
        posArray[i * 3] = vertices[i][0];
        posArray[i * 3 + 1] = vertices[i][1];
        posArray[i * 3 + 2] = vertices[i][2];
      }
      geometry.setAttribute("position", new THREE.BufferAttribute(posArray, 3));

      const idxArray = new Uint32Array(faces.length * 3);
      for (let i = 0; i < faces.length; i++) {
        idxArray[i * 3] = faces[i][0];
        idxArray[i * 3 + 1] = faces[i][1];
        idxArray[i * 3 + 2] = faces[i][2];
      }
      geometry.setIndex(new THREE.BufferAttribute(idxArray, 1));
      geometry.computeVertexNormals();

      const defaultOpacity = regionKey === "brain" ? 0.22 : 0.75;
      const material = new THREE.MeshStandardMaterial({
        color: cfg.color,
        roughness: cfg.roughness ?? 0.35,
        metalness: cfg.metalness ?? 0.15,
        transparent: true,
        opacity: opacities[regionKey] ?? defaultOpacity,
        depthWrite: cfg.depthWrite ?? false,
        wireframe: wireframe,
        side: THREE.DoubleSide,
      });

      if (regionKey === "brain" && cutaway) {
        material.clippingPlanes = [clipPlaneRef.current];
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `mesh_${regionKey}`;
      mesh.renderOrder = cfg.renderOrder || 2;
      mesh.visible = visibleRegions[regionKey] !== false;

      group.add(mesh);
      meshesRef.current[regionKey] = mesh;

      geometry.computeBoundingBox();
      if (geometry.boundingBox) {
        globalBox.union(geometry.boundingBox);
        hasValidMesh = true;
      }
    });

    // Add 3D World Crosshair Marker
    const crosshairMarker = createCrosshairMarker();
    scene.add(crosshairMarker);
    crosshairGroupRef.current = crosshairMarker;

    if (hasValidMesh && !globalBox.isEmpty()) {
      const center = new THREE.Vector3();
      globalBox.getCenter(center);

      // Center the mesh group at origin
      group.position.set(-center.x, -center.y, -center.z);

      // Set section clipping plane reference point to center
      clipPlaneRef.current.constant = -center.z;

      const size = new THREE.Vector3();
      globalBox.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);

      boundingInfoRef.current = {
        center,
        maxDim,
        box: globalBox,
      };

      resetCamera(maxDim);
    }
  }, [regions, expertMeshes, agreementMeshes, viewMode]);

  // 3. Update 3D Crosshair Position in World Space
  useEffect(() => {
    const marker = crosshairGroupRef.current;
    const group = groupRef.current;
    if (!marker || !group) return;

    if (Array.isArray(worldCrosshair) && worldCrosshair.length === 3) {
      const center = boundingInfoRef.current.center;
      marker.position.set(
        worldCrosshair[0] - center.x,
        worldCrosshair[1] - center.y,
        worldCrosshair[2] - center.z
      );
      marker.visible = true;
    } else {
      marker.visible = false;
    }
  }, [worldCrosshair]);

  // 4. Update visibility, opacity, wireframe & cutaway clipping without rebuilding geometry
  useEffect(() => {
    ["brain", "WT", "TC", "ET", "TP", "FP", "FN"].forEach((regionKey) => {
      const mesh = meshesRef.current[regionKey];
      if (mesh && mesh.material) {
        mesh.visible = visibleRegions[regionKey] !== false;
        const defaultOpacity = regionKey === "brain" ? 0.22 : 0.75;
        mesh.material.opacity = opacities[regionKey] ?? defaultOpacity;
        mesh.material.wireframe = wireframe;

        // Cutaway clipping plane on brain anatomy shell
        if (regionKey === "brain") {
          mesh.material.clippingPlanes = cutaway ? [clipPlaneRef.current] : [];
        }

        mesh.material.needsUpdate = true;
      }
    });
  }, [visibleRegions, opacities, wireframe, cutaway]);

  const resetCamera = (dim) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const maxDim = dim || boundingInfoRef.current.maxDim || 100;
    // Tighter framing: brain occupies ~75-80% of canvas
    const distance = maxDim * 1.55;
    camera.position.set(0, distance * 0.35, distance);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
  };

  if (onResetViewRef) {
    onResetViewRef.current = () => resetCamera();
  }

  const hasAnyMesh = Boolean(regions || expertMeshes || agreementMeshes);

  return (
    <div className="viewport-card">
      <div ref={mountRef} className="canvas-container" />

      {/* Professional Information HUD */}
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
          {hudInfo?.inferenceTimeSec && (
            <div className="info-hud-row">
              <span className="info-hud-label">Inference:</span>
              <span className="info-hud-val" style={{ color: "#10b981" }}>{hudInfo.inferenceTimeSec}s</span>
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

      {/* Anatomical Orientation Markers */}
      {hasAnyMesh && (
        <div className="anatomical-orientation-hud">
          <span className="orientation-badge" title="Left / Right">L ⟷ R</span>
          <span className="orientation-badge" title="Anterior / Posterior">A ⟷ P</span>
          <span className="orientation-badge" title="Superior / Inferior">S ⟷ I</span>
          {cutaway && (
            <span className="orientation-badge cutaway-active">
              Cutaway Active
            </span>
          )}
        </div>
      )}

      {/* Empty State Overlay */}
      {!hasAnyMesh && (
        <div className="empty-state-overlay">
          <div className="empty-icon-ring">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <h3 className="empty-title">Awaiting MRI Sequences</h3>
          <p className="empty-desc">
            Load the four MRI sequences (T1, T1Gd, T2, FLAIR) to generate patient-specific 3D brain and tumour surfaces.
          </p>
        </div>
      )}

      {/* Floating Legend */}
      {hasAnyMesh && (
        <div className="viewer-legend">
          {viewMode === "agreement" ? (
            <>
              <div className="legend-header">Reference Agreement</div>
              <div className="legend-item">
                <span className="region-color-dot" style={{ background: "#10b981" }} />
                <span style={{ color: "#10b981", fontWeight: 600 }}>True Positive</span>
                <span className="legend-item-sub">pred ∩ expert</span>
              </div>
              <div className="legend-item">
                <span className="region-color-dot" style={{ background: "#8b5cf6" }} />
                <span style={{ color: "#a78bfa", fontWeight: 600 }}>False Positive</span>
                <span className="legend-item-sub">pred - expert</span>
              </div>
              <div className="legend-item">
                <span className="region-color-dot" style={{ background: "#f59e0b" }} />
                <span style={{ color: "#fbbf24", fontWeight: 600 }}>False Negative</span>
                <span className="legend-item-sub">expert - pred</span>
              </div>
            </>
          ) : viewMode === "expert" ? (
            <>
              <div className="legend-header" style={{ color: "#10b981" }}>Expert Reference Mask</div>
              <div className="legend-item">
                <span className="region-color-dot dot-wt" />
                <span style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>Expert WT</span>
                <span className="legend-item-sub">Whole Tumour</span>
              </div>
              <div className="legend-item">
                <span className="region-color-dot dot-tc" />
                <span style={{ color: "var(--accent-amber)", fontWeight: 600 }}>Expert TC</span>
                <span className="legend-item-sub">Tumour Core</span>
              </div>
              <div className="legend-item">
                <span className="region-color-dot dot-et" />
                <span style={{ color: "var(--accent-red)", fontWeight: 600 }}>Expert ET</span>
                <span className="legend-item-sub">Enhancing</span>
              </div>
            </>
          ) : (
            <>
              <div className="legend-item">
                <span className="region-color-dot dot-wt" />
                <span style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>WT</span>
                <span className="legend-item-sub">Whole Tumour</span>
              </div>
              <div className="legend-item">
                <span className="region-color-dot dot-tc" />
                <span style={{ color: "var(--accent-amber)", fontWeight: 600 }}>TC</span>
                <span className="legend-item-sub">Tumour Core</span>
              </div>
              <div className="legend-item">
                <span className="region-color-dot dot-et" />
                <span style={{ color: "var(--accent-red)", fontWeight: 600 }}>ET</span>
                <span className="legend-item-sub">Enhancing Tumour</span>
              </div>
            </>
          )}

          {regions?.brain && (
            <div className="legend-item brain-legend-item">
              <span className="region-color-dot dot-brain" />
              <span style={{ color: "#cbd5e1", fontWeight: 600 }}>Brain Anatomy</span>
              <span className="legend-item-sub">Patient-specific T1 shell</span>
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
