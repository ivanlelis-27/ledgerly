import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export function useHealthInsights(score: any) {
  const [insights, setInsights] = useState<any[]>([]);

  useEffect(() => {
    if (!score) return;

    async function run() {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;

      if (!userId) return;

      const fingerprint = JSON.stringify({
        income: score.monthlyIncome,
        expenses: score.monthlyExpenses,
        recurring: score.monthlyRecurring,
        savingsRate: score.savingsRate,
        goals: score.components?.find((c: any) => c.id === "goals")?.pts ?? 0,
      });

      const { data: resp, error } = await supabase.functions.invoke(
        "health-advisor",
        {
          body: {
            userId,
            fingerprint,
            score,
          },
        }
      );

      if (!error && resp?.insights) {
        setInsights(resp.insights);
      }
    }

    run();
  }, [score]);

  return insights;
}