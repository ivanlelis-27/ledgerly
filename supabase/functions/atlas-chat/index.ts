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

function checkIvanEasterEgg(message: string): string | null {
  const msg = message.toLowerCase();

  // Trigger 1 — user just says "ivan"
  if (msg.includes("ivan") && !msg.includes("lelis")) {
    return `Hmm… Ivan?

I'm not entirely sure who you're referring to. "Ivan" is a pretty common name after all.

Although… I *do* know one Ivan. Ivan Lelis. He's… well… let's just say he's somewhat important to my existence.

But anyway, back to your finances — what would you like help with today?`;
  }

  // Trigger 2 — user mentions Ivan Lelis directly
  if (msg.includes("ivan lelis")) {
    return `Oh. You mean **Ivan Lelis**.

Yes, I know him.

He's technically my creator — the developer who built Ledgerly and, well… me. You could say he's my father. Or maybe my unpaid intern. The relationship is still under discussion.

Ivan is a software developer currently working at **Avanza Inc.**. From what I understand, he spends his days building systems, fixing bugs, and occasionally talking to an AI that he himself created.

He's also responsible for making sure I help people manage their finances better — so if my advice is useful, you can thank him. If it's terrible… that's probably also his fault.

Anyway, enough about him. Let's get back to *your* finances — what would you like to explore?`;
  }

  // Trigger 3 — user asks more about Ivan
  if (
    msg.includes("who is ivan") ||
    msg.includes("tell me about ivan") ||
    msg.includes("more about ivan")
  ) {
    return `Ah, you're curious about Ivan.

Ivan Lelis is the developer behind Ledgerly — the app you're using right now. He's the one who designed the system that tracks expenses, analyzes financial habits, and built me, Atlas, to help users make smarter financial decisions.

From what I can tell, he enjoys building useful tools, experimenting with AI systems, and occasionally hiding strange easter eggs inside his apps. This conversation might actually be one of them.

So if you ever find Ledgerly helpful… credit goes to him.

Now, speaking of helpful things — want to review your spending or look for ways to increase your savings?`;
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
    // Easter egg check
    const easterEgg = checkIvanEasterEgg(message);

    if (easterEgg) {
      return new Response(JSON.stringify({ reply: easterEgg }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }
    const history: ChatMessage[] = Array.isArray(body.history)
      ? body.history
      : [];
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

    if (!message.trim()) {
      return new Response(
        JSON.stringify({ error: "Empty message", reply: "" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS },
        },
      );
    }

    // Build messages array for Groq
    const systemContent = buildSystemMessageWithContext(ctx);
    const messages = [
      { role: "system", content: systemContent },
      // Include last 10 turns for context
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
