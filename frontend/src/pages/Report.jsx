// A printable report of one child's day, week or month: key numbers, a table, the moments and the advice.
// "Download PDF" uses the browser's print dialog (Save as PDF), which keeps Arabic text right.
// ?range=day|week|month  &child=<id>  &for=specialist (adds a note and space for questions)
import { Link, useSearchParams } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { getDayAdvice, getSession } from "../api/client";
import { useData } from "../lib/useData";
import { useChildren } from "../lib/useChildren";
import { childTheme } from "../lib/children";
import { clock, duration } from "../lib/format";
import { avgOf, history, screenOf, seen, sumOf } from "../lib/history";
import { dayAdvice, monthAdvice, weekAdvice } from "../lib/advice";
import { LogoMark } from "../components/Logo";
import { Icon, ICONS } from "../components/Overview";
import { PageState } from "../components/PageState";

const RANGES = ["day", "week", "month"];
const SCREENS = ["tv", "tablet", "phone", "multi_screen"];

function Section({ title, children }) {
  return (
    <section className="mt-7 break-inside-avoid">
      <h2 className="mb-3 border-b border-[rgba(28,23,20,.15)] pb-1.5 text-[15px] font-bold tracking-wide text-ink uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Numbers({ items }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map(([label, value, note]) => (
        <div key={label} className="rounded-xl border border-[rgba(28,23,20,.12)] p-3">
          <div className="text-[12px] text-muted">{label}</div>
          <div className="mt-0.5 text-[22px] font-extrabold text-ink">{value}</div>
          {note && <div className="text-[11.5px] text-muted">{note}</div>}
        </div>
      ))}
    </div>
  );
}

