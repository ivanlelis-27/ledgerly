import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserSettings } from "../../lib/useUserSettings";
import "./Onboarding.css";

type Stage = "identity" | "goal" | "setup" | "celebration";

export default function Onboarding() {
    const nav = useNavigate();
    const { settings, update, loading } = useUserSettings();
    const [stage, setStage] = useState<Stage>("identity");
    
    // Local state for the onboarding flow
    const [userType, setUserType] = useState<string>("");
    const [financialGoal, setFinancialGoal] = useState<string>("");
    const [budgetStyle, setBudgetStyle] = useState<string>("");
    const [focusCategories, setFocusCategories] = useState<string[]>([]);

    useEffect(() => {
        if (!loading && settings.onboardingCompleted && stage !== "celebration") {
            nav("/dashboard", { replace: true });
        }
    }, [loading, settings, nav, stage]);

    const toggleFocus = (cat: string) => {
        setFocusCategories(prev => 
            prev.includes(cat) ? prev.filter(c => c !== cat) : 
            prev.length < 3 ? [...prev, cat] : prev
        );
    };

    const handleComplete = async () => {
        // Show celebration first
        setStage("celebration");
        
        try {
            await update({
                userType: userType as any,
                financialGoal: financialGoal as any,
                budgetStyle: budgetStyle as any,
                focusCategories: focusCategories,
                onboardingCompleted: true,
            }, true);
            
            // Wait for animation to play
            setTimeout(() => {
                nav("/dashboard", { replace: true });
            }, 3500);
        } catch (err) {
            console.error("Failed to save onboarding data", err);
            // Even if it fails, try to move forward or show error
            nav("/dashboard", { replace: true });
        }
    };

    if (loading) return <div className="onboarding-loading">Loading...</div>;

    const renderStage = () => {
        switch (stage) {
            case "identity":
                return (
                    <div className="onboarding-stage fade-in">
                        <h2 className="stage-title">Who are you?</h2>
                        <p className="stage-desc">Tell us a bit about yourself so we can tailor your experience.</p>
                        <div className="card-grid">
                            <SelectionCard 
                                icon={<EmployeeIcon />} 
                                title="Employee" 
                                selected={userType === "employee"} 
                                onClick={() => setUserType("employee")} 
                            />
                            <SelectionCard 
                                icon={<SelfEmployedIcon />} 
                                title="Self-employed" 
                                selected={userType === "self-employed"} 
                                onClick={() => setUserType("self-employed")} 
                            />
                            <SelectionCard 
                                icon={<StudentIcon />} 
                                title="Student" 
                                selected={userType === "student"} 
                                onClick={() => setUserType("student")} 
                            />
                            <SelectionCard 
                                icon={<OtherIcon />} 
                                title="Other" 
                                selected={userType === "other"} 
                                onClick={() => setUserType("other")} 
                            />
                        </div>
                        <button 
                            className="onboarding-btn primary" 
                            disabled={!userType} 
                            onClick={() => setStage("goal")}
                        >
                            Next
                        </button>
                    </div>
                );
            case "goal":
                return (
                    <div className="onboarding-stage fade-in">
                        <h2 className="stage-title">
                            {userType === "student" ? "Ready to master your scholarship?" : 
                             userType === "employee" ? "Let's optimize your salary." : 
                             "What's your main goal?"}
                        </h2>
                        <p className="stage-desc">We'll help you focus on what matters most.</p>
                        <div className="card-grid">
                            <SelectionCard 
                                icon={<TrackIcon />} 
                                title="Track Spending" 
                                selected={financialGoal === "track"} 
                                onClick={() => setFinancialGoal("track")} 
                            />
                            <SelectionCard 
                                icon={<SaveIcon />} 
                                title="Save Money" 
                                selected={financialGoal === "save"} 
                                onClick={() => setFinancialGoal("save")} 
                            />
                            <SelectionCard 
                                icon={<DebtIcon />} 
                                title="Manage Debt" 
                                selected={financialGoal === "debt"} 
                                onClick={() => setFinancialGoal("debt")} 
                            />
                            <SelectionCard 
                                icon={<BudgetIcon />} 
                                title="Budgeting" 
                                selected={financialGoal === "budget"} 
                                onClick={() => setFinancialGoal("budget")} 
                            />
                        </div>
                        <div className="btn-group">
                            <button className="onboarding-btn ghost" onClick={() => setStage("identity")}>Back</button>
                            <button 
                                className="onboarding-btn primary" 
                                disabled={!financialGoal} 
                                onClick={() => setStage("setup")}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                );
            case "setup":
                return (
                    <div className="onboarding-stage fade-in">
                        <h2 className="stage-title">Your Style</h2>
                        <p className="stage-desc">How do you want to manage your money?</p>
                        <div className="style-selection card-grid">
                            <SelectionCard 
                                icon={<MinimalistIcon />} 
                                title="The Minimalist" 
                                sub="Just see where it goes."
                                selected={budgetStyle === "minimalist"} 
                                onClick={() => setBudgetStyle("minimalist")} 
                            />
                            <SelectionCard 
                                icon={<OptimizerIcon />} 
                                title="The Optimizer" 
                                sub="Track every cent."
                                selected={budgetStyle === "optimizer"} 
                                onClick={() => setBudgetStyle("optimizer")} 
                            />
                            <SelectionCard 
                                icon={<GoalIcon />} 
                                title="The Goal-Seeker" 
                                sub="Saving for something big."
                                selected={budgetStyle === "goal-seeker"} 
                                onClick={() => setBudgetStyle("goal-seeker")} 
                            />
                        </div>

                        <div className="focus-section">
                            <p className="focus-label">Pick up to 3 focus categories:</p>
                            <div className="focus-chips">
                                {[
                                    { name: "Rent", icon: "🏠" },
                                    { name: "Food", icon: "🍔" },
                                    { name: "Transport", icon: "🚗" },
                                    { name: "Shopping", icon: "🛍️" },
                                    { name: "Entertainment", icon: "🎬" },
                                    { name: "Savings", icon: "💰" }
                                ].map(cat => (
                                    <button 
                                        key={cat.name} 
                                        className={`focus-chip ${focusCategories.includes(cat.name) ? "active" : ""}`}
                                        onClick={() => toggleFocus(cat.name)}
                                    >
                                        <span className="chip-icon">{cat.icon}</span>
                                        <span className="chip-name">{cat.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="btn-group">
                            <button className="onboarding-btn ghost" onClick={() => setStage("goal")}>Back</button>
                            <button 
                                className="onboarding-btn primary" 
                                disabled={!budgetStyle || focusCategories.length === 0}
                                onClick={handleComplete}
                            >
                                Get Started
                            </button>
                        </div>
                    </div>
                );
            case "celebration":
                return (
                    <div className="onboarding-stage celebration-stage">
                        <div className="celebration-content">
                            <div className="confetti-container">
                                {/* Confetti particles will be handled by CSS */}
                                {[...Array(20)].map((_, i) => (
                                    <div key={i} className={`confetti-piece p${i}`} />
                                ))}
                            </div>
                            <div className="success-icon-wrapper">
                                <SuccessIcon />
                            </div>
                            <h2 className="stage-title scale-up">You're all set!</h2>
                            <p className="stage-desc fade-in-delayed">
                                {userType === "student" ? "Your academic financial journey starts now." : 
                                 userType === "employee" ? "Time to master your salary." : 
                                 "We've personalized your dashboard."}
                            </p>
                            <div className="loading-spinner-wrapper">
                                <div className="spinner" />
                                <span>Preparing your personal dashboard...</span>
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className={`onboarding-container stage-${stage}`}>
            <div className="mesh-gradient" />
            <div className="onboarding-content">
                <div className="progress-bar">
                    <div className={`progress-fill stage-${stage}`} />
                </div>
                {renderStage()}
            </div>
        </div>
    );
}

function SelectionCard({ icon, title, sub, selected, onClick }: { icon: React.ReactNode, title: string, sub?: string, selected: boolean, onClick: () => void }) {
    return (
        <div className={`selection-card ${selected ? "selected" : ""}`} onClick={onClick}>
            <div className="card-icon">{icon}</div>
            <div className="card-text">
                <span className="card-title">{title}</span>
                {sub && <span className="card-sub">{sub}</span>}
            </div>
            {selected && <div className="selected-dot" />}
        </div>
    );
}

// Custom Icons as SVGs
function EmployeeIcon() {
    return <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
}

function SelfEmployedIcon() {
    return <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}

function StudentIcon() {
    return <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>;
}

function OtherIcon() {
    return <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>;
}

function TrackIcon() {
    return <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
}

function SaveIcon() {
    return <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
}

function DebtIcon() {
    return <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
}

function BudgetIcon() {
    return <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>;
}

function MinimalistIcon() {
    return <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4V12h-4Z"/></svg>;
}

function OptimizerIcon() {
    return <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}

function GoalIcon() {
    return <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>;
}

function SuccessIcon() {
    return (
        <svg viewBox="0 0 24 24" width="80" height="80" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="success-svg">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    );
}
