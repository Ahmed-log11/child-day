// Week: one child's last 7 days. Sample history (one uploaded video is one day), marked as such.
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { useChildren } from "../lib/useChildren";
import { childTheme, useSelectedChild } from "../lib/children";
import { duration } from "../lib/format";
import { ACTIVE_GOAL_S, avgOf, change, history, screenOf, seen, sumOf } from "../lib/history";
import { usePageTint } from "../layout/AppShell";
import { Card } from "../components/Card";
import { ChildSwitch } from "../components/ChildSwitch";
import { RangeTabs } from "../components/RangeTabs";
import { PageState } from "../components/PageState";
import { PageHead } from "../components/PageHead";
import { StatusChip } from "../components/StatusChip";
import { Banner, Donut, Icon, ICONS, Kpi, NO_VIDEO, Ring, Soon, screenShade } from "../components/Overview";

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7:00 to 21:00
const DEVICES = [
  ["tv", "#2F4F86"],
  ["tablet", "#6D86B5"],
  ["phone", "#A9B8D6"],
  ["multi_screen", "#1B2F55"],
  ["none", "#E2D8CB"],
];
const MOMENT_TYPES = ["danger_zone", "fall", "violent_contact"];

export default function Week() {
  const { t, tl, locale } = useI18n();
  const { children, loading, error } = useChildren();
  const [child, select] = useSelectedChild(children);
  const theme = child ? childTheme(children, child.id) : null;
  usePageTint(theme?.tint ?? null);

  if (loading || error || !child) return <PageState loading={loading} error={error} />;

  const index = children.findIndex((c) => c.id === child.id);
  const all = history(child.id, index, 14);
  const week = all.slice(7);
  const before = all.slice(0, 7);
  const days = seen(week);
  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" });
  const dayName = (iso) => tl("days.short")[new Date(`${iso}T12:00:00`).getDay()];
  const longDay = (iso) => new Intl.DateTimeFormat(locale, { weekday: "long" }).format(new Date(`${iso}T12:00:00`));

  const screenAvg = avgOf(week, screenOf);
  const activeAvg = avgOf(week, (d) => d.active_s);
  const moments = sumOf(week, (d) => d.alerts);
  const openMoments = Math.max(0, moments - 2);
  const screenChange = change(screenAvg, avgOf(before, screenOf));
  const activeChange = change(activeAvg, avgOf(before, (d) => d.active_s));
  const momentChange = change(moments, sumOf(before, (d) => d.alerts));
  const mostActive = [...days].sort((a, b) => b.active_s - a.active_s)[0];
  const goalDays = days.filter((d) => d.active_s >= ACTIVE_GOAL_S).length;
  const longStill = days.filter((d) => d.longest_still_s >= 3600).length;
  const perHour = screenAvg ? Math.round((activeAvg / screenAvg) * 60) : 0;

  const totalVideo = sumOf(week, (d) => d.video_s);
  const device = DEVICES.map(([k, color]) => ({
    key: k,
    color,
    value: k === "none" ? Math.max(0, totalVideo - sumOf(week, screenOf)) : sumOf(week, (d) => d[`${k}_s`]),
  }));
  const deviceTotal = device.reduce((s, p) => s + p.value, 0) || 1;
  const maxHour = Math.max(...days.flatMap((d) => d.hours), 1);
  const longest = [...days].sort((a, b) => b.longest_session_s - a.longest_session_s)[0];

  const momentList = week
    .filter((d) => !d.none && d.alerts)
    .flatMap((d, i) =>
      Array.from({ length: d.alerts }, (_, k) => ({
        id: `${d.date}-${k}`,
        date: d.date,
        type: MOMENT_TYPES[(i + k) % 3],
        time: `${16 + ((i + k) % 3)}:${String((i * 17 + k * 23) % 60).padStart(2, "0")}`,
        reviewed: (i + k) % 3 === 2,
      })),
    )
    .reverse()
    .slice(0, 4);

  const fmtMin = (s) => duration(t, s);

  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 pt-4 sm:px-6 sm:pt-6">
      <PageHead
        eyebrow={`${dateFmt.format(new Date(`${week[0].date}T12:00:00`))} – ${dateFmt.format(new Date(`${week[6].date}T12:00:00`))}`}
        title={t("week.title", { name: child.name })}
        sub={t(`child.ages.${child.age_group}`)}
        tools={
          <>
            <ChildSwitch children={children} selectedId={child.id} onSelect={select} />
            <RangeTabs />
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Banner>
            {t("wk.insight", {
              screen: <b key="s">{t(screenChange <= 0 ? "wk.less" : "wk.more", { pct: Math.abs(screenChange) })}</b>,
              day: <b key="d">{longDay(mostActive.date)}</b>,
              moments: <b key="m">{t("wk.moments", { n: moments })}</b>,
              open: openMoments,
            })}
          </Banner>
          <div className="grid gap-3.5 sm:grid-cols-3">
            <Kpi icon={ICONS.screen} label={t("ov.screen")} value={fmtMin(sumOf(week, screenOf))} sub={t("ov.perDay", { v: fmtMin(screenAvg) })} delta={screenChange} />
            <Kpi icon={ICONS.active} label={t("ov.active")} value={fmtMin(sumOf(week, (d) => d.active_s))} sub={t("ov.perDay", { v: fmtMin(activeAvg) })} delta={activeChange} />
            <Kpi icon={ICONS.moment} label={t("ov.moments")} value={moments} sub={t("wk.open", { n: openMoments })} delta={momentChange} />
          </div>
        </div>

        <Card className="flex flex-col gap-4">
          <h2 className="text-[19px] font-semibold">{t("wk.balance")}</h2>
          <div className="flex flex-wrap items-center gap-5">
            <Ring value={goalDays} total={7}>
              <b className="text-xl font-extrabold text-ink">{t("wk.ofDays", { n: goalDays, total: 7 })}</b>
              <span className="text-[11px] leading-tight text-muted">{t("wk.goalDays", { goal: fmtMin(ACTIVE_GOAL_S) })}</span>
            </Ring>
            <ul className="flex min-w-[150px] flex-1 flex-col gap-3.5">
              <li className="flex items-start gap-2.5">
                <Icon d={ICONS.active} className="mt-0.5 text-rust" />
                <span>
                  <span className="block text-[12.5px] text-muted">{t("wk.activeAvg")}</span>
                  <b className="block text-[15px] text-ink">{t("ov.perDay", { v: fmtMin(activeAvg) })}</b>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Icon d={ICONS.still} className="mt-0.5 text-rust" />
                <span>
                  <span className="block text-[12.5px] text-muted">{t("wk.longStill")}</span>
                  <b className="block text-[15px] text-ink">{t("wk.longStillDays", { n: longStill })}</b>
                </span>
              </li>
            </ul>
          </div>
          <div className="mt-auto flex items-center gap-3 rounded-[18px] bg-[rgba(217,105,45,.1)] px-3.5 py-3 text-sm text-ink">
            <Icon d={ICONS.balance} className="text-rust" />
            {t("wk.ratio", { n: perHour })}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[19px] font-semibold">{t("wk.when")}</h2>
            <span className="text-[12.5px] text-muted">{t("wk.whenNote")}</span>
          </div>
          <div className="overflow-x-auto">
            <div className="grid min-w-[520px] items-center gap-[3px]" style={{ gridTemplateColumns: `56px repeat(${HOURS.length}, minmax(0,1fr))` }} dir="ltr">
              <span />
              {HOURS.map((h) => (
                <span key={h} className="text-center font-mono text-[10px] text-muted">{h % 3 === 2 ? `${String(h).padStart(2, "0")}` : ""}</span>
              ))}
              {week.map((d) => (
                <div key={d.date} className="contents">
                  <span className="text-xs text-body" dir="auto">{dayName(d.date)}</span>
                  {HOURS.map((h) => (
                    <i
                      key={h}
                      className="block h-[22px] rounded-[4px]"
                      style={d.none ? NO_VIDEO : { background: screenShade(d.hours[h], maxHour) }}
                      title={d.none ? t("ov.noVideo") : `${dayName(d.date)} ${h}:00 · ${d.hours[h]} min`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-muted">
            <span className="flex items-center gap-2">
              <i className="inline-block h-2.5 w-3.5 rounded-[3px]" style={NO_VIDEO} />
              {t("ov.noVideo")}
            </span>
            <span className="flex items-center gap-1.5">
              {t("wk.less2")}
              {["#E3E8F1", "#C3CEE3", "#93A7CB", "#5E7AAE", "#2F4F86"].map((c) => (
                <i key={c} className="inline-block h-2.5 w-3.5 rounded-[3px]" style={{ background: c }} />
              ))}
              {t("wk.more2")}
            </span>
          </div>
        </Card>

        <Card>
          <h2 className="text-[19px] font-semibold">{t("wk.devices")}</h2>
          <p className="mb-4 text-[13px] text-muted">{t("wk.devicesNote", { seen: fmtMin(totalVideo) })}</p>
          <div className="flex flex-wrap items-center gap-5">
            <Donut parts={device}>
              <b className="text-xl font-extrabold text-ink">{fmtMin(sumOf(week, screenOf))}</b>
              <span className="text-[11.5px] text-muted">{t("wk.onScreens")}</span>
            </Donut>
            <ul className="flex min-w-[150px] flex-1 flex-col gap-2.5">
              {device.map((p) => (
                <li key={p.key} className="flex items-center gap-2.5 text-sm">
                  <i className="size-[11px] rounded-full" style={{ background: p.color }} />
                  {p.key === "none" ? t("wk.noScreen") : t(`screen.${p.key}`)}
                  <b className="ms-auto text-ink tabular-nums">{Math.round((p.value / deviceTotal) * 100)}%</b>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,.9fr)_minmax(0,1.1fr)]">
        <Card>
          <h2 className="mb-4 text-[19px] font-semibold">{t("wk.sessions")}</h2>
          <ul className="flex flex-col gap-4">
            <li className="flex items-start gap-2.5">
              <Icon d={ICONS.clock} className="mt-0.5 text-rust" />
              <span>
                <span className="block text-[12.5px] text-muted">{t("wk.longestSession")}</span>
                <b className="block text-[15px] text-ink">{fmtMin(longest.longest_session_s)}</b>
                <span className="block text-[12.5px] text-muted">{longDay(longest.date)}</span>
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Icon d={ICONS.multi} className="mt-0.5 text-rust" />
              <span>
                <span className="block text-[12.5px] text-muted">{t("screen.multi_screen")}</span>
                <b className="block text-[15px] text-ink">{fmtMin(sumOf(week, (d) => d.multi_screen_s))}</b>
                <span className="block text-[12.5px] text-muted">
                  {t("wk.multiShare", { pct: Math.round((sumOf(week, (d) => d.multi_screen_s) / Math.max(1, sumOf(week, screenOf))) * 100) })}
                </span>
              </span>
            </li>
          </ul>
        </Card>

        <Card>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-[19px] font-semibold">{t("wk.momentsTitle")}</h2>
            <Link to="/alerts" className="flex items-center gap-1.5 text-sm font-semibold text-rust">
              {t("wk.openAll")}
              <Icon d={ICONS.arrow} size={15} className="flip" />
            </Link>
          </div>
          {!momentList.length && <p className="py-4 text-body">{t("today.list.empty")}</p>}
          <ul>
            {momentList.map((m) => (
              <li key={m.id} className="flex items-center gap-3 border-t border-[rgba(28,23,20,.1)] py-3 first:border-0">
                <span className="relative grid h-[46px] w-[76px] shrink-0 place-items-center overflow-hidden rounded-[10px] bg-[#2b221e]">
                  <span className="grid size-6 place-items-center rounded-full bg-white/90 text-ink">
                    <Icon d={ICONS.play} size={10} stroke={2.4} />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[14.5px] font-semibold text-ink">{t(`event.${m.type}`)}</b>
                  <span className="block text-[12.5px] text-muted">
                    {child.name} · {longDay(m.date)} · {m.time}
                  </span>
                </span>
                <StatusChip kind={m.reviewed ? "ok" : "look"} label={m.reviewed ? t("status.reviewed") : t("wk.notReviewed")} />
              </li>
            ))}
          </ul>
        </Card>

        <Soon title={t("wk.together")} text={t("wk.togetherText")} />
        <Soon title={t("wk.where")} text={t("wk.whereText")}>
          <div className="relative h-24 overflow-hidden rounded-2xl bg-[#2b221e]">
            <span className="absolute top-6 left-[30%] size-16 rounded-full bg-[radial-gradient(closest-side,rgba(217,105,45,.75),transparent)]" />
            <span className="absolute top-10 left-[62%] size-10 rounded-full bg-[radial-gradient(closest-side,rgba(217,105,45,.6),transparent)]" />
          </div>
        </Soon>
      </div>

      <p className="text-[13px] text-muted">{t("ov.sample")}</p>
    </main>
  );
}
