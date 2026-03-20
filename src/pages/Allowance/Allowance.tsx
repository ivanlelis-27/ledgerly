import React, { useState, useEffect } from 'react';
import styles from './Allowance.module.css';
import { useSalaryProfile } from '../../lib/useSalaryProfile';
import { useExpenses } from '../../lib/useExpenses';
import { upsertSalaryProfile, updatePockets } from '../../lib/data';
import { supabase } from '../../lib/supabase';
import { QUICK_CATEGORIES } from '../../components/ExpenseForm/ExpenseForm';

import type { IncomeFrequency } from '../../types/salary';

function fmtMoney(n: number) {
    return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Pocket = {
    id: string;
    name: string;
    icon: string;
    budget: number;
};

const Allowance: React.FC = () => {
    const { profile, loading, refetch } = useSalaryProfile();
    const { expenses } = useExpenses();
    const [totalSpent, setTotalSpent] = useState(0);

    const [isEditing, setIsEditing] = useState(false);
    const [editSource, setEditSource] = useState('Parents');
    const [editFreq, setEditFreq] = useState<IncomeFrequency>('weekly');
    const [editAmount, setEditAmount] = useState('');
    const [editDeductions, setEditDeductions] = useState('');
    const [saving, setSaving] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    const handleEditOpen = () => {
        setEditSource(profile?.source || 'Parents');
        setEditFreq(profile?.frequency || 'weekly');
        setEditAmount(String(profile?.cutoff1Gross || ''));
        setEditDeductions(String(profile?.cutoff1Deductions || ''));
        setIsEditing(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not logged in");

            const amt = parseFloat(editAmount) || 0;
            const ded = parseFloat(editDeductions) || 0;
            const payload: any = {
                source: editSource,
                frequency: editFreq,
                cutoff1Gross: amt,
                cutoff1Deductions: ded,
                cutoff2Gross: editFreq !== 'monthly' ? amt : 0,
                cutoff2Deductions: editFreq !== 'monthly' ? ded : 0,
                cutoff3Gross: editFreq === 'weekly' ? amt : 0,
                cutoff3Deductions: editFreq === 'weekly' ? ded : 0,
                cutoff4Gross: editFreq === 'weekly' ? amt : 0,
                cutoff4Deductions: editFreq === 'weekly' ? ded : 0,
            };

            await upsertSalaryProfile(payload, user.id);
            await refetch({ soft: true });
            setIsEditing(false);
        } catch(err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const [isPockModalOpen, setIsPockModalOpen] = useState(false);
    const [pockCategory, setPockCategory] = useState(QUICK_CATEGORIES[0].value);
    const [pockBudget, setPockBudget] = useState('');

    const pockets: Pocket[] = profile?.pockets || [];

    const handleAddPocket = async () => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not logged in");

            const selectedCat = QUICK_CATEGORIES.find(c => c.value === pockCategory) || QUICK_CATEGORIES[0];
            const newPocket: Pocket = {
                id: Date.now().toString(),
                name: selectedCat.label,
                icon: selectedCat.emoji,
                budget: parseFloat(pockBudget) || 0,
            };

            const updatedPockets = [...pockets, newPocket];
            await updatePockets(updatedPockets, user.id);
            await refetch({ soft: true });
            setIsPockModalOpen(false);
            setPockCategory(QUICK_CATEGORIES[0].value);
            setPockBudget('');
        } catch(err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleDeletePocket = async (id: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const updatedPockets = pockets.filter(p => p.id !== id);
            await updatePockets(updatedPockets, user.id);
            await refetch({ soft: true });
        } catch(err) {
            console.error(err);
        }
    };

    const c1Gross = profile?.cutoff1Gross || 0;
    const c1Ded = profile?.cutoff1Deductions || 0;
    const c1Net = c1Gross - c1Ded;

    const totalGross = (profile?.cutoff1Gross || 0) + 
                       (profile?.cutoff2Gross || 0) + 
                       (profile?.cutoff3Gross || 0) + 
                       (profile?.cutoff4Gross || 0);

    const totalDeductions = (profile?.cutoff1Deductions || 0) + 
                            (profile?.cutoff2Deductions || 0) + 
                            (profile?.cutoff3Deductions || 0) + 
                            (profile?.cutoff4Deductions || 0);

    const totalMonthly = totalGross - totalDeductions;

    useEffect(() => {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const thisMonthExpenses = expenses.filter(exp => exp.date?.startsWith(currentMonth));
        const sum = thisMonthExpenses.reduce((acc, exp) => acc + (exp.amount || 0), 0);
        setTotalSpent(sum);
    }, [expenses]);

    const getPocketSpent = (pocketName: string) => {
        const currentMonth = new Date().toISOString().slice(0, 7);
        return expenses
            .filter(exp => exp.date?.startsWith(currentMonth) && exp.category?.toLowerCase() === pocketName.toLowerCase())
            .reduce((acc, exp) => acc + (Number(exp.amount) || 0), 0);
    };

    if (loading) return <div className={styles.container}>Loading...</div>;

    const remaining = totalMonthly - totalSpent;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Allowance Pool</h1>
                <p className={styles.subtitle}>Manage your student budget and spending pockets.</p>
            </header>

            <div className={styles.statsGrid}>
                <div className={styles.poolCard}>
                    <div className={styles.poolLabel}>Monthly Pool</div>
                    <div className={styles.poolAmount}>₱{fmtMoney(totalMonthly)}</div>
                    <div className={styles.poolMeta}>
                        From {profile?.source || 'Parents'} • {profile?.frequency}
                    </div>
                </div>

                <div className={styles.poolCard} style={{ background: '#3b82f6', boxShadow: '0 10px 30px rgba(59, 130, 246, 0.2)' }}>
                    <div className={styles.poolLabel}>Remaining Funds</div>
                    <div className={styles.poolAmount}>₱{fmtMoney(remaining)}</div>
                    <div className={styles.poolMeta}>
                        {Math.floor((remaining / totalMonthly) * 100)}% of your pool left
                    </div>
                </div>
            </div>

            <section>
                <div className={styles.pocketHeader}>
                    <h2 className={styles.title} style={{ fontSize: '20px' }}>Your Budget Pockets</h2>
                    <button className={`${styles.btn} ${styles.btnSecondary}`} style={{ padding: '8px 16px', fontSize: '12px' }} onClick={() => setIsPockModalOpen(true)}>
                        + Add Pocket
                    </button>
                </div>

                <div className={styles.pocketsGrid}>
                    {pockets.length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', border: '2px dashed var(--border-color)', borderRadius: '16px', gridColumn: '1 / -1', fontSize: '15px' }}>
                            You haven't added any budget pockets yet. <br/> Click <strong>+ Add Pocket</strong> to start organizing your funds!
                        </div>
                    ) : (
                        pockets.map((pocket) => {
                            const spent = getPocketSpent(pocket.name);
                            const progress = pocket.budget > 0 ? Math.min(100, (spent / pocket.budget) * 100) : 0;
                            const isOverBudget = spent > pocket.budget && pocket.budget > 0;

                            return (
                                <div key={pocket.id} className={styles.pocketCard} style={{ position: 'relative', borderColor: isOverBudget ? '#ef4444' : undefined }}>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeletePocket(pocket.id); }}
                                        style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, fontSize: '12px' }}
                                        title="Delete Pocket"
                                    >
                                        ✖
                                    </button>
                                    <div className={styles.pocketHeader} style={{ marginBottom: '8px' }}>
                                        <div className={styles.pocketIcon} style={{ width: '40px', height: '40px' }}>
                                            {pocket.icon}
                                        </div>
                                    </div>
                                    <div className={styles.pocketName} style={{ marginBottom: '4px' }}>{pocket.name}</div>
                                    <div className={styles.pocketAmt} style={{ color: isOverBudget ? '#ef4444' : undefined }}>
                                        ₱{fmtMoney(pocket.budget)} <span style={{fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal'}}>budgeted</span>
                                    </div>
                                    <div className={styles.pocketBar}>
                                        <div 
                                            className={styles.pocketFill} 
                                            style={{ width: `${progress}%`, background: isOverBudget ? '#ef4444' : undefined }}
                                        ></div>
                                    </div>
                                    <div style={{fontSize: '12px', color: isOverBudget ? '#ef4444' : 'var(--text-muted)', marginTop: '8px', fontWeight: isOverBudget ? 'bold' : 'normal'}}>
                                        ₱{fmtMoney(spent)} spent {isOverBudget && '(Over Budget!)'}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

            </section>

            <div className={styles.actions}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleEditOpen}>Update Allowance</button>
                <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setIsHistoryOpen(true)}>Allocation Breakdown</button>
            </div>

            {isEditing && (
                <div className="modalOverlay" role="dialog" aria-modal="true">
                    <div className="modalCard" style={{ maxWidth: '400px' }}>
                        <h3 className="modalTitle">Update Allowance</h3>
                        
                        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Source</label>
                            <input 
                                type="text" 
                                value={editSource} 
                                onChange={e => setEditSource(e.target.value)}
                                style={{ padding: '12px 16px', borderRadius: '12px', border: '1.5px solid var(--border-color)', background: 'var(--surface-bg)', color: 'var(--text-primary)', fontSize: '15px' }}
                            />
                        </div>

                        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Frequency</label>
                            <select 
                                value={editFreq} 
                                onChange={e => setEditFreq(e.target.value as IncomeFrequency)}
                                style={{ 
                                    padding: '12px 36px 12px 16px', 
                                    borderRadius: '12px', 
                                    border: '1.5px solid var(--border-color)', 
                                    background: 'var(--surface-bg)', 
                                    color: 'var(--text-primary)',
                                    fontSize: '15px',
                                    WebkitAppearance: 'none',
                                    appearance: 'none',
                                    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'right 14px center',
                                    backgroundSize: '16px',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="weekly">Weekly</option>
                                <option value="bi-weekly">Bi-weekly</option>
                                <option value="monthly">Monthly</option>
                            </select>
                        </div>

                        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Gross Amount per period (₱)</label>
                            <input 
                                type="number" 
                                value={editAmount} 
                                onChange={e => setEditAmount(e.target.value)}
                                style={{ padding: '12px 16px', borderRadius: '12px', border: '1.5px solid var(--border-color)', background: 'var(--surface-bg)', color: 'var(--text-primary)', fontSize: '15px' }}
                            />
                        </div>

                        <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Fixed Allocations per period (e.g. Tuition/Savings) ₱</label>
                            <input 
                                type="number" 
                                value={editDeductions} 
                                onChange={e => setEditDeductions(e.target.value)}
                                placeholder="0.00"
                                style={{ padding: '12px 16px', borderRadius: '12px', border: '1.5px solid var(--border-color)', background: 'var(--surface-bg)', color: 'var(--text-primary)', fontSize: '15px' }}
                            />
                        </div>

                        <div className="modalActions">
                            <button className="ghostBtn" onClick={() => setIsEditing(false)} disabled={saving}>Cancel</button>
                            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave} disabled={saving}>
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isHistoryOpen && (
                <div className="modalOverlay" role="dialog" aria-modal="true">
                    <div className="modalCard" style={{ maxWidth: '450px' }}>
                        <div className="modalTop">
                            <h3 className="modalTitle">Allocation Breakdown</h3>
                            <button className="iconBtn" onClick={() => setIsHistoryOpen(false)}>✕</button>
                        </div>
                        
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
                            This breakdown shows exactly how your total monthly pool is calculated from your {profile?.frequency} allowance.
                        </p>

                        <div style={{ background: 'var(--surface-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Gross {profile?.frequency} Allowance</span>
                                <span style={{ fontWeight: '600' }}>₱{fmtMoney(c1Gross)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '14px', color: '#ef4444' }}>
                                <span>Fixed Allocations (e.g. Savings)</span>
                                <span>-₱{fmtMoney(c1Ded)}</span>
                            </div>
                            
                            <div style={{ height: '1px', background: 'var(--border-color)', marginBottom: '16px' }}></div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '15px', fontWeight: 'bold' }}>
                                <span>Net Pool Per Period</span>
                                <span>₱{fmtMoney(c1Net)}</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)', marginTop: '16px' }}>
                                <span>Periods in a Month</span>
                                <span>x {profile?.frequency === 'weekly' ? 4 : profile?.frequency === 'bi-weekly' ? 2 : 1}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--accent-teal)', color: 'var(--bg-color)', padding: '16px 20px', borderRadius: '12px', fontWeight: 'bold' }}>
                            <span>Total Monthly Pool</span>
                            <span style={{ fontSize: '18px' }}>₱{fmtMoney(totalMonthly)}</span>
                        </div>
                        
                        <div className="modalActions" style={{ marginTop: '24px' }}>
                            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setIsHistoryOpen(false)} style={{ width: '100%' }}>
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isPockModalOpen && (
                <div className="modalOverlay" role="dialog" aria-modal="true">
                    <div className="modalCard" style={{ maxWidth: '400px' }}>
                        <h3 className="modalTitle">Add New Pocket</h3>
                        
                        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Category</label>
                            <select 
                                value={pockCategory} 
                                onChange={e => setPockCategory(e.target.value)}
                                style={{ 
                                    padding: '12px 36px 12px 16px', 
                                    borderRadius: '12px', 
                                    border: '1.5px solid var(--border-color)', 
                                    background: 'var(--surface-bg)', 
                                    color: 'var(--text-primary)',
                                    fontSize: '15px',
                                    WebkitAppearance: 'none',
                                    appearance: 'none',
                                    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'right 14px center',
                                    backgroundSize: '16px',
                                    cursor: 'pointer'
                                }}
                            >
                                {QUICK_CATEGORIES.map(c => (
                                    <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                                ))}
                            </select>
                        </div>



                        <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Budget Target (₱)</label>
                            <input 
                                type="number" 
                                value={pockBudget} 
                                onChange={e => setPockBudget(e.target.value)}
                                placeholder="0.00"
                                style={{ padding: '12px 16px', borderRadius: '12px', border: '1.5px solid var(--border-color)', background: 'var(--surface-bg)', color: 'var(--text-primary)', fontSize: '15px' }}
                            />
                        </div>

                        <div className="modalActions">
                            <button className="ghostBtn" onClick={() => setIsPockModalOpen(false)} disabled={saving}>Cancel</button>
                            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleAddPocket} disabled={saving}>
                                {saving ? "Saving..." : "Create Pocket"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Allowance;
