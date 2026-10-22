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
  remainingMs: null,
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
      remainingMs: 4000,
    };
    renderCard(run, true);
    expect(screen.getByText(/Stopping once Ruth is written…/)).toBeInTheDocument();
    // Stopping isn't governed by the estimate, so it isn't shown.
    expect(screen.queryByText(/about .* left/)).not.toBeInTheDocument();
  });

  it("shows the time left on a long run", () => {
    renderCard({ ...reading(false), remainingMs: 150_000 } as RunState, false);
    expect(screen.getByText(/Reading John · 3 of 84 chapters · about 3 minutes left/)).toBeInTheDocument();
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
    // 2 × 1,189 chapters at the assumed 100 ms.
    expect(screen.getByText("Reads 2,378 chapters, which takes about 4 minutes. Keep this page open.")).toBeInTheDocument();
  });

  it("estimates a long book, but not a chapter or a short book", async () => {
    renderCard(idle, false, vi.fn(), VERSIONS);
    expect(screen.queryByText(/which takes about/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Book" }));
    // John: 42 reads, about 4 seconds.
    expect(screen.queryByText(/which takes about/)).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Book" }), "PSA");
    expect(screen.getByText(/Reads 300 chapters, which takes about 30 seconds/)).toBeInTheDocument();
  });

  it("starts from the pace this browser measured last time", async () => {
    localStorage.setItem(PACE_STORAGE_KEY, JSON.stringify({ msPerRead: 400 }));
    renderCard(idle, false, vi.fn(), VERSIONS);
    await userEvent.click(screen.getByRole("radio", { name: "Book" }));
    // John at 400 ms a chapter: 17 seconds, rounded up to 20.
    expect(screen.getByText(/Reads 42 chapters, which takes about 20 seconds/)).toBeInTheDocument();
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
