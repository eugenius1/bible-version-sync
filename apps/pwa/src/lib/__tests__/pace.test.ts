/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import { PACE_STORAGE_KEY, persistPace, storedPace } from "../pace";

describe("pace", () => {
  it("is empty until something is measured", () => {
    expect(storedPace()).toEqual({});
  });

  it("keeps what was measured, and a write rate from an earlier run when this one wrote nothing", () => {
    persistPace({ msPerRead: 120, msPerWrite: 400 });
    persistPace({ msPerRead: 90 });
    expect(storedPace()).toEqual({ msPerRead: 90, msPerWrite: 400 });
  });

  it("ignores anything that isn't a positive number", () => {
    localStorage.setItem(PACE_STORAGE_KEY, JSON.stringify({ msPerRead: -1, msPerWrite: "fast" }));
    expect(storedPace()).toEqual({});
    localStorage.setItem(PACE_STORAGE_KEY, "{not json");
    expect(storedPace()).toEqual({});
  });

  it("does without storage when the browser blocks it", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(storedPace()).toEqual({});
    expect(() => persistPace({ msPerRead: 100 })).not.toThrow();
    get.mockRestore();
    set.mockRestore();
  });
});
