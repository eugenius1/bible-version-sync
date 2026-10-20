/**
 * How fast this browser's last run read and wrote, so the next estimate starts
 * from it rather than from an assumption: request times depend on the
 * connection far more than on anything the app does.
 */

export const PACE_STORAGE_KEY = "bible-version-sync.pace";

export interface Pace {
  msPerRead?: number;
  msPerWrite?: number;
}

const valid = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

export function storedPace(): Pace {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PACE_STORAGE_KEY) ?? "null");
    if (!raw || typeof raw !== "object") return {};
    const { msPerRead, msPerWrite } = raw as Record<string, unknown>;
    return { ...(valid(msPerRead) && { msPerRead }), ...(valid(msPerWrite) && { msPerWrite }) };
  } catch {
    // Private windows and blocked site data throw; the assumed rate will do.
    return {};
  }
}

export function persistPace(pace: Pace): void {
  try {
    localStorage.setItem(PACE_STORAGE_KEY, JSON.stringify({ ...storedPace(), ...pace }));
  } catch {
    // Not being able to remember it only makes the next estimate rougher.
  }
}
