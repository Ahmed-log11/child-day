// Month: a calendar where each day shows its screen time, activity and moments.
import { useI18n } from "../i18n/I18nProvider";
import { getSummary } from "../api/client";
import { useData } from "../lib/useData";
import { useChildren } from "../lib/useChildren";
import { childTheme, useSelectedChild } from "../lib/children";
import { duration } from "../lib/format";
import { dateOf, isWeekend, screenOf } from "../lib/summary";
import { usePageTint } from "../layout/AppShell";
import { Card } from "../components/Card";
import { ChildSwitch } from "../components/ChildSwitch";
import { RangeTabs } from "../components/RangeTabs";
import { PageState } from "../components/PageState";

function Strong({ children }) {
  return <span className="font-bold text-screen">{children}</span>;
}

export default function Month() {
  const { t, tl, locale } = useI18n();
  const { children } = useChildren();
  const [child, select] = useSelectedChild(children);
  const theme = child ? childTheme(children, child.id) : null;
  usePageTint(theme?.tint ?? null);
  const { data, error, loading } = useData(() => (child ? getSummary({ range: "month", childId: child.id }) : Promise.resolve(null)), [child?.id]);

  if (loading || error || !data || !child) return <PageState loading={loading} error={error} />;

  const end = dateOf(data.end_date);
  const year = end.getFullYear();
  const month = end.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = new Date(year, month, 1).getDay(); // weeks start on Sunday
  const byDate = Object.fromEntries(data.days.map((d) => [d.date, d]));
  const goal = data.guideline.active_target_s_per_day;
  const fmtDay = (iso) => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric" }).format(dateOf(iso));
  const top = [...data.days].sort((a, b) => screenOf(b) - screenOf(a))[0];
  const mover = [...data.days].sort((a, b) => b.active_s - a.active_s)[0];
  const short = tl("days.short");
  const pad = (n) => String(n).padStart(2, "0");

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pt-7 sm:px-6 sm:pt-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1.5 text-sm text-muted">{new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(end)}</div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("month.title", { name: child.name })}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ChildSwitch children={children} selectedId={child.id} onSelect={select} />
          <RangeTabs />
        </div>
      </div>

      <Card>
        <p className="max-w-4xl text-lg leading-relaxed font-medium sm:text-[22px]">
          {t("month.summary", { name: child.name, day: <Strong>{fmtDay(top.date)}</Strong>, active: <span className="font-bold text-move-text">{fmtDay(mover.date)}</span> })}
        </p>
      </Card>

      <Card className="!p-4 sm:!p-6">
        <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-body">
          <li className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-screen" />{t("month.legend.screen")}</li>
          <li className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-sm bg-move" />{t("month.legend.active")}</li>
          <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-look" />{t("month.legend.moment")}</li>
        </ul>
        <div className="overflow-x-auto">
          <div className="grid min-w-[700px] grid-cols-7 gap-1.5 sm:gap-2">
            {short.map((d, i) => (
              <div key={d} className={`px-1 text-[13px] ${i >= 5 ? "font-semibold text-ink" : "text-muted"}`}>{d}</div>
            ))}
            {Array.from({ length: lead }, (_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const iso = `${year}-${pad(month + 1)}-${pad(i + 1)}`;
              const d = byDate[iso];
              const today = iso === data.end_date;
              if (!d) {
                return (
                  <div key={iso} className={`min-h-24 rounded-xl border border-dashed border-[#ded5ca] p-2.5 ${isWeekend(iso) ? "bg-[#f6f1ea]" : ""}`}>
                    <div className="text-[13px] text-[#a3a7ad]">{i + 1}</div>
                  </div>
                );
              }
              const s = screenOf(d);
              return (
                <div
                  key={iso}
                  className="flex min-h-24 flex-col gap-1.5 rounded-xl p-2.5"
                  style={
                    today
                      ? { border: `2px solid ${theme.color}`, background: `linear-gradient(180deg, ${theme.tint}, #fff)` }
                      : { border: "1px solid var(--color-line)", background: isWeekend(iso) ? "#fbf7f1" : "#fff" }
                  }
                >
                  <div className="flex items-baseline justify-between gap-1">
                    <span className={`text-[13px] ${today ? "font-bold" : "font-semibold"}`}>{i + 1}</span>
                    <span className="text-[11px] text-muted tabular-nums">{duration(t, s)}</span>
                  </div>
                  <div className="h-2.5 rounded bg-[#f3efe8]">
                    <div className="h-2.5 rounded bg-screen" style={{ width: `${Math.min(100, (s / (5 * 3600)) * 100)}%` }} />
                  </div>
                  <div className="h-1.5 rounded bg-move-soft">
                    <div className="h-1.5 rounded bg-move" style={{ width: `${Math.min(100, (d.active_s / goal) * 100)}%` }} />
                  </div>
                  <div className="flex h-2 gap-0.5">
                    {Array.from({ length: d.alerts }, (_, k) => (
                      <span key={k} className="size-2 rounded-full bg-look" />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {data.days.some((d) => d.is_demo_data) && <p className="mt-4 text-[13px] text-muted">{t("week.demo")}</p>}
      </Card>
    </main>
  );
}
