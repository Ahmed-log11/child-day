// Month: a calendar of screen time, the 4-week trend and weekdays against the weekend.
// Sample history (one uploaded video is one day), marked as such.
import { useI18n } from "../i18n/I18nProvider";
import { useChildren } from "../lib/useChildren";
import { childTheme, useSelectedChild } from "../lib/children";
import { duration } from "../lib/format";
import { avgOf, change, history, isoOf, screenOf, seen, sumOf } from "../lib/history";
import { usePageTint } from "../layout/AppShell";
import { Card } from "../components/Card";
import { ChildSwitch } from "../components/ChildSwitch";
import { RangeTabs } from "../components/RangeTabs";
import { PageState } from "../components/PageState";
import { PageHead } from "../components/PageHead";
import { Banner, Icon, ICONS, Kpi, NO_VIDEO } from "../components/Overview";
import { Link } from "react-router-dom";
import { monthAdvice } from "../lib/advice";
import { AdviceCard, ExportButton } from "../components/AdviceCard";

const LEVELS = [
  ["high", "#2F4F86", 3 * 3600],
  ["mid", "#93A7CB", 2 * 3600],
  ["low", "#DCE3EF", 0],
];
const levelOf = (s) => LEVELS.find(([, , min]) => s >= min);
const WEEKEND = [5, 6];

