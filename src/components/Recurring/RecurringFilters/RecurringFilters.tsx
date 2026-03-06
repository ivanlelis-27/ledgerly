import type { RecurringFilters, RecurringFrequency } from "../../../types/recurring";
import "./RecurringFilters.css";

type Props = {
    filters: RecurringFilters;
    categories: string[];
    onChange: (next: RecurringFilters) => void;
    onAdd: () => void;
};

const STATUS_OPTIONS = [
    { value: "all",       label: "All" },
    { value: "active",    label: "✅ Active" },
    { value: "trial",     label: "🆓 Trial" },
    { value: "paused",    label: "⏸ Paused" },
    { value: "cancelled", label: "❌ Cancelled" },
] as const;

export default function RecurringFilters({ filters, categories, onChange, onAdd }: Props) {
    const hasActiveFilters =
        filters.status !== "all" ||
        filters.frequency !== "all" ||
        filters.paymentMethod !== "all" ||
        filters.category !== "all";

    return (
        <div className="recFilters">
            {/* Row 1: Search + Add */}
            <div className="rfTop">
                <div className="rfSearchWrap">
                    <span className="rfSearchIcon">🔍</span>
                    <input
                        className="rfSearch"
                        placeholder="Search by name, category…"
                        value={filters.q}
                        onChange={(e) => onChange({ ...filters, q: e.target.value })}
                    />
                    {filters.q && (
                        <button className="rfClear" onClick={() => onChange({ ...filters, q: "" })} aria-label="Clear search">
                            ✕
                        </button>
                    )}
                </div>
                <button className="rfAddBtn" onClick={onAdd}>
                    <span>＋</span> Add new
                </button>
            </div>

            {/* Row 2: Status pills — wrap naturally */}
            <div className="rfPills">
                {STATUS_OPTIONS.map(({ value, label }) => (
                    <button
                        key={value}
                        className={`rfPill ${filters.status === value ? "rfPillOn" : ""}`}
                        onClick={() => onChange({ ...filters, status: value as any })}
                    >
                        {label}
                    </button>
                ))}
                {hasActiveFilters && (
                    <button
                        className="rfPill rfPillClear"
                        onClick={() => onChange({ ...filters, status: "all", frequency: "all", paymentMethod: "all", category: "all" })}
                    >
                        Clear ✕
                    </button>
                )}
            </div>

            {/* Row 3: Selects — frequency, category, sort */}
            <div className="rfSelects">
                <select
                    className="rfSelect"
                    value={filters.frequency}
                    onChange={(e) => onChange({ ...filters, frequency: e.target.value as RecurringFrequency | "all" })}
                >
                    <option value="all">Any frequency</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                    <option value="custom">Custom</option>
                </select>

                {categories.length > 0 && (
                    <select
                        className="rfSelect"
                        value={filters.category}
                        onChange={(e) => onChange({ ...filters, category: e.target.value })}
                    >
                        <option value="all">All categories</option>
                        {categories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                )}

                <select
                    className="rfSelect"
                    value={filters.sort}
                    onChange={(e) => onChange({ ...filters, sort: e.target.value as RecurringFilters["sort"] })}
                >
                    <option value="nextDue">Soonest first</option>
                    <option value="monthlyEq">Most expensive</option>
                    <option value="updated">Recently updated</option>
                </select>
            </div>
        </div>
    );
}
