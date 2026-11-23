// The landing page: what Kanaf is, how it works, and the privacy promise.
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { Logo, LogoMark } from "../components/Logo";
import { Figure } from "../components/Figure";
import { StatusChip } from "../components/StatusChip";
import { CHILD_COLORS } from "../lib/children";

function Button({ to, primary, children }) {
  return (
    <Link
      to={to}
      className={`flex min-h-12 items-center rounded-xl px-5 font-semibold ${
        primary ? "bg-clay text-white hover:bg-clay-dark" : "border border-[#ded5ca] bg-white text-ink hover:border-clay"
      }`}
    >
      {children}
    </Link>
  );
}

function MiniTimeline() {
  const block = (left, width, cls) => <span className={`absolute inset-y-0 rounded ${cls}`} style={{ left: `${left}%`, width: `${width}%` }} />;
  return (
    <div dir="ltr" className="flex flex-col gap-1.5">
      <div className="relative h-7 overflow-hidden rounded-lg bg-[#f3efe8]">
        <span className="absolute inset-y-0 left-[78%] right-0 bg-[#e8dcd0]" />
        {block(10, 9, "bg-screen")}
        {block(19, 3, "bg-screen-2")}
        {block(43, 6, "bg-screen")}
        {block(79, 11, "bg-screen")}
      </div>
      <div className="relative h-3 overflow-hidden rounded-md bg-[#f3efe8]">
        {block(25, 8, "bg-move")}
        {block(57, 11, "bg-move-light")}
        {block(68, 5, "bg-move")}
      </div>
    </div>
  );
}

