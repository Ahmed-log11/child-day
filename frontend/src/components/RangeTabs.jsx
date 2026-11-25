import { NavLink } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";

const TABS = [
  ["/dashboard", "day"],
  ["/week", "week"],
  ["/month", "month"],
];

export function RangeTabs() {
  const { t } = useI18n();
  return (
    <nav aria-label={t("range.label")} className="inline-flex gap-0.5 rounded-full bg-[rgba(28,23,20,.07)] p-1">
      {TABS.map(([to, key]) => (
        <NavLink
          key={key}
          to={to}
          className={({ isActive }) =>
            `flex min-h-9 items-center rounded-full px-4 text-sm ${isActive ? "bg-rust font-semibold text-white" : "text-body hover:text-ink"}`
          }
        >
          {t(`range.${key}`)}
        </NavLink>
      ))}
    </nav>
  );
}
