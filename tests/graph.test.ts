import { describe, expect, it } from "vitest";
import { propagateResize, type Graph } from "../src/graph";

const makeGraph = (): Graph => ({
  thickness: 18,
  panels: [
    { id: "A", width: 100, height: 30, x: 0, y: 0, z: 0 },
    { id: "B", width: 20, height: 30, x: 60, y: 0, z: 0 }
  ],
  edges: [
    {
      id: "A-B",
      faceA: { panelId: "A", side: "right", rect: { x: 50, y: 0, w: 0, h: 30 } },
      faceB: { panelId: "B", side: "left", rect: { x: -10, y: 0, w: 0, h: 30 } },
      overlap: {
        rectOnA: { x: 50, y: 0, w: 0, h: 30 },
        rectOnB: { x: -10, y: 0, w: 0, h: 30 }
      }
    }
  ]
});

describe("propagateResize", () => {
  it("moves adjacent panel when width changes", () => {
    const graph = makeGraph();
    propagateResize(graph, { panelId: "A", deltaW: 20, deltaH: 0 });
    const panelB = graph.panels.find((p) => p.id === "B")!;
    expect(panelB.x).toBe(70);
  });

  it("scales overlap on height change", () => {
    const graph = makeGraph();
    propagateResize(graph, { panelId: "A", deltaW: 0, deltaH: 10 });
    const panelB = graph.panels.find((p) => p.id === "B")!;
    expect(panelB.height).toBe(40);
  });
});
