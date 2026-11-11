import { useEffect, useRef } from "react";
import { cellAt, faces, fit, project, type Camera, type Cell, type Face } from "../lib/scene3d";

interface Props {
  cols: number;
  rows: number;
  cells: readonly Cell[];
  /** What the pointer says about a cell, by its index in `cells`. */
  describe: (cell: number) => string;
  /** The chart's name, for screen readers; the page gives the figures as text elsewhere. */
  label: string;
  /** Canvas height over its width. */
  aspect: number;
  /** A name per row, written beside the ground. */
  rowLabels?: readonly string[];
  /** Names for the first and the last cell, written at their corners. */
  ends?: readonly [string, string];
  /** The gap on each side of a bar, as a share of its cell. */
  inset?: number;
  /** Where the camera starts, in radians. */
  yaw?: number;
}

/** Stone, as hex: a canvas can't take Tailwind's classes. Ground is [plain, plain, marked, marked], each pair for the two bands. */
const INK = {
  light: { ground: ["#f1f0ee", "#e9e7e4", "#d6d3d1", "#c9c5c2"], lit: "#a8a29e", edge: "rgb(0 0 0 / 0.32)", hover: "#1c1917", text: "#57534e" },
  dark: { ground: ["#2e2a27", "#373230", "#5c5651", "#6b645e"], lit: "#a8a29e", edge: "rgb(0 0 0 / 0.45)", hover: "#fafaf9", text: "#a8a29e" },
};

const MIN_PITCH = 0.3;
const MAX_PITCH = 1.3;
const START_PITCH = 0.62;
const tilted = (pitch: number) => Math.min(Math.max(pitch, MIN_PITCH), MAX_PITCH);
/** The opening: the bars rise while the camera swings round to its place. */
const INTRO_MS = 1100;
const INTRO_SWING = 0.5;
/** What an arrow key adds to the camera's [yaw, pitch]. */
const TURNS: Record<string, [number, number] | undefined> = {
  ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, 0.08], ArrowDown: [0, -0.08],
};
const FONT = "11px ui-sans-serif, system-ui, sans-serif";
/** Row names closer together than this are thinned out. */
const LABEL_GAP = 9;

/**
 * Bars on a grid, in 3D, on a canvas: drag (or the arrow keys) to turn it,
 * point at a bar to read it. Decoration for screen readers, which get `label`.
 */
