import { useMemo, useState } from "react";
import { useExpenses } from "../../lib/useExpenses";
import { useRecurringItems } from "../../lib/useRecurringItems";
import { useSalaryProfile } from "../../lib/useSalaryProfile";
import { useSavings } from "../../lib/useSavings";
import { monthlyEquivalent } from "../../lib/recurring";
import type { SavingsGoal } from "../../types/savings";
import "./Simulator.css";

// ─── Helpers ─────────────────────────────────────────────────
const PHP = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
function fmt(n: number) { return PHP.format(n); }
function fmtDecimal(n: number) {
    return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(n);
}

/** Average monthly spend per category computed from last 3 months of expenses */
function buildCategoryAverages(expenses: { category: string; amount: number; date: string }[]): Map<string, number> {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10);
    const recent = expenses.filter(e => e.date >= threeMonthsAgo);

    const totals = new Map<string, number>();
    for (const e of recent) {
        totals.set(e.category, (totals.get(e.category) ?? 0) + Number(e.amount));
    }
    // divide by 3 for a monthly average
    const avgs = new Map<string, number>();
    totals.forEach((total, cat) => avgs.set(cat, total / 3));
    return avgs;
}

/** Months to reach remaining amount at a given monthly surplus (0 if already met or no surplus) */
function monthsToGoal(goal: SavingsGoal, monthlySurplus: number): number | null {
    const remaining = goal.targetAmount - goal.currentAmount;
    if (remaining <= 0) return 0;
    if (monthlySurplus <= 0) return null;
    return Math.ceil(remaining / monthlySurplus);
}

function gaugeColor(pct: number) {
    if (pct >= 20) return "#10b981";
    if (pct >= 10) return "#f59e0b";
    return "#ef4444";
}

// ─── Custom item type ─────────────────────────────────────────
type CustomItem = { id: string; name: string; amount: number; enabled: boolean };

