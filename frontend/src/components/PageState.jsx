import { useI18n } from "../i18n/I18nProvider";

// Loading, error and "coming soon" states, so every page handles them the same way.
export function PageState({ loading, error, comingSoon }) {
  const { t } = useI18n();
  const text = loading ? t("common.loading") : error ? t("common.error") : t("common.comingSoon");
  return (
    <main className="mx-auto max-w-6xl px-4 py-16 text-center text-body sm:px-6" role={error ? "alert" : "status"}>
      {text}
    </main>
  );
}

export function ComingSoon() {
  return <PageState comingSoon />;
}
