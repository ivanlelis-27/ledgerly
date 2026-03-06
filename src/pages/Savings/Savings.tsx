import { useState, useRef, useEffect } from "react";
import { useSavings } from "../../lib/useSavings";
import {
    upsertSavingsGoal,
    deleteSavingsGoal,
    addSavingsDeposit,
} from "../../lib/data";
import type { SavingsGoal, SavingsDeposit } from "../../types/savings";
import "./Savings.css";

// ─── helpers ───────────────────────────────────────────────
function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function fmt(n: number) {
    return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(n);
}

function today() {
    return new Date().toISOString().slice(0, 10);
}

function daysLeft(deadline?: string): number | null {
    if (!deadline) return null;
    const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
    return diff;
}

const EMOJIS = ["🏠", "🚗", "✈️", "💻", "🎓", "💍", "🏖️", "📱", "🐶", "💪", "🎯", "🛡️", "🌱", "🎁", "💰"];
const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#f97316", "#06b6d4", "#84cc16"];

// ─── Progress ring ──────────────────────────────────────────
function ProgressRing({ pct, color }: { pct: number; color: string }) {
    const r = 34;
    const circ = 2 * Math.PI * r;
    const offset = circ - (Math.min(pct, 100) / 100) * circ;
    return (
        <div className="progress-ring-container" style={{ width: 80, height: 80 }}>
            <svg className="progress-ring-svg" width={80} height={80} viewBox="0 0 80 80">
                <circle className="progress-ring-track" cx={40} cy={40} r={r} />
                <circle
                    className="progress-ring-fill"
                    cx={40} cy={40} r={r}
                    stroke={color}
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                />
            </svg>
            <div className="progress-ring-label">{Math.round(pct)}%</div>
        </div>
    );
}

