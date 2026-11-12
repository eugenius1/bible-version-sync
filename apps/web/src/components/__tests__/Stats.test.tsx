/** @vitest-environment jsdom */

import { emptyState, type HighlightColorId, type SyncState } from "@bvs/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  // jsdom has no canvas: the 3D charts draw nothing here, as in a browser without one.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
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
    expect(await screen.findByText("2 highlights · 2 added by syncing")).toBeInTheDocument();
    // Once in the chart of what syncing added, once in its own row.
    expect(screen.getAllByText("NIV")).toHaveLength(2);
    expect(screen.getByText("Added by syncing")).toBeInTheDocument();
    expect(screen.getByTitle("AMP: 2 highlights · 2 added by syncing").textContent).toBe("AMP+2");
    expect(screen.getByTitle("NIV: 2 highlights · 0 added by syncing").textContent).toBe("NIV0");
    const legend = screen.getAllByRole("listitem").map((li) => li.textContent).filter((t) => /^(Pink|Yellow)/.test(t ?? ""));
    expect(legend).toEqual(["Pink 1", "Yellow 1", "Pink 1", "Yellow 1"]);
    expect(screen.getByText("John")).toBeInTheDocument();
    // Once by verses highlighted, once by their share of the chapter's 36.
    expect(screen.getAllByText("John 3")).toHaveLength(2);
    expect(screen.getByText("2 of 36 verses")).toBeInTheDocument();
    expect(screen.getByText("5.6%")).toBeInTheDocument();
    expect(screen.getByText(/Not measured yet/)).toBeInTheDocument();
  });

  it("draws every book on the wheel, and names the one under the pointer", async () => {
    saved = { ...emptyState(), members: { "JHN.3": [111] }, verses: { "JHN.3.16": { 111: "fffe00" }, "JHN.3.17": { 111: "ff95ef" } } };
    const { container } = renderStats();
    await screen.findByText("John");
    expect(screen.getByText("Old Testament")).toBeInTheDocument();
    expect(container.querySelectorAll("svg title")).toHaveLength(66);
    const john = screen.getByText("John: 2 verses highlighted, 1 of 21 chapters synced", { selector: "title" });
    expect(screen.getAllByText("John")).toHaveLength(1);
    await userEvent.hover(john.parentElement!);
    expect(screen.getAllByText("John")).toHaveLength(2);
    // The spoke has a slice per colour, pink first as in the person's order.
    const slices = [...john.parentElement!.parentElement!.querySelectorAll("path[fill^='#']")].map((p) => p.getAttribute("fill"));
    expect(slices).toEqual(["#ff95ef", "#fffe00"]);
  });

  it("runs the wheel anticlockwise from 12 o'clock", async () => {
    saved = { ...emptyState(), verses: { "JHN.3.16": { 111: "fffe00" } } };
    const { container } = renderStats();
    await screen.findByText("John");
    // Where each book's slot begins, as [x, y] from the middle: x grows to the right, y downwards.
    const slots = [...container.querySelectorAll("svg title")].map((title) =>
      title.parentElement!.getAttribute("d")!.match(/^M(-?[\d.]+) (-?[\d.]+)/)!.slice(1).map(Number));
    const [genesis, job, revelation] = [slots[0], slots[17], slots[65]];
    expect(genesis[0]).toBeLessThan(0);
    expect(genesis[1]).toBeLessThan(-130);
    // A quarter of the way round, it's at 9 o'clock.
    expect(job[0]).toBeLessThan(-130);
    expect(Math.abs(job[1])).toBeLessThan(30);
    expect(revelation[0]).toBeGreaterThan(0);
    expect(revelation[1]).toBeLessThan(-130);
  });

  it("leaves out the chart of what syncing added when it added nothing", async () => {
    saved = { ...emptyState(), verses: { "JHN.3.16": { 111: "fffe00" } } };
    renderStats();
    await screen.findByText("John");
    expect(screen.queryByText("Added by syncing")).not.toBeInTheDocument();
  });

  it("labels the 3D charts for screen readers, and leaves out the colour chart with one book", async () => {
    saved = { ...emptyState(), verses: { "JHN.3.16": { 111: "fffe00" }, "JHN.3.17": { 111: "ff95ef" } } };
    renderStats();
    expect(await screen.findByRole("img", { name: "Chapter by chapter" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Book by book" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Colors by book" })).not.toBeInTheDocument();
  });

  it("gives a 3D chart's figures as a list, for whoever can't point at a bar", async () => {
    saved = { ...emptyState(), members: { "JHN.3": [111] }, verses: { "JHN.3.16": { 111: "fffe00" }, "JHN.3.17": { 111: "ff95ef" } } };
    renderStats();
    await screen.findByText("John");
    // Under the books and under the chapters; the colour chart is left out with one book.
    const lists = screen.getAllByText("Show as a list");
    expect(lists).toHaveLength(2);
    expect(screen.queryByText("John 3: 2 verses highlighted")).not.toBeInTheDocument();
    await userEvent.click(lists[1]);
    expect(await screen.findByText("John 3: 2 verses highlighted")).toBeInTheDocument();
    expect(within(lists[1].parentElement!).getAllByRole("listitem")).toHaveLength(1);
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
    expect(await screen.findByText("1.234 s to check one chapter in one version")).toBeInTheDocument();
    expect(screen.getByText("0.850 s to highlight a verse")).toBeInTheDocument();
  });
});
