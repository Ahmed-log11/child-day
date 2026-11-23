import { useI18n } from "../i18n/I18nProvider";

const WING =
  "M12 66 C12 32 48 14 86 28 C84 38 78 44 70 44 C68 52 60 54 54 52 C52 60 44 64 38 62 C36 68 28 72 22 70 Z";

// The wing is the parent, the yellow dot is the child under it.
export function LogoMark({ size = 32, wing = "#A9472A", dot = "#F2C14E" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
      <path d={WING} fill={wing} />
      <circle cx="60" cy="72" r="10" fill={dot} />
    </svg>
  );
}

export function Logo({ size = 32 }) {
  const { t } = useI18n();
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="text-xl font-bold leading-none text-ink">{t("brand.name")}</span>
    </span>
  );
}
