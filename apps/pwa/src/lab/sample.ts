import { HIGHLIGHT_COLORS, type HighlightColorId } from "@bvs/core";
import { useEffect, useRef, useState } from "react";
import type { ResolvedVersion } from "../lib/versions";

/**
 * Made-up state for the lab pages, so they show every kind of row without an
 * account. Nothing here reads from or writes to YouVersion.
 */

export interface SampleVersion {
  bibleId: number;
  abbr: string;
  title: string;
  language: string;
  source: ResolvedVersion["source"];
}

export const SAMPLE_VERSIONS: SampleVersion[] = [
  { bibleId: 111, abbr: "NIV", title: "New International Version", language: "en", source: "verified" },
  { bibleId: 1, abbr: "KJV", title: "King James Version", language: "en", source: "verified" },
  { bibleId: 1588, abbr: "AMP", title: "Amplified Bible", language: "en", source: "scanned" },
  { bibleId: 93, abbr: "LSG", title: "Louis Segond 1910", language: "fr", source: "assumed" },
  { bibleId: 400, abbr: "SYNO", title: "Синодальный перевод", language: "ru", source: "unsupported" },
];

export const COLOR_HEX = Object.fromEntries(HIGHLIGHT_COLORS.map((c) => [c.id, `#${c.hex}`])) as Record<
  HighlightColorId,
  string
>;

export interface SampleChange {
  ref: string;
  color: HighlightColorId;
  from: string;
  to: string[];
}

export const SAMPLE_CHANGES: SampleChange[] = [
  { ref: "John 3:16", color: "yellow", from: "NIV", to: ["KJV", "AMP"] },
  { ref: "John 3:17", color: "yellow", from: "NIV", to: ["KJV", "AMP", "LSG"] },
  { ref: "John 3:30", color: "pink", from: "AMP", to: ["NIV", "KJV", "LSG"] },
  { ref: "John 3:36", color: "green", from: "LSG", to: ["NIV", "KJV", "AMP"] },
];

export type Kind = "chapter" | "book" | "bible";
export type FakeRun =
  | { status: "idle" }
  | { status: "running"; apply: boolean; pct: number }
  | { status: "done"; apply: boolean };

export const swap = <T,>(list: T[], i: number, d: -1 | 1): T[] => {
  const next = [...list];
  [next[i], next[i + d]] = [next[i + d], next[i]];
  return next;
};

/** Everything the main page holds, shared by both libraries' versions of it. */
export function useSampleMain() {
  const [versions, setVersions] = useState(SAMPLE_VERSIONS);
  const [byColor, setByColor] = useState(false);
  const [colorOrder, setColorOrder] = useState<HighlightColorId[]>(HIGHLIGHT_COLORS.map((c) => c.id));
  const [kind, setKind] = useState<Kind>("chapter");
  const [book, setBook] = useState("JHN");
  const [chapter, setChapter] = useState(3);
  const [run, setRun] = useState<FakeRun>({ status: "idle" });
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => () => clearInterval(timer.current), []);

  const start = (apply: boolean) => {
    clearInterval(timer.current);
    let pct = 0;
    setRun({ status: "running", apply, pct });
    timer.current = setInterval(() => {
      pct += 7;
      if (pct >= 100) {
        clearInterval(timer.current);
        setRun({ status: "done", apply });
      } else setRun({ status: "running", apply, pct });
    }, 120);
  };
  const stop = () => {
    clearInterval(timer.current);
    setRun({ status: "idle" });
  };

  return {
    versions,
    setVersions,
    byColor,
    setByColor,
    colorOrder,
    setColorOrder,
    kind,
    setKind,
    book,
    setBook,
    chapter,
    setChapter,
    run,
    start,
    stop,
    reset: () => setRun({ status: "idle" }),
  };
}
