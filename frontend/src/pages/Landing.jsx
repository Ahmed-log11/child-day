// The front door: a warm "camera's eye" hero, what Kanaf shows, how it works, and privacy.
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { Logo, LogoMark } from "../components/Logo";
import { Figure } from "../components/Figure";
import { StatusChip } from "../components/StatusChip";
import { LangToggle } from "../layout/AppShell";
import { Hud } from "../components/FrameView";
import { CAMERA_ART } from "../components/cameraArt";

function MiniTimeline() {
  const blk = (l, w, c) => <i key={`${l}${c}`} className="absolute inset-y-0 rounded-[5px]" style={{ left: `${l}%`, width: `${w}%`, background: c }} />;
  return (
    <div className="flex flex-col gap-1.5" dir="ltr">
      <div className="relative h-[26px] overflow-hidden rounded-lg bg-[rgba(28,23,20,.06)]">
        {[blk(10, 9, "#2F4F86"), blk(19, 3, "#1B2F55"), blk(43, 6, "#2F4F86"), blk(79, 11, "#2F4F86")]}
      </div>
      <div className="relative h-[11px] overflow-hidden rounded-md bg-[rgba(28,23,20,.06)]">
        {[blk(25, 8, "#2E9C8C"), blk(57, 11, "#9FD3C9"), blk(68, 5, "#2E9C8C")]}
      </div>
    </div>
  );
}

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

