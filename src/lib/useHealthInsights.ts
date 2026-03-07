import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export function useHealthInsights(score: any) {
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!score) return;

    async function run() {
      setLoading(true);

      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;

      if (!userId) {
        setLoading(false);
        return;
      }

      const fingerprint = JSON.stringify({
        income: score.monthlyIncome,
        expenses: score.monthlyExpenses,
        recurring: score.monthlyRecurring,
        savingsRate: Number(score.savingsRate.toFixed(1)),
        expenseRatio: Number(score.expenseRatio.toFixed(1)),
        subscriptionBurden: Number(score.subscriptionBurden.toFixed(1)),
        score: score.total,
      });

      const { data: resp, error } = await supabase.functions.invoke(
        "health-advisor",
        {
          body: {
            userId,
            fingerprint,
            score,
          },
        },
      );

      if (!error && resp?.insights) {
        setInsights(resp.insights);
      }

      setLoading(false);
    }

    run();
  }, [score]);

  return { insights, loading };
}