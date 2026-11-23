// Today: one child's day in words, numbers, the sky timeline and the moments to check.
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { getSession } from "../api/client";
import { useData } from "../lib/useData";
import { childTheme, severity, useColorVersion, useSelectedChild } from "../lib/children";
import { RangeTabs } from "../components/RangeTabs";
import { clock, duration, longDate, percent } from "../lib/format";
import { usePageTint } from "../layout/AppShell";
import { Card, StatCard } from "../components/Card";
import { ChildSwitch } from "../components/ChildSwitch";
import { DayTimeline } from "../components/DayTimeline";
import { StatusChip } from "../components/StatusChip";
import { PageState } from "../components/PageState";

const SCREENS = ["tv", "tablet", "multi_screen", "phone"];

function Strong({ className, children }) {
  return <span className={`font-bold ${className}`}>{children}</span>;
}

export default function Dashboard() {
  const { t, locale } = useI18n();
  const { data: session, error, loading } = useData(() => getSession("s1"), []);
  useColorVersion();
  const children = session?.children ?? [];
  const [child, setChildId] = useSelectedChild(children);
  const theme = child ? childTheme(children, child.id) : null;
  usePageTint(theme?.tint ?? null);

  if (loading || error || !child) return <PageState loading={loading} error={error} />;

  const totals = session.totals[child.id];
  const seen = totals.present_s;
  const screenS = totals.tv_s + totals.tablet_s + totals.phone_s + totals.multi_screen_s;
  const segments = session.segments.filter((s) => s.child_id === child.id);
  const events = session.events.filter((e) => e.child_id === child.id);
  const open = events.filter((e) => !e.reviewed);
  const maxScreen = Math.max(...SCREENS.map((k) => totals[`${k}_s`]), 1);

  const momentsText =
    open.length === 1 ? t("today.moment") : t("today.moments", { count: open.length });

  const summary = t(open.length ? "today.summary" : "today.summaryNoMoments", {
    name: child.name,
    screen: <Strong className="text-screen">{duration(t, screenS)}</Strong>,
    duration: duration(t, seen),
    multi: <Strong className="text-screen">{duration(t, totals.multi_screen_s)}</Strong>,
    active: <Strong className="text-move-text">{duration(t, totals.active_s)}</Strong>,
    moments: <Strong className="text-look-text">{momentsText}</Strong>,
  });

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pt-7 sm:px-6 sm:pt-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1.5 text-sm text-muted">{longDate(locale, session.date)}</div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("today.title", { name: child.name })}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ChildSwitch children={children} selectedId={child.id} onSelect={setChildId} />
          <RangeTabs />
        </div>
      </div>

      <Card>
        <p className="max-w-4xl text-lg leading-relaxed font-medium sm:text-[22px]">{summary}</p>
      </Card>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label={t("today.stats.screen")}
          value={duration(t, screenS)}
          note={t("today.stats.screenNote", { pct: percent(screenS, seen) })}
          bar={{ pct: percent(screenS, seen), fill: "bg-screen", track: "bg-screen-soft" }}
        />
        <StatCard label={t("today.stats.multi")} value={duration(t, totals.multi_screen_s)} note={t("today.stats.multiNote")} />
        <StatCard
          label={t("today.stats.active")}
          value={duration(t, totals.active_s)}
          note={t("today.stats.activeNote", { pct: percent(totals.active_s, seen) })}
          bar={{ pct: percent(totals.active_s, seen), fill: "bg-move", track: "bg-move-soft" }}
        />
        <StatCard label={t("today.stats.moments")} value={events.length} note={t("today.stats.momentsNote", { open: open.length })} />
      </section>

      <Card>
        <DayTimeline
          startedAt={session.started_at}
          durationS={session.video.duration_s}
          segments={segments}
          events={events}
          theme={theme}
          sessionId={session.id}
        />
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-5 text-lg font-bold">{t("today.breakdown.title")}</h2>
          <ul className="flex flex-col gap-3.5">
            {SCREENS.map((k) => (
              <li key={k}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span>{t(`screen.${k}`)}</span>
                  <span className="font-semibold">{duration(t, totals[`${k}_s`])}</span>
                </div>
                <div className="h-2.5 rounded-full bg-[#f3efe8]">
                  <div
                    className={`h-2.5 rounded-full ${k === "multi_screen" ? "bg-screen-2" : "bg-screen"}`}
                    style={{ width: `${(totals[`${k}_s`] / maxScreen) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[13px] text-muted">
            {t("today.breakdown.longest", {
              duration: duration(t, totals.longest_still.duration_s),
              time: clock(locale, session.started_at, totals.longest_still.start_s),
            })}
          </p>
        </Card>

        <Card>
          <h2 className="text-lg font-bold">{t("today.list.title")}</h2>
          <p className="mt-1 mb-3 text-[13px] text-muted">{t("today.list.note")}</p>
          {events.length === 0 && <p className="py-6 text-body">{t("today.list.empty")}</p>}
          <ul>
            {events.map((e) => (
              <li key={e.id} className="border-t border-[#f0eae2]">
                <Link to={`/sessions/${session.id}?t=${e.start_s}`} className="flex min-h-14 items-center gap-3.5 py-3.5">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{t(`event.${e.type}`)}</span>
                    <span className="block text-[13px] text-muted">
                      {t("event.duration", {
                        time: clock(locale, session.started_at, e.start_s),
                        length: duration(t, e.end_s - e.start_s),
                      })}
                    </span>
                  </span>
                  <StatusChip kind={severity(e)} label={e.reviewed ? t("status.reviewed") : undefined} />
                </Link>
              </li>
            ))}
          </ul>
          {open.length > 0 && (
            <Link
              to="/alerts"
              className="mt-3 flex min-h-12 items-center justify-center rounded-xl bg-clay text-sm font-semibold text-white hover:bg-clay-dark"
            >
              {t("today.list.reviewAll")}
            </Link>
          )}
        </Card>
      </section>

      <p className="text-[13px] text-muted">{t("today.privacy")}</p>
    </main>
  );
}
