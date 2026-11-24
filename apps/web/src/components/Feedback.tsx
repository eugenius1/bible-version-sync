import { ArrowLeft, Send } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../i18n";
import { sendFeedback } from "../lib/analytics";

const ISSUES_URL = "https://github.com/eugenius1/bible-version-sync/issues/new";
const muted = "text-stone-600 dark:text-stone-400";

/** Feedback without an account: sent to PostHog's Feedback survey, with GitHub for those who prefer it. */
export function FeedbackPage() {
  const { t } = useI18n();
  const tf = t.feedback;
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  if (status === "sent") {
    return (
      <section className="card space-y-4" aria-labelledby="feedback-title">
        <h2 id="feedback-title" className="text-lg font-semibold">{tf.title}</h2>
        <p role="status" className="text-sm">{tf.sent}</p>
        <a href="#" className="btn-secondary">{t.app.back}</a>
      </section>
    );
  }

  return (
    <section className="card space-y-4" aria-labelledby="feedback-title">
      <div className="space-y-2">
        <a href="#" className="btn-ghost -ml-2 min-h-8">
          <ArrowLeft size={16} aria-hidden />
          {t.app.back}
        </a>
        <h2 id="feedback-title" className="text-lg font-semibold">{tf.title}</h2>
        <p className={`text-sm ${muted}`}>{tf.intro}</p>
      </div>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setStatus("sending");
          setStatus((await sendFeedback(message.trim(), email.trim())) ? "sent" : "failed");
        }}
      >
        <div className="space-y-2">
          <label className="label" htmlFor="feedback-message">{tf.message}</label>
          <textarea
            id="feedback-message"
            className="input min-h-32 py-2"
            required
            maxLength={5000}
            // Not mid-send: a success replaces the form, which would lose later edits.
            disabled={status === "sending"}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="label" htmlFor="feedback-email">{tf.email}</label>
          <input
            id="feedback-email"
            className="input"
            type="email"
            autoComplete="email"
            disabled={status === "sending"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {status === "failed" && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">{tf.failed}</p>
        )}
        <button type="submit" className="btn-primary" disabled={status === "sending" || !message.trim()}>
          {/* Clipped, so the plane vanishes at the icon's edge rather than over the label. */}
          <span className="-m-0.5 inline-flex overflow-hidden p-0.5">
            <Send
              size={16}
              className={status === "sending" ? "animate-take-off motion-reduce:animate-none" : undefined}
              aria-hidden
            />
          </span>
          {status === "sending" ? tf.sending : tf.send}
        </button>
      </form>
      <p className={`text-xs ${muted}`}>
        {tf.privacy}{" "}
        <a href={ISSUES_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          {tf.github}
        </a>
      </p>
    </section>
  );
}
