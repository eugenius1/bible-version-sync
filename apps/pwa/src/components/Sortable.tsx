import { GripVertical } from "lucide-react";
import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

interface Props<T> {
  items: T[];
  keyOf: (item: T) => string | number;
  /** The drag handle's accessible name for this item. */
  label: (item: T) => string;
  disabled: boolean;
  onReorder: (next: T[]) => void;
  children: (item: T) => ReactNode;
}

export function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

/**
 * A numbered list reordered by dragging each row's handle.
 *
 * Pointer events rather than the HTML drag-and-drop API, which touch screens
 * don't fire: a phone is where most people will use this. The rows reorder
 * live under the finger and the order is saved once, on release. The handle
 * also takes the arrow keys, so the list stays usable without a pointer.
 */
export function SortableList<T>({ items, keyOf, label, disabled, onReorder, children }: Props<T>) {
  const list = useRef<HTMLOListElement>(null);
  // The drag lives in a ref as well as state: pointer events can arrive before
  // React re-renders with the new state (a quick tap would otherwise leave the
  // row stuck mid-drag).
  const dragRef = useRef<{ from: number; over: number } | null>(null);
  const [drag, setDragState] = useState<{ from: number; over: number } | null>(null);
  const setDrag = (next: { from: number; over: number } | null) => {
    dragRef.current = next;
    setDragState(next);
  };
  // The order just dropped, shown until the saved one comes back in `items`, so
  // the row doesn't jump back for a moment.
  const [dropped, setDropped] = useState<{ base: T[]; next: T[] } | null>(null);
  const settled = dropped?.base === items ? dropped.next : items;
  const shown = drag ? move(settled, drag.from, drag.over) : settled;

  const commit = (next: T[]) => {
    setDropped({ base: items, next });
    onReorder(next);
  };

  // Followed on the window rather than with pointer capture: reordering moves
  // the dragged row's element, and moving an element drops its capture. One
  // pointer at a time: a second finger on another handle is ignored, or the
  // two drags would each commit their own order.
  const start = (i: number) => (e: PointerEvent<HTMLButtonElement>) => {
    if (disabled || e.button !== 0 || dragRef.current) return;
    e.preventDefault();
    const base = settled;
    const pointer = e.pointerId;
    setDrag({ from: i, over: i });
    const moveTo = (ev: globalThis.PointerEvent) => {
      const current = dragRef.current;
      if (!current || ev.pointerId !== pointer) return;
      // After every other row whose middle is above the pointer. The rows on
      // screen may lag a render behind, so the dragged one is found by its mark.
      const rows = [...(list.current?.children ?? [])] as HTMLElement[];
      const drawn = rows.findIndex((row) => row.dataset.dragging === "true");
      const over = rows.filter((row, n) => {
        if (n === (drawn < 0 ? current.from : drawn)) return false;
        const r = row.getBoundingClientRect();
        return r.top + r.height / 2 < ev.clientY;
      }).length;
      if (over !== current.over) setDrag({ ...current, over });
    };
    const finish = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== pointer) return;
      window.removeEventListener("pointermove", moveTo);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      const current = dragRef.current;
      setDrag(null);
      if (ev.type === "pointerup" && current && current.over !== current.from) {
        commit(move(base, current.from, current.over));
      }
    };
    window.addEventListener("pointermove", moveTo);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };
  const key = (i: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const to = e.key === "ArrowUp" ? i - 1 : e.key === "ArrowDown" ? i + 1 : -1;
    if (disabled || to < 0 || to >= items.length) return;
    e.preventDefault();
    commit(move(settled, i, to));
  };

  return (
    <ol ref={list} className="divide-y divide-stone-200 dark:divide-stone-800">
      {shown.map((item, i) => {
        const dragging = drag !== null && i === drag.over;
        const index = settled.indexOf(item);
        const name = label(item);
        return (
          <li
            key={keyOf(item)}
            data-dragging={dragging || undefined}
            className={`flex items-center gap-3 py-1.5 transition-colors ${
              dragging ? "rounded-lg bg-stone-100 dark:bg-stone-800" : ""
            }`}
          >
            <button
              type="button"
              className="btn-ghost cursor-grab touch-none px-1 active:cursor-grabbing disabled:cursor-default"
              disabled={disabled}
              aria-label={name}
              title={name}
              onPointerDown={start(index)}
              onKeyDown={key(index)}
            >
              <GripVertical size={16} aria-hidden />
            </button>
            <span className="w-5 text-right text-sm tabular-nums text-stone-500 dark:text-stone-400">{i + 1}</span>
            <div className="flex min-w-0 flex-1 items-center gap-3">{children(item)}</div>
          </li>
        );
      })}
    </ol>
  );
}