export default function Landing() {
  const { t, tl, toggle } = useI18n();
  const features = tl("landing.features");
  const steps = tl("landing.steps");

  const visuals = [
    <div key="s" className="flex w-full flex-col gap-2 text-xs">
      {[["tv", 70, "bg-screen"], ["tablet", 40, "bg-screen"], ["multi_screen", 18, "bg-screen-2"]].map(([k, w, c]) => (
        <div key={k} className="flex items-center gap-2">
          <span className="w-20 shrink-0">{t(`screen.${k}`)}</span>
          <span className={`h-2.5 rounded-full ${c}`} style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>,
    <div key="m" className="flex w-full items-center gap-3">
      <Figure pose="run" color="#17707A" width={58} />
      <div className="flex-1">
        <div className="text-2xl font-bold">42<span className="text-sm text-muted"> / 60</span></div>
        <div className="mt-1.5 h-2 rounded-full bg-move-soft">
          <div className="h-2 w-[70%] rounded-full bg-move" />
        </div>
      </div>
    </div>,
    <div key="c" className="flex flex-col items-start gap-2">
      <StatusChip kind="look" label={t("landing.chips.look")} />
      <StatusChip kind="alert" label={t("landing.chips.alert")} />
      <StatusChip kind="ok" label={t("landing.chips.ok")} />
    </div>,
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-[#eadfd6] bg-cream">
        <div className="mx-auto flex max-w-6xl items-center gap-8 px-4 py-3 sm:px-6">
          <Logo />
          <nav className="hidden gap-6 text-sm text-muted md:flex">
            <a href="#how" className="hover:text-ink">{t("landing.nav.how")}</a>
            <a href="#privacy" className="hover:text-ink">{t("landing.nav.privacy")}</a>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <button type="button" onClick={toggle} aria-label={t("lang.label")} className="min-h-9 rounded-lg border border-[#ded5ca] bg-white/80 px-2.5 text-[13px] font-medium">
              {t("lang.switch")}
            </button>
            <Link to="/dashboard" className="hidden min-h-9 items-center rounded-lg border border-[#ded5ca] bg-white px-3 text-[13px] font-semibold sm:flex">
              {t("landing.nav.sample")}
            </Link>
            <Link to="/setup" className="flex min-h-9 items-center rounded-lg bg-clay px-3 text-[13px] font-semibold text-white hover:bg-clay-dark">
              {t("landing.nav.start")}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto flex max-w-6xl flex-wrap items-center gap-12 px-4 pt-14 pb-14 sm:px-6 sm:pt-20">
          <div className="min-w-0 flex-[999_1_460px]">
            <h1 className="text-4xl leading-[1.08] font-bold tracking-tight sm:text-6xl">{t("landing.headline")}</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-body">{t("landing.sub")}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button to="/setup" primary>{t("landing.nav.start")}</Button>
              <Button to="/dashboard">{t("landing.nav.sample")}</Button>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-muted">
              <span className="size-1.5 rounded-full bg-sun" aria-hidden="true" />
              {t("landing.ages")}
            </p>
          </div>
          <div className="min-w-0 flex-[1_1_380px] rounded-3xl border border-line bg-white p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-[11px] border-2 font-bold" style={{ borderColor: CHILD_COLORS[0].color, color: CHILD_COLORS[0].color, background: CHILD_COLORS[0].tint }}>S</span>
              <div>
                <div className="font-bold">{t("landing.preview.title")}</div>
                <div className="text-[13px] text-muted">{t("landing.preview.meta")}</div>
              </div>
            </div>
            <div className="my-4 flex justify-center gap-1 rounded-2xl bg-[#f6f2ec] pt-3" aria-hidden="true">
              <Figure pose="sit" width={80} />
              <Figure pose="tablet" width={80} />
              <Figure pose="run" color="#17707A" width={80} />
            </div>
            <MiniTimeline />
            <div className="mt-4">
              <StatusChip kind="look" label={t("landing.preview.moments")} />
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 sm:px-6 md:grid-cols-3">
          {features.map((f, i) => (
            <div key={f.title} className="flex flex-col gap-3.5 rounded-[20px] border border-line bg-white p-6">
              <div className="flex h-28 items-center justify-center rounded-2xl bg-[#f6f2ec] px-4">{visuals[i]}</div>
              <h3 className="text-lg font-bold">{f.title}</h3>
              <p className="leading-relaxed text-body">{f.text}</p>
            </div>
          ))}
        </section>

        <section id="how" className="border-y border-[#eadfd6] bg-cream">
          <div className="mx-auto flex max-w-6xl flex-wrap gap-12 px-4 py-16 sm:px-6">
            <div className="flex-[1_1_280px]">
              <h2 className="text-3xl font-bold tracking-tight">{t("landing.howTitle")}</h2>
              <p className="mt-3 text-body">{t("landing.howSub")}</p>
            </div>
            <ol className="grid flex-[2_1_520px] gap-7 sm:grid-cols-2">
              {steps.map((s, i) => (
                <li key={s.title} className="flex gap-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sun font-bold">{i + 1}</span>
                  <div>
                    <div className="font-bold">{s.title}</div>
                    <div className="mt-1 text-sm leading-relaxed text-body">{s.text}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="privacy" className="mx-auto flex max-w-6xl flex-wrap items-center gap-10 px-4 py-16 sm:px-6">
          <div className="flex flex-[1_1_280px] justify-center rounded-3xl bg-[#f6f2ec] p-6" aria-hidden="true">
            <Figure pose="stand" color={CHILD_COLORS[0].color} width={110} />
            <Figure pose="run" color={CHILD_COLORS[1].color} width={110} />
          </div>
          <div className="flex-[2_1_440px]">
            <h2 className="text-3xl font-bold tracking-tight">{t("landing.privacyTitle")}</h2>
            <ul className="mt-5 flex flex-col gap-3 text-body">
              {tl("landing.privacy").map((line) => (
                <li key={line} className="flex gap-2.5">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-clay" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#eadfd6]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-6 text-[13px] text-muted sm:px-6">
          <LogoMark size={22} />
          <span>
            {t("brand.name")} · {t("landing.footer")}
          </span>
        </div>
      </footer>
    </div>
  );
}
