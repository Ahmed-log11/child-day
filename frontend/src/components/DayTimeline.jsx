// The day as a sky: the background follows the time of day, screens and movement sit on top.
// Drag the bar to see the real video frame (with the outlines) and what the child was doing.
// Time runs with the reading direction: left to right in English, right to left in Arabic.
import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { clock, hourOf } from "../lib/format";
import { severity } from "../lib/children";
import { Figure, poseFor } from "./Figure";
import { StatusChip } from "./StatusChip";
import { FrameView } from "./FrameView";

const SCREEN_COLOR = { tv: "bg-screen", tablet: "bg-screen", phone: "bg-screen", multi_screen: "bg-screen-2" };
const MOVE_COLOR = { active: "bg-move", light: "bg-move-light" };
const INTAKE_COLOR = { eating: "bg-[#C27C3A]", drinking: "bg-[#5BA4C0]" };
const DOT_COLOR = { look: "bg-look", alert: "bg-alert", ok: "bg-ok" };

function skyColor(hour) {
  if (hour < 9) return "#EEE8EC"; // morning
  if (hour < 15) return "#F7F1E9"; // day
  if (hour < 18) return "#F3E6D7"; // afternoon
  if (hour < 19.5) return "#EAD8C7"; // evening
  return "#3B322C"; // night
}

function stateAt(segments, category, second) {
  return segments.find((s) => s.category === category && s.start_s <= second && second < s.end_s)?.state;
}

