// The frame around every app screen: top navbar on desktop, bottom tabs on phones.
// A page can tint the whole top of the screen with a child's color (usePageTint).
import { createContext, useContext, useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { Logo } from "../components/Logo";
import { getAlerts, onReviewsChanged } from "../api/client";
import { useData } from "../lib/useData";

const TintContext = createContext(() => {});

export function usePageTint(tint) {
  const setTint = useContext(TintContext);
  useEffect(() => {
    setTint(tint);
    return () => setTint(null);
  }, [tint, setTint]);
}

const NAV = [
  { to: "/dashboard", key: "today", icon: "M3 12l9-8 9 8M5 10v10h14V10" },
  { to: "/week", key: "week", icon: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4" },
  { to: "/month", key: "month", icon: "M4 6h16v14H4zM8 11h2M14 11h2M8 15h2M14 15h2", desktopOnly: true },
  { to: "/alerts", key: "review", icon: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z", badge: true },
  { to: "/children/c1", key: "children", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1-4 4.5-6 8-6s7 2 8 6" },
  { to: "/insights", key: "ask", icon: "M4 5h16v11H9l-5 4z" },
];

function LangToggle({ className = "" }) {
  const { t, toggle } = useI18n();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("lang.label")}
      className={`min-h-9 rounded-lg border border-[#ded5ca] bg-white/80 px-2.5 text-[13px] font-medium text-ink hover:bg-white ${className}`}
    >
      {t("lang.switch")}
    </button>
  );
}

function Badge({ count }) {
  if (!count) return null;
  return <span className="ms-1.5 rounded-full bg-clay px-1.5 text-[11px] font-bold leading-[18px] text-white">{count}</span>;
}

export default function AppShell() {
  const { t } = useI18n();
  const [tint, setTint] = useState(null);
  const [version, setVersion] = useState(0);
  useEffect(() => onReviewsChanged(() => setVersion((v) => v + 1)), []);
  const { data: alerts } = useData(() => getAlerts(), [version]);
  const openMoments = alerts?.filter((e) => !e.reviewed).length ?? 0;

  return (
    <TintContext.Provider value={setTint}>
      <div
        className="min-h-screen pb-24 md:pb-16"
        style={{ background: tint ? `linear-gradient(180deg, ${tint} 0px, var(--color-page) 460px)` : undefined }}
      >
        <header className={`border-b ${tint ? "border-white/60 bg-transparent" : "border-[#eadfd6] bg-cream"}`}>
          <div className="mx-auto flex max-w-6xl items-center gap-8 px-4 py-3 sm:px-6">
            <Link to="/" className="rounded-lg">
              <Logo />
            </Link>
            <nav aria-label={t("nav.menu")} className="hidden flex-1 items-center gap-6 text-sm lg:flex">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 pt-1.5 ${isActive ? "font-semibold text-ink" : "text-muted hover:text-ink"}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className="flex items-center">
                        {t(`nav.${item.key}`)}
                        {item.badge && <Badge count={openMoments} />}
                      </span>
                      <span className={`size-1.5 rounded-full ${isActive ? "bg-sun" : "bg-transparent"}`} />
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
            <div className="ms-auto flex items-center gap-2 lg:ms-0">
              <LangToggle />
              <Link
                to="/live"
                className="hidden min-h-9 items-center gap-1.5 rounded-lg border border-[#ded5ca] bg-white px-3 text-[13px] font-semibold sm:flex"
              >
                <span className="size-1.5 rounded-full bg-clay" />
                {t("nav.goLive")}
              </Link>
              <Link
                to="/upload"
                className="flex min-h-9 items-center rounded-lg bg-clay px-3 text-[13px] font-semibold text-white hover:bg-clay-dark"
              >
                {t("nav.upload")}
              </Link>
            </div>
          </div>
        </header>

        <Outlet />

        <nav
          aria-label={t("nav.menu")}
          className="fixed inset-x-0 bottom-0 z-20 border-t border-[#eadfd6] bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        >
          <ul className="mx-auto flex max-w-lg justify-around">
            {NAV.filter((i) => !i.desktopOnly).map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `relative flex min-h-14 min-w-16 flex-col items-center justify-center gap-1 text-[11px] ${
                      isActive ? "font-semibold text-clay" : "text-muted"
                    }`
                  }
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d={item.icon} />
                  </svg>
                  {t(`nav.${item.key}`)}
                  {item.badge && openMoments > 0 && (
                    <span className="absolute end-3 top-1.5 rounded-full bg-clay px-1.5 text-[10px] font-bold leading-4 text-white">
                      {openMoments}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </TintContext.Provider>
  );
}
