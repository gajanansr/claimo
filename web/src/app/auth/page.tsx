"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CarFront, Mail, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

type View = "sign_in" | "magic_link_sent";

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <AuthContent />
    </Suspense>
  );
}

function AuthContent() {
  const router = useRouter();
  const params      = useSearchParams();
  const supabase    = createClient();

  const [view,          setView]      = useState<View>("sign_in");
  const [email,         setEmail]     = useState("");
  const [loadingGoogle, setGoogle]    = useState(false);
  const [loadingEmail,  setEmailLoad] = useState(false);
  const [error,         setError]     = useState<string | null>(null);
  const [notice,        setNotice]    = useState<string | null>(null);

  // Pick up ?error= from OAuth callback failures and ?reason= notices
  useEffect(() => {
    const e = params.get("error");
    if (e) {
      setTimeout(() => setError("Sign-in failed. Please try again."), 0);
    }
    const reason = params.get("reason");
    if (reason === "gmail_expired") {
      setTimeout(() => setNotice("Your Gmail connection expired. Sign in with Google again to keep syncing."), 0);
    }
  }, [params]);

  // ── Google OAuth ──────────────────────────────────────────
  const handleGoogle = async () => {
    setGoogle(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "https://www.googleapis.com/auth/gmail.readonly",
      },
    });
    if (error) {
      setError(error.message);
      setGoogle(false);
    }
    // On success browser redirects — no need to setGoogle(false)
  };

  // ── Magic link (email) ────────────────────────────────────
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setEmailLoad(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setEmailLoad(false);
    if (error) {
      setError(error.message);
    } else {
      setView("magic_link_sent");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-black px-4 py-12 font-sans antialiased">
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 35% at 50% 0%, rgba(16,185,129,0.06) 0%, transparent 70%)" }}
      />

      <div className="w-full max-w-sm space-y-6 z-10 animate-fade-in-up">

        {/* Wordmark */}
        <div className="text-center">
          <div className="mx-auto h-11 w-11 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-center mb-5">
            <CarFront className="text-zinc-200 h-5 w-5" />
          </div>
          <h1 className="text-[28px] font-bold text-zinc-100 tracking-tight leading-none">
            claimo<span className="text-emerald-500">.</span>
          </h1>
          <p className="mt-2 text-[13px] text-zinc-500">Automate your ride expense reimbursements</p>
        </div>

        {view === "magic_link_sent" ? (
          /* ── Magic link sent confirmation ─────────────────── */
          <Card className="bg-zinc-950 border-zinc-900 rounded-xl shadow-xl">
            <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-950/40 border border-emerald-900/60 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
              <h2 className="text-[15px] font-semibold text-zinc-100">Check your email</h2>
              <p className="text-[13px] text-zinc-500 leading-relaxed max-w-[18rem]">
                We sent a magic link to <span className="text-zinc-300 font-medium">{email}</span>. Click it to sign in.
              </p>
              <button
                onClick={() => { setView("sign_in"); setEmail(""); }}
                className="mt-2 text-[12px] text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Use a different email
              </button>
            </CardContent>
          </Card>
        ) : (
          /* ── Sign in card ──────────────────────────────────── */
          <Card className="bg-zinc-950 border-zinc-900 rounded-xl shadow-xl">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-[17px] font-bold text-zinc-100 text-center">Welcome back</CardTitle>
              <CardDescription className="text-center text-zinc-500 text-[13px]">
                Sign in to sync your ride receipts automatically.
              </CardDescription>
              <div className="flex items-start gap-2 bg-amber-950/20 border border-amber-900/40 text-amber-300/90 text-[11.5px] px-3 py-2.5 rounded-lg mt-3 leading-relaxed">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 mt-0.5 text-amber-400">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                </svg>
                <span>
                  <strong className="text-amber-200">Important:</strong> Sign in with the same email registered with your <strong>Uber</strong> or <strong>Rapido</strong> account. Claimo scans that inbox for ride receipts.
                </span>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-0">
              {/* Error banner */}
              {error && (
                <div className="flex items-center gap-2 bg-red-950/30 border border-red-900/50 text-red-400 text-[12px] px-3 py-2 rounded-lg">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {error}
                </div>
              )}

              {/* Notice banner (e.g. Gmail token expired) */}
              {notice && !error && (
                <div className="flex items-center gap-2 bg-amber-950/20 border border-amber-900/40 text-amber-300/90 text-[12px] px-3 py-2 rounded-lg">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  {notice}
                </div>
              )}

              {/* Google */}
              <Button
                id="google-signin-btn"
                onClick={handleGoogle}
                disabled={loadingGoogle || loadingEmail}
                className="w-full bg-white hover:bg-zinc-100 disabled:bg-zinc-800 text-zinc-950 disabled:text-zinc-500 font-semibold py-5 rounded-lg flex items-center justify-center gap-2.5 transition-all shadow-sm text-[13px]"
              >
                {loadingGoogle ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
                    <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z" fill="#EA4335"/>
                    <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4"/>
                    <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05"/>
                    <path d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26537 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z" fill="#34A853"/>
                  </svg>
                )}
                {loadingGoogle ? "Redirecting…" : "Continue with Google"}
              </Button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-900" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-2 bg-zinc-950 text-zinc-600 text-[11px]">or</span>
                </div>
              </div>

              {/* Magic link */}
              <form onSubmit={handleMagicLink} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loadingEmail || loadingGoogle}
                    required
                    className="bg-zinc-900 border-zinc-800 text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-0 rounded-lg h-10 text-[13px]"
                  />
                </div>
                <Button
                  id="email-signin-btn"
                  type="submit"
                  disabled={loadingEmail || loadingGoogle || !email}
                  variant="outline"
                  className="w-full border-zinc-800 bg-transparent hover:bg-zinc-900 hover:text-zinc-100 text-zinc-300 disabled:text-zinc-600 py-5 rounded-lg flex items-center justify-center gap-2 transition-all text-[13px]"
                >
                  {loadingEmail ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Mail className="h-3.5 w-3.5 text-zinc-500" />
                  )}
                  {loadingEmail ? "Sending link…" : "Send magic link"}
                </Button>
              </form>
            </CardContent>

            <CardFooter className="border-t border-zinc-900/60 pt-4 pb-4 flex justify-center">
              <p className="text-[10px] text-zinc-600 text-center leading-relaxed max-w-[18rem]">
                By signing in you agree to our{" "}
                <a href="#" className="text-zinc-500 hover:text-zinc-300 transition-colors">Terms</a>
                {" "}and{" "}
                <a href="#" className="text-zinc-500 hover:text-zinc-300 transition-colors">Privacy Policy</a>.
              </p>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
