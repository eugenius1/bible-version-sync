import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { store } from "../lib/db";
import { promptInstall, useInstallWay } from "../lib/install";

/**
 * Offers to install the app, once: shown after a sync that finished, which is
 * when the app has shown what it's for. A toast rather than a box in the
 * results, which made a card within a card. It's marked as offered as soon as it
 * shows, so dismissing it, installing, or just moving on all count as seen.
 */
export function InstallBanner() {
  const { t } = useI18n();
  const way = useInstallWay();
  const [shown, setShown] = useState<boolean | null>(null);

  useEffect(() => {
    if (!way || shown !== null) return;
    let cancelled = false;
    void store.getInstallOffered().then(async (offered) => {
      if (cancelled) return;
      setShown(!offered);
      if (!offered) await store.setInstallOffered();
    });
    return () => {
      cancelled = true;
    };
  }, [way, shown]);

  if (!way || !shown) return null;
  // A toast at the foot of the screen, inverted against the page in either theme.
  return (
    <div
      className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-30 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-stone-900 p-3 pl-4 text-sm text-white shadow-xl dark:bg-stone-100 dark:text-stone-900"
      role="region"
      aria-label={t.install.title}
    >
      <Download size={16} className="shrink-0" aria-hidden />
      {way === "prompt" ? (
        <>
          <p className="flex-1 font-medium">{t.install.title}</p>
          <button
            className="btn min-h-8 bg-white px-3 text-stone-900 hover:bg-stone-200 dark:bg-stone-900 dark:text-white dark:hover:bg-stone-700"
            onClick={() => void promptInstall().finally(() => setShown(false))}
          >
            {t.install.button}
          </button>
        </>
      ) : (
        <p className="flex-1">
          {t.install.iosBefore}
          <Share size={14} className="mx-1 inline align-[-2px]" aria-label={t.install.share} />
          {t.install.iosAfter}
        </p>
      )}
      <button
        className="btn min-h-8 px-1.5 text-stone-300 hover:text-white dark:text-stone-600 dark:hover:text-stone-900"
        aria-label={t.install.dismiss}
        onClick={() => setShown(false)}
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
