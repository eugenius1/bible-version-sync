/** @vitest-environment jsdom */

import { emptyState, type HighlightColorId, type SyncState } from "@bvs/core";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { PACE_STORAGE_KEY } from "../../lib/pace";
import { StatsPage } from "../Stats";

let saved: SyncState;
vi.mock("../../lib/db", async (actual) => ({
  ...(await actual<typeof import("../../lib/db")>()),
  store: { getState: async () => saved },
}));

const VERSIONS = [
  { abbr: "NIV", bibleId: 111 },
  { abbr: "AMP", bibleId: 1588 },
];
const ORDER: HighlightColorId[] = ["pink", "yellow", "orange", "peach", "paleYellow", "green", "aqua", "blue", "purple", "grey"];

const renderStats = (demo = false) =>
  render(
    <I18nProvider>
      <StatsPage versions={VERSIONS} colorOrder={ORDER} demo={demo} />
    </I18nProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  saved = emptyState();
});

describe("StatsPage", () => {
  it("says when nothing has been synced", async () => {
    renderStats();
    expect(await screen.findByText(/Nothing synced yet/)).toBeInTheDocument();
  });

  it("shows the sync memory: versions, colours in the person's order, books and chapters", async () => {
    saved = {
      ...emptyState(),
      members: { "JHN.3": [111, 1588] },
      verses: {
        "JHN.3.16": { 111: "fffe00", 1588: "fffe00" },
        "JHN.3.17": { 111: "ff95ef", 1588: "ff95ef" },
      },
      added: { 1588: { "JHN.3.16": "fffe00", "JHN.3.17": "ff95ef" } },
    };
    renderStats();
    expect(await screen.findByText("2 highlights · 2 added by the sync")).toBeInTheDocument();
    expect(screen.getByText("NIV")).toBeInTheDocument();
    const legend = screen.getAllByRole("listitem").map((li) => li.textContent).filter((t) => /^(Pink|Yellow)/.test(t ?? ""));
    expect(legend).toEqual(["Pink 1", "Yellow 1", "Pink 1", "Yellow 1"]);
    expect(screen.getByText("John")).toBeInTheDocument();
    // Once by verses highlighted, once by their share of the chapter's 36.
    expect(screen.getAllByText("John 3")).toHaveLength(2);
    expect(screen.getByText("2 of 36 verses")).toBeInTheDocument();
    expect(screen.getByText("5.6%")).toBeInTheDocument();
    expect(screen.getByText(/Not measured yet/)).toBeInTheDocument();
  });

  it("shows made-up data, and says so, in demo mode", async () => {
    renderStats(true);
    expect(await screen.findByText(/Made-up data/)).toBeInTheDocument();
    expect(await screen.findByText("Psalms")).toBeInTheDocument();
  });

  it("shows speed in seconds to three decimals", async () => {
    saved = { ...emptyState(), verses: { "JHN.3.16": { 111: "fffe00" } } };
    localStorage.setItem(PACE_STORAGE_KEY, JSON.stringify({ msPerRead: 1234, msPerWrite: 850.4 }));
    renderStats();
    expect(await screen.findByText("1.234 s to read a chapter's highlights in one version")).toBeInTheDocument();
    expect(screen.getByText("0.850 s to write a highlight")).toBeInTheDocument();
  });
});