export function DayTimeline({ startedAt, durationS, segments, events, theme, sessionId, videoUrl, frames, colorFor, nameFor }) {
  const { t, locale, dir } = useI18n();
  const rtl = dir === "rtl";
  const [second, setSecond] = useState(Math.round(durationS * 0.55));
  const pct = (s) => `${(s / durationS) * 100}%`;
  const at = (s) => (rtl ? { right: pct(s) } : { left: pct(s) });
  const span = (a, b) => ({ ...at(a), width: pct(b - a) });

  // Sky: one slice every 5% of the video, colored by the clock time at that point.
  const slices = Array.from({ length: 20 }, (_, i) => skyColor(hourOf(startedAt, (durationS * i) / 20)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ f, label: clock(locale, startedAt, durationS * f) }));

  const screen = stateAt(segments, "screen", second) ?? "none";
  const activity = stateAt(segments, "activity", second) ?? "still";
  const intake = stateAt(segments, "intake", second) ?? "none";
  const momentNow = events.find((e) => e.start_s - 3 <= second && second <= e.end_s + 10);
  // Eating and drinking get their own lane, only when there is something to show.
  const intakeSegs = segments.filter((s) => s.category === "intake" && INTAKE_COLOR[s.state]);
  const sentence = t("now.sentence", { screen: t(`now.${screen}`), activity: t(`now.${activity}`) });

  const legend = [
    ["bg-screen", "screen"],
    ["bg-screen-2", "multi"],
    ["bg-move", "active"],
    ["bg-move-light", "light"],
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{t("today.timeline.title")}</h2>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-body">
          {legend.map(([cls, key]) => (
            <li key={key} className="flex items-center gap-1.5">
              <span className={`size-3 rounded-[3px] ${cls}`} />
              {t(`today.timeline.legend.${key}`)}
            </li>
          ))}
          {intakeSegs.length > 0 &&
            ["eating", "drinking"].map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <span className={`size-3 rounded-[3px] ${INTAKE_COLOR[k]}`} />
                {t(`today.timeline.legend.${k}`)}
              </li>
            ))}
          <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-look" />{t("today.timeline.legend.look")}</li>
          <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-alert" />{t("today.timeline.legend.alert")}</li>
        </ul>
      </div>

      <div className="grid grid-cols-[62px_minmax(0,1fr)] gap-x-2.5 sm:grid-cols-[80px_minmax(0,1fr)] sm:gap-x-3.5">
        <div className="flex flex-col justify-around py-3 text-[12.5px] font-semibold text-ink sm:text-sm">
          <span className="text-[12.5px] font-medium text-muted">{t("today.timeline.moments")}</span>
          <span>{t("today.timeline.screens")}</span>
          <span>{t("today.timeline.moving")}</span>
          {intakeSegs.length > 0 && <span>{t("today.timeline.intake")}</span>}
        </div>

        <div className="relative overflow-hidden rounded-2xl py-3">
          <div className="absolute inset-0 flex" aria-hidden="true">
            {slices.map((c, i) => (
              <span key={i} className="flex-1" style={{ background: c }} />
            ))}
          </div>
          <div className="relative flex flex-col gap-3.5">
            <div className="relative h-4">
              {events.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  title={t(`event.${e.type}`)}
                  aria-label={t(`event.${e.type}`)}
                  onClick={() => setSecond(e.start_s)}
                  className={`absolute top-0.5 size-[13px] rounded-full border-2 border-white ${DOT_COLOR[severity(e)]}`}
                  style={{ ...at(e.start_s), transform: `translateX(${rtl ? "50%" : "-50%"})` }}
                />
              ))}
            </div>
            <div className="relative h-9">
              {segments
                .filter((s) => s.category === "screen" && SCREEN_COLOR[s.state])
                .map((s) => (
                  <div
                    key={s.start_s}
                    className={`absolute inset-y-0 flex items-center overflow-hidden rounded-[7px] px-2 text-xs font-semibold whitespace-nowrap text-white ${SCREEN_COLOR[s.state]}`}
                    style={span(s.start_s, s.end_s)}
                  >
                    {s.state !== "multi_screen" && (s.end_s - s.start_s) / durationS >= 0.1 && (
                      <span className={(s.end_s - s.start_s) / durationS < 0.2 ? "hidden sm:inline" : undefined}>{t(`screen.${s.state}`)}</span>
                    )}
                  </div>
                ))}
            </div>
            <div className="relative h-9">
              {segments
                .filter((s) => s.category === "activity" && MOVE_COLOR[s.state])
                .map((s) => (
                  <div key={s.start_s} className={`absolute inset-y-0 rounded-[7px] ${MOVE_COLOR[s.state]}`} style={span(s.start_s, s.end_s)} />
                ))}
            </div>
            {intakeSegs.length > 0 && (
              <div className="relative h-6">
                {intakeSegs.map((s) => (
                  <div
                    key={s.start_s}
                    title={t(`intake.${s.state}`)}
                    className={`absolute inset-y-0 min-w-1.5 rounded-[7px] ${INTAKE_COLOR[s.state]}`}
                    style={span(s.start_s, s.end_s)}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="pointer-events-none absolute inset-y-0 z-[2] w-0.5 bg-rust" style={at(second)}>
            <span className="absolute -top-px -start-1 size-2.5 rounded-full bg-rust" />
          </div>
        </div>

        <span />
        <div className="relative mt-1.5 h-5 font-mono text-[11.5px] text-muted">
          {ticks.map(({ f, label }) => (
            <span
              key={f}
              className="absolute"
              style={
                f === 1
                  ? rtl
                    ? { left: 0 }
                    : { right: 0 }
                  : { ...at(durationS * f), transform: f === 0 ? "none" : `translateX(${rtl ? "50%" : "-50%"})` }
              }
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* The moment under the cursor: the real frame, the bar to move through it, and what was happening. */}
      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2.5">
          <FrameView
            videoUrl={videoUrl}
            frames={frames}
            second={second}
            colorFor={colorFor}
            nameFor={nameFor}
            stamp={clock(locale, startedAt, second)}
          />
          <label className="flex flex-col gap-1 text-[13px] text-muted">
            {t("today.timeline.drag")}
            <input
              type="range"
              min={0}
              max={durationS}
              step={0.5}
              value={second}
              onChange={(e) => setSecond(Number(e.target.value))}
              className="w-full accent-clay"
            />
          </label>
        </div>

        <div
          className="flex items-center gap-4 rounded-[22px] border px-4 py-3.5 sm:gap-5 sm:px-5"
          style={{ borderColor: theme.tint, background: `linear-gradient(180deg, ${theme.tint}, #FAF6F1)` }}
          aria-live="polite"
        >
          <div className="shrink-0 rounded-2xl bg-paper px-1.5 py-1">
            <Figure pose={poseFor(screen, activity)} color={activity === "active" ? "#1E7266" : "#1C1714"} width={60} />
          </div>
          <div className="min-w-0">
            <div className="font-mono text-xs text-muted tabular-nums">{clock(locale, startedAt, second)}</div>
            <div className="mt-0.5 text-lg leading-snug font-semibold text-ink sm:text-[21px]">
              {intake !== "none" ? t("now.withIntake", { sentence, intake: t(`intake.${intake}`) }) : sentence}
            </div>
            {momentNow && (
              <div className="mt-2 flex flex-wrap items-center gap-2.5">
                <StatusChip kind={severity(momentNow)} label={t(`event.${momentNow.type}`)} />
                <Link to={`/sessions/${sessionId}?t=${momentNow.start_s}`} className="text-sm font-semibold text-rust">
                  {t("today.list.watch")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
