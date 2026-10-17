/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RunState } from "../../App";
import { I18nProvider } from "../../i18n";
import { SyncCard } from "../SyncCard";

const reading = (apply: boolean): RunState => ({
  status: "running",
  apply,
  scope: { kind: "books", books: ["JHN"] },
  progress: { phase: "reading", book: "JHN", done: 3, total: 84, readDone: 3, readTotal: 84 },
});

function renderCard(run: RunState, stopping: boolean, onCancel = vi.fn()) {
  render(
    <I18nProvider>
      <SyncCard versions={null} run={run} stopping={stopping} onRun={vi.fn()} onCancel={onCancel} />
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
    };
    renderCard(run, true);
    expect(screen.getByText(/Stopping once Ruth is written…/)).toBeInTheDocument();
  });
});
