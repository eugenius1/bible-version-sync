import { emptyState, runSync, VersionMap, type SyncState } from "@bvs/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Offline before the app was cached: the names chunk can't load.
let namesOffline = false;
vi.mock("@bvs/core", async (actual) => {
  const core = await actual<typeof import("@bvs/core")>();
  return {
    ...core,
    loadVersionNames: () => (namesOffline ? Promise.reject(new TypeError("Failed to fetch")) : core.loadVersionNames()),
  };
});

const { db, store } = await import("../db");

/** IndexedDB, as far as the store sees it. */
let saved: Map<string, unknown>;
beforeEach(() => {
  // A French reader, whose example list was LSG, NIV and AMP.
  vi.stubGlobal("navigator", { languages: ["fr-FR", "en"], language: "fr-FR" });
  namesOffline = false;
  saved = new Map();
  vi.spyOn(db.kv, "get").mockImplementation((async (key: string) =>
    saved.has(key) ? { key, value: saved.get(key) } : undefined) as never);
  vi.spyOn(db.kv, "put").mockImplementation((async ({ key, value }: { key: string; value: unknown }) => {
    saved.set(key, structuredClone(value));
    return key;
  }) as never);
});

// The example list was in use, never saved: LSG and NIV, as the old rule named them.
const legacy = () => ({
  verses: { "JHN.3.16": { LSG: "ffe066", NIV: "ffe066" } },
  members: { "JHN.3": ["LSG", "NIV"] },
  unwritable: {},
  maps: {},
});

describe("converting a snapshot saved by name", () => {
  it("converts and saves it when every name can be placed", async () => {
    saved.set("state", legacy());
    const state = await store.getState();
    expect(state.verses["JHN.3.16"]).toEqual({ 93: "ffe066", 111: "ffe066" });
    expect((saved.get("state") as SyncState).keys).toBe("bibleId");
  });

  it("never saves a conversion made without the names, so nothing is lost for good", async () => {
    namesOffline = true;
    saved.set("state", legacy());
    const state = await store.getState();
    expect(state.verses["JHN.3.16"]).toEqual({ 111: "ffe066" }); // LSG can't be placed offline
    expect(saved.get("state")).toEqual(legacy());

    // Not by a sync either, which saves the object it was given after every book.
    const niv = { abbr: "NIV", bibleId: 111, map: VersionMap.unsupported("NIV") };
    await runSync({
      api: { getHighlights: vi.fn(), setHighlight: vi.fn(), deleteHighlight: vi.fn() },
      versions: [niv],
      scope: { kind: "books", books: ["JHN"] },
      state,
      apply: true,
      onBookDone: () => store.setState(state),
    });
    await store.setState(state);
    expect(saved.get("state")).toEqual(legacy());

    // Online again: converted in full.
    namesOffline = false;
    expect((await store.getState()).verses["JHN.3.16"]).toEqual({ 93: "ffe066", 111: "ffe066" });
  });

  it("still lets the person reset it", async () => {
    namesOffline = true;
    saved.set("state", legacy());
    await store.getState();
    await store.setState(emptyState());
    expect(saved.get("state")).toEqual(emptyState());
  });

  it("converts offline when the settings saved the names", async () => {
    namesOffline = true;
    saved.set("settings", { versions: [{ abbr: "LSG", bibleId: 93 }, { abbr: "NIV", bibleId: 111 }], maxRemovals: 25 });
    saved.set("state", legacy());
    await store.getState();
    expect((saved.get("state") as SyncState).verses["JHN.3.16"]).toEqual({ 93: "ffe066", 111: "ffe066" });
  });
});
