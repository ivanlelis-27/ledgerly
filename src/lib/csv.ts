import type { Expense } from "../types/expense";

export function expensesToCSV(expenses: Expense[]): string {
    const headers = ["amount", "date", "category", "subcategory", "notes", "paymentMethod", "tags", "id"];
    const rows = expenses.map((e) => [
        e.amount,
        e.date,
        e.category,
        e.subcategory ?? "",
        e.notes ?? "",
        e.paymentMethod ?? "",
        (e.tags ?? []).join("|"),
        e.id,
    ]);

    const escape = (v: unknown) => {
        const s = String(v ?? "");
        if (s.includes('"') || s.includes(",") || s.includes("\n")) return `"${s.replaceAll('"', '""')}"`;
        return s;
    };

    return [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}

export function downloadTextFile(filename: string, content: string) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
