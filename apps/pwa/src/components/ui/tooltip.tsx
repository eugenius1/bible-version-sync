import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

/**
 * shadcn/ui's tooltip (Radix underneath), in the app's colours: the inverse
 * of the page, like the primary button. Each tooltip brings its own provider,
 * as shadcn's does, so nothing has to wrap the app.
 *
 * Radix tooltips open on hover and keyboard focus, not on tap, so whatever
 * one says mustn't be the only place a phone user can find it.
 */
export function Tooltip({ delayDuration = 150, ...props }: ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipPrimitive.Provider>
  );
}

export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({ className = "", sideOffset = 4, children, ...props }: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={`z-50 w-fit max-w-72 origin-(--radix-tooltip-content-transform-origin) animate-in rounded-lg bg-stone-900 px-3 py-1.5 text-xs text-balance text-white fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 motion-reduce:animate-none dark:bg-stone-100 dark:text-stone-900 ${className}`}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-stone-900 fill-stone-900 dark:bg-stone-100 dark:fill-stone-100" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}
