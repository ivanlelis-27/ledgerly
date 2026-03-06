export const PAYMENT_METHODS = ["cash", "gcash", "card", "bank", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
import type { RecurringItem } from "./recurring";
import type { SalaryProfile } from "./salary";

export type Expense = {
    id: string;
    amount: number;
    date: string; // YYYY-MM-DD
    category: string;
    subcategory?: string;
    notes?: string;
    paymentMethod: PaymentMethod;
    tags?: string[];
    createdAt: number;
};

export type RecentCategory = {
    category: string;
    subcategory: string; // keep as "" if none
    lastUsedAt: number;
};

export type DBShape = {
    expenses: Expense[];
    recurring: RecurringItem[];
    recentCategories: RecentCategory[];
    salary?: SalaryProfile;
};
