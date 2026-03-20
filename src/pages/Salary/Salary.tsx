import { useMemo, useState, useEffect } from "react";
import styles from "./Salary.module.css";
import { useExpenses } from "../../lib/useExpenses";
import { useSalaryProfile } from "../../lib/useSalaryProfile";
import { upsertSalaryProfile } from "../../lib/data";
import { useUserSettings } from "../../lib/useUserSettings";

/* ── Date helpers ── */
function isoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getCurrentCutoff(): { period: 1 | 2; start: Date; end: Date } {
    const today = new Date();
    const day = today.getDate();
    const year = today.getFullYear();
    const month = today.getMonth();
    if (day <= 15) {
        return { period: 1, start: new Date(year, month, 1), end: new Date(year, month, 15) };
    } else {
        const lastDay = new Date(year, month + 1, 0).getDate();
        return { period: 2, start: new Date(year, month, 16), end: new Date(year, month, lastDay) };
    }
}

function daysInCutoff(start: Date, end: Date): number {
    return end.getDate() - start.getDate() + 1;
}

function fmt(n: number) {
    return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseNum(s: string): number {
    const n = Number(s.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
}

type CutoffState = { gross: string; deductions: string };

/* ── Edit Modal ── */
type EditModalProps = {
    label: string;
    subtitle: string;
    accent: string;
    state: CutoffState;
    onClose: () => void;
    onSave: (s: CutoffState) => Promise<void>;
};

function EditModal({ label, subtitle, accent, state: initial, onClose, onSave }: EditModalProps) {
    const [form, setForm] = useState<CutoffState>(initial);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    const gross = parseNum(form.gross);
    const ded = parseNum(form.deductions);
    const net = Math.max(0, gross - ded);
    const isOverDeducted = ded > gross && gross > 0;

    async function handleSave() {
        setSaving(true);
        setMsg(null);
        try {
            await onSave(form);
            setMsg("Saved ✓");
            setTimeout(() => { setMsg(null); onClose(); }, 1000);
        } catch (err: unknown) {
            setMsg(err instanceof Error ? err.message : "Failed to save.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className={styles.modalBackdrop} onMouseDown={onClose} role="dialog" aria-modal="true">
            <div
                className={styles.modal}
                onMouseDown={(e) => e.stopPropagation()}
                style={{ "--modal-accent": accent } as React.CSSProperties}
            >
                <div className={styles.modalHeader}>
                    <div>
                        <div className={styles.modalTitle}>{label}</div>
                        <div className={styles.modalSub}>{subtitle}</div>
                    </div>
                    <button className={styles.closeBtn} type="button" onClick={onClose} aria-label="Close">✕</button>
                </div>

                <div className={styles.modalFields}>
                    <div className={styles.modalField}>
                        <label className={styles.fieldLabel}>Gross Pay</label>
                        <div className={styles.inputRow}>
                            <span className={styles.currency}>₱</span>
                            <input
                                className={styles.incomeInput}
                                inputMode="decimal"
                                placeholder="e.g. 15000"
                                value={form.gross}
                                onChange={(e) => setForm({ ...form, gross: e.target.value })}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className={styles.modalField}>
                        <label className={styles.fieldLabel}>
                            Deductions
                            <span className={styles.deductionHint}> (Tax, SSS, PhilHealth, Pag-IBIG…)</span>
                        </label>
                        <div className={styles.inputRow}>
                            <span className={styles.currency}>₱</span>
                            <input
                                className={`${styles.incomeInput} ${isOverDeducted ? styles.inputError : ""}`}
                                inputMode="decimal"
                                placeholder="e.g. 2500"
                                value={form.deductions}
                                onChange={(e) => setForm({ ...form, deductions: e.target.value })}
                            />
                        </div>
                        {isOverDeducted && <div className={styles.fieldError}>Deductions exceed gross pay</div>}
                    </div>
                </div>

                {gross > 0 && (
                    <div className={styles.modalNetPreview} style={{ color: accent }}>
                        Net pay: <strong>₱{fmt(net)}</strong>
                    </div>
                )}

                <div className={styles.modalActions}>
                    <button className={styles.ghostBtn} type="button" onClick={onClose}>Cancel</button>
                    <button
                        className={styles.primaryBtn}
                        type="button"
                        onClick={handleSave}
                        disabled={saving || isOverDeducted}
                    >
                        {saving ? "Saving…" : "Save"}
                    </button>
                    {msg && (
                        <span className={msg.includes("✓") ? styles.saveOk : styles.saveErr}>{msg}</span>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ── KPI Card ── */
type KpiCardProps = {
    label: string;
    subtitle: string;
    accent: string;
    net: number;
    isActive: boolean;
    onEdit: () => void;
};

function KpiCard({ label, subtitle, accent, net, isActive, onEdit }: KpiCardProps) {
    return (
        <div
            className={`${styles.kpiCard} ${isActive ? styles.kpiCardActive : ""}`}
            style={{ "--cutoff-accent": accent } as React.CSSProperties}
        >
            <div className={styles.kpiTop}>
                <div className={styles.kpiMeta}>
                    <div className={styles.kpiLabel}>
                        {label}
                        {isActive && <span className={styles.activePill}>Current</span>}
                    </div>
                    <div className={styles.kpiSub}>{subtitle}</div>
                </div>
                <button
                    className={styles.editBtn}
                    type="button"
                    onClick={onEdit}
                    aria-label={`Edit ${label}`}
                >
                    <PencilIcon />
                </button>
            </div>
            <div className={styles.kpiNetLabel}>Net Pay</div>
            <div className={styles.kpiNet} style={{ color: accent }}>
                {net > 0 ? `₱${fmt(net)}` : <span className={styles.kpiEmpty}>Not set — tap ✏️</span>}
            </div>
        </div>
    );
}

export default function Salary() {
    const { settings } = useUserSettings();
    const isStudent = settings.userType === "student";
    const incomeLabel = isStudent ? "Allowance" : "Salary";
    const incomeType = isStudent ? "allowance" : "income";

    const { expenses } = useExpenses();
    const { profile, error, refetch } = useSalaryProfile();

    const cutoffInfo = getCurrentCutoff();

    const [c1, setC1] = useState<CutoffState>({ gross: "", deductions: "" });
    const [c2, setC2] = useState<CutoffState>({ gross: "", deductions: "" });
    const [editingCutoff, setEditingCutoff] = useState<1 | 2 | null>(null);

    useEffect(() => {
        if (!profile) return;
        setC1({
            gross: profile.cutoff1Gross > 0 ? String(profile.cutoff1Gross) : "",
            deductions: profile.cutoff1Deductions > 0 ? String(profile.cutoff1Deductions) : "",
        });
        setC2({
            gross: profile.cutoff2Gross > 0 ? String(profile.cutoff2Gross) : "",
            deductions: profile.cutoff2Deductions > 0 ? String(profile.cutoff2Deductions) : "",
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile?.cutoff1Gross, profile?.cutoff1Deductions, profile?.cutoff2Gross, profile?.cutoff2Deductions]);

    const c1Net = Math.max(0, parseNum(c1.gross) - parseNum(c1.deductions));
    const c2Net = Math.max(0, parseNum(c2.gross) - parseNum(c2.deductions));
    const totalIncome = c1Net + c2Net;

    async function handleSaveCutoff(cutoff: 1 | 2, form: CutoffState) {
        const next1 = cutoff === 1 ? form : c1;
        const next2 = cutoff === 2 ? form : c2;
        await upsertSalaryProfile({
            cutoff1Gross: parseNum(next1.gross),
            cutoff1Deductions: parseNum(next1.deductions),
            cutoff2Gross: parseNum(next2.gross),
            cutoff2Deductions: parseNum(next2.deductions),
        });
        if (cutoff === 1) setC1(form);
        else setC2(form);
        await refetch();
    }

    /* ── Current period stats ── */
    const hasCutoffs = parseNum(c1.gross) > 0 || parseNum(c2.gross) > 0;
    const periodProfileIncome =
        cutoffInfo.period === 1 ? (profile?.cutoff1Net ?? 0) : (profile?.cutoff2Net ?? 0);
    const activePeriodIncome = hasCutoffs ? (cutoffInfo.period === 1 ? c1Net : c2Net) : periodProfileIncome;

    const { start: periodStart, end: periodEnd } = cutoffInfo;
    const periodStartISO = isoDate(periodStart);
    const periodEndISO = isoDate(periodEnd);

    const periodSpent = useMemo(() => {
        return expenses
            .filter(e => e.date >= periodStartISO && e.date <= periodEndISO)
            .reduce((s, e) => s + Number(e.amount || 0), 0);
    }, [expenses, periodStartISO, periodEndISO]);

    const periodRemaining = Math.max(0, activePeriodIncome - periodSpent);
    const periodSpentPct = activePeriodIncome > 0 ? (periodSpent / activePeriodIncome) * 100 : 0;

    const today = new Date();
    const daysElapsed = Math.max(1, today.getDate() - periodStart.getDate() + 1);
    const daysTotal = daysInCutoff(periodStart, periodEnd);
    const avgPerDay = periodSpent / daysElapsed;
    const projectedSpend = avgPerDay * daysTotal;
    const projectedSavings = activePeriodIncome > 0 ? activePeriodIncome - projectedSpend : 0;

    const periodLabel = cutoffInfo.period === 1 ? "1st Cutoff (1–15)" : "2nd Cutoff (16–end)";

    return (
        <div className={styles.salaryPage}>
            <div className={styles.pageHead}>
                <h1 className={styles.title}>{incomeLabel}</h1>
                <p className={styles.sub}>
                    {isStudent 
                        ? `Tap ✏️ on a ${incomeType} card to set your expected budget and any mandatory payments.`
                        : `Tap ✏️ on a cutoff card to set gross pay and deductions.`}
                </p>
                {error && <div className={styles.saveErr}>{error}</div>}
            </div>

            {/* ── Cutoff KPI Cards ── */}
            <div className={styles.kpiGrid}>
                <KpiCard
                    label={isStudent ? "1st Period" : "1st Cutoff"}
                    subtitle={isStudent ? "1st – 15th of the month" : "1st – 15th of the month"}
                    accent="#6366f1"
                    net={c1Net}
                    isActive={cutoffInfo.period === 1}
                    onEdit={() => setEditingCutoff(1)}
                />
                <KpiCard
                    label={isStudent ? "2nd Period" : "2nd Cutoff"}
                    subtitle={isStudent ? "16th – end of month" : "16th – end of month"}
                    accent="#8b5cf6"
                    net={c2Net}
                    isActive={cutoffInfo.period === 2}
                    onEdit={() => setEditingCutoff(2)}
                />
            </div>

            {/* ── Total monthly income (read-only) ── */}
            <div className={styles.totalCard}>
                <div className={styles.totalLabel}>Total Monthly {incomeLabel}</div>
                <div className={styles.totalValue}>
                    {totalIncome > 0 ? (
                        <>
                            <span className={styles.totalBreakdown}>
                                ₱{fmt(c1Net)} <span className={styles.op}>+</span> ₱{fmt(c2Net)}
                            </span>
                            <span className={styles.totalEqLine}>=</span>
                            <span className={styles.totalAmt}>₱{fmt(totalIncome)}</span>
                        </>
                    ) : (
                        <span className={styles.totalEmpty}>Set both {isStudent ? "periods" : "cutoffs"} to see total</span>
                    )}
                </div>
            </div>

            {/* ── Current period summary ── */}
            <div className={styles.salaryGrid}>
                <div className={styles.card}>
                    <div className={styles.periodPill}>
                        <span className={styles.periodDot} />
                        {periodLabel}
                    </div>
                    <div className={styles.cardTitle} style={{ marginTop: 10 }}>Current period spending</div>

                    <div className={styles.metrics}>
                        <div className={styles.metric}>
                            <div className={styles.k}>Spent</div>
                            <div className={styles.v}>₱{fmt(periodSpent)}</div>
                        </div>
                        <div className={styles.metric}>
                            <div className={styles.k}>{isStudent ? "Take-home" : "Net pay"}</div>
                            <div className={styles.v}>
                                {activePeriodIncome > 0 ? `₱${fmt(activePeriodIncome)}` : "—"}
                            </div>
                        </div>
                        <div className={styles.metric}>
                            <div className={styles.k}>Remaining</div>
                            <div className={styles.v}>
                                {activePeriodIncome > 0 ? `₱${fmt(periodRemaining)}` : "—"}
                            </div>
                        </div>
                    </div>

                    <div className={styles.progressWrap}>
                        <div className={styles.progressHead}>
                            <span className="muted">% spent</span>
                            <span className="muted">
                                {activePeriodIncome > 0 ? `${periodSpentPct.toFixed(0)}%` : "—"}
                                &nbsp;·&nbsp;day {daysElapsed}/{daysTotal}
                            </span>
                        </div>
                        <div className={styles.barTrack}>
                            <div
                                className={styles.barFill}
                                style={{ width: `${Math.min(100, periodSpentPct)}%` }}
                                aria-hidden="true"
                            />
                        </div>
                    </div>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardTitleRow}>
                        <div className={styles.cardTitle}>Burn rate</div>
                        <div className={styles.infoWrap}>
                            <button type="button" className={styles.infoBtn} aria-label="What is burn rate?">
                                <InfoIcon />
                            </button>
                            <div className={styles.tooltip}>
                                Average daily spending within the current {isStudent ? "period" : "cutoff period"}.
                                <br /><br />
                                Projection estimates total spend by end of this {isStudent ? "period" : "cutoff"} at current pace.
                            </div>
                        </div>
                    </div>
                    <div className={styles.bigStat}>₱{fmt(avgPerDay)} / day</div>
                    <div className="muted">Projection: ₱{projectedSpend.toFixed(0)} this period</div>
                    <div className="muted" style={{ marginTop: 6 }}>
                        Projected savings: {activePeriodIncome > 0 ? `₱${projectedSavings.toFixed(0)}` : "—"}
                    </div>
                </div>
            </div>

            {/* ── Edit Modal ── */}
            {editingCutoff !== null && (
                <EditModal
                    label={editingCutoff === 1 ? (isStudent ? "1st Period" : "1st Cutoff") : (isStudent ? "2nd Period" : "2nd Cutoff")}
                    subtitle={editingCutoff === 1 ? "1st – 15th of the month" : "16th – end of month"}
                    accent={editingCutoff === 1 ? "#6366f1" : "#8b5cf6"}
                    state={editingCutoff === 1 ? c1 : c2}
                    onClose={() => setEditingCutoff(null)}
                    onSave={(form) => handleSaveCutoff(editingCutoff, form)}
                />
            )}
        </div>
    );
}

function PencilIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="presentation">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
    );
}

function InfoIcon() {
    return (
        <svg viewBox="0 0 24 24" role="presentation" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="10.5" x2="12" y2="16" />
            <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
        </svg>
    );
}
