import { useCallback, useEffect, useRef, useState } from "react";
import type { Expense } from "../types/expense";
import type { RecurringItem } from "../types/recurring";
import type { SalaryProfile } from "../types/salary";
import { supabase } from "./supabase";

export type InsightType = "warning" | "tip" | "positive" | "info";

export interface AiInsight {
    id: string;
    type: InsightType;
    title: string;
    body: string;
    actionLabel?: string;
    actionHref?: string;
}

interface InsightInput {
    monthExpenses: Expense[];
    prevMonthExpenses: Expense[];
    allExpenses: Expense[];
    recurring: RecurringItem[];
    salary: SalaryProfile | null;
}

function isValidInsight(v: unknown): v is AiInsight {
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    return (
        typeof o.id === "string" &&
        typeof o.type === "string" &&
        ["warning", "tip", "positive", "info"].includes(o.type as string) &&
        typeof o.title === "string" &&
        typeof o.body === "string"
    );
}

/** Deterministic fingerprint — only things that matter for advice */
function buildFingerprint(
    salary: SalaryProfile | null,
    monthExpenses: Expense[],
    recurring: RecurringItem[],
): string {
    const expTotal = monthExpenses.reduce(
        (s, e) => s + Number(e.amount || 0),
        0,
    );
    const recTotal = recurring
        .filter((r) => r.status === "active")
        .reduce((s, r) => s + Number(r.amount || 0), 0);
    return [
        salary?.monthlyIncome ?? 0,
        expTotal.toFixed(0),
        monthExpenses.length,
        recurring.filter((r) => r.status === "active").length,
        recTotal.toFixed(0),
    ].join("|");
}

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface AiInsightState {
    insights: AiInsight[];
    loading: boolean;
    error: string | null;
    generatedAt: number | null;
    refresh: () => void;
}

export function useAiInsights({
    monthExpenses,
    recurring,
    salary,
}: InsightInput): AiInsightState {
    const [insights, setInsights] = useState<AiInsight[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [generatedAt, setGeneratedAt] = useState<number | null>(null);

    // Counter that increments when the user hits "Refresh" — forces a new Groq call
    const [refreshTick, setRefreshTick] = useState(0);

    // Track the last fingerprint we successfully fetched so we can skip redundant calls
    const lastFingerprintFetched = useRef<string>("");

    const fingerprint = buildFingerprint(salary, monthExpenses, recurring);

    // Keep fresh copies of data in refs so the effect can read them without deps
    const fingerprintRef = useRef(fingerprint);
    const monthExpensesRef = useRef(monthExpenses);
    const recurringRef = useRef(recurring);
    const salaryRef = useRef(salary);
    fingerprintRef.current = fingerprint;
    monthExpensesRef.current = monthExpenses;
    recurringRef.current = recurring;
    salaryRef.current = salary;

    useEffect(() => {
        const fp = fingerprintRef.current;
        const isForced = refreshTick > 0;

        // Skip if the data hasn't changed and this isn't a manual refresh
        if (fp === lastFingerprintFetched.current && !isForced) return;

        // Skip if there's nothing to analyse yet
        if (monthExpensesRef.current.length === 0 && !salaryRef.current) {
            setInsights([]);
            setLoading(false);
            setError(null);
            lastFingerprintFetched.current = fp;
            return;
        }

        let cancelled = false;

        async function run() {
            setLoading(true);
            setError(null);

            try {
                // ── 1. Try Supabase cache first (skip on forced refresh) ──
                if (!isForced) {
                    const { data: row } = await supabase
                        .from("ai_insights_cache")
                        .select("data_hash, insights, generated_at")
                        .maybeSingle();

                    if (!cancelled && row) {
                        const age = Date.now() - Number(row.generated_at);
                        if (row.data_hash === fp && age < TTL_MS) {
                            // ✅ Cache hit — no Groq call needed
                            const cached: AiInsight[] =
                                Array.isArray(row.insights)
                                    ? (row.insights as unknown[]).filter(
                                        isValidInsight,
                                    )
                                    : [];
                            setInsights(cached);
                            setGeneratedAt(Number(row.generated_at));
                            setLoading(false);
                            lastFingerprintFetched.current = fp;
                            return;
                        }
                    }
                }

                if (cancelled) return;

                // ── 2. Cache miss or forced — call Groq ──
                const activeRecurring = recurringRef.current.filter((r) =>
                    r.status === "active"
                );

                const { data, error: fnErr } = await supabase.functions.invoke(
                    "ai-advisor",
                    {
                        body: {
                            income: salaryRef.current?.monthlyIncome ?? 0,
                            expenses: monthExpensesRef.current.map((e) => ({
                                amount: Number(e.amount),
                                category: e.category,
                                subcategory: e.subcategory || undefined,
                                date: e.date,
                            })),
                            recurring: activeRecurring.map((r) => ({
                                name: r.name,
                                amount: Number(r.amount),
                                frequency: r.frequency,
                                category: r.category,
                            })),
                        },
                    },
                );

                if (cancelled) return;
                if (fnErr) throw new Error(fnErr.message ?? "AI advisor error");

                const raw = (data as { insights?: unknown })?.insights;
                const validated: AiInsight[] = Array.isArray(raw)
                    ? (raw as unknown[]).filter(isValidInsight).slice(0, 3)
                    : [];

                const now = Date.now();

                // ── 3. Write back to Supabase cache ──
                const { data: { user } } = await supabase.auth.getUser();
                if (user && !cancelled) {
                    await supabase.from("ai_insights_cache").upsert(
                        {
                            user_id: user.id,
                            data_hash: fp,
                            insights: validated,
                            generated_at: now,
                        },
                        { onConflict: "user_id" },
                    );
                }

                if (!cancelled) {
                    setInsights(validated);
                    setGeneratedAt(now);
                    lastFingerprintFetched.current = fp;
                }
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Failed to load AI insights",
                    );
                    setInsights([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void run();
        return () => {
            cancelled = true;
        };

        // ⚠️ Only re-run when fingerprint or refreshTick changes — NOT on every render
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fingerprint, refreshTick]);

    const refresh = useCallback(() => setRefreshTick((n) => n + 1), []);

    return { insights, loading, error, generatedAt, refresh };
}
