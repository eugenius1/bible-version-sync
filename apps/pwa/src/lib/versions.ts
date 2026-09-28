import {
  ApiError,
  buildVersionMap,
  hasKnownCounts,
  versionName,
  type NumberingSource,
  type SyncVersion,
} from "@bvs/core";
import { client } from "./auth";
import { store, type VersionSetting } from "./db";

export { parseVersionInput, versionName } from "@bvs/core";

export type { NumberingSource };

export interface ResolvedVersion extends SyncVersion {
  title?: string;
  source: NumberingSource;
  /** Chapters fitting neither English nor Hebrew numbering, when counts are known. */
  unfit?: number;
}

/**
 * Build verse maps for the configured versions. Versions with bundled counts
 * (the four verified ones and the others scanned for the survey) use them
 * without asking the API; others use the API index when the app key may read
 * it (cached), else the version's bundled numbering label (Synodal,
 * Septuagint, Vulgate) or English numbering is assumed.
 *
 * A version whose counts fit neither English nor Hebrew numbering in too
 * many chapters, with no label naming the system it follows, comes back
 * "unsupported" with an empty map: the add form refuses it, and the sync
 * leaves a saved one out (see buildVersionMap).
 *
 * Everything is looked up by bible id. A setting's `abbr` is the name the
 * person chose, which is also what the sync snapshot is keyed by, so saved
 * settings carry over unchanged whatever they're called.
 */
export async function resolveVersions(settings: VersionSetting[]): Promise<ResolvedVersion[]> {
  const out: ResolvedVersion[] = [];
  for (const v of settings) out.push(await resolveVersion(v));
  return out;
}

/** One version's map, as resolveVersions builds it. */
export async function resolveVersion(v: VersionSetting): Promise<ResolvedVersion> {
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
  const { map, source, unfit } = buildVersionMap(v.abbr, v.bibleId, index ?? undefined);
  return { abbr: v.abbr, bibleId: v.bibleId, map, source, unfit, title: versionName(v.bibleId)?.title };
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
