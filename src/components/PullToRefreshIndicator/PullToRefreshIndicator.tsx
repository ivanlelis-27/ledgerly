import type { PullPhase } from "../../lib/usePullToRefresh";
import "./PullToRefreshIndicator.css";

interface Props {
    pullY: number;
    phase: PullPhase;
}

const THRESHOLD = 80;

export default function PullToRefreshIndicator({ pullY, phase }: Props) {
    if (phase === "idle" && pullY === 0) return null;

    const progress = Math.min(pullY / THRESHOLD, 1); // 0 → 1
    const angle    = progress * 270;                 // arc degrees
    const isReady  = phase === "ready" || phase === "refreshing";

    return (
        <div
            className="ptrWrap"
            style={{ height: pullY, opacity: Math.min(pullY / 40, 1) }}
        >
            <div className={`ptrCircle ${isReady ? "ptrCircleReady" : ""} ${phase === "refreshing" ? "ptrSpinning" : ""}`}>
                {phase === "refreshing" ? (
                    /* Spinning arc while loading */
                    <svg viewBox="0 0 36 36" className="ptrSvg">
                        <circle
                            className="ptrTrack"
                            cx="18" cy="18" r="15"
                            strokeDasharray="94.2"
                            strokeDashoffset="0"
                        />
                        <circle
                            className="ptrArc ptrArcSpin"
                            cx="18" cy="18" r="15"
                            strokeDasharray="94.2"
                            strokeDashoffset="70"
                        />
                    </svg>
                ) : (
                    /* Progress arc while pulling */
                    <svg viewBox="0 0 36 36" className="ptrSvg" style={{ transform: "rotate(-135deg)" }}>
                        <circle
                            className="ptrTrack"
                            cx="18" cy="18" r="15"
                            strokeDasharray="94.2"
                            strokeDashoffset="0"
                        />
                        <circle
                            className="ptrArc"
                            cx="18" cy="18" r="15"
                            strokeDasharray="94.2"
                            strokeDashoffset={94.2 - (94.2 * angle) / 360}
                            style={{ transition: "stroke-dashoffset 0.05s linear" }}
                        />
                    </svg>
                )}

                {/* Arrow icon inside the circle */}
                {phase !== "refreshing" && (
                    <div
                        className="ptrArrow"
                        style={{ transform: `rotate(${isReady ? 180 : 0}deg)` }}
                    >
                        ↓
                    </div>
                )}
            </div>

            <div className="ptrLabel">
                {phase === "refreshing" ? "Refreshing…" : phase === "ready" ? "Release to refresh" : "Pull to refresh"}
            </div>
        </div>
    );
}
