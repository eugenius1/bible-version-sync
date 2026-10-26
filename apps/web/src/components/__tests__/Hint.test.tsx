/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hint } from "../Hint";

// jsdom has no popover API: stand in for it with a set of open popovers.
const open = new Set<Element>();

const renderHint = () => {
  render(
    <Hint hint="Numbered differently" className="badge">
      ≠
    </Hint>,
  );
  return { button: screen.getByRole("button"), pop: screen.getByRole("tooltip", { hidden: true }) };
};

const toggle = (pop: Element, newState: "open" | "closed") =>
  fireEvent(pop, Object.assign(new Event("toggle"), { newState }));

describe("Hint", () => {
  beforeEach(() => {
    HTMLElement.prototype.showPopover = function () {
      open.add(this);
    };
    HTMLElement.prototype.hidePopover = function () {
      open.delete(this);
    };
    const matches = Element.prototype.matches;
    vi.spyOn(Element.prototype, "matches").mockImplementation(function (this: Element, selector: string) {
      return selector === ":popover-open" ? open.has(this) : matches.call(this, selector);
    });
  });

  afterEach(() => {
    open.clear();
    vi.restoreAllMocks();
    delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover;
    delete (HTMLElement.prototype as Partial<HTMLElement>).hidePopover;
  });

  it("describes the button with the hint, even while the hint is hidden", () => {
    const { button, pop } = renderHint();
    expect(button.getAttribute("aria-describedby")).toBe(pop.id);
    expect(button.getAttribute("popovertarget")).toBe(pop.id);
    expect(pop.textContent).toBe("Numbered differently");
  });

  it("opens on hovering with a mouse and closes on leaving", () => {
    const { button, pop } = renderHint();
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    expect(open.has(pop)).toBe(true);
    fireEvent.pointerLeave(button, { pointerType: "mouse" });
    expect(open.has(pop)).toBe(false);
  });

  it("leaves touch to the click, which the browser's popoverTarget handles", () => {
    const { button, pop } = renderHint();
    fireEvent.pointerEnter(button, { pointerType: "touch" });
    expect(open.has(pop)).toBe(false);
  });

  it("stays open after a click while hovering, until the popover closes", () => {
    const { button, pop } = renderHint();
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    // The click must not reach popoverTarget, which would close it again.
    expect(fireEvent.click(button)).toBe(false);
    fireEvent.pointerLeave(button, { pointerType: "mouse" });
    expect(open.has(pop)).toBe(true);

    // Esc or a tap elsewhere closes it, and the next hover starts unpinned.
    pop.hidePopover();
    toggle(pop, "closed");
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    fireEvent.pointerLeave(button, { pointerType: "mouse" });
    expect(open.has(pop)).toBe(false);
  });
});
