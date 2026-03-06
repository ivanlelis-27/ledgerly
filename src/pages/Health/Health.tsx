import { useMemo } from "react";
import { useExpenses } from "../../lib/useExpenses";
import { useRecurringItems } from "../../lib/useRecurringItems";
import { useSalaryProfile } from "../../lib/useSalaryProfile";
import { useSavings } from "../../lib/useSavings";
import { monthlyEquivalent } from "../../lib/recurring";
import "./Health.css";

// ─── Formatting ──────────────────────────────────────────────
const PHP = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
function fmt(n: number) { return PHP.format(n); }
function pct(n: number) { return `${n.toFixed(1)}%`; }

// ─── Local date helpers ──────────────────────────────────────
function localIso(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function monthStart() {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function threeMonthsAgo() {
    const d = new Date(); d.setMonth(d.getMonth() - 3); return localIso(d);
}
function prevMonthStart() {
    const d = new Date(); return localIso(new Date(d.getFullYear(), d.getMonth() - 1, 1));
}
function prevMonthEnd() {
    const d = new Date(); return localIso(new Date(d.getFullYear(), d.getMonth(), 0));
}

// ─── Score engine ────────────────────────────────────────────
type ComponentScore = {
    id: string;
    name: string;
    icon: string;
    pts: number;
    maxPts: number;
    pct: number;         // percentage of max scored
    detail: string;
    chipLevel: "great" | "good" | "ok" | "poor";
    chipLabel: string;
    color: string;
};

type HealthScore = {
    total: number;
    grade: string;
    gradeColor: string;
    verdict: string;
    verdictSub: string;
    components: ComponentScore[];
    // key metrics for the metrics row
    savingsRate: number;
    expenseRatio: number;
    subscriptionBurden: number;
    monthlyIncome: number;
    monthlySurplus: number;
    monthlyRecurring: number;
    monthlyExpenses: number;
};

function scoreColor(total: number): string {
    if (total >= 80) return "#10b981";
    if (total >= 60) return "#6366f1";
    if (total >= 40) return "#f59e0b";
    if (total >= 20) return "#ef4444";
    return "#dc2626";
}

function gradeFor(total: number): string {
    if (total >= 90) return "A+";
    if (total >= 80) return "A";
    if (total >= 70) return "B+";
    if (total >= 60) return "B";
    if (total >= 50) return "C";
    if (total >= 35) return "D";
    return "F";
}

function verdictFor(total: number): [string, string] {
    if (total >= 80) return ["Excellent Financial Health 🌟", "You're in great shape. Your saving habits and spending discipline put you well ahead of most people. Keep it up."];
    if (total >= 60) return ["Good Financial Standing 👍", "You've got a solid foundation. A few targeted improvements can push you into excellent territory."];
    if (total >= 40) return ["Fair — Room to Improve ⚡", "You're managing, but there are meaningful gaps. Addressing subscriptions or savings rate will have the biggest impact."];
    if (total >= 20) return ["Needs Attention ⚠️", "Several areas of your finances need work. Start with your savings rate and subscription burden for quick wins."];
    return ["Critical — Take Action Now 🚨", "Your finances are under significant stress. Focus first on reducing committed expenses and building any savings buffer."];
}

function computeScore(
    monthlyIncome: number,
    currentMonthExpenses: number,
    monthlyRecurring: number,
    prevMonthExpenses: number,
    goals: Array<{ currentAmount: number; targetAmount: number; status: string }>,
    hasAtLeast3MonthsData: boolean
): HealthScore {
    const totalCommitted = currentMonthExpenses + monthlyRecurring;
    const monthlySurplus = monthlyIncome - totalCommitted;
    const savingsRate = monthlyIncome > 0 ? (monthlySurplus / monthlyIncome) * 100 : -100;
    const expenseRatio = monthlyIncome > 0 ? (totalCommitted / monthlyIncome) * 100 : 100;
    const subBurden = monthlyIncome > 0 ? (monthlyRecurring / monthlyIncome) * 100 : 100;

    // ── 1. Savings Rate (0–25 pts) ──────────────────────────
    let savPts = 0;
    let savDetail = "";
    let savChip: "great" | "good" | "ok" | "poor" = "poor";
    let savChipLabel = "";
    if (savingsRate >= 25) { savPts = 25; savDetail = `Saving ${pct(savingsRate)} of income — above the 20% golden rule.`; savChip = "great"; savChipLabel = "Excellent"; }
    else if (savingsRate >= 20) { savPts = 22; savDetail = `Saving ${pct(savingsRate)} — right at the 20% benchmark.`; savChip = "great"; savChipLabel = "On Target"; }
    else if (savingsRate >= 15) { savPts = 17; savDetail = `Saving ${pct(savingsRate)} — solid, but aim for 20%.`; savChip = "good"; savChipLabel = "Good"; }
    else if (savingsRate >= 10) { savPts = 12; savDetail = `Saving ${pct(savingsRate)} — improving. Target 20%.`; savChip = "ok"; savChipLabel = "Developing"; }
    else if (savingsRate >= 5) { savPts = 6; savDetail = `Saving ${pct(savingsRate)} — very thin margin.`; savChip = "ok"; savChipLabel = "Low"; }
    else if (savingsRate >= 0) { savPts = 2; savDetail = `Barely saving anything. Expenses nearly match income.`; savChip = "poor"; savChipLabel = "Critical"; }
    else { savPts = 0; savDetail = `Spending more than you earn. Deficit of ${fmt(Math.abs(monthlySurplus))}/mo.`; savChip = "poor"; savChipLabel = "Deficit"; }

    // ── 2. Expense Ratio (0–25 pts) ─────────────────────────
    let expPts = 0;
    let expDetail = "";
    let expChip: "great" | "good" | "ok" | "poor" = "poor";
    let expChipLabel = "";
    if (expenseRatio <= 50) { expPts = 25; expDetail = `Spending ${pct(expenseRatio)} — excellent control.`; expChip = "great"; expChipLabel = "Excellent"; }
    else if (expenseRatio <= 60) { expPts = 20; expDetail = `Spending ${pct(expenseRatio)} — well-managed.`; expChip = "good"; expChipLabel = "Good"; }
    else if (expenseRatio <= 70) { expPts = 15; expDetail = `Spending ${pct(expenseRatio)} — acceptable range.`; expChip = "good"; expChipLabel = "Moderate"; }
    else if (expenseRatio <= 80) { expPts = 9; expDetail = `Spending ${pct(expenseRatio)} — tight budget.`; expChip = "ok"; expChipLabel = "Tight"; }
    else if (expenseRatio <= 90) { expPts = 5; expDetail = `Spending ${pct(expenseRatio)} — little room left.`; expChip = "ok"; expChipLabel = "Strained"; }
    else { expPts = 0; expDetail = `Spending ${pct(expenseRatio)} — expenses exceed safe thresholds.`; expChip = "poor"; expChipLabel = "Overextended"; }

    // ── 3. Subscription Burden (0–20 pts) ───────────────────
    let subPts = 0;
    let subDetail = "";
    let subChip: "great" | "good" | "ok" | "poor" = "poor";
    let subChipLabel = "";
    if (subBurden <= 8) { subPts = 20; subDetail = `Recurring costs are ${pct(subBurden)} of income — lean and healthy.`; subChip = "great"; subChipLabel = "Lean"; }
    else if (subBurden <= 12) { subPts = 16; subDetail = `Recurring ${pct(subBurden)} — manageable.`; subChip = "good"; subChipLabel = "Manageable"; }
    else if (subBurden <= 18) { subPts = 10; subDetail = `Recurring ${pct(subBurden)} — starting to pile up.`; subChip = "ok"; subChipLabel = "Notable"; }
    else if (subBurden <= 25) { subPts = 5; subDetail = `Recurring ${pct(subBurden)} — high subscription weight.`; subChip = "ok"; subChipLabel = "Heavy"; }
    else { subPts = 0; subDetail = `Recurring ${pct(subBurden)} — subscriptions are a major drag.`; subChip = "poor"; subChipLabel = "Overloaded"; }

    // ── 4. Savings Goals Progress (0–15 pts) ────────────────
    const activeGoals = goals.filter(g => g.status !== "completed" || g.currentAmount < g.targetAmount);
    const completedGoals = goals.filter(g => g.status === "completed" || g.currentAmount >= g.targetAmount);
    const avgProgress = activeGoals.length > 0
        ? activeGoals.reduce((s, g) => s + (g.targetAmount > 0 ? g.currentAmount / g.targetAmount : 0), 0) / activeGoals.length * 100
        : 0;
    let goalPts = 0;
    let goalDetail = "";
    let goalChip: "great" | "good" | "ok" | "poor" = "poor";
    let goalChipLabel = "";
    if (goals.length === 0) {
        goalPts = 0;
        goalDetail = "No savings goals set. Goals keep you motivated.";
        goalChip = "poor"; goalChipLabel = "No Goals";
    } else if (completedGoals.length > 0) {
        goalPts = 15;
        goalDetail = `${completedGoals.length} goal${completedGoals.length > 1 ? "s" : ""} completed. Outstanding discipline.`;
        goalChip = "great"; goalChipLabel = "Crushing It";
    } else if (avgProgress >= 30) {
        goalPts = 12;
        goalDetail = `${activeGoals.length} active goal${activeGoals.length > 1 ? "s" : ""} — avg ${pct(avgProgress)} complete.`;
        goalChip = "great"; goalChipLabel = "On Track";
    } else if (avgProgress >= 10) {
        goalPts = 8;
        goalDetail = `${activeGoals.length} goal${activeGoals.length > 1 ? "s" : ""} in progress — avg ${pct(avgProgress)}.`;
        goalChip = "good"; goalChipLabel = "In Progress";
    } else {
        goalPts = 4;
        goalDetail = `Goals exist but barely started. Keep adding deposits.`;
        goalChip = "ok"; goalChipLabel = "Just Started";
    }

    // ── 5. Spending Consistency (0–15 pts) ──────────────────
    let consPts = 0;
    let consDetail = "";
    let consChip: "great" | "good" | "ok" | "poor" = "poor";
    let consChipLabel = "";
    if (!hasAtLeast3MonthsData || currentMonthExpenses === 0) {
        consPts = 7; // neutral — not enough data
        consDetail = "Not enough history yet. Keep logging expenses for a more accurate score.";
        consChip = "ok"; consChipLabel = "Insufficient Data";
    } else {
        const variance = prevMonthExpenses > 0
            ? Math.abs(currentMonthExpenses - prevMonthExpenses) / prevMonthExpenses * 100
            : 50;
        if (variance <= 10) { consPts = 15; consDetail = `Month-to-month variance: ${pct(variance)} — very consistent.`; consChip = "great"; consChipLabel = "Consistent"; }
        else if (variance <= 20) { consPts = 12; consDetail = `Variance ${pct(variance)} — mostly predictable.`; consChip = "good"; consChipLabel = "Stable"; }
        else if (variance <= 35) { consPts = 8; consDetail = `Variance ${pct(variance)} — somewhat erratic spending.`; consChip = "ok"; consChipLabel = "Variable"; }
        else if (variance <= 60) { consPts = 4; consDetail = `Variance ${pct(variance)} — spending changes a lot month to month.`; consChip = "ok"; consChipLabel = "Volatile"; }
        else { consPts = 0; consDetail = `Variance ${pct(variance)} — very unpredictable spending pattern.`; consChip = "poor"; consChipLabel = "Erratic"; }
    }

    const total = savPts + expPts + subPts + goalPts + consPts;
    const color = scoreColor(total);
    const [verdict, verdictSub] = verdictFor(total);

    const components: ComponentScore[] = [
        { id: "savings", name: "Savings Rate", icon: "💰", pts: savPts, maxPts: 25, pct: savPts / 25 * 100, detail: savDetail, chipLevel: savChip, chipLabel: savChipLabel, color: "#6366f1" },
        { id: "expense", name: "Expense Control", icon: "🧾", pts: expPts, maxPts: 25, pct: expPts / 25 * 100, detail: expDetail, chipLevel: expChip, chipLabel: expChipLabel, color: "#10b981" },
        { id: "subs", name: "Subscription Load", icon: "🔄", pts: subPts, maxPts: 20, pct: subPts / 20 * 100, detail: subDetail, chipLevel: subChip, chipLabel: subChipLabel, color: "#f59e0b" },
        { id: "goals", name: "Savings Goals", icon: "🎯", pts: goalPts, maxPts: 15, pct: goalPts / 15 * 100, detail: goalDetail, chipLevel: goalChip, chipLabel: goalChipLabel, color: "#ec4899" },
        { id: "consist", name: "Consistency", icon: "📊", pts: consPts, maxPts: 15, pct: consPts / 15 * 100, detail: consDetail, chipLevel: consChip, chipLabel: consChipLabel, color: "#3b82f6" },
    ];

    return {
        total,
        grade: gradeFor(total),
        gradeColor: color,
        verdict,
        verdictSub,
        components,
        savingsRate,
        expenseRatio,
        subscriptionBurden: subBurden,
        monthlyIncome,
        monthlySurplus,
        monthlyRecurring,
        monthlyExpenses: currentMonthExpenses,
    };
}

// ─── Recommendations engine ──────────────────────────────────
type Rec = { icon: string; title: string; desc: string; bg: string; iconBg: string };

function buildRecs(score: HealthScore): Rec[] {
    const recs: Rec[] = [];
    const sorted = [...score.components].sort((a, b) => a.pct - b.pct);
    const worst = sorted.slice(0, 3);

    for (const c of worst) {
        if (c.id === "savings" && score.savingsRate < 20) {
            recs.push({
                icon: "💡",
                title: "Boost your savings rate",
                desc: `You're saving ${pct(score.savingsRate)} — aim for 20%. Even moving ${fmt(score.monthlyIncome * 0.05)}/mo more to savings makes a big difference.`,
                bg: "rgba(99,102,241,0.07)", iconBg: "rgba(99,102,241,0.15)",
            });
        }
        if (c.id === "expense" && score.expenseRatio > 70) {
            recs.push({
                icon: "✂️",
                title: "Trim your spending",
                desc: `${pct(score.expenseRatio)} of your income goes to expenses. Try the What-If Simulator to identify which categories to cut first.`,
                bg: "rgba(16,185,129,0.07)", iconBg: "rgba(16,185,129,0.15)",
            });
        }
        if (c.id === "subs" && score.subscriptionBurden > 12) {
            recs.push({
                icon: "🔍",
                title: "Audit your subscriptions",
                desc: `Your recurring costs are ${pct(score.subscriptionBurden)} of income. Review each subscription in the Recurring page and cut ones you underuse.`,
                bg: "rgba(245,158,11,0.07)", iconBg: "rgba(245,158,11,0.15)",
            });
        }
        if (c.id === "goals" && score.components.find(x => x.id === "goals")!.pts < 10) {
            recs.push({
                icon: "🎯",
                title: "Set or fund savings goals",
                desc: "Goals turn vague intentions into trackable milestones. Open the Savings page to create a goal — even a small emergency fund changes your financial outlook.",
                bg: "rgba(236,72,153,0.07)", iconBg: "rgba(236,72,153,0.15)",
            });
        }
        if (c.id === "consist" && score.components.find(x => x.id === "consist")!.pts < 10) {
            recs.push({
                icon: "📅",
                title: "Stabilise your monthly spending",
                desc: "Large month-to-month swings make planning hard. Try setting category budgets and tracking discretionary spends more closely.",
                bg: "rgba(59,130,246,0.07)", iconBg: "rgba(59,130,246,0.15)",
            });
        }
    }

    // Fallback positive rec if score is high
    if (recs.length === 0 || score.total >= 75) {
        recs.unshift({
            icon: "🚀",
            title: "Consider investing your surplus",
            desc: `You have ${fmt(score.monthlySurplus)}/mo left over. Once your emergency fund is set, consider putting excess into index funds or time deposits.`,
            bg: "rgba(16,185,129,0.07)", iconBg: "rgba(16,185,129,0.15)",
        });
    }

    return recs.slice(0, 3);
}

// ─── SVG Gauge ───────────────────────────────────────────────
/**
 * Renders a 240° arc gauge (starts at 150° from positive x-axis, sweeps clockwise).
 * score 0-100 → 0%-100% of the 240° arc.
 */
function Gauge({ score, color }: { score: number; color: string }) {
    const R = 72;         // radius
    const cx = 90; const cy = 90;
    const totalAngle = 240; // degrees of arc
    const startAngleDeg = 150; // degrees from positive x-axis (counter-clockwise from right)

    // Convert to radians and compute arc
    const circumference = 2 * Math.PI * R;
    const arcLength = (totalAngle / 360) * circumference;
    const filled = (Math.max(0, Math.min(100, score)) / 100) * arcLength;

    // stroke-dasharray trick: draw only the 240° arc portion
    // transform: rotate so the start of the drawn portion aligns with our start angle
    const rotationDeg = startAngleDeg - 90; // SVG 0° = top, we want to start at startAngleDeg

    return (
        <svg className="health-gauge-svg" width={180} height={160} viewBox="0 0 180 160">
            {/* Track */}
            <circle
                className="health-gauge-track"
                cx={cx} cy={cy} r={R}
                strokeWidth={12}
                strokeDasharray={`${arcLength} ${circumference - arcLength}`}
                strokeDashoffset={0}
                transform={`rotate(${rotationDeg} ${cx} ${cy})`}
            />
            {/* Fill */}
            <circle
                className="health-gauge-fill"
                cx={cx} cy={cy} r={R}
                strokeWidth={12}
                stroke={color}
                strokeDasharray={`${filled} ${circumference - filled}`}
                strokeDashoffset={0}
                transform={`rotate(${rotationDeg} ${cx} ${cy})`}
            />
            {/* Center text */}
            <text className="health-gauge-center" x={cx} y={cy - 6}>
                <tspan className="health-score-num" x={cx} dy="0">{score}</tspan>
                <tspan className="health-score-sub" x={cx} dy="22">out of 100</tspan>
            </text>
        </svg>
    );
}

// ─── Main component ──────────────────────────────────────────
export default function Health() {
    const { expenses, loading: eLoad } = useExpenses();
    const { recurring, loading: rLoad } = useRecurringItems();
    const { profile, loading: sLoad } = useSalaryProfile();
    const { goals, loading: gLoad } = useSavings();

    const loading = eLoad || rLoad || sLoad || gLoad;

    const score = useMemo<HealthScore | null>(() => {
        if (loading) return null;
        const income = profile?.monthlyIncome ?? 0;

        const ms = monthStart();
        const currentMonthExp = expenses
            .filter(e => e.date >= ms)
            .reduce((s, e) => s + Number(e.amount || 0), 0);

        const ps = prevMonthStart();
        const pe = prevMonthEnd();
        const prevMonthExp = expenses
            .filter(e => e.date >= ps && e.date <= pe)
            .reduce((s, e) => s + Number(e.amount || 0), 0);

        const totalRecurring = recurring
            .filter(r => r.status !== "cancelled")
            .reduce((s, r) => s + monthlyEquivalent(r), 0);

        const since3mo = threeMonthsAgo();
        const has3MonthsData = expenses.some(e => e.date <= since3mo);

        return computeScore(income, currentMonthExp, totalRecurring, prevMonthExp, goals, has3MonthsData);
    }, [loading, expenses, recurring, profile, goals]);

    if (loading) return <div className="health-loading">Calculating your score…</div>;

    if (!profile) {
        return (
            <div className="health-page">
                <div className="health-header">
                    <div>
                        <h1 className="health-title">Financial Health Score</h1>
                        <p className="health-subtitle">A 0–100 score based on your real financial data.</p>
                    </div>
                </div>
                <div className="health-warn">
                    ⚠️ &nbsp;No salary found. Add your monthly income in the <strong>Salary</strong> page — your score is calculated against your income.
                </div>
            </div>
        );
    }

    const s = score!;
    const recs = buildRecs(s);
    const now = new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

    return (
        <div className="health-page">

            {/* ── Header ── */}
            <div className="health-header">
                <div>
                    <h1 className="health-title">Financial Health Score</h1>
                    <p className="health-subtitle">A personalised 0–100 score based on 5 key areas of your finances.</p>
                </div>
                <div className="health-updated">Last calculated<br />{now}</div>
            </div>

            {/* ── Hero — gauge + overview ── */}
            <div className="health-hero">
                <div className="health-gauge-wrap">
                    <Gauge score={s.total} color={s.gradeColor} />
                    <div
                        className="health-grade-badge"
                        style={{ background: s.gradeColor }}
                    >
                        {s.grade}
                    </div>
                </div>

                <div className="health-hero-right">
                    <div>
                        <h2 className="health-verdict">{s.verdict}</h2>
                        <p className="health-verdict-sub">{s.verdictSub}</p>
                    </div>

                    <div className="health-overview-bars">
                        {s.components.map(c => (
                            <div key={c.id} className="health-bar-row">
                                <span className="health-bar-label">{c.icon} {c.name}</span>
                                <div className="health-bar-track">
                                    <div
                                        className="health-bar-fill"
                                        style={{ width: `${c.pct}%`, background: c.color }}
                                    />
                                </div>
                                <span className="health-bar-pts" style={{ color: c.color }}>
                                    {c.pts}/{c.maxPts}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Key metrics row ── */}
            <div>
                <p className="health-section-title" style={{ marginBottom: "0.75rem" }}>Key Metrics</p>
                <div className="health-metrics-row">
                    <div className="health-metric">
                        <div className="health-metric-label">Monthly Income</div>
                        <div className="health-metric-value">{fmt(s.monthlyIncome)}</div>
                        <div className="health-metric-sub">From salary profile</div>
                    </div>
                    <div className="health-metric">
                        <div className="health-metric-label">This Month's Spend</div>
                        <div className="health-metric-value" style={{ color: s.expenseRatio > 80 ? "#ef4444" : "inherit" }}>{fmt(s.monthlyExpenses)}</div>
                        <div className="health-metric-sub">{pct(s.expenseRatio)} of income</div>
                    </div>
                    <div className="health-metric">
                        <div className="health-metric-label">Recurring Costs</div>
                        <div className="health-metric-value">{fmt(s.monthlyRecurring)}</div>
                        <div className="health-metric-sub">{pct(s.subscriptionBurden)} of income</div>
                    </div>
                    <div className="health-metric">
                        <div className="health-metric-label">Monthly Surplus</div>
                        <div className="health-metric-value" style={{ color: s.monthlySurplus >= 0 ? "#10b981" : "#ef4444" }}>{fmt(s.monthlySurplus)}</div>
                        <div className="health-metric-sub">{pct(s.savingsRate)} savings rate</div>
                    </div>
                </div>
            </div>

            {/* ── Component breakdown ── */}
            <div>
                <p className="health-section-title" style={{ marginBottom: "0.75rem" }}>Score Breakdown</p>
                <div className="health-breakdown-grid">
                    {s.components.map(c => (
                        <div key={c.id} className="health-component-card" style={{ "--card-bar-color": c.color } as React.CSSProperties}>
                            <style>{`.health-component-card:nth-of-type(${s.components.indexOf(c) + 1})::before { background: ${c.color}; }`}</style>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <span className="health-component-icon">{c.icon}</span>
                                <span className={`health-chip ${c.chipLevel}`}>{c.chipLabel}</span>
                            </div>
                            <div>
                                <div className="health-component-name">{c.name}</div>
                                <div className="health-component-score">
                                    <span className="health-component-pts" style={{ color: c.color }}>{c.pts}</span>
                                    <span className="health-component-max">/{c.maxPts} pts</span>
                                </div>
                            </div>
                            <div className="health-component-bar-track">
                                <div
                                    className="health-component-bar-fill"
                                    style={{ width: `${c.pct}%`, background: c.color }}
                                />
                            </div>
                            <div className="health-component-detail">{c.detail}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Recommendations ── */}
            <div>
                <p className="health-section-title" style={{ marginBottom: "0.75rem" }}>💡 Personalised Recommendations</p>
                <div className="health-recs-grid">
                    {recs.map((r, i) => (
                        <div key={i} className="health-rec-card" style={{ background: r.bg }}>
                            <div className="health-rec-icon" style={{ background: r.iconBg }}>{r.icon}</div>
                            <div className="health-rec-body">
                                <div className="health-rec-title">{r.title}</div>
                                <div className="health-rec-desc">{r.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
