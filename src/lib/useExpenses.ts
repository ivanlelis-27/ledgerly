import { useCallback, useEffect, useState } from "react";
import type { Expense } from "../types/expense";
import { fetchExpensesForUser } from "./data";
import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

type ExpensesResult = {
    expenses: Expense[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
};

export function useExpenses(): ExpensesResult {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null | undefined>(undefined);

    useEffect(() => {
        let mounted = true;
        supabase.auth.getSession().then(({ data }) => {
            if (mounted) setUserId(data.session?.user?.id ?? null);
        });

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!mounted) return;
            setUserId(session?.user?.id ?? null);
        });

        return () => {
            mounted = false;
            sub.subscription.unsubscribe();
        };
    }, []);

    const load = useCallback(
        async (opts?: { soft?: boolean }) => {
            if (userId === undefined) return;
            if (userId === null) {
                setExpenses([]);
                setError(null);
                setLoading(false);
                return;
            }

            if (!opts?.soft) setLoading(true);
            try {
                const data = await fetchExpensesForUser(userId);
                setExpenses(data);
                setError(null);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Failed to load expenses");
            } finally {
                setLoading(false);
            }
        },
        [userId]
    );

    useEffect(() => {
        if (userId === undefined) return;
        let channel: RealtimeChannel | null = null;
        let cancelled = false;

        load();

        if (userId) {
            channel = supabase
                .channel(`expenses-user-${userId}`)
                .on(
                    "postgres_changes",
                    { event: "*", schema: "public", table: "expenses", filter: `user_id=eq.${userId}` },
                    () => {
                        if (!cancelled) void load({ soft: true });
                    }
                )
                .subscribe();
        }

        return () => {
            cancelled = true;
            channel?.unsubscribe();
        };
    }, [userId, load]);

    const refetch = useCallback(async () => {
        await load();
    }, [load]);

    return { expenses, loading, error, refetch };
}
