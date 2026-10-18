import { lazy, Suspense, useEffect, useState } from "react";
import { LanguageSwitcher, ThemeSwitcher } from "../components/Pickers";
import { LIBRARIES, labHref, type LabRoute } from "./route";

// Each library in its own chunk, so its CSS only loads on its own pages.
const MantineLab = lazy(() => import("./mantine/MantineLab"));
const ShadcnLab = lazy(() => import("./shadcn/ShadcnLab"));

const NAMES = { mantine: "Mantine, app colours", "mantine-default": "Mantine, its own look", shadcn: "shadcn/ui" } as const;

/** Whether the page is dark, following the .dark class the app's theme picker sets. */
export function useDark(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const html = document.documentElement;
    const observer = new MutationObserver(() => setDark(html.classList.contains("dark")));
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

export function Lab({ route }: { route: LabRoute }) {
  return (
    <>
      <LabBar route={route} />
      <Suspense fallback={null}>
        {route.library === "shadcn" ? (
          <ShadcnLab page={route.page} />
        ) : (
          <MantineLab page={route.page} native={route.library === "mantine-default"} />
        )}
      </Suspense>
    </>
  );
}

/**
 * The lab's own bar, in the app's plain Tailwind so it looks the same over
 * both libraries. Links reload the page (see main.tsx) so one library's
 * global styles never leak into the other.
 */
function LabBar({ route }: { route: LabRoute }) {
  const link = (active: boolean) =>
    `rounded-full px-2.5 py-1 transition ${
      active ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900" : "hover:bg-stone-200 dark:hover:bg-stone-800"
    }`;
  return (
    <nav className="sticky top-0 z-[1000] flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-stone-200 bg-stone-50/90 px-4 py-2 font-sans text-xs text-stone-700 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90 dark:text-stone-300">
      <span className="font-semibold tracking-wide uppercase">UI lab</span>
      <div className="flex items-center gap-1">
        {LIBRARIES.map((l) => (
          <a key={l} href={labHref(l, route.page)} className={link(route.library === l)}>
            {NAMES[l]}
          </a>
        ))}
        <a href={import.meta.env.BASE_URL} className={link(false)}>
          Current app
        </a>
      </div>
      <div className="flex items-center gap-1">
        {(["login", "main"] as const).map((p) => (
          <a key={p} href={labHref(route.library, p)} className={link(route.page === p)}>
            {p === "login" ? "Sign-in page" : "Main page"}
          </a>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>
    </nav>
  );
}
