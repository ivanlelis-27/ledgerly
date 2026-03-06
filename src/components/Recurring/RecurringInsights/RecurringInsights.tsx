import type { RecurringItem } from "../../../types/recurring";
import { monthlyEquivalent } from "../../../lib/recurring";
import "./RecurringInsights.css";

type Props = { items: RecurringItem[] };

export default function RecurringInsights({ items }: Props) {
    const active = items.filter((i) => i.status !== "cancelled");

    const totalMonthlyEq = active.reduce((s, i) => s + monthlyEquivalent(i), 0);
    const yearlyLocked = active.reduce((s, i) => s + monthlyEquivalent(i) * 12, 0);

    const byCategory = (() => {
        const map = new Map<string, number>();
        for (const i of active) {
            map.set(i.category, (map.get(i.category) || 0) + monthlyEquivalent(i));
        }
        return [...map.entries()].sort((a, b) => b[1] - a[1]);
    })();

    const top5 = active
        .slice()
        .sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a))
        .slice(0, 5);

    return (
        <div className="ins">
            <div className="cards">
                <div className="card">
                    <div className="k">Total Monthly Equivalent</div>
                    <div className="v">₱{totalMonthlyEq.toFixed(2)}</div>
                </div>
                <div className="card">
                    <div className="k">Yearly locked-in cost</div>
                    <div className="v">₱{yearlyLocked.toFixed(2)}</div>
                </div>
            </div>

            <div className="split">
                <div className="panel">
                    <div className="title">Monthly Eq. by Category</div>
                    {byCategory.length === 0 ? (
                        <div className="empty">No data yet.</div>
                    ) : (
                        <div className="list">
                            {byCategory.map(([c, v]) => (
                                <div key={c} className="row">
                                    <span>{c}</span>
                                    <span>₱{v.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="panel">
                    <div className="title">Top 5 recurring costs</div>
                    {top5.length === 0 ? (
                        <div className="empty">No data yet.</div>
                    ) : (
                        <div className="list">
                            {top5.map((i) => (
                                <div key={i.id} className="row">
                                    <span>{i.name}</span>
                                    <span>₱{monthlyEquivalent(i).toFixed(2)}/mo</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="hint">Price change detection + usage insights later.</div>
                </div>
            </div>
        </div>
    );
}
