import { useLayoutEffect, useRef } from "react";

/**
 * The number before a card's title, so the cards read as steps: choose
 * versions, say which wins, sync. Colored like the primary button.
 *
 * Centring a digit's box doesn't centre the digit: its box keeps room for
 * descenders it doesn't use, and its side bearings differ (a 2 has more
 * space on its right). Both lift and shift it a fraction of a pixel, which
 * shows in a small circle. So the ink is measured in the font actually
 * used, and the digit moved by the difference.
 */
export function Step({ n }: { n: number }) {
  const digit = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    // The vertical sum relies on the trim below; without it, leave the digit be.
    if (!globalThis.CSS?.supports?.("text-box", "trim-both cap alphabetic")) return;
    const el = digit.current;
    const ctx = el && document.createElement("canvas").getContext("2d");
    if (!el || !ctx) return;
    const style = getComputedStyle(el);
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const m = ctx.measureText(String(n));
    const box = el.getBoundingClientRect();
    // Ink centre relative to the box: horizontally from its left edge, and
    // vertically from the baseline, which text-box puts at the box's bottom.
    const dx = box.width / 2 - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
    const dy = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2 - box.height / 2;
    el.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;
  }, [n]);

  return (
    <span
      aria-hidden
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white dark:bg-stone-100 dark:text-stone-900"
    >
      {/* text-box trims the line to cap height and baseline; it only trims
          a box of its own, hence this span rather than the flex container. */}
      <span ref={digit} className="[text-box:trim-both_cap_alphabetic]">
        {n}
      </span>
    </span>
  );
}
