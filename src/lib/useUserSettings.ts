import { useCallback, useEffect, useState, useRef } from "react";
import type { UserSettings } from "../types/settings";
import { DEFAULT_SETTINGS } from "../types/settings";
import { fetchUserSettings, upsertUserSettings } from "./data";
import { supabase } from "./supabase";

type UseUserSettingsResult = {
    settings: UserSettings;
    loading: boolean;
    saving: boolean;
    error: string | null;
    update: (patch: Partial<UserSettings>) => Promise<void>;
};

export function useUserSettings(): UseUserSettingsResult {
    const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null | undefined>(undefined);

    // Debounce timer ref — batch rapid changes into one upsert
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Resolve userId from auth session
    useEffect(() => {
        let mounted = true;
        supabase.auth.getSession().then(({ data }) => {
            if (mounted) setUserId(data.session?.user?.id ?? null);
        });
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!mounted) return;
            setUserId(session?.user?.id ?? null);
        });
        return () => {
            mounted = false;
            sub.subscription.unsubscribe();
        };
    }, []);

    // Load settings from Supabase when userId is resolved
    const load = useCallback(async () => {
        if (userId === undefined) return;
        if (userId === null) {
            setSettings(DEFAULT_SETTINGS);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const data = await fetchUserSettings(userId);
            setSettings(data);
            setError(null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load settings");
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        if (userId !== undefined) void load();
    }, [userId, load]);

    // update: merges patch into state immediately (optimistic) then debounces upsert
    const update = useCallback(
        async (patch: Partial<UserSettings>) => {
            setSettings(prev => {
                const next = { ...prev, ...patch, updatedAt: Date.now() };

                // Clear any pending debounce and schedule a new upsert
                if (debounceRef.current) clearTimeout(debounceRef.current);
                debounceRef.current = setTimeout(async () => {
                    setSaving(true);
                    try {
                        await upsertUserSettings(next, userId ?? undefined);
                        setError(null);
                    } catch (err: unknown) {
                        setError(err instanceof Error ? err.message : "Failed to save settings");
                    } finally {
                        setSaving(false);
                    }
                }, 600);

                return next;
            });
        },
        [userId]
    );

    return { settings, loading, saving, error, update };
}
