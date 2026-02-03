import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { propagateResize } from "./graph";
import { sampleGraph } from "./sampleGraph";

const furnitureCanvas = document.querySelector<HTMLCanvasElement>("#scene-furniture");
const graphCanvas = document.querySelector<HTMLCanvasElement>("#scene-graph");
const overlay = document.querySelector<HTMLDivElement>("#face-overlay");
const overlayCanvas = document.querySelector<HTMLCanvasElement>("#face-canvas");
const overlayClose = document.querySelector<HTMLButtonElement>("#overlay-close");
const tooltip = document.querySelector<HTMLDivElement>("#tooltip");

if (!furnitureCanvas || !graphCanvas || !overlay || !overlayCanvas || !overlayClose || !tooltip) {
  throw new Error("Canvas not found");
}

const furnitureScene = new THREE.Scene();
const graphScene = new THREE.Scene();
furnitureScene.background = new THREE.Color(0x0d0f14);
graphScene.background = new THREE.Color(0x0d0f14);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
camera.position.set(180, 140, 200);

const furnitureRenderer = new THREE.WebGLRenderer({ canvas: furnitureCanvas, antialias: true });
const graphRenderer = new THREE.WebGLRenderer({ canvas: graphCanvas, antialias: true });
furnitureRenderer.setPixelRatio(window.devicePixelRatio);
graphRenderer.setPixelRatio(window.devicePixelRatio);

const controls = new OrbitControls(camera, furnitureRenderer.domElement);
const graphControls = new OrbitControls(camera, graphRenderer.domElement);
controls.enableDamping = true;
graphControls.enableDamping = true;

const panelGroup = new THREE.Group();
const graphGroup = new THREE.Group();
const edgeButtonGroup = new THREE.Group();
const faceHighlightGroup = new THREE.Group();
furnitureScene.add(panelGroup);
furnitureScene.add(faceHighlightGroup);
graphScene.add(graphGroup, edgeButtonGroup);

const ambient = new THREE.AmbientLight(0xffffff, 0.6);
const directional = new THREE.DirectionalLight(0xffffff, 0.8);
directional.position.set(120, 200, 100);
furnitureScene.add(ambient, directional);
graphScene.add(ambient.clone(), directional.clone());

const axes = new THREE.AxesHelper(120);
furnitureScene.add(axes);

const axisLabel = (text: string, color: string) => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Sprite();
  ctx.font = "12px 'Segoe UI'";
  const padding = 6;
  const metrics = ctx.measureText(text);
  canvas.width = metrics.width + padding * 2;
  canvas.height = 18 + padding;
  ctx.font = "12px 'Segoe UI'";
  ctx.fillStyle = "rgba(15, 19, 32, 0.8)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = color;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#e6e9ef";
  ctx.fillText(text, padding, 14);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(canvas.width * 0.5, canvas.height * 0.5, 1);
  return sprite;
};

const xLabel = axisLabel("X", "#ef4444");
const yLabel = axisLabel("Y", "#22c55e");
const zLabel = axisLabel("Z", "#3b82f6");
xLabel.position.set(130, 0, 0);
// Swap Y and Z in display coordinates.
yLabel.position.set(0, 0, 130);
zLabel.position.set(0, 130, 0);
furnitureScene.add(xLabel, yLabel, zLabel);

const toDisplay = (x: number, y: number, z: number) => new THREE.Vector3(x, z, y);

const panelMeshes = new Map<string, THREE.Mesh>();
const panelEdgeMeshes = new Map<string, THREE.LineSegments>();
const edgeButtonMeshes = new Map<string, THREE.Mesh>();
const edgeHitMeshes = new Map<string, THREE.Mesh>();
const nodeMeshes = new Map<string, THREE.Mesh>();
const nodeHitMeshes = new Map<string, THREE.Mesh>();
const labelSprites: THREE.Sprite[] = [];
let didFitCamera = false;
let lastPointerMove = Date.now();
let hoveredEdgeId: string | null = null;
let hoveredNodeId: string | null = null;
let selectedEdgeId: string | null = null;
let selectedNodeId: string | null = null;
let autoRotatePhase = 0;
let autoRotateVelocity = new THREE.Vector3(0.0009, 0.0003, 0.0003);
let autoRotateLastSwitch = Date.now();
let autoRotateRamp = 0;

