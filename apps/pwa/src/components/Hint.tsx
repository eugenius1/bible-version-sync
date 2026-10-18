import { useId, useRef, type ReactNode } from "react";

/**
 * A button that shows a short explanation beside it, with no library: the
 * browser's popover does the showing, dismissing (Esc, a tap elsewhere) and
 * stacking, and CSS anchor positioning puts it next to the button (see the
 * hint-popover utility). Tap or click opens it, so it works on phones, which
 * a title attribute or a hover-only tooltip doesn't. With a mouse, hovering
 * opens it too, and a click while hovering keeps it open.
 */
export function Hint({ hint, className, children }: { hint: string; className: string; children: ReactNode }) {
  const id = useId();
  const anchor = `--hint-${id.replace(/[^\w-]/g, "")}`;
  const pop = useRef<HTMLDivElement>(null);
  const pinned = useRef(false);
  const hovering = (e: React.PointerEvent) => e.pointerType === "mouse";

  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        className={className}
        style={{ anchorName: anchor }}
        onPointerEnter={(e) => {
          if (hovering(e) && !pop.current?.matches(":popover-open")) {
            pinned.current = false;
            pop.current?.showPopover();
          }
        }}
        onPointerLeave={(e) => {
          if (hovering(e) && !pinned.current) pop.current?.hidePopover();
        }}
        onClick={(e) => {
          // Already open from hovering: the click pins it rather than closing it.
          if (pop.current?.matches(":popover-open") && !pinned.current) {
            e.preventDefault();
            pinned.current = true;
          }
        }}
      >
        {children}
      </button>
      <div
        ref={pop}
        id={id}
        popover="auto"
        role="tooltip"
        className="hint-popover"
        style={{ positionAnchor: anchor }}
        onToggle={(e) => {
          if (e.newState === "closed") pinned.current = false;
        }}
      >
        {hint}
      </div>
    </>
  );
}
