import { useState } from "react";
import { signIn, signInWithGoogle } from "../../lib/auth";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";

export default function Login() {
    const nav = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [googleLoading, setGoogleLoading] = useState(false);
    const [googleError, setGoogleError] = useState("");

    async function handleGoogleLogin() {
        setGoogleLoading(true);
        setGoogleError("");
        const { error } = await signInWithGoogle();
        if (error) {
            setGoogleError(error.message);
            setGoogleLoading(false);
        }
        // On success, Supabase redirects to /dashboard automatically
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();

        const { error } = await signIn(email, password);

        if (error) {
            alert(error.message);
            return;
        }

        nav("/dashboard");
    }

    return (
        <div className="authShell">
            <div className="authFrame">
                {/* LEFT */}
                <div className="authLeft">
                    <div className="brandRow">
                        <div className="brandMark" aria-hidden="true">
                            <span className="markDot" />
                            <span className="markDot" />
                            <span className="markDot" />
                        </div>
                        <div className="brandName">Ledgerly</div>
                    </div>

                    <div className="head">
                        <h1 className="title">Welcome back</h1>
                        <p className="sub">Log in to continue using Ledgerly.</p>
                    </div>

                    <div className="socialRow">
                        <button
                            type="button"
                            className="socialBtn"
                            onClick={handleGoogleLogin}
                            disabled={googleLoading}
                        >
                            <GoogleIcon />
                            {googleLoading ? "Redirecting…" : "Continue with Google"}
                        </button>
                    </div>
                    {googleError && <p className="socialError">{googleError}</p>}

                    <div className="divider">
                        <span className="line" />
                        <span className="or">or</span>
                        <span className="line" />
                    </div>

                    <form className="form" onSubmit={onSubmit}>
                        <div className="field">
                            <label>Email</label>
                            <input
                                type="email"
                                className="input"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                                required
                            />
                        </div>

                        <div className="field">
                            <label>Password</label>
                            <div className="pwRow">
                                <input
                                    type="password"
                                    className="input"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    required
                                />
                            </div>
                        </div>

                        <div className="belowRow">
                            <button
                                className="inlineLink"
                                type="button"
                                onClick={() => alert("Password reset flow later.")}
                            >
                                Forgot password?
                            </button>
                        </div>

                        <button className="primaryBtn" type="submit">
                            Log in
                        </button>
                    </form>

                    <div className="foot">
                        <span>New here?</span>{" "}
                        <Link className="link" to="/register">
                            Create an account
                        </Link>
                    </div>
                </div>

                {/* RIGHT */}
                <div className="authRight" aria-label="Hero panel">
                    <div className="heroMedia" aria-hidden="true">
                        <img className="heroImg" src="/hero2.png" alt="" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function GoogleIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    );
}
