// Week: screens and activity day by day for one child, with the weekend shaded.
import { useI18n } from "../i18n/I18nProvider";
import { getSummary } from "../api/client";
import { useData } from "../lib/useData";
import { useChildren } from "../lib/useChildren";
import { childTheme, useSelectedChild } from "../lib/children";
import { duration } from "../lib/format";
import { avg, dateOf, isWeekend, screenOf } from "../lib/summary";
import { usePageTint } from "../layout/AppShell";
import { Card, StatCard } from "../components/Card";
import { ChildSwitch } from "../components/ChildSwitch";
import { RangeTabs } from "../components/RangeTabs";
import { PageState } from "../components/PageState";

function Strong({ className, children }) {
  return <span className={`font-bold ${className}`}>{children}</span>;
}

export default function Week() {
  const { t, tl, locale } = useI18n();
  const { children } = useChildren();
  const [child, select] = useSelectedChild(children);
  const theme = child ? childTheme(children, child.id) : null;
  usePageTint(theme?.tint ?? null);
  const { data, error, loading } = useData(() => (child ? getSummary({ range: "week", childId: child.id }) : Promise.resolve(null)), [child?.id]);

  if (loading || error || !data || !child) return <PageState loading={loading} error={error} />;

  const days = [...data.days].reverse(); // oldest first, for the chart
  const goal = data.guideline.active_target_s_per_day;
  const goalDays = days.filter((d) => d.active_s >= goal).length;
  const moments = days.reduce((s, d) => s + d.alerts, 0);
  const maxScreen = Math.max(...days.map(screenOf), 1);
  const short = tl("days.short");
  const range = `${new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(dateOf(data.start_date))} – ${new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(dateOf(data.end_date))}`;

  const summary = t("week.summary", {
    name: child.name,
    screen: <Strong className="text-screen">{duration(t, avg(days, screenOf))}</Strong>,
    goal: <Strong className="text-move-text">{t("week.goalDays", { n: goalDays, total: days.length })}</Strong>,
    moments: <Strong className="text-look-text">{moments === 1 ? t("today.moment") : t("today.moments", { count: moments })}</Strong>,
  });

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pt-7 sm:px-6 sm:pt-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1.5 text-sm text-muted">{range}</div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("week.title", { name: child.name })}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ChildSwitch children={children} selectedId={child.id} onSelect={select} />
          <RangeTabs />
        </div>
      </div>

      <Card>
        <p className="max-w-4xl text-lg leading-relaxed font-medium sm:text-[22px]">{summary}</p>
      </Card>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t("week.stats.screen")} value={duration(t, avg(days, screenOf))} />
        <StatCard
          label={t("week.stats.active")}
          value={duration(t, avg(days, (d) => d.active_s))}
          note={t("week.stats.activeNote", { goal: duration(t, goal) })}
          bar={{ pct: (avg(days, (d) => d.active_s) / goal) * 100, fill: "bg-move", track: "bg-move-soft" }}
        />
        <StatCard
          label={t("week.stats.multi")}
          value={duration(t, days.reduce((s, d) => s + d.multi_screen_s, 0))}
          note={t("week.stats.multiNote")}
        />
        <StatCard label={t("week.stats.moments")} value={moments} note={t("week.stats.momentsNote")} />
      </section>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{t("week.chart")}</h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-body">
            <li className="flex items-center gap-1.5"><span className="size-3 rounded-[3px] bg-screen" />{t("week.screen")}</li>
            <li className="flex items-center gap-1.5"><span className="size-3 rounded-[3px] bg-move" />{t("week.active")}</li>
            <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-look" />{t("today.timeline.legend.look")}</li>
          </ul>
        </div>
        <div className="flex gap-1.5 sm:gap-2">
          {days.map((d, i) => {
            const last = i === days.length - 1;
            const s = screenOf(d);
            return (
              <div key={d.date} className={`flex flex-1 flex-col items-center gap-2 rounded-2xl px-0.5 py-2.5 ${isWeekend(d.date) ? "bg-[#f6f1ea]" : ""}`}>
                <div className={`text-[11px] font-semibold sm:text-[13px] ${last ? "text-ink" : "text-muted"}`}>{duration(t, s)}</div>
                <div className="flex h-44 w-full items-end justify-center gap-1 sm:h-52 sm:gap-1.5">
                  <div className="w-[38%] rounded-t-md" style={{ height: `${(s / maxScreen) * 100}%`, background: last ? "#2F4F86" : "#9FB0CF" }} />
                  <div className="w-[38%] rounded-t-md" style={{ height: `${Math.min(100, (d.active_s / (goal * 1.5)) * 100)}%`, background: last ? "#1F9AA8" : "#9ED3D9" }} />
                </div>
                <div className="flex h-2 gap-0.5">
                  {Array.from({ length: d.alerts }, (_, k) => (
                    <span key={k} className="size-2 rounded-full bg-look" />
                  ))}
                </div>
                <div className={`text-xs sm:text-sm ${last ? "font-bold" : ""}`}>{short[dateOf(d.date).getDay()]}</div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-[13px] text-muted">
          {t("week.weekend")} {days.some((d) => d.is_demo_data) && t("week.demo")}
        </p>
      </Card>
    </main>
  );
}
