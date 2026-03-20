import React, { useState, useEffect } from 'react';
import styles from './Allowance.module.css';
import { useSalaryProfile } from '../../lib/useSalaryProfile';
import { useExpenses } from '../../lib/useExpenses';
import { upsertSalaryProfile } from '../../lib/data';
import { supabase } from '../../lib/supabase';
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
    const [saving, setSaving] = useState(false);

    const handleEditOpen = () => {
        setEditSource(profile?.source || 'Parents');
        setEditFreq(profile?.frequency || 'weekly');
        setEditAmount(String(profile?.cutoff1Gross || ''));
        setIsEditing(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not logged in");

            const amt = parseFloat(editAmount) || 0;
            const payload: any = {
                source: editSource,
                frequency: editFreq,
                cutoff1Gross: amt,
                cutoff1Deductions: profile?.cutoff1Deductions || 0,
                cutoff2Gross: editFreq !== 'monthly' ? amt : 0,
                cutoff2Deductions: editFreq !== 'monthly' ? (profile?.cutoff2Deductions || 0) : 0,
                cutoff3Gross: editFreq === 'weekly' ? amt : 0,
                cutoff3Deductions: editFreq === 'weekly' ? (profile?.cutoff3Deductions || 0) : 0,
                cutoff4Gross: editFreq === 'weekly' ? amt : 0,
                cutoff4Deductions: editFreq === 'weekly' ? (profile?.cutoff4Deductions || 0) : 0,
            };

            await upsertSalaryProfile(payload, user.id);
            await refetch();
            setIsEditing(false);
        } catch(err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const [isPockModalOpen, setIsPockModalOpen] = useState(false);
    const [pockName, setPockName] = useState('');
    const [pockIcon, setPockIcon] = useState('🍔');
    const [pockBudget, setPockBudget] = useState('');

    const pockets: Pocket[] = profile?.pockets || [];

    const getPreservedPayload = (newPockets: Pocket[]) => ({
        frequency: profile?.frequency,
        source: profile?.source,
        cutoff1Gross: profile?.cutoff1Gross,
        cutoff1Deductions: profile?.cutoff1Deductions,
        cutoff2Gross: profile?.cutoff2Gross,
        cutoff2Deductions: profile?.cutoff2Deductions,
        cutoff3Gross: profile?.cutoff3Gross,
        cutoff3Deductions: profile?.cutoff3Deductions,
        cutoff4Gross: profile?.cutoff4Gross,
        cutoff4Deductions: profile?.cutoff4Deductions,
        pockets: newPockets,
    });

    const handleAddPocket = async () => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not logged in");

            const newPocket: Pocket = {
                id: Date.now().toString(),
                name: pockName,
                icon: pockIcon,
                budget: parseFloat(pockBudget) || 0,
            };

            const updatedPockets = [...pockets, newPocket];
            await upsertSalaryProfile(getPreservedPayload(updatedPockets), user.id);
            await refetch();
            setIsPockModalOpen(false);
            setPockName('');
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
            await upsertSalaryProfile(getPreservedPayload(updatedPockets), user.id);
            await refetch();
        } catch(err) {
            console.error(err);
        }
    };

    // Calc total monthly allowance

    const totalMonthly = (profile?.cutoff1Gross || 0) + 
                         (profile?.cutoff2Gross || 0) + 
                         (profile?.cutoff3Gross || 0) + 
                         (profile?.cutoff4Gross || 0);

    useEffect(() => {
        // Just as an example, we could sum the current month's expenses
        // In a real app we'd filter by the current period
        const sum = expenses.reduce((acc, exp) => acc + (exp.amount || 0), 0);
        setTotalSpent(sum);
    }, [expenses]);

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
                        pockets.map((pocket) => (
                            <div key={pocket.id} className={styles.pocketCard} style={{ position: 'relative' }}>
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
                                <div className={styles.pocketAmt}>
                                    ₱{fmtMoney(pocket.budget)} <span style={{fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal'}}>budgeted</span>
                                </div>
                                <div className={styles.pocketBar}>
                                    <div 
                                        className={styles.pocketFill} 
                                        style={{ width: '0%' }}
                                    ></div>
                                </div>
                                <div style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px'}}>
                                    ₱0.00 spent
                                </div>
                            </div>
                        ))
                    )}
                </div>

            </section>

            <div className={styles.actions}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleEditOpen}>Update Allowance</button>
                <button className={`${styles.btn} ${styles.btnSecondary}`}>Allocation History</button>
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
                                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface-bg)', color: 'var(--text-primary)' }}
                            />
                        </div>

                        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Frequency</label>
                            <select 
                                value={editFreq} 
                                onChange={e => setEditFreq(e.target.value as IncomeFrequency)}
                                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface-bg)', color: 'var(--text-primary)' }}
                            >
                                <option value="weekly">Weekly</option>
                                <option value="bi-weekly">Bi-weekly</option>
                                <option value="monthly">Monthly</option>
                            </select>
                        </div>

                        <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Amount per period (₱)</label>
                            <input 
                                type="number" 
                                value={editAmount} 
                                onChange={e => setEditAmount(e.target.value)}
                                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface-bg)', color: 'var(--text-primary)' }}
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

            {isPockModalOpen && (
                <div className="modalOverlay" role="dialog" aria-modal="true">
                    <div className="modalCard" style={{ maxWidth: '400px' }}>
                        <h3 className="modalTitle">Add New Pocket</h3>
                        
                        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Pocket Name</label>
                            <input 
                                type="text" 
                                value={pockName} 
                                onChange={e => setPockName(e.target.value)}
                                placeholder="E.g. Groceries"
                                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface-bg)', color: 'var(--text-primary)' }}
                            />
                        </div>

                        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Icon (Emoji)</label>
                            <select 
                                value={pockIcon} 
                                onChange={e => setPockIcon(e.target.value)}
                                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface-bg)', color: 'var(--text-primary)' }}
                            >
                                <option value="🍔">🍔 Food & Dining</option>
                                <option value="🚌">🚌 Commute</option>
                                <option value="🎓">🎓 Education</option>
                                <option value="☕">☕ Leisure</option>
                                <option value="🏦">🏦 Savings</option>
                                <option value="🛒">🛒 Shopping</option>
                                <option value="📱">📱 Tech/Bills</option>
                            </select>
                        </div>

                        <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Budget Target (₱)</label>
                            <input 
                                type="number" 
                                value={pockBudget} 
                                onChange={e => setPockBudget(e.target.value)}
                                placeholder="0.00"
                                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface-bg)', color: 'var(--text-primary)' }}
                            />
                        </div>

                        <div className="modalActions">
                            <button className="ghostBtn" onClick={() => setIsPockModalOpen(false)} disabled={saving}>Cancel</button>
                            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleAddPocket} disabled={saving || !pockName}>
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
