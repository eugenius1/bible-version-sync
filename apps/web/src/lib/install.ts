import { useSyncExternalStore } from "react";
import { store } from "./db";

/** Chromium's install event; not in TypeScript's DOM types. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** How this browser can install the app: its own prompt, the iOS share sheet, or not at all. */
export type InstallWay = "prompt" | "ios" | null;

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/**
 * Starts listening at startup, since Chromium fires `beforeinstallprompt` as
 * soon as the app qualifies, usually long before the first sync ends. The
 * event is kept so the banner can use it then, and its default (Android's
 * mini-infobar) is held back so it doesn't ask before the app has shown what
 * it's for.
 */
export function listenForInstall(target: Window = window): void {
  target.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  target.addEventListener("appinstalled", () => {
    deferred = null;
    void store.setInstallOffered();
    notify();
  });
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Safari on an iPhone or iPad, which can add the app to the home screen but
 * has no event or API for it. iPadOS reports itself as a Mac, and only its
 * touch points give it away. Other iOS browsers say so in their user agent.
 */
export function isIosSafari(ua = navigator.userAgent, touchPoints = navigator.maxTouchPoints): boolean {
  const ios = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
}

function currentWay(): InstallWay {
  if (isStandalone()) return null;
  if (deferred) return "prompt";
  return isIosSafari() ? "ios" : null;
}

export function useInstallWay(): InstallWay {
  return useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, currentWay);
}

/** Shows Chromium's install dialog; the event can only be used once. */
export async function promptInstall(): Promise<void> {
  const e = deferred;
  deferred = null;
  notify();
  if (!e) return;
  await e.prompt();
  await e.userChoice;
}

/** For tests: forgets a kept event. */
export function resetInstall(): void {
  deferred = null;
  notify();
}
