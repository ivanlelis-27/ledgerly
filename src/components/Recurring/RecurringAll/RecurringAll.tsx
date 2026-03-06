import type { RecurringItem } from "../../../types/recurring";
import { monthlyEquivalent } from "../../../lib/recurring";
import "./RecurringAll.css";

type Props = {
    items: RecurringItem[];
    onEdit: (item: RecurringItem) => void;
};

const STATUS_COLOR: Record<string, string> = {
    active: "#10b981",
    trial: "#f59e0b",
    paused: "#94a3b8",
    cancelled: "#ef4444",
};

const FREQ_LABEL: Record<string, string> = {
    weekly: "every week",
    monthly: "every month",
    quarterly: "every 3 months",
    yearly: "every year",
    custom: "custom",
};

const PAY_EMOJI: Record<string, string> = {
    card: "💳", gcash: "📱", cash: "💵", bank: "🏦", other: "🔄",
};

function friendlyDate(iso: string): string {
    const d = new Date(iso + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diff < 0) return "⚠️ Overdue";
    if (diff === 0) return "🔴 Due today";
    if (diff === 1) return "🟡 Due tomorrow";
    if (diff <= 7) return `🟡 Due in ${diff} days`;
    return `🟢 ${d.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}`;
}

const fmtMoney = (n: number) =>
    n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function RecurringAll({ items, onEdit }: Props) {
    if (items.length === 0) {
        return (
            <div className="raEmpty">
                <div className="raEmptyIcon">📭</div>
                <div className="raEmptyTitle">Nothing here</div>
                <div className="raEmptySub">No items match your current filters.</div>
            </div>
        );
    }

    // Group by category
    const groups = new Map<string, RecurringItem[]>();
    for (const item of items) {
        const cat = item.category || "Uncategorized";
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat)!.push(item);
    }

    return (
        <div className="raList">
            {[...groups.entries()].map(([cat, catItems]) => (
                <div key={cat} className="raGroup">
                    <div className="raGroupLabel">{cat}</div>
                    {catItems.map((it) => (
                        <RecurringCard key={it.id} item={it} onEdit={onEdit} />
                    ))}
                </div>
            ))}
        </div>
    );
}

function RecurringCard({ item, onEdit }: { item: RecurringItem; onEdit: (i: RecurringItem) => void }) {
    const monthly = monthlyEquivalent(item);
    const statusColor = STATUS_COLOR[item.status] ?? "#94a3b8";

    return (
        <button className="raCard" onClick={() => onEdit(item)} type="button" aria-label={`Edit ${item.name}`}>
            {/* Left: status stripe */}
            <div className="raStripe" style={{ background: statusColor }} />

            {/* Main content */}
            <div className="raMain">
                <div className="raTop">
                    <div className="raName">{item.name}</div>
                    <div className="raAmt">₱{fmtMoney(Number(item.amount))}</div>
                </div>

                <div className="raMeta">
                    <span className="raMetaChip">
                        {FREQ_LABEL[item.frequency] ?? item.frequency}
                    </span>
                    <span className="raMetaChip">
                        {PAY_EMOJI[item.paymentMethod] ?? "🔄"} {item.paymentMethod}
                    </span>
                    {item.autoAddExpense && (
                        <span className="raMetaChip raAutoChip">⚡ Auto-add</span>
                    )}
                </div>

                <div className="raBottom">
                    <span className="raWhen">{friendlyDate(item.nextDueDate)}</span>
                    {monthly !== Number(item.amount) && (
                        <span className="raMonthly">≈ ₱{fmtMoney(monthly)}/mo</span>
                    )}
                </div>
            </div>

            {/* Status badge */}
            <div className="raStatus" style={{ color: statusColor }}>
                {item.status}
            </div>
        </button>
    );
}
