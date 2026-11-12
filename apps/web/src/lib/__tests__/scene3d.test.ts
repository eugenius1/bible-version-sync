import { describe, expect, it } from "vitest";
import { cellAt, faces, fit, project, type Camera, type Cell, type Grid } from "../scene3d";

const GRID: Grid = { cols: 3, rows: 3, rise: 2, inset: 0.1 };
const PAD = { left: 10, right: 10, y: 10 };
const camera = (yaw: number, pitch = 0.6): Camera => ({ yaw, pitch, grow: 1 });
const bar = (col: number, row: number, value = 0): Cell => ({
  col, row, marked: false, band: 0, group: 0, parts: value ? [{ value, color: "ff0000" }] : [],
});
const middle = (points: number[]) => [0, 1].map((k) => (points[k] + points[k + 2] + points[k + 4] + points[k + 6]) / 4);

describe("fit", () => {
  it("keeps the ground and the tallest bar on the canvas however it's turned", () => {
    for (let yaw = 0; yaw < 7; yaw += 0.3) {
      for (const pitch of [0.3, 0.6, 1.3]) {
        const view = fit(GRID, camera(yaw, pitch), 300, 200, PAD);
        for (const x of [-1.5, 1.5]) {
          for (const z of [-1.5, 1.5]) {
            for (const y of [0, GRID.rise]) {
              const [px, py] = project(view, x, y, z);
              expect(px).toBeGreaterThanOrEqual(10 - 1e-9);
              expect(px).toBeLessThanOrEqual(290 + 1e-9);
              expect(py).toBeGreaterThanOrEqual(10 - 1e-9);
              expect(py).toBeLessThanOrEqual(190 + 1e-9);
            }
          }
        }
      }
    }
  });

  it("moves the grid over to leave room on one side", () => {
    expect(fit(GRID, camera(0), 300, 200, { left: 100, right: 0, y: 0 }).cx).toBe(200);
  });
});

describe("faces", () => {
  it("paints the ground first, then bars from the farthest to the nearest", () => {
    const cells = [bar(1, 2, 5), bar(1, 0, 5), bar(1, 1)];
    const list = faces(cells, fit(GRID, camera(0), 300, 200, PAD));
    expect(list.slice(0, 3).map((f) => f.color)).toEqual([null, null, null]);
    // Row 0 is at the back when the camera hasn't turned: two sides and a roof each.
    expect(list.slice(3).map((f) => f.cell)).toEqual([1, 1, 1, 0, 0, 0]);
    // Turned half way round, it's at the front.
    const turned = faces(cells, fit(GRID, camera(Math.PI), 300, 200, PAD));
    expect(turned.slice(3).map((f) => f.cell)).toEqual([0, 0, 0, 1, 1, 1]);
  });

  it("stacks a bar's parts, roofed in the last one's colour", () => {
    const cell: Cell = { col: 0, row: 0, marked: false, band: 0, group: 0, parts: [{ value: 1, color: "0000ff" }, { value: 3, color: "00ff00" }] };
    const view = fit({ ...GRID, cols: 1, rows: 1 }, camera(0.4), 300, 200, PAD);
    const list = faces([cell], view).slice(1);
    expect(list).toHaveLength(5);
    expect(list[4].color).toBe("rgb(0 255 0)");
    // The whole bar is as tall as `rise`: its roof sits that far above the ground.
    const [, roofY] = middle(list[4].points);
    expect(roofY).toBeCloseTo(project(view, 0, 2, 0)[1]);
    // Sides are shaded, so darker than the roof.
    expect(list[0].color).not.toBe("rgb(0 0 255)");
  });

  it("grows bars from nothing, and keeps a small one visible beside a tall one", () => {
    const view = fit(GRID, camera(0), 300, 200, PAD);
    const height = (grow: number) => {
      // The small bar is in front of the tall one, so its roof is painted last.
      const roof = faces([bar(1, 1, 1), bar(0, 0, 1000)], { ...view, grow }).at(-1)!;
      return project(view, 0, 0, 0)[1] - middle(roof.points)[1];
    };
    expect(height(0)).toBeCloseTo(0);
    expect(height(1)).toBeGreaterThan(view.scale * 0.2);
  });
});

describe("cellAt", () => {
  const cells = [bar(1, 0, 10), bar(1, 2, 10), bar(0, 1)];
  const view = fit(GRID, camera(0, 0.4), 300, 200, PAD);
  const list = faces(cells, view);

  it("finds the bar under a point, the nearer one where two overlap", () => {
    // Half way up the front bar, which hides the foot of the one behind it.
    const [x, y] = project(view, 0, 1, 1.4);
    expect(cellAt(list, x, y)).toBe(1);
    const [bx, by] = project(view, 0, 2, -1);
    expect(cellAt(list, bx, by)).toBe(0);
  });

  it("finds bare ground, and nothing off the grid", () => {
    const [x, y] = project(view, -1, 0, 0);
    expect(cellAt(list, x, y)).toBe(2);
    expect(cellAt(list, 1, 1)).toBe(-1);
  });
});
