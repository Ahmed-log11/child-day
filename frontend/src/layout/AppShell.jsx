// The frame around every app screen: one floating glass header on desktop, bottom tabs on phones.
// A page can tint the top of the screen with a child's color (usePageTint).
import { createContext, useContext, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
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

function selectedChildId() {
  try {
    return localStorage.getItem("kanaf.child") || "c1";
  } catch {
    return "c1";
  }
}

const NAV = [
  { to: "/dashboard", key: "today", icon: "M3 12l9-8 9 8M5 10v10h14V10" },
  { to: "/week", key: "week", icon: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4" },
  { to: "/month", key: "month", icon: "M4 6h16v14H4zM8 11h2M14 11h2M8 15h2M14 15h2", desktopOnly: true },
  { to: "/alerts", key: "review", icon: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z", badge: true },
  { to: "/children", key: "children", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1-4 4.5-6 8-6s7 2 8 6" },
  { to: "/insights", key: "ask", icon: "M4 5h16v11H9l-5 4z" },
];

export function LangToggle({ className = "" }) {
  const { t, toggle } = useI18n();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("lang.label")}
      className={`min-h-[38px] rounded-full border border-[rgba(28,23,20,.18)] px-3.5 text-[13px] font-medium text-ink hover:bg-white/60 ${className}`}
    >
      {t("lang.switch")}
    </button>
  );
}

function Badge({ count, className = "" }) {
  if (!count) return null;
  return (
    <span className={`inline-grid h-[19px] min-w-[19px] place-items-center rounded-full bg-clay px-1.5 text-[11px] font-bold text-white ${className}`}>
      {count}
    </span>
  );
}

export default function AppShell() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const [tint, setTint] = useState(null);
  const [version, setVersion] = useState(0);
  useEffect(() => onReviewsChanged(() => setVersion((v) => v + 1)), []);
  const { data: alerts } = useData(() => getAlerts(), [version]);
  const openMoments = alerts?.filter((e) => !e.reviewed).length ?? 0;
  const href = (item) => (item.key === "children" ? `/children/${selectedChildId()}` : item.to);
  const active = (item) => (item.key === "children" ? pathname.startsWith("/children") : pathname === item.to);

  return (
    <TintContext.Provider value={setTint}>
      <div
        className="min-h-screen pb-24 lg:pb-16"
        style={{ background: tint ? `linear-gradient(180deg, ${tint} 0px, var(--color-page) 520px)` : undefined }}
      >
        <header className="sticky top-0 z-30 px-3 py-3 sm:px-4">
          <div className="glass mx-auto flex max-w-[1180px] items-center gap-3 rounded-full p-[7px] ps-4">
            <Link to="/" className="rounded-full">
              <Logo />
            </Link>
            <nav aria-label={t("nav.menu")} className="mx-auto hidden items-center gap-0.5 lg:flex">
              {NAV.map((item) => (
                <Link
                  key={item.key}
                  to={href(item)}
                  aria-current={active(item) ? "page" : undefined}
                  className={`flex min-h-10 items-center gap-1.5 rounded-full px-[15px] text-sm ${
                    active(item) ? "bg-rust font-semibold text-white" : "text-body hover:bg-[rgba(28,23,20,.05)]"
                  }`}
                >
                  {t(`nav.${item.key}`)}
                  {item.badge && <Badge count={openMoments} />}
                </Link>
              ))}
            </nav>
            <div className="ms-auto flex items-center gap-2 lg:ms-0">
              <LangToggle />
              <NavLink
                to="/live"
                className="hidden min-h-[38px] items-center gap-2 rounded-full border border-[rgba(28,23,20,.18)] bg-paper px-3.5 text-[13px] font-semibold text-ink sm:flex"
              >
                <span className="size-2 rounded-full bg-clay" />
                {t("nav.goLive")}
              </NavLink>
              <NavLink to="/upload" className="flex min-h-[38px] items-center rounded-full bg-clay px-4 text-[13px] font-semibold text-white hover:bg-rust">
                {t("nav.upload")}
              </NavLink>
            </div>
          </div>
        </header>

        <Outlet />

        <nav
          aria-label={t("nav.menu")}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-[rgba(28,23,20,.1)] bg-[rgba(250,246,241,.9)] pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden"
        >
          <ul className="mx-auto flex max-w-lg justify-around px-2 py-1.5">
            {NAV.filter((i) => !i.desktopOnly).map((item) => (
              <li key={item.key} className="flex-1">
                <Link
                  to={href(item)}
                  aria-current={active(item) ? "page" : undefined}
                  className={`relative mx-auto flex min-h-14 max-w-24 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] ${
                    active(item) ? "font-bold text-rust" : "text-muted"
                  }`}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active(item) ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d={item.icon} />
                  </svg>
                  {t(`nav.${item.key}`)}
                  {item.badge && <Badge count={openMoments} className="absolute end-[calc(50%-24px)] top-1 h-[17px] min-w-[17px] text-[10px]" />}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </TintContext.Provider>
  );
}
