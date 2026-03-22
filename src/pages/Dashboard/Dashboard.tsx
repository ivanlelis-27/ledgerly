import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { expensesToCSV, downloadTextFile } from "../../lib/csv";
import type { Expense } from "../../types/expense";
import ExpenseList from "../../components/ExpenseList/ExpenseList";
import { Link, useNavigate } from "react-router-dom";
import { useExpenses } from "../../lib/useExpenses";
import { useRecurringItems } from "../../lib/useRecurringItems";
import { useUserSettings } from "../../lib/useUserSettings";
import { useSalaryProfile } from "../../lib/useSalaryProfile";
import { useAiInsights } from "../../lib/useAiInsights";
import AiInsightBanner from "../../components/AiInsightBanner/AiInsightBanner";
import { removeExpense } from "../../lib/data";
import { usePullToRefresh } from "../../lib/usePullToRefresh";
import PullToRefreshIndicator from "../../components/PullToRefreshIndicator/PullToRefreshIndicator";
import { useSavings } from "../../lib/useSavings";
import "./Dashboard.css";

// ─── Local-time date helpers ──────────────────────────────────
// All helpers produce YYYY-MM-DD strings in the user's LOCAL timezone.

function localIso(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/** Today in local time */
function localToday(): string {
    return localIso(new Date());
}

/** Local date N days ago (positive) or in future (negative) */
function localDaysOffset(offset: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return localIso(d);
}

/** First day of the current calendar month (local) */
function localMonthStart(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Last day of the current calendar month (local) */
function localMonthEnd(): string {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/**
 * Start of the current week in local time.
 * weekStart: "monday" (1), "sunday" (0), "saturday" (6)
 */
function localWeekStart(weekStartPref: number): string {
    const today = new Date();
    const dow = today.getDay(); // 0=Sun, 1=Mon … 6=Sat
    const startDow = weekStartPref; // Now a number (0=Sun, 1=Mon, 6=Sat)
    let diff = dow - startDow;
    if (diff < 0) diff += 7;
    const start = new Date(today);
    start.setDate(today.getDate() - diff);
    return localIso(start);
}

/** Previous period start/end for delta comparison */
function prevPeriod(range: RangeKey, customStart: string, customEnd: string, weekStartPref: number): [string, string] {
    if (range === "today") {
        const prev = localDaysOffset(-1);
        return [prev, prev];
    }
    if (range === "week") {
        const ws = localWeekStart(weekStartPref);
        const wsDate = new Date(ws + "T00:00:00");
        const prevEnd = new Date(wsDate);
        prevEnd.setDate(wsDate.getDate() - 1);
        const prevStart = new Date(prevEnd);
        prevStart.setDate(prevEnd.getDate() - 6);
        return [localIso(prevStart), localIso(prevEnd)];
    }
    if (range === "month") {
        const now = new Date();
        const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1);
        return [localIso(prevMonthStart), localIso(prevMonthEnd)];
    }
    // custom: mirror the same duration before customStart
    const start = new Date(customStart + "T00:00:00");
    const end = new Date(customEnd + "T00:00:00");
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    const prevEnd = new Date(start);
    prevEnd.setDate(start.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevEnd.getDate() - days);
    return [localIso(prevStart), localIso(prevEnd)];
}

/** Human-readable date range label */
function rangeLabel(range: RangeKey, start: string, end: string): string {
    const fmt = (iso: string) => {
        const [y, m, d] = iso.split("-").map(Number);
        return new Date(y, (m || 1) - 1, d || 1)
            .toLocaleDateString(undefined, { month: "short", day: "numeric" });
    };
    if (range === "today") return `Today · ${fmt(start)}`;
    if (range === "week") return `${fmt(start)} – ${fmt(end)}`;
    if (range === "month") {
        const [y, m] = start.split("-").map(Number);
        return new Date(y, (m || 1) - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
    }
    return `${fmt(start)} – ${fmt(end)}`;
}

type RangeKey = "today" | "week" | "month" | "custom";

// ─── Component ────────────────────────────────────────────────
export default function Dashboard() {
    const [range, setRange] = useState<RangeKey>("month");
    const [customStart, setCustomStart] = useState(localMonthStart);
    const [customEnd, setCustomEnd] = useState(localToday);

    const { expenses: all, error: expensesError, refetch: refetchExpenses } = useExpenses();
    const { recurring: recurringAll, error: recurringError, refetch: refetchRecurring } = useRecurringItems();
    const { settings, loading: settingsLoading } = useUserSettings();
    const { profile: salaryProfile } = useSalaryProfile();
    const { goals, refetch: refetchSavings } = useSavings();
    const nav = useNavigate();

    useEffect(() => {
        if (!settingsLoading && !settings.onboardingCompleted) {
            nav("/onboarding", { replace: true });
        }
    }, [settingsLoading, settings, nav]);

    const weekStartPref = settings.weekStart ?? "monday";

    // Pull-to-refresh — must point at the actual scroll container (.content <main>)
    const dashRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLElement | null>(null);

    // Resolve the scrollable parent once the dashboard mounts
    useEffect(() => {
        const el = dashRef.current;
        if (!el) return;
        // Walk up the DOM to find the first overflow-scroll/auto ancestor
        let node: HTMLElement | null = el.parentElement;
        while (node) {
            const overflow = getComputedStyle(node).overflowY;
            if (overflow === "scroll" || overflow === "auto") {
                scrollContainerRef.current = node;
                break;
            }
            node = node.parentElement;
        }
    }, []);

    const onRefresh = useCallback(async () => {
        await Promise.all([refetchExpenses(), refetchRecurring(), refetchSavings()]);
    }, [refetchExpenses, refetchRecurring, refetchSavings]);

    const { phase: ptrPhase, pullY } = usePullToRefresh({ onRefresh, scrollRef: scrollContainerRef });

    // ── Compute current range start/end ──
    const [rangeStart, rangeEnd] = useMemo<[string, string]>(() => {
        if (range === "today") return [localToday(), localToday()];
        if (range === "week") return [localWeekStart(weekStartPref), localToday()];
        if (range === "month") return [localMonthStart(), localMonthEnd()];
        return [customStart, customEnd];
    }, [range, weekStartPref, customStart, customEnd]);

    // ── Filtered expenses ──
    const filtered = useMemo<Expense[]>(
        () => all.filter(e => e.date >= rangeStart && e.date <= rangeEnd),
        [all, rangeStart, rangeEnd]
    );

    const total = useMemo(() => filtered.reduce((s, e) => s + Number(e.amount || 0), 0), [filtered]);
    const txCount = filtered.length;

    const dayCount = useMemo(() => {
        const s = new Date(rangeStart + "T00:00:00");
        const e = new Date(rangeEnd + "T00:00:00");
        return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1);
    }, [rangeStart, rangeEnd]);

    const avgPerDay = total / dayCount;

    const biggest = useMemo(() => {
        if (!filtered.length) return null;
        return filtered.reduce((max, e) => Number(e.amount) > Number(max.amount) ? e : max, filtered[0]);
    }, [filtered]);

    // ── Previous period delta ──
    const lastRangeTotal = useMemo(() => {
        const [ps, pe] = prevPeriod(range, customStart, customEnd, weekStartPref);
        return all.filter(e => e.date >= ps && e.date <= pe)
            .reduce((s, e) => s + Number(e.amount || 0), 0);
    }, [all, range, customStart, customEnd, weekStartPref]);

    const delta = total - lastRangeTotal;
    const deltaPct = lastRangeTotal > 0 ? (delta / lastRangeTotal) * 100 : null;

    // ── AI Insight data slices (always current + prev calendar month) ──
    const aiMonthStart = useMemo(() => {
        const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    }, []);
    const aiMonthEnd = useMemo(() => {
        const d = new Date(); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
    }, []);
    const aiPrevMonthStart = useMemo(() => {
        const d = new Date(); const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
        return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-01`;
    }, []);
    const aiPrevMonthEnd = useMemo(() => {
        const d = new Date(); const last = new Date(d.getFullYear(), d.getMonth(), 0);
        return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
    }, []);

    const aiMonthExpenses = useMemo(
        () => all.filter(e => e.date >= aiMonthStart && e.date <= aiMonthEnd),
        [all, aiMonthStart, aiMonthEnd]
    );
    const aiPrevMonthExpenses = useMemo(
        () => all.filter(e => e.date >= aiPrevMonthStart && e.date <= aiPrevMonthEnd),
        [all, aiPrevMonthStart, aiPrevMonthEnd]
    );

    const aiInsights = useAiInsights({
        monthExpenses: aiMonthExpenses,
        prevMonthExpenses: aiPrevMonthExpenses,
        allExpenses: all,
        recurring: recurringAll,
        salary: salaryProfile,
    });

    // ── Top categories ──
    const topCategories = useMemo(() => {
        const map = new Map<string, number>();
        for (const e of filtered) map.set(e.category, (map.get(e.category) || 0) + Number(e.amount || 0));
        return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    }, [filtered]);

    // ── Upcoming recurring (next 7 days, local) ──
    const today = localToday();
    const in7 = localDaysOffset(7);
    const upcomingRecurring = useMemo(
        () => recurringAll
            .filter(r => r.status !== "cancelled")
            .filter(r => r.nextDueDate >= today && r.nextDueDate <= in7)
            .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))
            .slice(0, 6),
        [recurringAll, today, in7]
    );

    // ── Handlers ──
    async function handleDelete(id: string) {
        try {
            await removeExpense(id);
            await refetchExpenses();
        } catch (err: unknown) {
            window.alert(err instanceof Error ? err.message : "Failed to delete expense.");
        }
    }

    function exportCSV() {
        downloadTextFile(`ledgerly-${range}.csv`, expensesToCSV(filtered));
    }

    function fmtMoney(n: number) {
        return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function fmtShort(iso: string) {
        const [y, m, d] = iso.split("-").map(Number);
        return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString(undefined, { month: "short", day: "2-digit" });
    }

    const currentLabel = rangeLabel(range, rangeStart, rangeEnd);
    const { budgetStyle, financialGoal, focusCategories } = settings;

    // Filter top categories if focusCategories is set
    const displayTopCategories = useMemo(() => {
        if (!focusCategories || focusCategories.length === 0) return topCategories;
        // Move focus categories to top
        const focusOn = topCategories.filter(([cat]) => focusCategories.includes(cat));
        const others = topCategories.filter(([cat]) => !focusCategories.includes(cat));
        return [...focusOn, ...others].slice(0, 5);
    }, [topCategories, focusCategories]);

    const isMinimalist = budgetStyle === "minimalist";
    const isGoalSeeker = budgetStyle === "goal-seeker";
    const isOptimizer = budgetStyle === "optimizer";

    return (
        <div className="dash" ref={dashRef}>
            <PullToRefreshIndicator phase={ptrPhase} pullY={pullY} />

            {/* ── Header ── */}
            <div className="headerRow">
                <div className="headerTop">
                    <div className="headerTitleBlock">
                        <h1 className="title">Dashboard</h1>
                        {!isMinimalist && <div className="subtitle">Track your spending across time</div>}
                        {expensesError && <div style={{ color: "var(--danger, #dc2626)", fontSize: 13 }}>{expensesError}</div>}
                        {recurringError && <div style={{ color: "var(--danger, #dc2626)", fontSize: 13 }}>{recurringError}</div>}
                    </div>

                    {/* Tabs only — no sub-row */}
                    <div className="seg">
                        {(["today", "week", "month", "custom"] as RangeKey[]).map(r => (
                            <button
                                key={r}
                                className={range === r ? "on" : ""}
                                onClick={() => setRange(r)}
                            >
                                {r.charAt(0).toUpperCase() + r.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* Date context + actions — all right-aligned */}
                    <div className="headerActions">
                        {range === "custom" && (
                            <>
                                <input
                                    type="date"
                                    className="dateInput"
                                    value={customStart}
                                    max={customEnd}
                                    onChange={e => setCustomStart(e.target.value)}
                                />
                                <span className="dateSep">→</span>
                                <input
                                    type="date"
                                    className="dateInput"
                                    value={customEnd}
                                    min={customStart}
                                    onChange={e => setCustomEnd(e.target.value)}
                                />
                            </>
                        )}
                        <button className="ghost desktopOnly" onClick={exportCSV}>↓ CSV</button>
                        <button className="ghost desktopOnly" onClick={() => { void refetchExpenses(); void refetchRecurring(); }}>↺ Refresh</button>
                    </div>
                </div>
            </div>

            {/* ── Summary cards ── */}
            <div className="summary">
                <div className="summaryCard">
                    <div className="summaryHeader">
                        <div className="kLabel">Total spent</div>
                        <div className="rangeLabel mobileOnly">{currentLabel}</div>
                    </div>
                    <div className="kValue">₱{fmtMoney(total)}</div>
                    <div className="kSub">
                        {deltaPct === null ? (
                            <span className="muted">No previous data</span>
                        ) : (
                            <span className={delta >= 0 ? "up" : "down"}>
                                {delta >= 0 ? "▲" : "▼"} ₱{fmtMoney(Math.abs(delta))} ({Math.abs(deltaPct).toFixed(1)}%)
                                <span className="muted"> vs prev period</span>
                            </span>
                        )}
                    </div>
                </div>

                {!isMinimalist && (
                    <div className="summaryCard">
                        <div className="kLabel">Transactions</div>
                        <div className="kValue">{txCount}</div>
                        <div className="kSub">
                            <span className="muted">Avg/day: ₱{fmtMoney(avgPerDay)}</span>
                        </div>
                    </div>
                )}

                {!isMinimalist && (
                    <div className="summaryCard">
                        <div className="kLabel">Biggest expense</div>
                        <div className="kValue">{biggest ? `₱${fmtMoney(Number(biggest.amount))}` : "—"}</div>
                        <div className="kSub">
                            {biggest ? (
                                <span className="muted">
                                    {biggest.category}{biggest.subcategory ? ` / ${biggest.subcategory}` : ""}
                                </span>
                            ) : (
                                <span className="muted">No data</span>
                            )}
                        </div>
                    </div>
                )}

                <div className="summaryCard">
                    <div className="kLabel">Remaining budget</div>
                    {salaryProfile ? (() => {
                        const remaining = salaryProfile.monthlyIncome - aiMonthExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
                        const pct = salaryProfile.monthlyIncome > 0
                            ? Math.round((remaining / salaryProfile.monthlyIncome) * 100)
                            : null;
                        return (
                            <>
                                <div className={`kValue ${remaining < 0 ? "down" : ""}`}>
                                    ₱{fmtMoney(Math.abs(remaining))}{remaining < 0 ? " over" : ""}
                                </div>
                                <div className="kSub">
                                    {pct !== null ? (
                                        <span className={remaining >= 0 ? "down" : "up"} style={{ color: remaining >= 0 ? "#16a34a" : "#dc2626" }}>
                                            {pct}% of ₱{fmtMoney(salaryProfile.monthlyIncome)} income
                                        </span>
                                    ) : (
                                        <span className="muted">This month</span>
                                    )}
                                </div>
                            </>
                        );
                    })() : (
                        <>
                            <div className="kValue kValueMuted">—</div>
                            <div className="kSub"><span className="muted">Set salary to track</span></div>
                        </>
                    )}
                </div>
            </div>


            {/* ── AI Insight Banner ── */}
            {(!isMinimalist || isOptimizer) && <AiInsightBanner {...aiInsights} />}

            {/* ── Savings Goals (Personalized for 'save' goal or 'goal-seeker' style) ── */}
            {(financialGoal === "save" || isGoalSeeker) && goals.length > 0 && (
                <div className="savingsWidget">
                    <div className="sectionTitle">Savings Progress</div>
                    <div className="savingsGrid">
                        {goals.filter(g => g.status === "active").slice(0, 3).map(goal => {
                            const pct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
                            return (
                                <div className="saveCard" key={goal.id} onClick={() => nav("/savings")}>
                                    <div className="saveEmoji">{goal.emoji || "💰"}</div>
                                    <div className="saveInfo">
                                        <div className="saveName">{goal.name}</div>
                                        <div className="savePct">{pct}%</div>
                                        <div className="saveBar"><div className="saveFill" style={{ width: `${pct}%`, background: goal.color }} /></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Main grid ── */}
            <div className="grid">
                {/* Top spends */}
                <div className="card topSpendsCard">
                    <div className="cardTitle">Top spending categories</div>

                    {displayTopCategories.length === 0 ? (
                        <div className="empty">No expenses in this period.</div>
                    ) : (
                        <div className="topList">
                            {displayTopCategories.map(([name, amt]) => {
                                const pct = total > 0 ? (amt / total) * 100 : 0;
                                return (
                                    <div className="topBarRow" key={name}>
                                        <div className="topBarHead">
                                            <span className="topName">{name}</span>
                                            <span className="topAmt">₱{fmtMoney(amt)}</span>
                                        </div>
                                        <div className="barTrack">
                                            <div className="barFill" style={{ width: `${Math.min(100, pct)}%` }} />
                                        </div>
                                        <div className="barMeta">
                                            <span className="muted">{pct.toFixed(0)}% of total</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Upcoming recurring */}
                <div className="card upcomingCard">
                    <div className="cardTitleRow">
                        <div className="cardTitle">Upcoming (next 7 days)</div>
                        <Link className="miniLink" to="/recurring">View all →</Link>
                    </div>

                    {upcomingRecurring.length === 0 ? (
                        <div className="empty">No upcoming recurring bills.</div>
                    ) : (
                        <div className="upList">
                            {upcomingRecurring.map(r => (
                                <div className="upRow" key={r.id}>
                                    <div className="upMain">
                                        <div className="upName">{r.name}</div>
                                        <div className="upMeta">
                                            <span className="pill">{r.paymentMethod}</span>
                                            <span className="dot">•</span>
                                            <span className="muted">{fmtShort(r.nextDueDate)}</span>
                                        </div>
                                    </div>
                                    <div className="upAmt">₱{fmtMoney(Number(r.amount))}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent expenses */}
                <div className="card recentCard">
                    <div className="cardTitleRow">
                        <div className="cardTitle">Recent expenses</div>
                        <Link className="miniLink" to="/add">View all →</Link>
                    </div>
                    <div className="cardBody">
                        <ExpenseList
                            expenses={filtered}
                            onDelete={handleDelete}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
