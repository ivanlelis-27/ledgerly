import type { RecentCategory } from "../types/expense";

const RECENT_KEY = "ledgerly:recentCategories:v2";
const MAX_RECENTS = 8;

const LAST_PM_KEY = "ledgerly:lastPaymentMethod";

const MERCHANT_HINTS_KEY = "ledgerly:merchantHints:v1";
const MAX_HINTS = 30;

type MerchantHint = {
    merchant: string;
    category: string;
    subcategory?: string;
    lastUsedAt: number;
};

function readJSON<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw) as T;
        return parsed ?? fallback;
    } catch {
        return fallback;
    }
}

function writeJSON(key: string, value: unknown) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        /* ignore write errors */
    }
}

// =========================
// Recent categories
// =========================

export function getRecentCategories(): RecentCategory[] {
    const list = readJSON<RecentCategory[]>(RECENT_KEY, []);
    if (!Array.isArray(list)) return [];
    return list
        .filter((entry) => typeof entry?.category === "string")
        .map((entry) => ({
            category: entry.category,
            subcategory: entry.subcategory ?? "",
            lastUsedAt: entry.lastUsedAt ?? Date.now(),
        }))
        .slice(0, MAX_RECENTS);
}

export function bumpRecentCategory(category: string, subcategory?: string) {
    if (!category?.trim()) return;

    const entry: RecentCategory = {
        category: category.trim(),
        subcategory: subcategory?.trim() || "",
        lastUsedAt: Date.now(),
    };

    const existing = getRecentCategories();
    const filtered = existing.filter(
        (item) => !(item.category === entry.category && (item.subcategory ?? "") === entry.subcategory)
    );

    writeJSON(RECENT_KEY, [entry, ...filtered].slice(0, MAX_RECENTS));
}

// =========================
// Payment method preference
// =========================

export function getLastPaymentMethod(): string | null {
    try {
        return localStorage.getItem(LAST_PM_KEY);
    } catch {
        return null;
    }
}

export function setLastPaymentMethod(pm: string) {
    try {
        localStorage.setItem(LAST_PM_KEY, pm);
    } catch {
        /* ignore */
    }
}

// =========================
// Merchant hints
// =========================

function normalizeMerchant(value: string) {
    return value.trim().toLowerCase();
}

export function getMerchantHints(): MerchantHint[] {
    const hints = readJSON<MerchantHint[]>(MERCHANT_HINTS_KEY, []);
    if (!Array.isArray(hints)) return [];
    return hints
        .filter((hint) => typeof hint.merchant === "string" && hint.merchant.length > 0)
        .slice(0, MAX_HINTS);
}

export function rememberMerchantCategory(merchant: string, category: string, subcategory?: string) {
    const normalized = normalizeMerchant(merchant);
    if (!normalized || !category?.trim()) return;

    const now = Date.now();
    const next: MerchantHint = {
        merchant: normalized,
        category: category.trim(),
        subcategory: subcategory?.trim() || "",
        lastUsedAt: now,
    };

    const prev = getMerchantHints();
    const filtered = prev.filter(
        (hint) =>
            !(
                hint.merchant === next.merchant &&
                hint.category === next.category &&
                (hint.subcategory ?? "") === next.subcategory
            )
    );

    writeJSON(MERCHANT_HINTS_KEY, [next, ...filtered].slice(0, MAX_HINTS));
}

export function findMerchantHint(query: string): MerchantHint | null {
    const normalized = normalizeMerchant(query);
    if (!normalized) return null;

    const hints = getMerchantHints();
    const hit = hints.find((hint) => hint.merchant.includes(normalized));
    return hit ?? null;
}

export type { MerchantHint };