// ─── Main component ──────────────────────────────────────────
export default function Simulator() {
    const { expenses, loading: expLoading } = useExpenses();
    const { recurring, loading: recLoading } = useRecurringItems();
    const { profile, loading: salLoading } = useSalaryProfile();
    const { goals, loading: goalsLoading } = useSavings();

    // Set of recurring item IDs that are toggled OFF (removed)
    const [removedRecurring, setRemovedRecurring] = useState<Set<string>>(new Set());
    // Set of expense categories toggled OFF
    const [removedCategories, setRemovedCategories] = useState<Set<string>>(new Set());
    // Custom extra items (things the user adds manually to simulate cutting)
    const [customItems, setCustomItems] = useState<CustomItem[]>([]);
    const [customName, setCustomName] = useState("");
    const [customAmt, setCustomAmt] = useState("");

    const loading = expLoading || recLoading || salLoading || goalsLoading;

    // ── Derived data ──────────────────────────────────────────

    const monthlyIncome = profile?.monthlyIncome ?? 0;

    // Active recurring items (not cancelled)
    const activeRecurring = useMemo(
        () => recurring.filter(r => r.status !== "cancelled"),
        [recurring]
    );

    // Category averages (last 3 months)
    const categoryAvgs = useMemo(() => buildCategoryAverages(expenses), [expenses]);

    // Current monthly spend (all recurring + all category avgs)
    const baselineRecurring = useMemo(
        () => activeRecurring.reduce((s, r) => s + monthlyEquivalent(r), 0),
        [activeRecurring]
    );

    const baselineCategories = useMemo(
        () => [...categoryAvgs.values()].reduce((s, v) => s + v, 0),
        [categoryAvgs]
    );

    const baselineTotal = baselineRecurring + baselineCategories;
    const baselineSurplus = monthlyIncome - baselineTotal;

    // ── Simulated spend ───────────────────────────────────────

    const simRecurringRemoved = useMemo(
        () => activeRecurring
            .filter(r => removedRecurring.has(r.id))
            .reduce((s, r) => s + monthlyEquivalent(r), 0),
        [activeRecurring, removedRecurring]
    );

    const simCategoryRemoved = useMemo(() => {
        let total = 0;
        removedCategories.forEach(cat => {
            total += categoryAvgs.get(cat) ?? 0;
        });
        return total;
    }, [categoryAvgs, removedCategories]);

    const simCustomRemoved = useMemo(
        () => customItems.filter(c => !c.enabled).reduce((s, c) => s + c.amount, 0),
        [customItems]
    );

    const totalFreed = simRecurringRemoved + simCategoryRemoved + simCustomRemoved;
    const simSurplus = baselineSurplus + totalFreed;

    const baseSavingsRate = monthlyIncome > 0 ? Math.max(0, (baselineSurplus / monthlyIncome) * 100) : 0;
    const simSavingsRate = monthlyIncome > 0 ? Math.max(0, (simSurplus / monthlyIncome) * 100) : 0;

    // ── Toggle helpers ────────────────────────────────────────
    function toggleRecurring(id: string) {
        setRemovedRecurring(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    function toggleCategory(cat: string) {
        setRemovedCategories(prev => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat); else next.add(cat);
            return next;
        });
    }

    function toggleCustom(id: string) {
        setCustomItems(prev => prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));
    }

    function removeCustom(id: string) {
        setCustomItems(prev => prev.filter(c => c.id !== id));
    }

    function addCustom() {
        const amt = parseFloat(customAmt);
        if (!customName.trim() || !amt || amt <= 0) return;
        setCustomItems(prev => [
            ...prev,
            { id: crypto.randomUUID(), name: customName.trim(), amount: amt, enabled: true },
        ]);
        setCustomName("");
        setCustomAmt("");
    }

    function toggleAllRecurring(on: boolean) {
        if (on) setRemovedRecurring(new Set());
        else setRemovedRecurring(new Set(activeRecurring.map(r => r.id)));
    }

    function toggleAllCategories(on: boolean) {
        if (on) setRemovedCategories(new Set());
        else setRemovedCategories(new Set(categoryAvgs.keys()));
    }

    function resetAll() {
        setRemovedRecurring(new Set());
        setRemovedCategories(new Set());
        setCustomItems([]);
    }

    const categoryEntries = useMemo(
        () => [...categoryAvgs.entries()].sort((a, b) => b[1] - a[1]),
        [categoryAvgs]
    );

    if (loading) {
        return <div className="sim-loading">Loading your financial data…</div>;
    }

    return (
        <div className="sim-page">
            {/* ── Header ── */}
            <div className="sim-header">
                <h1 className="sim-title">What-If Simulator</h1>
                <p className="sim-subtitle">
                    Toggle expenses and subscriptions off to see how much extra you could save — and how much faster you'd hit your goals.
                </p>
            </div>

            {!profile && (
                <div className="sim-warn">
                    ⚠️ &nbsp;No salary recorded yet. Add your monthly income in the <strong>Salary</strong> page to see surplus and goal projections.
                </div>
            )}

            <div className="sim-layout">
                {/* ═══════════════════════════════
                    LEFT — toggleable items
                    ═══════════════════════════════ */}
                <div className="sim-left">

                    {/* Recurring / subscriptions */}
                    <div className="sim-card">
                        <div className="sim-card-header">
                            <h2 className="sim-card-title">
                                🔄 Recurring &amp; Subscriptions
                                <span className="sim-card-badge">{activeRecurring.length}</span>
                            </h2>
                            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                <button className="sim-toggle-all" onClick={() => toggleAllRecurring(true)}>All on</button>
                                <span style={{ color: "var(--text-muted)" }}>·</span>
                                <button className="sim-toggle-all" onClick={() => toggleAllRecurring(false)}>All off</button>
                            </div>
                        </div>

                        {activeRecurring.length === 0 ? (
                            <div className="sim-empty">No active recurring items found.</div>
                        ) : (
                            activeRecurring.map(r => {
                                const removed = removedRecurring.has(r.id);
                                const monthly = monthlyEquivalent(r);
                                return (
                                    <div
                                        key={r.id}
                                        className={`sim-item${removed ? " removed" : ""}`}
                                        onClick={() => toggleRecurring(r.id)}
                                    >
                                        <input
                                            type="checkbox"
                                            className="sim-checkbox"
                                            checked={!removed}
                                            onChange={() => toggleRecurring(r.id)}
                                            onClick={e => e.stopPropagation()}
                                        />
                                        <div className="sim-item-body">
                                            <div className="sim-item-name">{r.name}</div>
                                            <div className="sim-item-meta">
                                                {r.frequency} · {r.category}
                                                {r.frequency !== "monthly" && (
                                                    <span> · {fmt(monthly)}/mo equiv.</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className={`sim-item-amount${removed ? " removed-amount" : ""}`}>
                                            {fmtDecimal(Number(r.amount))}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Expense categories */}
                    <div className="sim-card">
                        <div className="sim-card-header">
                            <h2 className="sim-card-title">
                                🧾 Expense Categories
                                <span className="sim-card-badge">3-mo avg</span>
                            </h2>
                            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                <button className="sim-toggle-all" onClick={() => toggleAllCategories(true)}>All on</button>
                                <span style={{ color: "var(--text-muted)" }}>·</span>
                                <button className="sim-toggle-all" onClick={() => toggleAllCategories(false)}>All off</button>
                            </div>
                        </div>

                        {categoryEntries.length === 0 ? (
                            <div className="sim-empty">No expense history found. Add some expenses first.</div>
                        ) : (
                            categoryEntries.map(([cat, avg]) => {
                                const removed = removedCategories.has(cat);
                                return (
                                    <div
                                        key={cat}
                                        className={`sim-item${removed ? " removed" : ""}`}
                                        onClick={() => toggleCategory(cat)}
                                    >
                                        <input
                                            type="checkbox"
                                            className="sim-checkbox"
                                            checked={!removed}
                                            onChange={() => toggleCategory(cat)}
                                            onClick={e => e.stopPropagation()}
                                        />
                                        <div className="sim-item-body">
                                            <div className="sim-item-name">{cat}</div>
                                            <div className="sim-item-meta">Average monthly spend over last 3 months</div>
                                        </div>
                                        <div className={`sim-item-amount${removed ? " removed-amount" : ""}`}>
                                            {fmt(avg)}/mo
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Custom hypothetical items */}
                    <div className="sim-card">
                        <div className="sim-card-header">
                            <h2 className="sim-card-title">✨ Custom Hypothetical Items</h2>
                        </div>

                        {customItems.map(item => (
                            <div
                                key={item.id}
                                className={`sim-item${!item.enabled ? " removed" : ""}`}
                                onClick={() => toggleCustom(item.id)}
                            >
                                <input
                                    type="checkbox"
                                    className="sim-checkbox"
                                    checked={item.enabled}
                                    onChange={() => toggleCustom(item.id)}
                                    onClick={e => e.stopPropagation()}
                                />
                                <div className="sim-item-body">
                                    <div className="sim-item-name">{item.name}</div>
                                    <div className="sim-item-meta">Custom item — uncheck to remove from spending</div>
                                </div>
                                <div className={`sim-item-amount${!item.enabled ? " removed-amount" : ""}`}>
                                    {fmt(item.amount)}/mo
                                </div>
                                <button
                                    style={{ marginLeft: "0.25rem", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.85rem", padding: "0 0.25rem", flexShrink: 0 }}
                                    onClick={e => { e.stopPropagation(); removeCustom(item.id); }}
                                    title="Remove"
                                >✕</button>
                            </div>
                        ))}

                        <div className="sim-custom-row">
                            <input
                                className="sim-custom-input"
                                placeholder="e.g. Gym membership"
                                value={customName}
                                onChange={e => setCustomName(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && addCustom()}
                            />
                            <input
                                className="sim-custom-input"
                                style={{ maxWidth: 110 }}
                                placeholder="Amount"
                                type="number"
                                min="1"
                                value={customAmt}
                                onChange={e => setCustomAmt(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && addCustom()}
                            />
                            <button
                                className="sim-custom-add"
                                onClick={addCustom}
                                disabled={!customName.trim() || !customAmt}
                            >
                                + Add
                            </button>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════
                    RIGHT — sticky impact panel
                    ═══════════════════════════════ */}
                <div className="sim-right">

                    {/* Impact card */}
                    <div className="sim-impact-card">
                        <div className="sim-impact-header">
                            💡 Monthly Impact
                        </div>

                        <div className="sim-impact-hero">
                            <div className="sim-impact-label">Simulated monthly surplus</div>
                            <div className={`sim-impact-value ${simSurplus >= 0 ? "positive" : "negative"}`}>
                                {fmt(simSurplus)}
                            </div>
                            <div className="sim-impact-sub">vs current: {fmt(baselineSurplus)}</div>
                        </div>

                        {totalFreed !== 0 && (
                            <div className={`sim-freed-banner${totalFreed < 0 ? " negative" : ""}`}>
                                {totalFreed >= 0 ? "🎉" : "⚠️"}
                                {totalFreed >= 0
                                    ? `Freeing up ${fmt(totalFreed)}/mo by removing these items`
                                    : `Adding ${fmt(Math.abs(totalFreed))}/mo in extra spending`}
                            </div>
                        )}

                        <div className="sim-stats-grid">
                            <div className="sim-stat">
                                <span className="sim-stat-label">Monthly income</span>
                                <span className="sim-stat-value">{fmt(monthlyIncome)}</span>
                            </div>
                            <div className="sim-stat">
                                <span className="sim-stat-label">Freed up</span>
                                <span className={`sim-stat-value ${totalFreed >= 0 ? "green" : "red"}`}>{fmt(totalFreed)}</span>
                            </div>
                            <div className="sim-stat">
                                <span className="sim-stat-label">Current spend</span>
                                <span className="sim-stat-value red">{fmt(baselineTotal)}</span>
                            </div>
                            <div className="sim-stat">
                                <span className="sim-stat-label">Sim. spend</span>
                                <span className={`sim-stat-value ${baselineTotal - totalFreed < baselineTotal ? "green" : "red"}`}>
                                    {fmt(Math.max(0, baselineTotal - totalFreed))}
                                </span>
                            </div>
                        </div>

                        {/* Savings rate gauge */}
                        <div className="sim-gauge-wrap">
                            <div className="sim-gauge-label">
                                <span>Savings Rate</span>
                                <span style={{ color: gaugeColor(simSavingsRate) }}>
                                    {baseSavingsRate.toFixed(0)}% → {simSavingsRate.toFixed(0)}%
                                </span>
                            </div>
                            <div className="sim-gauge-track">
                                <div
                                    className="sim-gauge-fill"
                                    style={{
                                        width: `${Math.min(100, simSavingsRate)}%`,
                                        background: gaugeColor(simSavingsRate),
                                    }}
                                />
                            </div>
                            <div className="sim-gauge-hint">
                                {simSavingsRate >= 20
                                    ? "🟢 Excellent — above the 20% benchmark"
                                    : simSavingsRate >= 10
                                        ? "🟡 Good — aim for 20%+ for financial safety"
                                        : simSavingsRate > 0
                                            ? "🔴 Low — try cutting more to reach at least 10%"
                                            : "💸 No surplus — expenses exceed income"}
                            </div>
                        </div>

                        {/* Reset */}
                        {totalFreed !== 0 && (
                            <div style={{ padding: "0 1.2rem 1rem", textAlign: "right" }}>
                                <button className="sim-reset-btn" onClick={resetAll}>↺ Reset all</button>
                            </div>
                        )}
                    </div>

                    {/* Goals timeline card */}
                    {goals.length > 0 && (
                        <div className="sim-goals-card">
                            <div className="sim-goals-header">🎯 Goal Timelines</div>

                            {goals.filter(g => g.status !== "completed" && g.currentAmount < g.targetAmount).map(goal => {
                                const baseMonths = monthsToGoal(goal, baselineSurplus);
                                const simMonths = monthsToGoal(goal, simSurplus);
                                const pct = goal.targetAmount > 0
                                    ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)
                                    : 0;
                                const color = goal.color ?? "#6366f1";

                                let compareTip: React.ReactNode = null;
                                if (baseMonths !== null && simMonths !== null && simMonths !== baseMonths) {
                                    const diff = baseMonths - simMonths;
                                    compareTip = diff > 0
                                        ? <span className="faster">↑ {diff} month{diff !== 1 ? "s" : ""} faster</span>
                                        : <span className="slower">↓ {Math.abs(diff)} month{Math.abs(diff) !== 1 ? "s" : ""} slower</span>;
                                }

                                return (
                                    <div key={goal.id} className="sim-goal-row">
                                        <div className="sim-goal-top">
                                            <div className="sim-goal-name">
                                                <span>{goal.emoji ?? "💰"}</span>
                                                {goal.name}
                                            </div>
                                            <div className="sim-goal-months">
                                                {simMonths === null
                                                    ? "∞"
                                                    : simMonths === 0
                                                        ? "Done ✓"
                                                        : `${simMonths} mo`}
                                            </div>
                                        </div>

                                        <div className="sim-goal-track">
                                            <div
                                                className="sim-goal-fill"
                                                style={{ width: `${pct}%`, background: color }}
                                            />
                                        </div>

                                        <div className="sim-goal-compare">
                                            <span>
                                                {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(goal.currentAmount)}
                                                {" / "}
                                                {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(goal.targetAmount)}
                                            </span>
                                            {compareTip && <span>· {compareTip}</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
