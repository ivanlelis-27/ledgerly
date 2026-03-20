import { PAYMENT_METHODS } from "../types/expense";
import type { Expense, PaymentMethod } from "../types/expense";
import type { RecurringItem } from "../types/recurring";
import type { SalaryProfile, IncomeFrequency } from "../types/salary";
import type { SavingsDeposit, SavingsGoal } from "../types/savings";
import type { UserSettings } from "../types/settings";
import { DEFAULT_SETTINGS } from "../types/settings";
import { supabase } from "./supabase";

async function requireUserId(explicit?: string): Promise<string> {
    if (explicit) return explicit;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const userId = data.session?.user?.id;
    if (!userId) throw new Error("You must be logged in.");
    return userId;
}

function normalizePaymentMethod(pm: string | null): PaymentMethod {
    return PAYMENT_METHODS.includes(pm as PaymentMethod)
        ? (pm as PaymentMethod)
        : "cash";
}

function mapExpenseRow(row: any): Expense {
    return {
        id: row.id,
        amount: Number(row.amount ?? 0),
        date: row.date,
        category: row.category,
        subcategory: row.subcategory ?? "",
        notes: row.notes ?? "",
        paymentMethod: normalizePaymentMethod(row.payment_method),
        tags: row.tags ?? [],
        createdAt: row.created_at_ms ?? Date.now(),
    };
}

function expenseToRow(expense: Expense, userId: string) {
    return {
        id: expense.id,
        user_id: userId,
        amount: Number(expense.amount || 0),
        date: expense.date,
        category: expense.category,
        subcategory: expense.subcategory?.trim()
            ? expense.subcategory.trim()
            : null,
        notes: expense.notes?.trim() ? expense.notes.trim() : null,
        payment_method: expense.paymentMethod,
        tags: expense.tags ?? [],
        created_at_ms: expense.createdAt ?? Date.now(),
    };
}

export async function fetchExpensesForUser(
    userId?: string,
): Promise<Expense[]> {
    const target = await requireUserId(userId);
    const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", target)
        .order("created_at_ms", { ascending: false });

    if (error) throw error;
    const rows = (data ?? []).map(mapExpenseRow);
    return rows;
}

export async function insertExpense(expense: Expense, userId?: string) {
    const target = await requireUserId(userId);
    const payload = expenseToRow(expense, target);
    const { error } = await supabase.from("expenses").insert([payload]);
    if (error) throw error;
}

export async function removeExpense(id: string, userId?: string) {
    const target = await requireUserId(userId);
    const { error } = await supabase.from("expenses").delete().eq(
        "user_id",
        target,
    ).eq("id", id);
    if (error) throw error;
}

function mapRecurringRow(row: any): RecurringItem {
    return {
        id: row.id,
        name: row.name,
        kind: row.kind,
        category: row.category,
        subcategory: row.subcategory ?? "",
        tags: row.tags ?? [],
        amount: Number(row.amount ?? 0),
        billingType: row.billing_type ?? "fixed",
        typicalMin: row.typical_min ?? undefined,
        typicalMax: row.typical_max ?? undefined,
        askConfirmAmountBeforeAutoAdd: !!row.ask_confirm_amount_before_auto_add,
        currency: row.currency ?? "PHP",
        frequency: row.frequency,
        customEveryDays: row.custom_every_days ?? undefined,
        startDate: row.start_date,
        nextDueDate: row.next_due_date,
        monthlyDayMode: row.monthly_day_mode ?? "same_day",
        missingDayRule: row.missing_day_rule ?? "move_to_last_day",
        endDate: row.end_date ?? "",
        paymentMethod: normalizePaymentMethod(row.payment_method ?? "cash"),
        cardLabel: row.card_label ?? "",
        merchant: row.merchant ?? "",
        autoAddExpense: row.auto_add_expense ?? true,
        autoAddTiming: row.auto_add_timing ?? "on_due",
        requireConfirmationBeforeAdding:
            row.require_confirmation_before_adding ?? false,
        status: row.status ?? "active",
        trialEndDate: row.trial_end_date ?? "",
        notes: row.notes ?? "",
        updatedAt: row.updated_at_ms ?? Date.now(),
        createdAt: row.created_at_ms ?? Date.now(),
    };
}

