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
vi.mock("../../lib/db", async (actual) => ({
  ...(await actual<typeof import("../../lib/db")>()),
  store: { getIndex: async () => undefined, setIndex: async () => undefined },
}));

const { VersionsCard } = await import("../VersionsCard");
type Resolved = Parameters<typeof VersionsCard>[0]["resolved"];

function renderCard(settings: VersionSetting[], onChange = vi.fn(), resolved: Resolved = null, fresh = false) {
  render(
    <I18nProvider>
      <VersionsCard settings={settings} resolved={resolved} disabled={false} fresh={fresh} onChange={onChange} />
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

  it("shows each version's bundled title next to its name", async () => {
    renderCard([
      { abbr: "MINE", bibleId: 93 },
      { abbr: "RUS", bibleId: 400 },
      { abbr: "AR", bibleId: 13 },
      { abbr: "X", bibleId: 999999 },
    ]);
    expect(screen.getByText("MINE")).toBeInTheDocument();
    // Names are a chunk of their own, which the card loads.
    expect(await screen.findByText("La Sainte Bible par Louis Segond 1910")).toHaveAttribute("lang", "fr");
    // Scanned versions, titled in their own script.
    expect(screen.getByText("Синодальный перевод")).toHaveAttribute("lang", "ru");
    const arabic = screen.getByText("الكتاب المقدس");
    expect(arabic).toHaveAttribute("lang", "ar");
    expect(arabic).toHaveAttribute("dir", "auto");
    expect(screen.getByText("Version 999999")).not.toHaveAttribute("lang");
  });

  it("names a version as soon as its number is typed, and adds it by number", async () => {
    const onChange = renderCard([{ abbr: "NIV", bibleId: 111 }]);
    await userEvent.type(screen.getByLabelText("Add a version"), "12");
    // ASV's name is in the chunk of every version's name, which the card loads.
    expect(await screen.findByText("American Standard Version")).toHaveAttribute("lang", "en");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onChange).toHaveBeenCalledWith([111, 12]);
  });

  it("refuses a version already in the list", async () => {
    const onChange = renderCard([{ abbr: "NIV", bibleId: 111 }]);
    await userEvent.type(screen.getByLabelText("Add a version"), "111");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("That version is already in the list.")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("refuses to add a version whose numbering it can't map", async () => {
    getIndex.mockResolvedValue(synodalIndex);
    const onChange = renderCard([{ abbr: "NIV", bibleId: 111 }]);
    await userEvent.type(screen.getByLabelText("Add a version"), "999998");
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

  describe("finding the person's versions", () => {
    // KJV (1) highlighted in Isaiah 41, ASV (12) only in John 3; nothing elsewhere.
    beforeEach(() => {
      getHighlights.mockImplementation(async (id: number, chapter: string) =>
        (id === 1 && chapter === "ISA.41") ? [{ bible_id: 1, passage_id: "ISA.41.10", color: "fffe00" }]
        : (id === 12 && chapter === "JHN.3") ? [
            { bible_id: 12, passage_id: "JHN.3.16", color: "fffe00" },
            { bible_id: 12, passage_id: "JHN.3.17", color: "5dff79" },
          ]
        : [],
      );
    });

    it("looks straight away on a first visit, and offers to replace the example versions", async () => {
      const onChange = renderCard([{ abbr: "LSG", bibleId: 93 }, { abbr: "S21", bibleId: 152 }], vi.fn(), null, true);
      expect(screen.getByText(/These are example versions/)).toBeInTheDocument();
      await userEvent.click(await screen.findByRole("button", { name: "Use these 2 versions instead" }));
      // Most used first (KJV is ranked, ASV isn't), named as bible.com names them.
      expect(onChange).toHaveBeenCalledWith([1, 12]);
      expect(screen.getByText("2 highlighted verses in the sample")).toBeInTheDocument();
      expect(screen.getByText("No highlights found in LSG and S21 in the chapters sampled.")).toBeInTheDocument();
      // Only reads: nothing but highlights and indexes is asked for.
      expect(getHighlights).toHaveBeenCalledWith(111, "JHN.3");
      expect(getHighlights).not.toHaveBeenCalledWith(1, "PHP.4"); // KJV already found
      // The most used versions are asked about first.
      expect(getHighlights.mock.calls.slice(0, 3).map(([id]) => id)).toEqual([111, 93, 1]); // NIV, LSG (French default-level rank), KJV
    });

    it("waits to be asked once the person has chosen versions, and adds one at a time", async () => {
      const onChange = renderCard([{ abbr: "KJV", bibleId: 1 }, { abbr: "NIV", bibleId: 111 }]);
      expect(getHighlights).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole("button", { name: "Find my versions" }));
      await userEvent.click(await screen.findByRole("button", { name: "Add ASV" }));
      expect(onChange).toHaveBeenCalledWith([1, 111, 12]);
      expect(screen.getByText("In your list")).toBeInTheDocument(); // KJV
      expect(screen.queryByRole("button", { name: /Use these/ })).not.toBeInTheDocument();
      expect(screen.getByText("No highlights found in NIV in the chapters sampled.")).toBeInTheDocument();
    });

    it("lets a found version be added while the rest are still being looked for", async () => {
      // ASV's John 3 never answers, so the scan is still running after KJV is found.
      const pending = new Promise<never>(() => {});
      const found = getHighlights.getMockImplementation()!;
      getHighlights.mockImplementation((id: number, chapter: string) => (id === 12 && chapter === "JHN.3" ? pending : found(id, chapter)));
      const onChange = renderCard([{ abbr: "NIV", bibleId: 111 }, { abbr: "AMP", bibleId: 1588 }]);
      await userEvent.click(screen.getByRole("button", { name: "Find my versions" }));
      const add = await screen.findByRole("button", { name: "Add KJV" });
      await vi.waitFor(() => expect(add).toBeEnabled()); // once its numbering is checked
      expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
      await userEvent.click(add);
      expect(onChange).toHaveBeenCalledWith([111, 1588, 1]);
    });

    it("says so when signed out or offline", async () => {
      const { ApiError } = await import("@bvs/core");
      getHighlights.mockRejectedValue(new ApiError(401, "sign-in expired"));
      renderCard([{ abbr: "KJV", bibleId: 1 }]);
      await userEvent.click(screen.getByRole("button", { name: "Find my versions" }));
      expect(await screen.findByText("Couldn't finish looking: sign-in expired")).toBeInTheDocument();
    });
  });
});
