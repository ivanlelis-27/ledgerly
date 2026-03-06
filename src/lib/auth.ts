import { supabase } from "./supabase";

export async function signUp(email: string, password: string, name?: string) {
    return supabase.auth.signUp({
        email,
        password,
        options: {
            data: name ? { name } : undefined,
        },
    });
}

export async function signIn(email: string, password: string) {
    return supabase.auth.signInWithPassword({ email, password });
}

export async function signInWithGoogle() {
    return supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: `${window.location.origin}/dashboard`,
        },
    });
}

export async function signOut() {
    return supabase.auth.signOut();
}

export async function getSession() {
    return supabase.auth.getSession();
}
