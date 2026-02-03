import type { Graph, Rect } from "./graph";

const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

export const sampleGraph: Graph = {
  thickness: 10,
  panels: [
    {
      id: "top",
      width: 280,
      height: 300,
      x: 0,
      y: 0,
      z: 145,
      rotation: [Math.PI / 2, 0, 0]
    },
    {
      id: "bottom",
      width: 280,
      height: 300,
      x: 0,
      y: 0,
      z: -145,
      rotation: [Math.PI / 2, 0, 0]
    },
    {
      id: "left",
      width: 300,
      height: 300,
      x: -145,
      y: 0,
      z: 0,
      rotation: [0, Math.PI / 2, 0]
    },
    {
      id: "right",
      width: 300,
      height: 300,
      x: 145,
      y: 0,
      z: 0,
      rotation: [0, Math.PI / 2, 0]
    },
    {
      id: "back",
      width: 280,
      height: 280,
      x: 0,
      y: -145,
      z: 0
    }
  ],
  edges: [
    {
      id: "top-left",
      faceA: { panelId: "top", side: "bottom", rect: rect(-140, 0, 10, 300) },
      faceB: { panelId: "left", side: "top", rect: rect(0, 145, 300, 10) },
      overlap: {
        rectOnA: rect(-140, 0, 10, 300),
        rectOnB: rect(0, 145, 300, 10)
      }
    },
    {
      id: "top-right",
      faceA: { panelId: "top", side: "bottom", rect: rect(140, 0, 10, 300) },
      faceB: { panelId: "right", side: "top", rect: rect(0, 145, 300, 10) },
      overlap: {
        rectOnA: rect(140, 0, 10, 300),
        rectOnB: rect(0, 145, 300, 10)
      }
    },
    {
      id: "bottom-left",
      faceA: { panelId: "bottom", side: "top", rect: rect(-140, 0, 10, 300) },
      faceB: { panelId: "left", side: "bottom", rect: rect(0, -145, 300, 10) },
      overlap: {
        rectOnA: rect(-140, 0, 10, 300),
        rectOnB: rect(0, -145, 300, 10)
      }
    },
    {
      id: "bottom-right",
      faceA: { panelId: "bottom", side: "top", rect: rect(140, 0, 10, 300) },
      faceB: { panelId: "right", side: "bottom", rect: rect(0, -145, 300, 10) },
      overlap: {
        rectOnA: rect(140, 0, 10, 300),
        rectOnB: rect(0, -145, 300, 10)
      }
    },
    {
      id: "back-left",
      propagate: false,
      faceA: { panelId: "back", side: "left", rect: rect(-140, 0, 10, 280) },
      faceB: { panelId: "left", side: "right", rect: rect(0, 0, 10, 280) },
      overlap: {
        rectOnA: rect(-140, 0, 10, 280),
        rectOnB: rect(0, 0, 10, 280)
      }
    },
    {
      id: "back-right",
      propagate: false,
      faceA: { panelId: "back", side: "right", rect: rect(140, 0, 10, 280) },
      faceB: { panelId: "right", side: "left", rect: rect(0, 0, 10, 280) },
      overlap: {
        rectOnA: rect(140, 0, 10, 280),
        rectOnB: rect(0, 0, 10, 280)
      }
    },
    {
      id: "back-top",
      propagate: false,
      faceA: { panelId: "back", side: "top", rect: rect(0, 140, 280, 10) },
      faceB: { panelId: "top", side: "bottom", rect: rect(0, 140, 280, 10) },
      overlap: {
        rectOnA: rect(0, 140, 280, 10),
        rectOnB: rect(0, 140, 280, 10)
      }
    },
    {
      id: "back-bottom",
      propagate: false,
      faceA: { panelId: "back", side: "bottom", rect: rect(0, -140, 280, 10) },
      faceB: { panelId: "bottom", side: "top", rect: rect(0, -140, 280, 10) },
      overlap: {
        rectOnA: rect(0, -140, 280, 10),
        rectOnB: rect(0, -140, 280, 10)
      }
    }
  ]
};
