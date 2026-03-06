import type { RecurringItem } from "../../../types/recurring";
import { formatDateLabel } from "../../../lib/recurring";
import "./UpcomingTimeline.css";

type Props = {
    items: RecurringItem[];
    onEdit: (item: RecurringItem) => void;
};

const PAY_EMOJI: Record<string, string> = {
    card: "💳", gcash: "📱", cash: "💵", bank: "🏦", other: "🔄",
};

const STATUS_COLOR: Record<string, string> = {
    active: "#10b981", trial: "#f59e0b", paused: "#94a3b8", cancelled: "#ef4444",
};

const fmtMoney = (n: number) =>
    n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function urgencyClass(iso: string): string {
    const diff = Math.round((new Date(iso + "T00:00:00").getTime() - Date.now()) / 86400000);
    if (diff < 0) return "utUrgentRed";
    if (diff <= 1) return "utUrgentRed";
    if (diff <= 3) return "utUrgentYellow";
    return "";
}

export default function UpcomingTimeline({ items, onEdit }: Props) {
    const sorted = items.slice().sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));

    if (sorted.length === 0) {
        return (
            <div className="utEmpty">
                <div className="utEmptyIcon">🎉</div>
                <div className="utEmptyTitle">You're all clear!</div>
                <div className="utEmptySub">No upcoming bills match your filters.</div>
            </div>
        );
    }

    const groups = new Map<string, RecurringItem[]>();
    for (const it of sorted) {
        const k = it.nextDueDate;
        groups.set(k, [...(groups.get(k) ?? []), it]);
    }

    const dates = [...groups.keys()].slice(0, 20);

    return (
        <div className="utTimeline">
            {dates.map((d) => (
                <div key={d} className="utDay">
                    <div className={`utDayTitle ${urgencyClass(d)}`}>
                        {formatDateLabel(d)}
                        <span className="utDayCount">
                            {(groups.get(d) ?? []).length} bill{(groups.get(d) ?? []).length > 1 ? "s" : ""}
                        </span>
                    </div>

                    <div className="utDayList">
                        {(groups.get(d) ?? []).map((it) => (
                            <button
                                key={it.id}
                                type="button"
                                className="utItem"
                                onClick={() => onEdit(it)}
                                aria-label={`Edit ${it.name}`}
                            >
                                <div
                                    className="utDot"
                                    style={{ background: STATUS_COLOR[it.status] ?? "#94a3b8" }}
                                />
                                <div className="utItemMain">
                                    <div className="utItemTop">
                                        <span className="utItemName">{it.name}</span>
                                        <span className="utItemAmt">₱{fmtMoney(Number(it.amount))}</span>
                                    </div>
                                    <div className="utItemMeta">
                                        <span>{PAY_EMOJI[it.paymentMethod] ?? "🔄"} {it.paymentMethod}</span>
                                        <span>· {it.category}</span>
                                        {it.autoAddExpense && <span className="utAutoChip">⚡ auto-add</span>}
                                    </div>
                                </div>
                                <span className="utEdit">Edit →</span>
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