const palettes: Record<string, number[]> = {
  "cool-tech": [0x3b82f6, 0x06b6d4, 0x10b981, 0x8b5cf6, 0xf59e0b],
  "neon-terminal": [0x00ff9c, 0x00e5ff, 0x7c3aed, 0xff4d6d, 0xffd60a],
  "cyberpunk-noir": [0x00f5ff, 0x8b5cf6, 0xff007a, 0x00ff9c, 0xffb703]
};

let currentPaletteKey = "cool-tech";

const colorForPanel = (id: string) => {
  const palette = palettes[currentPaletteKey] ?? palettes["cool-tech"];
  const index = Math.abs(hashString(id)) % palette.length;
  return palette[index];
};

const hashString = (value: string) =>
  value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

const updatePanels = () => {
  sampleGraph.panels.forEach((panel) => {
    const existing = panelMeshes.get(panel.id);
    const geometry = new THREE.BoxGeometry(
      panel.width,
      panel.height,
      sampleGraph.thickness
    );
    if (existing) {
      existing.geometry.dispose();
      existing.geometry = geometry;
      existing.position.copy(toDisplay(panel.x, panel.y, panel.z));
      if (panel.rotation) {
        existing.rotation.set(...panel.rotation);
      } else {
        existing.rotation.set(0, 0, 0);
      }
    } else {
      const material = new THREE.MeshStandardMaterial({
        color: colorForPanel(panel.id),
        transparent: true,
        opacity: 0
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(toDisplay(panel.x, panel.y, panel.z));
      if (panel.rotation) {
        mesh.rotation.set(...panel.rotation);
      }
      panelMeshes.set(panel.id, mesh);
      panelGroup.add(mesh);
    }

    const edgeMesh = panelEdgeMeshes.get(panel.id);
    const edgeGeometry = new THREE.EdgesGeometry(geometry);
    if (edgeMesh) {
      edgeMesh.geometry.dispose();
      edgeMesh.geometry = edgeGeometry;
      edgeMesh.position.copy(toDisplay(panel.x, panel.y, panel.z));
      if (panel.rotation) {
        edgeMesh.rotation.set(...panel.rotation);
      } else {
        edgeMesh.rotation.set(0, 0, 0);
      }
    } else {
      const line = new THREE.LineSegments(
        edgeGeometry,
        new THREE.LineBasicMaterial({ color: 0xe2e8f0, linewidth: 1 })
      );
      line.position.copy(toDisplay(panel.x, panel.y, panel.z));
      if (panel.rotation) {
        line.rotation.set(...panel.rotation);
      }
      panelEdgeMeshes.set(panel.id, line);
      panelGroup.add(line);
    }
  });
};

const updateGraphOverlay = () => {
  while (graphGroup.children.length) {
    const child = graphGroup.children.pop();
    if (child) {
      child.traverse((obj: THREE.Object3D) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
          obj.geometry.dispose();
        }
      });
    }
  }

  while (edgeButtonGroup.children.length) {
    const child = edgeButtonGroup.children.pop();
    if (child && child instanceof THREE.Mesh) {
      child.geometry.dispose();
    }
  }
  edgeButtonMeshes.clear();
  edgeHitMeshes.clear();


  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x93c5fd });

  labelSprites.forEach((sprite) => {
    graphGroup.remove(sprite);
    if (sprite.material.map) {
      sprite.material.map.dispose();
    }
    sprite.material.dispose();
  });
  labelSprites.length = 0;

  nodeMeshes.clear();
  nodeHitMeshes.clear();

  sampleGraph.panels.forEach((panel) => {
    const node = new THREE.Mesh(
      new THREE.SphereGeometry(8, 20, 20),
      new THREE.MeshStandardMaterial({
        color: colorForPanel(panel.id),
        emissive: 0x000000
      })
    );
  node.position.copy(toDisplay(panel.x, panel.y, panel.z));
    node.userData.panelId = panel.id;
    graphGroup.add(node);
    nodeMeshes.set(panel.id, node);

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(12, 12, 12),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
    );
  hit.position.copy(toDisplay(panel.x, panel.y, panel.z));
    hit.userData.panelId = panel.id;
    graphGroup.add(hit);
    nodeHitMeshes.set(panel.id, hit);

    const label = createLabelSprite(panel.id);
  const labelPos = toDisplay(panel.x, panel.y + 18, panel.z);
  label.position.copy(labelPos);
    graphGroup.add(label);
    labelSprites.push(label);
  });

  sampleGraph.edges.forEach((edge) => {
    const from = sampleGraph.panels.find((p) => p.id === edge.faceA.panelId)!;
    const to = sampleGraph.panels.find((p) => p.id === edge.faceB.panelId)!;
    const points = [
      toDisplay(from.x, from.y, from.z),
      toDisplay(to.x, to.y, to.z)
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, edgeMaterial);
    graphGroup.add(line);

    const mid = new THREE.Vector3()
      .addVectors(points[0], points[1])
      .multiplyScalar(0.5);
    const button = new THREE.Mesh(
      new THREE.SphereGeometry(3.5, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x5a4a00 })
    );
    button.position.copy(mid);
    button.userData.edgeId = edge.id;
    edgeButtonGroup.add(button);
    edgeButtonMeshes.set(edge.id, button);

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(6.5, 12, 12),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
    );
    hit.position.copy(mid);
    hit.userData.edgeId = edge.id;
    edgeButtonGroup.add(hit);
    edgeHitMeshes.set(edge.id, hit);

  });
};

