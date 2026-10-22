/** @vitest-environment jsdom */

import { buildVersionMap } from "@bvs/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RunState } from "../../App";
import { I18nProvider } from "../../i18n";
import { PACE_STORAGE_KEY } from "../../lib/pace";
import type { ResolvedVersion } from "../../lib/versions";
import { SyncCard } from "../SyncCard";

const resolved = (abbr: string, id: number): ResolvedVersion => ({
  abbr,
  bibleId: id,
  map: buildVersionMap(abbr, id).map,
  source: "verified",
});
const VERSIONS = [resolved("NIV", 111), resolved("AMP", 1588)];

const reading = (apply: boolean): RunState => ({
  status: "running",
  apply,
  scope: { kind: "books", books: ["JHN"] },
  progress: { phase: "reading", book: "JHN", done: 3, total: 84, readDone: 3, readTotal: 84 },
  remaining: null,
});

function renderCard(run: RunState, stopping: boolean, onCancel = vi.fn(), versions: ResolvedVersion[] | null = null) {
  render(
    <I18nProvider>
      <SyncCard versions={versions} run={run} stopping={stopping} onRun={vi.fn()} onCancel={onCancel} />
    </I18nProvider>,
  );
  return onCancel;
}

describe("SyncCard while running", () => {
  it("offers Stop, and explains that a book being written finishes first", async () => {
    const onCancel = renderCard(reading(true), false);
    expect(screen.getByText(/Stopping now leaves a book/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("has no such note for a preview, which writes nothing", () => {
    renderCard(reading(false), false);
    expect(screen.queryByText(/Stopping now leaves a book/)).not.toBeInTheDocument();
  });

  it("shows that it's stopping, and can't be stopped twice", () => {
    renderCard(reading(false), true);
    expect(screen.getByRole("button", { name: "Stopping" })).toBeDisabled();
    expect(screen.getByText(/Stopping…/)).toBeInTheDocument();
    expect(screen.queryByText(/Reading John/)).not.toBeInTheDocument();
  });

  it("names the book it's finishing when stopped while writing", () => {
    const run: RunState = {
      status: "running",
      apply: true,
      scope: { kind: "books", books: ["RUT", "JHN"] },
      progress: { phase: "writing", book: "RUT", done: 1, total: 4, readDone: 16, readTotal: 100 },
      remaining: { minMs: 4000, maxMs: 4000 },
    };
    renderCard(run, true);
    expect(screen.getByText(/Stopping once Ruth is written…/)).toBeInTheDocument();
    // Stopping isn't governed by the estimate, so it isn't shown.
    expect(screen.queryByText(/about .* left/)).not.toBeInTheDocument();
  });

  it("shows the time left on a long run", () => {
    renderCard({ ...reading(false), remaining: { minMs: 150_000, maxMs: 150_000 } } as RunState, false);
    expect(screen.getByText("Previewing — about 3 minutes left")).toBeInTheDocument();
  });

  it("gives a sync's time left as a range, at least the reads and at most every write", () => {
    renderCard({ ...reading(true), remaining: { minMs: 7 * 60_000, maxMs: 77 * 60_000 } } as RunState, false);
    expect(screen.getByText("Syncing — 7–77 minutes left")).toBeInTheDocument();
  });

  it("shows the whole run's progress in the bar, and the book's only over several books", () => {
    const run: RunState = {
      ...reading(true),
      scope: { kind: "books", books: ["GEN", "JHN"] },
      progress: { phase: "reading", book: "JHN", done: 21, total: 84, readDone: 123, readTotal: 1000 },
    } as RunState;
    renderCard(run, false);
    expect(screen.getByText("Reading John — 25%")).toBeInTheDocument();
    expect(screen.getAllByText("12.3%")).toHaveLength(2); // one copy for each side of the fill
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "12.3");
  });

  it("holds the bar short of 100% while the last book is written", () => {
    renderCard({ ...reading(true), progress: { phase: "writing", book: "JHN", done: 1, total: 9, readDone: 84, readTotal: 84 } } as RunState, false);
    expect(screen.getAllByText("99.9%")).toHaveLength(2);
  });

  it("leaves the book's progress out when the run is one book", () => {
    renderCard(reading(false), false);
    expect(screen.getByText("Reading John")).toBeInTheDocument();
  });

  it("shows no time left on a quick one", () => {
    renderCard(reading(false), false);
    expect(screen.queryByText(/about .* left/)).not.toBeInTheDocument();
  });
});

describe("SyncCard before running", () => {
  const idle: RunState = { status: "idle" };

  it("estimates the whole Bible", async () => {
    renderCard(idle, false, vi.fn(), VERSIONS);
    await userEvent.click(screen.getByRole("radio", { name: "Whole Bible" }));
    // 2 × 1,189 chapters at the assumed 100 ms; a sync may also copy a
    // tenth of the Bible's verses into the other version, at 350 ms each.
    expect(
      screen.getByText("Reads 2,378 chapters: about 4 minutes for a preview, 4–22 minutes for a sync. Keep this page open."),
    ).toBeInTheDocument();
  });

  it("estimates a book whose sync may write a lot, but not a chapter", async () => {
    render(
      <I18nProvider>
        <SyncCard versions={VERSIONS} run={idle} stopping={false} remembered={{ JHN: 300 }} onRun={vi.fn()} onCancel={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.queryByText(/Reads/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Book" }));
    // John: 42 reads, about 4 seconds; 300 remembered verses at 350 ms, about 2 minutes.
    expect(screen.getByText("Reads 42 chapters: about 5 seconds for a preview, 5 seconds – 2 minutes for a sync. Keep this page open.")).toBeInTheDocument();
  });

  it("starts from the pace this browser measured last time", async () => {
    localStorage.setItem(PACE_STORAGE_KEY, JSON.stringify({ msPerRead: 400 }));
    renderCard(idle, false, vi.fn(), VERSIONS);
    await userEvent.click(screen.getByRole("radio", { name: "Book" }));
    // John at 400 ms a chapter: 17 seconds, rounded up to 20.
    expect(screen.getByText(/Reads 42 chapters: about 20 seconds for a preview/)).toBeInTheDocument();
  });
});

describe("SyncCard after a run stopped", () => {
  it("says where the next sync picks up, and can start over", async () => {
    const onStartOver = vi.fn();
    render(
      <I18nProvider>
        <SyncCard
          versions={VERSIONS}
          run={{ status: "idle" }}
          stopping={false}
          onRun={vi.fn()}
          resumesAt={(scope, apply) => (apply && scope.kind === "books" && scope.books.length > 1 ? "PSA" : undefined)}
          onStartOver={onStartOver}
          onCancel={vi.fn()}
        />
      </I18nProvider>,
    );
    expect(screen.queryByText(/picks up at/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Whole Bible" }));
    expect(screen.getByText("The next sync picks up at Psalms, where the last one stopped.")).toBeInTheDocument();
    expect(screen.queryByText(/next preview/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(onStartOver).toHaveBeenCalledOnce();
  });
});
