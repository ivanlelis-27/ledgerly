export type IncomeFrequency = "monthly" | "bi-weekly" | "weekly";

export type SalaryPeriod = {
    gross: number;
    deductions: number;
    net: number;
};

export type SalaryProfile = {
    monthlyIncome: number;
    updatedAt: number;
    frequency: IncomeFrequency;
    source: string;

    // Up to 4 periods (Week 1-4, or 1st/2nd Cutoff, or Full Month)
    cutoff1Gross: number;
    cutoff1Deductions: number;
    cutoff1Net: number;
    cutoff2Gross: number;
    cutoff2Deductions: number;
    cutoff2Net: number;
    cutoff3Gross: number;
    cutoff3Deductions: number;
    cutoff3Net: number;
    cutoff4Gross: number;
    cutoff4Deductions: number;
    cutoff4Net: number;
};
