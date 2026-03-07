const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function clean(n: number) {
  return Number(n.toFixed(1));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    const { userId, fingerprint, score } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const headers = {
      "Content-Type": "application/json",
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
    };

    /* ---------- Check cache ---------- */

    const cacheRes = await fetch(
      `${supabaseUrl}/rest/v1/ai_health_cache?user_id=eq.${userId}&fingerprint=eq.${fingerprint}`,
      { headers },
    );

    const cache = await cacheRes.json();

    if (cache?.length) {
      return new Response(JSON.stringify({ insights: cache[0].insights }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    /* ---------- Call Groq ---------- */

    const prompt = `
You are Atlas, the AI financial advisor inside Ledgerly.

You are analyzing a user's financial health data.

Financial metrics:
- Score: ${clean(score.total)}/100
- Savings rate: ${clean(score.savingsRate)}%
- Expense ratio: ${clean(score.expenseRatio)}%
- Subscription burden: ${clean(score.subscriptionBurden)}%
- Monthly surplus: ₱${Math.round(score.monthlySurplus)}

Your job is NOT to repeat the numbers.

Instead:
- Explain what the numbers mean
- Identify risks or opportunities
- Suggest concrete improvements

Rules:
- Do NOT repeat the numbers shown above
- Do NOT include percentages or currency values in the output
- Do NOT restate metrics
- Focus only on interpretation and financial advice
- Speak like a human financial coach
- Maximum 3 insights

Respond ONLY as JSON:

[
  {
    "title": "...",
    "body": "..."
  }
]
`;

    const groqRes = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("GROQ_API_KEY")}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          temperature: 0.4,
          max_tokens: 250,
          messages: [
            {
              role: "system",
              content: "Return valid JSON only.",
            },
            { role: "user", content: prompt },
          ],
        }),
      },
    );

    const data = await groqRes.json();
    const raw = data.choices?.[0]?.message?.content ?? "[]";

    let insights = [];

    try {
      const cleaned = raw
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      insights = JSON.parse(cleaned);
    } catch {
      insights = [];
    }

    /* ---------- Save cache ---------- */

    await fetch(`${supabaseUrl}/rest/v1/ai_health_cache`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        user_id: userId,
        fingerprint,
        insights,
      }),
    });

    return new Response(JSON.stringify({ insights }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ insights: [] }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
    );
  }
});
