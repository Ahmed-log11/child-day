// Review a moment: the video (or demo stage) with boxes and body outlines,
// a bar of flagged moments, and the question "what was it?".
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { getFrames, getSession, markAlertReviewed, USE_MOCKS } from "../api/client";
import { useData } from "../lib/useData";
import { childTheme, severity } from "../lib/children";
import { clock, duration } from "../lib/format";
import { Card } from "../components/Card";
import { StatusChip } from "../components/StatusChip";
import { PageState } from "../components/PageState";
import { MockRoom, OverlayCanvas } from "../components/OverlayCanvas";

const BAR = { look: "bg-look", alert: "bg-alert", ok: "bg-ok" };

export default function VideoReview() {
  const { sessionId } = useParams();
  const [params] = useSearchParams();
  const { t, locale } = useI18n();
  const { data, error, loading } = useData(() => Promise.all([getSession(sessionId), getFrames(sessionId)]), [sessionId]);
  const [session, frames] = data ?? [];
  const [events, setEvents] = useState(null);
  const [second, setSecond] = useState(Number(params.get("t") ?? 0));
  const [playing, setPlaying] = useState(false);
  const [showBoxes, setShowBoxes] = useState(true);
  const [showOutlines, setShowOutlines] = useState(true);

  useEffect(() => {
    if (session) setEvents(session.events);
  }, [session]);

  const durationS = session?.video.duration_s ?? 0;

  // Play: move through the frames in real time.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setSecond((s) => Math.min(s + 0.5, durationS)), 500);
    return () => clearInterval(id);
  }, [playing, durationS]);

  useEffect(() => {
    if (playing && second >= durationS) setPlaying(false);
  }, [playing, second, durationS]);

  const frame = useMemo(() => {
    if (!frames?.frames.length) return null;
    let best = frames.frames[0];
    for (const f of frames.frames) {
      if (f.t <= second) best = f;
      else break;
    }
    return best;
  }, [frames, second]);

  const children = session?.children ?? [];
  const colorFor = useCallback((id) => childTheme(children, id).onDark, [children]);
  const nameFor = useCallback((id) => children.find((c) => c.id === id)?.name, [children]);

  if (loading || error || !session || !events) return <PageState loading={loading} error={error} />;

  const current = events.find((e) => e.start_s - 5 <= second && second <= e.end_s + 10) ?? null;
  const pct = (s) => `${(s / durationS) * 100}%`;
  const hasVideo = !USE_MOCKS && session.video.url;

  async function answer(event, value) {
    const updated = await markAlertReviewed(event.id, value);
    setEvents((list) => list.map((e) => (e.id === event.id ? { ...e, reviewed: updated?.reviewed ?? value } : e)));
  }

  const childName = (id) => nameFor(id) ?? "";

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-6 sm:px-6">
      <Link to="/dashboard" className="text-sm text-muted hover:text-ink">
        {t("review.back")}
      </Link>

      <div className="flex flex-col gap-5 lg:flex-row">
        <section className="flex min-w-0 flex-[2] flex-col gap-3.5 self-start rounded-[22px] bg-[#16181D] p-3 sm:p-4">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#23262E]">
            {hasVideo ? <video src={session.video.url} className="h-full w-full object-cover" muted /> : <MockRoom />}
            <OverlayCanvas frame={frame} colorFor={colorFor} nameFor={nameFor} showBoxes={showBoxes} showOutlines={showOutlines} />
            <span className="absolute start-3 bottom-3 rounded-md bg-black/60 px-2.5 py-1 text-xs text-[#E6E9EF] tabular-nums">
              {clock(locale, session.started_at, second)}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[#C9CDD6]">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? t("review.pause") : t("review.play")}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sun text-ink"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                {playing ? <path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" /> : <path d="M7 4l13 8-13 8z" fill="currentColor" />}
              </svg>
            </button>
            <div dir="ltr" className="relative h-8 flex-1">
              <div className="absolute inset-x-0 top-3.5 h-1 rounded bg-[#3A3F4B]" />
              {events.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  aria-label={t(`event.${e.type}`)}
                  onClick={() => setSecond(e.start_s)}
                  className={`absolute top-2.5 h-3 min-w-2 rounded ${BAR[severity(e)]}`}
                  style={{ left: pct(e.start_s), width: pct(Math.max(e.end_s - e.start_s, 4)) }}
                />
              ))}
              <input
                type="range"
                min={0}
                max={durationS}
                step={0.5}
                value={second}
                onChange={(e) => {
                  setPlaying(false);
                  setSecond(Number(e.target.value));
                }}
                aria-label={t("today.timeline.drag")}
                className="absolute inset-x-0 top-1.5 w-full accent-[#E6E9EF] opacity-80"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-[#9BA1AD]">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={showBoxes} onChange={(e) => setShowBoxes(e.target.checked)} className="accent-sun" />
              {t("review.boxes")}
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={showOutlines} onChange={(e) => setShowOutlines(e.target.checked)} className="accent-sun" />
              {t("review.outlines")}
            </label>
            <span>{t("review.flagged")}</span>
          </div>
          {!hasVideo && <p className="text-xs text-[#7E8594]">{t("review.noVideo")}</p>}
        </section>

        <aside className="flex min-w-0 flex-1 flex-col gap-4">
          {current ? (
            <>
              <Card className="!p-6">
                <StatusChip kind={severity(current)} label={current.reviewed ? t("status.reviewed") : undefined} />
                <h1 className="mt-3.5 mb-1.5 text-2xl font-bold tracking-tight">{t(`event.${current.type}`)}</h1>
                <p className="text-[15px] leading-relaxed text-body">
                  {t(`event.desc.${current.type}`, { name: childName(current.child_id) })}
                </p>
                <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted">{t("children.label")}</dt>
                  <dd className="font-semibold">{childName(current.child_id)}</dd>
                  <dt className="text-muted">{t("review.length")}</dt>
                  <dd className="font-semibold">
                    {clock(locale, session.started_at, current.start_s)} · {duration(t, current.end_s - current.start_s)}
                  </dd>
                  <dt className="text-muted">{t("review.sure")}</dt>
                  <dd className="font-semibold">{t("review.sureValue", { pct: Math.round(current.confidence * 100) })}</dd>
                </dl>
              </Card>
              <Card className="!p-6">
                {current.reviewed ? (
                  <>
                    <p className="font-semibold">{t("review.reviewedNote")}</p>
                    <button type="button" onClick={() => answer(current, false)} className="mt-3 text-sm font-semibold text-clay">
                      {t("review.undo")}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="mb-3 font-bold">{t("review.question")}</div>
                    <div className="flex flex-col gap-2.5">
                      <button type="button" onClick={() => answer(current, true)} className="min-h-12 rounded-xl bg-clay font-semibold text-white hover:bg-clay-dark">
                        {t("review.fine")}
                      </button>
                      <button type="button" onClick={() => answer(current, true)} className="min-h-12 rounded-xl border border-[#ded5ca] bg-white font-semibold">
                        {t("review.follow")}
                      </button>
                    </div>
                    <p className="mt-3 text-[13px] text-muted">{t("review.answerNote")}</p>
                  </>
                )}
              </Card>
            </>
          ) : (
            <Card className="!p-6 text-body">{t("review.pick")}</Card>
          )}

          <Card className="!p-6">
            <h2 className="mb-2 font-bold">{t("review.others")}</h2>
            <ul>
              {events.map((e) => (
                <li key={e.id} className="border-t border-[#f0eae2] first:border-0">
                  <button
                    type="button"
                    onClick={() => setSecond(e.start_s)}
                    className="flex min-h-12 w-full items-center gap-3 py-2.5 text-start"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{t(`event.${e.type}`)}</span>
                      <span className="block text-xs text-muted">
                        {t("event.who", { name: childName(e.child_id), time: clock(locale, session.started_at, e.start_s) })}
                      </span>
                    </span>
                    <StatusChip kind={severity(e)} label={e.reviewed ? t("status.reviewed") : undefined} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </main>
  );
}
