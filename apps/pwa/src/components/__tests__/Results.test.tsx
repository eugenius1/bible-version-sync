/** @vitest-environment jsdom */

import type { BookPlan, RunSummary } from "@bvs/core";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { Results } from "../Results";

// The person's list, in order: AMP first, though NIV's id is lower.
const names = new Map([
  [1588, "AMP"],
  [111, "NIV"],
  [128, "NVI (es)"],
]);

const plan: BookPlan = {
  book: "ROM",
  actions: [
    { version: 128, op: "set", local: "ROM.8.28", color: "ff9999", canon: "ROM.8.28", reason: "fill" },
    { version: 128, op: "set", local: "ROM.8.29", color: "ff9999", canon: "ROM.8.29", reason: "fill" },
    { version: 1588, op: "remove", local: "ROM.8.1", color: null, canon: "ROM.8.1", reason: "remove" },
  ],
  differences: [
    // Keyed by bible id, so the object's keys come back sorted by id: NIV (111) before AMP (1588).
    { canon: "ROM.8.30", ref: "ROM.8.30", colors: { 1588: "ffe066", 111: "a3d9ff" }, winner: 111, color: "a3d9ff" },
  ],
  newState: {},
  members: {},
  counts: {},
  maps: {},
  remapped: [],
};

const summary: RunSummary = {
  books: [{ book: "ROM", plan, writeErrors: [] }],
  sets: 2,
  removals: 1,
  differences: 1,
  failedBooks: 0,
  blockedBooks: 0,
  writeErrors: 0,
  aborted: false,
  refused: [999998],
};

describe("Results", () => {
  it("names each version by its label, differences in the list's order", async () => {
    render(
      <I18nProvider>
        <Results
          run={{ status: "done", apply: false, scope: { kind: "books", books: ["ROM"] }, summary }}
          names={names}
          onApply={vi.fn()}
          onApplyAllowingRemovals={vi.fn()}
          onSignInAgain={vi.fn()}
        />
      </I18nProvider>,
    );
    // A version the list doesn't name (here, one refused) falls back to its number.
    expect(screen.getByText(/numbering isn't supported: 999998\./)).toBeInTheDocument();
    expect(screen.getByText("NVI (es) +2")).toBeInTheDocument();
    expect(screen.getByText("AMP −1")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Romans"));
    const [, colors] = screen.getByText("Different colors").closest("div")!.querySelectorAll("p");
    expect(colors.textContent).toBe("AMPNIV"); // the list's order, not the ids'
    expect(screen.getByText(/versions without a highlight get NIV's color/)).toBeInTheDocument();
    expect(screen.getAllByText("NVI (es)")).toHaveLength(2); // one row per action
  });
});

describe("a stopped run", () => {
  const stopped = (books: RunSummary["books"], apply = false) =>
    render(
      <I18nProvider>
        <Results
          run={{
            status: "done",
            apply,
            scope: { kind: "books", books: ["PSA", "PRO"] },
            summary: { ...summary, books, sets: 0, removals: 0, differences: 0, aborted: true, refused: [] },
          }}
          names={names}
          onApply={vi.fn()}
          onApplyAllowingRemovals={vi.fn()}
          onSignInAgain={vi.fn()}
        />
      </I18nProvider>,
    );
  const empty: BookPlan = { ...plan, book: "PSA", actions: [], differences: [] };

  it("doesn't claim everything is in sync when it finished no book", () => {
    stopped([]);
    expect(screen.getByRole("heading", { name: "Preview (stopped)" })).toBeInTheDocument();
    expect(screen.getByText(/Stopped before a whole book was read/)).toBeInTheDocument();
    expect(screen.queryByText(/everything is in sync/)).not.toBeInTheDocument();
  });

  it("speaks only for the books it finished", () => {
    stopped([{ book: "PSA", plan: empty, writeErrors: [] }]);
    expect(screen.getByText("Nothing to change in the book read before stopping.")).toBeInTheDocument();
    cleanup();
    stopped([{ book: "PSA", plan: empty, writeErrors: [] }], true);
    expect(screen.getByText("Nothing needed changing in the book synced before stopping.")).toBeInTheDocument();
  });
});

describe("a run YouVersion rate limited", () => {
  it("says how long to wait, and doesn't suggest signing in again", () => {
    render(
      <I18nProvider>
        <Results
          run={{
            status: "done",
            apply: true,
            scope: { kind: "books", books: ["PSA"] },
            summary: { ...summary, books: [], sets: 0, removals: 0, differences: 0, refused: [], fatal: { reason: "rateLimited", message: "x", retryAfter: 90 } },
          }}
          names={names}
          onApply={vi.fn()}
          onApplyAllowingRemovals={vi.fn()}
          onSignInAgain={vi.fn()}
        />
      </I18nProvider>,
    );
    expect(screen.getByText(/Try again in 2 minutes\. Nothing more was changed\./)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in again" })).not.toBeInTheDocument();
  });
});
