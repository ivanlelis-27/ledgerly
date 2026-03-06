import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUp, signInWithGoogle } from "../../lib/auth";
import "./Register.css";

export default function Register() {
    const nav = useNavigate();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [agree, setAgree] = useState(true);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [googleError, setGoogleError] = useState("");

    async function handleGoogleSignup() {
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

        if (password !== confirm) {
            alert("Passwords do not match.");
            return;
        }

        const { error } = await signUp(email, password, name);

        if (error) {
            alert(error.message);
            return;
        }

        nav("/login");
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
                        <h1 className="title">Get Started Now</h1>
                        <p className="sub">Track expenses, recurring bills, and build clarity — fast.</p>
                    </div>

                    <div className="socialRow">
                        <button
                            type="button"
                            className="socialBtn"
                            onClick={handleGoogleSignup}
                            disabled={googleLoading}
                        >
                            <GoogleIcon />
                            {googleLoading ? "Redirecting…" : "Sign up with Google"}
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
                            <label>Name</label>
                            <input
                                className="input"
                                placeholder="Ivan"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoComplete="name"
                                required
                            />
                        </div>

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
                            <input
                                type="password"
                                className="input"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="new-password"
                                required
                            />
                        </div>

                        <div className="field">
                            <label>Confirm password</label>
                            <input
                                type="password"
                                className="input"
                                placeholder="••••••••"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                autoComplete="new-password"
                                required
                            />
                        </div>

                        <label className="agree">
                            <input
                                type="checkbox"
                                checked={agree}
                                onChange={(e) => setAgree(e.target.checked)}
                            />
                            <span>
                                I agree to the{" "}
                                <button
                                    type="button"
                                    className="inlineLink"
                                    onClick={() => alert("Terms later")}
                                >
                                    Terms
                                </button>{" "}
                                &{" "}
                                <button
                                    type="button"
                                    className="inlineLink"
                                    onClick={() => alert("Privacy later")}
                                >
                                    Privacy
                                </button>
                            </span>
                        </label>

                        <button className="primaryBtn" type="submit">
                            Sign Up
                        </button>
                    </form>

                    <div className="foot">
                        <span>Already have an account?</span>{" "}
                        <Link className="link" to="/login">
                            Sign In
                        </Link>
                    </div>
                </div>

                {/* RIGHT */}
                <div className="authRight" aria-label="Hero panel">
                    <div className="heroMedia" aria-hidden="true">
                        <img className="heroImg" src="/hero.png" alt="" />
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
