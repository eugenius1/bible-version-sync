/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import type { Cell } from "../../lib/scene3d";
import { Scene3D } from "../Scene3D";

const BAR: Cell = { col: 0, row: 0, parts: [{ value: 1, color: "fffe00" }], marked: false, band: 0, group: 0 };

const scene = (cells: readonly Cell[], describe: (i: number) => string) => (
  <I18nProvider>
    <Scene3D cols={1} rows={1} cells={cells} describe={describe} label="Chart" aspect={0.75} />
  </I18nProvider>
);

beforeEach(() => {
  // jsdom has neither a canvas to draw on nor a layout to size it: a context that takes any call, and a size.
  const ctx = new Proxy({}, { get: (_, key) => (key === "measureText" ? () => ({ width: 0 }) : () => {}), set: () => true });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as never);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(300);
  HTMLElement.prototype.setPointerCapture = () => {};
});

/** A finger at a place on the canvas, as a pointer event's fields. */
const finger = (pointerId: number, clientX: number, clientY: number) => ({ button: 0, pointerId, pointerType: "touch", clientX, clientY });

/** A chart of one bar, which a tap on it names "one verse". */
const chart = () => {
  render(scene([BAR], () => "one verse"));
  return screen.getByRole("img", { name: "Chart" });
};

/** A finger's tap, which names the cell under it in the picture as last painted: the next frame's. */
const tap = async (canvas: HTMLElement, x: number, y: number) => {
  await new Promise(requestAnimationFrame);
  fireEvent.pointerDown(canvas, finger(9, x, y));
  fireEvent.pointerUp(canvas, finger(9, x, y));
};

