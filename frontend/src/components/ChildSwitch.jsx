import { useI18n } from "../i18n/I18nProvider";
import { childTheme } from "../lib/children";

export function Avatar({ name, theme, size = 32 }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center border-2 font-bold"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        borderColor: theme.color,
        color: theme.color,
        fontSize: size * 0.42,
        background: `linear-gradient(180deg, ${theme.tint} 0%, #FAF6F1 100%)`,
      }}
      aria-hidden="true"
    >
      {name.slice(0, 1)}
    </span>
  );
}

export function ChildSwitch({ children, selectedId, onSelect }) {
  const { t } = useI18n();
  return (
    <div role="group" aria-label={t("children.label")} className="flex flex-wrap gap-1.5">
      {children.map((child) => {
        const theme = childTheme(children, child.id);
        const on = child.id === selectedId;
        return (
          <button
            key={child.id}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(child.id)}
            className={`flex min-h-11 items-center gap-2.5 rounded-full py-1 ps-1 pe-4 text-sm transition ${
              on ? "font-semibold text-ink" : "border border-[rgba(28,23,20,.18)] bg-paper text-body hover:border-[rgba(28,23,20,.3)]"
            }`}
            style={on ? { border: `2px solid ${theme.color}`, background: `linear-gradient(180deg, ${theme.tint}, #FAF6F1)` } : undefined}
          >
            <Avatar name={child.name} theme={theme} size={32} />
            {child.name}
          </button>
        );
      })}
    </div>
  );
}
