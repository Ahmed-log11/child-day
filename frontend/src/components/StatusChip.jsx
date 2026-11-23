import { useI18n } from "../i18n/I18nProvider";

const STYLES = {
  ok: "bg-ok-soft text-ok",
  look: "bg-look-soft text-look-text",
  alert: "bg-alert-soft text-alert-text",
};

const ICONS = {
  ok: <><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></>,
  look: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  alert: <><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" /></>,
};

// Status is never shown by color alone: always an icon and a word.
export function StatusChip({ kind, label }) {
  const { t } = useI18n();
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[kind]}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICONS[kind]}
      </svg>
      {label ?? t(`status.${kind}`)}
    </span>
  );
}
