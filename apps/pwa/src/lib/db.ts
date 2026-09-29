import Dexie, { type Table } from "dexie";
import {
  loadVersionNames,
  migrateState,
  mostUsedVersions,
  versionName,
  type SyncState,
  type TokenSet,
  type TokenStore,
} from "@bvs/core";

export interface VersionSetting {
  /** The name shown for it, worked out from the id by labelVersions; never saved. */
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

/**
 * Name each version as bible.com does. YouVersion reuses abbreviations (NVI
 * is Spanish, Castilian and two Portuguese versions), so a name another
 * version in the list shares gets its language, or its number when the
 * language is shared too: NVI (es), ARC (212). Worked out afresh whenever the
 * list changes, so removing one NVI turns the other back into plain NVI. Needs
 * the names chunk loaded (loadVersionNames); without it, versions are numbers.
 */
export function labelVersions(ids: readonly number[]): VersionSetting[] {
  const abbr = (id: number) => versionName(id)?.abbr ?? String(id);
  const language = (id: number) => versionName(id)?.language;
  return ids.map((bibleId) => {
    const same = ids.filter((id) => abbr(id).toUpperCase() === abbr(bibleId).toUpperCase());
    if (same.length === 1) return { bibleId, abbr: abbr(bibleId) };
    const lang = language(bibleId);
    const tag = lang && same.filter((id) => language(id) === lang).length === 1 ? lang : String(bibleId);
    return { bibleId, abbr: `${abbr(bibleId)} (${tag})` };
  });
}

/**
 * The names the app gave versions before the snapshot was keyed by bible id,
 * so a snapshot from then can be carried over (see migrateState). Settings
 * saved then hold the names themselves, and they win. Otherwise the old rule
 * named them: bible.com's abbreviation in capitals, the number after a
 * clash, or the number alone. That covers the example list, in use when
 * nothing was saved, and settings saved since with ids only (changed while
 * the snapshot was still waiting to be converted). A name two versions could
 * have had is left out, which leaves that snapshot behind rather than
 * guessing. Needs the names chunk loaded for any name but the saved ones.
 */
export function formerNames(saved: { abbr?: string; bibleId: number }[] | undefined, examples: readonly number[]): Map<string, number> {
  const names = new Map<string, number | null>();
  const add = (name: string, id: number) => names.set(name, names.has(name) && names.get(name) !== id ? null : id);
  const ids = [...(saved ?? []).map((v) => v.bibleId), ...examples, ...DEFAULT_SETTINGS.versions.map((v) => v.bibleId)];
  for (const id of new Set(ids)) {
    const abbr = (versionName(id)?.abbr ?? String(id)).toUpperCase();
    add(abbr, id);
    add(`${abbr}-${id}`, id);
    add(String(id), id);
  }
  for (const v of DEFAULT_SETTINGS.versions) add(v.abbr, v.bibleId);
  const out = new Map([...names].filter((e): e is [string, number] => e[1] !== null));
  for (const v of saved ?? []) if (v.abbr) out.set(v.abbr, v.bibleId);
  return out;
}

/**
 * Snapshots converted without every name they might need (offline, before
 * the names chunk was cached, with no names saved to go by). Converting drops
 * what it can't place, so such a snapshot is never saved: saving it would
 * lose the rest for good, while the next read online converts it fully.
 * Tracked by object, because a sync saves the very object it was given.
 */
const provisional = new WeakSet<SyncState>();

/**
 * The example list before the person chooses: the most used version of each
 * of their first three languages, then AMP. With none of their languages
 * known (or offline before the app was cached, without the names chunk), the
 * most used English version, so there are at least two.
 */
export async function defaultVersions(languages: readonly string[] = readerLanguages()): Promise<VersionSetting[]> {
  try {
    await loadVersionNames();
  } catch {
    return DEFAULT_SETTINGS.versions;
  }
  return labelVersions(await exampleIds(languages));
}

async function exampleIds(languages: readonly string[]): Promise<number[]> {
  const ids = mostUsedVersions(languages).filter((id) => id !== AMP);
  const english = mostUsedVersions(["en"]).filter((id) => id !== AMP);
  return [...(ids.length ? ids : english), AMP];
}

const readerLanguages = () => (typeof navigator === "undefined" ? [] : navigator.languages ?? [navigator.language]);

/** As saved: only ids now, and a name alongside each in settings saved before. */
interface SavedSettings extends Omit<Settings, "versions"> {
  versions: { bibleId: number; abbr?: string }[];
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
    const saved = await get<SavedSettings>("settings");
    if (!saved) return { ...DEFAULT_SETTINGS, versions: await defaultVersions() };
    await loadVersionNames().catch(() => undefined); // offline before the app was cached: numbers
    return { ...DEFAULT_SETTINGS, ...saved, versions: labelVersions(saved.versions.map((v) => v.bibleId)) };
  },
  /** Only ids are saved; names are worked out again on reading. */
  setSettings: (s: Settings) => put("settings", { ...s, versions: s.versions.map(({ bibleId }) => ({ bibleId })) }),
  /** Whether the person has saved settings, rather than seeing the defaults. */
  hasSettings: async () => (await get<SavedSettings>("settings")) !== undefined,

  /**
   * Per-version snapshot left by the last sync (see @bvs/core sync.ts). One
   * saved before it was keyed by bible id is converted, and saved converted,
   * the first time it's read.
   */
  getState: async (): Promise<SyncState> => {
    const saved = await get<SyncState>("state");
    if (!saved || saved.keys === "bibleId") return migrateState(saved, new Map());
    const settings = await get<SavedSettings>("settings");
    let examples: number[] = [];
    let named = true;
    try {
      await loadVersionNames();
      if (!settings) examples = await exampleIds(readerLanguages());
    } catch {
      // Offline before the app was cached: only saved names, and the built-in examples'.
      named = !!settings?.versions.every((v) => v.abbr);
    }
    const state = migrateState(saved, formerNames(settings?.versions, examples));
    if (named) await put("state", state);
    else provisional.add(state);
    return state;
  },
  /** Saves the snapshot, unless it's a provisional conversion (see above). */
  setState: async (s: SyncState) => {
    if (!provisional.has(s)) await put("state", s);
  },

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
