/**
 * YouVersion's highlight colours, in rainbow order (by hue, grey last). The
 * Android app offers them as purple, aqua, yellow, green, blue, peach, pink,
 * pale yellow, orange and grey; rainbow order is easier to scan.
 *
 * The web reader offers five (yellow, green, blue, peach, pink) and their
 * values are exact, read off bible.com. The other five are Android only and
 * were recovered from a screenshot of its picker, which draws each swatch at
 * about 55% opacity over a grey panel: undoing that gives the web five back
 * exactly, and these to within a unit or two per channel. That's why a
 * highlight is ranked by the nearest palette colour rather than by equality.
 */
export const HIGHLIGHT_COLORS = [
  { id: "orange", hex: "f19d33" },
  { id: "peach", hex: "ffc66f" },
  { id: "yellow", hex: "fffe00" },
  { id: "paleYellow", hex: "fffd94" },
  { id: "green", hex: "5eff79" },
  { id: "aqua", hex: "56f2ff" },
  { id: "blue", hex: "00d6ff" },
  { id: "purple", hex: "aa00ff" },
  { id: "pink", hex: "ff95ef" },
  { id: "grey", hex: "e0e0e0" },
] as const;

export type HighlightColorId = (typeof HIGHLIGHT_COLORS)[number]["id"];

const rgb = (hex: string) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** The palette colour closest to `hex` (lower case, no #). */
export function nearestColor(hex: string): HighlightColorId {
  const c = rgb(hex);
  let best: HighlightColorId = HIGHLIGHT_COLORS[0].id;
  let bestD = Infinity;
  for (const p of HIGHLIGHT_COLORS) {
    const d = rgb(p.hex).reduce((s, v, i) => s + (v - c[i]) ** 2, 0);
    if (d < bestD) [best, bestD] = [p.id, d];
  }
  return best;
}

/**
 * A rank per colour from the person's order, lower first. A colour left out
 * of the order ranks after every listed one, and a removal (null) after
 * every colour, so a highlight is preferred to taking one away.
 */
export function colorRanker(order: readonly HighlightColorId[]): (hex: string | null) => number {
  return (hex) => {
    if (hex === null) return order.length + 1;
    const i = order.indexOf(nearestColor(hex));
    return i === -1 ? order.length : i;
  };
}
