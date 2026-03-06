import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { PostgrestError, User } from "@supabase/supabase-js";
import "./Profile.css";
import { supabase } from "../../lib/supabase";

export default function Profile() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [ledgerlyId, setLedgerlyId] = useState<string | null>(null);
    const [aliasLoading, setAliasLoading] = useState(false);
    const [aliasError, setAliasError] = useState<string | null>(null);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [objectUrl, setObjectUrl] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        async function load() {
            try {
                setLoading(true);
                setError(null);
                const { data, error } = await supabase.auth.getUser();
                if (!active) return;
                if (error) throw error;
                setUser(data.user ?? null);
            } catch (err) {
                if (!active) return;
                const message = err instanceof Error ? err.message : "Unable to load profile.";
                setError(message);
            } finally {
                if (active) setLoading(false);
            }
        }

        load();

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!active) return;
            setUser(session?.user ?? null);
        });

        return () => {
            active = false;
            sub.subscription.unsubscribe();
        };
    }, []);

    const displayName =
        (user?.user_metadata?.full_name as string | undefined) ||
        (user?.user_metadata?.name as string | undefined) ||
        (user?.user_metadata?.display_name as string | undefined) ||
        (user?.user_metadata?.first_name || user?.user_metadata?.last_name
            ? `${(user?.user_metadata?.first_name as string | "") ?? ""} ${(user?.user_metadata?.last_name as string | "") ?? ""
                }`.trim()
            : undefined) ||
        user?.email ||
        "Your profile";

    const initials = getInitials(displayName);

    // Sync form fields when user loads or modal opens
    useEffect(() => {
        if (!user) {
            setFirstName("");
            setLastName("");
            setAvatarPreview(null);
            setAvatarFile(null);
            return;
        }

        const meta = user.user_metadata ?? {};
        const f =
            (meta.first_name as string | undefined) ||
            (meta.given_name as string | undefined) ||
            (meta.full_name as string | undefined)?.split(" ")?.[0] ||
            "";
        const l =
            (meta.last_name as string | undefined) ||
            (meta.family_name as string | undefined) ||
            (meta.full_name as string | undefined)?.split(" ")?.slice(1).join(" ") ||
            "";
        setFirstName(f);
        setLastName(l);
        setAvatarPreview((meta.avatar_url as string | undefined) || (meta.picture as string | undefined) || null);
        setAvatarFile(null);
    }, [user, modalOpen]);

    useEffect(() => {
        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [objectUrl]);

    useEffect(() => {
        let active = true;
        async function loadAlias(userId: string) {
            try {
                setAliasLoading(true);
                setAliasError(null);
                const { data, error } = await supabase
                    .from("user_aliases")
                    .select("ledgerly_id")
                    .eq("user_id", userId)
                    .maybeSingle();
                if (!active) return;
                if (error && error.code !== "PGRST116") throw error;
                setLedgerlyId(data?.ledgerly_id ?? null);
            } catch (err) {
                if (!active) return;
                const message = formatAliasError(err);
                setAliasError(message);
                setLedgerlyId(null);
            } finally {
                if (active) setAliasLoading(false);
            }
        }

        if (!user?.id) {
            setLedgerlyId(null);
            setAliasLoading(false);
            return undefined;
        }

        loadAlias(user.id);

        return () => {
            active = false;
        };
    }, [user?.id]);

    function openModal() {
        setSaveError(null);
        setSaveSuccess(null);
        setModalOpen(true);
    }

    function closeModal() {
        setModalOpen(false);
    }

    async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!user) return;
        setSaving(true);
        setSaveError(null);
        setSaveSuccess(null);

        try {
            let avatarUrl = avatarPreview;
            if (avatarFile) {
                avatarUrl = await uploadAvatar(avatarFile, user.id);
                setAvatarPreview(avatarUrl);
                setAvatarFile(null);
            }

            const first = firstName.trim();
            const last = lastName.trim();
            const full = [first, last].filter(Boolean).join(" ") || null;

            const metadata = {
                ...user.user_metadata,
                first_name: first || null,
                last_name: last || null,
                full_name: full,
                display_name: full,
                avatar_url: avatarUrl || null,
            };

            const { error: updateError } = await supabase.auth.updateUser({ data: metadata });
            if (updateError) throw updateError;

            const { data: refreshed, error: refreshError } = await supabase.auth.getUser();
            if (refreshError) throw refreshError;
            setUser(refreshed.user ?? null);
            setSaveSuccess("Profile updated!");
            setTimeout(() => setModalOpen(false), 900);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to update profile.";
            setSaveError(message);
        } finally {
            setSaving(false);
        }
    }

    function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
        setSaveError(null);
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            setSaveError("Please upload an image file.");
            return;
        }
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        const url = URL.createObjectURL(file);
        setObjectUrl(url);
        setAvatarFile(file);
        setAvatarPreview(url);
    }

    function handleRemovePhoto() {
        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            setObjectUrl(null);
        }
        setAvatarFile(null);
        setAvatarPreview(null);
    }

    return (
        <div className="profilePage">
            <div className="pageHead">
                <div>
                    <h1 className="title">Profile</h1>
                    <p className="sub">View the identity details tied to your Ledgerly account.</p>
                </div>
                {(loading || error || aliasError) && (
                    <div className="stateRow">
                        {loading && <span>Loading profile…</span>}
                        {error && <span className="error">{error}</span>}
                        {aliasError && <span className="error">{aliasError}</span>}
                    </div>
                )}
            </div>

            {!loading && !user && <div className="emptyCard">We couldn't find any profile data for this session.</div>}

            {user && (
                <div className="profileGrid">
                    {/* Hero card */}
                    <section className="card heroCard">
                        <div className={`avatar ${avatarPreview ? "withPhoto" : ""}`}>
                            {avatarPreview ? (
                                <img src={avatarPreview} alt="Profile avatar" />
                            ) : (
                                <span aria-hidden="true">{initials}</span>
                            )}
                        </div>

                        <div className="heroText">
                            <div className="displayName">{displayName}</div>
                            <div className="muted">{user.email ?? "No email on file"}</div>
                        </div>

                        <button className="editProfileBtn" onClick={openModal}>
                            <EditIcon />
                            Edit Profile
                        </button>
                    </section>

                    {/* Account details */}
                    <section className="card detailsCard">
                        <div className="cardTitle">Account details</div>

                        <div className="detailList">
                            <div className="detailRow">
                                <span className="detailLabel">Ledgerly ID</span>
                                <span className="detailValue">
                                    {aliasLoading ? "Generating…" : ledgerlyId ?? "—"}
                                </span>
                            </div>

                            <div className="detailRow">
                                <span className="detailLabel">Created</span>
                                <span className="detailValue">{formatDate(user.created_at)}</span>
                            </div>

                            <div className="detailRow">
                                <span className="detailLabel">Last sign in</span>
                                <span className="detailValue">{formatDate(user.last_sign_in_at)}</span>
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {/* ── Edit Profile Modal ── */}
            {modalOpen && (
                <div className="modalOverlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
                    <div className="modalCard" role="dialog" aria-modal="true" aria-label="Edit profile">
                        <div className="modalHeader">
                            <div className="modalTitle">Edit Profile</div>
                            <button className="modalClose" onClick={closeModal} aria-label="Close">✕</button>
                        </div>

                        <form className="profileForm" onSubmit={handleProfileSave}>
                            {/* Avatar */}
                            <div className="photoField">
                                <div className={`photoPreview ${avatarPreview ? "withPhoto" : ""}`}>
                                    {avatarPreview ? (
                                        <img src={avatarPreview} alt="Preview" />
                                    ) : (
                                        <span>{initials}</span>
                                    )}
                                </div>
                                <div className="photoActions">
                                    <label className="uploadBtn">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handlePhotoChange}
                                            disabled={saving}
                                        />
                                        Upload photo
                                    </label>
                                    <button
                                        type="button"
                                        className="ghostBtn"
                                        onClick={handleRemovePhoto}
                                        disabled={saving || (!avatarPreview && !avatarFile)}
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>

                            {/* Name fields */}
                            <div className="formGrid">
                                <label className="field">
                                    <span className="fieldLabel">First name</span>
                                    <input
                                        type="text"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        placeholder="e.g. Alex"
                                        maxLength={80}
                                        disabled={saving}
                                    />
                                </label>
                                <label className="field">
                                    <span className="fieldLabel">Last name</span>
                                    <input
                                        type="text"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        placeholder="e.g. Cruz"
                                        maxLength={80}
                                        disabled={saving}
                                    />
                                </label>
                            </div>

                            <div className="formActions">
                                {saveError && <span className="error" role="alert">{saveError}</span>}
                                {saveSuccess && !saveError && <span className="success" role="status">{saveSuccess}</span>}
                                <button className="ghostBtn" type="button" onClick={closeModal} disabled={saving}>
                                    Cancel
                                </button>
                                <button className="primaryBtn" type="submit" disabled={saving}>
                                    {saving ? "Saving…" : "Save changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function EditIcon() {
    return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width="15" height="15" aria-hidden="true">
            <path d="M13.5 3.5l3 3L7 16l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function getInitials(name: string) {
    const parts = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);
    if (parts.length === 0) return "U";
    return parts
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
        .slice(0, 2);
}

function formatDate(value?: string | null) {
    if (!value) return "—";
    try {
        return new Date(value).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
        });
    } catch {
        return value;
    }
}

function formatAliasError(err: unknown) {
    if (err && typeof err === "object" && "message" in err) {
        return (err as PostgrestError).message ?? "Unable to load Ledgerly ID.";
    }
    return "Unable to load Ledgerly ID.";
}

async function uploadAvatar(file: File, userId: string) {
    const bucket = "avatars";

    const { data: sess, error: sessErr } = await supabase.auth.getSession();
    if (sessErr) throw sessErr;
    const sessionUid = sess.session?.user?.id ?? null;
    if (!sessionUid) throw new Error("Not authenticated (no session) during upload.");
    if (sessionUid !== userId) throw new Error("Session user mismatch vs provided userId.");

    const ext =
        file.type === "image/png" ? "png" :
            file.type === "image/webp" ? "webp" :
                file.type === "image/gif" ? "gif" :
                    file.type === "image/jpeg" ? "jpg" :
                        (file.name.split(".").pop() || "jpg");

    const fileName = `avatar.${ext}`;
    const path = `${userId}/${fileName}`;
    const contentType = file.type || (ext === "png" ? "image/png" : "image/jpeg");

    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType,
    });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    await cleanupOldAvatarVariants(bucket, userId, fileName);

    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    if (!pub?.publicUrl) throw new Error("Unable to generate avatar URL.");
    return `${pub.publicUrl}?v=${Date.now()}`;
}

async function cleanupOldAvatarVariants(bucket: string, userId: string, keepFileName: string) {
    const { data: list, error: listError } = await supabase.storage.from(bucket).list(userId, { limit: 100 });
    if (listError || !list) return;

    const toRemove = list
        .map((o) => o.name)
        .filter((name) => name.startsWith("avatar.") && name !== keepFileName)
        .map((name) => `${userId}/${name}`);

    if (toRemove.length === 0) return;

    const { error: removeError } = await supabase.storage.from(bucket).remove(toRemove);
    if (removeError) {
        console.warn("[cleanupOldAvatarVariants] removeError:", removeError.message);
    }
}
