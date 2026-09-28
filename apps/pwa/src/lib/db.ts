import Dexie, { type Table } from "dexie";
import { emptyState, type SyncState, type TokenSet, type TokenStore } from "@bvs/core";

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
    { abbr: "AMP", bibleId: 1588 },
    { abbr: "NIV", bibleId: 111 },
    { abbr: "LSG", bibleId: 93 },
    { abbr: "S21", bibleId: 152 },
  ],
  maxRemovals: 25,
};

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
  getSettings: async (): Promise<Settings> => ({ ...DEFAULT_SETTINGS, ...(await get<Settings>("settings")) }),
  setSettings: (s: Settings) => put("settings", s),

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
