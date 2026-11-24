// "To review": one moment at a time, made for the phone. One question, two big buttons.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { getAlerts, getSession, markAlertReviewed } from "../api/client";
import { useData } from "../lib/useData";
import { childTheme, severity } from "../lib/children";
import { clock, duration } from "../lib/format";
import { Figure } from "../components/Figure";
import { LogoMark } from "../components/Logo";
import { StatusChip } from "../components/StatusChip";
import { PageState } from "../components/PageState";

function Scene({ event, children }) {
  const main = childTheme(children, event.child_id).onDark;
  const other = children.find((c) => c.id !== event.child_id);
  const second = other ? childTheme(children, other.id).onDark : "#E7A3C6";
  return (
    <div className="flex h-48 items-end justify-center gap-2 border-b-2 border-[#3A3F4B] pb-1" aria-hidden="true">
      {event.type === "violent_contact" && (
        <div className="relative flex items-end">
          <Figure pose="stand" color={main} width={78} />
          <Figure pose="run" color={second} width={78} />
          <span className="absolute start-1/2 top-6 h-12 w-16 -translate-x-1/2 rounded-full border-2 border-dashed border-alert" />
        </div>
      )}
      {event.type === "fall" && <Figure pose="lie" color={main} width={150} />}
      {event.type === "danger_zone" && (
        <div className="relative flex items-end gap-6">
          <Figure pose="stand" color={main} width={70} />
          <span className="mb-0.5 flex h-32 w-28 items-start rounded-md border-2 border-dashed border-look bg-look/10 p-1.5 text-[11px] font-semibold text-sun" />
        </div>
      )}
    </div>
  );
}

export default function Alerts() {
  const { t, locale } = useI18n();
  const { data, error, loading } = useData(() => Promise.all([getAlerts(), getSession("latest")]), []);
  const [alerts, setAlerts] = useState(null);
  const [answered, setAnswered] = useState(0);

  useEffect(() => {
    if (data) setAlerts(data[0]);
  }, [data]);

  const session = data?.[1];
  const children = session?.children ?? [];
  const queue = useMemo(() => (alerts ?? []).filter((a) => !a.reviewed), [alerts]);
  const done = useMemo(() => (alerts ?? []).filter((a) => a.reviewed), [alerts]);

  if (loading || error || !alerts) return <PageState loading={loading} error={error} />;

  const total = queue.length + answered;
  const current = queue[0];
  const nameOf = (id) => children.find((c) => c.id === id)?.name ?? "";

  async function answer(event) {
    await markAlertReviewed(event.id, true);
    setAlerts((list) => list.map((a) => (a.id === event.id ? { ...a, reviewed: true } : a)));
    setAnswered((n) => n + 1);
  }

  async function again() {
    await Promise.all(done.map((a) => markAlertReviewed(a.id, false)));
    setAlerts((list) => list.map((a) => ({ ...a, reviewed: false })));
    setAnswered(0);
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-6 sm:pt-9">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("quick.title")}</h1>
        {total > 0 && (
          <div className="flex gap-1.5" aria-label={t("quick.count", { n: Math.min(answered + 1, total), total })}>
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={`h-1.5 w-6 rounded-full ${i < answered ? "bg-ok" : i === answered ? "bg-clay" : "bg-[#ded5ca]"}`} />
            ))}
          </div>
        )}
      </div>

      {current ? (
        <section className="flex flex-col gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip kind={severity(current)} />
              <span className="text-[13px] text-muted">{t("quick.count", { n: answered + 1, total })}</span>
            </div>
            <h2 className="mt-3 text-2xl leading-snug font-bold">{t(`event.${current.type}`)}</h2>
            <div className="mt-1 text-sm text-muted">
              {t("event.who", { name: nameOf(current.child_id), time: clock(locale, session.started_at, current.start_s) })}
            </div>
          </div>
          <div className="rounded-[20px] bg-[#16181D] px-4 pt-4 pb-2.5">
            <Scene event={current} children={children} />
            <div className="flex justify-between px-1 pt-2 text-xs text-[#9BA1AD]">
              <span>{clock(locale, session.started_at, current.start_s)}</span>
              <span>{duration(t, current.end_s - current.start_s)}</span>
            </div>
          </div>
          <p className="text-[15px] leading-relaxed text-body">{t(`event.desc.${current.type}`, { name: nameOf(current.child_id) })}</p>
          <Link to={`/sessions/${current.session_id}?t=${current.start_s}`} className="text-sm font-semibold text-clay">
            {t("quick.watch")}
          </Link>
          <div className="text-lg font-bold">{t("quick.question")}</div>
          <div className="flex flex-col gap-2.5">
            <button type="button" onClick={() => answer(current)} className="min-h-14 rounded-2xl bg-clay text-base font-semibold text-white hover:bg-clay-dark">
              {t("quick.fine")}
            </button>
            <button type="button" onClick={() => answer(current)} className="min-h-14 rounded-2xl border border-[#ded5ca] bg-white text-base font-semibold">
              {t("quick.follow")}
            </button>
          </div>
        </section>
      ) : (
        <section className="flex flex-col items-center gap-3 py-10 text-center">
          <LogoMark size={84} />
          <h2 className="text-2xl font-bold">{t("quick.doneTitle")}</h2>
          <p className="max-w-xs leading-relaxed text-body">{t("quick.doneText")}</p>
          {done.length > 0 && (
            <button type="button" onClick={again} className="mt-2 min-h-12 rounded-xl border border-[#ded5ca] bg-white px-5 font-semibold">
              {t("quick.again")}
            </button>
          )}
        </section>
      )}

      {done.length > 0 && current && (
        <section className="mt-2">
          <h2 className="mb-1 text-sm font-semibold text-muted">{t("quick.reviewedList")}</h2>
          <ul>
            {done.map((a) => (
              <li key={a.id} className="flex items-center gap-3 border-t border-[#f0eae2] py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{t(`event.${a.type}`)}</span>
                  <span className="block text-xs text-muted">{t("event.who", { name: nameOf(a.child_id), time: clock(locale, session.started_at, a.start_s) })}</span>
                </span>
                <StatusChip kind="ok" label={t("status.reviewed")} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-center text-xs text-muted">{t("quick.note")}</p>
    </main>
  );
}
