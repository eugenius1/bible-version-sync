/** @vitest-environment jsdom */

import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { move, SortableList } from "../Sortable";

const ROW = 40;

function renderList(items = ["a", "b", "c", "d"], disabled = false) {
  const onReorder = vi.fn();
  render(
    <SortableList items={items} keyOf={(x) => x} label={(x) => `Reorder ${x}`} disabled={disabled} onReorder={onReorder}>
      {(x) => <span>{x}</span>}
    </SortableList>,
  );
  // jsdom lays nothing out: give each row its place by its position in the list.
  for (const li of screen.getAllByRole("listitem")) {
    li.getBoundingClientRect = () => {
      const i = [...li.parentElement!.children].indexOf(li);
      return { top: i * ROW, height: ROW, bottom: (i + 1) * ROW } as DOMRect;
    };
  }
  return { onReorder };
}

const order = () => screen.getAllByRole("listitem").map((li) => li.textContent?.replace(/^\d+/, ""));
const pointer = (type: string, clientY: number, pointerId = 1) =>
  act(() => void window.dispatchEvent(Object.assign(new Event(type), { clientY, pointerId })));
const press = (name: string, pointerId = 1) =>
  fireEvent.pointerDown(screen.getByRole("button", { name }), { button: 0, pointerId });

describe("move", () => {
  it("takes an item out and puts it back at the new index", () => {
    expect(move(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(move(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
});

describe("SortableList", () => {
  it("reorders live while dragging and saves once, on release", () => {
    const { onReorder } = renderList();
    press("Reorder a");
    pointer("pointermove", 1.6 * ROW);
    expect(order()).toEqual(["b", "a", "c", "d"]);
    pointer("pointermove", 2.6 * ROW);
    expect(order()).toEqual(["b", "c", "a", "d"]);
    expect(onReorder).not.toHaveBeenCalled();
    pointer("pointerup", 2.6 * ROW);
    expect(onReorder).toHaveBeenCalledExactlyOnceWith(["b", "c", "a", "d"]);
    // Shown as dropped until the saved order comes back.
    expect(order()).toEqual(["b", "c", "a", "d"]);
  });

  it("ends a drag released before the next render", () => {
    const { onReorder } = renderList();
    press("Reorder a");
    pointer("pointerup", 0);
    expect(onReorder).not.toHaveBeenCalled();
    expect(screen.getAllByRole("listitem").some((li) => li.dataset.dragging)).toBe(false);
  });

  it("puts the order back when the drag is cancelled", () => {
    const { onReorder } = renderList();
    press("Reorder d");
    pointer("pointermove", 0);
    expect(order()).toEqual(["d", "a", "b", "c"]);
    pointer("pointercancel", 0);
    expect(order()).toEqual(["a", "b", "c", "d"]);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("follows only the pointer that started the drag", () => {
    const { onReorder } = renderList();
    press("Reorder a", 1);
    press("Reorder c", 2); // a second finger, ignored
    pointer("pointermove", 3.6 * ROW, 2);
    pointer("pointerup", 3.6 * ROW, 2);
    expect(onReorder).not.toHaveBeenCalled();
    pointer("pointermove", 1.6 * ROW, 1);
    pointer("pointerup", 1.6 * ROW, 1);
    expect(onReorder).toHaveBeenCalledExactlyOnceWith(["b", "a", "c", "d"]);
  });

  it("moves with the arrow keys, and not past either end", async () => {
    const { onReorder } = renderList();
    screen.getByRole("button", { name: "Reorder a" }).focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(onReorder).not.toHaveBeenCalled();
    await userEvent.keyboard("{ArrowDown}");
    expect(onReorder).toHaveBeenCalledWith(["b", "a", "c", "d"]);
  });

  it("can't be dragged while disabled", () => {
    const { onReorder } = renderList(undefined, true);
    expect(screen.getByRole("button", { name: "Reorder a" })).toBeDisabled();
    expect(onReorder).not.toHaveBeenCalled();
  });
});
