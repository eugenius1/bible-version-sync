import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { cellAt, clamp, faces, fit, held, project, type Camera, type Cell, type Face } from "../lib/scene3d";

interface Props {
  cols: number;
  rows: number;
  cells: readonly Cell[];
  /** A cell's figures as a sentence, by its index in `cells`: what the pointer says, and its line in the list. */
  describe: (cell: number) => string;
  /** The chart's name, for screen readers. */
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
const tilted = (pitch: number) => clamp(pitch, MIN_PITCH, MAX_PITCH);
/** The opening: the bars rise while the camera swings round to its place. */
const INTRO_MS = 1100;
const INTRO_SWING = 0.5;
/** What an arrow key adds to the camera's [yaw, pitch]. */
const TURNS: Record<string, [number, number] | undefined> = {
  ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, 0.08], ArrowDown: [0, -0.08],
};
const ZOOM_STEP = 1.5;
/** What a key multiplies the zoom by. */
const ZOOMS: Record<string, number | undefined> = { "+": ZOOM_STEP, "=": ZOOM_STEP, "-": 1 / ZOOM_STEP };
/** Zooming out, a zoom under this is as good as none. */
const WHOLE = 1.1;
/** How far, in pixels, an arrow key with Shift moves the picture. */
const NUDGE = 40;
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:focus-visible:outline-amber-500";
const BUTTON = "btn-secondary size-8 min-h-0 rounded-lg px-0 text-stone-600 dark:text-stone-400";
const FONT = "11px ui-sans-serif, system-ui, sans-serif";
/** Row names closer together than this are thinned out. */
const LABEL_GAP = 9;
/** A row name with less room than this, in pixels, is left out: it would be all ellipsis. */
const LABEL_ROOM = 16;

/**
 * Bars on a grid, in 3D, on a canvas: drag (or the arrow keys) to turn it,
 * pinch (or Ctrl and the wheel, the buttons, + and -) to zoom, point at a bar
 * to read it. A canvas says nothing to a screen reader beyond `label` and has
 * nothing for the keyboard to point with, so the same figures can be opened as
 * a list under it.
 */
