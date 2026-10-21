"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Lock, User, Eye, EyeOff, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GoogleIcon } from "@/components/auth/SocialIcons";
import { createBrowserSupabase } from "@/lib/auth/browser";

export function SignupForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifySent, setVerifySent] = useState(false);

  const pwChecks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    number: /\d/.test(password),
  };
  const pwOk = pwChecks.length && pwChecks.upper && pwChecks.number;

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    if (loading || !pwOk) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createBrowserSupabase();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/`,
        },
      });
      if (signUpError) throw signUpError;
      // If Supabase is configured with auto-confirm ON (dev), the user
      // is signed in immediately. Otherwise we send them to a
      // "check your email" state.
      if (data.session) {
        window.location.href = "/";
        return;
      }
      setVerifySent(true);
      setLoading(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign-up failed";
      setError(msg);
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (googleLoading) return;
    setGoogleLoading(true);
    try {
      const supabase = createBrowserSupabase();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?next=/`,
        },
      });
      if (oauthError) throw oauthError;
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "Google sign-in failed") +
        " — make sure the Google provider is enabled in your Supabase dashboard."
      );
      setGoogleLoading(false);
    }
  }

  if (verifySent) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10">
          <Mail className="h-7 w-7 text-accent-bright" />
        </div>
        <h2 className="font-display text-lg font-semibold text-cream">
          Check your email
        </h2>
        <p className="text-sm text-text-secondary">
          We sent a confirmation link to{" "}
          <span className="text-cream">{email}</span>. Click it to finish
          creating your account, then sign in.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm text-accent-bright hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={handleGoogle}
        disabled={googleLoading}
      >
        {googleLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        Continue with Google
      </Button>

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-text-muted">
        <div className="h-px flex-1 bg-border" />
        <span>or sign up with email</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      <form onSubmit={handleEmailSignup} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            Full Name
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-lg border border-border bg-surface/60 py-2.5 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full rounded-lg border border-border bg-surface/60 py-2.5 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 chars, 1 upper, 1 number"
              autoComplete="new-password"
              className="w-full rounded-lg border border-border bg-surface/60 py-2.5 pl-10 pr-10 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-cream"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {/* Password strength indicators — show in real time */}
          <div className="mt-1.5 flex items-center gap-3 text-[10px] text-text-muted">
            <PwCheck ok={pwChecks.length} label="8+ chars" />
            <PwCheck ok={pwChecks.upper} label="1 upper" />
            <PwCheck ok={pwChecks.number} label="1 number" />
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={loading || !pwOk}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Creating account…
            </>
          ) : (
            "Create Account"
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent-bright hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

function PwCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Check
        className={
          ok ? "h-3 w-3 text-green-400" : "h-3 w-3 text-text-muted/40"
        }
      />
      <span className={ok ? "text-green-400" : "text-text-muted/60"}>
        {label}
      </span>
    </span>
  );
}
