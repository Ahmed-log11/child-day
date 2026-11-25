// Ask: questions about the children's days, answered from Kanaf's own reports (POST /insights/ask).
import { useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { askInsights } from "../api/client";
import { LogoMark } from "../components/Logo";
import { Card } from "../components/Card";

export default function Insights() {
  const { t, tl } = useI18n();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [problem, setProblem] = useState(null);
  const [busy, setBusy] = useState(false);

  async function ask(text) {
    const q = (text ?? question).trim();
    if (!q) {
      setProblem(t("ask.empty"));
      return;
    }
    setQuestion(q);
    setBusy(true);
    setProblem(null);
    try {
      setAnswer({ question: q, ...(await askInsights(q)) });
    } catch (err) {
      setProblem(t("ask.error", { msg: err.message }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 pt-8 sm:px-6 sm:pt-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("ask.title")}</h1>
        <p className="mt-2 text-body">{t("ask.intro")}</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
        className="flex items-center gap-2 rounded-2xl border border-[rgba(28,23,20,.18)] bg-paper py-2 ps-4 pe-2 focus-within:border-clay"
      >
        <label htmlFor="question" className="sr-only">
          {t("ask.label")}
        </label>
        <input
          id="question"
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
            setProblem(null);
          }}
          placeholder={t("ask.placeholder")}
          className="min-h-10 min-w-0 flex-1 bg-transparent text-base outline-none"
        />
        <button type="submit" disabled={busy} className="min-h-11 rounded-full bg-clay px-5 font-semibold text-white hover:bg-rust disabled:opacity-70">
          {busy ? t("ask.thinking") : t("ask.send")}
        </button>
      </form>
      {problem && (
        <p role="alert" className="-mt-2 text-sm text-alert-text">
          {problem}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {tl("ask.suggestions").map((s) => (
          <button key={s} type="button" onClick={() => ask(s)} className="min-h-10 rounded-full border border-[rgba(28,23,20,.18)] bg-paper px-4 text-sm hover:border-clay">
            {s}
          </button>
        ))}
      </div>

      {answer && (
        <Card aria-live="polite">
          <div className="mb-3 flex items-center gap-2.5">
            <LogoMark size={26} />
            <span className="text-sm font-semibold text-rust">{t("brand.name")}</span>
          </div>
          <p className="mb-2 text-sm text-muted">{answer.question}</p>
          <p className="text-lg leading-relaxed">{answer.answer}</p>
          {answer.sources?.length > 0 && (
            <p className="mt-4 text-[13px] text-muted">
              {t("ask.sources")} {answer.sources.join(" · ")}
            </p>
          )}
        </Card>
      )}

      <p className="text-[13px] text-muted">{t("ask.note")}</p>
    </main>
  );
}
