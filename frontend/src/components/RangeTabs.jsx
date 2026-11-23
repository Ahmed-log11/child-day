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
    <nav aria-label={t("range.label")} className="flex gap-1 rounded-[13px] bg-[#efe8de] p-1">
      {TABS.map(([to, key]) => (
        <NavLink
          key={key}
          to={to}
          className={({ isActive }) =>
            `flex min-h-9 items-center rounded-[10px] px-4 text-sm ${isActive ? "bg-white font-semibold text-ink" : "text-body"}`
          }
        >
          {t(`range.${key}`)}
        </NavLink>
      ))}
    </nav>
  );
}
