export type SalaryProfile = {
    monthlyIncome: number; // total net = cutoff1Net + cutoff2Net (or direct entry)
    updatedAt: number;

    // 1st Cutoff (1st–15th)
    cutoff1Gross: number; // gross pay before deductions
    cutoff1Deductions: number; // tax + SSS + PhilHealth + Pag-IBIG + etc.
    cutoff1Net: number; // computed server-side: gross - deductions

    // 2nd Cutoff (16th–end of month)
    cutoff2Gross: number;
    cutoff2Deductions: number;
    cutoff2Net: number;
};