function recurringToRow(item: RecurringItem, userId: string) {
    return {
        id: item.id,
        user_id: userId,
        name: item.name,
        kind: item.kind,
        category: item.category,
        subcategory: item.subcategory?.trim() ? item.subcategory.trim() : null,
        tags: item.tags ?? [],
        amount: item.amount,
        billing_type: item.billingType,
        typical_min: item.typicalMin ?? null,
        typical_max: item.typicalMax ?? null,
        ask_confirm_amount_before_auto_add:
            item.askConfirmAmountBeforeAutoAdd ?? false,
        currency: item.currency,
        frequency: item.frequency,
        custom_every_days: item.frequency === "custom"
            ? item.customEveryDays ?? null
            : null,
        start_date: item.startDate,
        next_due_date: item.nextDueDate,
        monthly_day_mode: item.monthlyDayMode,
        missing_day_rule: item.missingDayRule,
        end_date: item.endDate?.trim() ? item.endDate.trim() : null,
        payment_method: item.paymentMethod,
        card_label: item.cardLabel?.trim() ? item.cardLabel.trim() : null,
        merchant: item.merchant?.trim() ? item.merchant.trim() : null,
        auto_add_expense: item.autoAddExpense ?? true,
        auto_add_timing: item.autoAddTiming,
        require_confirmation_before_adding:
            item.requireConfirmationBeforeAdding ?? false,
        status: item.status,
        trial_end_date: item.trialEndDate?.trim()
            ? item.trialEndDate.trim()
            : null,
        notes: item.notes?.trim() ? item.notes.trim() : null,
        updated_at_ms: item.updatedAt ?? Date.now(),
        created_at_ms: item.createdAt ?? Date.now(),
    };
}

export async function fetchRecurringItemsForUser(
    userId?: string,
): Promise<RecurringItem[]> {
    const target = await requireUserId(userId);
    const { data, error } = await supabase
        .from("recurring_items")
        .select("*")
        .eq("user_id", target)
        .order("created_at_ms", { ascending: false });

    if (error) throw error;
    const rows = (data ?? []).map(mapRecurringRow);
    return rows;
}

export async function upsertRecurringItem(
    item: RecurringItem,
    userId?: string,
) {
    const target = await requireUserId(userId);
    const row = recurringToRow(item, target);
    const { error } = await supabase.from("recurring_items").upsert([row], {
        onConflict: "id",
    });
    if (error) throw error;
}

export async function deleteRecurringItem(id: string, userId?: string) {
    const target = await requireUserId(userId);
    const { error } = await supabase.from("recurring_items").delete().eq(
        "user_id",
        target,
    ).eq("id", id);
    if (error) throw error;
}

export async function fetchSalaryProfileForUser(
    userId?: string,
): Promise<SalaryProfile | null> {
    const target = await requireUserId(userId);
    const { data, error } = await supabase
        .from("salary_profile")
        .select("*")
        .eq("user_id", target)
        .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;
    if (!data) return null;

    const c1Gross = Number(data.cutoff1_gross || 0);
    const c1Ded = Number(data.cutoff1_deductions || 0);
    const c1Net = Number(data.cutoff1_net || (c1Gross - c1Ded));
    const c2Gross = Number(data.cutoff2_gross || 0);
    const c2Ded = Number(data.cutoff2_deductions || 0);
    const c2Net = Number(data.cutoff2_net || (c2Gross - c2Ded));
    const c3Gross = Number(data.cutoff3_gross || 0);
    const c3Ded = Number(data.cutoff3_deductions || 0);
    const c3Net = Number(data.cutoff3_net || (c3Gross - c3Ded));
    const c4Gross = Number(data.cutoff4_gross || 0);
    const c4Ded = Number(data.cutoff4_deductions || 0);
    const c4Net = Number(data.cutoff4_net || (c4Gross - c4Ded));

    const monthlyIncome = Number(data.monthly_income || 0);

    const profile: SalaryProfile = {
        monthlyIncome,
        updatedAt: data.updated_at_ms ?? Date.now(),
        frequency: data.frequency ?? "bi-weekly",
        source: data.source ?? "Salary",
        cutoff1Gross: c1Gross,
        cutoff1Deductions: c1Ded,
        cutoff1Net: c1Net,
        cutoff2Gross: c2Gross,
        cutoff2Deductions: c2Ded,
        cutoff2Net: c2Net,
        cutoff3Gross: c3Gross,
        cutoff3Deductions: c3Ded,
        cutoff3Net: c3Net,
        cutoff4Gross: c4Gross,
        cutoff4Deductions: c4Ded,
        cutoff4Net: c4Net,
        pockets: data.pockets ?? [],
    };
    return profile;
}

