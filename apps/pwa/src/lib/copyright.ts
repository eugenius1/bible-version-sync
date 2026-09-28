const FIRST_PUBLISHED = 2026;

/** The copyright span, widening to a range once the project outlives its first year. */
export function copyrightYears(now = new Date()): string {
  const current = now.getFullYear();
  return current > FIRST_PUBLISHED ? `${FIRST_PUBLISHED}–${current}` : String(FIRST_PUBLISHED);
}
