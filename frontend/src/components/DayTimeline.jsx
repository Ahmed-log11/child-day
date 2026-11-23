// The day as a sky: the background follows the time of day, screens and movement sit on top.
// Drag the slider to see what the child was doing at any moment.
import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { clock, hourOf } from "../lib/format";
import { severity } from "../lib/children";
import { Figure, poseFor } from "./Figure";
import { StatusChip } from "./StatusChip";

const SCREEN_COLOR = { tv: "bg-screen", tablet: "bg-screen", phone: "bg-screen", multi_screen: "bg-screen-2" };
const MOVE_COLOR = { active: "bg-move", light: "bg-move-light" };
const DOT_COLOR = { look: "bg-look", alert: "bg-alert", ok: "bg-ok" };

function skyColor(hour) {
  if (hour < 9) return "#EEEBF2"; // morning
  if (hour < 15) return "#FAF8F3"; // day
  if (hour < 18) return "#F6ECDF"; // afternoon
  if (hour < 19.5) return "#ECDDD0"; // evening
  return "#3B3A4A"; // night
}

function stateAt(segments, category, second) {
  return segments.find((s) => s.category === category && s.start_s <= second && second < s.end_s)?.state;
}

export function DayTimeline({ startedAt, durationS, segments, events, theme, sessionId }) {
  const { t, locale } = useI18n();
  const [second, setSecond] = useState(Math.round(durationS * 0.55));
  const pct = (s) => `${(s / durationS) * 100}%`;

  // Sky: one slice every 5% of the video, colored by the clock time at that point.
  const slices = Array.from({ length: 20 }, (_, i) => skyColor(hourOf(startedAt, (durationS * i) / 20)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ f, label: clock(locale, startedAt, durationS * f) }));

  const screen = stateAt(segments, "screen", second) ?? "none";
  const activity = stateAt(segments, "activity", second) ?? "still";
  const momentNow = events.find((e) => e.start_s - 3 <= second && second <= e.end_s + 10);

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
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-body">
          {legend.map(([cls, key]) => (
            <li key={key} className="flex items-center gap-1.5">
              <span className={`size-3 rounded-[3px] ${cls}`} />
              {t(`today.timeline.legend.${key}`)}
            </li>
          ))}
          <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-look" />{t("today.timeline.legend.look")}</li>
          <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-alert" />{t("today.timeline.legend.alert")}</li>
        </ul>
      </div>

      <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 sm:grid-cols-[80px_minmax(0,1fr)] sm:gap-x-4">
        <div className="flex flex-col justify-around py-3 text-sm font-semibold">
          <span className="text-[13px] font-medium text-muted">{t("today.timeline.moments")}</span>
          <span>{t("today.timeline.screens")}</span>
          <span>{t("today.timeline.moving")}</span>
        </div>

        {/* Time always runs left to right, in both languages, like a clock line. */}
        <div dir="ltr" className="relative overflow-hidden rounded-xl py-3">
          <div className="absolute inset-0 flex" aria-hidden="true">
            {slices.map((c, i) => (
              <span key={i} className="flex-1" style={{ background: c }} />
            ))}
          </div>
          <div className="relative flex flex-col gap-3.5">
            <div className="relative h-4">
              {events.map((e) => (
                <span
                  key={e.id}
                  title={t(`event.${e.type}`)}
                  className={`absolute top-0.5 size-3 -translate-x-1/2 rounded-full border-2 border-white ${DOT_COLOR[severity(e)]}`}
                  style={{ left: pct(e.start_s) }}
                />
              ))}
            </div>
            <div className="relative h-9">
              {segments
                .filter((s) => s.category === "screen" && SCREEN_COLOR[s.state])
                .map((s) => (
                  <div
                    key={s.start_s}
                    className={`absolute inset-y-0 flex items-center overflow-hidden rounded-md px-2 text-xs font-semibold whitespace-nowrap text-white ${SCREEN_COLOR[s.state]}`}
                    style={{ left: pct(s.start_s), width: pct(s.end_s - s.start_s) }}
                  >
                    {s.state !== "multi_screen" && (s.end_s - s.start_s) / durationS >= 0.1 && (
                      <span className={(s.end_s - s.start_s) / durationS < 0.2 ? "hidden sm:inline" : undefined}>
                        {t(`screen.${s.state}`)}
                      </span>
                    )}
                  </div>
                ))}
            </div>
            <div className="relative h-9">
              {segments
                .filter((s) => s.category === "activity" && MOVE_COLOR[s.state])
                .map((s) => (
                  <div
                    key={s.start_s}
                    className={`absolute inset-y-0 rounded-md ${MOVE_COLOR[s.state]}`}
                    style={{ left: pct(s.start_s), width: pct(s.end_s - s.start_s) }}
                  />
                ))}
            </div>
          </div>
          <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-ink" style={{ left: pct(second) }} />
        </div>

        <span />
        <div dir="ltr" className="relative mt-1.5 h-5 text-xs text-muted">
          {ticks.map(({ f, label }) => (
            <span
              key={f}
              className="absolute"
              style={f === 1 ? { right: 0 } : { left: `${f * 100}%`, transform: f === 0 ? "none" : "translateX(-50%)" }}
            >
              {label}
            </span>
          ))}
        </div>

        <span />
        <label className="mt-2 flex flex-col gap-1 text-[13px] text-muted">
          {t("today.timeline.drag")}
          <input
            dir="ltr"
            type="range"
            min={0}
            max={durationS}
            step={1}
            value={second}
            onChange={(e) => setSecond(Number(e.target.value))}
            className="w-full accent-clay"
          />
        </label>
      </div>

      <div
        className="mt-5 flex items-center gap-5 rounded-2xl border px-5 py-3"
        style={{ borderColor: theme.tint, background: `linear-gradient(180deg, ${theme.tint}, #fff)` }}
        aria-live="polite"
      >
        <div className="shrink-0 rounded-xl bg-white px-1.5 py-1">
          <Figure pose={poseFor(screen, activity)} color={activity === "active" ? "#17707A" : "#1C2430"} width={60} />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] text-muted tabular-nums">{clock(locale, startedAt, second)}</div>
          <div className="mt-0.5 text-lg font-bold sm:text-xl">
            {t("now.sentence", { screen: t(`now.${screen}`), activity: t(`now.${activity}`) })}
          </div>
          {momentNow && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusChip kind={severity(momentNow)} label={t(`event.${momentNow.type}`)} />
              <Link to={`/sessions/${sessionId}?t=${momentNow.start_s}`} className="text-sm font-semibold text-clay">
                {t("today.list.watch")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
