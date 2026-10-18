/**
 * The UI lab: the sign-in and main pages redrawn with Mantine and with
 * shadcn/ui, to compare against the hand-rolled Tailwind app. Reached by hash
 * (#/lab/mantine/main) so it needs no router and no server fallback.
 */

export type Library = "mantine" | "mantine-default" | "shadcn";
export type Page = "login" | "main";
export interface LabRoute {
  library: Library;
  page: Page;
}

export const LIBRARIES: Library[] = ["mantine", "mantine-default", "shadcn"];

export function labRoute(hash = location.hash): LabRoute | null {
  const m = /^#\/lab\/(mantine|mantine-default|shadcn)(?:\/(login|main))?$/.exec(hash);
  return m ? { library: m[1] as Library, page: (m[2] as Page | undefined) ?? "main" } : null;
}

export function labHref(library: Library, page: Page): string {
  return `#/lab/${library}/${page}`;
}
