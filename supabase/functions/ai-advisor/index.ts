const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    const { income, expenses, recurring } = await req.json();

    const totalSpent: number = (expenses ?? []).reduce(
      (s: number, e: { amount: number }) => s + Number(e.amount || 0),
      0,
    );

    const categoryMap: Record<string, number> = {};
    for (const e of (expenses ?? [])) {
      categoryMap[e.category] = (categoryMap[e.category] ?? 0) +
        Number(e.amount || 0);
    }
    const topCategories = Object.entries(categoryMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amt]) => `${name}(${amt.toFixed(0)})`)
      .join(", ");

    const recurringTotal: number = (recurring ?? []).reduce(
      (s: number, r: { amount: number }) => s + Number(r.amount || 0),
      0,
    );

    const incomeNum = Number(income ?? 0);
    const leftover = incomeNum - totalSpent;
    const savingsRatePct = incomeNum > 0
      ? ((leftover / incomeNum) * 100).toFixed(1)
      : "unknown";

    const prompt =
      `You are a personal financial advisor analysing a user's finances for this month.

DATA:
- Monthly income: ₱${incomeNum}
- Total spent this month: ₱${totalSpent.toFixed(0)}
- Leftover / potential savings: ₱${leftover.toFixed(0)}
- Savings rate: ${savingsRatePct}%
- Top spending categories: ${topCategories || "none"}
- Total monthly recurring bills: ₱${recurringTotal.toFixed(0)}
- Number of transactions: ${(expenses ?? []).length}

TASK:
Generate 1 to 3 concise, actionable financial insights based on this data.
Each insight must be a JSON object with these exact fields:
  id         – a short snake_case unique string
  type       – one of: "warning", "tip", "positive", "info"
  title      – one punchy sentence (max 12 words)
  body       – two or three sentences of specific, data-driven advice
  actionLabel – (optional) short CTA text, e.g. "Review recurring →"
  actionHref  – (optional) one of: "/recurring", "/savings", "/add", "/salary"

Respond ONLY with a valid JSON array. No markdown, no code fences, no explanation.
Example format: [{"id":"...","type":"tip","title":"...","body":"..."}]`;

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
          temperature: 0.5,
          max_tokens: 250,
          messages: [
            {
              role: "system",
              content:
                "You are a precise financial advisor. You always respond with valid JSON only — no markdown, no extra text.",
            },
            { role: "user", content: prompt },
          ],
        }),
      },
    );

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      throw new Error(`Groq API error ${groqRes.status}: ${errText}`);
    }

    const data = await groqRes.json();
    const raw: string = data.choices?.[0]?.message?.content ?? "[]";

    let insights: unknown[];
    try {
      const parsed = JSON.parse(raw);
      insights = Array.isArray(parsed) ? parsed : [];
    } catch {
      insights = [];
    }

    return new Response(JSON.stringify({ insights }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message, insights: [] }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
