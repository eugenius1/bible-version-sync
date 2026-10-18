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

/** What a mocked "Find my versions" turns up, and how far into the scan each one appears. */
export interface SampleFound {
  version: SampleVersion;
  verses: number;
  at: number;
}

const FOUND: SampleFound[] = [
  { version: SAMPLE_VERSIONS[0], verses: 42, at: 3 },
  { version: { bibleId: 59, abbr: "ESV", title: "English Standard Version", language: "en", source: "verified" }, verses: 17, at: 8 },
  { version: SAMPLE_VERSIONS[2], verses: 9, at: 14 },
  { version: { bibleId: 116, abbr: "NLT", title: "New Living Translation", language: "en", source: "verified" }, verses: 4, at: 21 },
  { version: { bibleId: 385, abbr: "CARS", title: "Священное Писание (Восточный перевод)", language: "ru", source: "unsupported" }, verses: 6, at: 27 },
];
export const FIND_TOTAL = 36;

export type FakeScan =
  | { status: "idle" }
  | { status: "running"; done: number; found: SampleFound[] }
  | { status: "done"; found: SampleFound[] }
  | { status: "stopped"; done: number; found: SampleFound[] };

/**
 * "Find my versions", mocked: ticks through a pretend list of versions in the
 * reader's languages and turns up a fixed few, as the real scan would.
 */
export function useSampleFind(versions: SampleVersion[], setVersions: (v: SampleVersion[]) => void) {
  const [scan, setScan] = useState<FakeScan>({ status: "idle" });
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  useEffect(() => () => clearInterval(timer.current), []);

  const start = () => {
    clearInterval(timer.current);
    let done = 0;
    setScan({ status: "running", done, found: [] });
    timer.current = setInterval(() => {
      done += 1;
      const found = FOUND.filter((v) => v.at <= done);
      if (done >= FIND_TOTAL) {
        clearInterval(timer.current);
        setScan({ status: "done", found });
      } else setScan({ status: "running", done, found });
    }, 80);
  };
  const stop = () => {
    clearInterval(timer.current);
    setScan((s) => (s.status === "running" ? { status: "stopped", done: s.done, found: s.found } : s));
  };

  const found = scan.status === "idle" ? [] : scan.found;
  const usable = found.filter((v) => v.version.source !== "unsupported");
  return {
    scan,
    start,
    stop,
    found,
    usable,
    pct: scan.status === "running" ? Math.round((scan.done / FIND_TOTAL) * 100) : 0,
    inList: (id: number) => versions.some((v) => v.bibleId === id),
    /** Versions in the list that the finished scan found no highlights in. */
    missing: scan.status === "done" ? versions.filter((v) => !found.some((x) => x.version.bibleId === v.bibleId)) : [],
    /** Offer to swap the list for what was found, unless that's already the list. */
    canReplace:
      scan.status === "done" &&
      usable.length >= 2 &&
      usable.map((v) => v.version.bibleId).join() !== versions.map((v) => v.bibleId).join(),
    add: (v: SampleVersion) => setVersions([...versions, v]),
    replaceWithFound: () => setVersions(usable.map((v) => v.version)),
  };
}

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
