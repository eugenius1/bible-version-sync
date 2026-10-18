import { HIGHLIGHT_COLORS, loadVersionNames, versionNamesLoaded, type HighlightColorId } from "@bvs/core";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "../i18n";
import { Step } from "./Step";
import type { VersionSetting } from "../lib/db";
import { versionName } from "../lib/versions";

const HEX = Object.fromEntries(HIGHLIGHT_COLORS.map((c) => [c.id, c.hex])) as Record<HighlightColorId, string>;

interface Props {
  versions: VersionSetting[];
  byColor: boolean;
  colorOrder: HighlightColorId[];
  disabled: boolean;
  /** The versions reordered, as bible ids. */
  onVersions: (next: number[]) => void | Promise<void>;
  onColors: (byColor: boolean, order: HighlightColorId[]) => void | Promise<void>;
}

/**
 * What blank verses get when versions disagree: the first listed version's
 * color, or the first listed color. Only the chosen side's list is shown.
 */
export function Priority({ versions, byColor, colorOrder, disabled, onVersions, onColors }: Props) {
  const { t, f } = useI18n();
  const tp = t.priority;
  const tv = t.versions;
  // Titles come in their own chunk; re-render once they're in (see VersionsCard).
  const [, setNamesLoaded] = useState(false);
  useEffect(() => {
    loadVersionNames().then(
      () => setNamesLoaded(true),
      () => undefined,
    );
  }, []);
  const swap = <T,>(list: T[], i: number, d: -1 | 1) => {
    const next = [...list];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    return next;
  };
  const ids = versions.map((v) => v.bibleId);
  // The words either side of the switch pick that side too. Hidden from
  // screen readers, for which the switch alone says it all.
  const side = (color: boolean) => (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden
      disabled={disabled}
      onClick={() => byColor !== color && void onColors(color, colorOrder)}
      className={`cursor-pointer transition disabled:cursor-default ${
        byColor === color ? "text-stone-900 dark:text-stone-100" : "text-stone-500 dark:text-stone-400"
      }`}
    >
      {color ? tp.byColor : tp.byVersion}
    </button>
  );

  const lists = byColor ? (
    <>
      <ol className="divide-y divide-stone-200 dark:divide-stone-800">
        {colorOrder.map((id, i) => {
          const name = tp.names[id];
          return (
            <Row
              key={id}
              n={i + 1}
              up={f(tp.moveUp, { color: name })}
              down={f(tp.moveDown, { color: name })}
              disabled={disabled}
              first={i === 0}
              last={i === colorOrder.length - 1}
              onMove={(d) => void onColors(true, swap(colorOrder, i, d))}
            >
              <span
                className="size-6 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20"
                style={{ background: `#${HEX[id]}` }}
                aria-hidden
              />
              <span className="text-sm">{name}</span>
            </Row>
          );
        })}
      </ol>
      <p className="text-xs text-stone-600 dark:text-stone-400">{tp.note}</p>
    </>
  ) : (
    <ol className="divide-y divide-stone-200 dark:divide-stone-800">
      {versions.map((v, i) => {
        const name = versionName(v.bibleId);
        return (
          <Row
            key={v.bibleId}
            n={i + 1}
            up={f(tv.moveUp, { abbr: v.abbr })}
            down={f(tv.moveDown, { abbr: v.abbr })}
            disabled={disabled}
            first={i === 0}
            last={i === versions.length - 1}
            onMove={(d) => void onVersions(swap(ids, i, d))}
          >
            <span className="shrink-0 font-medium">{v.abbr}</span>
            {/* The title tells apart versions whose abbreviations look alike
                (NVI (es), NVI (pt)); in the version's own script, as in VersionsCard. */}
            <span
              className="truncate text-sm text-stone-600 dark:text-stone-400"
              lang={name?.language}
              dir={name ? "auto" : undefined}
            >
              {name?.title ?? (versionNamesLoaded() ? f(tv.unnamed, { id: v.bibleId }) : null)}
            </span>
          </Row>
        );
      })}
    </ol>
  );

  return (
    <section className="card space-y-4" aria-labelledby="priority-title">
      <div>
        <h2 id="priority-title" className="flex items-center gap-2 font-semibold">
          <Step n={2} />
          {tp.title}
        </h2>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{byColor ? tp.helpByColor : tp.helpByVersion}</p>
      </div>

      {/* A switch, not tabs: it's one choice between two, and the knob shows which. */}
      <div className="flex items-center justify-center gap-3 text-sm font-medium">
        {side(false)}
        <button
          type="button"
          role="switch"
          aria-checked={byColor}
          aria-label={tp.toggle}
          disabled={disabled}
          onClick={() => void onColors(!byColor, colorOrder)}
          className="relative h-7 w-12 shrink-0 cursor-pointer rounded-full bg-amber-600 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-default disabled:opacity-50 dark:bg-amber-500 dark:focus-visible:outline-amber-500"
        >
          <span
            className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow-sm transition-transform dark:bg-stone-950 ${
              byColor ? "translate-x-5" : ""
            }`}
          />
        </button>
        {side(true)}
      </div>

      {lists}
    </section>
  );
}

function Row(p: {
  n: number;
  up: string;
  down: string;
  disabled: boolean;
  first: boolean;
  last: boolean;
  onMove: (d: -1 | 1) => void;
  children: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 py-1.5">
      <span className="w-5 text-right text-sm tabular-nums text-stone-500 dark:text-stone-400">{p.n}</span>
      <div className="flex min-w-0 flex-1 items-center gap-3">{p.children}</div>
      <div className="flex shrink-0 items-center">
        <button className="btn-ghost" disabled={p.disabled || p.first} onClick={() => p.onMove(-1)} aria-label={p.up} title={p.up}>
          <ArrowUp size={16} aria-hidden />
        </button>
        <button className="btn-ghost" disabled={p.disabled || p.last} onClick={() => p.onMove(1)} aria-label={p.down} title={p.down}>
          <ArrowDown size={16} aria-hidden />
        </button>
      </div>
    </li>
  );
}
