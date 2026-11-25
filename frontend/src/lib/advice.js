// Advice written from the numbers on screen, so it always matches the data.
// Today asks Claude first (POST /insights/day) and falls back to dayAdvice when Claude is not set up.
// Week and Month use the sample history, so their advice is always written here.
// Each item: { title, text, action } with action "review" | "export" | "specialist" | "none".
import { duration } from "./format";
import { ACTIVE_GOAL_S, avgOf, change, screenOf, seen, sumOf } from "./history";

const WEEKEND = [5, 6];
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

// Add "keep a copy" at the end when there's room and no item offers an export yet
// (the page header always has an Export button too).
function withExport(items, t, max = 3) {
  const list = items.slice(0, max);
  if (list.length < max && !list.some((i) => i.action === "export" || i.action === "specialist"))
    list.push({ title: t("adv.keep.title"), text: t("adv.keep.text"), action: "export" });
  return list;
}

export function dayAdvice(t, { child, totals, segments, events }) {
  const name = child.name;
  const seenS = totals.present_s || 0;
  const screenS = totals.tv_s + totals.tablet_s + totals.phone_s + totals.multi_screen_s;
  const open = events.filter((e) => !e.reviewed);
  const count = (type) => events.filter((e) => e.type === type).length;
  const items = [];

  if (open.length) {
    const kinds = [...new Set(open.map((e) => t(`event.${e.type}`)))].join(" · ");
    items.push({
      title: t(open.length === 1 ? "adv.review.one" : "adv.review.many", { n: open.length }),
      text: t("adv.review.text", { name, list: kinds }),
      action: "review",
    });
  }
  if (count("fall")) items.push({ title: t("adv.fall.title"), text: t("adv.fall.text", { name }), action: "specialist" });
  if (count("violent_contact"))
    items.push({
      title: t("adv.rough.title"),
      text: t("adv.rough.text", { name, n: count("violent_contact") }),
      action: count("violent_contact") > 1 && !count("fall") ? "specialist" : "none",
    });
  if (totals.multi_screen_s >= 60 && pct(totals.multi_screen_s, screenS) >= 10)
    items.push({
      title: t("adv.multi.title"),
      text: t("adv.multi.text", { name, time: duration(t, totals.multi_screen_s), pct: pct(totals.multi_screen_s, screenS) }),
      action: "none",
    });
  const activeShare = pct(totals.active_s, seenS);
  items.push({
    title: t(activeShare < 15 ? "adv.moveLow.title" : "adv.moveGood.title"),
    text: t(activeShare < 15 ? "adv.moveLow.text" : "adv.moveGood.text", {
      name,
      active: duration(t, totals.active_s),
      seen: duration(t, seenS),
    }),
    action: "none",
  });
  if ((totals.longest_still?.duration_s ?? 0) >= 20 * 60)
    items.push({ title: t("adv.still.title"), text: t("adv.still.text", { time: duration(t, totals.longest_still.duration_s) }), action: "none" });
  const drinkS = segments
    .filter((s) => s.category === "intake" && s.state === "drinking")
    .reduce((sum, s) => sum + s.end_s - s.start_s, 0);
  if (drinkS) items.push({ title: t("adv.drink.title"), text: t("adv.drink.text", { name, time: duration(t, drinkS) }), action: "none" });

  return withExport(items, t);
}

function weekdaySplit(days, fn) {
  const wd = days.filter((d) => !WEEKEND.includes(new Date(`${d.date}T12:00:00`).getDay()));
  const we = days.filter((d) => WEEKEND.includes(new Date(`${d.date}T12:00:00`).getDay()));
  return [avgOf(wd, fn), avgOf(we, fn)];
}

export function weekAdvice(t, { child, week, before, open, longDay }) {
  const name = child.name;
  const days = seen(week);
  const avg = avgOf(week, screenOf);
  const diff = change(avg, avgOf(before, screenOf));
  const goal = days.filter((d) => d.active_s >= ACTIVE_GOAL_S).length;
  const best = [...days].sort((a, b) => b.active_s - a.active_s)[0];
  const multi = pct(sumOf(week, (d) => d.multi_screen_s), sumOf(week, screenOf));
  const moments = sumOf(week, (d) => d.alerts);
  const items = [
    {
      title: t("adv.wScreen.title"),
      text: t(diff <= 0 ? "adv.wScreen.less" : "adv.wScreen.more", { name, avg: duration(t, avg), pct: Math.abs(diff) }),
      action: "none",
    },
    {
      title: t("adv.wGoal.title"),
      text: t(goal >= days.length / 2 ? "adv.wGoal.good" : "adv.wGoal.low", { name, n: goal, days: days.length, best: longDay(best.date) }),
      action: "none",
    },
  ];
  if (multi >= 12) items.push({ title: t("adv.multi.title"), text: t("adv.wMulti", { name, pct: multi }), action: "none" });
  if (moments)
    items.push({
      title: t("adv.wMoments.title", { n: moments }),
      text: t(open ? "adv.wMoments.open" : "adv.wMoments.done", { n: open }),
      action: open ? "review" : "specialist",
    });
  return withExport(items.length > 3 ? [items[0], items[1], items[3]] : items, t);
}

export function monthAdvice(t, { child, thisMonth, lastMonth, weeks }) {
  const name = child.name;
  const days = seen(thisMonth);
  const avg = avgOf(thisMonth, screenOf);
  const diff = change(avg, avgOf(lastMonth, screenOf));
  const [wd, we] = weekdaySplit(days, screenOf);
  const goal = days.filter((d) => d.active_s >= ACTIVE_GOAL_S).length;
  const moments = sumOf(thisMonth, (d) => d.alerts);
  const first = weeks[0];
  const last = weeks[weeks.length - 1];
  const items = [
    {
      title: t("adv.mTrend.title"),
      text: t("adv.mTrend.text", {
        name,
        s1: duration(t, first.screen * 60),
        s2: duration(t, last.screen * 60),
        a1: duration(t, first.active * 60),
        a2: duration(t, last.active * 60),
      }),
      action: "none",
    },
  ];
  if (we > wd * 1.1)
    items.push({
      title: t("adv.mWeekend.title"),
      text: t("adv.mWeekend.text", { pct: change(we, wd), we: duration(t, we), wd: duration(t, wd) }),
      action: "none",
    });
  else
    items.push({
      title: t("adv.wScreen.title"),
      text: t(diff <= 0 ? "adv.mScreen.less" : "adv.mScreen.more", { name, avg: duration(t, avg), pct: Math.abs(diff) }),
      action: "none",
    });
  items.push({
    title: t("adv.wGoal.title"),
    text: t("adv.mGoal", { name, n: goal, days: days.length, moments }),
    action: moments >= 6 ? "specialist" : "export",
  });
  return withExport(items, t);
}
