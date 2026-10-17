/** @vitest-environment jsdom */

import { HIGHLIGHT_COLORS, type HighlightColorId } from "@bvs/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { Priority } from "../Priority";

const ORDER = HIGHLIGHT_COLORS.map((c) => c.id) as HighlightColorId[];
const VERSIONS = [
  { abbr: "NIV", bibleId: 111 },
  { abbr: "LSG", bibleId: 93 },
  { abbr: "AMP", bibleId: 1588 },
];

function renderPriority(byColor: boolean) {
  const onVersions = vi.fn();
  const onColors = vi.fn();
  render(
    <I18nProvider>
      <Priority
        versions={VERSIONS}
        byColor={byColor}
        colorOrder={ORDER}
        disabled={false}
        onVersions={onVersions}
        onColors={onColors}
      />
    </I18nProvider>,
  );
  return { onVersions, onColors };
}

describe("Priority", () => {
  it("shows the versions to reorder, and no colors, while versions decide", async () => {
    const { onVersions } = renderPriority(false);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByText("Yellow")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Move AMP up" }));
    expect(onVersions).toHaveBeenCalledWith([111, 1588, 93]);
  });

  it("switches to color priority", async () => {
    const { onColors } = renderPriority(false);
    await userEvent.click(screen.getByRole("switch", { name: "Use color priority instead of version priority" }));
    expect(onColors).toHaveBeenCalledWith(true, ORDER);
  });

  it("shows the switch on while colors decide", () => {
    renderPriority(true);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("lists every color the mobile apps offer, and moves one up", async () => {
    const { onColors } = renderPriority(true);
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    await userEvent.click(screen.getByRole("button", { name: "Move Yellow up" }));
    expect(onColors.mock.calls[0][1].slice(0, 3)).toEqual(["orange", "yellow", "peach"]);
  });
});
