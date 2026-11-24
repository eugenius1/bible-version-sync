import { ArrowLeft } from "lucide-react";
import { useI18n } from "../i18n";
import { privacySignal, setUsageAllowed, useUsageAllowed } from "../lib/analytics";

const muted = "text-stone-600 dark:text-stone-400";

/**
 * The app's own privacy page, so it stays right wherever the app is hosted.
 * What it says about usage data has to match docs/analytics.md.
 */
export function PrivacyPage() {
  const { t } = useI18n();
  const tp = t.privacy;
  const allowed = useUsageAllowed();
  return (
    <section className="card space-y-5" aria-labelledby="privacy-title">
      <div className="space-y-2">
        <a href="#" className="btn-ghost -ml-2 min-h-8">
          <ArrowLeft size={16} aria-hidden />
          {t.app.back}
        </a>
        <h2 id="privacy-title" className="text-lg font-semibold">{tp.title}</h2>
        <p className={`text-sm ${muted}`}>{tp.stays}</p>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">{tp.usageTitle}</h3>
        <p className={`text-sm ${muted}`}>{tp.usage}</p>
        <p className={`text-sm ${muted}`}>{tp.never}</p>
        <div className="flex items-center gap-3 pt-1 text-sm font-medium">
          <button
            type="button"
            role="switch"
            aria-checked={allowed}
            aria-labelledby="usage-toggle"
            onClick={() => setUsageAllowed(!allowed)}
            className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:focus-visible:outline-amber-500 ${
              allowed ? "bg-amber-600 dark:bg-amber-500" : "bg-stone-500"
            }`}
          >
            <span
              className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow-sm transition-transform dark:bg-stone-950 ${
                allowed ? "translate-x-5" : ""
              }`}
            />
          </button>
          <span id="usage-toggle">{tp.toggle}</span>
        </div>
        {privacySignal() && <p className={`text-xs ${muted}`}>{tp.signal}</p>}
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">{tp.feedbackTitle}</h3>
        <p className={`text-sm ${muted}`}>{tp.feedback}</p>
      </div>
    </section>
  );
}
