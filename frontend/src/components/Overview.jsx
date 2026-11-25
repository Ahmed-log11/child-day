// Small building blocks for the Week and Month overviews.
import { useI18n } from "../i18n/I18nProvider";

export const ICONS = {
  screen: "M3 5h18v11H3zM8 20h8M12 16v4",
  active: "M13 4a2 2 0 100 .1M7 21l3-6 3 2v5M10 15l1-5 4 3 3-1M8 9l3-1",
  moment: "M12 3l10 18H2zM12 10v5M12 18v.5",
  camera: "M3 7h4l2-3h6l2 3h4v13H3zM12 17a4 4 0 100-8 4 4 0 000 8z",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
  multi: "M2 6h13v9H2zM9 18h13V9",
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18",
  balance: "M12 3v18M5 7h14M5 7l-3 7h6zM19 7l-3 7h6z",
  still: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5",
  play: "M8 5l11 7-11 7z",
  arrow: "M5 12h14M13 6l6 6-6 6",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
};

export function Icon({ d, size = 20, className = "", stroke = 1.7 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// Change against the previous period. Neutral: data is never good or bad.
export function Delta({ value, unit = "%" }) {
  if (!Number.isFinite(value) || value === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(28,23,20,.07)] px-2.5 py-0.5 text-xs font-semibold text-body tabular-nums">
      {value > 0 ? "↑" : "↓"} {Math.abs(value)}
      {unit}
    </span>
  );
}

export function Kpi({ icon, label, value, sub, delta }) {
  return (
    <div className="glass flex items-start gap-3 rounded-[22px] p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-[rgba(217,105,45,.12)] text-rust">
        <Icon d={icon} />
      </span>
      <div className="min-w-0">
        <span className="block text-[12.5px] text-muted">{label}</span>
        <b className="block text-[22px] leading-tight font-extrabold whitespace-nowrap text-ink sm:text-[24px]">{value}</b>
        {sub && <span className="block text-[12.5px] text-muted">{sub}</span>}
        {delta !== undefined && (
          <span className="mt-1.5 block">
            <Delta value={delta} />
          </span>
        )}
      </div>
    </div>
  );
}

export function Banner({ children }) {
  return (
    <div className="glass flex items-start gap-3.5 rounded-[28px] bg-[linear-gradient(120deg,rgba(255,232,214,.9),rgba(250,246,241,.72))] px-5 py-5 sm:px-6">
      <Icon d={ICONS.spark} size={26} className="mt-0.5 text-clay" />
      <p className="text-[15.5px] leading-[1.75] text-ink sm:text-[17px]">{children}</p>
    </div>
  );
}

export function Soon({ title, text, children }) {
  const { t } = useI18n();
  return (
    <section className="glass flex flex-col gap-3 rounded-[28px] border-dashed p-5 opacity-75">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[19px] font-semibold">{title}</h2>
        <span className="rounded-full bg-[rgba(28,23,20,.07)] px-2.5 py-0.5 text-[11.5px] font-semibold text-muted">{t("ov.soon")}</span>
      </div>
      {children}
      <p className="text-[13.5px] text-muted">{text}</p>
    </section>
  );
}

// Ring for "x of 7 days": goal progress.
export function Ring({ value, total, size = 132, color = "#2E9C8C", children }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(28,23,20,.08)" strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(value / total) * c} ${c}`}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">{children}</div>
    </div>
  );
}

// Donut: share of each part.
export function Donut({ parts, size = 170, children }) {
  const r = 60;
  const c = 2 * Math.PI * r;
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 160 160" width={size} height={size} aria-hidden="true">
        {parts.map((p) => {
          const len = (p.value / total) * c;
          const el = (
            <circle
              key={p.key}
              cx="80"
              cy="80"
              r={r}
              fill="none"
              stroke={p.color}
              strokeWidth="22"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 80 80)"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

// Days without video: hatched, so nobody reads them as zero.
export const NO_VIDEO = {
  background: "repeating-linear-gradient(135deg, transparent 0 3px, rgba(28,23,20,.13) 3px 4px)",
  border: "1px dashed rgba(28,23,20,.14)",
};

// Screen level color, from light to strong (screens are blue).
export function screenShade(minutes, max) {
  if (!minutes) return "rgba(28,23,20,.04)";
  const f = Math.min(1, minutes / max);
  const steps = ["#E3E8F1", "#C3CEE3", "#93A7CB", "#5E7AAE", "#2F4F86"];
  return steps[Math.min(steps.length - 1, Math.floor(f * steps.length))];
}
