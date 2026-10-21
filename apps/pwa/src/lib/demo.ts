import { emptyState, HIGHLIGHT_COLORS, loadVersionNames, ref, Standard, type SyncState } from "@bvs/core";
import { labelVersions, type VersionSetting } from "./db";

/** NIV, AMP and ESV. */
const DEMO_VERSIONS = [111, 1588, 59];

/**
 * A made-up sync memory, for looking at the stats page in development
 * without a real account (`npm run dev`, then `#stats?demo`). Never saved:
 * it would read as the person's own snapshot on the next sync.
 */
export async function demoData(): Promise<{ state: SyncState; versions: VersionSetting[] }> {
  await loadVersionNames().catch(() => undefined);
  return { state: demoState(), versions: labelVersions(DEMO_VERSIONS) };
}

export function demoState(): SyncState {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  const counts = Standard.load().counts.org;
  // Weighted towards the books people highlight most.
  const books: [string, number][] = [
    ["PSA", 40], ["JHN", 14], ["ROM", 10], ["ISA", 10], ["PRO", 9], ["MAT", 9], ["PHP", 4], ["EPH", 5],
    ["GEN", 8], ["HEB", 6], ["JAS", 4], ["1CO", 6], ["LUK", 7], ["ACT", 5], ["1JN", 4], ["JER", 3],
  ];
  // Yellow, blue and pink most, as on most people's screens.
  const palette = [2, 2, 2, 2, 6, 6, 6, 8, 8, 4, 1, 0, 3, 5, 7, 9].map((i) => HIGHLIGHT_COLORS[i].hex);
  const state = emptyState();
  for (const [book, chapters] of books) {
    const total = counts[book].length;
    for (let n = 0; n < chapters; n++) {
      const ch = 1 + Math.floor(random() * total);
      // ESV joined later, so it hasn't taken part everywhere.
      const members = random() < 0.75 ? DEMO_VERSIONS : DEMO_VERSIONS.slice(0, 2);
      state.members[`${book}.${ch}`] = members;
      const verses = counts[book][ch - 1];
      const highlighted = 1 + Math.floor(random() * Math.min(verses, 8));
      for (let k = 0; k < highlighted; k++) {
        const color = pick(palette);
        const colors: Record<number, string> = {};
        for (const id of members) {
          const roll = random();
          if (roll < 0.06) continue; // highlighted in only some versions
          colors[id] = roll < 0.12 ? pick(palette) : color;
        }
        const verse = ref(book, ch, 1 + Math.floor(random() * verses));
        if (Object.keys(colors).length) state.verses[verse] = colors;
        // Copies of the first version's colour count as the sync's.
        const lead = colors[members[0]];
        if (lead) for (const id of members.slice(1)) if (colors[id] === lead) (state.added[id] ??= {})[verse] = lead;
      }
    }
  }
  state.unwritable[1588] = ["ROM.16.25", "ROM.16.26", "ROM.16.27"];
  return state;
}
