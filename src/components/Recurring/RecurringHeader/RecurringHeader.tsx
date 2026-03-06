import type { RecurringItem } from "../../../types/recurring";
import { inNextDays, monthlyEquivalent } from "../../../lib/recurring";
import "./RecurringHeader.css";

type Props = { items: RecurringItem[] };

const fmtMoney = (n: number) =>
    n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function friendlyDate(iso: string): string {
    const d = new Date(iso + "T00:00:00");
    const today = new Date();
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return "today";
    if (diff === 1) return "tomorrow";
    if (diff < 0) return "overdue";
    if (diff <= 7) return `in ${diff} days`;
    return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export default function RecurringHeader({ items }: Props) {
    const active = items.filter((i) => i.status !== "cancelled");
    const monthlyEq = active.reduce((sum, i) => sum + monthlyEquivalent(i), 0);
    const dueNext7 = active
        .filter((i) => inNextDays(i.nextDueDate, 7) && i.status !== "paused")
        .reduce((sum, i) => sum + Number(i.amount || 0), 0);
    const upcomingCount = active.filter((i) => inNextDays(i.nextDueDate, 7) && i.status !== "paused").length;
    const nextBill = active
        .filter((i) => i.status !== "paused")
        .slice()
        .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))[0];

    return (
        <div className="recHeader">
            <div className="rhCard">
                <div className="rhIcon" style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1" }}>📅</div>
                <div className="rhInfo">
                    <div className="rhLabel">Monthly subscriptions</div>
                    <div className="rhValue">₱{fmtMoney(monthlyEq)}</div>
                    <div className="rhSub">total recurring / month</div>
                </div>
            </div>

            <div className="rhCard">
                <div className="rhIcon" style={{ background: "rgba(245,158,11,0.12)", color: "#d97706" }}>⏰</div>
                <div className="rhInfo">
                    <div className="rhLabel">Due this week</div>
                    <div className="rhValue" style={{ color: dueNext7 > 0 ? "#d97706" : undefined }}>
                        ₱{fmtMoney(dueNext7)}
                    </div>
                    <div className="rhSub">
                        {upcomingCount > 0
                            ? `${upcomingCount} bill${upcomingCount > 1 ? "s" : ""} in the next 7 days`
                            : "Nothing due this week 🎉"}
                    </div>
                </div>
            </div>

            <div className="rhCard rhCardWide">
                <div className="rhIcon" style={{ background: "rgba(16,185,129,0.12)", color: "#059669" }}>🔔</div>
                <div className="rhInfo">
                    <div className="rhLabel">Next bill coming up</div>
                    {nextBill ? (
                        <>
                            <div className="rhValue">{nextBill.name}</div>
                            <div className="rhSub">
                                ₱{fmtMoney(Number(nextBill.amount))} &nbsp;·&nbsp;{" "}
                                <span className="rhWhen">{friendlyDate(nextBill.nextDueDate)}</span>
                            </div>
                        </>
                    ) : (
                        <div className="rhValue rhEmpty">No upcoming bills</div>
                    )}
                </div>
            </div>
        </div>
    );
}
