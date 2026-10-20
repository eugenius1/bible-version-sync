import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useState, type KeyboardEvent, type ReactNode } from "react";

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

// dnd-kit's announcements and instructions are English and describe its own
// keyboard sensor, which isn't used: the handles take the arrow keys directly.
const QUIET = {
  announcements: {
    onDragStart: () => undefined,
    onDragOver: () => undefined,
    onDragEnd: () => undefined,
    onDragCancel: () => undefined,
  },
  screenReaderInstructions: { draggable: "" },
};
const MODIFIERS = [restrictToVerticalAxis, restrictToParentElement];

/**
 * A numbered list reordered by dragging each row's handle, with dnd-kit.
 *
 * Its pointer sensor works on touch screens, where the HTML drag-and-drop API
 * never fires: a phone is where most people will use this. The rows slide
 * aside under the finger and the order is saved once, on release. The handle
 * also takes the arrow keys, so the list stays usable without a pointer.
 */
export function SortableList<T>({ items, keyOf, label, disabled, onReorder, children }: Props<T>) {
  const sensors = useSensors(useSensor(PointerSensor));
  // The order just dropped, shown until the saved one comes back in `items`, so
  // the row doesn't jump back for a moment.
  const [dropped, setDropped] = useState<{ base: T[]; next: T[] } | null>(null);
  const settled = dropped?.base === items ? dropped.next : items;
  const ids = settled.map(keyOf);

  const commit = (next: T[]) => {
    setDropped({ base: items, next });
    onReorder(next);
  };
  const end = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    commit(move(settled, ids.indexOf(active.id), ids.indexOf(over.id)));
  };
  const key = (i: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const to = e.key === "ArrowUp" ? i - 1 : e.key === "ArrowDown" ? i + 1 : -1;
    if (disabled || to < 0 || to >= settled.length) return;
    e.preventDefault();
    commit(move(settled, i, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={MODIFIERS}
      accessibility={QUIET}
      onDragEnd={end}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={disabled}>
        <ol className="divide-y divide-stone-200 dark:divide-stone-800">
          {settled.map((item, i) => (
            <Row key={keyOf(item)} id={keyOf(item)} n={i + 1} name={label(item)} disabled={disabled} onKeyDown={key(i)}>
              {children(item)}
            </Row>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

interface RowProps {
  id: string | number;
  n: number;
  name: string;
  disabled: boolean;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}

function Row({ id, n, name, disabled, onKeyDown, children }: RowProps) {
  // Only the listeners go on the handle: dnd-kit's attributes would give the
  // native button an English role description and instructions.
  const { setNodeRef, setActivatorNodeRef, listeners, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative flex items-center gap-3 py-1.5 ${
        isDragging ? "z-10 rounded-lg bg-stone-100 shadow-sm dark:bg-stone-800" : ""
      }`}
    >
      <span className="w-5 text-right text-sm tabular-nums text-stone-500 dark:text-stone-400">{n}</span>
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
      {/* On the right, where a thumb holding the phone reaches it. */}
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="btn-ghost cursor-grab touch-none px-1 active:cursor-grabbing disabled:cursor-default"
        disabled={disabled}
        aria-label={name}
        title={name}
        {...listeners}
        onKeyDown={onKeyDown}
      >
        <GripVertical size={16} aria-hidden />
      </button>
    </li>
  );
}
