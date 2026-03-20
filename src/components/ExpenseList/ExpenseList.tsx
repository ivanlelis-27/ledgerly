import { useState, useMemo } from "react";
import type { Expense } from "../../types/expense";
import "./ExpenseList.css";

type Props = {
    expenses: Expense[];
    onDelete: (id: string) => void;
};

// ── Helpers ───────────────────────────────────────────────────────

function fmtMoney(n: number) {
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString(undefined, {
        month: "short", day: "numeric", year: "numeric",
    });
}

function monthLabel(yearMonth: string) {
    const [year, month] = yearMonth.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleString("default", { month: "long", year: "numeric" });
}

function cutoffLabel(cutoff: 1 | 2) {
    return cutoff === 1 ? "1st – 15th" : "16th – End of Month";
}

function getCutoff(dateStr: string): 1 | 2 {
    const day = parseInt(dateStr.split("-")[2], 10);
    return day <= 15 ? 1 : 2;
}

// Category → fintech accent color
const CATEGORY_PALETTE: [string, string][] = [
    ["debt",          "#ef4444"],
    ["loan",          "#ef4444"],
    ["groceries",     "#22c55e"],
    ["food",          "#f97316"],
    ["bills",         "#a855f7"],
    ["utilities",     "#a855f7"],
    ["entertainment", "#3b82f6"],
    ["transport",     "#06b6d4"],
    ["travel",        "#06b6d4"],
    ["health",        "#10b981"],
    ["medical",       "#10b981"],
    ["shopping",      "#f59e0b"],
    ["education",     "#6366f1"],
    ["savings",       "#14b8a6"],
    ["subscription",  "#8b5cf6"],
];

function categoryColor(category: string): string {
    const key = category.toLowerCase();
    for (const [k, v] of CATEGORY_PALETTE) {
        if (key.includes(k)) return v;
    }
    return "#64748b";
}

// ── Types ─────────────────────────────────────────────────────────

type CutoffGroup = { cutoff: 1 | 2; expenses: Expense[]; total: number };
type MonthGroup  = { yearMonth: string; cutoffs: CutoffGroup[]; total: number };

function groupExpenses(expenses: Expense[]): MonthGroup[] {
    const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date));
    const monthMap = new Map<string, Map<1 | 2, Expense[]>>();

    for (const e of sorted) {
        const yearMonth = e.date.slice(0, 7);
        const cutoff = getCutoff(e.date);
        if (!monthMap.has(yearMonth)) monthMap.set(yearMonth, new Map());
        const cutoffMap = monthMap.get(yearMonth)!;
        if (!cutoffMap.has(cutoff)) cutoffMap.set(cutoff, []);
        cutoffMap.get(cutoff)!.push(e);
    }

    return [...monthMap.entries()].map(([yearMonth, cutoffMap]) => {
        const cutoffs: CutoffGroup[] = ([1, 2] as const)
            .filter(c => cutoffMap.has(c) && cutoffMap.get(c)!.length > 0)
            .map(c => {
                const exps = cutoffMap.get(c)!;
                return { cutoff: c, expenses: exps, total: exps.reduce((s, e) => s + Number(e.amount), 0) };
            });
        return { yearMonth, cutoffs, total: cutoffs.reduce((s, c) => s + c.total, 0) };
    });
}

// ── Sub-components ────────────────────────────────────────────────

function ExpenseRow({ expense, onDelete }: { expense: Expense; onDelete: (id: string) => void }) {
    const color = categoryColor(expense.category);
    return (
        <div className="txRow">
            <span className="txDot" style={{ background: color }} />
            <div className="txBody">
                <div className="txTop">
                    <span className="txCat">
                        {expense.category}
                        {expense.subcategory ? <span className="txSub"> / {expense.subcategory}</span> : null}
                    </span>
                    {expense.notes && <span className="txNotes">{expense.notes}</span>}
                </div>
                <div className="txMeta">
                    <span className="txDate">{fmtDate(expense.date)}</span>
                    {expense.paymentMethod && (
                        <span className="txMethod">{expense.paymentMethod}</span>
                    )}
                </div>
            </div>
            <div className="txRight">
                <span className="txAmt">₱{fmtMoney(Number(expense.amount))}</span>
                <button
                    className="txDelete"
                    title="Delete expense"
                    onClick={() => onDelete(expense.id)}
                >
                    ×
                </button>
            </div>
        </div>
    );
}

function CutoffSection({ group, onDelete }: { group: CutoffGroup; onDelete: (id: string) => void }) {
    const [open, setOpen] = useState(true);

    return (
        <div className="cutoffSection">
            <button
                className="cutoffHeader"
                type="button"
                onClick={() => setOpen(v => !v)}
                aria-expanded={open}
            >
                <span className="chevron">{open ? "▾" : "▸"}</span>
                <span className="cutoffLabel">{cutoffLabel(group.cutoff)}</span>
                <span className="cutoffCount">{group.expenses.length} item{group.expenses.length !== 1 ? "s" : ""}</span>
                <span className="cutoffTotal">₱{fmtMoney(group.total)}</span>
            </button>

            {open && (
                <div className="cutoffItems">
                    {group.expenses.map(e => (
                        <ExpenseRow key={e.id} expense={e} onDelete={onDelete} />
                    ))}
                </div>
            )}
        </div>
    );
}

function MonthSection({ group, onDelete }: { group: MonthGroup; onDelete: (id: string) => void }) {
    const [open, setOpen] = useState(true);

    return (
        <div className="monthSection">
            <button
                className="monthHeader"
                type="button"
                onClick={() => setOpen(v => !v)}
                aria-expanded={open}
            >
                <span className="chevron">{open ? "▾" : "▸"}</span>
                <span className="monthLabel">{monthLabel(group.yearMonth)}</span>
                <span className="monthTotal">₱{fmtMoney(group.total)}</span>
            </button>

            {open && (
                <div className="monthItems">
                    {group.cutoffs.map(c => (
                        <CutoffSection key={c.cutoff} group={c} onDelete={onDelete} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Root ──────────────────────────────────────────────────────────

export default function ExpenseList({ expenses, onDelete }: Props) {
    const groups = useMemo(() => groupExpenses(expenses), [expenses]);

    if (expenses.length === 0) return (
        <div className="listEmpty">
            <span className="listEmptyIcon">💳</span>
            <span>No expenses yet.</span>
        </div>
    );

    return (
        <div className="list">
            {groups.map(g => (
                <MonthSection key={g.yearMonth} group={g} onDelete={onDelete} />
            ))}
        </div>
    );
}