function Table({ head, rows }) {
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} className="border-b border-[rgba(28,23,20,.2)] py-1.5 text-start font-semibold text-muted">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="break-inside-avoid">
            {r.map((c, j) => (
              <td key={j} className="border-b border-[rgba(28,23,20,.08)] py-1.5 text-ink tabular-nums">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Report() {
  const { t, tl, lang, locale } = useI18n();
  const [params, setParams] = useSearchParams();
  const range = RANGES.includes(params.get("range")) ? params.get("range") : "day";
  const specialist = params.get("for") === "specialist";
  const { children, loading: kidsLoading, error: kidsError } = useChildren();
  const { data: session, loading, error } = useData(() => (range === "day" ? getSession("latest") : Promise.resolve(null)), [range]);

  const list = range === "day" ? session?.children ?? [] : children;
  const child = list.find((c) => c.id === params.get("child")) ?? list[0];
  const { data: ai } = useData(
    () => (range === "day" && session && child ? getDayAdvice(session.id, child.id, lang).catch(() => null) : Promise.resolve(null)),
    [range, session?.id, child?.id, lang],
  );

  if (loading || error || kidsLoading || kidsError || !child) return <PageState loading={loading || kidsLoading} error={error || kidsError} />;

  const fmt = (s) => duration(t, s);
  const theme = childTheme(list, child.id);
  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" });
  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" });
  const at = (iso) => new Date(`${iso}T12:00:00`);
  const set = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  let period = "";
  let numbers = [];
  let body = null;
  let advice = [];
  let aiWritten = false;

  if (range === "day") {
    const totals = session.totals[child.id];
    const segments = session.segments.filter((s) => s.child_id === child.id);
    const events = session.events.filter((e) => e.child_id === child.id);
    const screenS = SCREENS.reduce((sum, k) => sum + totals[`${k}_s`], 0);
    const intake = (state) => segments.filter((s) => s.category === "intake" && s.state === state).reduce((sum, s) => sum + s.end_s - s.start_s, 0);
    period = `${dateFmt.format(at(session.date))} · ${t("rep.recorded", { time: fmt(session.video.duration_s) })}`;
    numbers = [
      [t("ov.screen"), fmt(screenS)],
      [t("today.stats.multi"), fmt(totals.multi_screen_s)],
      [t("ov.active"), fmt(totals.active_s)],
      [t("ov.moments"), events.length, t("today.stats.momentsNote", { open: events.filter((e) => !e.reviewed).length })],
    ];
    body = (
      <>
        <Section title={t("rep.screensMoving")}>
          <Table
            head={[t("rep.what"), t("rep.time")]}
            rows={[
              ...SCREENS.map((k) => [t(`screen.${k}`), fmt(totals[`${k}_s`])]),
              [t("activity.active"), fmt(totals.active_s)],
              [t("activity.light"), fmt(totals.light_s)],
              [t("activity.still"), fmt(totals.still_s)],
              ...(totals.longest_still ? [[t("rep.longestStill"), fmt(totals.longest_still.duration_s)]] : []),
              ...(intake("eating") ? [[t("intake.eating"), fmt(intake("eating"))]] : []),
              ...(intake("drinking") ? [[t("intake.drinking"), fmt(intake("drinking"))]] : []),
            ]}
          />
        </Section>
        <Section title={t("ov.moments")}>
          {events.length ? (
            <Table
              head={[t("rep.at"), t("rep.what"), t("rep.length"), t("rep.status")]}
              rows={events.map((e) => [
                clock(locale, session.started_at, e.start_s),
                t(`event.${e.type}`),
                fmt(Math.max(1, e.end_s - e.start_s)),
                e.reviewed ? t("status.reviewed") : t("rep.notReviewed"),
              ])}
            />
          ) : (
            <p className="text-[13.5px] text-body">{t("rep.noMoments")}</p>
          )}
        </Section>
      </>
    );
    aiWritten = Boolean(ai?.advice?.length);
    advice = aiWritten ? ai.advice : dayAdvice(t, { child, totals, segments, events });
  } else {
    const index = Math.max(0, children.findIndex((c) => c.id === child.id));
    const today = new Date();
    let days;
    if (range === "week") {
      const all = history(child.id, index, 14);
      days = all.slice(7);
      const longDay = (iso) => new Intl.DateTimeFormat(locale, { weekday: "long" }).format(at(iso));
      const open = Math.max(0, sumOf(days, (d) => d.alerts) - 2);
      advice = weekAdvice(t, { child, week: days, before: all.slice(0, 7), open, longDay });
      period = `${dateFmt.format(at(days[0].date))} – ${dateFmt.format(at(days[6].date))}`;
    } else {
      const all = history(child.id, index, today.getDate() + 31);
      days = all.filter((d) => at(d.date).getMonth() === today.getMonth());
      const lastMonth = all.filter((d) => at(d.date).getMonth() !== today.getMonth());
      const last28 = all.slice(-28);
      const weeks = [0, 1, 2, 3].map((w) => {
        const part = last28.slice(w * 7, w * 7 + 7);
        return { screen: Math.round(avgOf(part, screenOf) / 60), active: Math.round(avgOf(part, (d) => d.active_s) / 60) };
      });
      advice = monthAdvice(t, { child, thisMonth: days, lastMonth, weeks });
      period = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(today);
    }
    numbers = [
      [t("ov.screen"), fmt(avgOf(days, screenOf)), t("ov.perDayLabel")],
      [t("today.stats.multi"), fmt(avgOf(days, (d) => d.multi_screen_s)), t("ov.perDayLabel")],
      [t("ov.active"), fmt(avgOf(days, (d) => d.active_s)), t("ov.perDayLabel")],
      [t("ov.moments"), sumOf(days, (d) => d.alerts), t("rep.daysWithVideo", { n: seen(days).length, total: days.length })],
    ];
    body = (
      <Section title={t("rep.byDay")}>
        <Table
          head={[t("rep.day"), t("ov.screen"), t("today.stats.multi"), t("ov.active"), t("ov.moments")]}
          rows={days.map((d) =>
            d.none
              ? [dayFmt.format(at(d.date)), t("rep.noVideo"), "", "", ""]
              : [dayFmt.format(at(d.date)), fmt(screenOf(d)), fmt(d.multi_screen_s), fmt(d.active_s), d.alerts || ""],
          )}
        />
        <p className="mt-2 text-[12px] text-muted">{t("ov.sample")}</p>
      </Section>
    );
  }

  return (
    <main className="mx-auto flex max-w-[860px] flex-col gap-4 px-4 pt-4 pb-10 sm:px-6 sm:pt-6 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center gap-2.5 print:hidden">
        <Link to={range === "day" ? "/dashboard" : `/${range}`} className="text-sm font-semibold text-rust">
          {t("rep.back")}
        </Link>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-[rgba(28,23,20,.06)] p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => set("range", r)}
                className={`min-h-9 rounded-full px-3.5 text-[13px] font-semibold ${r === range ? "bg-paper text-ink shadow-sm" : "text-muted"}`}
              >
                {t(`range.${r}`)}
              </button>
            ))}
          </div>
          <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-[rgba(28,23,20,.18)] bg-paper px-3.5 text-[13px] font-semibold">
            <input type="checkbox" checked={specialist} onChange={(e) => set("for", e.target.checked ? "specialist" : null)} className="accent-[#d9692d]" />
            {t("rep.forSpecialist")}
          </label>
          <button type="button" onClick={() => window.print()} className="flex min-h-10 items-center gap-2 rounded-full bg-clay px-4 text-sm font-semibold text-white hover:bg-rust">
            <Icon d={ICONS.download} size={16} />
            {t("rep.download")}
          </button>
        </div>
      </div>
      <p className="-mt-1 text-[12.5px] text-muted print:hidden">{t("rep.howTo")}</p>

      <article className="rounded-[24px] bg-paper p-6 shadow-[0_10px_40px_rgba(28,23,20,.08)] sm:p-10 print:rounded-none print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 pb-5" style={{ borderColor: theme.color }}>
          <div>
            <div className="flex items-center gap-2 text-[13px] font-semibold text-rust">
              <LogoMark size={24} />
              {t(`rep.title.${range}`)}
            </div>
            <h1 className="mt-2 text-[32px] leading-tight font-extrabold text-ink">{child.name}</h1>
            <p className="text-[14px] text-body">
              {t("rep.age", { ages: t(`child.ages.${child.age_group}`) })} · {period}
            </p>
          </div>
          <div className="text-end text-[12px] text-muted">
            {t("rep.made", { date: dateFmt.format(new Date()) })}
          </div>
        </header>

        {specialist && (
          <div className="mt-5 rounded-xl border border-[rgba(217,105,45,.35)] bg-peach p-4 text-[13.5px] leading-relaxed text-ink break-inside-avoid">
            <b className="mb-1 block">{t("rep.specialistTitle")}</b>
            {t("rep.specialistText", { name: child.name })}
          </div>
        )}

        <Section title={t("rep.summary")}>
          <Numbers items={numbers} />
        </Section>

        {body}

        <Section title={t("adv.title")}>
          <ol className="flex flex-col gap-2.5">
            {advice.map((a, i) => (
              <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed break-inside-avoid">
                <span className="font-mono text-[12px] text-clay">0{i + 1}</span>
                <span>
                  <b className="text-ink">{a.title}.</b> <span className="text-body">{a.text}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[12px] text-muted">{aiWritten ? t("adv.byAi") : t("adv.byRules")}</p>
        </Section>

        {specialist && (
          <Section title={t("rep.notes")}>
            <p className="mb-3 text-[12.5px] text-muted">{t("rep.notesHint")}</p>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-8 border-b border-dashed border-[rgba(28,23,20,.25)]" />
            ))}
          </Section>
        )}

        <footer className="mt-8 border-t border-[rgba(28,23,20,.15)] pt-3 text-[11.5px] leading-relaxed text-muted">
          {tl("rep.footer").join(" ")}
        </footer>
      </article>
    </main>
  );
}
