// Follows the analysis job: asks GET /jobs/{id} every 2 seconds until it's done.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { getJob } from "../api/client";
import { Card } from "../components/Card";
import { Figure } from "../components/Figure";
import { CHILD_COLORS } from "../lib/children";

export default function Processing() {
  const { jobId } = useParams();
  const { t, tl } = useI18n();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [problem, setProblem] = useState(null);

  useEffect(() => {
    let alive = true;
    let timer;
    async function poll() {
      try {
        const next = await getJob(jobId);
        if (!alive) return;
        setJob(next);
        setProblem(null); // a single failed poll (Wi-Fi blip) shouldn't leave an error on screen
        if (next.status === "done") {
          timer = setTimeout(() => navigate("/dashboard"), 1500);
          return;
        }
        if (next.status === "failed") return;
      } catch (err) {
        if (alive) setProblem(err.message);
      }
      timer = setTimeout(poll, 2000);
    }
    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [jobId, navigate]);

  const steps = tl("processing.steps");
  const progress = job?.status === "done" ? 100 : job?.progress ?? 0;
  const currentStep = job?.status === "done" ? steps.length : Math.min(steps.length - 1, Math.floor((progress / 100) * steps.length));
  const failed = job?.status === "failed";

  return (
    <main className="mx-auto max-w-2xl px-4 pt-10 sm:px-6">
      <Card className="!p-7 sm:!p-9">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <div className="flex gap-2 rounded-[20px] bg-cream px-7 pt-4 pb-1" aria-hidden="true">
            <Figure pose="stand" color={CHILD_COLORS[0].color} width={80} />
            <Figure pose="tablet" color={CHILD_COLORS[1].color} width={80} />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">{t("processing.title")}</h1>
          <p className="text-body">{job?.status === "done" ? t("processing.done") : t("processing.left")}</p>
        </div>

        <div
          className="my-6 h-2.5 rounded-full bg-[#f1eae1]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div className="h-2.5 rounded-full bg-clay transition-[width] duration-700" style={{ width: `${progress}%` }} />
        </div>

        <ol className="flex flex-col gap-4">
          {steps.map((label, i) => {
            const state = i < currentStep ? "done" : i === currentStep && !failed ? "now" : "todo";
            return (
              <li key={label} className={`flex items-center gap-3.5 ${state === "todo" ? "text-muted" : "text-ink"} ${state === "now" ? "font-bold" : ""}`}>
                {state === "done" && (
                  <span className="flex size-7 items-center justify-center rounded-full bg-ok-soft text-ok">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
                  </span>
                )}
                {state === "now" && (
                  <span className="flex size-7 items-center justify-center rounded-full bg-sun">
                    <span className="size-2 animate-pulse rounded-full bg-ink" />
                  </span>
                )}
                {state === "todo" && <span className="size-7 rounded-full border-[1.5px] border-[rgba(28,23,20,.18)]" />}
                {label}
              </li>
            );
          })}
        </ol>

        {(failed || problem) && (
          <div role="alert" className="mt-6 rounded-xl bg-alert-soft p-4 text-sm text-alert-text">
            {t("processing.failed", { msg: job?.error ?? problem })}{" "}
            <Link to="/upload" className="font-semibold underline">
              {t("processing.retry")}
            </Link>
          </div>
        )}

        {job?.status === "done" && (
          <Link to="/dashboard" className="mt-6 flex min-h-12 items-center justify-center rounded-full bg-clay font-semibold text-white">
            {t("processing.open")}
          </Link>
        )}
      </Card>
    </main>
  );
}
