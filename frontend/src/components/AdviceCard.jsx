// "What we'd suggest": 2-3 short pieces of advice, each with one optional button
// (review the moments, export the report, or export it for a specialist).
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { Icon, ICONS } from "./Overview";

const BUTTON = {
  review: "border border-[rgba(28,23,20,.18)] bg-paper text-ink hover:border-clay",
  export: "border border-[rgba(28,23,20,.18)] bg-paper text-ink hover:border-clay",
  specialist: "bg-clay text-white hover:bg-rust",
};

export function AdviceCard({ items, loading, ai, links, className = "" }) {
  const { t } = useI18n();
  return (
    <section className={`glass rounded-[28px] bg-[linear-gradient(120deg,rgba(255,232,214,.85),rgba(250,246,241,.7))] p-5 sm:p-6 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Icon d={ICONS.spark} size={24} className="text-clay" />
        <h2 className="text-[19px] font-semibold">{t("adv.title")}</h2>
        {ai && <span className="rounded-full bg-[rgba(217,105,45,.12)] px-2.5 py-0.5 text-[11.5px] font-semibold text-rust">{t("adv.aiBadge")}</span>}
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-[rgba(28,23,20,.06)]" />
          ))}
          <span className="sr-only">{t("adv.loading")}</span>
        </div>
      ) : (
        <ol className="grid gap-3 md:grid-cols-3">
          {items.map((item, i) => (
            <li key={i} className="flex flex-col gap-2 rounded-2xl bg-paper/80 p-4">
              <b className="text-[15.5px] text-ink">{item.title}</b>
              <p className="flex-1 text-[14px] leading-relaxed text-body">{item.text}</p>
              {item.action !== "none" && links?.[item.action] && (
                <Link
                  to={links[item.action]}
                  className={`mt-1 flex min-h-10 w-fit items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold ${BUTTON[item.action]}`}
                >
                  {item.action !== "review" && <Icon d={ICONS.download} size={16} />}
                  {t(`adv.act.${item.action}`)}
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}

      <p className="mt-3.5 text-[12.5px] text-muted">{ai ? t("adv.byAi") : t("adv.byRules")}</p>
    </section>
  );
}

// Small "Export report" button for the page header.
export function ExportButton({ to }) {
  const { t } = useI18n();
  return (
    <Link to={to} className="flex min-h-10 items-center gap-2 rounded-full border border-[rgba(28,23,20,.18)] bg-paper px-4 text-sm font-semibold text-ink hover:border-clay">
      <Icon d={ICONS.download} size={16} />
      {t("adv.exportShort")}
    </Link>
  );
}
