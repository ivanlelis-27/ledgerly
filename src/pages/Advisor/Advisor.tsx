import { useCallback, useEffect, useRef, useState } from "react";
import { useExpenses } from "../../lib/useExpenses";
import { useRecurringItems } from "../../lib/useRecurringItems";
import { useSalaryProfile } from "../../lib/useSalaryProfile";
import { useSavings } from "../../lib/useSavings";
import { useAiInsights } from "../../lib/useAiInsights";
import { supabase } from "../../lib/supabase";
import "./Advisor.css";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: number;
}

type MobileTab = "insights" | "chat";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
    return "₱" + Math.round(n).toLocaleString("en-PH");
}

function pct(part: number, whole: number) {
    if (!whole) return "0";
    return ((part / whole) * 100).toFixed(1);
}

function getMonthExpenses(expenses: { date: string; amount: number; category: string }[]) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return expenses.filter((e) => {
        const d = new Date(e.date);
        return d.getFullYear() === y && d.getMonth() === m;
    });
}

function buildFinancialContext(
    income: number,
    monthExpenses: { date: string; amount: number; category: string }[],
    recurring: { status: string; amount: number; name: string; category: string }[],
    goals: { name: string; targetAmount: number; currentAmount: number; status: string }[],
) {
    const totalSpent = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const leftover = income - totalSpent;
    const savingsRate = income > 0 ? ((leftover / income) * 100).toFixed(1) : "0";

    const catMap: Record<string, number> = {};
    for (const e of monthExpenses) {
        catMap[e.category] = (catMap[e.category] ?? 0) + Number(e.amount);
    }
    const topCategories = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([n, a]) => `${n}: ${fmt(a)}`)
        .join(", ");

    const activeRec = recurring.filter((r) => r.status === "active");
    const recurringTotal = activeRec.reduce((s, r) => s + Number(r.amount), 0);

    const activeGoals = goals.filter((g) => g.status === "active");
    const savingsGoals = activeGoals
        .map((g) => `${g.name} (${fmt(g.currentAmount)} of ${fmt(g.targetAmount)})`)
        .join(", ");

    return {
        income,
        totalSpentThisMonth: totalSpent,
        leftover,
        savingsRate,
        topCategories,
        recurringTotal,
        activeRecurringCount: activeRec.length,
        savingsGoals,
        transactionCount: monthExpenses.length,
        currency: "PHP",
    };
}

const SUGGESTED_QUESTIONS = [
    "How am I doing this month?",
    "Where am I overspending?",
    "Should I cut any subscriptions?",
    "How can I reach my savings goals faster?",
];

const ATLAS_WELCOME = `Hi there! I'm Atlas, your personal financial advisor here in Ledgerly. I have access to all your financial data — your income, spending, recurring bills, and savings goals — so I can give you real, personalized advice.

Ask me anything about your finances. I'm here to help you make sense of your money and feel confident about every decision.`;

// ─── Component ───────────────────────────────────────────────────────────────

