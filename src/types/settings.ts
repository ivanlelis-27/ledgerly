export type UserSettings = {
    currency: string;       // "PHP", "USD", etc.
    dateFmt: string;        // display format key
    defaultPM: string;      // default payment method
    weekStart: number;      // "monday" | "sunday" | "saturday"
    compactNums: boolean;   // show 1.2K instead of 1,200
    showCents: boolean;     // show decimal places
    updatedAt: number | null;
    userType: "employee" | "self-employed" | "student" | "other" | "";
    financialGoal: "track" | "save" | "debt" | "budget" | "";
    budgetStyle: "minimalist" | "optimizer" | "goal-seeker" | "";
    focusCategories: string[];
    onboardingCompleted: boolean;
};

export const DEFAULT_SETTINGS: UserSettings = {
    currency: "PHP",
    dateFmt: "MMM d, yyyy",
    defaultPM: "Cash",
    weekStart: 1,
    compactNums: false,
    showCents: true, // Changed from show_cents to showCents to match type
    updatedAt: null,
    userType: "",
    financialGoal: "",
    budgetStyle: "",
    focusCategories: [],
    onboardingCompleted: false,
};
