// Turns seconds and timestamps into words in the current language.

export function duration(t, seconds) {
  const total = Math.round(seconds / 60);
  if (seconds > 0 && seconds < 60) return t("time.s", { s: Math.round(seconds) });
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return t("time.hm", { h, m });
  if (h) return t("time.h", { h });
  return t("time.m", { m });
}

export function clock(locale, startedAt, offsetSeconds = 0) {
  // A video without a recorded start time (an upload): show the position in the video, like 01:05
  if (!startedAt) {
    const s = Math.max(0, Math.round(offsetSeconds));
    const two = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false });
    return `${two.format(Math.floor(s / 60))}:${two.format(s % 60)}`;
  }
  const date = new Date(new Date(startedAt).getTime() + offsetSeconds * 1000);
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

export function longDate(locale, isoDate) {
  return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(
    new Date(`${isoDate}T12:00:00`)
  );
}

export function percent(part, whole) {
  return whole ? Math.round((part / whole) * 100) : 0;
}

export function hourOf(startedAt, offsetSeconds = 0) {
  const d = new Date(new Date(startedAt).getTime() + offsetSeconds * 1000);
  return d.getHours() + d.getMinutes() / 60;
}
