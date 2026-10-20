import { HIGHLIGHT_COLORS, loadVersionNames, versionNamesLoaded, type HighlightColorId } from "@bvs/core";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { SortableList } from "./Sortable";
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
      <SortableList
        items={colorOrder}
        keyOf={(id) => id}
        label={(id) => f(tp.drag, { color: tp.names[id] })}
        disabled={disabled}
        onReorder={(next) => void onColors(true, next)}
      >
        {(id) => (
          <>
            <span
              className="size-6 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20"
              style={{ background: `#${HEX[id]}` }}
              aria-hidden
            />
            <span className="text-sm">{tp.names[id]}</span>
          </>
        )}
      </SortableList>
      <p className="text-xs text-stone-600 dark:text-stone-400">{tp.note}</p>
    </>
  ) : (
    <SortableList
      items={versions}
      keyOf={(v) => v.bibleId}
      label={(v) => f(tv.drag, { abbr: v.abbr })}
      disabled={disabled}
      onReorder={(next) => void onVersions(next.map((v) => v.bibleId))}
    >
      {(v) => {
        const name = versionName(v.bibleId);
        return (
          <>
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
          </>
        );
      }}
    </SortableList>
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
