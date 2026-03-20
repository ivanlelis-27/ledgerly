import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

export interface CategoryHint {
    category: string;
    subcategory: string;
}

// ── Local dictionary (zero tokens, instant) ────────────────────────
// Keys are lowercase substrings to match against the input name.
// More specific entries come first so they win over shorter matches.
const LOCAL_HINTS: [string, CategoryHint][] = [
    // ── Streaming ──
    ["netflix",      { category: "Subscriptions",       subcategory: "streaming"             }],
    ["disney+",      { category: "Subscriptions",       subcategory: "streaming"             }],
    ["disney",       { category: "Subscriptions",       subcategory: "streaming"             }],
    ["hbo",          { category: "Subscriptions",       subcategory: "streaming"             }],
    ["viu",          { category: "Subscriptions",       subcategory: "streaming"             }],
    ["prime video",  { category: "Subscriptions",       subcategory: "streaming"             }],
    ["apple tv",     { category: "Subscriptions",       subcategory: "streaming"             }],
    ["youtube premium", { category: "Subscriptions",    subcategory: "streaming"             }],
    // ── Music ──
    ["spotify",      { category: "Subscriptions",       subcategory: "music"                 }],
    ["apple music",  { category: "Subscriptions",       subcategory: "music"                 }],
    ["deezer",       { category: "Subscriptions",       subcategory: "music"                 }],
    // ── Software / SaaS ──
    ["microsoft 365",{ category: "Subscriptions",       subcategory: "software"              }],
    ["microsoft",    { category: "Subscriptions",       subcategory: "software"              }],
    ["adobe",        { category: "Subscriptions",       subcategory: "software"              }],
    ["notion",       { category: "Subscriptions",       subcategory: "software"              }],
    ["canva",        { category: "Subscriptions",       subcategory: "software"              }],
    ["chatgpt",      { category: "Subscriptions",       subcategory: "software"              }],
    ["openai",       { category: "Subscriptions",       subcategory: "software"              }],
    ["figma",        { category: "Subscriptions",       subcategory: "software"              }],
    ["github",       { category: "Subscriptions",       subcategory: "software"              }],
    ["grammarly",    { category: "Subscriptions",       subcategory: "software"              }],
    // ── Cloud storage ──
    ["google one",   { category: "Subscriptions",       subcategory: "cloud storage"         }],
    ["icloud",       { category: "Subscriptions",       subcategory: "cloud storage"         }],
    ["dropbox",      { category: "Subscriptions",       subcategory: "cloud storage"         }],
    // ── Gaming ──
    ["steam",        { category: "Subscriptions",       subcategory: "gaming"                }],
    ["xbox",         { category: "Subscriptions",       subcategory: "gaming"                }],
    ["playstation",  { category: "Subscriptions",       subcategory: "gaming"                }],
    ["ps plus",      { category: "Subscriptions",       subcategory: "gaming"                }],
    // ── PH Internet / Telco ──
    ["converge",     { category: "Bills & Utilities",   subcategory: "internet"              }],
    ["pldt",         { category: "Bills & Utilities",   subcategory: "internet"              }],
    ["globe broadband", { category: "Bills & Utilities",subcategory: "internet"              }],
    ["globe",        { category: "Bills & Utilities",   subcategory: "internet"              }],
    ["sky broadband",{ category: "Bills & Utilities",   subcategory: "internet"              }],
    ["sky cable",    { category: "Bills & Utilities",   subcategory: "internet"              }],
    // Mobile load
    ["smart",        { category: "Bills & Utilities",   subcategory: "mobile load"           }],
    ["sun cellular", { category: "Bills & Utilities",   subcategory: "mobile load"           }],
    ["tnt",          { category: "Bills & Utilities",   subcategory: "mobile load"           }],
    // ── PH Electricity ──
    ["meralco",      { category: "Bills & Utilities",   subcategory: "electricity"           }],
    ["veco",         { category: "Bills & Utilities",   subcategory: "electricity"           }],
    ["cebu electric",{ category: "Bills & Utilities",   subcategory: "electricity"           }],
    // ── PH Water ──
    ["maynilad",     { category: "Bills & Utilities",   subcategory: "water"                 }],
    ["manila water", { category: "Bills & Utilities",   subcategory: "water"                 }],
    // ── Rent / HOA ──
    ["rent",         { category: "Bills & Utilities",   subcategory: "rent"                  }],
    ["hoa",          { category: "Bills & Utilities",   subcategory: "HOA"                   }],
    // ── Banks / Credit cards (PH) ──
    ["bpi",          { category: "Debt & Payments",     subcategory: "credit card payment"   }],
    ["bdo",          { category: "Debt & Payments",     subcategory: "credit card payment"   }],
    ["metrobank",    { category: "Debt & Payments",     subcategory: "credit card payment"   }],
    ["unionbank",    { category: "Debt & Payments",     subcategory: "credit card payment"   }],
    ["rcbc",         { category: "Debt & Payments",     subcategory: "credit card payment"   }],
    ["eastwest",     { category: "Debt & Payments",     subcategory: "credit card payment"   }],
    ["security bank",{ category: "Debt & Payments",     subcategory: "credit card payment"   }],
    // ── PH Lending ──
    ["tala",         { category: "Debt & Payments",     subcategory: "loan"                  }],
    ["cashalo",      { category: "Debt & Payments",     subcategory: "loan"                  }],
    ["home credit",  { category: "Debt & Payments",     subcategory: "loan"                  }],
    ["tonik",        { category: "Debt & Payments",     subcategory: "loan"                  }],
    ["gloan",        { category: "Debt & Payments",     subcategory: "loan"                  }],
    // ── Gov't ──
    ["sss",          { category: "Debt & Payments",     subcategory: "loan"                  }],
    ["gsis",         { category: "Debt & Payments",     subcategory: "loan"                  }],
    ["pag-ibig",     { category: "Savings & Investments",subcategory: "savings"              }],
    ["pagibig",      { category: "Savings & Investments",subcategory: "savings"              }],
    ["philhealth",   { category: "Health",              subcategory: "checkups"              }],
    // ── Health ──
    ["gym",          { category: "Health",              subcategory: "gym"                   }],
    ["anytime fitness", { category: "Health",           subcategory: "gym"                   }],
    // ── Transport ──
    ["grab",         { category: "Transport",           subcategory: "grab/angkas"           }],
    ["angkas",       { category: "Transport",           subcategory: "grab/angkas"           }],
    ["toll",         { category: "Transport",           subcategory: "gas"                   }],
];

