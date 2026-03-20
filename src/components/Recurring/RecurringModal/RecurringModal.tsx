import { useEffect, useMemo, useState } from "react";
import type { Expense } from "../../../types/expense";
import type {
    AutoAddTiming,
    BillingType,
    MissingDayRule,
    MonthlyDayMode,
    RecurringFrequency,
    RecurringItem,
    RecurringKind,
    RecurringStatus,
} from "../../../types/recurring";
import {
    AUTO_ADD_TIMING,
    RECUR_FREQUENCY,
    RECUR_STATUS,
} from "../../../types/recurring";
import { PAYMENT_METHODS, type PaymentMethod } from "../../../types/expense";
import { todayISO } from "../../../lib/dates";
import { calcNextDueDate } from "../../../lib/recurring_schedule";
import { deleteRecurringItem, insertExpense, upsertRecurringItem } from "../../../lib/data";
import CategoryPicker from "../../CategoryPicker/CategoryPicker";
import { useAiCategoryHint } from "../../../lib/useAiCategoryHint";
import "./RecurringModal.css";

type Mode = "add" | "edit";

type Props = {
    open: boolean;
    mode: Mode;
    initial?: RecurringItem | null;
    onClose: () => void;
    onAfterSave?: () => void;
    onAfterDelete?: () => void;
};

function mkEmpty(): RecurringItem {
    const t = todayISO();
    return {
        id: crypto.randomUUID(),

        name: "",
        kind: "subscription",
        category: "",
        subcategory: "",
        tags: [],

        amount: 0,
        billingType: "fixed",
        typicalMin: undefined,
        typicalMax: undefined,
        askConfirmAmountBeforeAutoAdd: false,

        currency: "PHP",

        frequency: "monthly",
        customEveryDays: 30,
        startDate: t,
        nextDueDate: t,
        monthlyDayMode: "same_day",
        missingDayRule: "move_to_last_day",

        endDate: "",

        paymentMethod: "card",
        cardLabel: "",
        merchant: "",

        autoAddExpense: true,
        autoAddTiming: "on_due",
        requireConfirmationBeforeAdding: false,

        status: "active",
        trialEndDate: "",
        notes: "",

        updatedAt: Date.now(),
        createdAt: Date.now(),
    };
}

