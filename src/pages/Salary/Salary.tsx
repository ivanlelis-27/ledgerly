import { useMemo, useState, useEffect } from "react";
import styles from "./Salary.module.css";
import { useExpenses } from "../../lib/useExpenses";
import { useSalaryProfile } from "../../lib/useSalaryProfile";
import { upsertSalaryProfile } from "../../lib/data";
import { useUserSettings } from "../../lib/useUserSettings";
import type { IncomeFrequency } from "../../types/salary";

/* ── Date helpers ── */
function isoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmt(n: number) {
    return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseNum(s: string): number {
    const n = Number(s.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
}

type CutoffState = { gross: string; deductions: string };

const FREQUENCIES: { label: string; value: IncomeFrequency }[] = [
    { label: "Weekly", value: "weekly" },
    { label: "Bi-weekly", value: "bi-weekly" },
    { label: "Monthly", value: "monthly" },
];

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
                        <label className={styles.fieldLabel}>{label} Amount</label>
                        <div className={styles.inputRow}>
                            <span className={styles.currency}>₱</span>
                            <input
                                className={styles.incomeInput}
                                inputMode="decimal"
                                placeholder="e.g. 5000"
                                value={form.gross}
                                onChange={(e) => setForm({ ...form, gross: e.target.value })}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className={styles.modalField}>
                        <label className={styles.fieldLabel}>
                            {subtitle.includes("Period") ? "Allocations" : "Deductions"}
                            <span className={styles.deductionHint}> 
                                {subtitle.includes("Period") ? " (Savings, Tuition, Bills…)" : " (Tax, SSS, PhilHealth…)"}
                            </span>
                        </label>
                        <div className={styles.inputRow}>
                            <span className={styles.currency}>₱</span>
                            <input
                                className={`${styles.incomeInput} ${isOverDeducted ? styles.inputError : ""}`}
                                inputMode="decimal"
                                placeholder="e.g. 500"
                                value={form.deductions}
                                onChange={(e) => setForm({ ...form, deductions: e.target.value })}
                            />
                        </div>
                        {isOverDeducted && <div className={styles.fieldError}>Deductions exceed amount</div>}
                    </div>
                </div>

                {gross > 0 && (
                    <div className={styles.modalNetPreview} style={{ color: accent }}>
                        {subtitle.includes("Period") ? "Disposable allowance:" : "Net pay:"} <strong>₱{fmt(net)}</strong>
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
            <div className={styles.kpiNetLabel}>{subtitle.includes("Period") ? "Take-home" : "Net Pay"}</div>
            <div className={styles.kpiNet} style={{ color: accent }}>
                {net > 0 ? `₱${fmt(net)}` : <span className={styles.kpiEmpty}>Not set — tap ✏️</span>}
            </div>
        </div>
    );
}

export default function Salary() {
    const { expenses } = useExpenses();
    const { profile, error, refetch } = useSalaryProfile();
    const { settings } = useUserSettings();
    const isStudent = settings.userType === "student";
    const incomeLabel = isStudent ? "Allowance" : "Salary";
    const incomeType = isStudent ? "allowance" : "income";

    const today = useMemo(() => new Date(), []);
    const day = today.getDate();
    const year = today.getFullYear();
    const month = today.getMonth();

    const [c1, setC1] = useState<CutoffState>({ gross: "", deductions: "" });
    const [c2, setC2] = useState<CutoffState>({ gross: "", deductions: "" });
    const [c3, setC3] = useState<CutoffState>({ gross: "", deductions: "" });
    const [c4, setC4] = useState<CutoffState>({ gross: "", deductions: "" });
    const [source, setSource] = useState("");
    const [frequency, setFrequency] = useState<IncomeFrequency>("bi-weekly");
    const [editingCutoff, setEditingCutoff] = useState<1 | 2 | 3 | 4 | null>(null);

    useEffect(() => {
        if (!profile) return;
        setSource(profile.source || (isStudent ? "Parents" : "Salary"));
        setFrequency(profile.frequency || "bi-weekly");
        setC1({
            gross: profile.cutoff1Gross > 0 ? String(profile.cutoff1Gross) : "",
            deductions: profile.cutoff1Deductions > 0 ? String(profile.cutoff1Deductions) : "",
        });
        setC2({
            gross: profile.cutoff2Gross > 0 ? String(profile.cutoff2Gross) : "",
            deductions: profile.cutoff2Deductions > 0 ? String(profile.cutoff2Deductions) : "",
        });
        setC3({
            gross: profile.cutoff3Gross > 0 ? String(profile.cutoff3Gross) : "",
            deductions: profile.cutoff3Deductions > 0 ? String(profile.cutoff3Deductions) : "",
        });
        setC4({
            gross: profile.cutoff4Gross > 0 ? String(profile.cutoff4Gross) : "",
            deductions: profile.cutoff4Deductions > 0 ? String(profile.cutoff4Deductions) : "",
        });
    }, [profile, isStudent]);

    const c1Net = Math.max(0, parseNum(c1.gross) - parseNum(c1.deductions));
    const c2Net = Math.max(0, parseNum(c2.gross) - parseNum(c2.deductions));
    const c3Net = Math.max(0, parseNum(c3.gross) - parseNum(c3.deductions));
    const c4Net = Math.max(0, parseNum(c4.gross) - parseNum(c4.deductions));

    const totalIncome = useMemo(() => {
        if (frequency === "monthly") return c1Net;
        if (frequency === "bi-weekly") return c1Net + c2Net;
        return c1Net + c2Net + c3Net + c4Net;
    }, [frequency, c1Net, c2Net, c3Net, c4Net]);

    const { activeNet, currentPeriodLabel, periodStartISO, periodEndISO, daysElapsed, daysTotal } = useMemo(() => {
        let label = "Period";
        let net = 0;
        let startD = 1;
        let endD = 30;

        if (frequency === "monthly") {
            label = "Monthly";
            net = c1Net;
            startD = 1;
            endD = new Date(year, month + 1, 0).getDate();
        } else if (frequency === "bi-weekly") {
            const isFirst = day <= 15;
            label = isFirst ? (isStudent ? "1st Period" : "1st Cutoff") : (isStudent ? "2nd Period" : "2nd Cutoff");
            net = isFirst ? c1Net : c2Net;
            startD = isFirst ? 1 : 16;
            endD = isFirst ? 15 : new Date(year, month + 1, 0).getDate();
        } else if (frequency === "weekly") {
            const week = Math.ceil(day / 7);
            label = `Week ${week}`;
            if (week === 1) { net = c1Net; startD = 1; endD = 7; }
            else if (week === 2) { net = c2Net; startD = 8; endD = 14; }
            else if (week === 3) { net = c3Net; startD = 15; endD = 21; }
            else { net = c4Net; startD = 22; endD = new Date(year, month + 1, 0).getDate(); }
        }

        const elapsed = Math.max(1, day - startD + 1);
        const total = endD - startD + 1;

        return {
            activeNet: net,
            currentPeriodLabel: label,
            periodStartISO: isoDate(new Date(year, month, startD)),
            periodEndISO: isoDate(new Date(year, month, endD)),
            daysElapsed: elapsed,
            daysTotal: total
        };
    }, [frequency, day, year, month, c1Net, c2Net, c3Net, c4Net, isStudent]);

    const periodSpent = useMemo(() => {
        return expenses
            .filter(e => e.date >= periodStartISO && e.date <= periodEndISO)
            .reduce((s, e) => s + Number(e.amount || 0), 0);
    }, [expenses, periodStartISO, periodEndISO]);

    const avgPerDay = periodSpent / daysElapsed;
    const projectedSpend = avgPerDay * daysTotal;
    const projectedSavings = activeNet > 0 ? activeNet - projectedSpend : 0;
    const periodSpentPct = activeNet > 0 ? (periodSpent / activeNet) * 100 : 0;

    async function handleSaveCutoff(cutoff: 1 | 2 | 3 | 4, form: CutoffState) {
        const next1 = cutoff === 1 ? form : c1;
        const next2 = cutoff === 2 ? form : c2;
        const next3 = cutoff === 3 ? form : c3;
        const next4 = cutoff === 4 ? form : c4;
        await upsertSalaryProfile({
            frequency,
            source,
            cutoff1Gross: parseNum(next1.gross),
            cutoff1Deductions: parseNum(next1.deductions),
            cutoff2Gross: parseNum(next2.gross),
            cutoff2Deductions: parseNum(next2.deductions),
            cutoff3Gross: parseNum(next3.gross),
            cutoff3Deductions: parseNum(next3.deductions),
            cutoff4Gross: parseNum(next4.gross),
            cutoff4Deductions: parseNum(next4.deductions),
        });
        if (cutoff === 1) setC1(form);
        else if (cutoff === 2) setC2(form);
        else if (cutoff === 3) setC3(form);
        else setC4(form);
        await refetch();
    }

    async function handleUpdateMeta(update: { frequency?: IncomeFrequency; source?: string }) {
        const nextFreq = update.frequency ?? frequency;
        const nextSource = update.source ?? source;
        setFrequency(nextFreq);
        setSource(nextSource);
        await upsertSalaryProfile({
            frequency: nextFreq,
            source: nextSource,
            cutoff1Gross: parseNum(c1.gross),
            cutoff1Deductions: parseNum(c1.deductions),
            cutoff2Gross: parseNum(c2.gross),
            cutoff2Deductions: parseNum(c2.deductions),
            cutoff3Gross: parseNum(c3.gross),
            cutoff3Deductions: parseNum(c3.deductions),
            cutoff4Gross: parseNum(c4.gross),
            cutoff4Deductions: parseNum(c4.deductions),
        });
        await refetch();
    }

    return (
        <div className={styles.salaryPage}>
            <div className={styles.pageHead}>
                <h1 className={styles.title}>{incomeLabel}</h1>
                <p className={styles.sub}>
                    Customize how you receive your {incomeType} to track spending periods more effectively.
                </p>
                {error && <div className={styles.saveErr}>{error}</div>}
            </div>

            <div className={styles.metaRow}>
                <div className={styles.metaField}>
                    <label className={styles.metaLabel}>{isStudent ? "Source Name" : "Income Source"}</label>
                    <input 
                        className={styles.metaInput}
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        onBlur={() => handleUpdateMeta({ source })}
                        placeholder={isStudent ? "e.g. Parents, Scholarship" : "e.g. My Company"}
                    />
                </div>
                <div className={styles.metaField}>
                    <label className={styles.metaLabel}>Frequency</label>
                    <div className={styles.frequencyTabs}>
                        {FREQUENCIES.map(f => (
                            <button
                                key={f.value}
                                className={`${styles.freqTab} ${frequency === f.value ? styles.freqTabActive : ""}`}
                                onClick={() => handleUpdateMeta({ frequency: f.value })}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Dynamic Period KPI Cards ── */}
            <div className={styles.kpiGrid}>
                {(frequency === "monthly" || frequency === "bi-weekly" || frequency === "weekly") && (
                    <KpiCard
                        label={frequency === "monthly" ? "Full Month" : (frequency === "weekly" ? "Week 1" : (isStudent ? "1st Period" : "1st Cutoff"))}
                        subtitle={frequency === "weekly" ? "1st – 7th" : (frequency === "monthly" ? "Full month budget" : "1st – 15th")}
                        accent="#6366f1"
                        net={c1Net}
                        isActive={frequency === "monthly" || (frequency === "bi-weekly" && day <= 15) || (frequency === "weekly" && day <= 7)}
                        onEdit={() => setEditingCutoff(1)}
                    />
                )}
                {(frequency === "bi-weekly" || frequency === "weekly") && (
                    <KpiCard
                        label={frequency === "weekly" ? "Week 2" : (isStudent ? "2nd Period" : "2nd Cutoff")}
                        subtitle={frequency === "weekly" ? "8th – 14th" : "16th – end of month"}
                        accent="#8b5cf6"
                        net={c2Net}
                        isActive={(frequency === "bi-weekly" && day > 15) || (frequency === "weekly" && day > 7 && day <= 14)}
                        onEdit={() => setEditingCutoff(2)}
                    />
                )}
                {frequency === "weekly" && (
                    <>
                        <KpiCard
                            label="Week 3"
                            subtitle="15th – 21st"
                            accent="#ec4899"
                            net={c3Net}
                            isActive={day > 14 && day <= 21}
                            onEdit={() => setEditingCutoff(3)}
                        />
                        <KpiCard
                            label="Week 4"
                            subtitle="22nd – end"
                            accent="#f59e0b"
                            net={c4Net}
                            isActive={day > 21}
                            onEdit={() => setEditingCutoff(4)}
                        />
                    </>
                )}
            </div>

            {/* ── Total monthly income (read-only) ── */}
            <div className={styles.totalCard}>
                <div className={styles.totalLabel}>Total Monthly {incomeLabel}</div>
                <div className={styles.totalValue}>
                    {totalIncome > 0 ? (
                        <>
                            <span className={styles.totalBreakdown}>
                                {frequency === "weekly" ? (
                                    <>₱{fmt(c1Net)} + ₱{fmt(c2Net)} + ₱{fmt(c3Net)} + ₱{fmt(c4Net)}</>
                                ) : frequency === "bi-weekly" ? (
                                    <>₱{fmt(c1Net)} + ₱{fmt(c2Net)}</>
                                ) : (
                                    <>₱{fmt(c1Net)}</>
                                )}
                            </span>
                            <span className={styles.totalEqLine}>=</span>
                            <span className={styles.totalAmt}>₱{fmt(totalIncome)}</span>
                        </>
                    ) : (
                        <span className={styles.totalEmpty}>Set your {incomeType} to see total</span>
                    )}
                </div>
            </div>

            {/* ── Current period summary ── */}
            <div className={styles.salaryGrid}>
                <div className={styles.card}>
                    <div className={styles.periodPill}>
                        <span className={styles.periodDot} />
                        {currentPeriodLabel}
                    </div>
                    <div className={styles.cardTitle} style={{ marginTop: 10 }}>Current {isStudent ? "period budget" : "cutoff summary"}</div>

                    <div className={styles.metrics}>
                        <div className={styles.metric}>
                            <div className={styles.k}>Spent</div>
                            <div className={styles.v}>₱{fmt(periodSpent)}</div>
                        </div>
                        <div className={styles.metric}>
                            <div className={styles.k}>{isStudent ? "Take-home" : "Net pay"}</div>
                            <div className={styles.v}>
                                {activeNet > 0 ? `₱${fmt(activeNet)}` : "—"}
                            </div>
                        </div>
                        <div className={styles.metric}>
                            <div className={styles.k}>Remaining</div>
                            <div className={styles.v}>
                                {activeNet > 0 ? `₱${fmt(Math.max(0, activeNet - periodSpent))}` : "—"}
                            </div>
                        </div>
                    </div>

                    <div className={styles.progressWrap}>
                        <div className={styles.progressHead}>
                            <span className="muted">% spent</span>
                            <span className="muted">
                                {activeNet > 0 ? `${periodSpentPct.toFixed(0)}%` : "—"}
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
                                Average daily spending within the current tracking period.
                                <br /><br />
                                Projection estimates total spend by end of this period at current pace.
                            </div>
                        </div>
                    </div>
                    <div className={styles.bigStat}>₱{fmt(avgPerDay)} / day</div>
                    <div className="muted">Projection: ₱{projectedSpend.toFixed(0)} this period</div>
                    <div className="muted" style={{ marginTop: 6 }}>
                        Projected savings: {activeNet > 0 ? `₱${projectedSavings.toFixed(0)}` : "—"}
                    </div>
                </div>
            </div>

             {/* ── Edit Modal ── */}
            {editingCutoff !== null && (
                <EditModal
                    label={
                        frequency === "weekly" ? `Week ${editingCutoff}` :
                        frequency === "bi-weekly" ? (editingCutoff === 1 ? (isStudent ? "1st Period" : "1st Cutoff") : (isStudent ? "2nd Period" : "2nd Cutoff")) :
                        "Full Month"
                    }
                    subtitle={
                        frequency === "weekly" ? (["1st – 7th", "8th – 14th", "15th – 21st", "22nd – end"][editingCutoff - 1]) :
                        frequency === "monthly" ? "Monthly budget" :
                        (editingCutoff === 1 ? "1st – 15th" : "16th – end")
                    }
                    accent={
                        editingCutoff === 1 ? "#6366f1" : 
                        editingCutoff === 2 ? "#8b5cf6" : 
                        editingCutoff === 3 ? "#ec4899" : "#f59e0b"
                    }
                    state={
                        editingCutoff === 1 ? c1 : 
                        editingCutoff === 2 ? c2 : 
                        editingCutoff === 3 ? c3 : c4
                    }
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
