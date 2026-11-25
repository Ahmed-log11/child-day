// Upload a day's video. Sends it to POST /analyze, then follows the job on the processing screen.
import { useRef, useState } from "react";
import { useFirstFrame } from "../lib/frames";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { analyzeVideo, getChildren, getSession, USE_MOCKS } from "../api/client";
import { useData } from "../lib/useData";
import { childTheme } from "../lib/children";
import { Card } from "../components/Card";
import { Avatar } from "../components/ChildSwitch";
import { StatusChip } from "../components/StatusChip";

const today = () => new Date().toISOString().slice(0, 10);

export default function Upload() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [date, setDate] = useState(today());
  const [problem, setProblem] = useState(null);
  const [sending, setSending] = useState(false);
  const preview = useFirstFrame(file);

  // Children: the real list from the backend; in mock mode, the demo family.
  const { data: children } = useData(
    () => (USE_MOCKS ? getSession("s1").then((s) => s.children) : getChildren()),
    []
  );
  const [picked, setPicked] = useState(null);
  const selected = picked ?? new Set((children ?? []).map((c) => c.id));

  function choose(f) {
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setProblem(t("upload.notVideo"));
      return;
    }
    setProblem(null);
    setFile(f);
  }

  async function submit() {
    if (!file) {
      setProblem(t("upload.notVideo"));
      return;
    }
    setSending(true);
    setProblem(null);
    try {
      const { job_id } = await analyzeVideo(file, date);
      navigate(`/processing/${job_id}`);
    } catch (err) {
      setProblem(t("upload.error", { msg: err.message }));
      setSending(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-5 px-4 pt-7 sm:px-6 sm:pt-9">
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("upload.title")}</h1>
        <p className="mt-2 max-w-2xl text-body">{t("upload.intro")}</p>
      </div>

      <Card className="flex flex-col gap-6">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            choose(e.dataTransfer.files?.[0]);
          }}
        >
          <input ref={input} type="file" accept="video/*" className="sr-only" id="video-file" onChange={(e) => choose(e.target.files?.[0])} />
          {file ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {preview ? (
                <img src={preview} alt={t("upload.firstFrame")} className="aspect-video w-full rounded-xl object-cover sm:w-64" />
              ) : (
                <div className="aspect-video w-full rounded-xl bg-[#2b221e] sm:w-64" />
              )}
              <div className="min-w-0">
                <div className="truncate font-semibold">{file.name}</div>
                <div className="text-sm text-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
                <label htmlFor="video-file" className="mt-2 inline-block cursor-pointer text-sm font-semibold text-rust">
                  {t("upload.change")}
                </label>
              </div>
            </div>
          ) : (
            <label
              htmlFor="video-file"
              className="flex cursor-pointer flex-col items-center gap-2.5 rounded-2xl border-2 border-dashed border-[#d9cdbe] bg-cream px-6 py-12 text-center"
            >
              <span className="flex size-16 items-center justify-center rounded-2xl border border-[#eadfd6] bg-paper">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#A9472A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
                </svg>
              </span>
              <span className="text-lg font-semibold">{t("upload.drop")}</span>
              <span className="text-[13px] text-muted">{t("upload.dropHint")}</span>
            </label>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-semibold">
            {t("upload.date")}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-11 rounded-full border border-[rgba(28,23,20,.18)] bg-paper px-3 font-normal"
            />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">{t("upload.who")}</legend>
            {children?.length ? (
              <div className="flex flex-wrap gap-2.5">
                {children.map((c) => {
                  const theme = childTheme(children, c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-2xl border border-line py-1.5 ps-2 pe-4"
                      style={{ background: `linear-gradient(180deg, ${theme.tint}, #fff 90%)` }}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => {
                          const next = new Set(selected);
                          next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                          setPicked(next);
                        }}
                        style={{ accentColor: theme.color }}
                      />
                      <Avatar name={c.name} theme={theme} size={28} />
                      <span className="font-medium">{c.name}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-body">
                {t("upload.noChildren")}{" "}
                <Link to="/setup" className="font-semibold text-rust">
                  {t("upload.addChildren")}
                </Link>
              </p>
            )}
          </fieldset>
        </div>

        {problem && (
          <p role="alert" className="text-sm font-medium text-alert-text">
            {problem}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <span className="flex flex-wrap items-center gap-2 text-sm text-body">
            <StatusChip kind="look" label={t("upload.zones")} />
            <Link to="/setup" className="font-semibold text-rust">
              {t("upload.editZones")}
            </Link>
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={sending}
            className="min-h-12 rounded-full bg-clay px-6 font-semibold text-white hover:bg-rust disabled:opacity-70"
          >
            {sending ? t("upload.sending") : t("upload.analyze")}
          </button>
        </div>
      </Card>

      <Link to="/live" className="flex items-center gap-2 self-start text-sm font-semibold text-rust">
        <span className="size-2 rounded-full bg-clay" />
        {t("upload.orLive")}
      </Link>
    </main>
  );
}
