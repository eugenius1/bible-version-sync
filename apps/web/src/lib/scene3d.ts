/**
 * The geometry of the stats page's 3D charts: bars standing on a grid of
 * cells, seen from above at an angle, and turned and zoomed by hand.
 *
 * It's a few dozen lines of projection onto a 2D canvas rather than a 3D
 * library because one (three.js, tree-shaken) would make the app's JavaScript
 * more than half as big again, for boxes on a grid. The projection is
 * orthographic (no vanishing point), so a bar's height on screen is the same
 * wherever it stands and heights can be compared across the grid.
 */

/** One slab of a bar: `value` in the chart's units, `color` as "rrggbb". */
export interface Part {
  value: number;
  color: string;
}

export interface Cell {
  col: number;
  row: number;
  /** Stacked from the ground up; none for bare ground. */
  parts: readonly Part[];
  /** Whether its ground tile is the darker kind. */
  marked: boolean;
  /** Stretches of cells take two shades of ground in turn, by whether this is odd or even. */
  band: number;
  /** Cells whose ground lights up together under the pointer (a book's chapters). */
  group: number;
}

export interface Grid {
  cols: number;
  rows: number;
  /** How tall the tallest bar stands, in cells. */
  rise: number;
  /** The gap on each side of a bar, as a share of its cell. */
  inset: number;
}

export interface Camera {
  /** Turn about the vertical axis, in radians. */
  yaw: number;
  /** How far above the horizon the camera is, in radians: π/2 looks straight down. */
  pitch: number;
  /** How many times bigger than what fits the canvas: 1 shows the whole grid. */
  zoom: number;
  /** How far the picture has been moved from where it fits, as a share of the canvas's width and height. */
  panX: number;
  panY: number;
  /** 0 to 1: how far the bars have grown, for the opening animation. */
  grow: number;
}

export interface View extends Grid, Camera {
  /** Pixels per cell. */
  scale: number;
  /** Where the middle of the ground lands, in pixels. */
  cx: number;
  cy: number;
}

export interface Face {
  /** Four corners in pixels: x0, y0, x1, y1… */
  points: number[];
  /** Index of the cell it belongs to. */
  cell: number;
  /** A bar's face, shaded, as a CSS colour; null for a ground tile, painted by tone. */
  color: string | null;
}

/** A bar with any value stays visible beside a far taller one. */
const MIN_HEIGHT = 0.3;
const GROUND_INSET = 0.04;
/** Where the light comes from, across the screen and towards the viewer. */
const LIGHT = [-0.5, 0.866];
/** Enough to read one chapter among 1,189 on a phone. */
export const MAX_ZOOM = 8;

export const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

/** Pixels kept clear round the grid: `y` above and below it. */
export interface Padding {
  left: number;
  right: number;
  y: number;
}

/**
 * The scale and centre that keep the grid inside `width` × `height`, less the
 * padding, however it's turned: the ground's diagonal is what a turn sweeps out.
 * The camera's zoom then enlarges that about the middle, and its pan moves it.
 */
export function fit(grid: Grid, camera: Camera, width: number, height: number, pad: Padding): View {
  const radius = Math.hypot(grid.cols, grid.rows) / 2;
  const below = radius * Math.sin(camera.pitch);
  const above = below + grid.rise * Math.cos(camera.pitch);
  const room = width - pad.left - pad.right;
  const scale = Math.max(0, Math.min(room / (2 * radius), (height - 2 * pad.y) / (above + below))) * camera.zoom;
  return {
    ...grid,
    ...camera,
    scale,
    cx: pad.left + room / 2 + camera.panX * width,
    cy: (height + (above - below) * scale) / 2 + camera.panY * height,
  };
}

/** The place on the ground under a pixel, as the x and z that `project` takes. */
export function ground(v: View, px: number, py: number): [number, number] {
  const sin = Math.sin(v.yaw);
  const cos = Math.cos(v.yaw);
  const across = (px - v.cx) / v.scale;
  const away = (py - v.cy) / (v.scale * Math.sin(v.pitch));
  return [across * cos + away * sin, away * cos - across * sin];
}

/**
 * The camera with `change` made to it, moved so that what was on the ground
 * under the pixel `from` is under `to`: the picture stays with the pointer as
 * it zooms, and turns about whatever is there. `view` is `fit` for the canvas,
 * `width` by `height`. The zoom stays between 1 and `MAX_ZOOM`, and the pan
 * within what keeps the picture over the place it has when the whole of it
 * shows, so zoomed back out it's where it fits again.
 */
export function held(
  view: (camera: Camera) => View,
  width: number,
  height: number,
  camera: Camera,
  change: Partial<Camera>,
  from: readonly number[],
  to: readonly number[],
): Camera {
  const before = view(camera);
  if (!before.scale) return camera;
  const [x, z] = ground(before, from[0], from[1]);
  const next = { ...camera, ...change, panX: 0, panY: 0 };
  next.zoom = clamp(next.zoom, 1, MAX_ZOOM);
  const after = view(next);
  const [px, py] = project(after, x, 0, z);
  // The picture's own width and height, which `fit` keeps about the same middle at every zoom, and not the
  // canvas's: a grid far narrower than its canvas would otherwise have room to be carried right off it.
  const sin = Math.abs(Math.sin(after.yaw));
  const cos = Math.abs(Math.cos(after.yaw));
  const wide = (after.cols * cos + after.rows * sin) * after.scale;
  const tall = ((after.cols * sin + after.rows * cos) * Math.sin(after.pitch) + after.rise * Math.cos(after.pitch)) * after.scale;
  const spare = (1 - 1 / next.zoom) / 2;
  const reachX = (wide * spare) / width;
  const reachY = (tall * spare) / height;
  next.panX = clamp((to[0] - px) / width, -reachX, reachX);
  next.panY = clamp((to[1] - py) / height, -reachY, reachY);
  return next;
}

