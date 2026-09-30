/** @vitest-environment jsdom */

import { BOOKS, Standard, VersionMap } from "@bvs/core";
import { render, screen, within } from "@testing-library/react";
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

  describe("adding a version", () => {
    const search = async (text: string) => {
      await userEvent.type(screen.getByRole("combobox", { name: "Add a version" }), text);
      return screen.findAllByRole("option");
    };

    it("finds a version by its number and shows its abbreviation, title, language and number", async () => {
      const onChange = renderCard([{ abbr: "NIV", bibleId: 111 }]);
      const [asv] = await search("12");
      expect(asv).toHaveTextContent("ASV");
      expect(within(asv).getByText("American Standard Version")).toHaveAttribute("lang", "en");
      expect(asv).toHaveTextContent("English · No. 12");
      await userEvent.click(asv);
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith([111, 12]));
      expect(screen.getByRole("combobox")).toHaveValue("");
    });

    it("finds versions by abbreviation or title, ignoring accents, the reader's languages first", async () => {
      renderCard([{ abbr: "NIV", bibleId: 111 }]);
      const segond = (await search("segond")).map((o) => o.textContent);
      expect(segond.some((t) => t?.includes("La Sainte Bible par Louis Segond 1910"))).toBe(true);
      expect(segond.some((t) => t?.includes("La Bible Segond 21"))).toBe(true);
      await userEvent.clear(screen.getByRole("combobox"));
      expect((await search("edition de geneve"))[0]).toHaveTextContent("Nouvelle Edition de Genève 1979");
      // jsdom reads English: the English KJV comes before the Thai one.
      await userEvent.clear(screen.getByRole("combobox"));
      const kjv = (await search("kjv")).map((o) => o.textContent ?? "");
      expect(kjv[0]).toContain("King James Version");
      expect(kjv.findIndex((t) => t.includes("Thai"))).toBeGreaterThan(kjv.findIndex((t) => t.includes("English")));
    });

    it("finds the version in a pasted bible.com link", async () => {
      renderCard([{ abbr: "NIV", bibleId: 111 }]);
      const options = await search("https://www.bible.com/bible/1/JHN.3.KJV");
      expect(options).toHaveLength(1);
      expect(options[0]).toHaveTextContent("King James Version");
    });

    it("shows a version already in the list as added, and won't add it again", async () => {
      const onChange = renderCard([{ abbr: "NIV", bibleId: 111 }]);
      const [niv] = await search("111");
      expect(niv).toHaveTextContent("Already added");
      expect(niv).toHaveAttribute("aria-disabled", "true");
      await userEvent.click(niv);
      await userEvent.keyboard("{Enter}");
      expect(getHighlights).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("starts the keyboard on the first result that can be added", async () => {
      const onChange = renderCard([{ abbr: "NIV", bibleId: 111 }]);
      const options = await search("niv"); // NIV itself first, already added
      expect(options[0]).toHaveTextContent("Already added");
      expect(options[1]).toHaveAttribute("aria-selected", "true");
      await userEvent.keyboard("{Enter}");
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith([111, 113])); // NIVUK
    });

    it("adds the highlighted result with the keyboard", async () => {
      const onChange = renderCard([{ abbr: "NIV", bibleId: 111 }]);
      await search("king james");
      await userEvent.keyboard("{Enter}");
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith([111, 1]));
    });

    it("says when nothing matches", async () => {
      renderCard([{ abbr: "NIV", bibleId: 111 }]);
      await userEvent.type(screen.getByRole("combobox"), "no such version anywhere");
      // Announced: focus stays in the field.
      expect(screen.getByText("No version matches “no such version anywhere”.").closest("[role=status]")).not.toBeNull();
    });

    it("offers a number bible.com doesn't name, and refuses it if its numbering can't be mapped", async () => {
      getIndex.mockResolvedValue(synodalIndex);
      const onChange = renderCard([{ abbr: "NIV", bibleId: 111 }]);
      const [unknown] = await search("999998");
      expect(unknown).toHaveTextContent("Version 999998");
      await userEvent.click(unknown);
      expect(await screen.findByRole("alert")).toHaveTextContent(/Version 999998 can't be synced: 153 of its chapters/);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("refuses a version whose chapters YouVersion ids PSA.1_1, saying why", async () => {
      const onChange = renderCard([{ abbr: "NIV", bibleId: 111 }]);
      const [nr2006] = await search("4833");
      await userEvent.click(nr2006);
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(/Version 4833 can't be synced yet: .* chapter ids of its own \(Psalm 1 is PSA\.1_1\)/);
      expect(alert).not.toHaveTextContent(/numbering/);
      expect(onChange).not.toHaveBeenCalled();
      expect(getIndex).not.toHaveBeenCalled();
    });
  });

  it("explains a saved version whose chapter ids it can't use", () => {
    const settings = [
      { abbr: "NIV", bibleId: 111 },
      { abbr: "NR2006", bibleId: 4833 },
    ];
    renderCard(settings, vi.fn(), [
      { ...settings[1], map: VersionMap.unsupported("NR2006"), source: "unsupported", reason: "chapter-ids" },
    ]);
    expect(screen.getByText("Can't be synced yet")).toBeInTheDocument();
    expect(screen.getByText(/^YouVersion stores this version's highlights under chapter ids of its own/)).toBeInTheDocument();
    expect(screen.queryByText("Numbering not supported")).not.toBeInTheDocument();
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