export function Scene3D(props: Props) {
  const { t } = useI18n();
  const [listed, setListed] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  // The canvas is set up once and paints from the latest props, so a change of
  // language or data repaints without replaying the opening.
  const latest = useRef(props);
  const repaint = useRef<() => void>(undefined);
  /** The buttons' way to the camera, which lives in the effect below. */
  const controls = useRef<{ zoom: (by: number) => void; reset: () => void }>(undefined);
  useEffect(() => {
    latest.current = props;
    repaint.current?.();
  });

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animate = !still && typeof IntersectionObserver === "function";
    const home = latest.current.yaw ?? -0.5;
    const camera: Camera = { yaw: animate ? home - INTRO_SWING : home, pitch: START_PITCH, zoom: 1, panX: 0, panY: 0, grow: animate ? 0 : 1 };
    let width = 0;
    let height = 0;
    let density = 0;
    let painted: Face[] = [];
    let hover = -1;
    let frame = 0;
    let intro = 0;
    /** Where each pointer that's down is on the canvas: one turns the chart, two zoom it. */
    const fingers = new Map<number, number[]>();
    /** The one pointer's drag: where it last was, and whether it has gone far enough not to be a tap. */
    let drag: { x: number; y: number; moved: boolean } | null = null;

    const look = (from: Camera) => {
      const p = latest.current;
      // Row names always go on the left, so the grid doesn't jump sideways as it turns.
      const pad = { left: p.rowLabels ? Math.min(100, width * 0.3) : 6, right: 6, y: 18 };
      const grid = { cols: p.cols, rows: p.rows, rise: Math.max(p.cols, p.rows) * 0.26, inset: p.inset ?? 0.14 };
      return fit(grid, from, width, height, pad);
    };
    const paint = () => {
      // Painting now makes a frame already asked for redundant.
      cancelAnimationFrame(frame);
      frame = 0;
      if (!width) return;
      const p = latest.current;
      const ink = document.documentElement.classList.contains("dark") ? INK.dark : INK.light;
      const view = look(camera);
      painted = faces(p.cells, view);
      ctx.setTransform(density, 0, 0, density, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.lineJoin = "round";
      // The cell under the pointer may be gone, if the chart has since been given fewer.
      const group = p.cells[hover]?.group ?? -1;
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
          // Zoomed in, most of them are off the canvas, or left with no room on it.
          if (x - 8 >= LABEL_ROOM && y > 0 && y < height) ctx.fillText(clipped(ctx, p.rowLabels[r], x - 8), x - 6, y);
        }
      }
      if (p.ends) {
        const half = [p.cols / 2, p.rows / 2];
        const ground = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => project(view, x * half[0], 0, z * half[1]));
        [ground[0], ground[2]].forEach(([x, y], i) => {
          // Not at the far corner, where the name would sit a whole ground away from it;
          // nor, zoomed in, for a corner that's off the canvas, where it would name whatever is at the edge.
          const side = i === 0 ? -1 : 1;
          if ((side * sin < 0 && side * cos < 0) || x < 0 || x > width || y < 0 || y > height) return;
          const text = p.ends![i];
          const w = ctx.measureText(text).width;
          const left = clamp(x - w / 2, 4, width - 4 - w);
          ctx.textAlign = "left";
          ctx.fillText(text, left, lowest(ground, left, left + w) + 11);
        });
      }
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(paint);
    };

    // The stylesheet sizes the canvas; this only matches its pixels to that size.
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      if (el.clientWidth === width && el.clientHeight === height && dpr === density) return;
      width = el.clientWidth;
      height = el.clientHeight;
      density = dpr;
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
      paint();
    };
    const sized = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
    sized?.observe(el);
    resize();
    // Zooming the page changes how many pixels the canvas needs, not its size, so the observer stays silent.
    window.addEventListener("resize", resize);

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

    const at = (e: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const middle = () => [width / 2, height / 2];
    const point = (e: PointerEvent) => {
      const [x, y] = at(e);
      const next = cellAt(painted, x, y);
      const bubble = tip.current;
      if (bubble) {
        bubble.hidden = next < 0;
        if (next >= 0) {
          bubble.textContent = latest.current.describe(next);
          bubble.style.left = `${clamp(x, 72, Math.max(width - 72, 72))}px`;
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
    // New props change the picture, and what the bubble a tap left open should say.
    repaint.current = () => {
      if (hover >= latest.current.cells.length) clear();
      else if (hover >= 0 && tip.current) tip.current.textContent = latest.current.describe(hover);
      schedule();
    };
    /**
     * Moves the camera, keeping what's on the ground under `from` under `to`: by
     * default what's in the middle, which is then what the chart turns about.
     */
    const hold = (change: Partial<Camera>, from = middle(), to = from) => {
      settle();
      clear();
      Object.assign(camera, held(look, width, height, camera, change, from, to));
      // The whole chart scrolls with the page; zoomed in, a finger moves about in it instead.
      el.style.touchAction = camera.zoom > 1 ? "none" : "";
      schedule();
    };
    const zoomBy = (by: number, about?: number[]) => {
      const zoom = camera.zoom * by;
      // A step out that would stop a hair short of the whole chart goes all the way:
      // it would look whole, and still keep a finger's swipe from the page.
      hold({ zoom: by < 1 && zoom < WHOLE ? 1 : zoom }, about);
    };
    const pan = (dx: number, dy: number) => hold({}, [0, 0], [dx, dy]);
    const reset = () => hold({ yaw: home, pitch: START_PITCH, zoom: 1 });
    controls.current = { zoom: zoomBy, reset };

    /** The middle of the two fingers, and how far apart they are. */
    const span = () => {
      const [a, b] = [...fingers.values()];
      return { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, spread: Math.max(Math.hypot(a[0] - b[0], a[1] - b[1]), 1) };
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || fingers.size > 1) return;
      settle();
      fingers.set(e.pointerId, at(e));
      el.setPointerCapture(e.pointerId);
      // A second finger makes it a pinch, which is no longer the first one's drag or tap.
      drag = fingers.size > 1 ? null : { x: e.clientX, y: e.clientY, moved: false };
      if (!drag) clear();
      schedule();
    };
    const move = (e: PointerEvent) => {
      if (!fingers.has(e.pointerId)) {
        if (!fingers.size && e.pointerType === "mouse") point(e);
        return;
      }
      const pinch = fingers.size > 1;
      const from = pinch ? span() : null;
      // Kept up even for the finger left down after a pinch, which does nothing more until it lifts:
      // a second finger joining it has to measure from where it now is.
      fingers.set(e.pointerId, at(e));
      if (from) {
        const to = span();
        return hold({ zoom: (camera.zoom * to.spread) / from.spread }, [from.x, from.y], [to.x, to.y]);
      }
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      drag = { x: e.clientX, y: e.clientY, moved: true };
      // With Shift, the picture goes where the pointer does, once there's more of it than shows.
      if (e.shiftKey && camera.zoom > 1) return pan(dx, dy);
      // Until it's zoomed in, a finger's vertical movement scrolls the page (touch-action), so only a mouse tilts.
      const tilts = e.pointerType !== "touch" || camera.zoom > 1;
      hold({ yaw: camera.yaw + dx * 0.01, pitch: tilts ? tilted(camera.pitch + dy * 0.006) : camera.pitch });
    };
    const up = (e: PointerEvent) => {
      if (!fingers.delete(e.pointerId) || !drag) return;
      const tapped = !drag.moved;
      drag = null;
      // A tap is how a finger points.
      if (tapped && e.type === "pointerup") point(e);
    };
    const wheel = (e: WheelEvent) => {
      // A wheel on its own is the page going by. With Ctrl or ⌘ it zooms, which is also how a trackpad's pinch arrives.
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      // A mouse's notch is some 100 pixels, or 3 lines: a doubling at most, whatever the wheel.
      const turned = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 33 : e.deltaY;
      zoomBy(2 ** -clamp(turned / 100, -1, 1), at(e));
    };
    // Two fingers on the chart are its pinch, which the page mustn't also scroll by.
    const pinching = (e: TouchEvent) => {
      if (e.targetTouches.length > 1 && e.cancelable) e.preventDefault();
    };
    const leave = (e: PointerEvent) => {
      // A finger leaves the moment it lifts, which mustn't take away what its tap just showed.
      if (!fingers.size && e.pointerType === "mouse") clear();
    };
    const key = (e: KeyboardEvent) => {
      // With Ctrl or ⌘, + and - zoom the page.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const turn = TURNS[e.key];
      const zoom = ZOOMS[e.key];
      if (!turn && !zoom && e.key !== "0") return;
      e.preventDefault();
      if (zoom) zoomBy(zoom);
      else if (!turn) reset();
      // With Shift, the arrows move a zoomed-in picture: what's to the left comes into view.
      else if (e.shiftKey && camera.zoom > 1) pan(-Math.sign(turn[0]) * NUDGE, Math.sign(turn[1]) * NUDGE);
      else hold({ yaw: camera.yaw + turn[0], pitch: tilted(camera.pitch + turn[1]) });
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    // A pointer can go without either: a context menu takes the mouse's release with it.
    el.addEventListener("lostpointercapture", up);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("keydown", key);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("touchmove", pinching, { passive: false });
    return () => {
      repaint.current = undefined;
      controls.current = undefined;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(intro);
      sized?.disconnect();
      window.removeEventListener("resize", resize);
      themed.disconnect();
      seen?.disconnect();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("lostpointercapture", up);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("keydown", key);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("touchmove", pinching);
    };
  }, []);

  return (
    <div className="relative">
      <canvas
        ref={canvas}
        role="img"
        aria-label={props.label}
        tabIndex={0}
        style={{ aspectRatio: `1 / ${props.aspect}`, minHeight: 240 }}
        className={`block w-full cursor-grab touch-pan-y rounded-xl select-none active:cursor-grabbing ${FOCUS}`}
      />
      <div className="absolute top-1 right-1 flex gap-1">
        <button type="button" className={BUTTON} aria-label={t.stats.zoomOut} title={t.stats.zoomOut} onClick={() => controls.current?.zoom(1 / ZOOM_STEP)}>
          <ZoomOut size={16} aria-hidden />
        </button>
        <button type="button" className={BUTTON} aria-label={t.stats.zoomIn} title={t.stats.zoomIn} onClick={() => controls.current?.zoom(ZOOM_STEP)}>
          <ZoomIn size={16} aria-hidden />
        </button>
        <button type="button" className={BUTTON} aria-label={t.stats.resetView} title={t.stats.resetView} onClick={() => controls.current?.reset()}>
          <RotateCcw size={16} aria-hidden />
        </button>
      </div>
      <div
        ref={tip}
        hidden
        className="pointer-events-none absolute z-10 w-max max-w-64 -translate-x-1/2 -translate-y-full rounded-lg bg-stone-900 px-2.5 py-1 text-center text-xs text-white shadow-md
          dark:bg-stone-100 dark:text-stone-900"
      />
      <details className="mt-2 text-xs text-stone-600 dark:text-stone-400" onToggle={(e) => setListed(e.currentTarget.open)}>
        <summary className={`w-fit cursor-pointer rounded ${FOCUS}`}>{t.stats.asList}</summary>
        {/* Only once it's open: the chapters can make over a thousand lines. Bare ground has nothing to say.
            The list takes focus so that the keyboard can scroll it. */}
        {listed && (
          <ul tabIndex={0} className={`mt-2 max-h-56 space-y-0.5 overflow-y-auto rounded ${FOCUS}`}>
            {props.cells.map((c, i) => (c.parts.length > 0 || c.marked) && <li key={i}>{props.describe(i)}</li>)}
          </ul>
        )}
      </details>
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