// ─── Goal card ──────────────────────────────────────────────
function GoalCard({
    goal,
    onDeposit,
    onEdit,
    onDelete,
}: {
    goal: SavingsGoal;
    onDeposit: (g: SavingsGoal) => void;
    onEdit: (g: SavingsGoal) => void;
    onDelete: (g: SavingsGoal) => void;
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;
        function handler(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [menuOpen]);

    const pct = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
    const color = goal.color ?? "#6366f1";
    const days = daysLeft(goal.deadline);
    const isCompleted = goal.status === "completed" || goal.currentAmount >= goal.targetAmount;

    return (
        <div className={`goal-card${isCompleted ? " completed" : ""}`}>
            {/* Top row */}
            <div className="goal-card-top">
                <div className="goal-card-identity">
                    <span className="goal-emoji">{goal.emoji || "💰"}</span>
                    <div>
                        <div className="goal-name">{goal.name}</div>
                        {goal.deadline && (
                            <span className={`goal-deadline-badge${isCompleted ? " done" : days !== null && days <= 30 ? " urgent" : ""}`}>
                                {isCompleted ? "Completed 🎉" : days === null ? "" : days < 0 ? "Overdue" : days === 0 ? "Due today" : `${days}d left`}
                            </span>
                        )}
                    </div>
                </div>
                <div style={{ position: "relative" }} ref={menuRef}>
                    <button className="goal-menu-btn" aria-label="Goal options" onClick={() => setMenuOpen(v => !v)}>
                        ⋯
                    </button>
                    {menuOpen && (
                        <div className="goal-menu-popover">
                            <button className="goal-menu-item" onClick={() => { setMenuOpen(false); onEdit(goal); }}>✏️ Edit</button>
                            <button className="goal-menu-item danger" onClick={() => { setMenuOpen(false); onDelete(goal); }}>🗑 Delete</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Progress */}
            <div className="goal-progress-wrap">
                <ProgressRing pct={pct} color={color} />
                <div className="goal-amounts">
                    <div className="goal-current">{fmt(goal.currentAmount)}</div>
                    <div className="goal-target">of {fmt(goal.targetAmount)}</div>
                    {!isCompleted && (
                        <div className="goal-remaining">{fmt(Math.max(0, goal.targetAmount - goal.currentAmount))} to go</div>
                    )}
                </div>
            </div>

            {/* Deposit btn (only for active/paused) */}
            {!isCompleted && (
                <button className="deposit-btn" onClick={() => onDeposit(goal)}>
                    ＋ Add Deposit
                </button>
            )}
        </div>
    );
}

// ─── Goal form modal ────────────────────────────────────────
type GoalDraft = {
    name: string;
    targetAmount: string;
    emoji: string;
    color: string;
    deadline: string;
    notes: string;
};

function blankDraft(): GoalDraft {
    return { name: "", targetAmount: "", emoji: "💰", color: "#6366f1", deadline: "", notes: "" };
}

function draftFromGoal(g: SavingsGoal): GoalDraft {
    return {
        name: g.name,
        targetAmount: String(g.targetAmount),
        emoji: g.emoji ?? "💰",
        color: g.color ?? "#6366f1",
        deadline: g.deadline ?? "",
        notes: g.notes ?? "",
    };
}

function GoalModal({
    editGoal,
    onClose,
    onSaved,
}: {
    editGoal: SavingsGoal | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [draft, setDraft] = useState<GoalDraft>(editGoal ? draftFromGoal(editGoal) : blankDraft());
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    function set(field: keyof GoalDraft, value: string) {
        setDraft(prev => ({ ...prev, [field]: value }));
    }

    async function handleSave() {
        if (!draft.name.trim()) { setErr("Goal name is required."); return; }
        const target = parseFloat(draft.targetAmount);
        if (!target || target <= 0) { setErr("Enter a valid target amount."); return; }

        setSaving(true);
        setErr(null);
        try {
            const now = Date.now();
            const goal: SavingsGoal = {
                id: editGoal?.id ?? uid(),
                name: draft.name.trim(),
                targetAmount: target,
                currentAmount: editGoal?.currentAmount ?? 0,
                emoji: draft.emoji || undefined,
                color: draft.color || undefined,
                deadline: draft.deadline || undefined,
                notes: draft.notes.trim() || undefined,
                status: editGoal?.status ?? "active",
                createdAt: editGoal?.createdAt ?? now,
                updatedAt: now,
            };
            await upsertSavingsGoal(goal);
            onSaved();
            onClose();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : "Save failed.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="sv-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="sv-modal" role="dialog" aria-modal="true">
                <h2 className="sv-modal-title">{editGoal ? "Edit Goal" : "New Savings Goal"}</h2>

                {err && <div className="sv-error">{err}</div>}

                <div className="sv-field">
                    <label className="sv-label">Goal name</label>
                    <input className="sv-input" placeholder="e.g. Emergency Fund" value={draft.name} onChange={e => set("name", e.target.value)} />
                </div>

                <div className="sv-field">
                    <label className="sv-label">Target amount (PHP)</label>
                    <input className="sv-input" type="number" min="1" placeholder="50000" value={draft.targetAmount} onChange={e => set("targetAmount", e.target.value)} />
                </div>

                <div className="sv-field">
                    <label className="sv-label">Icon</label>
                    <div className="emoji-row">
                        {EMOJIS.map(em => (
                            <button key={em} type="button" className={`emoji-option${draft.emoji === em ? " selected" : ""}`} onClick={() => set("emoji", em)}>{em}</button>
                        ))}
                    </div>
                </div>

                <div className="sv-field">
                    <label className="sv-label">Color</label>
                    <div className="color-row">
                        {COLORS.map(c => (
                            <button key={c} type="button" className={`color-swatch${draft.color === c ? " selected" : ""}`} style={{ background: c }} onClick={() => set("color", c)} aria-label={c} />
                        ))}
                    </div>
                </div>

                <div className="sv-input-row">
                    <div className="sv-field">
                        <label className="sv-label">Deadline (optional)</label>
                        <input className="sv-input" type="date" value={draft.deadline} onChange={e => set("deadline", e.target.value)} />
                    </div>
                    <div className="sv-field">
                        <label className="sv-label">Notes (optional)</label>
                        <input className="sv-input" placeholder="Any notes…" value={draft.notes} onChange={e => set("notes", e.target.value)} />
                    </div>
                </div>

                <div className="sv-modal-actions">
                    <button className="sv-btn ghost" onClick={onClose}>Cancel</button>
                    <button className="sv-btn primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editGoal ? "Save Changes" : "Create Goal"}</button>
                </div>
            </div>
        </div>
    );
}

// ─── Deposit modal ──────────────────────────────────────────
function DepositModal({
    goal,
    onClose,
    onSaved,
}: {
    goal: SavingsGoal;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");
    const [date, setDate] = useState(today());
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function handleDeposit() {
        const num = parseFloat(amount);
        if (!num || num <= 0) { setErr("Enter a valid amount."); return; }

        setSaving(true);
        setErr(null);
        try {
            const deposit: SavingsDeposit = {
                id: uid(),
                goalId: goal.id,
                amount: num,
                date,
                note: note.trim() || undefined,
                createdAt: Date.now(),
            };
            await addSavingsDeposit(deposit);
            onSaved();
            onClose();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : "Deposit failed.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="sv-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="sv-modal sm" role="dialog" aria-modal="true">
                <h2 className="sv-modal-title">Add Deposit — {goal.emoji || "💰"} {goal.name}</h2>

                {err && <div className="sv-error">{err}</div>}

                <div className="sv-field">
                    <label className="sv-label">Amount (PHP)</label>
                    <input className="sv-input" type="number" min="1" placeholder="500" autoFocus value={amount} onChange={e => setAmount(e.target.value)} />
                </div>

                <div className="sv-field">
                    <label className="sv-label">Date</label>
                    <input className="sv-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>

                <div className="sv-field">
                    <label className="sv-label">Note (optional)</label>
                    <input className="sv-input" placeholder="e.g. Bonus from work" value={note} onChange={e => setNote(e.target.value)} />
                </div>

                <div className="sv-modal-actions">
                    <button className="sv-btn ghost" onClick={onClose}>Cancel</button>
                    <button className="sv-btn primary" onClick={handleDeposit} disabled={saving}>{saving ? "Saving…" : "Deposit"}</button>
                </div>
            </div>
        </div>
    );
}

// ─── Delete confirm modal ───────────────────────────────────
function DeleteModal({ goal, onClose, onDeleted }: { goal: SavingsGoal; onClose: () => void; onDeleted: () => void }) {
    const [deleting, setDeleting] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function handleDelete() {
        setDeleting(true);
        setErr(null);
        try {
            await deleteSavingsGoal(goal.id);
            onDeleted();
            onClose();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : "Delete failed.");
            setDeleting(false);
        }
    }

    return (
        <div className="sv-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="sv-modal sm" role="dialog" aria-modal="true">
                <h2 className="sv-modal-title">Delete goal?</h2>
                <p style={{ fontSize: "0.9rem", color: "var(--text-muted, #6b7280)", marginBottom: "0.5rem" }}>
                    This will permanently remove <strong>{goal.emoji} {goal.name}</strong> and all its deposit history.
                </p>
                {err && <div className="sv-error">{err}</div>}
                <div className="sv-modal-actions">
                    <button className="sv-btn ghost" onClick={onClose}>Cancel</button>
                    <button className="sv-btn danger" onClick={handleDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</button>
                </div>
            </div>
        </div>
    );
}

// ─── Main page ──────────────────────────────────────────────
export default function Savings() {
    const { goals, loading, error, refetch } = useSavings();

    const [showGoalModal, setShowGoalModal] = useState(false);
    const [editGoal, setEditGoal] = useState<SavingsGoal | null>(null);
    const [depositGoal, setDepositGoal] = useState<SavingsGoal | null>(null);
    const [deleteGoal, setDeleteGoal] = useState<SavingsGoal | null>(null);
    const [showCompleted, setShowCompleted] = useState(false);

    const activeGoals = goals.filter(g => g.status !== "completed" && g.currentAmount < g.targetAmount);
    const completedGoals = goals.filter(g => g.status === "completed" || g.currentAmount >= g.targetAmount);

    const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
    const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
    const overallPct = totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0;

    function openEdit(g: SavingsGoal) {
        setEditGoal(g);
        setShowGoalModal(true);
    }

    function openNew() {
        setEditGoal(null);
        setShowGoalModal(true);
    }

    return (
        <>
            <div className="savings-page">
                {/* Header */}
                <div className="savings-header">
                    <h1 className="savings-title">Savings</h1>
                    <button className="savings-new-btn" onClick={openNew}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                        New Goal
                    </button>
                </div>

                {/* Error */}
                {error && <div className="sv-error">{error}</div>}

                {/* Summary bar */}
                {goals.length > 0 && (
                    <div className="savings-summary">
                        <div className="summary-card">
                            <div className="summary-label">Total Saved</div>
                            <div className="summary-value accent">{fmt(totalSaved)}</div>
                        </div>
                        <div className="summary-card">
                            <div className="summary-label">Total Target</div>
                            <div className="summary-value">{fmt(totalTarget)}</div>
                        </div>
                        <div className="summary-card">
                            <div className="summary-label">Overall Progress</div>
                            <div className="summary-value">{overallPct.toFixed(1)}%</div>
                        </div>
                        <div className="summary-card">
                            <div className="summary-label">Active Goals</div>
                            <div className="summary-value">{activeGoals.length}</div>
                        </div>
                    </div>
                )}

                {/* Loading */}
                {loading && <div className="savings-loading">Loading your goals…</div>}

                {/* Empty state */}
                {!loading && goals.length === 0 && (
                    <div className="savings-empty">
                        <div className="savings-empty-icon">🏦</div>
                        <div className="savings-empty-title">No savings goals yet</div>
                        <div className="savings-empty-sub">Create your first goal — a vacation, a gadget, an emergency fund — and track it here.</div>
                        <button className="savings-new-btn" onClick={openNew}>＋ Create Goal</button>
                    </div>
                )}

                {/* Active goals */}
                {!loading && activeGoals.length > 0 && (
                    <>
                        <p className="savings-section-title">Active Goals</p>
                        <div className="goals-grid">
                            {activeGoals.map(g => (
                                <GoalCard
                                    key={g.id}
                                    goal={g}
                                    onDeposit={setDepositGoal}
                                    onEdit={openEdit}
                                    onDelete={setDeleteGoal}
                                />
                            ))}
                        </div>
                    </>
                )}

                {/* Completed goals */}
                {!loading && completedGoals.length > 0 && (
                    <>
                        <button
                            className={`completed-toggle${showCompleted ? " open" : ""}`}
                            onClick={() => setShowCompleted(v => !v)}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M9 18l6-6-6-6" />
                            </svg>
                            Completed ({completedGoals.length})
                        </button>
                        {showCompleted && (
                            <div className="goals-grid">
                                {completedGoals.map(g => (
                                    <GoalCard
                                        key={g.id}
                                        goal={g}
                                        onDeposit={setDepositGoal}
                                        onEdit={openEdit}
                                        onDelete={setDeleteGoal}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modals */}
            {showGoalModal && (
                <GoalModal
                    editGoal={editGoal}
                    onClose={() => setShowGoalModal(false)}
                    onSaved={refetch}
                />
            )}
            {depositGoal && (
                <DepositModal
                    goal={depositGoal}
                    onClose={() => setDepositGoal(null)}
                    onSaved={refetch}
                />
            )}
            {deleteGoal && (
                <DeleteModal
                    goal={deleteGoal}
                    onClose={() => setDeleteGoal(null)}
                    onDeleted={refetch}
                />
            )}
        </>
    );
}

