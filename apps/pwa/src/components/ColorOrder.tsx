import { HIGHLIGHT_COLORS, type HighlightColorId } from "@bvs/core";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../i18n";

const HEX = Object.fromEntries(HIGHLIGHT_COLORS.map((c) => [c.id, c.hex])) as Record<HighlightColorId, string>;

interface Props {
  byColor: boolean;
  order: HighlightColorId[];
  disabled: boolean;
  onChange: (byColor: boolean, order: HighlightColorId[]) => void | Promise<void>;
}

/**
 * The alternative to the versions' order: rank highlight colors instead.
 * Folded away unless it's in use, since most people never need it.
 */
export function ColorOrder({ byColor, order, disabled, onChange }: Props) {
  const { t, f } = useI18n();
  const tc = t.colors;
  // Opened at first only when in use; after that it's the person's to toggle.
  const [open, setOpen] = useState(byColor);
  const move = (i: number, d: -1 | 1) => {
    const next = [...order];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    void onChange(byColor, next);
  };

  return (
    <details
      className="group rounded-xl border border-stone-200 dark:border-stone-800"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-medium">
        <ChevronRight size={16} className="shrink-0 transition group-open:rotate-90" aria-hidden />
        <span className="flex-1">{tc.summary}</span>
        {byColor && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {tc.on}
          </span>
        )}
      </summary>
      <div className="space-y-3 border-t border-stone-200 p-3 dark:border-stone-800">
        <p className="text-sm text-stone-600 dark:text-stone-400">{tc.help}</p>

        <fieldset disabled={disabled}>
          <legend className="sr-only">{tc.legend}</legend>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
            {([false, true] as const).map((v) => (
              <label
                key={String(v)}
                className={`cursor-pointer rounded-lg px-1 py-2 text-center text-sm font-medium transition has-focus-visible:outline-2 has-focus-visible:outline-amber-600 dark:has-focus-visible:outline-amber-500 ${
                  byColor === v ? "bg-white shadow-sm dark:bg-stone-950" : "text-stone-600 dark:text-stone-400"
                }`}
              >
                <input
                  type="radio"
                  name="decide-by"
                  className="sr-only"
                  checked={byColor === v}
                  onChange={() => void onChange(v, order)}
                />
                {v ? tc.byColor : tc.byVersion}
              </label>
            ))}
          </div>
        </fieldset>

        <ol className={`divide-y divide-stone-200 dark:divide-stone-800 ${byColor ? "" : "opacity-60"}`}>
          {order.map((id, i) => {
            const name = tc.names[id];
            return (
              <li key={id} className="flex items-center gap-3 py-1.5">
                <span className="w-5 text-right text-sm tabular-nums text-stone-500 dark:text-stone-400">{i + 1}</span>
                <span
                  className="size-6 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20"
                  style={{ background: `#${HEX[id]}` }}
                  aria-hidden
                />
                <span className="flex-1 text-sm">{name}</span>
                <div className="flex shrink-0 items-center">
                  <button
                    className="btn-ghost"
                    disabled={disabled || i === 0}
                    onClick={() => move(i, -1)}
                    aria-label={f(tc.moveUp, { color: name })}
                    title={f(tc.moveUp, { color: name })}
                  >
                    <ArrowUp size={16} aria-hidden />
                  </button>
                  <button
                    className="btn-ghost"
                    disabled={disabled || i === order.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={f(tc.moveDown, { color: name })}
                    title={f(tc.moveDown, { color: name })}
                  >
                    <ArrowDown size={16} aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>

        <p className="text-xs text-stone-600 dark:text-stone-400">{tc.note}</p>
      </div>
    </details>
  );
}
