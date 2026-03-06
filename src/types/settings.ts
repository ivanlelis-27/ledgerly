export type UserSettings = {
    currency: string;       // "PHP", "USD", etc.
    dateFmt: string;        // display format key
    defaultPM: string;      // default payment method
    weekStart: string;      // "monday" | "sunday" | "saturday"
    compactNums: boolean;   // show 1.2K instead of 1,200
    showCents: boolean;     // show decimal places
    updatedAt: number;
};

export const DEFAULT_SETTINGS: UserSettings = {
    currency: "PHP",
    dateFmt: "MMM D, YYYY",
    defaultPM: "cash",
    weekStart: "monday",
    compactNums: false,
    showCents: true,
    updatedAt: 0,
};
