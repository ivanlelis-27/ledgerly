import React, { useState, useEffect } from 'react';
import styles from './Allowance.module.css';
import { useSalaryProfile } from '../../lib/useSalaryProfile';
import { useExpenses } from '../../lib/useExpenses';

function fmtMoney(n: number) {
    return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const DEFAULT_POCKETS = [
    { name: 'Food', icon: '🍔', allocation: 0.3 },
    { name: 'Commute', icon: '🚌', allocation: 0.15 },
    { name: 'School', icon: '🎓', allocation: 0.2 },
    { name: 'Fun', icon: '☕', allocation: 0.1 },
    { name: 'Savings', icon: '🏦', allocation: 200 }, // Absolute values supported if we want
];

const Allowance: React.FC = () => {
    const { profile, loading } = useSalaryProfile();
    const { expenses } = useExpenses();
    const [totalSpent, setTotalSpent] = useState(0);

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
                    <button className={styles.btnSecondary} style={{ padding: '8px 16px', fontSize: '12px' }}>
                        + Add Pocket
                    </button>
                </div>

                <div className={styles.pocketsGrid}>
                    {DEFAULT_POCKETS.map((pocket, idx) => (
                        <div key={idx} className={styles.pocketCard}>
                            <div className={styles.pocketHeader}>
                                <div className={styles.pocketName}>{pocket.name}</div>
                                <div className={styles.pocketIcon}>
                                    {pocket.icon}
                                </div>
                            </div>
                            <div className={styles.pocketAmt}>
                                ₱{fmtMoney(totalMonthly * (typeof pocket.allocation === 'number' && pocket.allocation < 1 ? pocket.allocation : 0))}
                            </div>
                            <div className={styles.pocketBar}>
                                <div 
                                    className={styles.pocketFill} 
                                    style={{ width: `${(pocket.allocation < 1 ? pocket.allocation : 0.1) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <div className={styles.actions}>
                <button className={styles.btnPrimary} onClick={() => {}}>Update Allowance</button>
                <button className={styles.btnSecondary}>Allocation History</button>
            </div>
        </div>
    );
};

export default Allowance;
