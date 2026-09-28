import {
  ApiError,
  VERIFIED_VERSIONS,
  buildVersionMap,
  hasKnownCounts,
  type NumberingSource,
  type SyncVersion,
} from "@bvs/core";
import { client } from "./auth";
import { store, type VersionSetting } from "./db";

export { parseVersionInput } from "@bvs/core";

export type { NumberingSource };

export interface ResolvedVersion extends SyncVersion {
  title?: string;
  source: NumberingSource;
}

export const titleOf = (bibleId: number) => VERIFIED_VERSIONS.find((v) => v.bibleId === bibleId)?.title;

/**
 * Build verse maps for the configured versions. Versions with bundled counts
 * (the four verified ones and the others scanned for the survey) use them
 * without asking the API; others use the API index when the app key may read
 * it (cached), else the version's bundled numbering label (Synodal,
 * Septuagint, Vulgate) or English numbering is assumed.
 *
 * Everything is looked up by bible id. A setting's `abbr` is the name the
 * person chose, which is also what the sync snapshot is keyed by, so saved
 * settings carry over unchanged whatever they're called.
 */
export async function resolveVersions(settings: VersionSetting[]): Promise<ResolvedVersion[]> {
  const out: ResolvedVersion[] = [];
  for (const v of settings) {
    let index: unknown | null | undefined;
    if (!hasKnownCounts(v.bibleId)) {
      index = await store.getIndex(v.bibleId);
      if (index === undefined) {
        try {
          index = await client.getIndex(v.bibleId);
        } catch (e) {
          if (!(e instanceof ApiError)) throw e;
          index = null; // not licensed to this app key; don't ask again
        }
        await store.setIndex(v.bibleId, index);
      }
    }
    const { map, source } = buildVersionMap(v.abbr, v.bibleId, index ?? undefined);
    out.push({ abbr: v.abbr, bibleId: v.bibleId, map, source, title: titleOf(v.bibleId) });
  }
  return out;
}

/** Quick check that highlights can be read for a version. */
export async function canReadHighlights(bibleId: number): Promise<string | null> {
  try {
    await client.getHighlights(bibleId, "JHN.3");
    return null;
  } catch (e) {
    return e instanceof ApiError ? e.detail || `HTTP ${e.status}` : String(e);
  }
}
