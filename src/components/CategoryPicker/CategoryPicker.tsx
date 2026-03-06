import { useEffect, useMemo, useState } from "react";
import { CATEGORIES } from "../../data/categories";
import type { RecentCategory } from "../../types/expense";
import "./CategoryPicker.css";

type Props = {
    valueCategory: string;
    valueSubcategory: string;
    onPick: (category: string, subcategory: string) => void;
    recent?: RecentCategory[];
};

type Hit = { category: string; subcategory: string };

function formatLabel(category: string, subcategory: string) {
    if (!category) return "";
    return subcategory ? `${category} / ${subcategory}` : category;
}

export default function CategoryPicker({
    valueCategory,
    valueSubcategory,
    onPick,
}: Props) {
    const selectedLabel = formatLabel(valueCategory, valueSubcategory);

    const [input, setInput] = useState<string>(selectedLabel);
    const [open, setOpen] = useState(false);

    // Keep input synced if parent changes selected category (e.g. restore/auto-fill)
    useEffect(() => {
        setInput(selectedLabel);
    }, [selectedLabel]);

    const results = useMemo<Hit[]>(() => {
        const q = input.trim().toLowerCase();
        if (!q) return [];

        const hits: Hit[] = [];
        for (const c of CATEGORIES) {
            // match category name
            if (c.name.toLowerCase().includes(q)) {
                hits.push({ category: c.name, subcategory: "" });
            }
            // match subcats
            for (const s of c.subcategories) {
                if (s.toLowerCase().includes(q)) hits.push({ category: c.name, subcategory: s });
            }
        }

        // remove exact duplicate rows if any
        const seen = new Set<string>();
        const uniq: Hit[] = [];
        for (const h of hits) {
            const key = `${h.category}|${h.subcategory}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniq.push(h);
            }
        }

        return uniq.slice(0, 12);
    }, [input]);

    function pick(category: string, subcategory: string) {
        onPick(category, subcategory);
        setInput(formatLabel(category, subcategory)); // search bar shows selected
        setOpen(false); // hide results after selection
    }

    function clearSelection() {
        onPick("", "");
        setInput("");
        setOpen(false);
    }

    const showDropdown = open && input.trim().length > 0 && results.length > 0;

    return (
        <div className="catpicker">
            <label className="label">Category *</label>

            <div className="searchWrap">
                <input
                    className="input"
                    placeholder="Search category or subcategory (e.g., health, rent, coffee)"
                    value={input}
                    onFocus={() => setOpen(true)}
                    onBlur={() => {
                        // small delay to allow click selection to register before closing
                        window.setTimeout(() => setOpen(false), 120);
                    }}
                    onChange={(e) => {
                        const v = e.target.value;
                        setInput(v);
                        setOpen(true);

                        // If user deleted everything, treat it as clearing the selection
                        if (v.trim() === "") {
                            onPick("", "");
                        }
                    }}
                />

                {input.trim().length > 0 && (
                    <button type="button" className="clearBtn" onMouseDown={(e) => e.preventDefault()} onClick={clearSelection}>
                        ✕
                    </button>
                )}
            </div>

            {showDropdown && (
                <div className="dropdown">
                    <div className="list">
                        {results.map((r, idx) => (
                            <button
                                type="button"
                                className="row"
                                key={`${r.category}|${r.subcategory}|${idx}`}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => pick(r.category, r.subcategory)}
                            >
                                <div className="rowMain">{r.category}</div>
                                <div className="rowSub">{r.subcategory || "—"}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