/** A point on the grid (x across, y up, z towards the front row; in cells from the middle) to pixels. */
export function project(v: View, x: number, y: number, z: number): [number, number] {
  const sin = Math.sin(v.yaw);
  const cos = Math.cos(v.yaw);
  return [v.cx + v.scale * (x * cos - z * sin), v.cy + v.scale * ((x * sin + z * cos) * Math.sin(v.pitch) - y * Math.cos(v.pitch))];
}

const shade = (hex: string, k: number) =>
  `rgb(${[0, 2, 4].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k)).join(" ")})`;

/**
 * Everything to paint, in painting order: the ground, then the bars from the
 * farthest to the nearest, so a nearer bar covers what's behind it.
 */
export function faces(cells: readonly Cell[], v: View): Face[] {
  const sin = Math.sin(v.yaw);
  const cos = Math.cos(v.yaw);
  // This runs on every frame of a turn, over thousands of faces, so it projects
  // each square once and lifts its corners straight up for the faces above it:
  // with no vanishing point, height only ever moves a point up the screen.
  const flat = Math.sin(v.pitch) * v.scale;
  const lift = Math.cos(v.pitch) * v.scale;
  /** A square on the ground about (x, z) in pixels: far left, far right, near right, near left. */
  const square = (x: number, z: number, h: number) => {
    const points: number[] = [];
    for (const [dx, dz] of [[-h, -h], [h, -h], [h, h], [-h, h]]) {
      points.push(v.cx + v.scale * ((x + dx) * cos - (z + dz) * sin), v.cy + flat * ((x + dx) * sin + (z + dz) * cos));
    }
    return points;
  };
  /** The wall standing on the edge between corners `a` and `b` of a square, from height `y` to `top`. */
  const wall = (foot: number[], a: number, b: number, y: number, top: number) => [
    foot[a * 2], foot[a * 2 + 1] - y * lift, foot[b * 2], foot[b * 2 + 1] - y * lift,
    foot[b * 2], foot[b * 2 + 1] - top * lift, foot[a * 2], foot[a * 2 + 1] - top * lift,
  ];
  const middle = (c: Cell): [number, number] => [c.col - (v.cols - 1) / 2, c.row - (v.rows - 1) / 2];

  const out: Face[] = cells.map((c, cell) => ({ cell, color: null, points: square(...middle(c), 0.5 - GROUND_INSET) }));

  // Of each bar's four sides, the two turned towards the camera.
  const signX = sin > 0 ? 1 : -1;
  const signZ = cos > 0 ? 1 : -1;
  const sideX = signX > 0 ? [1, 2] : [0, 3];
  const sideZ = signZ > 0 ? [3, 2] : [0, 1];
  const lit = (nx: number, nz: number) => 0.56 + 0.32 * Math.max(0, nx * LIGHT[0] + nz * LIGHT[1]);
  const shadeX = lit(signX * cos, signX * sin);
  const shadeZ = lit(signZ * -sin, signZ * cos);
  // A handful of colours make all the faces: each one's three shades are worked out once.
  const shades = new Map<string, [string, string, string]>();
  const shaded = (hex: string) => {
    let s = shades.get(hex);
    if (!s) shades.set(hex, (s = [shade(hex, shadeX), shade(hex, shadeZ), shade(hex, 1)]));
    return s;
  };

  const standing = cells
    .map((c, cell) => {
      const [x, z] = middle(c);
      return { c, cell, x, z, depth: x * sin + z * cos, total: c.parts.reduce((n, p) => n + p.value, 0) };
    })
    .filter((bar) => bar.total > 0);
  const max = standing.reduce((n, bar) => Math.max(n, bar.total), 0);
  standing.sort((a, b) => a.depth - b.depth);
  for (const { c, cell, x, z, total } of standing) {
    const foot = square(x, z, 0.5 - v.inset);
    const height = Math.max((total / max) * v.rise, MIN_HEIGHT) * v.grow;
    let y = 0;
    for (const part of c.parts) {
      const top = y + (part.value / total) * height;
      const [colorX, colorZ] = shaded(part.color);
      out.push({ cell, color: colorX, points: wall(foot, sideX[0], sideX[1], y, top) });
      out.push({ cell, color: colorZ, points: wall(foot, sideZ[0], sideZ[1], y, top) });
      y = top;
    }
    out.push({ cell, color: shaded(c.parts[c.parts.length - 1].color)[2], points: foot.map((p, k) => (k % 2 ? p - y * lift : p)) });
  }
  return out;
}

/** The cell under a point: the nearest face that covers it, or -1. */
export function cellAt(list: readonly Face[], x: number, y: number): number {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i].points;
    let sign = 0;
    let inside = true;
    for (let k = 0; k < 8 && inside; k += 2) {
      const cross = (p[(k + 2) % 8] - p[k]) * (y - p[k + 1]) - (p[(k + 3) % 8] - p[k + 1]) * (x - p[k]);
      if (cross !== 0) {
        if (sign === 0) sign = Math.sign(cross);
        else if (Math.sign(cross) !== sign) inside = false;
      }
    }
    if (inside) return list[i].cell;
  }
  return -1;
}