const rebuildFaceHighlights = (edgeFilterId: string | null = null) => {
  while (faceHighlightGroup.children.length) {
    const child = faceHighlightGroup.children.pop();
    if (child) {
      child.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
        }
      });
    }
  }

  const makePlane = (
    rect: { x: number; y: number; w: number; h: number },
    side: string,
    panel: { width: number; height: number },
    color: number,
    opacity: number
  ) => {
    const width = Math.abs(rect.w);
    const height = Math.abs(rect.h);
    if (width < 0.001 || height < 0.001) return null;

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthTest: false,
        emissive: color,
        emissiveIntensity: 0.35
      })
    );

    const halfThickness = sampleGraph.thickness / 2 + 0.2;
    if (side === "left" || side === "right") {
      plane.rotation.y = Math.PI / 2;
      plane.position.x = (side === "left" ? -1 : 1) * (panel.width / 2 + 0.2);
      plane.position.y = rect.y;
      plane.position.z = rect.x;
    } else if (side === "top" || side === "bottom") {
      plane.rotation.x = Math.PI / 2;
      plane.position.y = (side === "top" ? 1 : -1) * (panel.height / 2 + 0.2);
      plane.position.x = rect.x;
      plane.position.z = rect.y;
    } else {
      plane.position.set(rect.x, rect.y, halfThickness);
    }

    return plane;
  };

  sampleGraph.edges.forEach((edge) => {
    if (edgeFilterId && edge.id !== edgeFilterId) return;
  const panelA = panelMeshes.get(edge.faceA.panelId);
  const panelB = panelMeshes.get(edge.faceB.panelId);
  const panelAData = sampleGraph.panels.find((panel) => panel.id === edge.faceA.panelId);
  const panelBData = sampleGraph.panels.find((panel) => panel.id === edge.faceB.panelId);
  if (!panelA || !panelB || !panelAData || !panelBData) return;
    const baseColor = edgeFilterId ? 0xff2d2d : 0x22c55e;
    const baseOpacity = edgeFilterId ? 0.8 : 0.35;

    const faceAOverlap = makePlane(
      edge.overlap.rectOnA,
      edge.faceA.side,
      panelAData,
      baseColor,
      baseOpacity
    );
    if (faceAOverlap) panelA.add(faceAOverlap);
  });
};

const createLabelSprite = (text: string) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return new THREE.Sprite();
  const padding = 8;
  context.font = "11px 'Segoe UI'";
  const metrics = context.measureText(text);
  canvas.width = metrics.width + padding * 2;
  canvas.height = 18 + padding;
  context.font = "11px 'Segoe UI'";
  context.fillStyle = "rgba(15, 19, 32, 0.5)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#3b82f6";
  context.strokeRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#e6e9ef";
  context.fillText(text, padding, 12 + padding / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  const scale = 0.6;
  sprite.scale.set(canvas.width * scale, canvas.height * scale, 1);
  return sprite;
};

