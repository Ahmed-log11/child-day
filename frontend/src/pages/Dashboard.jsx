// Today: one child's day in words, numbers, the sky timeline and the moments to check.
import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { getDayAdvice, getFrames, getSession, swapChildren, USE_MOCKS } from "../api/client";
import { dayAdvice } from "../lib/advice";
import { AdviceCard, ExportButton } from "../components/AdviceCard";
import { useData } from "../lib/useData";
import { childTheme, severity, useColorVersion, useSelectedChild } from "../lib/children";
import { RangeTabs } from "../components/RangeTabs";
import { clock, duration, longDate, percent } from "../lib/format";
import { usePageTint } from "../layout/AppShell";
import { Card, StatRow } from "../components/Card";
import { PageHead } from "../components/PageHead";
import { ChildSwitch } from "../components/ChildSwitch";
import { DayTimeline } from "../components/DayTimeline";
import { StatusChip } from "../components/StatusChip";
import { PageState } from "../components/PageState";

const SCREENS = ["tv", "tablet", "multi_screen", "phone"];

function Strong({ className, children }) {
  return <span className={`font-bold ${className}`}>{children}</span>;
}

export default function Dashboard() {
  const { t, locale, lang } = useI18n();
  const { data: loaded, error, loading } = useData(() => getSession("latest"), []);
  const [swapped, setSwapped] = useState(null); // the session after the parent swapped two names
  const session = swapped ?? loaded;
  useColorVersion();
  const children = session?.children ?? [];
  const [child, setChildId] = useSelectedChild(children);
  const theme = child ? childTheme(children, child.id) : null;
  usePageTint(theme?.tint ?? null);
  const { data: frames } = useData(() => (session ? getFrames(session.id).catch(() => null) : Promise.resolve(null)), [session?.id]);
  const colorFor = (id) => childTheme(children, id).onDark;
  const nameFor = (id) => children.find((c) => c.id === id)?.name;
  const { data: ai, loading: aiLoading } = useData(
    () => (session && child ? getDayAdvice(session.id, child.id, lang).catch(() => null) : Promise.resolve(null)),
    [session?.id, child?.id, lang],
  );

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
    <main className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 pt-4 sm:px-6 sm:pt-6">
      <PageHead
        eyebrow={longDate(locale, session.date)}
        title={t("today.title", { name: child.name })}
        links={
          <>
            <Link to={`/sessions/${session.id}`} className="flex items-center gap-1.5 font-semibold text-rust">
              {t("today.watch")}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flip" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
            {!USE_MOCKS &&
              session.source &&
              children
                .filter((c) => c.id !== child.id)
                .map((other) => (
                  <button
                    key={other.id}
                    type="button"
                    onClick={async () => setSwapped(await swapChildren(session.id, child.id, other.id))}
                    className="text-muted underline-offset-2 hover:text-ink hover:underline"
                  >
                    {t("today.swap", { a: child.name, b: other.name })}
                  </button>
                ))}
          </>
        }
        tools={
          <>
            <ChildSwitch children={children} selectedId={child.id} onSelect={setChildId} />
            <RangeTabs />
            <ExportButton to={`/report?range=day&child=${child.id}`} />
          </>
        }
      />

      <Card>
        <p className="max-w-[56ch] text-[17px] leading-[1.75] font-medium text-ink sm:text-[21px]">{summary}</p>
      </Card>

      <StatRow
        items={[
          {
            label: t("today.stats.screen"),
            value: duration(t, screenS),
            note: t("today.stats.screenNote", { pct: percent(screenS, seen) }),
            bar: { pct: percent(screenS, seen), fill: "bg-screen", track: "bg-screen-soft" },
          },
          { label: t("today.stats.multi"), value: duration(t, totals.multi_screen_s), note: t("today.stats.multiNote") },
          {
            label: t("today.stats.active"),
            value: duration(t, totals.active_s),
            note: t("today.stats.activeNote", { pct: percent(totals.active_s, seen) }),
            bar: { pct: percent(totals.active_s, seen), fill: "bg-move", track: "bg-move-soft" },
          },
          { label: t("today.stats.moments"), value: events.length, note: t("today.stats.momentsNote", { open: open.length }) },
        ]}
      />

      <AdviceCard
        loading={aiLoading}
        ai={Boolean(ai?.advice?.length)}
        items={ai?.advice?.length ? ai.advice : dayAdvice(t, { child, totals, segments, events })}
        links={{
          review: `/alerts?child=${child.id}`,
          export: `/report?range=day&child=${child.id}`,
          specialist: `/report?range=day&child=${child.id}&for=specialist`,
        }}
      />

      <Card>
        <DayTimeline
          startedAt={session.started_at}
          durationS={session.video.duration_s}
          segments={segments}
          events={events}
          theme={theme}
          sessionId={session.id}
          videoUrl={USE_MOCKS ? null : session.video?.url}
          frames={frames}
          colorFor={colorFor}
          nameFor={nameFor}
        />
      </Card>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-5 text-lg font-bold">{t("today.breakdown.title")}</h2>
          <ul className="flex flex-col gap-3.5">
            {SCREENS.map((k) => (
              <li key={k}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span>{t(`screen.${k}`)}</span>
                  <span className="font-semibold">{duration(t, totals[`${k}_s`])}</span>
                </div>
                <div className="h-2.5 rounded-full bg-[rgba(28,23,20,.06)]">
                  <div
                    className={`h-2.5 rounded-full ${k === "multi_screen" ? "bg-screen-2" : "bg-screen"}`}
                    style={{ width: `${(totals[`${k}_s`] / maxScreen) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[13px] text-muted">
            {totals.longest_still &&
              t("today.breakdown.longest", {
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
              <li key={e.id} className="border-t border-[rgba(28,23,20,.1)] first:border-0">
                <Link to={`/sessions/${session.id}?t=${e.start_s}`} className="flex min-h-14 items-center gap-3.5 py-3">
                  <span className={`grid size-[38px] shrink-0 place-items-center rounded-xl ${severity(e) === "alert" ? "bg-alert-soft text-alert" : severity(e) === "ok" ? "bg-ok-soft text-ok" : "bg-look-soft text-look"}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {e.type === "fall" ? <path d="M4 20h16M7 16l4-4 3 2 5-6M17 8h2v2" /> : e.type === "danger_zone" ? <path d="M12 3l8 4v6c0 4-3.5 7-8 8-4.5-1-8-4-8-8V7z" /> : <path d="M7 11l3-3 3 3 4-4M5 19h14" />}
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{t(`event.${e.type}`)}</span>
                    <span className="block text-[13px] text-muted">
                      {t("event.duration", {
                        time: clock(locale, session.started_at, e.start_s),
                        length: duration(t, Math.max(1, e.end_s - e.start_s)),
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
              to={`/alerts?child=${child.id}`}
              className="mt-4 flex min-h-[52px] items-center justify-center rounded-[18px] bg-clay text-[15px] font-semibold text-white hover:bg-rust"
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
