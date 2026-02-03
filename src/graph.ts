export type Panel = {
  id: string;
  width: number;
  height: number;
  x: number;
  y: number;
  z: number;
  rotation?: [number, number, number];
};

export type FaceSide = "left" | "right" | "top" | "bottom";

export type Rect = {
  /** Center position relative to the panel center. */
  x: number;
  y: number;
  w: number;
  h: number;
};

export type FaceRect = {
  panelId: string;
  side: FaceSide;
  rect: Rect;
};

export type Edge = {
  id: string;
  faceA: FaceRect;
  faceB: FaceRect;
  /** If false, edge is for visualization only. */
  propagate?: boolean;
  overlap: {
    rectOnA: Rect;
    rectOnB: Rect;
  };
};

export type Graph = {
  thickness: number;
  panels: Panel[];
  edges: Edge[];
};

export type ResizeDelta = {
  panelId: string;
  deltaW: number;
  deltaH: number;
};

const EPS = 1e-6;

export const getPanel = (graph: Graph, id: string): Panel => {
  const panel = graph.panels.find((item) => item.id === id);
  if (!panel) {
    throw new Error(`Panel not found: ${id}`);
  }
  return panel;
};

export const getEdgesForPanel = (graph: Graph, panelId: string): Edge[] =>
  graph.edges.filter(
    (edge) => edge.faceA.panelId === panelId || edge.faceB.panelId === panelId
  );

const getOverlapAxis = (side: FaceSide): "x" | "y" =>
  side === "left" || side === "right" ? "y" : "x";

const getRectLength = (rect: Rect, axis: "x" | "y"): number =>
  axis === "x" ? rect.w : rect.h;

const resizeRect = (rect: Rect, axis: "x" | "y", delta: number) => {
  if (axis === "x") rect.w += delta;
  else rect.h += delta;
};

const getRectCenter = (rect: Rect) => ({ x: rect.x, y: rect.y });

const alignPanels = (
  panelA: Panel,
  faceA: FaceRect,
  overlapA: Rect,
  panelB: Panel,
  faceB: FaceRect,
  overlapB: Rect
) => {
  const overlapCenterA = getRectCenter(overlapA);
  const overlapCenterB = getRectCenter(overlapB);
  const overlapX = Math.min(overlapA.w, overlapB.w);
  const overlapY = Math.min(overlapA.h, overlapB.h);

  if (faceA.side === "right" && faceB.side === "left") {
    panelB.x = panelA.x + panelA.width / 2 + panelB.width / 2 - overlapX;
    panelB.y = panelA.y + (overlapCenterA.y - overlapCenterB.y);
    return;
  }

  if (faceA.side === "left" && faceB.side === "right") {
    panelB.x = panelA.x - panelA.width / 2 - panelB.width / 2 + overlapX;
    panelB.y = panelA.y + (overlapCenterA.y - overlapCenterB.y);
    return;
  }

  if (faceA.side === "top" && faceB.side === "bottom") {
    panelB.y = panelA.y + panelA.height / 2 + panelB.height / 2 - overlapY;
    panelB.x = panelA.x + (overlapCenterA.x - overlapCenterB.x);
    return;
  }

  if (faceA.side === "bottom" && faceB.side === "top") {
    panelB.y = panelA.y - panelA.height / 2 - panelB.height / 2 + overlapY;
    panelB.x = panelA.x + (overlapCenterA.x - overlapCenterB.x);
  }
};

const computeRatio = (selfRect: Rect, otherRect: Rect, axis: "x" | "y") => {
  const lengthSelf = getRectLength(selfRect, axis);
  const lengthOther = getRectLength(otherRect, axis);
  if (Math.abs(lengthSelf) < EPS) return 1;
  return lengthOther / lengthSelf;
};

export const propagateResize = (graph: Graph, initial: ResizeDelta) => {
  const queue: ResizeDelta[] = [initial];
  const visited = new Set<string>();

  while (queue.length) {
    const { panelId, deltaW, deltaH } = queue.shift()!;
    const panel = getPanel(graph, panelId);

    panel.width += deltaW;
    panel.height += deltaH;

    const edges = getEdgesForPanel(graph, panelId);
    edges.forEach((edge) => {
      if (edge.propagate === false) {
        return;
      }
      const isA = edge.faceA.panelId === panelId;
      const faceSelf = isA ? edge.faceA : edge.faceB;
      const faceOther = isA ? edge.faceB : edge.faceA;
      const overlapSelf = isA ? edge.overlap.rectOnA : edge.overlap.rectOnB;
      const overlapOther = isA ? edge.overlap.rectOnB : edge.overlap.rectOnA;
      const otherPanel = getPanel(graph, faceOther.panelId);

  const axis = getOverlapAxis(faceSelf.side);
  const ratio = computeRatio(overlapSelf, overlapOther, axis);

      if (axis === "x") {
        resizeRect(overlapSelf, axis, deltaW);
        const otherDelta = deltaW * ratio;
        resizeRect(overlapOther, axis, otherDelta);
        if (Math.abs(otherDelta) > EPS && !visited.has(otherPanel.id)) {
          queue.push({ panelId: otherPanel.id, deltaW: otherDelta, deltaH: 0 });
        }
      } else {
        resizeRect(overlapSelf, axis, deltaH);
        const otherDelta = deltaH * ratio;
        resizeRect(overlapOther, axis, otherDelta);
        if (Math.abs(otherDelta) > EPS && !visited.has(otherPanel.id)) {
          queue.push({ panelId: otherPanel.id, deltaW: 0, deltaH: otherDelta });
        }
      }

      alignPanels(panel, faceSelf, overlapSelf, otherPanel, faceOther, overlapOther);
    });

    visited.add(panelId);
  }
};