export type UpsertSalaryPayload = {
    monthlyIncome?: number;
    frequency?: IncomeFrequency;
    source?: string;
    pockets?: any[];
    cutoff1Gross?: number;
    cutoff1Deductions?: number;
    cutoff2Gross?: number;
    cutoff2Deductions?: number;
    cutoff3Gross?: number;
    cutoff3Deductions?: number;
    cutoff4Gross?: number;
    cutoff4Deductions?: number;
};

export async function upsertSalaryProfile(
    payload: UpsertSalaryPayload | number,
    userId?: string,
    opts?: { updatedAt?: number },
) {
    const target = await requireUserId(userId);
    const now = opts?.updatedAt ?? Date.now();

    const p: UpsertSalaryPayload = typeof payload === "number"
        ? { monthlyIncome: payload }
        : payload;

    const c1Gross = p.cutoff1Gross ?? 0;
    const c1Ded = p.cutoff1Deductions ?? 0;
    const c1Net = c1Gross - c1Ded;
    const c2Gross = p.cutoff2Gross ?? 0;
    const c2Ded = p.cutoff2Deductions ?? 0;
    const c2Net = c2Gross - c2Ded;
    const c3Gross = p.cutoff3Gross ?? 0;
    const c3Ded = p.cutoff3Deductions ?? 0;
    const c3Net = c3Gross - c3Ded;
    const c4Gross = p.cutoff4Gross ?? 0;
    const c4Ded = p.cutoff4Deductions ?? 0;
    const c4Net = c4Gross - c4Ded;

    // Monthly income is sum of active cutoffs based on frequency
    let monthlyIncome = p.monthlyIncome ?? 0;
    if (p.frequency === "monthly") monthlyIncome = c1Net;
    else if (p.frequency === "bi-weekly") monthlyIncome = c1Net + c2Net;
    else if (p.frequency === "weekly") monthlyIncome = c1Net + c2Net + c3Net + c4Net;
    else if (c1Gross > 0 || c2Gross > 0) monthlyIncome = c1Net + c2Net; // Legacy

    const { error } = await supabase
        .from("salary_profile")
        .upsert(
            {
                user_id: target,
                monthly_income: Number(monthlyIncome),
                frequency: p.frequency || "bi-weekly",
                source: p.source || "Salary",
                cutoff1_gross: c1Gross,
                cutoff1_deductions: c1Ded,
                cutoff1_net: c1Net,
                cutoff2_gross: c2Gross,
                cutoff2_deductions: c2Ded,
                cutoff2_net: c2Net,
                cutoff3_gross: c3Gross,
                cutoff3_deductions: c3Ded,
                cutoff3_net: c3Net,
                cutoff4_gross: c4Gross,
                cutoff4_deductions: c4Ded,
                cutoff4_net: c4Net,
                pockets: p.pockets !== undefined ? p.pockets : undefined,
                updated_at_ms: now,
            },
            { onConflict: "user_id" },
        );

    if (error) throw error;
}

export async function updatePockets(pockets: any[], userId?: string) {
    const target = await requireUserId(userId);
    const { error } = await supabase
        .from("salary_profile")
        .update({ pockets, updated_at_ms: Date.now() })
        .eq("user_id", target);
    if (error) throw error;
}

export type CloudBackup = {
    expenses?: Expense[];
    recurring?: RecurringItem[];
    salary?: SalaryProfile | null;
};

export async function exportCloudData(userId?: string): Promise<CloudBackup> {
    const target = await requireUserId(userId);
    const [expenses, recurring, salary] = await Promise.all([
        fetchExpensesForUser(target),
        fetchRecurringItemsForUser(target),
        fetchSalaryProfileForUser(target),
    ]);

    return {
        expenses,
        recurring,
        salary: salary ?? {
            monthlyIncome: 0,
            updatedAt: Date.now(),
            frequency: "bi-weekly",
            source: "Salary",
            cutoff1Gross: 0,
            cutoff1Deductions: 0,
            cutoff1Net: 0,
            cutoff2Gross: 0,
            cutoff2Deductions: 0,
            cutoff2Net: 0,
            cutoff3Gross: 0,
            cutoff3Deductions: 0,
            cutoff3Net: 0,
            cutoff4Gross: 0,
            cutoff4Deductions: 0,
            cutoff4Net: 0,
        },
    };
}

