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
      "93:JER.29": hl(93, "JER.29.11"),
    });
    const found = await discoverVersions({ api, bibleIds: [111, 93, 1] });
    expect(found).toEqual(new Map([[111, 2], [93, 1]]));
  });

  it("stops asking a version once it has found highlights there", async () => {
    const api = fakeApi({ "111:JHN.3": hl(111, "JHN.3.16") });
    await discoverVersions({ api, bibleIds: [111, 1], concurrency: 1 });
    expect(api.calls.filter((c) => c.startsWith("111:"))).toEqual(["111:JHN.3"]);
    expect(api.calls.filter((c) => c.startsWith("1:"))).toHaveLength(PROBE_CHAPTERS.length);
  });

  it("probes every version's first chapter before anyone's second", async () => {
    const api = fakeApi({});
    await discoverVersions({ api, bibleIds: [1, 2], concurrency: 1 });
    expect(api.calls.slice(0, 2)).toEqual(["1:JHN.3", "2:JHN.3"]);
  });

  it("treats a version the API refuses as not found", async () => {
    const api = fakeApi({ "5:JHN.3": new ApiError(403, "forbidden"), "5:ROM.8": new ApiError(404, "no such book") });
    expect(await discoverVersions({ api, bibleIds: [5] })).toEqual(new Map());
  });

  it("stops on a sign-in or network failure", async () => {
    for (const status of [401, 0, 503]) {
      const api = fakeApi({ "1:JHN.3": new ApiError(status, "x") });
      await expect(discoverVersions({ api, bibleIds: [1, 2, 3], concurrency: 1 })).rejects.toThrow();
      expect(api.calls).toEqual(["1:JHN.3"]);
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
});
