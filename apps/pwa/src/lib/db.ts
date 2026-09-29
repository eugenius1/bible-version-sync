import Dexie, { type Table } from "dexie";
import {
  emptyState,
  loadVersionNames,
  mostUsedVersions,
  versionName,
  type SyncState,
  type TokenSet,
  type TokenStore,
} from "@bvs/core";

export interface VersionSetting {
  abbr: string;
  bibleId: number;
}

export interface Settings {
  /** Order matters: when colors differ, blank verses get the first version's color. */
  versions: VersionSetting[];
  maxRemovals: number;
}

export const DEFAULT_SETTINGS: Settings = {
  versions: [
    { abbr: "NIV", bibleId: 111 },
    { abbr: "AMP", bibleId: 1588 },
  ],
  maxRemovals: 25,
};

const AMP = 1588;

/** A setting for a version, named as bible.com names it unless another version already has that name. */
export function settingFor(bibleId: number, taken: readonly VersionSetting[]): VersionSetting {
  const abbr = (versionName(bibleId)?.abbr ?? String(bibleId)).toUpperCase();
  return { bibleId, abbr: taken.some((s) => s.abbr === abbr) ? `${abbr}-${bibleId}` : abbr };
}

/**
 * The example list before the person chooses: the most used version of each
 * of their first three languages, then AMP. With none of their languages
 * known (or offline before the app was cached, without the names chunk), the
 * most used English version, so there are at least two.
 */
export async function defaultVersions(
  languages: readonly string[] = typeof navigator === "undefined" ? [] : navigator.languages ?? [navigator.language],
): Promise<VersionSetting[]> {
  try {
    await loadVersionNames();
  } catch {
    return DEFAULT_SETTINGS.versions;
  }
  const ids = mostUsedVersions(languages).filter((id) => id !== AMP);
  const out: VersionSetting[] = [];
  const english = mostUsedVersions(["en"]).filter((id) => id !== AMP);
  for (const id of [...(ids.length ? ids : english), AMP]) out.push(settingFor(id, out));
  return out;
}

interface KV {
  key: string;
  value: unknown;
}

class Db extends Dexie {
  kv!: Table<KV, string>;

  constructor() {
    super("bible-version-sync");
    this.version(1).stores({ kv: "key" });
  }
}

export const db = new Db();

async function get<T>(key: string): Promise<T | undefined> {
  return (await db.kv.get(key))?.value as T | undefined;
}

async function put(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value });
}

export const store = {
  getSettings: async (): Promise<Settings> => {
    const saved = await get<Settings>("settings");
    return { ...DEFAULT_SETTINGS, ...(saved ?? { versions: await defaultVersions() }) };
  },
  setSettings: (s: Settings) => put("settings", s),
  /** Whether the person has saved settings, rather than seeing the defaults. */
  hasSettings: async () => (await get<Settings>("settings")) !== undefined,

  /** Per-version snapshot left by the last sync (see @bvs/core sync.ts). */
  getState: async (): Promise<SyncState> => ({ ...emptyState(), ...(await get<SyncState>("state")) }),
  setState: (s: SyncState) => put("state", s),

  /** Cached /v1/bibles/{id}/index, or null when the app key may not read it. */
  getIndex: (bibleId: number) => get<unknown | null>(`index:${bibleId}`),
  setIndex: (bibleId: number, index: unknown | null) => put(`index:${bibleId}`, index),

  clearAll: () => db.kv.clear(),
};

export const tokenStore: TokenStore & { clear(): Promise<void> } = {
  get: async () => (await get<TokenSet>("tokens")) ?? null,
  set: (t: TokenSet) => put("tokens", t),
  clear: () => db.kv.delete("tokens"),
};
