import type { PaymentMethod } from "./expense";

export const RECUR_STATUS = ["active", "paused", "cancelled", "trial"] as const;
export type RecurringStatus = (typeof RECUR_STATUS)[number];

export const RECUR_FREQUENCY = ["weekly", "biweekly", "monthly", "quarterly", "yearly", "custom"] as const;
export type RecurringFrequency = (typeof RECUR_FREQUENCY)[number];

export const RECUR_KIND = ["subscription", "utility", "rent", "insurance", "loan", "membership"] as const;
export type RecurringKind = (typeof RECUR_KIND)[number];

export const BILLING_TYPE = ["fixed", "variable"] as const;
export type BillingType = (typeof BILLING_TYPE)[number];

export const AUTO_ADD_TIMING = ["on_due", "day_before", "on_mark_paid"] as const;
export type AutoAddTiming = (typeof AUTO_ADD_TIMING)[number];

export type MonthlyDayMode = "same_day" | "last_day";
export type MissingDayRule = "move_to_last_day";


export type RecurringCycleRecord = {
    id: string;
    recurringId: string;
    cycleDueDate: string;     // YYYY-MM-DD (the due date for that cycle)
    paidDate: string;         // YYYY-MM-DD
    amount: number;
    expenseId?: string;       // link to expense
    note?: string;            // e.g. "manual amount"
    createdAt: number;
};

export type AmountChange = {
    id: string;
    recurringId: string;
    fromAmount: number;
    toAmount: number;
    effectiveDate: string;    // YYYY-MM-DD (when new amount applies)
    createdAt: number;
};

export type RecurringItem = {
    id: string;

    // Section 1 — Basic
    name: string;
    kind: RecurringKind;
    category: string;
    subcategory?: string;
    tags?: string[];

    // Section 2 — Amount
    amount: number;                 // for fixed, this is used; for variable, optional default
    billingType: BillingType;
    typicalMin?: number;
    typicalMax?: number;
    askConfirmAmountBeforeAutoAdd: boolean;

    currency: "PHP";

    // Section 3 — Schedule
    frequency: RecurringFrequency;
    customEveryDays?: number;       // if frequency=custom
    startDate: string;              // YYYY-MM-DD
    nextDueDate: string;            // YYYY-MM-DD (auto-calc but editable)
    monthlyDayMode: MonthlyDayMode; // monthly logic
    missingDayRule: MissingDayRule;

    endDate?: string;

    // Section 4 — Payment
    paymentMethod: PaymentMethod;
    cardLabel?: string;
    merchant?: string;

    // Section 5 — Automation
    autoAddExpense: boolean;
    autoAddTiming: AutoAddTiming;
    requireConfirmationBeforeAdding: boolean; // esp for variable

    // Section 6 — Status/Lifecycle
    status: RecurringStatus;
    trialEndDate?: string;
    notes?: string;

    updatedAt: number;
    createdAt: number;
};

export type RecurringFilters = {
    q: string;
    status: RecurringStatus | "all";
    frequency: RecurringFrequency | "all";
    paymentMethod: PaymentMethod | "all";
    category: string | "all";
    sort: "nextDue" | "monthlyEq" | "updated";
};
