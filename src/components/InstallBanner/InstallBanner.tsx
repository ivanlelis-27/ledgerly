import { useEffect, useState } from "react";
import "./InstallBanner.css";

// Detect real mobile device (not just a narrow browser window)
function isMobileDevice(): boolean {
    const ua = navigator.userAgent;
    return /android|iphone|ipad|ipod|mobile/i.test(ua);
}

function isIos(): boolean {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
    return ("standalone" in window.navigator && (window.navigator as any).standalone === true)
        || window.matchMedia("(display-mode: standalone)").matches;
}

const DISMISSED_KEY = "ledgerly_install_dismissed";

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallBanner() {
    const [show, setShow] = useState(false);
    const [isIosDevice, setIsIosDevice] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        // Don't show if: not mobile, already installed, or user dismissed recently
        if (!isMobileDevice()) return;
        if (isInStandaloneMode()) return;
        if (sessionStorage.getItem(DISMISSED_KEY)) return;

        const ios = isIos();
        setIsIosDevice(ios);

        if (ios) {
            // iOS doesn't fire beforeinstallprompt — show manual instructions
            const timer = setTimeout(() => setShow(true), 1500);
            return () => clearTimeout(timer);
        }

        // Android/Chrome: wait for the browser's install prompt
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setShow(true);
        };

        window.addEventListener("beforeinstallprompt", handler);
        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    function dismiss() {
        sessionStorage.setItem(DISMISSED_KEY, "1");
        setShow(false);
    }

    async function handleInstall() {
        if (deferredPrompt) {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === "accepted") {
                setShow(false);
            }
            setDeferredPrompt(null);
        }
    }

    if (!show) return null;

    return (
        <div className="installOverlay" onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}>
            <div className="installCard" role="dialog" aria-modal="true" aria-label="Install Ledgerly">
                <button className="installClose" onClick={dismiss} aria-label="Close">✕</button>

                <div className="installHeader">
                    <div className="installAppIcon">
                        <LedgerlyIcon />
                    </div>
                    <div>
                        <p className="installTitle">Install Ledgerly</p>
                        <p className="installSub">Get the full app experience on your phone</p>
                    </div>
                </div>

                {isIosDevice ? (
                    <>
                        <div className="installSteps">
                            <div className="installStep">
                                <span className="installStepNum">1</span>
                                <span>Tap the <span className="installStepIcon">⬆️</span> <strong>Share</strong> button at the bottom of Safari</span>
                            </div>
                            <div className="installStep">
                                <span className="installStepNum">2</span>
                                <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
                            </div>
                            <div className="installStep">
                                <span className="installStepNum">3</span>
                                <span>Tap <strong>Add</strong> — Ledgerly will appear on your home screen</span>
                            </div>
                        </div>
                        <div className="installActions">
                            <button className="installBtn installBtnSecondary" onClick={dismiss}>
                                Maybe later
                            </button>
                            <button className="installBtn installBtnPrimary" onClick={dismiss}>
                                Got it!
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="installSteps">
                            <div className="installStep">
                                <span className="installStepNum">✓</span>
                                <span>Works offline — access your data anytime</span>
                            </div>
                            <div className="installStep">
                                <span className="installStepNum">✓</span>
                                <span>Faster — launches instantly like a native app</span>
                            </div>
                            <div className="installStep">
                                <span className="installStepNum">✓</span>
                                <span>No app store required</span>
                            </div>
                        </div>
                        <div className="installActions">
                            <button className="installBtn installBtnSecondary" onClick={dismiss}>
                                Not now
                            </button>
                            <button className="installBtn installBtnPrimary" onClick={handleInstall}>
                                Install app
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function LedgerlyIcon() {
    return (
        <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect x="4" y="7" width="20" height="14" rx="3" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
            <line x1="4" y1="11" x2="24" y2="11" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
            <circle cx="8" cy="15.5" r="1.5" fill="white" />
            <circle cx="14" cy="15.5" r="1.5" fill="rgba(255,255,255,0.6)" />
            <circle cx="20" cy="15.5" r="1.5" fill="rgba(255,255,255,0.3)" />
        </svg>
    );
}
