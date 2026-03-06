import { useState, useMemo } from "react";
import type { Expense } from "../../types/expense";
import "./ExpenseList.css";

type Props = {
    expenses: Expense[];
    onDelete: (id: string) => void;
};

function fmtMoney(n: number) {
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

type CutoffGroup = {
    cutoff: 1 | 2;
    expenses: Expense[];
    total: number;
};

type MonthGroup = {
    yearMonth: string;
    cutoffs: CutoffGroup[];
    total: number;
};

function groupExpenses(expenses: Expense[]): MonthGroup[] {
    // Sort descending by date
    const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date));

    const monthMap = new Map<string, Map<1 | 2, Expense[]>>();

    for (const e of sorted) {
        const yearMonth = e.date.slice(0, 7); // "YYYY-MM"
        const cutoff = getCutoff(e.date);

        if (!monthMap.has(yearMonth)) {
            monthMap.set(yearMonth, new Map());
        }
        const cutoffMap = monthMap.get(yearMonth)!;
        if (!cutoffMap.has(cutoff)) {
            cutoffMap.set(cutoff, []);
        }
        cutoffMap.get(cutoff)!.push(e);
    }

    const result: MonthGroup[] = [];
    for (const [yearMonth, cutoffMap] of monthMap) {
        const cutoffs: CutoffGroup[] = [];
        // Always show cutoff 1 before 2 within a month
        for (const cutoff of ([1, 2] as const)) {
            const exps = cutoffMap.get(cutoff);
            if (exps && exps.length > 0) {
                const total = exps.reduce((s, e) => s + Number(e.amount), 0);
                cutoffs.push({ cutoff, expenses: exps, total });
            }
        }
        const total = cutoffs.reduce((s, c) => s + c.total, 0);
        result.push({ yearMonth, cutoffs, total });
    }

    return result;
}

function CutoffSection({ group, onDelete }: { group: CutoffGroup; onDelete: (id: string) => void }) {
    const [open, setOpen] = useState(true);

    return (
        <div className="cutoffSection">
            <button
                className="cutoffHeader"
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
            >
                <span className="chevron">{open ? "▾" : "▸"}</span>
                <span className="cutoffLabel">{cutoffLabel(group.cutoff)}</span>
                <span className="cutoffTotal">₱{fmtMoney(group.total)}</span>
                <span className="cutoffCount">{group.expenses.length} item{group.expenses.length !== 1 ? "s" : ""}</span>
            </button>

            {open && (
                <div className="cutoffItems">
                    {group.expenses.map((e) => (
                        <div className="expenseRow" key={e.id}>
                            <div className="left">
                                <div className="main">
                                    <span className="amt">₱{fmtMoney(Number(e.amount))}</span>
                                    <span className="cat">
                                        {e.category}
                                        {e.subcategory ? ` / ${e.subcategory}` : ""}
                                    </span>
                                </div>
                                <div className="meta">
                                    <span>{e.date}</span>
                                    {e.notes ? <span>• {e.notes}</span> : null}
                                    {e.paymentMethod ? <span>• {e.paymentMethod}</span> : null}
                                </div>
                            </div>
                            <button className="danger" onClick={() => onDelete(e.id)}>
                                Delete
                            </button>
                        </div>
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
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
            >
                <span className="chevron">{open ? "▾" : "▸"}</span>
                <span className="monthLabel">{monthLabel(group.yearMonth)}</span>
                <span className="monthTotal">₱{fmtMoney(group.total)}</span>
            </button>

            {open && (
                <div className="monthItems">
                    {group.cutoffs.map((c) => (
                        <CutoffSection key={c.cutoff} group={c} onDelete={onDelete} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function ExpenseList({ expenses, onDelete }: Props) {
    const groups = useMemo(() => groupExpenses(expenses), [expenses]);

    if (expenses.length === 0) return <div className="empty">No expenses yet.</div>;

    return (
        <div className="list">
            {groups.map((g) => (
                <MonthSection key={g.yearMonth} group={g} onDelete={onDelete} />
            ))}
        </div>
    );
}