function Trend({ weeks, t }) {
  const W = 300;
  const H = 150;
  const max = Math.max(...weeks.flatMap((w) => [w.screen, w.active]), 60) * 1.15;
  const x = (i) => 30 + (i * (W - 50)) / Math.max(1, weeks.length - 1);
  const y = (v) => H - 20 - (v / max) * (H - 36);
  const line = (key) => weeks.map((w, i) => `${x(i)},${y(w[key])}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" dir="ltr" role="img" aria-label={t("mo.trend")}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1="28" x2={W - 10} y1={y(max * f * 0.85)} y2={y(max * f * 0.85)} stroke="rgba(28,23,20,.08)" />
          <text x="0" y={y(max * f * 0.85) + 4} fontSize="10" fill="#7D7062" fontFamily="ui-monospace,monospace">
            {Math.round(max * f * 0.85)}
          </text>
        </g>
      ))}
      <polyline points={line("screen")} fill="none" stroke="#2F4F86" strokeWidth="2.5" />
      <polyline points={line("active")} fill="none" stroke="#2E9C8C" strokeWidth="2.5" />
      {weeks.map((w, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(w.screen)} r="4" fill="#FAF6F1" stroke="#2F4F86" strokeWidth="2" />
          <circle cx={x(i)} cy={y(w.active)} r="4" fill="#FAF6F1" stroke="#2E9C8C" strokeWidth="2" />
          <text x={x(i)} y={H + 12} fontSize="10.5" textAnchor="middle" fill="#3B322C">
            {t("mo.weekN", { n: i + 1 })}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function Month() {
  const { t, tl, locale } = useI18n();
  const { children, loading, error } = useChildren();
  const [child, select] = useSelectedChild(children);
  const theme = child ? childTheme(children, child.id) : null;
  usePageTint(theme?.tint ?? null);

  if (loading || error || !child) return <PageState loading={loading} error={error} />;

  const index = children.findIndex((c) => c.id === child.id);
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const all = history(child.id, index, today.getDate() + 31);
  const byDate = Object.fromEntries(all.map((d) => [d.date, d]));
  const thisMonth = all.filter((d) => new Date(`${d.date}T12:00:00`).getMonth() === month);
  const lastMonth = all.filter((d) => new Date(`${d.date}T12:00:00`).getMonth() !== month);
  const days = seen(thisMonth);

  const screenAvg = avgOf(thisMonth, screenOf);
  const activeAvg = avgOf(thisMonth, (d) => d.active_s);
  const moments = sumOf(thisMonth, (d) => d.alerts);
  const coverage = Math.round((days.length / Math.max(1, thisMonth.length)) * 100);
  const videoAvg = avgOf(thisMonth, (d) => d.video_s);
  const screenChange = change(screenAvg, avgOf(lastMonth, screenOf));
  const activeChange = change(activeAvg, avgOf(lastMonth, (d) => d.active_s));

  // Last 4 weeks, minutes per day.
  const last28 = all.slice(-28);
  const weeks = [0, 1, 2, 3].map((w) => {
    const part = last28.slice(w * 7, w * 7 + 7);
    return { screen: Math.round(avgOf(part, screenOf) / 60), active: Math.round(avgOf(part, (d) => d.active_s) / 60) };
  });
  const split = (fn) => {
    const wd = days.filter((d) => !WEEKEND.includes(new Date(`${d.date}T12:00:00`).getDay()));
    const we = days.filter((d) => WEEKEND.includes(new Date(`${d.date}T12:00:00`).getDay()));
    return [avgOf(wd, fn), avgOf(we, fn)];
  };
  const [screenWd, screenWe] = split(screenOf);
  const [activeWd, activeWe] = split((d) => d.active_s);
  const lead = new Date(year, month, 1).getDay(); // weeks start on Sunday
  const short = tl("days.short");
  const monthName = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(today);
  const fmtMin = (s) => duration(t, s);

  const Bar = ({ label, value, max, color }) => (
    <div className="mb-2 grid grid-cols-[minmax(80px,auto)_minmax(0,1fr)_auto] items-center gap-2.5 text-[13px]">
      <span>{label}</span>
      <span className="h-2.5 overflow-hidden rounded-full bg-[rgba(28,23,20,.06)]">
        <i className="block h-full rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
      </span>
      <b className="whitespace-nowrap text-ink">{t("ov.perDayShort", { v: fmtMin(value) })}</b>
    </div>
  );

  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 pt-4 sm:px-6 sm:pt-6">
      <PageHead
        eyebrow={monthName}
        title={t("month.title", { name: child.name })}
        sub={t(`child.ages.${child.age_group}`)}
        tools={
          <>
            <ChildSwitch children={children} selectedId={child.id} onSelect={select} />
            <RangeTabs />
            <ExportButton to={`/report?range=month&child=${child.id}`} />
          </>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Banner>
          {t("mo.insight", {
            screen: <b key="s">{t(screenChange <= 0 ? "wk.less" : "wk.more", { pct: Math.abs(screenChange) })}</b>,
            active: <b key="a">{t(activeChange >= 0 ? "mo.activeMore" : "mo.activeLess", { pct: Math.abs(activeChange) })}</b>,
          })}
        </Banner>
        <Card>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[19px] font-semibold">{t("mo.coverage")}</h2>
            <b className="text-[26px] font-extrabold text-ink">{coverage}%</b>
          </div>
          <p className="mt-2 text-[14.5px] text-body">{t("mo.coverageText", { video: fmtMin(videoAvg), n: days.length, total: thisMonth.length })}</p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[rgba(28,23,20,.06)]">
            <i className="block h-full rounded-full bg-clay" style={{ width: `${coverage}%` }} />
          </div>
          <p className="mt-3 text-[12.5px] text-muted">{t("mo.coverageNote")}</p>
        </Card>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={ICONS.screen} label={t("ov.screen")} value={fmtMin(screenAvg)} sub={t("ov.perDayLabel")} delta={screenChange} />
        <Kpi icon={ICONS.active} label={t("ov.active")} value={fmtMin(activeAvg)} sub={t("ov.perDayLabel")} delta={activeChange} />
        <Kpi icon={ICONS.moment} label={t("ov.moments")} value={moments} sub={t("mo.thisMonth")} />
        <Kpi icon={ICONS.camera} label={t("mo.coverage")} value={`${coverage}%`} sub={t("mo.daysOf", { n: days.length, total: thisMonth.length })} />
      </div>

      <AdviceCard
        items={monthAdvice(t, { child, thisMonth, lastMonth, weeks })}
        links={{
          review: `/alerts?child=${child.id}`,
          export: `/report?range=month&child=${child.id}`,
          specialist: `/report?range=month&child=${child.id}&for=specialist`,
        }}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <h2 className="text-[19px] font-semibold">{t("mo.calendar")}</h2>
          <p className="mb-4 text-[12.5px] text-muted">{t("mo.calendarNote", { month: monthName })}</p>
          <div className="grid grid-cols-7 gap-[5px]">
            {short.map((d, i) => (
              <span key={d} className={`pb-0.5 text-center text-[11.5px] ${i >= 5 ? "rounded-lg bg-[rgba(28,23,20,.06)] font-bold text-ink" : "text-muted"}`}>
                {d}
              </span>
            ))}
            {Array.from({ length: lead }, (_, i) => <span key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const date = new Date(year, month, i + 1, 12);
              const iso = isoOf(date);
              const d = byDate[iso];
              const future = date > today;
              const isToday = i + 1 === today.getDate();
              const weekend = WEEKEND.includes(date.getDay());
              const style = future
                ? { border: "1px dashed rgba(28,23,20,.18)", color: "#B3A79B" }
                : !d || d.none
                  ? { ...NO_VIDEO, color: "#9E9185" }
                  : { background: levelOf(screenOf(d))[1], color: screenOf(d) >= 3 * 3600 ? "#fff" : "#1C1714" };
              return (
                <span
                  key={iso}
                  className={`relative grid aspect-square place-items-center rounded-[10px] text-[12.5px] font-semibold ${isToday ? "outline-2 outline-offset-1 outline-ink" : ""} ${weekend ? "shadow-[inset_0_-3px_0_rgba(28,23,20,.18)]" : ""}`}
                  style={style}
                  title={d && !d.none ? fmtMin(screenOf(d)) : undefined}
                >
                  {i + 1}
                  {d?.alerts > 0 && !future && <i className="absolute end-1 top-1 size-1.5 rounded-full bg-alert" />}
                </span>
              );
            })}
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-body">
            {LEVELS.map(([k, c]) => (
              <li key={k} className="flex items-center gap-1.5">
                <i className="size-3 rounded-[3px]" style={{ background: c }} />
                {t(`mo.level.${k}`)}
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <i className="size-3 rounded-[3px]" style={NO_VIDEO} />
              {t("ov.noVideo")}
            </li>
            <li className="flex items-center gap-1.5">
              <i className="size-2 rounded-full bg-alert" />
              {t("mo.moment")}
            </li>
          </ul>
        </Card>

        <Card>
          <h2 className="text-[19px] font-semibold">{t("mo.trend")}</h2>
          <ul className="mt-1 mb-2 flex gap-4 text-[12.5px] text-body">
            <li className="flex items-center gap-1.5"><i className="size-3 rounded-[3px] bg-screen" />{t("ov.screen")}</li>
            <li className="flex items-center gap-1.5"><i className="size-3 rounded-[3px] bg-move" />{t("ov.active")}</li>
            <li className="ms-auto text-muted">{t("mo.minPerDay")}</li>
          </ul>
          <Trend weeks={weeks} t={t} />
        </Card>

        <Card className="flex flex-col">
          <h2 className="mb-4 text-[19px] font-semibold">{t("mo.weekVsWeekend")}</h2>
          <div className="mb-2 text-[13px] font-semibold text-ink">{t("ov.screen")}</div>
          <Bar label={t("mo.weekdays")} value={screenWd} max={Math.max(screenWd, screenWe)} color="#93A7CB" />
          <Bar label={t("mo.weekend")} value={screenWe} max={Math.max(screenWd, screenWe)} color="#2F4F86" />
          <div className="mt-3 mb-2 text-[13px] font-semibold text-ink">{t("ov.active")}</div>
          <Bar label={t("mo.weekdays")} value={activeWd} max={Math.max(activeWd, activeWe)} color="#9FD3C9" />
          <Bar label={t("mo.weekend")} value={activeWe} max={Math.max(activeWd, activeWe)} color="#2E9C8C" />
          <Link
            to={`/report?range=month&child=${child.id}`}
            className="mt-auto flex min-h-11 items-center justify-center gap-2 rounded-full border border-[rgba(28,23,20,.18)] bg-paper px-4 text-sm font-semibold text-ink hover:border-clay"
          >
            <Icon d={ICONS.download} size={18} />
            {t("mo.pdf")}
          </Link>
        </Card>
      </div>

      <p className="text-[13px] text-muted">{t("ov.sample")}</p>
    </main>
  );
}