const tooltipOffset = new THREE.Vector3(0, 14, 0);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const updateTooltipPosition = (worldPos: THREE.Vector3) => {
  const canvasRect = graphCanvas.getBoundingClientRect();
  const parentRect = graphCanvas.parentElement?.getBoundingClientRect() ?? canvasRect;
  const screenPos = worldPos.project(camera);
  const x = ((screenPos.x + 1) / 2) * canvasRect.width;
  const y = ((1 - screenPos.y) / 2) * canvasRect.height;
  const offsetX = canvasRect.left - parentRect.left;
  const offsetY = canvasRect.top - parentRect.top;
  const padding = 8;
  const maxX = parentRect.width - padding;
  const maxY = parentRect.height - padding;
  const tooltipWidth = tooltip.offsetWidth || 160;
  const tooltipHeight = tooltip.offsetHeight || 60;
  const left = Math.min(Math.max(x + offsetX, padding + tooltipWidth / 2), maxX - tooltipWidth / 2);
  const top = Math.min(Math.max(y + offsetY, padding + tooltipHeight / 2), maxY - tooltipHeight / 2);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
};

const showTooltip = (html: string, worldPos: THREE.Vector3) => {
  tooltip.innerHTML = html;
  tooltip.style.width = "auto";
  tooltip.style.height = "auto";
  tooltip.classList.remove("hidden");
  updateTooltipPosition(worldPos);
};

const updateTooltipForNode = (panelId: string) => {
  const panel = sampleGraph.panels.find((p) => p.id === panelId);
  if (!panel) return;
  const displayPos = toDisplay(panel.x, panel.y, panel.z).add(tooltipOffset);
  showTooltip(
    `<strong>${panel.id}</strong><span class="line">w:${panel.width.toFixed(1)} h:${panel.height.toFixed(1)}</span><span class="line">(${panel.x.toFixed(1)}, ${panel.y.toFixed(1)}, ${panel.z.toFixed(1)})</span>`,
    displayPos
  );
};

const updateTooltipForEdge = (edgeId: string) => {
  const edge = sampleGraph.edges.find((item) => item.id === edgeId);
  if (!edge) return;
  const from = sampleGraph.panels.find((p) => p.id === edge.faceA.panelId);
  const to = sampleGraph.panels.find((p) => p.id === edge.faceB.panelId);
  if (!from || !to) return;
  const mid = toDisplay(from.x, from.y, from.z)
    .add(toDisplay(to.x, to.y, to.z))
    .multiplyScalar(0.5)
    .add(tooltipOffset);
  showTooltip(`<strong>${edge.id}</strong><span class="line">${from.id} ↔ ${to.id}</span>`, mid);
};

const updateHoverState = (event: MouseEvent) => {
  const rect = graphCanvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const edgeHits = raycaster.intersectObjects(Array.from(edgeHitMeshes.values()), false);
  const nodeHits = raycaster.intersectObjects(Array.from(nodeHitMeshes.values()), false);

  hoveredEdgeId = edgeHits.length ? (edgeHits[0].object as THREE.Mesh).userData.edgeId : null;
  hoveredNodeId = nodeHits.length ? (nodeHits[0].object as THREE.Mesh).userData.panelId : null;

  edgeButtonMeshes.forEach((mesh, id) => {
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.emissive.set(id === hoveredEdgeId ? 0xffef5a : 0x5a4a00);
  });

  nodeMeshes.forEach((mesh, id) => {
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.emissive.set(id === hoveredNodeId ? 0x60a5fa : 0x000000);
  });

  lastPointerMove = Date.now();

  if (hoveredNodeId) {
    updateTooltipForNode(hoveredNodeId);
  } else if (hoveredEdgeId) {
    updateTooltipForEdge(hoveredEdgeId);
  } else if (selectedNodeId) {
    updateTooltipForNode(selectedNodeId);
  } else if (selectedEdgeId) {
    updateTooltipForEdge(selectedEdgeId);
  } else {
    tooltip.classList.add("hidden");
  }
};

