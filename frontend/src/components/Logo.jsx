import { useI18n } from "../i18n/I18nProvider";

// The mark: a wing over a sleeping child, inside a camera frame.
export function LogoMark({ size = 36 }) {
  return <img src="/mark.png" width={size} height={Math.round(size * 0.92)} alt="" aria-hidden="true" className="shrink-0" />;
}

export function Logo({ size = 36, small = true }) {
  const { t } = useI18n();
  return (
    <span className="flex items-center gap-2.5 text-ink">
      <LogoMark size={size} />
      <span className="leading-none">
        <b className="block text-[21px] font-extrabold">{t("brand.name")}</b>
        {small && <small className="mt-1 hidden text-[9.5px] tracking-[0.38em] text-rust sm:block">KANAF</small>}
      </span>
    </span>
  );
}
