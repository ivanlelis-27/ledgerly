import { useCallback, useEffect, useRef, useState } from "react";

const THRESHOLD = 80; // px pulled before releasing triggers refresh
const MAX_PULL = 120; // max visual travel in px
const RESISTANCE = 0.4; // how hard it is to pull (lower = harder)

export type PullPhase = "idle" | "pulling" | "ready" | "refreshing";

interface UsePullToRefreshOptions {
    onRefresh: () => Promise<void>;
    /** Element that must be scrolled to top before pull activates (default: window) */
    scrollRef?: React.RefObject<HTMLElement | null>;
}

export function usePullToRefresh(
    { onRefresh, scrollRef }: UsePullToRefreshOptions,
) {
    const [phase, setPhase] = useState<PullPhase>("idle");
    const [pullY, setPullY] = useState(0);

    const startY = useRef(0);
    const active = useRef(false);
    const refreshing = useRef(false);

    const isAtTop = useCallback(() => {
        const el = scrollRef?.current;
        return el ? el.scrollTop <= 0 : window.scrollY <= 0;
    }, [scrollRef]);

    useEffect(() => {
        function onTouchStart(e: TouchEvent) {
            if (!isAtTop()) return;
            startY.current = e.touches[0].clientY;
            active.current = true;
        }

        function onTouchMove(e: TouchEvent) {
            if (!active.current || refreshing.current) return;
            const dy = e.touches[0].clientY - startY.current;
            if (dy <= 0) {
                active.current = false;
                return;
            }

            // Prevent default scroll so the pull doesn't also scroll the page
            if (isAtTop() && dy > 5) e.preventDefault();

            const clamped = Math.min(dy * RESISTANCE, MAX_PULL);
            setPullY(clamped);
            setPhase(clamped >= THRESHOLD ? "ready" : "pulling");
        }

        function onTouchEnd() {
            if (!active.current) return;
            active.current = false;

            if (refreshing.current) return;

            setPhase((prev) => {
                if (prev === "ready") {
                    // Trigger refresh
                    refreshing.current = true;
                    setPullY(48); // settle at spinner height
                    setPhase("refreshing");

                    onRefresh().finally(() => {
                        refreshing.current = false;
                        setPhase("idle");
                        setPullY(0);
                    });
                    return "refreshing";
                }
                // Didn't reach threshold — snap back
                setPullY(0);
                return "idle";
            });
        }

        // Attach to the document so it works even with overflow-hidden containers
        document.addEventListener("touchstart", onTouchStart, {
            passive: true,
        });
        document.addEventListener("touchmove", onTouchMove, { passive: false });
        document.addEventListener("touchend", onTouchEnd, { passive: true });

        return () => {
            document.removeEventListener("touchstart", onTouchStart);
            document.removeEventListener("touchmove", onTouchMove);
            document.removeEventListener("touchend", onTouchEnd);
        };
    }, [isAtTop, onRefresh]);

    return { phase, pullY };
}
