import type { MissingDayRule, MonthlyDayMode, RecurringFrequency } from "../types/recurring";

function pad2(n: number) {
    return String(n).padStart(2, "0");
}

export function toISODate(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = pad2(d.getMonth() + 1);
    const dd = pad2(d.getDate());
    return `${yyyy}-${mm}-${dd}`;
}

export function parseISO(dateISO: string): Date {
    return new Date(dateISO + "T00:00:00");
}

function lastDayOfMonth(year: number, monthIndex: number): number {
    return new Date(year, monthIndex + 1, 0).getDate();
}

export function addMonthsSafe(
    baseISO: string,
    monthsToAdd: number,
    dayMode: MonthlyDayMode,
    missingRule: MissingDayRule
): string {
    const base = parseISO(baseISO);
    const y = base.getFullYear();
    const m = base.getMonth();
    const desiredDay = base.getDate();

    const targetMonth = m + monthsToAdd;
    const target = new Date(y, targetMonth, 1);

    const maxDay = lastDayOfMonth(target.getFullYear(), target.getMonth());

    let day = desiredDay;
    if (dayMode === "last_day") day = maxDay;
    else if (day > maxDay && missingRule === "move_to_last_day") day = maxDay;

    target.setDate(day);
    return toISODate(target);
}

export function calcNextDueDate(params: {
    startDate: string;
    frequency: RecurringFrequency;
    customEveryDays?: number;
    monthlyDayMode: MonthlyDayMode;
    missingDayRule: MissingDayRule;
    todayISO?: string;
}): string {
    const {
        startDate,
        frequency,
        customEveryDays,
        monthlyDayMode,
        missingDayRule,
        todayISO,
    } = params;

    const today = todayISO ? parseISO(todayISO) : new Date();
    today.setHours(0, 0, 0, 0);

    let next = parseISO(startDate);

    // If start is in future, keep it
    if (next.getTime() >= today.getTime()) return startDate;

    // Otherwise, advance until >= today (MVP simple loop; fine for recurring)
    const advance = () => {
        if (frequency === "weekly") next.setDate(next.getDate() + 7);
        else if (frequency === "biweekly") next.setDate(next.getDate() + 14);
        else if (frequency === "monthly") {
            const nextISO = addMonthsSafe(toISODate(next), 1, monthlyDayMode, missingDayRule);
            next = parseISO(nextISO);
        } else if (frequency === "quarterly") {
            const nextISO = addMonthsSafe(toISODate(next), 3, monthlyDayMode, missingDayRule);
            next = parseISO(nextISO);
        } else if (frequency === "yearly") {
            const nextISO = addMonthsSafe(toISODate(next), 12, monthlyDayMode, missingDayRule);
            next = parseISO(nextISO);
        } else {
            const days = customEveryDays && customEveryDays > 0 ? customEveryDays : 30;
            next.setDate(next.getDate() + days);
        }
    };

    // safety cap
    for (let i = 0; i < 1000; i++) {
        advance();
        if (next.getTime() >= today.getTime()) break;
    }

    return toISODate(next);
}
