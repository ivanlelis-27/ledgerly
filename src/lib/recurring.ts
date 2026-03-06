import type { RecurringItem } from "../types/recurring";

export function monthlyEquivalent(item: RecurringItem): number {
    const amt = Number(item.amount || 0);
    if (!Number.isFinite(amt)) return 0;

    switch (item.frequency) {
        case "weekly":
            return (amt * 52) / 12;
        case "monthly":
            return amt;
        case "quarterly":
            return amt / 3;
        case "yearly":
            return amt / 12;
        case "custom": {
            const days = item.customEveryDays && item.customEveryDays > 0 ? item.customEveryDays : 30;
            // approx: 30 days/month
            return amt * (30 / days);
        }
        default:
            return amt;
    }
}

export function inNextDays(dateISO: string, days: number): boolean {
    const today = new Date();
    const target = new Date(dateISO + "T00:00:00");
    const diffMs = target.getTime() - today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= days;
}

export function formatDateLabel(dateISO: string): string {
    // "Jan 28 (Tue)"
    const d = new Date(dateISO + "T00:00:00");
    const month = d.toLocaleString(undefined, { month: "short" });
    const day = String(d.getDate()).padStart(2, "0");
    const dow = d.toLocaleString(undefined, { weekday: "short" });
    return `${month} ${day} (${dow})`;
}

export function isActiveLike(status: string): boolean {
    return status === "active" || status === "trial";
}
