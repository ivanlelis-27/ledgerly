import "./RecurringTabs.css";

export type RecTab = "upcoming" | "all" | "insights" | "rules";

const TAB_INFO: Array<{ id: RecTab; icon: string; label: string; sublabel: string }> = [
    { id: "upcoming", icon: "📋", label: "Upcoming", sublabel: "due soon" },
    { id: "all",      icon: "📂", label: "All",      sublabel: "full list" },
    { id: "insights", icon: "📊", label: "Insights", sublabel: "trends" },
    { id: "rules",    icon: "⚙️",  label: "Settings", sublabel: "automation" },
];

type Props = { tab: RecTab; onChange: (t: RecTab) => void };

export default function RecurringTabs({ tab, onChange }: Props) {
    return (
        <div className="rTabs" role="tablist">
            {TAB_INFO.map(({ id, icon, label, sublabel }) => (
                <button
                    key={id}
                    role="tab"
                    aria-selected={tab === id}
                    className={`rTab ${tab === id ? "rTabOn" : ""}`}
                    onClick={() => onChange(id)}
                >
                    <span className="rTabIcon">{icon}</span>
                    <span className="rTabText">
                        <span className="rTabLabel">{label}</span>
                        <span className="rTabSub">{sublabel}</span>
                    </span>
                </button>
            ))}
        </div>
    );
}
