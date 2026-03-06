import { useMemo, useState } from "react";
import { PAYMENT_METHODS, type PaymentMethod } from "../../types/expense";
import { todayISO } from "../../lib/dates";
import type { RecentCategory } from "../../types/expense";
import "./ExpenseForm.css";

export type ExpenseDraft = {
    amount: number;
    date: string;
    category: string;
    subcategory: string;
    notes: string;
    paymentMethod?: PaymentMethod;
    tags: string[];
};

const QUICK_CATEGORIES = [
    { label: "Food", emoji: "🍔", value: "Food" },
    { label: "Groceries", emoji: "🛒", value: "Groceries" },
    { label: "Transpo", emoji: "🚕", value: "Transpo" },
    { label: "Rent", emoji: "🏠", value: "Rent" },
    { label: "Bills", emoji: "💡", value: "Bills" },
    { label: "Shopping", emoji: "🛍️", value: "Shopping" },
    { label: "Health", emoji: "🩺", value: "Health" },
    { label: "Education", emoji: "🎓", value: "Education" },
    { label: "Leisure", emoji: "🎮", value: "Leisure" },
    { label: "Debt", emoji: "💳", value: "Debt" },
];


type Props = {
    onSubmit: (draft: ExpenseDraft) => Promise<void>;
    recentCategories: RecentCategory[];
    saveState?: "idle" | "saving" | "saved";
    onSuccessClose?: () => void;
};

function formatWithCommas(value: string) {
    if (!value) return "";

    const parts = value.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    return parts.join(".");
}

function stripCommas(value: string) {
    return value.replace(/,/g, "");
}


export default function ExpenseForm({ onSubmit, onSuccessClose }: Props) {
    const [amount, setAmount] = useState<string>("");
    const [date, setDate] = useState<string>(todayISO());
    const [category, setCategory] = useState<string>("");
    const [subcategory, setSubcategory] = useState<string>("");
    const [notes, setNotes] = useState<string>("");
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
    const [tagsRaw, setTagsRaw] = useState<string>("");

    const [isSaving, setIsSaving] = useState(false);
    const [successOpen, setSuccessOpen] = useState(false);
    const amountNumber = useMemo(() => {
        const n = Number(stripCommas(amount));
        return Number.isFinite(n) ? n : NaN;
    }, [amount]);

    async function submit(e: React.FormEvent) {
        e.preventDefault();

        if (isSaving) return;

        if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
            setSuccessOpen(false);
            // replace alert with something nicer later if you want
            window.alert("Enter a valid amount.");
            return;
        }
        if (!category) {
            setSuccessOpen(false);
            window.alert("Category is required.");
            return;
        }

        const tags = tagsRaw
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);

        try {
            setIsSaving(true);

            await onSubmit({
                amount: amountNumber,
                date,
                category,
                subcategory: subcategory || "",
                notes: notes.trim() || "",
                paymentMethod,
                tags,
            });

            // ✅ show success modal
            setSuccessOpen(true);

            // ✅ optional: reset form after save
            setAmount("");
            setCategory("");
            setSubcategory("");
            setNotes("");
            setTagsRaw("");
            setPaymentMethod("cash");
            setDate(todayISO());
        } catch (err) {
            console.error(err);
            window.alert("Failed to save expense. Please try again.");
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <form className="expenseForm" onSubmit={submit}>
            <div className="grid2">
                <div>
                    <label className="label">Amount *</label>

                    <div className="amountField">
                        <span className="currency">₱</span>
                        <input
                            className="input amountInput"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => {
                                const raw = stripCommas(e.target.value);

                                // allow only numbers + one decimal
                                if (!/^\d*\.?\d*$/.test(raw)) return;

                                setAmount(formatWithCommas(raw));
                            }}

                        />
                    </div>
                </div>

                <div>
                    <label className="label">Date *</label>
                    <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
            </div>

            <label className="label">Categories *</label>

            <div className="categoryChips">
                {QUICK_CATEGORIES.map((c) => (
                    <button
                        key={c.value}
                        type="button"
                        className={`chip ${category === c.value ? "active" : ""}`}
                        onClick={() => {
                            if (category === c.value) {
                                setCategory("");
                                setSubcategory("");
                                return;
                            }
                            setCategory(c.value);
                            setSubcategory("");
                        }}
                    >
                        <span className="emoji">{c.emoji}</span>
                        {c.label}
                    </button>
                ))}
            </div>


            <div className="grid2">
                <div>
                    <label className="label">Notes</label>
                    <input
                        className="input"
                        placeholder="e.g., Jollibee, Mercury Drug, Rent"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </div>

                <div>
                    <label className="label">Payment Method</label>
                    <select
                        className="input"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    >
                        {PAYMENT_METHODS.map((m) => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div>
                <label className="label">Tags (comma-separated)</label>
                <input
                    className="input"
                    placeholder="e.g., work, treat, family"
                    value={tagsRaw}
                    onChange={(e) => setTagsRaw(e.target.value)}
                />
            </div>

            <button className="primaryBtn" type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Expense"}
            </button>

            {successOpen && (
                <div className="modalOverlay" role="dialog" aria-modal="true">
                    <div className="modalCard">
                        <div className="modalTitle">Expense added!</div>
                        <div className="modalBody">Your expense has been saved successfully.</div>

                        <button
                            type="button"
                            className="primaryBtn"
                            onClick={() => {
                                setSuccessOpen(false);
                                onSuccessClose?.();
                            }}
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}
        </form>
    );
}
