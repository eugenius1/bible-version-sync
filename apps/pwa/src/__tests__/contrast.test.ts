import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

/**
 * Contrast of the palette, measured rather than assumed.
 *
 * Reads Tailwind's own colour values and checks the text/background pairings
 * the components actually use, in both themes, so a class change can't quietly
 * drop something below WCAG 2.2 AA: 4.5:1 for text, 3:1 for non-text things
 * such as focus rings, icons that carry meaning and the progress bar.
 * Disabled controls are exempt under WCAG and aren't listed.
 */

const themeCss = readFileSync(createRequire(import.meta.url).resolve("tailwindcss/theme.css"), "utf8");

const PALETTE: Record<string, [number, number, number]> = Object.fromEntries(
  [...themeCss.matchAll(/--color-([a-z]+-\d+):\s*oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)/g)].map((m) => [
    m[1],
    [Number(m[2]) / 100, Number(m[3]), Number(m[4])],
  ]),
);

/** OKLCH -> linear sRGB (clipped to the gamut), per Björn Ottosson's OKLab. */
function linearRgb(name: string): [number, number, number] {
  if (name === "white") return [1, 1, 1];
  const c = PALETTE[name];
  if (!c) throw new Error(`unknown colour ${name}`);
  const [L, C, h] = c;
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clip = (v: number) => Math.min(1, Math.max(0, v));
  return [
    clip(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clip(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clip(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

const luminance = (name: string) => {
  const [r, g, b] = linearRgb(name);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

function contrast(fg: string, bg: string): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

type Pair = { label: string; fg: string; bg: string; need: 4.5 | 3 };

/** The pairings the components make: [light, dark] per row. */
const PAIRS: Array<[Pair, Pair]> = [
  [
    { label: "body text on a card", fg: "stone-900", bg: "white", need: 4.5 },
    { label: "body text on a card", fg: "stone-100", bg: "stone-900", need: 4.5 },
  ],
  [
    { label: "body text on the page", fg: "stone-900", bg: "stone-50", need: 4.5 },
    { label: "body text on the page", fg: "stone-100", bg: "stone-950", need: 4.5 },
  ],
  [
    { label: "secondary text on a card", fg: "stone-600", bg: "white", need: 4.5 },
    { label: "secondary text on a card", fg: "stone-400", bg: "stone-900", need: 4.5 },
  ],
  [
    { label: "footer text on the page", fg: "stone-600", bg: "stone-50", need: 4.5 },
    { label: "footer text on the page", fg: "stone-400", bg: "stone-950", need: 4.5 },
  ],
  [
    { label: "list numbers on a card", fg: "stone-500", bg: "white", need: 4.5 },
    { label: "list numbers on a card", fg: "stone-400", bg: "stone-900", need: 4.5 },
  ],
  [
    { label: "unselected scope tab", fg: "stone-600", bg: "stone-100", need: 4.5 },
    { label: "unselected scope tab", fg: "stone-400", bg: "stone-800", need: 4.5 },
  ],
  [
    { label: "primary button label", fg: "white", bg: "stone-900", need: 4.5 },
    { label: "primary button label", fg: "stone-900", bg: "stone-100", need: 4.5 },
  ],
  [
    { label: "verified-numbering badge", fg: "emerald-900", bg: "emerald-100", need: 4.5 },
    { label: "verified-numbering badge", fg: "emerald-200", bg: "emerald-950", need: 4.5 },
  ],
  [
    { label: "API-numbering and counts-known badges", fg: "sky-900", bg: "sky-100", need: 4.5 },
    { label: "API-numbering and counts-known badges", fg: "sky-200", bg: "sky-950", need: 4.5 },
  ],
  [
    { label: "assumed-numbering badge", fg: "amber-900", bg: "amber-100", need: 4.5 },
    { label: "assumed-numbering badge", fg: "amber-200", bg: "amber-950", need: 4.5 },
  ],
  [
    { label: "unsupported-numbering badge", fg: "red-900", bg: "red-100", need: 4.5 },
    { label: "unsupported-numbering badge", fg: "red-200", bg: "red-950", need: 4.5 },
  ],
  [
    { label: "assumed-numbering warning on a card", fg: "amber-900", bg: "white", need: 4.5 },
    { label: "assumed-numbering warning on a card", fg: "amber-200", bg: "stone-900", need: 4.5 },
  ],
  [
    { label: "error text on a card", fg: "red-700", bg: "white", need: 4.5 },
    { label: "error text on a card", fg: "red-300", bg: "stone-900", need: 4.5 },
  ],
  [
    { label: "warning notice", fg: "amber-950", bg: "amber-50", need: 4.5 },
    { label: "warning notice", fg: "amber-100", bg: "amber-950", need: 4.5 },
  ],
  [
    { label: "error notice", fg: "red-900", bg: "red-50", need: 4.5 },
    { label: "error notice", fg: "red-100", bg: "red-950", need: 4.5 },
  ],
  [
    { label: "in-sync tick", fg: "emerald-700", bg: "white", need: 3 },
    { label: "in-sync tick", fg: "emerald-400", bg: "stone-900", need: 3 },
  ],
  [
    { label: "focus ring on a card", fg: "amber-600", bg: "white", need: 3 },
    { label: "focus ring on a card", fg: "amber-500", bg: "stone-900", need: 3 },
  ],
  [
    { label: "progress bar in its track", fg: "amber-700", bg: "stone-200", need: 3 },
    { label: "progress bar in its track", fg: "amber-500", bg: "stone-800", need: 3 },
  ],
];

describe.each([
  ["light", 0],
  ["dark", 1],
] as const)("palette contrast in %s mode", (_mode, i) => {
  for (const pair of PAIRS) {
    const { label, fg, bg, need } = pair[i];
    it(`${label} (${fg} on ${bg}) meets ${need}:1`, () => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(need);
    });
  }
});

describe("the colour maths", () => {
  it("reads Tailwind's palette", () => {
    expect(Object.keys(PALETTE).length).toBeGreaterThan(200);
  });

  it("agrees with known sRGB values", () => {
    // stone-900 is #1c1917 and stone-50 is #fafaf9 in Tailwind's docs.
    expect(contrast("stone-900", "stone-50")).toBeCloseTo(16.7, 0);
    expect(contrast("white", "white")).toBe(1);
  });

  it("records why light mode uses darker ambers for the focus ring and progress bar", () => {
    expect(contrast("amber-500", "white")).toBeLessThan(3);
    expect(contrast("amber-600", "stone-200")).toBeLessThan(3);
  });
});
