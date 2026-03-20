import { useState } from "react";
import { exportCloudData, importCloudData } from "../../lib/data";
import { useUserSettings } from "../../lib/useUserSettings";
import "./Settings.css";

// ─── Toggle component ────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="st-toggle">
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
            <span className="st-toggle-track" />
        </label>
    );
}

// ─── Confirm modal ───────────────────────────────────────────
function ConfirmModal({
    title,
    body,
    confirmLabel,
    onConfirm,
    onCancel,
    danger,
}: {
    title: string;
    body: string;
    confirmLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
    danger?: boolean;
}) {
    return (
        <div className="st-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
            <div className="st-modal" role="dialog" aria-modal="true">
                <p className="st-modal-title">{title}</p>
                <p className="st-modal-body">{body}</p>
                <div className="st-modal-actions">
                    <button className="st-action-btn" onClick={onCancel}>Cancel</button>
                    <button
                        className={`st-action-btn ${danger ? "danger" : "accent"}`}
                        onClick={onConfirm}
                    >{confirmLabel}</button>
                </div>
            </div>
        </div>
    );
}

// ─── Main component ──────────────────────────────────────────
export default function Settings() {
    const { settings, loading, saving, error: settingsError, update } = useUserSettings();

    // ── Backup / restore state ──
    const [backupStatus, setBackupStatus] = useState<{ msg: string; kind: "ok" | "err" | "info" } | null>(null);
    const [backupBusy, setBackupBusy] = useState(false);

    // ── Danger zone ──
    const [confirmClear, setConfirmClear] = useState(false);

    // ── Backup ──
    async function backup() {
        try {
            setBackupBusy(true);
            setBackupStatus({ msg: "Preparing backup…", kind: "info" });
            const data = await exportCloudData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `ledgerly-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            setBackupStatus({ msg: "Backup downloaded successfully.", kind: "ok" });
        } catch (err: unknown) {
            setBackupStatus({ msg: err instanceof Error ? err.message : "Backup failed.", kind: "err" });
        } finally {
            setBackupBusy(false);
        }
    }

    // ── Restore ──
    async function restore(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setBackupBusy(true);
        setBackupStatus({ msg: "Importing backup…", kind: "info" });
        try {
            const text = await file.text();
            const json = JSON.parse(text);
            await importCloudData(json);
            setBackupStatus({ msg: "Backup restored. Your data is now up to date.", kind: "ok" });
        } catch (err: unknown) {
            setBackupStatus({ msg: err instanceof Error ? err.message : "Invalid backup file.", kind: "err" });
        } finally {
            setBackupBusy(false);
            e.target.value = "";
        }
    }

    // ── Export CSV placeholder ──
    function exportCSV() {
        setBackupStatus({ msg: "CSV export — coming soon.", kind: "info" });
        setTimeout(() => setBackupStatus(null), 3000);
    }

    // ── Clear all data ──
    async function clearAllData() {
        setConfirmClear(false);
        setBackupBusy(true);
        setBackupStatus({ msg: "Clearing data…", kind: "info" });
        try {
            await importCloudData({ expenses: [], recurring: [], salary: null });
            setBackupStatus({ msg: "All data cleared successfully.", kind: "ok" });
        } catch (err: unknown) {
            setBackupStatus({ msg: err instanceof Error ? err.message : "Clear failed.", kind: "err" });
        } finally {
            setBackupBusy(false);
        }
    }

    return (
        <div className="st-page">
            {/* ── Header ── */}
            <div className="st-header">
                <h1 className="st-title">Settings</h1>
                <p className="st-subtitle">
                    Manage your preferences, data, and account options.
                    {saving && <span style={{ marginLeft: "0.5rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>Saving…</span>}
                </p>
            </div>

            {/* ── Error from settings hook ── */}
            {settingsError && <div className="st-status err">{settingsError}</div>}

            {/* ── Backup/restore status ── */}
            {backupStatus && (
                <div className={`st-status ${backupStatus.kind}`}>{backupStatus.msg}</div>
            )}

            {/* ══════════════════════════════════════
                SECTION 1 — Display Preferences
               ══════════════════════════════════════ */}
            <section className="st-section">
                <div className="st-section-header">
                    <div className="st-section-icon" style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1" }}>🎨</div>
                    <h2 className="st-section-title">Display Preferences</h2>
                </div>

                {/* Currency */}
                <div className="st-row">
                    <div className="st-row-left">
                        <span className="st-row-label">Currency</span>
                        <span className="st-row-desc">Used for displaying all monetary values in the app.</span>
                    </div>
                    <select
                        className="st-select"
                        value={settings.currency}
                        disabled={loading}
                        onChange={e => update({ currency: e.target.value })}
                    >
                        <option value="PHP">🇵🇭 PHP — Philippine Peso</option>
                        <option value="USD">🇺🇸 USD — US Dollar</option>
                        <option value="EUR">🇪🇺 EUR — Euro</option>
                        <option value="GBP">🇬🇧 GBP — British Pound</option>
                        <option value="JPY">🇯🇵 JPY — Japanese Yen</option>
                        <option value="SGD">🇸🇬 SGD — Singapore Dollar</option>
                    </select>
                </div>

                {/* Date format */}
                <div className="st-row">
                    <div className="st-row-left">
                        <span className="st-row-label">Date Format</span>
                        <span className="st-row-desc">How dates are displayed across the app.</span>
                    </div>
                    <select
                        className="st-select"
                        value={settings.dateFmt}
                        disabled={loading}
                        onChange={e => update({ dateFmt: e.target.value })}
                    >
                        <option value="MMM D, YYYY">Feb 20, 2026</option>
                        <option value="DD/MM/YYYY">20/02/2026</option>
                        <option value="MM/DD/YYYY">02/20/2026</option>
                        <option value="YYYY-MM-DD">2026-02-20</option>
                    </select>
                </div>

                {/* Week start */}
                <div className="st-row">
                    <div className="st-row-left">
                        <span className="st-row-label">Week Starts On</span>
                        <span className="st-row-desc">Used in calendar and weekly summary views.</span>
                    </div>
                    <select
                        className="st-select"
                        value={settings.weekStart}
                        disabled={loading}
                        onChange={e => update({ weekStart: Number(e.target.value) })}
                    >
                        <option value="1">Monday</option>
                        <option value="0">Sunday</option>
                        <option value="6">Saturday</option>
                    </select>
                </div>

                {/* Compact numbers */}
                <div className="st-row">
                    <div className="st-row-left">
                        <span className="st-row-label">Compact Numbers</span>
                        <span className="st-row-desc">Show ₱1.2K instead of ₱1,200 in summaries.</span>
                    </div>
                    <Toggle checked={settings.compactNums} onChange={v => update({ compactNums: v })} />
                </div>

                {/* Show cents */}
                <div className="st-row">
                    <div className="st-row-left">
                        <span className="st-row-label">Show Cents</span>
                        <span className="st-row-desc">Display decimal places in amounts (e.g. ₱1,200.00 vs ₱1,200).</span>
                    </div>
                    <Toggle checked={settings.showCents} onChange={v => update({ showCents: v })} />
                </div>
            </section>

            {/* ══════════════════════════════════════
                SECTION 2 — Expense Defaults
               ══════════════════════════════════════ */}
            <section className="st-section">
                <div className="st-section-header">
                    <div className="st-section-icon" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>⚡</div>
                    <h2 className="st-section-title">Expense Defaults</h2>
                </div>

                <div className="st-row">
                    <div className="st-row-left">
                        <span className="st-row-label">Default Payment Method</span>
                        <span className="st-row-desc">Pre-selected when adding a new expense.</span>
                    </div>
                    <select
                        className="st-select"
                        value={settings.defaultPM}
                        disabled={loading}
                        onChange={e => update({ defaultPM: e.target.value })}
                    >
                        <option value="cash">💵 Cash</option>
                        <option value="gcash">📱 GCash</option>
                        <option value="card">💳 Card</option>
                        <option value="bank">🏦 Bank Transfer</option>
                        <option value="other">🔄 Other</option>
                    </select>
                </div>
            </section>

            {/* ══════════════════════════════════════
                SECTION 3 — Personalization
               ══════════════════════════════════════ */}
            <section className="st-section">
                <div className="st-section-header">
                    <div className="st-section-icon" style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1" }}>✨</div>
                    <h2 className="st-section-title">Personalization</h2>
                </div>

                {/* User Type */}
                <div className="st-row">
                    <div className="st-row-left">
                        <span className="st-row-label">I am a...</span>
                        <span className="st-row-desc">Helps us tailor your financial insights.</span>
                    </div>
                    <select
                        className="st-select"
                        value={settings.userType}
                        disabled={loading}
                        onChange={e => update({ userType: e.target.value as any })}
                    >
                        <option value="">Select profile...</option>
                        <option value="employee">Employee</option>
                        <option value="self-employed">Self-employed</option>
                        <option value="student">Student</option>
                        <option value="other">Other</option>
                    </select>
                </div>

                {/* Financial Goal */}
                <div className="st-row">
                    <div className="st-row-left">
                        <span className="st-row-label">Financial Goal</span>
                        <span className="st-row-desc">Affects which widgets are prioritized.</span>
                    </div>
                    <select
                        className="st-select"
                        value={settings.financialGoal}
                        disabled={loading}
                        onChange={e => update({ financialGoal: e.target.value as any })}
                    >
                        <option value="">Select goal...</option>
                        <option value="track">Track Spending</option>
                        <option value="save">Save Money</option>
                        <option value="debt">Manage Debt</option>
                        <option value="budget">Budgeting</option>
                    </select>
                </div>

                {/* Budget Style */}
                <div className="st-row">
                    <div className="st-row-left">
                        <span className="st-row-label">Budgeting Style</span>
                        <span className="st-row-desc">Controls dashboard layout and density.</span>
                    </div>
                    <select
                        className="st-select"
                        value={settings.budgetStyle}
                        disabled={loading}
                        onChange={e => update({ budgetStyle: e.target.value as any })}
                    >
                        <option value="">Select style...</option>
                        <option value="minimalist">Minimalist</option>
                        <option value="optimizer">The Optimizer</option>
                        <option value="goal-seeker">The Goal-Seeker</option>
                    </select>
                </div>
            </section>

            {/* ══════════════════════════════════════
                SECTION 4 — Data & Backup
               ══════════════════════════════════════ */}
            <section className="st-section">
                <div className="st-section-header">
                    <div className="st-section-icon" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>💾</div>
                    <h2 className="st-section-title">Data &amp; Backup</h2>
                </div>

                <div className="st-row">
                    <div className="st-row-left">
                        <span className="st-row-label">Download Backup</span>
                        <span className="st-row-desc">Export all your expenses, recurring items, and salary as a JSON file.</span>
                    </div>
                    <button className="st-action-btn accent" onClick={backup} disabled={backupBusy}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M12 3v13M7 11l5 5 5-5" /><path d="M5 21h14" />
                        </svg>
                        Backup JSON
                    </button>
                </div>

                <div className="st-row">
                    <div className="st-row-left">
                        <span className="st-row-label">Restore from Backup</span>
                        <span className="st-row-desc">Import a previously downloaded JSON backup. This will replace your current data.</span>
                    </div>
                    <label className="st-file-btn">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M12 21V8M7 13l5-5 5 5" /><path d="M5 3h14" />
                        </svg>
                        Restore JSON
                        <input type="file" accept="application/json" onChange={restore} disabled={backupBusy} />
                    </label>
                </div>

                <div className="st-row">
                    <div className="st-row-left">
                        <span className="st-row-label">Export as CSV</span>
                        <span className="st-row-desc">Download your expenses as a spreadsheet-compatible CSV file.</span>
                    </div>
                    <button className="st-action-btn" onClick={exportCSV} disabled={backupBusy}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
                        </svg>
                        Export CSV
                    </button>
                </div>
            </section>

            {/* ══════════════════════════════════════
                SECTION 5 — About
               ══════════════════════════════════════ */}
            <section className="st-section">
                <div className="st-section-header">
                    <div className="st-section-icon" style={{ background: "rgba(59,130,246,0.12)", color: "#3b82f6" }}>ℹ️</div>
                    <h2 className="st-section-title">About</h2>
                </div>

                <div className="st-row">
                    <div className="st-row-left">
                        <span className="st-row-label">Ledgerly</span>
                        <span className="st-row-desc">Your personal finance tracker — salary, expenses, subscriptions &amp; savings.</span>
                    </div>
                    <span className="st-badge">v0.1.0</span>
                </div>

                <div className="st-row">
                    <div className="st-row-left">
                        <span className="st-row-label">Data Storage</span>
                        <span className="st-row-desc">All data is stored securely in Supabase with row-level security. Settings sync across devices.</span>
                    </div>
                    <span className="st-badge" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>Supabase</span>
                </div>

                <div className="st-row">
                    <div className="st-row-left">
                        <span className="st-row-label">Built With</span>
                        <span className="st-row-desc">React · TypeScript · Vite · Supabase</span>
                    </div>
                    <span className="st-badge" style={{ background: "rgba(245,158,11,0.12)", color: "#d97706" }}>2026</span>
                </div>
            </section>

            {/* ══════════════════════════════════════
                SECTION 6 — Danger Zone
               ══════════════════════════════════════ */}
            <section className="st-section st-danger-section">
                <div className="st-section-header">
                    <div className="st-section-icon" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>⚠️</div>
                    <h2 className="st-section-title">Danger Zone</h2>
                </div>

                <div className="st-row">
                    <div className="st-row-left">
                        <span className="st-row-label">Clear All Data</span>
                        <span className="st-row-desc">Permanently delete all expenses, recurring items, and salary data from your account. This cannot be undone.</span>
                    </div>
                    <button className="st-action-btn danger" onClick={() => setConfirmClear(true)} disabled={backupBusy}>
                        🗑 Clear All
                    </button>
                </div>
            </section>

            {/* Confirm modal */}
            {confirmClear && (
                <ConfirmModal
                    title="Clear all data?"
                    body="This will permanently delete every expense, recurring item, subscription, and salary entry linked to your account. You cannot undo this. Make sure you have a backup first."
                    confirmLabel="Yes, clear everything"
                    danger
                    onConfirm={clearAllData}
                    onCancel={() => setConfirmClear(false)}
                />
            )}
        </div>
    );
}
