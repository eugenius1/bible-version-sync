/** @vitest-environment jsdom */

import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { move, SortableList } from "../Sortable";

const ROW = 40;

function renderList(items = ["a", "b", "c", "d"], disabled = false) {
  const onReorder = vi.fn();
  const view = render(
    <SortableList items={items} keyOf={(x) => x} label={(x) => `Reorder ${x}`} disabled={disabled} onReorder={onReorder}>
      {(x) => <span>{x}</span>}
    </SortableList>,
  );
  // jsdom lays nothing out: give each row its place by its position in the
  // list, and the list room for them all (drags are kept inside it).
  const rect = (top: number, height: number) =>
    ({ top, bottom: top + height, height, left: 0, right: 200, width: 200, x: 0, y: top }) as DOMRect;
  screen.getByRole("list").getBoundingClientRect = () => rect(0, items.length * ROW);
  for (const li of screen.getAllByRole("listitem")) {
    li.getBoundingClientRect = () => {
      const i = [...li.parentElement!.children].indexOf(li);
      return rect(i * ROW, ROW);
    };
  }
  return { onReorder, ...view };
}

const order = () => screen.getAllByRole("listitem").map((li) => li.textContent?.replace(/^\d+/, ""));
const handle = (name: string) => screen.getByRole("button", { name });
// dnd-kit's pointer sensor starts on the handle and follows the document. It
// measures the rows a frame after the drag starts, so each step is let settle.
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));
const drag = async (name: string, fromY: number, toY: number, end: "drop" | "cancel" = "drop") => {
  fireEvent.pointerDown(handle(name), { button: 0, isPrimary: true, clientX: 10, clientY: fromY });
  await settle();
  for (const y of [fromY + (toY - fromY) / 2, toY]) {
    fireEvent.pointerMove(document, { clientX: 10, clientY: y });
    await settle();
  }
  if (end === "drop") fireEvent.pointerUp(document, { clientX: 10, clientY: toY });
  else fireEvent.keyDown(document, { code: "Escape" });
  await settle();
};

describe("move", () => {
  it("takes an item out and puts it back at the new index", () => {
    expect(move(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(move(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
});

describe("SortableList", () => {
  it("saves the dropped order once, on release, and shows it until it comes back", async () => {
    const { onReorder } = renderList();
    await drag("Reorder a", 0.5 * ROW, 2.5 * ROW);
    expect(onReorder).toHaveBeenCalledExactlyOnceWith(["b", "c", "a", "d"]);
    expect(order()).toEqual(["b", "c", "a", "d"]);
  });

  it("drags upwards too", async () => {
    const { onReorder } = renderList();
    await drag("Reorder d", 3.5 * ROW, 0.5 * ROW);
    expect(onReorder).toHaveBeenCalledExactlyOnceWith(["d", "a", "b", "c"]);
  });

  it("saves nothing when dropped where it started", async () => {
    const { onReorder } = renderList();
    await drag("Reorder b", 1.5 * ROW, 1.5 * ROW);
    expect(onReorder).not.toHaveBeenCalled();
    expect(order()).toEqual(["a", "b", "c", "d"]);
  });

  it("puts the order back when the drag is cancelled", async () => {
    const { onReorder } = renderList();
    await drag("Reorder d", 3.5 * ROW, 0.5 * ROW, "cancel");
    expect(onReorder).not.toHaveBeenCalled();
    expect(order()).toEqual(["a", "b", "c", "d"]);
  });

  it("moves with the arrow keys, and not past either end", async () => {
    const { onReorder } = renderList();
    screen.getByRole("button", { name: "Reorder a" }).focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(onReorder).not.toHaveBeenCalled();
    await userEvent.keyboard("{ArrowDown}");
    expect(onReorder).toHaveBeenCalledWith(["b", "a", "c", "d"]);
  });

  it("can't be dragged while disabled", async () => {
    const { onReorder } = renderList(undefined, true);
    expect(handle("Reorder a")).toBeDisabled();
    await drag("Reorder a", 0.5 * ROW, 2.5 * ROW);
    expect(onReorder).not.toHaveBeenCalled();
  });
});