const render = () => {
  const time = performance.now() * 0.003;
  edgeButtonMeshes.forEach((mesh) => {
    const scale = 1 + Math.sin(time) * 0.15;
    mesh.scale.setScalar(scale);
  });
  nodeMeshes.forEach((mesh, id) => {
    const scale = 1 + Math.sin(time + id.length) * 0.15;
    mesh.scale.setScalar(scale);
  });
  const idle = Date.now() - lastPointerMove > 1000;
  const now = Date.now();
  if (idle && now - autoRotateLastSwitch > 4000) {
    autoRotateVelocity = new THREE.Vector3(
      0.0009,
      0.00012 + Math.random() * 0.0003,
      0.00012 + Math.random() * 0.0003
    );
    autoRotateLastSwitch = now;
  }
  autoRotatePhase += 0.01;
  const wobble = Math.sin(autoRotatePhase);
  const targetRamp = idle ? 1 : 1 / 3;
  autoRotateRamp += (targetRamp - autoRotateRamp) * 0.03;
  const rampEase = autoRotateRamp * autoRotateRamp * (3 - 2 * autoRotateRamp);
  const roll = autoRotateVelocity.x * rampEase;
  const yaw = autoRotateVelocity.y * 0.2 * wobble * rampEase;
  const pitch = autoRotateVelocity.z * 0.2 * Math.cos(autoRotatePhase) * rampEase;
  controls.autoRotate = false;
  graphControls.autoRotate = false;
  if (rampEase > 0.0001) {
    const target = controls.target.clone();
    const offset = camera.position.clone().sub(target);
    const rollAxis = new THREE.Vector3(0, 0, 1);
    const yawAxis = new THREE.Vector3(0, 1, 0);
    const pitchAxis = new THREE.Vector3(1, 0, 0);
    offset.applyAxisAngle(rollAxis, roll);
    offset.applyAxisAngle(yawAxis, yaw);
    offset.applyAxisAngle(pitchAxis, pitch);
    camera.position.copy(target.add(offset));
  }
  controls.update();
  graphControls.update();

  if (selectedNodeId) {
    updateTooltipForNode(selectedNodeId);
  } else if (selectedEdgeId) {
    updateTooltipForEdge(selectedEdgeId);
  }

  furnitureRenderer.render(furnitureScene, camera);
  graphRenderer.render(graphScene, camera);
  requestAnimationFrame(render);
};

const applyResize = () => {
  const panelId = (document.querySelector("#panelSelect") as HTMLSelectElement).value;
  const deltaW = Number((document.querySelector("#deltaW") as HTMLInputElement).value);
  const deltaH = Number((document.querySelector("#deltaH") as HTMLInputElement).value);
  propagateResize(sampleGraph, { panelId, deltaW, deltaH });
  updatePanels();
  updateGraphOverlay();
  rebuildFaceHighlights(selectedEdgeId);
};

const setupUI = () => {
  const select = document.querySelector<HTMLSelectElement>("#panelSelect");
  const button = document.querySelector<HTMLButtonElement>("#apply");
  const themeSelect = document.querySelector<HTMLSelectElement>("#themeSelect");
  if (!select || !button) return;
  select.innerHTML = sampleGraph.panels
    .map((panel) => `<option value="${panel.id}">${panel.id}</option>`)
    .join("");
  button.addEventListener("click", applyResize);
  if (themeSelect) {
    themeSelect.value = currentPaletteKey;
    themeSelect.addEventListener("change", () => {
      currentPaletteKey = themeSelect.value;
      updatePanels();
      updateGraphOverlay();
    });
  }
};

const resizeToCanvas = (canvas: HTMLCanvasElement, renderer: THREE.WebGLRenderer) => {
  const rect = canvas.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  return rect;
};

const onResize = () => {
  const rect = resizeToCanvas(furnitureCanvas, furnitureRenderer);
  resizeToCanvas(graphCanvas, graphRenderer);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
};