export function Scene3D(props: Props) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  // The canvas is set up once and paints from the latest props, so a change of
  // language or data repaints without replaying the opening.
  const latest = useRef(props);
  const repaint = useRef<() => void>(undefined);
  useEffect(() => {
    latest.current = props;
    repaint.current?.();
  });

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || !box.current) return;
    const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animate = !still && typeof IntersectionObserver === "function";
    const home = latest.current.yaw ?? -0.5;
    const camera: Camera = { yaw: animate ? home - INTRO_SWING : home, pitch: START_PITCH, grow: animate ? 0 : 1 };
    let width = 0;
    let height = 0;
    let painted: Face[] = [];
    let hover = -1;
    let frame = 0;
    let intro = 0;
    let drag: { id: number; x: number; y: number; yaw: number; pitch: number; moved: boolean } | null = null;

    const paint = () => {
      // Painting now makes a frame already asked for redundant.
      cancelAnimationFrame(frame);
      frame = 0;
      if (!width) return;
      const p = latest.current;
      const ink = document.documentElement.classList.contains("dark") ? INK.dark : INK.light;
      // Row names always go on the left, so the grid doesn't jump sideways as it turns.
      const pad = { left: p.rowLabels ? Math.min(100, width * 0.3) : 6, right: 6, y: 18 };
      const grid = { cols: p.cols, rows: p.rows, rise: Math.max(p.cols, p.rows) * 0.26, inset: p.inset ?? 0.14 };
      const view = fit(grid, camera, width, height, pad);
      painted = faces(p.cells, view);
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.lineJoin = "round";
      const group = hover >= 0 ? p.cells[hover].group : -1;
      for (const f of painted) {
        const cell = p.cells[f.cell];
        ctx.beginPath();
        ctx.moveTo(f.points[0], f.points[1]);
        for (let k = 2; k < 8; k += 2) ctx.lineTo(f.points[k], f.points[k + 1]);
        ctx.closePath();
        ctx.fillStyle = f.color ?? (cell.group === group ? ink.lit : ink.ground[(cell.marked ? 2 : 0) + (cell.band % 2)]);
        ctx.fill();
        if (f.color) {
          ctx.strokeStyle = f.cell === hover ? ink.hover : ink.edge;
          ctx.lineWidth = f.cell === hover ? 1.5 : 0.5;
          ctx.stroke();
        }
      }

      ctx.font = FONT;
      ctx.fillStyle = ink.text;
      ctx.textBaseline = "middle";
      const sin = Math.sin(camera.yaw);
      const cos = Math.cos(camera.yaw);
      if (p.rowLabels) {
        // At whichever end of the rows is on the left; thinned out where rows crowd, as when they run away from the camera.
        const end = cos >= 0 ? -1 : 1;
        const gap = Math.abs(cos * Math.sin(camera.pitch) * view.scale);
        const every = Math.ceil(LABEL_GAP / Math.max(gap, 0.01));
        ctx.textAlign = "right";
        for (let r = 0; r < p.rows && r < p.rowLabels.length; r += every) {
          const [x, y] = project(view, end * (p.cols / 2 + 0.3), 0, r - (p.rows - 1) / 2);
          ctx.fillText(clipped(ctx, p.rowLabels[r], x - 8), x - 6, y);
        }
      }
      if (p.ends) {
        const half = [p.cols / 2, p.rows / 2];
        const ground = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => project(view, x * half[0], 0, z * half[1]));
        [ground[0], ground[2]].forEach(([x], i) => {
          // Not at the far corner, where the name would sit a whole ground away from it.
          const side = i === 0 ? -1 : 1;
          if (side * sin < 0 && side * cos < 0) return;
          const text = p.ends![i];
          const w = ctx.measureText(text).width;
          const left = Math.min(Math.max(x - w / 2, 4), width - 4 - w);
          ctx.textAlign = "left";
          ctx.fillText(text, left, lowest(ground, left, left + w) + 11);
        });
      }
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(paint);
    };
    repaint.current = schedule;

    const resize = () => {
      const p = latest.current;
      if (!box.current) return;
      width = box.current.clientWidth;
      height = Math.round(Math.max(width * p.aspect, 240));
      const dpr = window.devicePixelRatio || 1;
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
      el.style.height = `${height}px`;
      paint();
    };
    const sized = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
    sized?.observe(box.current);
    resize();

    // Dark mode is a class on <html>, which the canvas can't inherit.
    const themed = new MutationObserver(schedule);
    themed.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const settle = () => {
      cancelAnimationFrame(intro);
      intro = 0;
      seen?.disconnect();
      camera.grow = 1;
    };
    const seen = animate
      ? new IntersectionObserver(
          ([entry]) => {
            if (!entry.isIntersecting) return;
            seen?.disconnect();
            const from = performance.now();
            const step = (now: number) => {
              const k = Math.min((now - from) / INTRO_MS, 1);
              const eased = 1 - (1 - k) ** 3;
              camera.grow = eased;
              camera.yaw = home - INTRO_SWING * (1 - eased);
              paint();
              intro = k < 1 ? requestAnimationFrame(step) : 0;
            };
            intro = requestAnimationFrame(step);
          },
          { threshold: 0.25 },
        )
      : null;
    seen?.observe(el);

    const at = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const point = (e: PointerEvent) => {
      const [x, y] = at(e);
      const next = cellAt(painted, x, y);
      const bubble = tip.current;
      if (bubble) {
        bubble.hidden = next < 0;
        if (next >= 0) {
          bubble.textContent = latest.current.describe(next);
          bubble.style.left = `${Math.min(Math.max(x, 72), Math.max(width - 72, 72))}px`;
          bubble.style.top = `${Math.max(y - 14, 30)}px`;
        }
      }
      if (next !== hover) {
        hover = next;
        schedule();
      }
    };
    const clear = () => {
      if (tip.current) tip.current.hidden = true;
      if (hover !== -1) {
        hover = -1;
        schedule();
      }
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      settle();
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: camera.yaw, pitch: camera.pitch, moved: false };
      el.setPointerCapture(e.pointerId);
      schedule();
    };
    const move = (e: PointerEvent) => {
      if (!drag) {
        if (e.pointerType === "mouse") point(e);
        return;
      }
      if (e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      if (!drag.moved) clear();
      drag.moved = true;
      camera.yaw = drag.yaw + dx * 0.01;
      // A finger's vertical movement scrolls the page (touch-action), so only a mouse tilts.
      if (e.pointerType !== "touch") camera.pitch = tilted(drag.pitch + dy * 0.006);
      schedule();
    };
    const up = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const tapped = !drag.moved;
      drag = null;
      // A tap is how a finger points.
      if (tapped && e.type === "pointerup") point(e);
    };
    const leave = () => {
      if (!drag) clear();
    };
    const key = (e: KeyboardEvent) => {
      const turn = TURNS[e.key];
      if (!turn) return;
      e.preventDefault();
      settle();
      clear();
      camera.yaw += turn[0];
      camera.pitch = tilted(camera.pitch + turn[1]);
      schedule();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("keydown", key);
    return () => {
      repaint.current = undefined;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(intro);
      sized?.disconnect();
      themed.disconnect();
      seen?.disconnect();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("keydown", key);
    };
  }, []);

  return (
    <div ref={box} className="relative">
      <canvas
        ref={canvas}
        role="img"
        aria-label={props.label}
        tabIndex={0}
        className="block w-full cursor-grab touch-pan-y rounded-xl select-none active:cursor-grabbing
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:focus-visible:outline-amber-500"
      />
      <div
        ref={tip}
        hidden
        className="pointer-events-none absolute z-10 w-max max-w-64 -translate-x-1/2 -translate-y-full rounded-lg bg-stone-900 px-2.5 py-1 text-center text-xs text-white shadow-md
          dark:bg-stone-100 dark:text-stone-900"
      />
    </div>
  );
}

/** How far down the screen a convex outline reaches between two x positions. */
function lowest(outline: [number, number][], from: number, to: number): number {
  let y = -Infinity;
  outline.forEach(([ax, ay], i) => {
    const [bx, by] = outline[(i + 1) % outline.length];
    if (ax >= from && ax <= to) y = Math.max(y, ay);
    for (const x of [from, to]) {
      if (ax !== bx && x >= Math.min(ax, bx) && x <= Math.max(ax, bx)) y = Math.max(y, ay + ((x - ax) / (bx - ax)) * (by - ay));
    }
  });
  return y;
}

/** `text`, cut short with an ellipsis when it's wider than `room` pixels. */
function clipped(ctx: CanvasRenderingContext2D, text: string, room: number): string {
  if (ctx.measureText(text).width <= room) return text;
  let cut = text.length;
  while (cut > 1 && ctx.measureText(`${text.slice(0, cut)}…`).width > room) cut--;
  return `${text.slice(0, cut).trimEnd()}…`;
}