export default function Landing() {
  const { t, tl, dir } = useI18n();
  const feats = tl("ln.feats");
  const steps = tl("ln.steps");
  const priv = tl("ln.priv");
  const chips = tl("ln.chips");

  const visuals = [
    <div key="0" className="flex w-full flex-col gap-2 text-xs">
      {[["tv", 70, "#2F4F86"], ["tablet", 40, "#2F4F86"], ["multi_screen", 18, "#1B2F55"]].map(([k, w, c]) => (
        <div key={k} className="flex items-center gap-2">
          <span className="w-[84px] shrink-0">{t(`screen.${k}`)}</span>
          <span className="h-2.5 rounded-full" style={{ width: `${w}%`, background: c }} />
        </div>
      ))}
    </div>,
    <div key="1" className="flex w-full items-center gap-3.5">
      <Figure pose="run" color="#2E9C8C" width={52} />
      <div className="flex-1">
        <div className="text-[26px] font-extrabold text-ink">
          42<span className="text-[12.5px] font-normal text-muted"> / 60</span>
        </div>
        <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-move-soft">
          <i className="block h-full w-[70%] rounded-full bg-move" />
        </div>
      </div>
    </div>,
    <div key="2" className="flex flex-col items-start gap-1.5">
      <StatusChip kind="look" label={chips[0]} />
      <StatusChip kind="alert" label={chips[1]} />
      <StatusChip kind="ok" label={chips[2]} />
    </div>,
  ];

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden bg-peach text-ink">
        <div
          className="absolute inset-0 opacity-30 lg:opacity-100 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
          style={{ transform: dir === "rtl" ? "scaleX(-1)" : undefined }}
          dangerouslySetInnerHTML={{ __html: CAMERA_ART }}
        />
        <span className="pointer-events-none absolute inset-x-5 top-24 bottom-5 hidden md:block" aria-hidden="true">
          <Hud />
        </span>

        <header className="relative z-[3] px-3 py-4 sm:px-4">
          <div className="glass mx-auto flex max-w-[1180px] items-center gap-3 rounded-full p-[7px] ps-4">
            <Logo />
            <nav className="ms-6 hidden gap-0.5 lg:flex">
              <button type="button" onClick={() => scrollTo("how")} className="min-h-10 rounded-full px-4 text-sm text-body hover:bg-[rgba(28,23,20,.05)]">
                {t("ln.how")}
              </button>
              <button type="button" onClick={() => scrollTo("privacy")} className="min-h-10 rounded-full px-4 text-sm text-body hover:bg-[rgba(28,23,20,.05)]">
                {t("ln.privacy")}
              </button>
            </nav>
            <div className="ms-auto flex items-center gap-2">
              <LangToggle />
              <Link to="/dashboard" className="hidden min-h-[38px] items-center rounded-full border border-[rgba(28,23,20,.18)] px-3.5 text-[13.5px] font-semibold sm:flex">
                {t("ln.sample")}
              </Link>
              <Link to="/setup" className="flex min-h-[38px] items-center rounded-full bg-clay px-4 text-[13.5px] font-semibold text-white hover:bg-rust">
                {t("ln.start")}
              </Link>
            </div>
          </div>
        </header>

        <div className="relative z-[2] mx-auto grid max-w-[1180px] items-end gap-10 px-4 pt-4 pb-20 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)] lg:pt-6">
          <div>
            <h1 className={`mb-6 text-[clamp(44px,7vw,100px)] font-black tracking-tight ${dir === "rtl" ? "leading-[1.3]" : "leading-[1.05]"}`} dir={dir}>
              <span className="block">
                <span className="typing">{t("ln.h1a")}</span>
              </span>
              <span className="block">
                <span className="typing" style={{ animationDelay: "1.1s" }}>
                  {t("ln.h1b")}
                  <span className="text-clay">{t("ln.h1acc")}</span>
                  <span className="ms-1 inline-block h-[.78em] w-[.07em] animate-[blink_1s_steps(1)_infinite] bg-clay align-[-0.04em]" />
                </span>
              </span>
            </h1>
            <p className="max-w-[52ch] text-[17px] leading-[1.8] text-[#6B564B]">{t("ln.sub")}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/setup" className="flex min-h-[54px] items-center gap-2.5 rounded-full bg-clay px-6 text-base font-semibold text-white hover:bg-rust">
                {t("ln.start")}
                <span className="-me-3.5 grid size-8 place-items-center rounded-full bg-paper text-rust">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flip" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
              <Link to="/dashboard" className="flex min-h-[54px] items-center rounded-full border border-[rgba(28,23,20,.12)] bg-paper px-6 text-base font-semibold">
                {t("ln.sample")}
              </Link>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-[#6B564B]">
              <i className="size-[7px] rounded-full bg-clay" />
              {t("ln.ages")}
            </p>
          </div>

          <div className="glass rounded-[28px] p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-[38px] place-items-center rounded-xl border-2 border-[#7B5CC6] bg-[#ECE5FA] font-bold text-[#7B5CC6]">{t("ln.card.initial")}</span>
              <div>
                <b className="block text-ink">{t("ln.card.title")}</b>
                <span className="text-[12.5px] text-muted">{t("ln.card.line")}</span>
              </div>
            </div>
            <div className="mt-5">
              <MiniTimeline />
            </div>
            <div className="mt-4">
              <StatusChip kind="look" label={t("ln.card.chip")} />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
        <section className="relative z-[3] -mt-9 grid gap-5 md:grid-cols-3">
          {feats.map(([title, text], i) => (
            <div key={title} className="glass flex flex-col gap-3 rounded-[28px] p-[18px]">
              <div className="flex h-[118px] items-center justify-center rounded-[20px] bg-[rgba(28,23,20,.05)] px-[18px] py-3.5">{visuals[i]}</div>
              <h3 className="px-1 text-[19px] font-bold">{title}</h3>
              <p className="px-1 text-body">{text}</p>
            </div>
          ))}
        </section>

        <section id="how" className="grid gap-12 pt-24 pb-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div>
            <div className="mono flex items-center gap-3 text-muted">
              {t("ln.how")}
              <span className="h-px w-12 bg-[rgba(28,23,20,.18)]" />
            </div>
            <h2 className="mt-3 mb-3.5 text-[clamp(34px,4.4vw,58px)] leading-[1.15] font-extrabold tracking-tight">{t("ln.how")}</h2>
            <p className="text-body">{t("ln.howSub")}</p>
          </div>
          <ol className="grid border-t border-[rgba(28,23,20,.18)] sm:grid-cols-2">
            {steps.map(([title, text], i) => (
              <li
                key={title}
                className={`flex gap-4 border-b border-[rgba(28,23,20,.1)] py-5 ${i % 2 ? "sm:border-s sm:ps-5" : "sm:pe-5"}`}
              >
                <span className="w-14 shrink-0 text-[40px] leading-none font-extralight text-ink tabular-nums">0{i + 1}</span>
                <div>
                  <b className="mb-1 block text-[16.5px] text-ink">{title}</b>
                  <p className="text-sm text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="privacy" className="my-14 grid overflow-hidden rounded-[34px] bg-peach lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className="relative flex min-h-[340px] items-end justify-center gap-4 bg-[radial-gradient(circle_at_50%_70%,rgba(217,105,45,.22),transparent_60%),#FFF4EA] px-5 pt-10 pb-8">
            <Hud />
            <Figure pose="stand" color="#7B5CC6" width={190} />
            <Figure pose="run" color="#B5508C" width={190} />
          </div>
          <div className="p-7 sm:p-11">
            <span className="mono text-clay">{t("ln.privacy")}</span>
            <h2 className="mt-2.5 text-[clamp(28px,3.4vw,44px)] leading-[1.2] font-extrabold">{t("ln.privTitle")}</h2>
            <ul className="mt-5">
              {priv.map((line, i) => (
                <li key={line} className="flex gap-3.5 border-t border-[rgba(28,23,20,.12)] py-3 text-[#6B564B]">
                  <span className="pt-1 font-mono text-[11px] text-clay">0{i + 1}</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <footer className="flex items-center gap-3 border-t border-[rgba(28,23,20,.18)] pt-5 pb-10 text-[13px] text-muted">
          <LogoMark size={22} />
          <span>{t("ln.footer")}</span>
        </footer>
      </div>
    </div>
  );
}