export default function RecurringModal({ open, mode, initial, onClose, onAfterSave, onAfterDelete }: Props) {
    const base = useMemo(() => (mode === "edit" && initial ? initial : mkEmpty()), [mode, initial]);

    const [name, setName] = useState(base.name);
    const [kind, setKind] = useState<RecurringKind>(base.kind);

    const [category, setCategory] = useState(base.category);
    const [subcategory, setSubcategory] = useState(base.subcategory ?? "");
    const [tagsRaw, setTagsRaw] = useState((base.tags ?? []).join(", "));
    // true once the user has manually chosen a category — suppresses AI hints
    const [categoryManual, setCategoryManual] = useState(base.category !== "");

    const [billingType, setBillingType] = useState<BillingType>(base.billingType);
    const [amount, setAmount] = useState(String(base.amount ?? 0));
    const [typMin, setTypMin] = useState(base.typicalMin ? String(base.typicalMin) : "");
    const [typMax, setTypMax] = useState(base.typicalMax ? String(base.typicalMax) : "");
    const [askConfirmAmountBeforeAutoAdd, setAskConfirmAmountBeforeAutoAdd] = useState<boolean>(
        base.askConfirmAmountBeforeAutoAdd
    );

    const [saving, setSaving] = useState(false);

    const [frequency, setFrequency] = useState<RecurringFrequency>(base.frequency);
    const [customEveryDays, setCustomEveryDays] = useState(String(base.customEveryDays ?? 30));
    const [startDate, setStartDate] = useState(base.startDate);
    const [nextDueDate, setNextDueDate] = useState(base.nextDueDate);
    const [nextEdited, setNextEdited] = useState(false);

    const [monthlyDayMode, setMonthlyDayMode] = useState<MonthlyDayMode>(base.monthlyDayMode);
    const [missingDayRule, setMissingDayRule] = useState<MissingDayRule>(base.missingDayRule);

    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(base.paymentMethod);
    const [cardLabel, setCardLabel] = useState(base.cardLabel ?? "");
    const [merchant, setMerchant] = useState(base.merchant ?? "");

    const [autoAddExpense, setAutoAddExpense] = useState<boolean>(base.autoAddExpense);
    const [autoAddTiming, setAutoAddTiming] = useState<AutoAddTiming>(base.autoAddTiming);
    const [requireConfirmationBeforeAdding, setRequireConfirmationBeforeAdding] = useState<boolean>(
        base.requireConfirmationBeforeAdding
    );

    const [status, setStatus] = useState<RecurringStatus>(base.status);
    const [trialEndDate, setTrialEndDate] = useState(base.trialEndDate ?? "");
    const [endDate, setEndDate] = useState(base.endDate ?? "");
    const [notes, setNotes] = useState(base.notes ?? "");

    // reset when opening / switching item
    useEffect(() => {
        if (!open) return;

        setName(base.name);
        setKind(base.kind);
        setCategory(base.category);
        setSubcategory(base.subcategory ?? "");
        setTagsRaw((base.tags ?? []).join(", "));
        setCategoryManual(base.category !== "");

        setBillingType(base.billingType);
        setAmount(String(base.amount ?? 0));
        setTypMin(base.typicalMin ? String(base.typicalMin) : "");
        setTypMax(base.typicalMax ? String(base.typicalMax) : "");
        setAskConfirmAmountBeforeAutoAdd(base.askConfirmAmountBeforeAutoAdd);

        setFrequency(base.frequency);
        setCustomEveryDays(String(base.customEveryDays ?? 30));
        setStartDate(base.startDate);
        setNextDueDate(base.nextDueDate);
        setNextEdited(false);

        setMonthlyDayMode(base.monthlyDayMode);
        setMissingDayRule(base.missingDayRule);

        setPaymentMethod(base.paymentMethod);
        setCardLabel(base.cardLabel ?? "");
        setMerchant(base.merchant ?? "");

        setAutoAddExpense(base.autoAddExpense);
        setAutoAddTiming(base.autoAddTiming);
        setRequireConfirmationBeforeAdding(base.requireConfirmationBeforeAdding);

        setStatus(base.status);
        setTrialEndDate(base.trialEndDate ?? "");
        setEndDate(base.endDate ?? "");
        setNotes(base.notes ?? "");
    }, [open, base]);

    // auto-calc next billing date unless user manually edited it
    useEffect(() => {
        if (!open) return;
        if (nextEdited) return;

        const next = calcNextDueDate({
            startDate,
            frequency,
            customEveryDays: Number(customEveryDays || 30),
            monthlyDayMode,
            missingDayRule,
            todayISO: todayISO(),
        });
        setNextDueDate(next);
    }, [open, nextEdited, startDate, frequency, customEveryDays, monthlyDayMode, missingDayRule]);

    // AI category hint — local dict + debounced Groq for unknowns
    const { hint: catHint, loading: catHintLoading, clearHint } = useAiCategoryHint(
        name,
        !categoryManual && mode === "add",
    );

    if (!open) return null;

    function parseTags(raw: string) {
        return raw
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
    }

    function buildItem(): RecurringItem | null {
        const amt = Number(amount);
        if (!name.trim()) {
            alert("Name is required.");
            return null;
        }
        if (!category.trim()) {
            alert("Category is required.");
            return null;
        }
        if (!Number.isFinite(amt) || amt < 0) {
            alert("Enter a valid amount.");
            return null;
        }

        const min = typMin.trim() ? Number(typMin) : undefined;
        const max = typMax.trim() ? Number(typMax) : undefined;

        const item: RecurringItem = {
            ...base,
            name: name.trim(),
            kind,

            category: category.trim(),
            subcategory: subcategory.trim() || "",
            tags: parseTags(tagsRaw),

            billingType,
            amount: amt,
            typicalMin: billingType === "variable" ? min : undefined,
            typicalMax: billingType === "variable" ? max : undefined,
            askConfirmAmountBeforeAutoAdd: billingType === "variable" ? askConfirmAmountBeforeAutoAdd : false,

            frequency,
            customEveryDays: frequency === "custom" ? Number(customEveryDays || 30) : undefined,
            startDate,
            nextDueDate,
            monthlyDayMode,
            missingDayRule,
            endDate: endDate.trim() || "",

            paymentMethod,
            cardLabel: cardLabel.trim() || "",
            merchant: merchant.trim() || "",

            autoAddExpense,
            autoAddTiming,
            requireConfirmationBeforeAdding: billingType === "variable" ? requireConfirmationBeforeAdding : false,

            status,
            trialEndDate: status === "trial" ? (trialEndDate.trim() || "") : "",
            notes: notes.trim() || "",

            updatedAt: Date.now(),
            createdAt: base.createdAt || Date.now(),
        };

        return item;
    }


    async function save() {
        const item = buildItem();
        if (!item) return;
        if (saving) return;

        try {
            setSaving(true);

            await upsertRecurringItem(item);
            onAfterSave?.();
            onClose();
        } catch (e: any) {
            console.error("Save recurring failed:", e);
            alert(e?.message ?? "Failed to save recurring item.");
        } finally {
            setSaving(false);
        }
    }


    async function saveAndAddNow() {
        const item = buildItem();
        if (!item) return;
        if (saving) return;

        try {
            setSaving(true);

            // If variable: ask user for amount now (MVP)
            let expenseAmount = item.amount;
            if (item.billingType === "variable") {
                const suggested = item.typicalMax ?? item.typicalMin ?? item.amount ?? 0;
                const raw = window.prompt("Enter amount to add now:", String(suggested));
                if (raw === null) return;
                const n = Number(raw);
                if (!Number.isFinite(n) || n <= 0) {
                    alert("Invalid amount.");
                    return;
                }
                expenseAmount = n;
            }

            await upsertRecurringItem(item);

            // ✅ build expense entry
            const exp: Expense = {
                id: crypto.randomUUID(),
                amount: expenseAmount,
                date: todayISO(),
                category: item.category,
                subcategory: item.subcategory || "",
                notes: item.notes || item.name,
                paymentMethod: item.paymentMethod,
                tags: item.tags ?? [],
                createdAt: Date.now(),
            };

            await insertExpense(exp);

            onAfterSave?.();
            onClose();
        } catch (e: any) {
            console.error("Save & Add Now failed:", e);
            alert(e?.message ?? "Failed to save and add expense.");
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        const confirm = window.confirm("Delete this recurring item?");
        if (!confirm) return;

        try {
            setSaving(true);
            await deleteRecurringItem(base.id);
            onAfterDelete?.();
            onClose();
        } catch (e: any) {
            console.error("Delete recurring failed:", e);
            alert(e?.message ?? "Failed to delete recurring item.");
        } finally {
            setSaving(false);
        }
    }

    // ── Infer RecurringKind from AI-suggested category ────────
    function inferKind(cat: string, sub: string): RecurringKind {
        const c = cat.toLowerCase();
        const s = sub.toLowerCase();
        if (c.includes("subscription"))            return "subscription";
        if (s === "rent" || s.includes("rent"))    return "rent";
        if (c.includes("utilities") || c.includes("bills")) return "utility";
        if (c.includes("debt") || c.includes("payment")) return "loan";
        if (s === "gym" || s.includes("membership")) return "membership";
        if (c.includes("insurance") || s.includes("insurance")) return "insurance";
        return kind; // keep current kind if no clear match
    }

    // ── Human-friendly label maps ──────────────────────────────
    const KIND_OPTIONS: { value: RecurringKind; emoji: string; label: string; hint: string }[] = [
        { value: "subscription", emoji: "📱", label: "Subscription",  hint: "Netflix, Spotify…"   },
        { value: "utility",      emoji: "⚡", label: "Utility",       hint: "Electricity, Water…" },
        { value: "rent",         emoji: "🏠", label: "Rent",          hint: "Monthly rent"        },
        { value: "insurance",    emoji: "🛡️", label: "Insurance",    hint: "Health, Life…"       },
        { value: "loan",         emoji: "💳", label: "Loan / Debt",   hint: "Credit, SSS…"        },
        { value: "membership",   emoji: "🎁", label: "Membership",    hint: "Gym, Club…"          },
    ];

    const FREQ_LABELS: Record<string, string> = {
        weekly:    "Every week",
        biweekly:  "Every 2 weeks",
        monthly:   "Every month",
        quarterly: "Every 3 months",
        yearly:    "Every year",
        custom:    "Custom interval",
    };

    const TIMING_LABELS: Record<string, string> = {
        on_due:       "On the due date",
        day_before:   "1 day before it's due",
        on_mark_paid: "Only when I mark it paid",
    };

    const STATUS_LABELS: Record<string, string> = {
        active:    "Active",
        paused:    "Paused",
        trial:     "On trial",
        cancelled: "Cancelled",
    };

    return (
        <div className="rmOverlay" onMouseDown={onClose}>
            <div className="rmModal" onMouseDown={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className="rmTop">
                    <div>
                        <div className="rmTitle">
                            {mode === "add" ? "Track a Recurring Bill" : "Edit Recurring Bill"}
                        </div>
                        <div className="rmSub">
                            {mode === "add"
                                ? "Set it up once — we'll remind you and log it automatically."
                                : "Update the details for this recurring item."}
                        </div>
                    </div>
                    <div className="rmTopActions">
                        {mode === "edit" && (
                            <button
                                className="rmTrash"
                                onClick={handleDelete}
                                disabled={saving}
                                aria-label="Delete this recurring item"
                                title="Delete"
                            >
                                <TrashIcon />
                            </button>
                        )}
                        <button className="rmX" onClick={onClose} aria-label="Close">✕</button>
                    </div>
                </div>

                <div className="rmBody">

                    {/* ── Section 1: What is it? ── */}
                    <div className="rmSection">
                        <div className="rmSectionHead">
                            <span className="rmSectionIcon">📋</span>
                            <div>
                                <div className="rmH">What is it?</div>
                                <div className="rmHint">Name and type of this recurring item.</div>
                            </div>
                        </div>

                        <div className="rmGrid2">
                            <div>
                                <label className="rmLabel">Name *</label>
                                <input
                                    className="rmInput"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Netflix, Meralco, BPI loan"
                                />
                            </div>
                            <div>
                                <CategoryPicker
                                    valueCategory={category}
                                    valueSubcategory={subcategory}
                                    onPick={(c, s) => {
                                        setCategory(c);
                                        setSubcategory(s || "");
                                        setCategoryManual(true);
                                        clearHint();
                                    }}
                                    recent={[]}
                                />
                            </div>
                        </div>

                        {/* AI category suggestion chip */}
                        {catHintLoading && !category && (
                            <div className="rmAiHint rmAiHintLoading">
                                <span className="rmAiSpinner" />
                                Suggesting category…
                            </div>
                        )}
                        {catHint && !categoryManual && (
                            <div className="rmAiHint">
                                <span className="rmAiStar">✦</span>
                                <span className="rmAiHintText">
                                    Suggested: <strong>{catHint.category}</strong>
                                    {catHint.subcategory ? ` / ${catHint.subcategory}` : ""}
                                </span>
                                <button
                                    type="button"
                                    className="rmAiApply"
                                    onClick={() => {
                                        setCategory(catHint.category);
                                        setSubcategory(catHint.subcategory);
                                        setKind(inferKind(catHint.category, catHint.subcategory));
                                        clearHint();
                                        // NOTE: categoryManual stays false so re-typing name
                                        // still triggers new suggestions
                                    }}
                                >
                                    Apply
                                </button>
                                <button type="button" className="rmAiDismiss" onClick={clearHint}>✕</button>
                            </div>
                        )}

                        {/* Kind pill selector */}
                        <div>
                            <label className="rmLabel">Type</label>
                            <div className="rmKindGrid">
                                {KIND_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        className={`rmKindPill${kind === opt.value ? " rmKindPillOn" : ""}`}
                                        onClick={() => setKind(opt.value)}
                                        title={opt.hint}
                                    >
                                        <span className="rmKindEmoji">{opt.emoji}</span>
                                        <span className="rmKindLabel">{opt.label}</span>
                                        <span className="rmKindHint">{opt.hint}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="rmLabel">Labels / tags <span className="rmOptional">(optional)</span></label>
                            <input
                                className="rmInput"
                                value={tagsRaw}
                                onChange={(e) => setTagsRaw(e.target.value)}
                                placeholder="e.g. streaming, family, online — separate with commas"
                            />
                        </div>
                    </div>

                    {/* ── Section 2: How much? ── */}
                    <div className="rmSection">
                        <div className="rmSectionHead">
                            <span className="rmSectionIcon">💰</span>
                            <div>
                                <div className="rmH">How much?</div>
                                <div className="rmHint">Enter the amount and whether it's always the same.</div>
                            </div>
                        </div>

                        {/* Billing type toggle */}
                        <div className="rmBillingToggle">
                            <button
                                type="button"
                                className={`rmBillingCard${billingType === "fixed" ? " rmBillingCardOn" : ""}`}
                                onClick={() => setBillingType("fixed")}
                            >
                                <span className="rmBillingEmoji">🔒</span>
                                <span className="rmBillingCardTitle">Fixed amount</span>
                                <span className="rmBillingCardHint">Always the same (e.g. Netflix ₱549)</span>
                            </button>
                            <button
                                type="button"
                                className={`rmBillingCard${billingType === "variable" ? " rmBillingCardOn" : ""}`}
                                onClick={() => setBillingType("variable")}
                            >
                                <span className="rmBillingEmoji">📊</span>
                                <span className="rmBillingCardTitle">Variable amount</span>
                                <span className="rmBillingCardHint">Changes each cycle (e.g. electricity)</span>
                            </button>
                        </div>

                        <div className="rmGrid2">
                            <div>
                                <label className="rmLabel">
                                    {billingType === "fixed" ? "Amount *" : "Typical / default amount"}
                                </label>
                                <div className="rmInputPrefix">
                                    <span className="rmPrefix">₱</span>
                                    <input
                                        className="rmInput rmInputWithPrefix"
                                        inputMode="decimal"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        </div>

                        {billingType === "variable" && (
                            <div className="rmGrid2">
                                <div>
                                    <label className="rmLabel">Minimum expected <span className="rmOptional">(optional)</span></label>
                                    <div className="rmInputPrefix">
                                        <span className="rmPrefix">₱</span>
                                        <input className="rmInput rmInputWithPrefix" inputMode="decimal" value={typMin} onChange={(e) => setTypMin(e.target.value)} placeholder="e.g. 800" />
                                    </div>
                                </div>
                                <div>
                                    <label className="rmLabel">Maximum expected <span className="rmOptional">(optional)</span></label>
                                    <div className="rmInputPrefix">
                                        <span className="rmPrefix">₱</span>
                                        <input className="rmInput rmInputWithPrefix" inputMode="decimal" value={typMax} onChange={(e) => setTypMax(e.target.value)} placeholder="e.g. 2000" />
                                    </div>
                                </div>
                                <label className="rmToggle">
                                    <input
                                        type="checkbox"
                                        checked={askConfirmAmountBeforeAutoAdd}
                                        onChange={(e) => setAskConfirmAmountBeforeAutoAdd(e.target.checked)}
                                    />
                                    Ask me to confirm the amount before logging it
                                </label>
                            </div>
                        )}
                    </div>

                    {/* ── Section 3: When is it due? ── */}
                    <div className="rmSection">
                        <div className="rmSectionHead">
                            <span className="rmSectionIcon">📅</span>
                            <div>
                                <div className="rmH">When is it due?</div>
                                <div className="rmHint">Set how often it recurs and its next payment date.</div>
                            </div>
                        </div>

                        <div className="rmGrid2">
                            <div>
                                <label className="rmLabel">How often?</label>
                                <select
                                    className="rmInput"
                                    value={frequency}
                                    onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                                >
                                    {RECUR_FREQUENCY.map((f) => (
                                        <option key={f} value={f}>{FREQ_LABELS[f] ?? f}</option>
                                    ))}
                                </select>
                            </div>

                            {frequency === "custom" && (
                                <div>
                                    <label className="rmLabel">Every how many days?</label>
                                    <input
                                        className="rmInput"
                                        inputMode="numeric"
                                        value={customEveryDays}
                                        onChange={(e) => setCustomEveryDays(e.target.value)}
                                        placeholder="30"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="rmLabel">First payment date *</label>
                                <input
                                    className="rmInput"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="rmLabel">
                                    Next payment date
                                    {!nextEdited && <span className="rmAutoCalc"> — auto-calculated</span>}
                                </label>
                                <input
                                    className="rmInput"
                                    type="date"
                                    value={nextDueDate}
                                    onChange={(e) => { setNextDueDate(e.target.value); setNextEdited(true); }}
                                />
                                {nextEdited && (
                                    <button
                                        className="rmMini rmRecalc"
                                        type="button"
                                        onClick={() => setNextEdited(false)}
                                    >
                                        ↺ Reset to auto-calculated
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Section 4: How do you pay? ── */}
                    <div className="rmSection">
                        <div className="rmSectionHead">
                            <span className="rmSectionIcon">💳</span>
                            <div>
                                <div className="rmH">How do you pay?</div>
                                <div className="rmHint">Payment method and optional details for reference.</div>
                            </div>
                        </div>

                        <div className="rmGrid2">
                            <div>
                                <label className="rmLabel">Payment method</label>
                                <select className="rmInput" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                                    {PAYMENT_METHODS.map((p) => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="rmLabel">Card or account name <span className="rmOptional">(optional)</span></label>
                                <input className="rmInput" value={cardLabel} onChange={(e) => setCardLabel(e.target.value)} placeholder="e.g. BPI Blue, Maya" />
                            </div>
                            <div>
                                <label className="rmLabel">Merchant / website <span className="rmOptional">(optional)</span></label>
                                <input className="rmInput" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="e.g. netflix.com, Meralco" />
                            </div>
                        </div>
                    </div>

                    {/* ── Section 5: Auto-tracking ── */}
                    <div className="rmSection">
                        <div className="rmSectionHead">
                            <span className="rmSectionIcon">⚙️</span>
                            <div>
                                <div className="rmH">Auto-tracking</div>
                                <div className="rmHint">Let Ledgerly log this as an expense automatically.</div>
                            </div>
                        </div>

                        <label className="rmToggle">
                            <input type="checkbox" checked={autoAddExpense} onChange={(e) => setAutoAddExpense(e.target.checked)} />
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>Automatically record each payment</div>
                                <div style={{ fontSize: 11.5, opacity: 0.7, marginTop: 2 }}>When this is due, add it to your expenses without manual action.</div>
                            </div>
                        </label>

                        {autoAddExpense && (
                            <div>
                                <label className="rmLabel">When should it be recorded?</label>
                                <select
                                    className="rmInput"
                                    value={autoAddTiming}
                                    onChange={(e) => setAutoAddTiming(e.target.value as AutoAddTiming)}
                                >
                                    {AUTO_ADD_TIMING.map((t) => (
                                        <option key={t} value={t}>{TIMING_LABELS[t] ?? t}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {billingType === "variable" && (
                            <label className="rmToggle">
                                <input
                                    type="checkbox"
                                    checked={requireConfirmationBeforeAdding}
                                    onChange={(e) => setRequireConfirmationBeforeAdding(e.target.checked)}
                                />
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 13 }}>Ask me before recording (variable amount)</div>
                                    <div style={{ fontSize: 11.5, opacity: 0.7, marginTop: 2 }}>You'll confirm the exact amount each time instead of using the default.</div>
                                </div>
                            </label>
                        )}
                    </div>

                    {/* ── Section 6: Status & Notes ── */}
                    <div className="rmSection">
                        <div className="rmSectionHead">
                            <span className="rmSectionIcon">🏷️</span>
                            <div>
                                <div className="rmH">Status & Notes</div>
                                <div className="rmHint">Is this active? Set an end date or add notes.</div>
                            </div>
                        </div>

                        <div className="rmGrid2">
                            <div>
                                <label className="rmLabel">Status</label>
                                <select className="rmInput" value={status} onChange={(e) => setStatus(e.target.value as RecurringStatus)}>
                                    {RECUR_STATUS.map((s) => (
                                        <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                                    ))}
                                </select>
                            </div>

                            {status === "trial" && (
                                <div>
                                    <label className="rmLabel">Trial ends on</label>
                                    <input className="rmInput" type="date" value={trialEndDate} onChange={(e) => setTrialEndDate(e.target.value)} />
                                </div>
                            )}

                            <div>
                                <label className="rmLabel">Expires / ends on <span className="rmOptional">(optional)</span></label>
                                <input className="rmInput" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                            </div>
                        </div>

                        <div>
                            <label className="rmLabel">Notes <span className="rmOptional">(optional)</span></label>
                            <textarea
                                className="rmTextarea"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="e.g. account email, plan tier, who uses it…"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="rmFooter">
                    <button className="rmGhost" onClick={onClose} disabled={saving}>Cancel</button>
                    <div className="rmRight">
                        <button className="rmGhost" onClick={save} disabled={saving}>
                            {saving ? "Saving…" : "Save"}
                        </button>
                        <button className="rmPrimary" onClick={saveAndAddNow} disabled={saving}>
                            {saving ? "Saving…" : "Save & Record Now"}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}

function TrashIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" role="presentation">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
        </svg>
    );
}