const fitCameraToPanels = () => {
  if (didFitCamera) return;
  const box = new THREE.Box3().setFromObject(panelGroup);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = (camera.fov * Math.PI) / 180;
  const distance = maxDim / (2 * Math.tan(fov / 2)) * 1.2;
  camera.position.set(center.x + distance, center.y + distance, center.z + distance);
  controls.target.copy(center);
  graphControls.target.copy(center);
  controls.update();
  graphControls.update();
  didFitCamera = true;
};

const toFaceSize = (panel: typeof sampleGraph.panels[number], side: string) => {
  if (side === "left" || side === "right") {
    return { w: sampleGraph.thickness, h: panel.height };
  }
  return { w: panel.width, h: sampleGraph.thickness };
};

const drawFaceOverlay = (edgeId: string) => {
  const edge = sampleGraph.edges.find((item) => item.id === edgeId);
  if (!edge) return;
  const panelA = sampleGraph.panels.find((p) => p.id === edge.faceA.panelId)!;
  const panelB = sampleGraph.panels.find((p) => p.id === edge.faceB.panelId)!;
  const ctx = overlayCanvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  const padding = 12;
  const sectionWidth = (overlayCanvas.width - padding * 3) / 2;
  const sectionHeight = overlayCanvas.height - padding * 2;

  const drawFace = (
    panel: typeof sampleGraph.panels[number],
    face: typeof edge.faceA,
    overlap: typeof edge.overlap.rectOnA,
    offsetX: number
  ) => {
    const faceSize = toFaceSize(panel, face.side);
    const scale = Math.min(sectionWidth / faceSize.w, sectionHeight / faceSize.h);
    const originX = offsetX + sectionWidth / 2;
    const originY = overlayCanvas.height / 2;

    const drawRect = (rect: { x: number; y: number; w: number; h: number }, color: string) => {
      const w = rect.w * scale;
      const h = rect.h * scale;
      ctx.fillStyle = color;
      ctx.fillRect(originX + rect.x * scale - w / 2, originY - rect.y * scale - h / 2, w, h);
    };

    drawRect({ x: 0, y: 0, w: faceSize.w, h: faceSize.h }, "#f8fafc");
    drawRect(overlap, "#22c55e");

    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      originX - (faceSize.w * scale) / 2,
      originY - (faceSize.h * scale) / 2,
      faceSize.w * scale,
      faceSize.h * scale
    );
  };

  drawFace(panelA, edge.faceA, edge.overlap.rectOnA, padding);
  drawFace(panelB, edge.faceB, edge.overlap.rectOnB, padding * 2 + sectionWidth);

  overlay.classList.remove("hidden");
};

const onGraphClick = (event: MouseEvent) => {
  updateHoverState(event);
  if (hoveredEdgeId) {
    drawFaceOverlay(hoveredEdgeId);
    selectedEdgeId = hoveredEdgeId;
    selectedNodeId = null;
    rebuildFaceHighlights(selectedEdgeId);
    return;
  }
  if (hoveredNodeId) {
    selectedNodeId = hoveredNodeId;
    selectedEdgeId = null;
    rebuildFaceHighlights(null);
    return;
  }
  selectedNodeId = null;
  selectedEdgeId = null;
  tooltip.classList.add("hidden");
  overlay.classList.add("hidden");
  rebuildFaceHighlights(null);
};

window.addEventListener("resize", onResize);
graphCanvas.addEventListener("click", onGraphClick);
graphCanvas.addEventListener("mousemove", updateHoverState);
overlayClose.addEventListener("click", () => overlay.classList.add("hidden"));
document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const inGraph = graphCanvas.contains(target) || overlay.contains(target) || tooltip.contains(target);
  if (!inGraph) {
    tooltip.classList.add("hidden");
    overlay.classList.add("hidden");
    selectedNodeId = null;
    selectedEdgeId = null;
    rebuildFaceHighlights(null);
  }
});
furnitureCanvas.addEventListener("mousemove", () => (lastPointerMove = Date.now()));
furnitureCanvas.addEventListener("wheel", () => (lastPointerMove = Date.now()));
graphCanvas.addEventListener("wheel", () => (lastPointerMove = Date.now()));

setupUI();
updatePanels();
updateGraphOverlay();
rebuildFaceHighlights(null);
onResize();
fitCameraToPanels();
render();
