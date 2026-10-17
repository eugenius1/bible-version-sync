import { describe, expect, it } from "vitest";
import { ApiError, discoverVersions, PROBE_CHAPTERS, type Highlight } from "../src";

/** A fake API: highlights by "bibleId:chapter", or an error to throw. */
function fakeApi(data: Record<string, Highlight[] | ApiError>) {
  const calls: string[] = [];
  return {
    calls,
    async getHighlights(bibleId: number, passageId: string) {
      const key = `${bibleId}:${passageId}`;
      calls.push(key);
      const r = data[key] ?? [];
      if (r instanceof ApiError) throw r;
      return r;
    },
  };
}

const hl = (bibleId: number, ...passages: string[]): Highlight[] =>
  passages.map((passage_id) => ({ bible_id: bibleId, passage_id, color: "fffe00" }));

describe("discoverVersions", () => {
  it("finds versions with highlights in any probed chapter, counting distinct verses", async () => {
    const api = fakeApi({
      "111:JHN.3": hl(111, "JHN.3.16", "JHN.3.17", "JHN.3.16"),
      "93:PHP.4": hl(93, "PHP.4.13"),
    });
    const found = await discoverVersions({ api, bibleIds: [111, 93, 1] });
    expect(found).toEqual(new Map([[111, 2], [93, 1]]));
  });

  it("stops asking a version once it has found highlights there", async () => {
    const api = fakeApi({ "111:ISA.41": hl(111, "ISA.41.10") });
    await discoverVersions({ api, bibleIds: [111, 1], concurrency: 1 });
    expect(api.calls.filter((c) => c.startsWith("111:"))).toEqual(["111:ISA.41"]);
    expect(api.calls.filter((c) => c.startsWith("1:"))).toHaveLength(PROBE_CHAPTERS.length);
  });

  it("probes every version's first chapter before anyone's second", async () => {
    const api = fakeApi({});
    await discoverVersions({ api, bibleIds: [1, 2], concurrency: 1 });
    expect(api.calls.slice(0, 2)).toEqual(["1:ISA.41", "2:ISA.41"]);
  });

  it("treats a version the API refuses as not found", async () => {
    const api = fakeApi({ "5:JHN.3": new ApiError(403, "forbidden"), "5:PHP.4": new ApiError(404, "no such book") });
    expect(await discoverVersions({ api, bibleIds: [5] })).toEqual(new Map());
  });

  it("stops on a sign-in or network failure", async () => {
    for (const status of [401, 0, 503]) {
      const api = fakeApi({ "1:ISA.41": new ApiError(status, "x") });
      await expect(discoverVersions({ api, bibleIds: [1, 2, 3], concurrency: 1 })).rejects.toThrow();
      expect(api.calls).toEqual(["1:ISA.41"]);
    }
  });

  it("reports progress and can be cancelled", async () => {
    const seen: number[] = [];
    const controller = new AbortController();
    const api = fakeApi({});
    const run = discoverVersions({
      api,
      bibleIds: [1, 2, 3],
      concurrency: 1,
      signal: controller.signal,
      onProgress: (p) => {
        seen.push(p.done);
        if (p.done === 2) controller.abort();
      },
    });
    await expect(run).rejects.toThrow();
    expect(seen).toEqual([1, 2]);
    expect(api.calls).toHaveLength(2);
  });

  it("reports nothing for a request that finishes after the stop", async () => {
    const controller = new AbortController();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const api = {
      async getHighlights(bibleId: number) {
        await gate;
        return hl(bibleId, "ISA.41.10");
      },
    };
    const reports: number[] = [];
    const run = discoverVersions({
      api, bibleIds: [1, 2, 3, 4, 5], concurrency: 2, signal: controller.signal, onProgress: (p) => reports.push(p.done),
    });
    controller.abort();
    release();
    await expect(run).rejects.toMatchObject({ name: "AbortError" });
    expect(reports).toEqual([]);
  });

  it("hands the stop to each read", async () => {
    const controller = new AbortController();
    const signals: (AbortSignal | undefined)[] = [];
    const api = {
      async getHighlights(_id: number, _c: string, o?: { signal?: AbortSignal }) {
        signals.push(o?.signal);
        return [];
      },
    };
    await discoverVersions({ api, bibleIds: [1], signal: controller.signal });
    expect(signals.every((x) => x === controller.signal)).toBe(true);
  });
});