function localLookup(name: string): CategoryHint | null {
    const key = name.toLowerCase().trim();
    for (const [pattern, hint] of LOCAL_HINTS) {
        if (key.includes(pattern)) return hint;
    }
    return null;
}

// ── Hook ──────────────────────────────────────────────────────────
/**
 * Returns an AI-powered category hint when the user types a name.
 * - Checks the local dictionary first (instant, no tokens).
 * - Falls back to a minimal Groq call (debounced 800ms) for unknowns.
 * - `enabled` should be false once the user has manually picked a category.
 */
export function useAiCategoryHint(name: string, enabled: boolean) {
    const [hint, setHint] = useState<CategoryHint | null>(null);
    const [loading, setLoading] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        abortRef.current?.abort();

        if (!enabled || name.trim().length < 3) {
            setHint(null);
            setLoading(false);
            return;
        }

        // 1. Local lookup — instant, no API
        const local = localLookup(name);
        if (local) {
            setHint(local);
            setLoading(false);
            return;
        }

        // 2. Unknown — debounce then call Groq via edge function
        setLoading(true);
        timerRef.current = setTimeout(async () => {
            const ctrl = new AbortController();
            abortRef.current = ctrl;
            try {
                const { data } = await supabase.functions.invoke("category-hint", {
                    body: { name: name.trim() },
                });
                if (ctrl.signal.aborted) return;
                if (data?.category) {
                    setHint({ category: data.category, subcategory: data.subcategory ?? "" });
                } else {
                    setHint(null);
                }
            } catch {
                if (!ctrl.signal.aborted) setHint(null);
            } finally {
                if (!ctrl.signal.aborted) setLoading(false);
            }
        }, 800);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            abortRef.current?.abort();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [name, enabled]);

    return {
        hint,
        loading,
        clearHint: () => setHint(null),
    };
}
