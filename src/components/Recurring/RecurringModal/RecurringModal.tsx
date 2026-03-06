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
    BILLING_TYPE,
    RECUR_FREQUENCY,
    RECUR_KIND,
    RECUR_STATUS,
} from "../../../types/recurring";
import { PAYMENT_METHODS, type PaymentMethod } from "../../../types/expense";
import { todayISO } from "../../../lib/dates";
import { calcNextDueDate } from "../../../lib/recurring_schedule";
import { deleteRecurringItem, insertExpense, upsertRecurringItem } from "../../../lib/data";
import CategoryPicker from "../../CategoryPicker/CategoryPicker";
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

    return (
        <div className="rmOverlay" onMouseDown={onClose}>
            <div className="rmModal" onMouseDown={(e) => e.stopPropagation()}>
                <div className="rmTop">
                    <div>
                        <div className="rmTitle">{mode === "add" ? "Add recurring" : "Edit recurring"}</div>
                        <div className="rmSub">Fill in the details below — dates are auto-calculated.</div>
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
                    {/* Section 1 — Basic */}
                    <div className="rmSection">
                        <div className="rmH">1) Basic</div>

                        <div className="rmGrid2">
                            <div>
                                <label className="rmLabel">Name *</label>
                                <input className="rmInput" value={name} onChange={(e) => setName(e.target.value)} placeholder="Netflix" />
                            </div>

                            <div>
                                <label className="rmLabel">Type</label>
                                <select className="rmInput" value={kind} onChange={(e) => setKind(e.target.value as RecurringKind)}>
                                    {RECUR_KIND.map((k) => (
                                        <option key={k} value={k}>{k}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <CategoryPicker
                            valueCategory={category}
                            valueSubcategory={subcategory}
                            onPick={(c, s) => { setCategory(c); setSubcategory(s || ""); }}
                            recent={[]}
                        />

                        <div className="rmGrid2">
                            <div>
                                <label className="rmLabel">Tags (comma-separated)</label>
                                <input className="rmInput" value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="entertainment, family" />
                            </div>
                        </div>
                    </div>

                    {/* Section 2 — Amount */}
                    <div className="rmSection">
                        <div className="rmH">2) Amount</div>

                        <div className="rmGrid2">
                            <div>
                                <label className="rmLabel">Amount *</label>
                                <input className="rmInput" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="549" />
                            </div>

                            <div>
                                <label className="rmLabel">Billing type</label>
                                <select className="rmInput" value={billingType} onChange={(e) => setBillingType(e.target.value as BillingType)}>
                                    {BILLING_TYPE.map((b) => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>
                        </div>

                        {billingType === "variable" && (
                            <div className="rmGrid2">
                                <div>
                                    <label className="rmLabel">Typical min (optional)</label>
                                    <input className="rmInput" inputMode="decimal" value={typMin} onChange={(e) => setTypMin(e.target.value)} placeholder="e.g. 800" />
                                </div>
                                <div>
                                    <label className="rmLabel">Typical max (optional)</label>
                                    <input className="rmInput" inputMode="decimal" value={typMax} onChange={(e) => setTypMax(e.target.value)} placeholder="e.g. 2000" />
                                </div>

                                <label className="rmToggle">
                                    <input
                                        type="checkbox"
                                        checked={askConfirmAmountBeforeAutoAdd}
                                        onChange={(e) => setAskConfirmAmountBeforeAutoAdd(e.target.checked)}
                                    />
                                    Ask me to confirm amount before auto-adding
                                </label>
                            </div>
                        )}
                    </div>

                    {/* Section 3 — Schedule */}
                    <div className="rmSection">
                        <div className="rmH">3) Schedule</div>

                        <div className="rmGrid3 rmScheduleGrid">
                            <div>
                                <label className="rmLabel">Frequency</label>
                                <select
                                    className="rmInput"
                                    value={frequency}
                                    onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                                >
                                    {RECUR_FREQUENCY.map((f) => (
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="rmLabel">Start date *</label>
                                <input
                                    className="rmInput"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="rmLabel">Next billing date</label>
                                <input
                                    className="rmInput"
                                    type="date"
                                    value={nextDueDate}
                                    onChange={(e) => {
                                        setNextDueDate(e.target.value);
                                        setNextEdited(true);
                                    }}
                                />
                            </div>

                            <button
                                className="rmMini rmRecalc"
                                type="button"
                                onClick={() => setNextEdited(false)}
                                disabled={!nextEdited}
                            >
                                Recalculate
                            </button>
                        </div>
                    </div>



                    {/* Section 4 — Payment */}
                    <div className="rmSection">
                        <div className="rmH">4) Payment</div>

                        <div className="rmGrid2">
                            <div>
                                <label className="rmLabel">Payment method</label>
                                <select className="rmInput" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                                    {PAYMENT_METHODS.map((p) => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="rmLabel">Card label (optional)</label>
                                <input className="rmInput" value={cardLabel} onChange={(e) => setCardLabel(e.target.value)} placeholder="BPI Blue" />
                            </div>

                            <div>
                                <label className="rmLabel">Merchant (optional)</label>
                                <input className="rmInput" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Netflix.com" />
                            </div>
                        </div>
                    </div>

                    {/* Section 5 — Automation */}
                    <div className="rmSection">
                        <div className="rmH">5) Automation</div>

                        <label className="rmToggle">
                            <input type="checkbox" checked={autoAddExpense} onChange={(e) => setAutoAddExpense(e.target.checked)} />
                            Auto-add expense entries (default ON)
                        </label>

                        <div className="rmGrid2">
                            <div>
                                <label className="rmLabel">Auto-add timing</label>
                                <select className="rmInput" value={autoAddTiming} onChange={(e) => setAutoAddTiming(e.target.value as AutoAddTiming)}>
                                    {AUTO_ADD_TIMING.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>

                        {billingType === "variable" && (
                            <label className="rmToggle">
                                <input
                                    type="checkbox"
                                    checked={requireConfirmationBeforeAdding}
                                    onChange={(e) => setRequireConfirmationBeforeAdding(e.target.checked)}
                                />
                                Require confirmation before adding (variable)
                            </label>
                        )}
                    </div>

                    {/* Section 6 — Status + Lifecycle */}
                    <div className="rmSection">
                        <div className="rmH">6) Status + Lifecycle</div>

                        <div className="rmGrid2">
                            <div>
                                <label className="rmLabel">Status</label>
                                <select className="rmInput" value={status} onChange={(e) => setStatus(e.target.value as RecurringStatus)}>
                                    {RECUR_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            {status === "trial" && (
                                <div>
                                    <label className="rmLabel">Trial end date</label>
                                    <input className="rmInput" type="date" value={trialEndDate} onChange={(e) => setTrialEndDate(e.target.value)} />
                                </div>
                            )}

                            <div>
                                <label className="rmLabel">End date (optional)</label>
                                <input className="rmInput" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                            </div>
                        </div>

                        <div>
                            <label className="rmLabel">Notes</label>
                            <textarea className="rmTextarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="account email, plan tier, who uses it…" />
                        </div>
                    </div>
                </div>

                <div className="rmFooter">
                    <button className="rmGhost" onClick={onClose} disabled={saving}>Cancel</button>
                    <div className="rmRight">
                        <button className="rmGhost" onClick={save} disabled={saving}>
                            {saving ? "Saving…" : "Save"}
                        </button>
                        <button className="rmPrimary" onClick={saveAndAddNow} disabled={saving}>
                            {saving ? "Saving…" : "Save & Add Now"}
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
