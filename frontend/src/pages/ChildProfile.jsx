// One child's profile: their color, averages, last 7 days and favorite screen.
import { Link, useNavigate, useParams } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { updateChild, USE_MOCKS } from "../api/client";
import { useChildren } from "../lib/useChildren";
import { CHILD_COLORS, childTheme, rememberColor } from "../lib/children";
import { duration, percent } from "../lib/format";
import { ACTIVE_GOAL_S, avgOf as avg, history, screenOf, seen } from "../lib/history";
import { dateOf } from "../lib/summary";
import { usePageTint } from "../layout/AppShell";
import { Card, StatRow } from "../components/Card";
import { ChildSwitch } from "../components/ChildSwitch";
import { PageState } from "../components/PageState";

export default function ChildProfile() {
  const { childId } = useParams();
  const navigate = useNavigate();
  const { t, tl } = useI18n();
  const { children, loading: loadingKids, error: kidsError } = useChildren();
  const child = children.find((c) => c.id === childId) ?? children[0];
  const theme = child ? childTheme(children, child.id) : null;
  usePageTint(theme?.tint ?? null);
  if (loadingKids || kidsError || !child) {
    return <PageState loading={loadingKids} error={kidsError} />;
  }

  // Sample history, the same as on the Week page.
  const days = seen(history(child.id, children.findIndex((c) => c.id === child.id), 7));
  const goal = ACTIVE_GOAL_S;
  const totals = ["tv", "tablet", "phone"].map((k) => [k, days.reduce((s, d) => s + d[`${k}_s`], 0)]);
  const [favorite, favoriteS] = totals.sort((a, b) => b[1] - a[1])[0];
  const allScreen = days.reduce((s, d) => s + screenOf(d), 0);
  const moments = days.reduce((s, d) => s + d.alerts, 0);
  const maxScreen = Math.max(...days.map(screenOf), 1);
  const short = tl("days.short");

  async function pickColor(color) {
    rememberColor(child.id, color);
    if (!USE_MOCKS) {
      try {
        await updateChild(child.id, { color });
      } catch {
        /* kept on this device; the server will get it next time */
      }
    }
  }

  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 pt-4 sm:px-6 sm:pt-6">
      <div className="flex flex-wrap items-center gap-5">
        <span
          className="flex size-24 items-center justify-center rounded-[30px] border-[3px] bg-paper text-[40px] font-bold"
          style={{ borderColor: theme.color, color: theme.color }}
          aria-hidden="true"
        >
          {child.name.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[clamp(34px,5vw,58px)] leading-[1.15] font-extrabold tracking-tight">{child.name}</h1>
          <div className="mt-1 text-body">
            {t("child.age")}: {t(`child.ages.${child.age_group}`)} · {t("child.since", { n: days.length })}
          </div>
        </div>
        <Link to="/dashboard" className="flex min-h-11 items-center rounded-full border border-[rgba(28,23,20,.18)] bg-paper px-5 text-sm font-semibold text-ink">
          {t("child.seeToday")}
        </Link>
      </div>

      {children.length > 1 && (
        <ChildSwitch children={children} selectedId={child.id} onSelect={(id) => navigate(`/children/${id}`)} />
      )}

      <StatRow
        items={[
          { label: t("child.stats.screen"), value: duration(t, avg(days, screenOf)) },
          {
            label: t("child.stats.active"),
            value: duration(t, avg(days, (d) => d.active_s)),
            note: t("child.activeNote", { goal: duration(t, goal) }),
            bar: { pct: (avg(days, (d) => d.active_s) / goal) * 100, fill: "bg-move", track: "bg-move-soft" },
          },
          { label: t("child.stats.favorite"), value: t(`screen.${favorite}`), note: t("child.favoriteNote", { pct: percent(favoriteS, allScreen) }) },
          { label: t("child.stats.moments"), value: moments, note: t("child.momentsNote", { n: days.length }) },
        ]}
      />

      <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{t("child.trend")}</h2>
            <ul className="flex gap-4 text-[13px] text-body">
              <li className="flex items-center gap-1.5"><span className="size-3 rounded-[3px] bg-screen" />{t("week.screen")}</li>
              <li className="flex items-center gap-1.5"><span className="size-3 rounded-[3px] bg-move" />{t("week.active")}</li>
            </ul>
          </div>
          <div className="flex gap-2">
            {days.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-36 w-full items-end justify-center gap-1">
                  <div className="w-[36%] rounded-t-md bg-screen" style={{ height: `${(screenOf(d) / maxScreen) * 100}%` }} />
                  <div className="w-[36%] rounded-t-md bg-move" style={{ height: `${Math.min(100, (d.active_s / (goal * 1.5)) * 100)}%` }} />
                </div>
                <span className="text-xs text-muted">{short[dateOf(d.date).getDay()]}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-bold">{t("child.color")}</h2>
          <p className="mt-1 mb-4 text-[13px] text-muted">{t("child.colorNote", { name: child.name })}</p>
          <div className="flex flex-wrap gap-3" role="radiogroup" aria-label={t("child.color")}>
            {CHILD_COLORS.map((c) => {
              const on = c.color === theme.color;
              return (
                <button
                  key={c.color}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={c.color}
                  onClick={() => pickColor(c.color)}
                  className="size-[46px] rounded-[14px]"
                  style={{ background: c.color, boxShadow: on ? `0 0 0 3px #FAF6F1, 0 0 0 5px ${c.color}` : "none" }}
                />
              );
            })}
          </div>
          <Link to="/setup" className="mt-5 inline-block text-sm font-semibold text-rust">
            {t("child.edit")}
          </Link>
        </Card>
      </section>
    </main>
  );
}
