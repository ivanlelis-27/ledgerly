const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    const { name } = await req.json();

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return new Response(JSON.stringify({ category: null, subcategory: null }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const prompt =
      `Bill name: "${name.trim()}"\nCategories: Groceries, Food & Drink, Transport, Bills & Utilities, Subscriptions, Health, Shopping, Education, Debt & Payments, Savings & Investments\nReply ONLY with JSON: {"category":"...","subcategory":"..."}`;

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
          temperature: 0.1,
          max_tokens: 30,
          messages: [
            {
              role: "system",
              content: "You classify expenses. Reply with JSON only, no explanation.",
            },
            { role: "user", content: prompt },
          ],
        }),
      },
    );

    if (!groqRes.ok) throw new Error(`Groq ${groqRes.status}`);

    const data = await groqRes.json();
    const raw: string = data.choices?.[0]?.message?.content ?? "{}";

    let result: { category?: string; subcategory?: string } = {};
    try {
      result = JSON.parse(raw.trim());
    } catch {
      // best-effort parse — strip markdown fences if present
      const match = raw.match(/\{[^}]+\}/);
      if (match) result = JSON.parse(match[0]);
    }

    return new Response(
      JSON.stringify({
        category: result.category ?? null,
        subcategory: result.subcategory ?? null,
      }),
      { headers: { "Content-Type": "application/json", ...CORS } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message, category: null, subcategory: null }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