function chunk<T>(list: T[], size: number) {
    const chunks: T[][] = [];
    for (let i = 0; i < list.length; i += size) {
        chunks.push(list.slice(i, i + size));
    }
    return chunks;
}

export async function importCloudData(snapshot: CloudBackup, userId?: string) {
    const target = await requireUserId(userId);
    const expenses = Array.isArray(snapshot.expenses) ? snapshot.expenses : [];
    const recurring = Array.isArray(snapshot.recurring)
        ? snapshot.recurring
        : [];
    const salary = snapshot.salary ?? null;

    await supabase.from("expenses").delete().eq("user_id", target);
    if (expenses.length > 0) {
        const rows = expenses.map((expense) => expenseToRow(expense, target));
        for (const batch of chunk(rows, 500)) {
            const { error } = await supabase.from("expenses").upsert(batch, {
                onConflict: "id",
            });
            if (error) throw error;
        }
    }

    await supabase.from("recurring_items").delete().eq("user_id", target);
    if (recurring.length > 0) {
        const rows = recurring.map((item) => recurringToRow(item, target));
        for (const batch of chunk(rows, 300)) {
            const { error } = await supabase.from("recurring_items").upsert(
                batch,
                { onConflict: "id" },
            );
            if (error) throw error;
        }
    }

    if (salary) {
        await upsertSalaryProfile(salary.monthlyIncome, target, {
            updatedAt: salary.updatedAt,
        });
    } else {
        await supabase.from("salary_profile").delete().eq("user_id", target);
    }
}

// ============================================================
// Savings Goals
// ============================================================

function mapGoalRow(row: any): SavingsGoal {
    return {
        id: row.id,
        name: row.name,
        targetAmount: Number(row.target_amount ?? 0),
        currentAmount: Number(row.current_amount ?? 0),
        emoji: row.emoji ?? undefined,
        color: row.color ?? undefined,
        deadline: row.deadline ?? undefined,
        notes: row.notes ?? undefined,
        status: row.status ?? "active",
        createdAt: row.created_at_ms ?? Date.now(),
        updatedAt: row.updated_at_ms ?? Date.now(),
    };
}

function goalToRow(goal: SavingsGoal, userId: string) {
    return {
        id: goal.id,
        user_id: userId,
        name: goal.name,
        target_amount: Number(goal.targetAmount || 0),
        current_amount: Number(goal.currentAmount || 0),
        emoji: goal.emoji?.trim() || null,
        color: goal.color?.trim() || null,
        deadline: goal.deadline?.trim() || null,
        notes: goal.notes?.trim() || null,
        status: goal.status,
        created_at_ms: goal.createdAt ?? Date.now(),
        updated_at_ms: goal.updatedAt ?? Date.now(),
    };
}

export async function fetchSavingsGoalsForUser(
    userId?: string,
): Promise<SavingsGoal[]> {
    const target = await requireUserId(userId);
    const { data, error } = await supabase
        .from("savings_goals")
        .select("*")
        .eq("user_id", target)
        .order("created_at_ms", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapGoalRow);
}

export async function upsertSavingsGoal(goal: SavingsGoal, userId?: string) {
    const target = await requireUserId(userId);
    const row = goalToRow(goal, target);
    const { error } = await supabase.from("savings_goals").upsert([row], {
        onConflict: "id",
    });
    if (error) throw error;
}

export async function deleteSavingsGoal(id: string, userId?: string) {
    const target = await requireUserId(userId);
    const { error } = await supabase.from("savings_goals").delete().eq(
        "user_id",
        target,
    ).eq("id", id);
    if (error) throw error;
}

// ============================================================
// Savings Deposits
// ============================================================

function mapDepositRow(row: any): SavingsDeposit {
    return {
        id: row.id,
        goalId: row.goal_id,
        amount: Number(row.amount ?? 0),
        date: row.date,
        note: row.note ?? undefined,
        createdAt: row.created_at_ms ?? Date.now(),
    };
}