describe("Scene3D", () => {
  it("keeps a tapped bar's bubble saying what the chart now says, and takes it away with its bar", () => {
    const { rerender } = render(scene([BAR], () => "one verse"));
    const canvas = screen.getByRole("img", { name: "Chart" });
    // A tap in the middle, where the one bar stands: a finger then leaves, which mustn't hide it.
    const middle = finger(1, 200, 150);
    fireEvent.pointerDown(canvas, middle);
    fireEvent.pointerUp(canvas, middle);
    fireEvent.pointerLeave(canvas, middle);
    expect(screen.getByText("one verse")).toBeVisible();

    rerender(scene([BAR], () => "ein Vers"));
    expect(screen.queryByText("one verse")).not.toBeInTheDocument();
    expect(screen.getByText("ein Vers")).toBeVisible();

    rerender(scene([], () => "nothing"));
    expect(screen.getByText("ein Vers")).not.toBeVisible();
  });

  it("lists the cells with something on them, once asked", () => {
    const bare: Cell = { ...BAR, col: 1, parts: [] };
    render(scene([BAR, bare, { ...bare, col: 2, marked: true }], (i) => `cell ${i}`));
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    const details = screen.getByText("Show as a list").parentElement as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["cell 0", "cell 2"]);
  });

  it("zooms in with the button until the bar reaches the corner, and fits it again on a reset", async () => {
    const canvas = chart();
    await tap(canvas, 10, 20);
    expect(screen.queryByText("one verse")).not.toBeInTheDocument();

    for (let i = 0; i < 6; i++) await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    await tap(canvas, 10, 20);
    expect(screen.getByText("one verse")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Reset the view" }));
    await tap(canvas, 10, 20);
    expect(screen.getByText("one verse")).not.toBeVisible();
  });

  it("zooms with two fingers, and keeps their swipes from the page only while zoomed in", async () => {
    const canvas = chart();
    fireEvent.pointerDown(canvas, finger(1, 190, 150));
    fireEvent.pointerDown(canvas, finger(2, 210, 150));
    fireEvent.pointerMove(canvas, finger(2, 290, 150));
    expect(canvas.style.touchAction).toBe("none");
    // Lifting them isn't a tap.
    fireEvent.pointerUp(canvas, finger(2, 290, 150));
    fireEvent.pointerUp(canvas, finger(1, 190, 150));
    expect(screen.queryByText("one verse")).not.toBeInTheDocument();
    // What was under the fingers has stayed between them, five times the size: the bar now reaches the corner.
    await tap(canvas, 10, 20);
    expect(screen.getByText("one verse")).toBeVisible();

    fireEvent.pointerDown(canvas, finger(1, 100, 150));
    fireEvent.pointerDown(canvas, finger(2, 300, 150));
    fireEvent.pointerMove(canvas, finger(2, 110, 150));
    expect(canvas.style.touchAction).toBeFalsy();
  });

  it("measures a second pinch from where the finger left down by the first has since moved to", () => {
    const canvas = chart();
    fireEvent.pointerDown(canvas, finger(1, 190, 150));
    fireEvent.pointerDown(canvas, finger(2, 210, 150));
    fireEvent.pointerMove(canvas, finger(2, 230, 150));
    fireEvent.pointerUp(canvas, finger(2, 230, 150));
    // The first finger goes across the chart, and another lands right beside it.
    fireEvent.pointerMove(canvas, finger(1, 380, 150));
    fireEvent.pointerDown(canvas, finger(3, 390, 150));
    // A nudge closer is a nudge out: from where the first finger was, it would be all the way out.
    fireEvent.pointerMove(canvas, finger(1, 381, 150));
    expect(canvas.style.touchAction).toBe("none");
  });

  it("lets a finger's swipe up and down tilt it once zoomed in, which until then scrolls the page", async () => {
    const canvas = chart();
    /** How far down the middle of the canvas the picture starts. */
    const top = async () => {
      for (let y = 0; y < 150; y += 10) {
        await tap(canvas, 200, y);
        if (screen.queryByText("one verse")?.hidden === false) return y;
      }
      return 150;
    };
    const swipeDown = () => {
      fireEvent.pointerDown(canvas, finger(1, 200, 150));
      fireEvent.pointerMove(canvas, finger(1, 200, 250));
      fireEvent.pointerUp(canvas, finger(1, 200, 250));
    };
    const whole = await top();
    swipeDown();
    expect(await top()).toBe(whole);

    fireEvent.keyDown(canvas, { key: "+" });
    const close = await top();
    swipeDown();
    expect(await top()).not.toBe(close);
  });

  it("zooms with Ctrl and the wheel, and leaves a wheel on its own to the page", () => {
    const canvas = chart();
    // fireEvent says whether the event was left alone: false once the chart has taken it.
    expect(fireEvent.wheel(canvas, { deltaY: -100 })).toBe(true);
    expect(canvas.style.touchAction).toBeFalsy();
    expect(fireEvent.wheel(canvas, { deltaY: -100, ctrlKey: true })).toBe(false);
    expect(canvas.style.touchAction).toBe("none");
  });

  it("steps all the way out from a zoom that's a hair short of a whole number of steps", async () => {
    const canvas = chart();
    // Seven steps in stop at the limit, short of where seven steps out would start from.
    for (let i = 0; i < 7; i++) fireEvent.keyDown(canvas, { key: "+" });
    for (let i = 0; i < 5; i++) await userEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(canvas.style.touchAction).toBeFalsy();
  });

  it("turns with Shift and a drag while the whole chart shows, when there's nowhere to move it to", async () => {
    const canvas = chart();
    await tap(canvas, 200, 150);
    expect(screen.getByText("one verse")).toBeVisible();
    // A quarter turn or so of the one bar, whose corner then covers a place its side didn't.
    const edge = async () => {
      for (let x = 200; x < 400; x += 4) {
        await tap(canvas, x, 150);
        if (screen.getByText("one verse").hidden) return x;
      }
      return 400;
    };
    const before = await edge();
    fireEvent.pointerDown(canvas, { ...finger(1, 200, 150), pointerType: "mouse", shiftKey: true });
    fireEvent.pointerMove(canvas, { ...finger(1, 260, 150), pointerType: "mouse", shiftKey: true });
    fireEvent.pointerUp(canvas, { ...finger(1, 260, 150), pointerType: "mouse", shiftKey: true });
    expect(await edge()).not.toBe(before);
  });

  it("zooms with + and -, and leaves them to the browser with Ctrl", () => {
    const canvas = chart();
    fireEvent.keyDown(canvas, { key: "+", ctrlKey: true });
    expect(canvas.style.touchAction).toBeFalsy();
    fireEvent.keyDown(canvas, { key: "+" });
    expect(canvas.style.touchAction).toBe("none");
    fireEvent.keyDown(canvas, { key: "-" });
    expect(canvas.style.touchAction).toBeFalsy();
  });
});
