/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
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

describe("Scene3D", () => {
  it("keeps a tapped bar's bubble saying what the chart now says, and takes it away with its bar", () => {
    const { rerender } = render(scene([BAR], () => "one verse"));
    const canvas = screen.getByRole("img", { name: "Chart" });
    // A tap in the middle, where the one bar stands: a finger then leaves, which mustn't hide it.
    const tap = { button: 0, pointerId: 1, pointerType: "touch", clientX: 200, clientY: 150 };
    fireEvent.pointerDown(canvas, tap);
    fireEvent.pointerUp(canvas, tap);
    fireEvent.pointerLeave(canvas, tap);
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
});
