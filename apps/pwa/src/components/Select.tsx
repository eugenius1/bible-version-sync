import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

/** Native select with our own chevron, so it gets the same inner spacing as inputs. */
export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={`relative ${className}`}>
      <select className="input appearance-none pr-10" {...props}>
        {children}
      </select>
      <ChevronDown
        aria-hidden
        size={16}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-stone-500 dark:text-stone-400"
      />
    </div>
  );
}
