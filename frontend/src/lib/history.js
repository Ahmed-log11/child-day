// Sample history for the Week and Month pages: one uploaded video is one day, so the weeks
// before it are generated. The same child always gets the same numbers, and each child is different.

function hash(str) {
  let h = 2166136261;
  for (const ch of String(str)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function rng(seed) {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 1 | s) + 0x6d2b79f5) | 0;
    s ^= s + Math.imul(s ^ (s >>> 7), 61 | s);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n) => String(n).padStart(2, "0");
export const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEKEND = [5, 6]; // Friday and Saturday

// Each child gets a profile from its id: which screen they prefer and how active they are.
function profileFor(childId, index) {
  const r = rng(hash(childId) + index * 7919);
  const tvLover = index % 2 === 0;
  return {
    tv: tvLover ? 0.55 + r() * 0.15 : 0.25 + r() * 0.1,
    tablet: tvLover ? 0.22 + r() * 0.08 : 0.45 + r() * 0.15,
    phone: 0.05 + r() * 0.05,
    screenH: 1.7 + r() * 0.9, // hours of screens on a school day
    activeMin: tvLover ? 48 + r() * 10 : 60 + r() * 12,
    peak: tvLover ? 18 : 16, // the hour screens peak
  };
}

function makeDay(date, p, r, demo) {
  const weekend = WEEKEND.includes(date.getDay());
  const coverage = r() < 0.08 ? 0 : 1; // a few days without video
  if (!coverage) return { date: isoOf(date), none: true, is_demo_data: demo };
  const wobble = 0.78 + r() * 0.44;
  const screen = p.screenH * 3600 * wobble * (weekend ? 1.3 : 1);
  const multi = screen * (0.08 + r() * 0.1);
  const single = screen - multi;
  const hours = Array.from({ length: 24 }, (_, h) => {
    if (h < 7 || h > 21) return 0;
    const school = !weekend && h >= 8 && h < 14;
    const base = Math.exp(-((h - p.peak) ** 2) / 8) + (weekend ? 0.35 : 0);
    return school ? 0 : Math.round(base * (0.6 + r() * 0.8) * 60);
  });
  const active = p.activeMin * 60 * (0.7 + r() * 0.6) * (weekend ? 0.8 : 1);
  return {
    date: isoOf(date),
    tv_s: Math.round(single * p.tv),
    tablet_s: Math.round(single * p.tablet),
    phone_s: Math.round(single * p.phone),
    multi_screen_s: Math.round(multi),
    active_s: Math.round(active),
    light_s: Math.round(active * (1.1 + r() * 0.4)),
    still_s: Math.round(screen * 1.1 + r() * 3600),
    longest_still_s: Math.round(2400 + r() * 3000),
    longest_session_s: Math.round(1800 + r() * 4200),
    sessions: 3 + Math.round(r() * 4),
    alerts: r() < 0.55 ? 0 : r() < 0.7 ? 1 : 2,
    hours,
    video_s: Math.round(9 * 3600 + r() * 3 * 3600),
    is_demo_data: demo,
  };
}

// Days for one child, oldest first. `days` back from `end` (a Date).
export function history(childId, index = 0, days = 35, end = new Date()) {
  const p = profileFor(childId, index);
  const r = rng(hash(`${childId}:days`));
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i, 12);
    out.push(makeDay(d, p, r, i > 0));
  }
  return out;
}

export const screenOf = (d) => (d.none ? 0 : d.tv_s + d.tablet_s + d.phone_s + d.multi_screen_s);
export const seen = (list) => list.filter((d) => !d.none);
export const avgOf = (list, fn) => {
  const s = seen(list);
  return s.length ? s.reduce((sum, d) => sum + fn(d), 0) / s.length : 0;
};
export const sumOf = (list, fn) => seen(list).reduce((sum, d) => sum + fn(d), 0);
export const change = (now, before) => (before ? Math.round(((now - before) / before) * 100) : 0);
export const ACTIVE_GOAL_S = 3600; // WHO: an average of 60 minutes a day of moderate-to-vigorous activity (5-17)
