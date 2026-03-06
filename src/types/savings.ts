export type SavingsGoalStatus = "active" | "completed" | "paused";

export type SavingsGoal = {
    id: string;
    name: string;
    targetAmount: number;    // PHP
    currentAmount: number;   // PHP accumulated so far
    emoji?: string;
    color?: string;          // accent hex, e.g. "#6366f1"
    deadline?: string;       // YYYY-MM-DD (optional)
    notes?: string;
    status: SavingsGoalStatus;
    createdAt: number;
    updatedAt: number;
};

export type SavingsDeposit = {
    id: string;
    goalId: string;
    amount: number;
    date: string;            // YYYY-MM-DD
    note?: string;
    createdAt: number;
};
