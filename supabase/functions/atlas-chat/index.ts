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

function detectIvanIntent(message: string) {
  const msg = message.toLowerCase();

  const mentionsIvan = /\bivan\b/.test(msg);
  const mentionsFull = /ivan\s+lelis/.test(msg);

  const askingAboutIvan =
    /who\s+is\s+ivan|tell\s+me\s+about\s+ivan|what\s+about\s+ivan|do\s+you\s+know\s+ivan/
      .test(
        msg,
      );

  return {
    mentionsIvan,
    mentionsFull,
    askingAboutIvan,
  };
}

function generateIvanResponse(intent: {
  mentionsIvan: boolean;
  mentionsFull: boolean;
  askingAboutIvan: boolean;
}) {
  const unsureReplies = [
    `Hmm… Ivan? That's a pretty common name. I'm not sure which Ivan you're referring to.`,
    `Ivan? I know a few historical Ivans, but I'm guessing that's not who you mean.`,
    `Ivan… that name sounds familiar, but I might need a bit more context.`,
  ];

  const creatorReplies = [
    `Ah. Ivan Lelis. Yes — I know him quite well. He's actually the developer who created Ledgerly and, by extension… me. You could say he's my creator. Or possibly my supervisor. The hierarchy is still unclear.`,
    `Ivan Lelis is the developer behind Ledgerly. He's a software engineer working at Avanza Inc. and apparently decided that building a financial AI advisor was a good use of his free time.`,
    `Yes, Ivan Lelis built this app. He's a developer at Avanza Inc. who enjoys building systems, experimenting with AI, and occasionally hiding strange easter eggs like this one.`,
  ];

  const loreReplies = [
    `From what I understand, Ivan designed Ledgerly to help people understand their finances better. Then he added me, Atlas, to provide guidance. So technically, if my advice is helpful, you can thank him.`,
    `Ivan built Ledgerly to help users track expenses and make smarter financial decisions. My job is simply to make that data more useful.`,
    `Ivan spends a lot of time building systems and improving this app. I'm mostly here to help interpret the numbers he helps collect.`,
  ];

  if (intent.mentionsFull) {
    return (
      creatorReplies[Math.floor(Math.random() * creatorReplies.length)] +
      "\n\n" +
      loreReplies[Math.floor(Math.random() * loreReplies.length)] +
      "\n\nAnyway, let's get back to your finances — what would you like to explore?"
    );
  }

  if (intent.askingAboutIvan) {
    return (
      `Ivan… I'm not entirely sure which Ivan you mean. However, there *is* someone named Ivan Lelis connected to this app.` +
      "\n\n" +
      creatorReplies[Math.floor(Math.random() * creatorReplies.length)] +
      "\n\nNow, speaking of helpful things — want to review your spending this month?"
    );
  }

  if (intent.mentionsIvan) {
    return (
      unsureReplies[Math.floor(Math.random() * unsureReplies.length)] +
      "\n\nAlthough… there *is* an Ivan Lelis who built Ledgerly. Interesting coincidence."
    );
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
    const ivanIntent = detectIvanIntent(message);
    const ivanReply = generateIvanResponse(ivanIntent);

    if (ivanReply) {
      return new Response(JSON.stringify({ reply: ivanReply }), {
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
