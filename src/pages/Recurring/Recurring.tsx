import { useMemo, useState } from "react";
import "./Recurring.css";
import RecurringModal from "../../components/Recurring/RecurringModal/RecurringModal";
import type { RecurringFilters, RecurringItem } from "../../types/recurring";
import { monthlyEquivalent } from "../../lib/recurring";

import RecurringHeader from "../../components/Recurring/RecurringHeader/RecurringHeader";
import RecurringFiltersBar from "../../components/Recurring/RecurringFilters/RecurringFilters";
import RecurringTabs, { type RecTab } from "../../components/Recurring/RecurringTabs/RecurringTabs";
import UpcomingTimeline from "../../components/Recurring/UpcomingTimeline/UpcomingTimeline";
import RecurringAll from "../../components/Recurring/RecurringAll/RecurringAll";
import RecurringInsights from "../../components/Recurring/RecurringInsights/RecurringInsights";

import { useRecurringItems } from "../../lib/useRecurringItems";

export default function Recurring() {
    const [tab, setTab] = useState<RecTab>("upcoming");
    const [filters, setFilters] = useState<RecurringFilters>({
        q: "",
        status: "all",
        frequency: "all",
        paymentMethod: "all",
        category: "all",
        sort: "nextDue",
    });
    const [modalOpen, setModalOpen] = useState(false);
    const [editItem, setEditItem] = useState<RecurringItem | null>(null);
    const { recurring: allItems, loading, error, refetch } = useRecurringItems();

    const categories = useMemo(() => {
        const set = new Set<string>();
        allItems.forEach((i) => set.add(i.category));
        return [...set].sort();
    }, [allItems]);

    const filtered = useMemo(() => {
        const q = filters.q.trim().toLowerCase();

        let items = allItems.filter((i) => {
            if (filters.status !== "all" && i.status !== filters.status) return false;
            if (filters.frequency !== "all" && i.frequency !== filters.frequency) return false;
            if (filters.paymentMethod !== "all" && i.paymentMethod !== filters.paymentMethod) return false;
            if (filters.category !== "all" && i.category !== filters.category) return false;

            if (q) {
                const hay = `${i.name} ${i.merchant || ""} ${i.category} ${i.subcategory || ""}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });

        items = items.slice().sort((a, b) => {
            if (filters.sort === "nextDue") return a.nextDueDate.localeCompare(b.nextDueDate);
            if (filters.sort === "updated") return b.updatedAt - a.updatedAt;
            return monthlyEquivalent(b) - monthlyEquivalent(a);
        });

        return items;
    }, [allItems, filters]);

    const upcomingOnly = useMemo(() => {
        return filtered.filter((i) => i.status !== "cancelled");
    }, [filtered]);

    function onAdd() {
        setEditItem(null);
        setModalOpen(true);
    }

    function onEdit(item: RecurringItem) {
        setEditItem(item);
        setModalOpen(true);
    }

    return (
        <div className="recPage">
            <div className="pageHead">
                <h1 className="title">Recurring</h1>
                <p className="sub">Subscriptions, utilities, rent — track what’s about to hit you.</p>
            </div>

            <RecurringHeader items={allItems} />

            {loading && <div className="muted">Loading recurring items…</div>}
            {error && <div style={{ color: "var(--danger, #dc2626)", fontSize: 13 }}>{error}</div>}

            <RecurringFiltersBar
                filters={filters}
                categories={categories}
                onChange={setFilters}
                onAdd={onAdd}
            />

            <div className="tabsRow">
                <RecurringTabs tab={tab} onChange={setTab} />
            </div>

            <div className="recSections">
                {tab === "upcoming" ? <UpcomingTimeline items={upcomingOnly} onEdit={onEdit} /> : null}
                {tab === "all" ? <RecurringAll items={filtered} onEdit={onEdit} /> : null}
                {tab === "insights" ? <RecurringInsights items={filtered} /> : null}

                {tab === "rules" ? (
                    <div className="rulesCard">
                        <div className="rulesTitle">Rules / Automation</div>
                        <div className="rulesSub">
                            Designed now, implemented later:
                            <ul className="ul">
                                <li>Auto-add expense on due date</li>
                                <li>Reminders (7d / 3d / 1d)</li>
                                <li>Detect price changes</li>
                            </ul>
                        </div>
                    </div>
                ) : null}
            </div>

            <RecurringModal
                open={modalOpen}
                mode={editItem ? "edit" : "add"}
                initial={editItem}
                onClose={() => setModalOpen(false)}
                onAfterSave={async () => {
                    await refetch();
                }}
                onAfterDelete={async () => {
                    await refetch();
                }}
            />
        </div>
    );
}
