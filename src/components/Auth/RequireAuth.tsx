import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function RequireAuth({ children }: { children: ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [authed, setAuthed] = useState(false);

    useEffect(() => {
        // onAuthStateChange fires reliably after OAuth hash is processed,
        // so we use it as the single source of truth for initial load too.
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            setAuthed(!!session);
            setLoading(false);
        });

        // Kick off session check so onAuthStateChange fires immediately
        // for already-logged-in users (no redirect needed).
        supabase.auth.getSession();

        return () => {
            sub.subscription.unsubscribe();
        };
    }, []);

    if (loading) return null;
    if (!authed) return <Navigate to="/login" replace />;

    return <>{children}</>;
}
