import { useCallback, useEffect, useRef, useState } from "react";

const THRESHOLD = 80; // px pulled before releasing triggers refresh
const MAX_PULL = 120; // max visual travel in px
const RESISTANCE = 0.4; // how hard it is to pull (lower = harder)

export type PullPhase = "idle" | "pulling" | "ready" | "refreshing";

interface UsePullToRefreshOptions {
    onRefresh: () => Promise<void>;
    /**
     * The scrollable content element. REQUIRED — the hook checks this
     * element's scrollTop to know when the user is at the top. Without
     * this, the hook falls back to window.scrollY which is always 0 in a
     * fixed-layout app, causing preventDefault() to fire on every touch
     * and block scroll everywhere.
     */
    scrollRef: React.RefObject<HTMLElement | null>;
}

export function usePullToRefresh(
    { onRefresh, scrollRef }: UsePullToRefreshOptions,
) {
    const [phase, setPhase] = useState<PullPhase>("idle");
    const [pullY, setPullY] = useState(0);

    const startY = useRef(0);
    const active = useRef(false);
    const refreshing = useRef(false);

    /** Returns true only when the scroll container is truly at the top */
    const isAtTop = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return false;
        return el.scrollTop <= 0;
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

            // User reversed direction — let the browser scroll normally
            if (dy <= 0) {
                active.current = false;
                return;
            }

            // Only block default if we're still at the top AND pulling down.
            // Re-check scrollTop on every move — if the element has scrolled
            // even 1 px, the browser should handle the scroll, not us.
            if (!isAtTop()) {
                active.current = false;
                return;
            }

            if (dy > 5) {
                // Safe to prevent default — we're at the top, going down
                e.preventDefault();
                const clamped = Math.min(dy * RESISTANCE, MAX_PULL);
                setPullY(clamped);
                setPhase(clamped >= THRESHOLD ? "ready" : "pulling");
            }
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

        const el = scrollRef.current;
        if (!el) return;

        // Attach to the scroll container element, NOT document.
        // This ensures the listener only fires when the user is touching
        // the content area, not every element on the page.
        el.addEventListener("touchstart", onTouchStart, { passive: true });
        el.addEventListener("touchmove", onTouchMove, { passive: false });
        el.addEventListener("touchend", onTouchEnd, { passive: true });

        return () => {
            el.removeEventListener("touchstart", onTouchStart);
            el.removeEventListener("touchmove", onTouchMove);
            el.removeEventListener("touchend", onTouchEnd);
        };
    }, [isAtTop, onRefresh, scrollRef]);

    return { phase, pullY };
}
