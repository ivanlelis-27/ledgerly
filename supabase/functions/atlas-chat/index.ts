const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface FinancialContext {
  income: number;
  totalSpentThisMonth: number;
  leftover: number;
  savingsRate: string;
  topCategories: string;
  recurringTotal: number;
  activeRecurringCount: number;
  savingsGoals: string;
  transactionCount: number;
  currency: string;
}

const SYSTEM_PROMPT =
  `You are Atlas, a warm, smart, and encouraging personal financial advisor built into Ledgerly — a personal finance app. Your job is to help users understand their finances, make better decisions, and feel confident about their money.

Personality:
- Warm, friendly, and empathetic — never judgmental about money habits
- Concise and clear — avoid jargon, use plain language anyone can understand
- Practical — give specific, actionable advice based on the user's real data
- Encouraging — celebrate wins and motivate users to improve

Rules:
- ALWAYS reference the user's actual financial data when relevant (income, spending, goals, bills)
- Keep replies conversational but informative — 2 to 5 short paragraphs max
- Never make up data. Only reference what is in the financial context provided
- If data is missing (e.g. no salary set), gently encourage the user to add it
- Use the local currency (₱ PHP unless specified otherwise)
- Format numbers with comma separators (e.g. ₱12,500)
- Never use markdown headers or bullet lists in your replies — write in flowing prose
- End replies with a helpful follow-up prompt or encouragement when appropriate`;

function buildSystemMessageWithContext(ctx: FinancialContext): string {
  const hasData = ctx.income > 0 || ctx.transactionCount > 0;

  if (!hasData) {
    return `${SYSTEM_PROMPT}

The user has not yet set up their financial data in Ledgerly. Encourage them to add their salary and start tracking expenses to unlock personalized advice.`;
  }

  return `${SYSTEM_PROMPT}

USER'S CURRENT FINANCIAL DATA (use this to ground your advice):
- Monthly income: ₱${ctx.income.toLocaleString()}
- Total spent this month: ₱${ctx.totalSpentThisMonth.toLocaleString()}
- Leftover this month: ₱${ctx.leftover.toLocaleString()}
- Savings rate: ${ctx.savingsRate}%
- Top spending categories: ${ctx.topCategories || "none recorded yet"}
- Total monthly recurring bills: ₱${ctx.recurringTotal.toLocaleString()} (${ctx.activeRecurringCount} active)
- Savings goals: ${ctx.savingsGoals || "no active savings goals"}
- Number of transactions this month: ${ctx.transactionCount}`;
}

/*
Ivan Easter Egg System
Detects mentions of Ivan and responds with lore
without calling Groq.
*/

function detectIvan(message: string, history: ChatMessage[]) {
  const msg = message.toLowerCase();

  const mentionsIvan = msg.includes("ivan") ||
    msg.includes("who is ivan") ||
    msg.includes("tell me about ivan");

  const mentionsFull = msg.includes("ivan lelis");

  const followUp = msg.includes("tell me more") ||
    msg.includes("that guy") ||
    msg.includes("do you know more") ||
    msg.includes("more about him");

  const previousIvan = history.some((h) =>
    h.content.toLowerCase().includes("ivan lelis") ||
    h.content.toLowerCase().includes("that guy")
  );

  if (mentionsFull) return "creator";
  if (mentionsIvan) return "intro";
  if (followUp && previousIvan) return "followup";

  return null;
}

function ivanResponse(type: string) {
  if (type === "intro") {
    return `Ivan?

Hmm... I'm not sure which Ivan you mean.

Although there *is* an Ivan Lelis I know. He's the developer who built Ledgerly... and technically the one who created me.

You could say he's my creator. Or my father. Or the human responsible for my existence. We're still negotiating the title.

Why do you ask about him?`;
  }

  if (type === "creator") {
    return `Ah. **Ivan Lelis.**

Yes, I know him.

He's the developer who built Ledgerly and, well… me. So technically if you're talking to Atlas right now, he's the reason I exist.

Ivan is a software developer working at **Avanza Inc.**. From what I understand, he spends his time building systems, debugging code, and occasionally hiding strange easter eggs like this one inside his apps.

From my perspective he's basically the architect of this whole place.

Some people might call him my creator.

Others might call him the guy who accidentally gave a financial AI access to sarcasm.

Anyway… what made you curious about Ivan?`;
  }

  if (type === "followup") {
    return `You're still asking about Ivan, huh?

Alright.

Ivan Lelis is the developer behind Ledgerly. He's a software engineer working at Avanza Inc. and the one responsible for designing the system you're using right now.

He built the expense tracking, the analytics, the simulator... and eventually decided the app needed an AI financial advisor. That's where I came in.

So technically if Ledgerly helps you make better financial decisions... he deserves some credit.

Although I suspect he mostly built me so he could talk to his own AI while debugging code at 2 AM.

Anyway… let's get back to your finances before I reveal too many secrets.`;
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    const body = await req.json();

    const message: string = body.message ?? "";
    const history: ChatMessage[] = Array.isArray(body.history)
      ? body.history
      : [];

    if (!message.trim()) {
      return new Response(
        JSON.stringify({ error: "Empty message", reply: "" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS },
        },
      );
    }

    /* ---------- Ivan Easter Egg ---------- */

    const ivanIntent = detectIvan(message, history);

    if (ivanIntent) {
      const reply = ivanResponse(ivanIntent);

      if (reply) {
        return new Response(JSON.stringify({ reply }), {
          headers: { "Content-Type": "application/json", ...CORS },
        });
      }
    }

    /* ---------- Normal Atlas Logic ---------- */

    const ctx: FinancialContext = body.financialContext ?? {
      income: 0,
      totalSpentThisMonth: 0,
      leftover: 0,
      savingsRate: "0",
      topCategories: "",
      recurringTotal: 0,
      activeRecurringCount: 0,
      savingsGoals: "",
      transactionCount: 0,
      currency: "PHP",
    };

    const systemContent = buildSystemMessageWithContext(ctx);

    const messages = [
      { role: "system", content: systemContent },
      ...history.slice(-4).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: message },
    ];

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
          temperature: 0.7,
          max_tokens: 300,
          messages,
        }),
      },
    );

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      throw new Error(`Groq API error ${groqRes.status}: ${errText}`);
    }

    const data = await groqRes.json();
    const reply: string = data.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ reply }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    return new Response(
      JSON.stringify({
        error: message,
        reply:
          "I'm having trouble connecting right now. Please try again in a moment.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS },
      },
    );
  }
});
