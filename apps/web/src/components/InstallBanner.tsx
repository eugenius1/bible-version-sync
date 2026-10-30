import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { store } from "../lib/db";
import { promptInstall, useInstallWay } from "../lib/install";

/**
 * Offers to install the app, once: shown after a sync that finished, which is
 * when the app has shown what it's for. It's marked as offered as soon as it
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
  return (
    <div className="flex items-start gap-3 rounded-xl border border-stone-200 p-3 text-sm dark:border-stone-800" role="region" aria-label={t.install.title}>
      <Download size={16} className="mt-0.5 shrink-0" aria-hidden />
      <div className="flex-1 space-y-2">
        <p className="font-medium">{t.install.title}</p>
        {way === "prompt" ? (
          <>
            <p className="text-stone-600 dark:text-stone-400">{t.install.body}</p>
            <button className="btn-secondary" onClick={() => void promptInstall().finally(() => setShown(false))}>
              {t.install.button}
            </button>
          </>
        ) : (
          <p className="text-stone-600 dark:text-stone-400">
            {t.install.iosBefore}
            <Share size={14} className="mx-1 inline align-[-2px]" aria-label={t.install.share} />
            {t.install.iosAfter}
          </p>
        )}
      </div>
      <button className="btn-ghost -m-1 min-h-8 px-1.5" aria-label={t.install.dismiss} onClick={() => setShown(false)}>
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
