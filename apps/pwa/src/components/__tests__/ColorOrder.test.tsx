/** @vitest-environment jsdom */

import { HIGHLIGHT_COLORS, type HighlightColorId } from "@bvs/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { ColorOrder } from "../ColorOrder";

const ORDER = HIGHLIGHT_COLORS.map((c) => c.id) as HighlightColorId[];

function renderOrder(byColor: boolean, onChange = vi.fn()) {
  const { container } = render(
    <I18nProvider>
      <ColorOrder byColor={byColor} order={ORDER} disabled={false} onChange={onChange} />
    </I18nProvider>,
  );
  return { details: container.querySelector("details")!, onChange };
}

describe("ColorOrder", () => {
  it("starts folded away while the versions' order decides", () => {
    expect(renderOrder(false).details.open).toBe(false);
  });

  it("starts open, and says so, when colors decide", () => {
    expect(renderOrder(true).details.open).toBe(true);
    expect(screen.getByText("On")).toBeInTheDocument();
  });

  it("lists every color the mobile apps offer", () => {
    renderOrder(true);
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
  });

  it("switches to deciding by color", async () => {
    const { onChange } = renderOrder(false);
    await userEvent.click(screen.getByText("Order by highlight color instead"));
    await userEvent.click(screen.getByLabelText("By color"));
    expect(onChange).toHaveBeenCalledWith(true, ORDER);
  });

  it("moves a color up", async () => {
    const { onChange } = renderOrder(true);
    await userEvent.click(screen.getByRole("button", { name: "Move Yellow up" }));
    expect(onChange.mock.calls[0][1].slice(0, 3)).toEqual(["orange", "yellow", "peach"]);
  });
});
