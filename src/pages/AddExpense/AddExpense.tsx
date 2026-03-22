import { useState } from "react";
import ExpenseForm, { type ExpenseDraft } from "../../components/ExpenseForm/ExpenseForm";
import ExpenseList from "../../components/ExpenseList/ExpenseList";
import {
    bumpRecentCategory,
    getRecentCategories,
    rememberMerchantCategory,
    setLastPaymentMethod,
} from "../../lib/storage";
import { todayISO } from "../../lib/dates";
import { PAYMENT_METHODS, type Expense, type PaymentMethod, type RecentCategory } from "../../types/expense";
import { useExpenses } from "../../lib/useExpenses";
import { insertExpense, removeExpense } from "../../lib/data";
import "./AddExpense.css";

function coercePaymentMethod(v: unknown): PaymentMethod {
    return PAYMENT_METHODS.includes(v as PaymentMethod) ? (v as PaymentMethod) : "cash";
}

export default function AddExpense() {
    const { expenses, loading, error, refetch } = useExpenses();
    const [recent, setRecent] = useState<RecentCategory[]>(() => getRecentCategories());
    const [isModalOpen, setIsModalOpen] = useState(false);


    async function handleDelete(id: string) {
        try {
            await removeExpense(id);
            await refetch();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to delete expense.";
            window.alert(message);
        }
    }

    async function handleSubmit(form: ExpenseDraft) {
        const paymentMethod = coercePaymentMethod(form.paymentMethod);

        const expense: Expense = {
            id: crypto.randomUUID(),
            amount: form.amount,
            date: form.date || todayISO(),
            category: form.category,
            subcategory: form.subcategory || "",
            notes: form.notes || "",
            paymentMethod,
            tags: form.tags ?? [],
            createdAt: Date.now(),
        };

        try {
            await insertExpense(expense);
            bumpRecentCategory(expense.category, expense.subcategory);
            setLastPaymentMethod(expense.paymentMethod);

            if (expense.notes?.trim()) {
                rememberMerchantCategory(expense.notes, expense.category, expense.subcategory);
            }

            setRecent(getRecentCategories());
            await refetch();
        } catch (err: unknown) {
            console.error("Insert expense failed:", err);
            const message = err instanceof Error ? err.message : "Failed to save expense.";
            window.alert(message);
        }
    }

    return (
        <div className="addPage">
            <div className="addHeader">
                <div className="addTitleRow">
                    <h1 className="title">Expenses</h1>

                    <button
                        className="miniAddBtn"
                        type="button"
                        onClick={() => setIsModalOpen(true)}
                    >
                        + Add expense
                    </button>
                </div>

                <p className="sub">All your logged expenses.</p>
            </div>



            <div className="listTopRow">
                <div className="listSpacer" aria-hidden="true" />
            </div>

            <div className="card">
                {loading ? (
                    <div className="empty">Loading expenses…</div>
                ) : error ? (
                    <div className="empty">{error}</div>
                ) : expenses.length === 0 ? (
                    <div className="empty">No expenses yet. Click “Add expense”.</div>
                ) : (
                    <ExpenseList expenses={expenses} onDelete={handleDelete} />
                )}
            </div>


            {isModalOpen && (
                <div
                    className="modalOverlay"
                    role="dialog"
                    aria-modal="true"
                    onPointerDown={() => setIsModalOpen(false)}
                >
                    <div
                        className="modalCard"
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <div className="modalTop">
                            <div className="modalTitle">Add expense</div>
                            <button className="iconBtn" type="button" onClick={() => setIsModalOpen(false)} aria-label="Close">
                                ✕
                            </button>
                        </div>

                        <ExpenseForm
                            onSubmit={handleSubmit}
                            recentCategories={recent}
                            onSuccessClose={() => setIsModalOpen(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
