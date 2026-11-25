// Review a moment: the video (or demo stage) with boxes and body outlines,
// a bar of flagged moments, and the question "what was it?".
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { getFrames, getSession, markAlertReviewed, USE_MOCKS } from "../api/client";
import { useData } from "../lib/useData";
import { childTheme, severity } from "../lib/children";
import { clock, duration } from "../lib/format";
import { Card } from "../components/Card";
import { StatusChip } from "../components/StatusChip";
import { PageState } from "../components/PageState";
import { FrameView } from "../components/FrameView";

const BAR = { look: "bg-look", alert: "bg-alert", ok: "bg-ok" };

export default function VideoReview() {
  const { sessionId } = useParams();
  const [params] = useSearchParams();
  const { t, locale, dir } = useI18n();
  const rtl = dir === "rtl";
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
  const hasVideo = !USE_MOCKS && !!session?.video?.url;
  const videoRef = useRef(null);

  // Demo stage (no video): move through the frames in real time.
  useEffect(() => {
    if (!playing || hasVideo) return;
    const id = setInterval(() => setSecond((s) => Math.min(s + 0.5, durationS)), 500);
    return () => clearInterval(id);
  }, [playing, durationS, hasVideo]);

  // Real video: the video is the clock. Play/pause it, and follow its time while it plays.
  useEffect(() => {
    const video = videoRef.current;
    if (!hasVideo || !video) return;
    if (!playing) {
      video.pause();
      return;
    }
    video.play().catch(() => setPlaying(false));
    let raf;
    const follow = () => {
      setSecond(video.currentTime);
      if (video.ended) setPlaying(false);
      else raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [playing, hasVideo]);

  // Real video: when the bar is dragged (or a moment is opened), jump the video there.
  useEffect(() => {
    const video = videoRef.current;
    if (!hasVideo || !video || playing) return;
    if (Math.abs(video.currentTime - second) > 0.25) video.currentTime = second;
  }, [second, playing, hasVideo]);

  useEffect(() => {
    if (playing && second >= durationS) setPlaying(false);
  }, [playing, second, durationS]);


  const children = session?.children ?? [];
  const colorFor = useCallback((id) => childTheme(children, id).onDark, [children]);
  const nameFor = useCallback((id) => children.find((c) => c.id === id)?.name, [children]);

  if (loading || error || !session || !events) return <PageState loading={loading} error={error} />;

  const current = events.find((e) => e.start_s - 5 <= second && second <= e.end_s + 10) ?? null;
  const pct = (s) => `${(s / durationS) * 100}%`;

  async function answer(event, value) {
    const updated = await markAlertReviewed(event.id, value);
    setEvents((list) => list.map((e) => (e.id === event.id ? { ...e, reviewed: updated?.reviewed ?? value } : e)));
  }

  const childName = (id) => nameFor(id) ?? "";

  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-4 px-4 pt-4 sm:px-6 sm:pt-6">
      <Link to="/dashboard" className="flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flip rotate-180" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        {t("review.back")}
      </Link>

      <div className="flex flex-col gap-5 lg:flex-row">
        <section className="flex min-w-0 flex-[2] flex-col gap-3.5 self-start rounded-[26px] border border-[rgba(217,105,45,.18)] bg-peach p-3.5 text-body">
          <FrameView
            videoUrl={hasVideo ? session.video.url : null}
            frames={frames}
            second={second}
            colorFor={colorFor}
            nameFor={nameFor}
            showBoxes={showBoxes}
            showOutlines={showOutlines}
            stamp={clock(locale, session.started_at, second)}
            videoRef={videoRef}
            follow={false}
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? t("review.pause") : t("review.play")}
              className="flex size-[46px] shrink-0 items-center justify-center rounded-full bg-clay text-white"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" className={playing ? "" : "flip"}>
                {playing ? <path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" /> : <path d="M7 4l13 8-13 8z" fill="currentColor" />}
              </svg>
            </button>
            <div className="relative h-[34px] flex-1">
              <div className="absolute inset-x-0 top-[15px] h-1 rounded bg-[rgba(28,23,20,.14)]" />
              {events.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  aria-label={t(`event.${e.type}`)}
                  onClick={() => setSecond(e.start_s)}
                  className={`absolute top-[11px] z-[2] h-3 min-w-2 rounded ${BAR[severity(e)]}`}
                  style={{ [rtl ? "right" : "left"]: pct(e.start_s), width: pct(Math.max(e.end_s - e.start_s, 4)) }}
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
                className="absolute inset-x-0 top-2 z-[1] w-full accent-clay opacity-90"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
            <label className="flex items-center gap-1.5 text-ink">
              <input type="checkbox" checked={showBoxes} onChange={(e) => setShowBoxes(e.target.checked)} className="size-4 accent-clay" />
              {t("review.boxes")}
            </label>
            <label className="flex items-center gap-1.5 text-ink">
              <input type="checkbox" checked={showOutlines} onChange={(e) => setShowOutlines(e.target.checked)} className="size-4 accent-clay" />
              {t("review.outlines")}
            </label>
            <span>{t("review.flagged")}</span>
          </div>
          {!hasVideo && <p className="text-xs text-muted">{t("review.noVideo")}</p>}
        </section>

        <aside className="flex min-w-0 flex-1 flex-col gap-4">
          {current ? (
            <>
              <Card className="!p-6">
                <StatusChip kind={severity(current)} label={current.reviewed ? t("status.reviewed") : undefined} />
                <h1 className="mt-3.5 mb-1.5 text-[28px] leading-tight font-extrabold tracking-tight">{t(`event.${current.type}`)}</h1>
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
                    <button type="button" onClick={() => answer(current, false)} className="mt-3 text-sm font-semibold text-rust">
                      {t("review.undo")}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="mb-3 font-bold">{t("review.question")}</div>
                    <div className="flex flex-col gap-2.5">
                      <button type="button" onClick={() => answer(current, true)} className="min-h-12 rounded-full bg-clay font-semibold text-white hover:bg-rust">
                        {t("review.fine")}
                      </button>
                      <button type="button" onClick={() => answer(current, true)} className="min-h-12 rounded-full border border-[rgba(28,23,20,.18)] bg-paper font-semibold">
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
                <li key={e.id} className="border-t border-[rgba(28,23,20,.1)] first:border-0">
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
