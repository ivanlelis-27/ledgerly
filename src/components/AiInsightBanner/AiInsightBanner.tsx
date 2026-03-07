import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import type { AiInsight, AiInsightState, InsightType } from "../../lib/useAiInsights";
import "./AiInsightBanner.css";

type Props = AiInsightState;

const TYPE_META: Record<InsightType, { icon: string; label: string }> = {
    warning:  { icon: "⚠️", label: "Watch out" },
    tip:      { icon: "💡", label: "Tip" },
    positive: { icon: "✅", label: "Looking good" },
    info:     { icon: "ℹ️", label: "Info" },
};

function timeAgo(ts: number | null): string {
    if (!ts) return "";
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

export default function AiInsightBanner({ insights, loading, error, generatedAt, refresh }: Props) {
    const [active, setActive] = useState(0);
    const [animKey, setAnimKey] = useState(0);
    const [timeLabel, setTimeLabel] = useState(() => timeAgo(generatedAt));

    // Reset active index when insights change
    useEffect(() => {
        setActive(0);
        setAnimKey(k => k + 1);
    }, [insights]);

    // Keep "X minutes ago" label live
    useEffect(() => {
        setTimeLabel(timeAgo(generatedAt));
        const id = setInterval(() => setTimeLabel(timeAgo(generatedAt)), 30_000);
        return () => clearInterval(id);
    }, [generatedAt]);

    // Auto-rotate every 6s when there are multiple insights
    useEffect(() => {
        if (insights.length <= 1) return;
        const id = setInterval(() => {
            setActive(prev => (prev + 1) % insights.length);
            setAnimKey(k => k + 1);
        }, 6000);
        return () => clearInterval(id);
    }, [insights.length]);

    const go = useCallback((idx: number) => {
        setActive(idx);
        setAnimKey(k => k + 1);
    }, []);

    // ── Loading skeleton ──
    if (loading) {
        return (
            <div className="aib aib--loading" aria-busy="true" aria-label="Loading Atlas insights">
                <div className="aib__inner aib__skeleton">
                    <div className="aib__skel-badge" />
                    <div className="aib__skel-title" />
                    <div className="aib__skel-body" />
                    <div className="aib__skel-body aib__skel-body--short" />
                </div>
            </div>
        );
    }

    // ── Error state ──
    if (error) {
        return (
            <div className="aib aib--info" role="alert">
                <div className="aib__inner">
                    <div className="aib__head">
                        <div className="aib__badge">
                            <span className="aib__badge-icon">ℹ️</span>
                            <span className="aib__badge-label">Atlas Insight</span>
                        </div>
                        <button className="aib__refresh" onClick={refresh} title="Try again">↺ Retry</button>
                    </div>
                    <div className="aib__content">
                        <div className="aib__title">Couldn't load Atlas insights</div>
                        <div className="aib__body">{error}</div>
                    </div>
                </div>
            </div>
        );
    }

    if (!insights.length) return null;

    const insight: AiInsight = insights[active];
    const meta = TYPE_META[insight.type];

    return (
        <div className={`aib aib--${insight.type}`} role="status" aria-live="polite">
            {/* Faint sparkle decoration */}
            <div className="aib__sparkle" aria-hidden="true">✨</div>

            <div className="aib__inner" key={animKey}>
                {/* Header row */}
                <div className="aib__head">
                    <div className="aib__badge">
                        <span className="aib__badge-icon">{meta.icon}</span>
                        <span className="aib__badge-label">Atlas Insight · {meta.label}</span>
                    </div>

                    <div className="aib__headRight">
                        {timeLabel && (
                            <span className="aib__ts" title="When insights were last generated">
                                {timeLabel}
                            </span>
                        )}
                        <button
                            className="aib__refresh"
                            onClick={refresh}
                            disabled={loading}
                            title="Refresh insights"
                            aria-label="Refresh Atlas insights"
                        >
                            ↺
                        </button>

                        {insights.length > 1 && (
                            <div className="aib__dots" aria-label="Insight navigation">
                                {insights.map((ins, i) => (
                                    <button
                                        key={ins.id}
                                        className={`aib__dot${i === active ? " aib__dot--on" : ""}`}
                                        onClick={() => go(i)}
                                        aria-label={`Show insight ${i + 1}`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="aib__content">
                    <div className="aib__title">{insight.title}</div>
                    <div className="aib__body">{insight.body}</div>
                </div>

                {insight.actionLabel && insight.actionHref && (
                    <Link className="aib__action" to={insight.actionHref}>
                        {insight.actionLabel}
                    </Link>
                )}
            </div>
        </div>
    );
}
