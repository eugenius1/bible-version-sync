/** @vitest-environment jsdom */

import { BOOKS, Standard, VersionMap } from "@bvs/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import type { VersionSetting } from "../../lib/db";

const getHighlights = vi.fn();
const getIndex = vi.fn();
vi.mock("../../lib/auth", () => ({
  client: { getHighlights: (...a: unknown[]) => getHighlights(...a), getIndex: (id: number) => getIndex(id) },
}));
vi.mock("../../lib/db", () => ({ store: { getIndex: async () => undefined, setIndex: async () => undefined } }));

const { VersionsCard } = await import("../VersionsCard");
type Resolved = Parameters<typeof VersionsCard>[0]["resolved"];

function renderCard(settings: VersionSetting[], onChange = vi.fn(), resolved: Resolved = null) {
  render(
    <I18nProvider>
      <VersionsCard settings={settings} resolved={resolved} disabled={false} onChange={onChange} />
    </I18nProvider>,
  );
  return onChange;
}

// Russian Synodal verse counts, as the API index of a version YouVersion doesn't label.
const synodalIndex = {
  books: BOOKS.map((id) => ({
    id,
    chapters: Standard.load().counts.rso[id].map((n, i) => ({
      id: String(i + 1),
      verses: Array.from({ length: n }, (_, k) => k + 1),
    })),
  })),
};

describe("VersionsCard", () => {
  beforeEach(() => {
    getHighlights.mockReset();
    getHighlights.mockResolvedValue([]);
    getIndex.mockReset();
    getIndex.mockResolvedValue(null);
  });

  it("shows each version's bundled title next to the person's own name for it", () => {
    renderCard([
      { abbr: "MINE", bibleId: 93 },
      { abbr: "RUS", bibleId: 400 },
      { abbr: "AR", bibleId: 13 },
      { abbr: "X", bibleId: 999999 },
    ]);
    expect(screen.getByText("MINE")).toBeInTheDocument();
    expect(screen.getByText("La Sainte Bible par Louis Segond 1910")).toHaveAttribute("lang", "fr");
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

  it("refuses to add a version whose numbering it can't map", async () => {
    getIndex.mockResolvedValue(synodalIndex);
    const onChange = renderCard([{ abbr: "NIV", bibleId: 111 }]);
    await userEvent.type(screen.getByLabelText("Add a version"), "999998");
    await userEvent.type(screen.getByLabelText("Short name"), "rus");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText(/Version 999998 can't be synced: 153 of its chapters/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("explains a saved version whose numbering it can't map", () => {
    const settings = [
      { abbr: "NIV", bibleId: 111 },
      { abbr: "RUS", bibleId: 999998 },
    ];
    renderCard(settings, vi.fn(), [
      { ...settings[1], map: VersionMap.unsupported("RUS"), source: "unsupported", unfit: 153 },
    ]);
    expect(screen.getByText("Numbering not supported")).toBeInTheDocument();
    expect(screen.getByText(/^153 chapters of this version match neither/)).toBeInTheDocument();
  });
});