export async function fetchSavingsDepositsForUser(
    userId?: string,
): Promise<SavingsDeposit[]> {
    const target = await requireUserId(userId);
    const { data, error } = await supabase
        .from("savings_deposits")
        .select("*")
        .eq("user_id", target)
        .order("created_at_ms", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapDepositRow);
}

export async function addSavingsDeposit(
    deposit: SavingsDeposit,
    userId?: string,
) {
    const target = await requireUserId(userId);

    const { error: depErr } = await supabase.from("savings_deposits").insert([{
        id: deposit.id,
        user_id: target,
        goal_id: deposit.goalId,
        amount: Number(deposit.amount),
        date: deposit.date,
        note: deposit.note?.trim() || null,
        created_at_ms: deposit.createdAt ?? Date.now(),
    }]);
    if (depErr) throw depErr;

    const { data: goalData, error: fetchErr } = await supabase
        .from("savings_goals")
        .select("current_amount, target_amount")
        .eq("id", deposit.goalId)
        .eq("user_id", target)
        .single();
    if (fetchErr) throw fetchErr;

    const newAmount = Number(goalData.current_amount) + Number(deposit.amount);
    const autoComplete = newAmount >= Number(goalData.target_amount);

    const updatePayload: Record<string, unknown> = {
        current_amount: newAmount,
        updated_at_ms: Date.now(),
    };
    if (autoComplete) updatePayload.status = "completed";

    const { error: updateErr } = await supabase
        .from("savings_goals")
        .update(updatePayload)
        .eq("id", deposit.goalId)
        .eq("user_id", target);
    if (updateErr) throw updateErr;
}

// ============================================================
// User Settings
// ============================================================

export async function fetchUserSettings(userId?: string): Promise<UserSettings> {
    try {
        const target = userId || (await supabase.auth.getUser()).data.user?.id;
        if (!target) return DEFAULT_SETTINGS;

        const { data, error } = await supabase
            .from("user_settings")
            .select("*")
            .eq("user_id", target)
            .maybeSingle();

        if (error && error.code !== "PGRST116") throw error;
        if (!data) return DEFAULT_SETTINGS;

        return {
            ...DEFAULT_SETTINGS,
            currency: data.currency ?? DEFAULT_SETTINGS.currency,
            dateFmt: data.date_fmt ?? DEFAULT_SETTINGS.dateFmt,
            defaultPM: data.default_pm ?? DEFAULT_SETTINGS.defaultPM,
            weekStart: data.week_start ?? DEFAULT_SETTINGS.weekStart,
            compactNums: data.compact_nums ?? DEFAULT_SETTINGS.compactNums,
            showCents: data.show_cents ?? DEFAULT_SETTINGS.showCents,
            userType: data.user_type ?? DEFAULT_SETTINGS.userType,
            financialGoal: data.financial_goal ?? DEFAULT_SETTINGS.financialGoal,
            budgetStyle: data.budget_style ?? DEFAULT_SETTINGS.budgetStyle,
            focusCategories: data.focus_categories ?? DEFAULT_SETTINGS.focusCategories,
            onboardingCompleted: data.onboarding_completed ?? DEFAULT_SETTINGS.onboardingCompleted,
            updatedAt: data.updated_at_ms ?? DEFAULT_SETTINGS.updatedAt,
        };
    } catch (err) {
        console.error("fetchUserSettings error:", err);
        return DEFAULT_SETTINGS;
    }
}

export async function upsertUserSettings(
    settings: UserSettings,
    userId?: string,
) {
    try {
        const target = userId || (await supabase.auth.getUser()).data.user?.id;
        if (!target) throw new Error("No user ID for settings upsert");

        const { error } = await supabase
            .from("user_settings")
            .upsert(
                {
                    user_id: target,
                    currency: settings.currency,
                    date_fmt: settings.dateFmt,
                    default_pm: settings.defaultPM,
                    week_start: settings.weekStart,
                    compact_nums: settings.compactNums,
                    show_cents: settings.showCents,
                    user_type: settings.userType,
                    financial_goal: settings.financialGoal,
                    budget_style: settings.budgetStyle,
                    focus_categories: settings.focusCategories,
                    onboarding_completed: settings.onboardingCompleted,
                    updated_at_ms: settings.updatedAt ?? Date.now(),
                },
                { onConflict: "user_id" },
            );

        if (error) throw error;
    } catch (err) {
        console.error("upsertUserSettings error:", err);
        throw err;
    }
}