export default function Advisor() {
    const { expenses } = useExpenses();
    const { recurring } = useRecurringItems();
    const { profile: salaryProfile } = useSalaryProfile();
    const { goals } = useSavings();

    const monthExpenses = getMonthExpenses(expenses);
    const income = salaryProfile?.monthlyIncome ?? 0;

    const aiInput = {
        monthExpenses: monthExpenses as any[],
        prevMonthExpenses: [],
        allExpenses: expenses as any[],
        recurring: recurring as any[],
        salary: salaryProfile ?? null,
    };
    const { insights, loading: insightsLoading } = useAiInsights(aiInput);

    // ── Chat state ──
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [chatLoaded, setChatLoaded] = useState(false);
    const [mobileTab, setMobileTab] = useState<MobileTab>("insights");

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // ── Load persisted chat ──
    useEffect(() => {
        async function loadHistory() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                const { data } = await supabase
                    .from("atlas_chat_cache")
                    .select("messages")
                    .eq("user_id", user.id)
                    .maybeSingle();

                if (data?.messages && Array.isArray(data.messages)) {
                    setMessages(data.messages as ChatMessage[]);
                }
            } catch {
                // ignore — start fresh
            } finally {
                setChatLoaded(true);
            }
        }
        void loadHistory();
    }, []);

    // ── Persist chat on change ──
    useEffect(() => {
        if (!chatLoaded || messages.length === 0) return;
        const persist = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                await supabase.from("atlas_chat_cache").upsert(
                    { user_id: user.id, messages, updated_at: new Date().toISOString() },
                    { onConflict: "user_id" },
                );
            } catch {/* ignore */}
        };
        void persist();
    }, [messages, chatLoaded]);

    // ── Scroll to bottom ──
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, sending]);

    // ── Auto-resize textarea ──
    const resizeTextarea = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }, []);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        resizeTextarea();
    }, [resizeTextarea]);

    const sendMessage = useCallback(async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || sending) return;

        const userMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "user",
            content: trimmed,
            timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setSending(true);
        if (textareaRef.current) textareaRef.current.style.height = "auto";

        try {
            const ctx = buildFinancialContext(income, monthExpenses, recurring as any[], goals);
            const history = [...messages, userMsg].slice(-10).map((m) => ({
                role: m.role,
                content: m.content,
            }));

            const { data, error } = await supabase.functions.invoke("atlas-chat", {
                body: {
                    message: trimmed,
                    history: history.slice(0, -1), // exclude the msg we just added
                    financialContext: ctx,
                },
            });

            if (error) throw error;

            const reply = (data as { reply?: string })?.reply ?? "I couldn't generate a response. Please try again.";

            const assistantMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: reply,
                timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
        } catch {
            const errMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: "I'm having trouble connecting right now. Please check your connection and try again.",
                timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, errMsg]);
        } finally {
            setSending(false);
        }
    }, [sending, messages, income, monthExpenses, recurring, goals]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void sendMessage(input);
        }
    }, [sendMessage, input]);

    // ─── Derived data for insights panel ───────────────────────────────────
    const totalSpent = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const leftover = income - totalSpent;
    const spentPct = income > 0 ? Math.min((totalSpent / income) * 100, 100) : 0;
    const leftoverPct = income > 0 ? Math.max(((income - totalSpent) / income) * 100, 0) : 0;

    const catMap: Record<string, number> = {};
    for (const e of monthExpenses) {
        catMap[e.category] = (catMap[e.category] ?? 0) + Number(e.amount);
    }
    const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxCat = topCats[0]?.[1] ?? 1;

    const activeRecurring = (recurring as any[]).filter((r: any) => r.status === "active");
    const recurringTotal = activeRecurring.reduce((s: number, r: any) => s + Number(r.amount), 0);
    const recurringBurden = income > 0 ? ((recurringTotal / income) * 100).toFixed(1) : "0";

    const activeGoals = goals.filter((g) => g.status === "active");

    const hasData = income > 0 || monthExpenses.length > 0;
    const monthName = new Date().toLocaleString("default", { month: "long" });

    // ─── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="advisorPage">
            {/* ── Header ── */}
            <div className="advisorHeader">
                <div className="atlasAvatarWrap">
                    <div className="atlasAvatar" aria-hidden="true">
                        <AtlasIcon />
                    </div>
                    <span className="atlasOnlineDot" aria-hidden="true" />
                </div>
                <div className="atlasHeaderInfo">
                    <h1 className="atlasName">Atlas</h1>
                    <p className="atlasSubtitle">Your personal financial advisor</p>
                </div>
                <div className="atlasStatusBadge">
                    <span className="statusDot" />
                    Online
                </div>
            </div>

            {/* ── Mobile Tab Switcher ── */}
            <div className="mobileTabs" role="tablist">
                <button
                    role="tab"
                    aria-selected={mobileTab === "insights"}
                    className={`mobileTab ${mobileTab === "insights" ? "mobileTabActive" : ""}`}
                    onClick={() => setMobileTab("insights")}
                >
                    <InsightsTabIcon /> Insights
                </button>
                <button
                    role="tab"
                    aria-selected={mobileTab === "chat"}
                    className={`mobileTab ${mobileTab === "chat" ? "mobileTabActive" : ""}`}
                    onClick={() => setMobileTab("chat")}
                >
                    <ChatTabIcon /> Chat
                </button>
            </div>

            {/* ── Body ── */}
            <div className="advisorBody">
                {/* ════ INSIGHTS PANEL ════ */}
                <aside className={`insightsPanel ${mobileTab === "insights" ? "mobileVisible" : "mobileHidden"}`}>
                    {!hasData && (
                        <div className="insightCard noDataCard">
                            <div className="noDataIcon">📊</div>
                            <h3 className="noDataTitle">No data yet</h3>
                            <p className="noDataText">Add your salary and start tracking expenses so Atlas can give you real insights about your finances.</p>
                        </div>
                    )}

                    {/* ── Monthly Snapshot ── */}
                    {hasData && (
                        <section className="insightCard">
                            <h2 className="insightCardTitle">
                                <SnapshotIcon /> {monthName} Snapshot
                            </h2>
                            <div className="snapshotRow">
                                <div className="snapshotStat">
                                    <span className="snapshotLabel">Income</span>
                                    <span className="snapshotValue income">{fmt(income)}</span>
                                </div>
                                <div className="snapshotStat">
                                    <span className="snapshotLabel">Spent</span>
                                    <span className="snapshotValue spent">{fmt(totalSpent)}</span>
                                </div>
                                <div className="snapshotStat">
                                    <span className="snapshotLabel">Left</span>
                                    <span className={`snapshotValue ${leftover >= 0 ? "left" : "over"}`}>{fmt(Math.abs(leftover))}</span>
                                </div>
                            </div>
                            <div className="budgetBar" role="img" aria-label={`Spent ${pct(totalSpent, income)}% of income`}>
                                <div
                                    className={`budgetBarFill ${spentPct > 90 ? "overBudget" : spentPct > 70 ? "highBudget" : ""}`}
                                    style={{ width: `${spentPct}%` }}
                                />
                            </div>
                            <div className="budgetBarLabels">
                                <span className="budgetBarLabel spent">{pct(totalSpent, income)}% spent</span>
                                <span className="budgetBarLabel left">{pct(leftoverPct, 100)}% remaining</span>
                            </div>
                            {income === 0 && (
                                <p className="insightHint">💡 Set your salary to see your savings rate</p>
                            )}
                        </section>
                    )}

                    {/* ── Spending by Category ── */}
                    {topCats.length > 0 && (
                        <section className="insightCard">
                            <h2 className="insightCardTitle">
                                <CategoryIcon /> Top Spending
                            </h2>
                            <div className="catList">
                                {topCats.map(([name, amount]) => (
                                    <div key={name} className="catRow">
                                        <div className="catMeta">
                                            <span className="catName">{name}</span>
                                            <span className="catAmount">{fmt(amount)}</span>
                                        </div>
                                        <div className="catBar">
                                            <div
                                                className="catBarFill"
                                                style={{ width: `${(amount / maxCat) * 100}%` }}
                                            />
                                        </div>
                                        {income > 0 && (
                                            <span className="catPct">{pct(amount, income)}% of income</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* ── Recurring Bills ── */}
                    {activeRecurring.length > 0 && (
                        <section className="insightCard">
                            <h2 className="insightCardTitle">
                                <RecurringIcon /> Recurring Bills
                            </h2>
                            <div className="recurringBurden">
                                <div className="burdenStat">
                                    <span className="burdenValue">{fmt(recurringTotal)}</span>
                                    <span className="burdenLabel">/ month</span>
                                </div>
                                {income > 0 && (
                                    <div className={`burdenBadge ${Number(recurringBurden) > 40 ? "burdenHigh" : Number(recurringBurden) > 25 ? "burdenMed" : "burdenOk"}`}>
                                        {recurringBurden}% of income
                                    </div>
                                )}
                            </div>
                            <div className="recurringList">
                                {activeRecurring.slice(0, 4).map((r: any) => (
                                    <div key={r.id} className="recurringItem">
                                        <span className="recurringName">{r.name}</span>
                                        <span className="recurringAmount">{fmt(Number(r.amount))}</span>
                                    </div>
                                ))}
                                {activeRecurring.length > 4 && (
                                    <p className="recurringMore">+{activeRecurring.length - 4} more</p>
                                )}
                            </div>
                        </section>
                    )}

                    {/* ── Savings Goals ── */}
                    {activeGoals.length > 0 && (
                        <section className="insightCard">
                            <h2 className="insightCardTitle">
                                <GoalsIcon /> Savings Goals
                            </h2>
                            <div className="goalsList">
                                {activeGoals.map((g) => {
                                    const fillPct = Math.min((g.currentAmount / g.targetAmount) * 100, 100);
                                    return (
                                        <div key={g.id} className="goalItem">
                                            <div className="goalHeader">
                                                <span className="goalName">
                                                    {g.emoji && <span>{g.emoji} </span>}{g.name}
                                                </span>
                                                <span className="goalAmounts">
                                                    {fmt(g.currentAmount)} <span className="goalOf">/ {fmt(g.targetAmount)}</span>
                                                </span>
                                            </div>
                                            <div className="goalBar">
                                                <div
                                                    className="goalBarFill"
                                                    style={{
                                                        width: `${fillPct}%`,
                                                        background: g.color ?? "var(--accent)",
                                                    }}
                                                />
                                            </div>
                                            <span className="goalPct">{fillPct.toFixed(0)}% funded</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* ── Atlas AI Insights ── */}
                    {(insightsLoading || insights.length > 0) && (
                        <section className="insightCard">
                            <h2 className="insightCardTitle">
                                <SparkleIcon /> Atlas Insights
                            </h2>
                            {insightsLoading && (
                                <div className="insightLoadingRow">
                                    <div className="insightSkeleton" />
                                    <div className="insightSkeleton short" />
                                </div>
                            )}
                            {!insightsLoading && insights.map((ins) => (
                                <div key={ins.id} className={`aiInsightItem aiInsight-${ins.type}`}>
                                    <div className="aiInsightDot" />
                                    <div>
                                        <p className="aiInsightTitle">{ins.title}</p>
                                        <p className="aiInsightBody">{ins.body}</p>
                                    </div>
                                </div>
                            ))}
                        </section>
                    )}
                </aside>

                {/* ════ CHAT PANEL ════ */}
                <section className={`chatPanel ${mobileTab === "chat" ? "mobileVisible" : "mobileHidden"}`}>
                    {/* Message feed */}
                    <div className="messagesFeed" role="log" aria-live="polite" aria-label="Conversation with Atlas">
                        {/* Welcome message (always shown first) */}
                        <div className="messageBubbleWrap assistantWrap">
                            <div className="messageBubbleAvatar" aria-hidden="true">
                                <AtlasSmallIcon />
                            </div>
                            <div className="messageBubble assistantBubble">
                                <p className="messageText">{ATLAS_WELCOME}</p>
                                <span className="messageTime">Atlas · Just now</span>
                            </div>
                        </div>

                        {/* Suggested Questions (shown only if no messages yet) */}
                        {messages.length === 0 && (
                            <div className="suggestionsRow">
                                {SUGGESTED_QUESTIONS.map((q) => (
                                    <button
                                        key={q}
                                        className="suggestionChip"
                                        onClick={() => void sendMessage(q)}
                                        disabled={sending}
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Conversation */}
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`messageBubbleWrap ${msg.role === "assistant" ? "assistantWrap" : "userWrap"}`}
                            >
                                {msg.role === "assistant" && (
                                    <div className="messageBubbleAvatar" aria-hidden="true">
                                        <AtlasSmallIcon />
                                    </div>
                                )}
                                <div className={`messageBubble ${msg.role === "assistant" ? "assistantBubble" : "userBubble"}`}>
                                    <p className="messageText">{msg.content}</p>
                                    <span className="messageTime">
                                        {msg.role === "assistant" ? "Atlas · " : ""}
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                </div>
                            </div>
                        ))}

                        {/* Typing indicator */}
                        {sending && (
                            <div className="messageBubbleWrap assistantWrap">
                                <div className="messageBubbleAvatar" aria-hidden="true">
                                    <AtlasSmallIcon />
                                </div>
                                <div className="messageBubble assistantBubble typingBubble">
                                    <span className="typingDot" />
                                    <span className="typingDot" />
                                    <span className="typingDot" />
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input area */}
                    <div className="chatInputWrap">
                        {/* Quick chips — shown when there ARE messages */}
                        {messages.length > 0 && (
                            <div className="quickChips">
                                {SUGGESTED_QUESTIONS.slice(0, 2).map((q) => (
                                    <button
                                        key={q}
                                        className="quickChip"
                                        onClick={() => void sendMessage(q)}
                                        disabled={sending}
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="chatInputRow">
                            <textarea
                                ref={textareaRef}
                                className="chatInput"
                                placeholder="Ask Atlas anything about your finances…"
                                value={input}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                rows={1}
                                disabled={sending}
                                aria-label="Message Atlas"
                            />
                            <button
                                className="sendBtn"
                                onClick={() => void sendMessage(input)}
                                disabled={!input.trim() || sending}
                                aria-label="Send message"
                            >
                                <SendIcon />
                            </button>
                        </div>
                        <p className="chatDisclaimer">Atlas uses your Ledgerly data to give personalized advice. Not a substitute for professional financial advice.</p>
                    </div>
                </section>
            </div>
        </div>
    );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function AtlasIcon() {
    return (
        <svg viewBox="0 0 36 36" fill="none" role="presentation">
            <defs>
                <linearGradient id="atlasGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
            </defs>
            <circle cx="18" cy="18" r="18" fill="url(#atlasGrad)" />
            {/* Simplified constellation/chart icon */}
            <circle cx="18" cy="12" r="2.2" fill="white" />
            <circle cx="11" cy="21" r="2.2" fill="white" />
            <circle cx="25" cy="21" r="2.2" fill="white" />
            <line x1="18" y1="14.2" x2="11" y2="18.8" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="18" y1="14.2" x2="25" y2="18.8" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="13.2" y1="21" x2="22.8" y2="21" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
    );
}

function AtlasSmallIcon() {
    return (
        <svg viewBox="0 0 28 28" fill="none" role="presentation">
            <defs>
                <linearGradient id="atlasSmallGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
            </defs>
            <circle cx="14" cy="14" r="14" fill="url(#atlasSmallGrad)" />
            <circle cx="14" cy="9.5" r="1.7" fill="white" />
            <circle cx="8.5" cy="17" r="1.7" fill="white" />
            <circle cx="19.5" cy="17" r="1.7" fill="white" />
            <line x1="14" y1="11.2" x2="8.5" y2="15.3" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="14" y1="11.2" x2="19.5" y2="15.3" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="10.2" y1="17" x2="17.8" y2="17" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
    );
}

function SparkleIcon() {
    return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" role="presentation">
            <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" />
            <circle cx="10" cy="10" r="3" />
        </svg>
    );
}

function SnapshotIcon() {
    return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" role="presentation">
            <rect x="2" y="4" width="16" height="12" rx="2.5" />
            <path d="M6 12l2-3 2 2 2-4 2 2" />
        </svg>
    );
}

function CategoryIcon() {
    return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" role="presentation">
            <circle cx="10" cy="10" r="8" />
            <path d="M10 10l-5.66-5.66" />
            <path d="M10 10v-8" />
            <path d="M10 10l5.66 5.66" />
        </svg>
    );
}

function RecurringIcon() {
    return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" role="presentation">
            <path d="M14 2l3 3-3 3" />
            <path d="M3 9V7a4 4 0 0 1 4-4h10" />
            <path d="M6 18l-3-3 3-3" />
            <path d="M17 11v2a4 4 0 0 1-4 4H3" />
        </svg>
    );
}

function GoalsIcon() {
    return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" role="presentation">
            <circle cx="10" cy="10" r="8" />
            <circle cx="10" cy="10" r="4" />
            <circle cx="10" cy="10" r="1" fill="currentColor" stroke="none" />
        </svg>
    );
}

function SendIcon() {
    return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" role="presentation">
            <path d="M17 10L3 3l3 7-3 7 14-7Z" />
        </svg>
    );
}

function InsightsTabIcon() {
    return (
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" role="presentation">
            <rect x="2" y="3" width="14" height="12" rx="2" />
            <path d="M5 11l2-3 2 2 2-4 2 2" />
        </svg>
    );
}

function ChatTabIcon() {
    return (
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" role="presentation">
            <path d="M2 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7l-4 3V4Z" />
        </svg>
    );
}

function AtlasSideIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" role="presentation">
            <defs>
                <linearGradient id="sideAtlasGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
            </defs>
            <circle cx="12" cy="8" r="2" fill="url(#sideAtlasGrad)" />
            <circle cx="6" cy="17" r="2" fill="url(#sideAtlasGrad)" />
            <circle cx="18" cy="17" r="2" fill="url(#sideAtlasGrad)" />
            <line x1="12" y1="10" x2="6" y2="15" stroke="url(#sideAtlasGrad)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="12" y1="10" x2="18" y2="15" stroke="url(#sideAtlasGrad)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="8" y1="17" x2="16" y2="17" stroke="url(#sideAtlasGrad)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

export { AtlasSideIcon };
