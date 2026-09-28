/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import type { VersionSetting } from "../../lib/db";

const getHighlights = vi.fn();
vi.mock("../../lib/auth", () => ({ client: { getHighlights: (...a: unknown[]) => getHighlights(...a) } }));
vi.mock("../../lib/db", () => ({ store: {} }));

const { VersionsCard } = await import("../VersionsCard");

function renderCard(settings: VersionSetting[], onChange = vi.fn()) {
  render(
    <I18nProvider>
      <VersionsCard settings={settings} resolved={null} disabled={false} onChange={onChange} />
    </I18nProvider>,
  );
  return onChange;
}

describe("VersionsCard", () => {
  beforeEach(() => {
    getHighlights.mockReset();
    getHighlights.mockResolvedValue([]);
  });

  it("shows each version's bundled title next to the person's own name for it", () => {
    renderCard([
      { abbr: "MINE", bibleId: 93 },
      { abbr: "RUS", bibleId: 400 },
      { abbr: "AR", bibleId: 13 },
      { abbr: "X", bibleId: 999999 },
    ]);
    expect(screen.getByText("MINE")).toBeInTheDocument();
    expect(screen.getByText("Louis Segond 1910")).toHaveAttribute("lang", "fr");
    // Scanned versions, titled in their own script.
    expect(screen.getByText("Синодальный перевод")).toHaveAttribute("lang", "ru");
    const arabic = screen.getByText("الكتاب المقدس");
    expect(arabic).toHaveAttribute("lang", "ar");
    expect(arabic).toHaveAttribute("dir", "auto");
    expect(screen.getByText("Version 999999")).not.toHaveAttribute("lang");
  });

  it("names a version as soon as its number is typed, and uses its abbreviation", async () => {
    const onChange = renderCard([{ abbr: "NIV", bibleId: 111 }]);
    await userEvent.type(screen.getByLabelText("Add a version"), "12");
    expect(screen.getByText("American Standard Version")).toHaveAttribute("lang", "en");
    expect(screen.getByLabelText("Short name")).toHaveAttribute("placeholder", "ASV");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onChange).toHaveBeenCalledWith([
      { abbr: "NIV", bibleId: 111 },
      { abbr: "ASV", bibleId: 12 },
    ]);
  });

  it("keeps the name the person typed, or the one in the link", async () => {
    const onChange = renderCard([{ abbr: "NIV", bibleId: 111 }]);
    await userEvent.type(screen.getByLabelText("Add a version"), "1");
    await userEvent.type(screen.getByLabelText("Short name"), "mine");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onChange).toHaveBeenLastCalledWith([
      { abbr: "NIV", bibleId: 111 },
      { abbr: "MINE", bibleId: 1 },
    ]);

    await userEvent.type(screen.getByLabelText("Add a version"), "bible.com/bible/1/JHN.3.KJVA");
    expect(screen.getByLabelText("Short name")).toHaveAttribute("placeholder", "KJVA");
  });

  it("still asks for a name for a version it can't name", async () => {
    const onChange = renderCard([{ abbr: "NIV", bibleId: 111 }]);
    await userEvent.type(screen.getByLabelText("Add a version"), "999999");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText(/Add a short name/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
