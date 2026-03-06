import { useCallback, useEffect, useState } from "react";
import type { SavingsGoal, SavingsDeposit } from "../types/savings";
import {
    fetchSavingsGoalsForUser,
    fetchSavingsDepositsForUser,
} from "./data";
import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

type SavingsResult = {
    goals: SavingsGoal[];
    deposits: SavingsDeposit[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
};

export function useSavings(): SavingsResult {
    const [goals, setGoals] = useState<SavingsGoal[]>([]);
    const [deposits, setDeposits] = useState<SavingsDeposit[]>([]);
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
                setGoals([]);
                setDeposits([]);
                setError(null);
                setLoading(false);
                return;
            }

            if (!opts?.soft) setLoading(true);
            try {
                const [g, d] = await Promise.all([
                    fetchSavingsGoalsForUser(userId),
                    fetchSavingsDepositsForUser(userId),
                ]);
                setGoals(g);
                setDeposits(d);
                setError(null);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Failed to load savings");
            } finally {
                setLoading(false);
            }
        },
        [userId]
    );

    useEffect(() => {
        if (userId === undefined) return;
        let goalChannel: RealtimeChannel | null = null;
        let depositChannel: RealtimeChannel | null = null;
        let cancelled = false;

        load();

        if (userId) {
            goalChannel = supabase
                .channel(`savings-goals-user-${userId}`)
                .on(
                    "postgres_changes",
                    { event: "*", schema: "public", table: "savings_goals", filter: `user_id=eq.${userId}` },
                    () => { if (!cancelled) void load({ soft: true }); }
                )
                .subscribe();

            depositChannel = supabase
                .channel(`savings-deposits-user-${userId}`)
                .on(
                    "postgres_changes",
                    { event: "*", schema: "public", table: "savings_deposits", filter: `user_id=eq.${userId}` },
                    () => { if (!cancelled) void load({ soft: true }); }
                )
                .subscribe();
        }

        return () => {
            cancelled = true;
            goalChannel?.unsubscribe();
            depositChannel?.unsubscribe();
        };
    }, [userId, load]);

    const refetch = useCallback(async () => {
        await load();
    }, [load]);

    return { goals, deposits, loading, error, refetch };
}
