import { useEffect, useState, useCallback, type ReactNode } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import "./Layout.css";

type Props = { children: ReactNode };
type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "ledgerly:theme";

function getInitialTheme(): Theme {
    if (typeof window === "undefined") return "light";
    try {
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === "light" || stored === "dark") return stored;
    } catch { /* ignore */ }
    const prefersDark =
        typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
}

export default function Layout({ children }: Props) {
    const navigate = useNavigate();
    const location = useLocation();
    const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    // Close sidebar when route changes (mobile nav)
    useEffect(() => {
        setMenuOpen(false);
    }, [location.pathname]);

    // Prevent body scroll when sidebar is open on mobile
    useEffect(() => {
        document.body.style.overflow = menuOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [menuOpen]);

    useEffect(() => {
        const root = document.documentElement;
        root.dataset.theme = theme;
        root.style.colorScheme = theme;
        try { window.localStorage.setItem(THEME_STORAGE_KEY, theme); }
        catch { /* ignore */ }
    }, [theme]);

    function toggleTheme() {
        setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    }

    const closeSidebar = useCallback(() => setMenuOpen(false), []);
    const nextTheme = theme === "dark" ? "light" : "dark";

    return (
        <div className="layout">
            {/* ── Top bar ── */}
            <header className="topbar">
                <div className="brandRow">
                    {/* Hamburger — mobile only */}
                    <button
                        type="button"
                        className="burgerBtn"
                        aria-label={menuOpen ? "Close menu" : "Open menu"}
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen((v) => !v)}
                    >
                        <span className={`burger ${menuOpen ? "burgerOpen" : ""}`} aria-hidden="true">
                            <span /><span /><span />
                        </span>
                    </button>
                    <div className="brand">Ledgerly</div>
                </div>

                <button
                    type="button"
                    className="themeToggle"
                    aria-label={`Switch to ${nextTheme} mode`}
                    onClick={toggleTheme}
                >
                    <span className="themeIcon" aria-hidden="true">
                        {theme === "dark" ? <MoonIcon /> : <SunIcon />}
                    </span>
                    <span className="themeLabel">{theme === "dark" ? "Dark" : "Light"}</span>
                </button>
            </header>

            <div className="shell">
                {/* ── Backdrop (mobile) ── */}
                {menuOpen && (
                    <div
                        className="sideBackdrop"
                        aria-hidden="true"
                        onClick={closeSidebar}
                    />
                )}

                {/* ── Sidebar ── */}
                <aside
                    className={`sidebar ${menuOpen ? "sidebarOpen" : ""}`}
                    aria-label="Primary navigation"
                >
                    <nav className="sideNav">
                        <SideLink to="/dashboard" label="Dashboard" icon={<DashboardIcon />} />
                        <SideLink to="/add"        label="Expenses"  icon={<PlusIcon />} />
                        <SideLink to="/recurring"  label="Recurring" icon={<RepeatIcon />} />
                        <SideLink to="/savings"    label="Savings"   icon={<SavingsIcon />} />
                        <SideLink to="/simulator"  label="Simulator" icon={<SimulatorIcon />} />
                        <SideLink to="/health"     label="Health Score" icon={<HealthIcon />} />
                        <SideLink to="/advisor"    label="Atlas (AI)"   icon={<AtlasNavIcon />} atlasLink />
                        <SideLink to="/salary"     label="Salary"   icon={<WalletIcon />} />
                        <SideLink to="/profile"    label="Profile"  icon={<ProfileIcon />} />
                        <SideLink to="/settings"   label="Settings" icon={<SettingsIcon />} />
                        <button
                            type="button"
                            className="sideLink logoutLink"
                            onClick={() => setShowLogoutConfirm(true)}
                        >
                            <span className="sideIcon" aria-hidden="true"><LogoutIcon /></span>
                            <span className="sideLabel">Log out</span>
                        </button>
                    </nav>
                </aside>

                <main className="content">{children}</main>
            </div>

            {/* ── Logout Confirm Modal ── */}
            {showLogoutConfirm && (
                <div className="modalOverlay" role="dialog" aria-modal="true">
                    <div className="modalCard">
                        <h3 className="modalTitle">Log out?</h3>
                        <p className="modalText">You'll be signed out of your account. You can log back in anytime.</p>
                        <div className="modalActions">
                            <button className="ghostBtn" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
                            <button
                                className="dangerBtn"
                                onClick={async () => {
                                    setShowLogoutConfirm(false);
                                    await onLogout();
                                }}
                            >
                                Log out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    async function onLogout() {
        try { await supabase.auth.signOut(); } catch { /* ignore */ }
        navigate("/login", { replace: true });
    }
}

function SideLink({ to, label, icon, atlasLink }: { to: string; label: string; icon: ReactNode; atlasLink?: boolean }) {
    return (
        <NavLink to={to} className={({ isActive }) => `sideLink ${isActive ? "active" : ""} ${atlasLink ? "atlasLink" : ""}`}>
            <span className="sideIcon" aria-hidden="true">{icon}</span>
            <span className="sideLabel">{label}</span>
        </NavLink>
    );
}

/* === Icons === */
function DashboardIcon() {
    return (
        <svg viewBox="0 0 24 24" role="presentation" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 13.5V20h6v-6.5H4Z" /><path d="M14 4v7.5h6V4h-6Z" />
            <path d="M14 14.5V20h6v-5.5h-6Z" /><path d="M4 4v7.5h6V4H4Z" />
        </svg>
    );
}
function PlusIcon() {
    return (
        <svg viewBox="0 0 24 24" role="presentation" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 5v14" /><path d="M5 12h14" />
        </svg>
    );
}
function RepeatIcon() {
    return (
        <svg viewBox="0 0 24 24" role="presentation" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
    );
}
function SavingsIcon() {
    return (
        <svg viewBox="0 0 24 24" role="presentation" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M19 10c0-3.87-3.13-7-7-7S5 6.13 5 10c0 2.38 1.19 4.47 3 5.74V18h8v-2.26A6.96 6.96 0 0 0 19 10Z" />
            <path d="M9 18v1a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-1" />
            <line x1="12" y1="6" x2="12" y2="10" /><line x1="10" y1="8" x2="14" y2="8" />
        </svg>
    );
}
function SimulatorIcon() {
    return (
        <svg viewBox="0 0 24 24" role="presentation" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
            <path d="M13 12h2M13 16h4" />
        </svg>
    );
}
function HealthIcon() {
    return (
        <svg viewBox="0 0 24 24" role="presentation" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
    );
}
function WalletIcon() {
    return (
        <svg viewBox="0 0 24 24" role="presentation" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3.5 7.5A3 3 0 0 1 6.5 4.5h11A3 3 0 0 1 20.5 7.5v9a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3v-9Z" />
            <path d="M20.5 9.5h-4a2 2 0 0 0 0 4h4" />
            <circle cx="16.5" cy="11.5" r="0.9" fill="currentColor" stroke="none" />
        </svg>
    );
}
function ProfileIcon() {
    return (
        <svg viewBox="0 0 24 24" role="presentation" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3.8" y="3.8" width="16.4" height="16.4" rx="4.4" />
            <circle cx="12" cy="9" r="3.2" />
            <path d="M6.5 19.2a5.5 5.5 0 0 1 5.5-4.7h0.1a5.5 5.5 0 0 1 5.4 4.7" />
        </svg>
    );
}
function SettingsIcon() {
    return (
        <svg viewBox="0 0 24 24" role="presentation" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
            <path d="M19.4 15a8 8 0 0 0 .1-1l2-1.2-2-3.5-2.3.6a7.6 7.6 0 0 0-1.6-.9L15 6.6h-4l-.6 2.4c-.6.2-1.1.5-1.6.9l-2.3-.6-2 3.5 2 1.2a8 8 0 0 0 0 2l-2 1.2 2 3.5 2.3-.6c.5.4 1 .7 1.6.9l.6 2.4h4l.6-2.4c.6-.2 1.1-.5 1.6-.9l2.3.6 2-3.5-2-1.2Z" />
        </svg>
    );
}
function SunIcon() {
    return (
        <svg viewBox="0 0 24 24" role="presentation" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1.5" x2="12" y2="4.5" /><line x1="12" y1="19.5" x2="12" y2="22.5" />
            <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" /><line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
            <line x1="1.5" y1="12" x2="4.5" y2="12" /><line x1="19.5" y1="12" x2="22.5" y2="12" />
            <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" /><line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
        </svg>
    );
}
function MoonIcon() {
    return (
        <svg viewBox="0 0 24 24" role="presentation" fill="currentColor">
            <path d="M21 14.5A9 9 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5Z" />
        </svg>
    );
}
function LogoutIcon() {
    return (
        <svg viewBox="0 0 24 24" role="presentation" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M10 7V6a2.5 2.5 0 0 1 2.5-2.5H19a2.5 2.5 0 0 1 2.5 2.5v12A2.5 2.5 0 0 1 19 20.5h-6.5A2.5 2.5 0 0 1 10 18v-1" />
            <path d="M13 12H3" /><path d="M6.5 8.5 3 12l3.5 3.5" />
        </svg>
    );
}
function AtlasNavIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" role="presentation">
            <defs>
                <linearGradient id="atlasNavGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
            </defs>
            <circle cx="12" cy="8" r="2" fill="url(#atlasNavGrad)" />
            <circle cx="6" cy="17" r="2" fill="url(#atlasNavGrad)" />
            <circle cx="18" cy="17" r="2" fill="url(#atlasNavGrad)" />
            <line x1="12" y1="10" x2="6" y2="15" stroke="url(#atlasNavGrad)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="12" y1="10" x2="18" y2="15" stroke="url(#atlasNavGrad)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="8" y1="17" x2="16" y2="17" stroke="url(#atlasNavGrad)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}
