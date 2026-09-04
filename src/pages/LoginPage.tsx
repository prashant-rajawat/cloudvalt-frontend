import React, { useState } from "react";
import { getSupabaseBrowserClient, ensureSupabaseClient } from "../lib/supabase.js";
import { parseResponseSafely } from "../lib/api.js";
import { Lock, Mail, Eye, EyeOff, ArrowRight, ShieldCheck, AlertCircle, Loader2, CheckCircle2, Send } from "lucide-react";

interface LoginPageProps {
  onSuccess: () => void;
  onNavigate: (route: string) => void;
  initialSuccessMsg?: string | null;
}

export function LoginPage({ onSuccess, onNavigate, initialSuccessMsg }: LoginPageProps) {
  // Read query params if present (e.g. ?email=user@example.com)
  const urlParams = new URLSearchParams(window.location.search);
  const paramEmail = urlParams.get("email") || "";

  const [email, setEmail] = useState(() => paramEmail || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(initialSuccessMsg || null);
  const [isEmailUnconfirmed, setIsEmailUnconfirmed] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsEmailUnconfirmed(false);
    setIsLoading(true);

    let supabase = getSupabaseBrowserClient();
    if (!supabase) {
      supabase = await ensureSupabaseClient();
    }

    try {
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (!error && data.session) {
          if (!data.user.email_confirmed_at && !(data.user as any).confirmed_at) {
            setIsEmailUnconfirmed(true);
            setErrorMsg("Email verification required: We've sent a verification code to your email. Please verify your email before continuing.");
            return;
          }
          onSuccess();
          onNavigate("/dashboard");
          return;
        }

        if (error) {
          const msg = error.message || "";
          const lowerMsg = msg.toLowerCase();
          if (lowerMsg.includes("email not confirmed") || lowerMsg.includes("email_not_confirmed")) {
            setIsEmailUnconfirmed(true);
            setErrorMsg("Email verification required: We've sent a verification code to your email. Please verify your email before continuing.");
            return;
          } else if (lowerMsg.includes("invalid login credentials") || lowerMsg.includes("invalid grant")) {
            setErrorMsg("Incorrect email or password. Please check your credentials.");
            return;
          } else if (lowerMsg.includes("rate limit") || lowerMsg.includes("too many requests")) {
            setErrorMsg("Too many login attempts. Please wait a moment and try again.");
            return;
          } else if (!lowerMsg.includes("fetch") && !lowerMsg.includes("network") && !lowerMsg.includes("failed to fetch")) {
            setErrorMsg(msg);
            return;
          }
        }
      }

      // Backend fallback authentication endpoint
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
          }),
        });

        const parsed = await parseResponseSafely<{ session?: any; user?: any; isEmailUnconfirmed?: boolean }>(res);

        if (!parsed.ok) {
          if (parsed.status === 403 || parsed.data?.isEmailUnconfirmed) {
            setIsEmailUnconfirmed(true);
            setErrorMsg("Email verification required: We've sent a verification code to your email. Please verify your email before continuing.");
            return;
          }
          if (parsed.errorMessage && !parsed.errorMessage.includes("reconnecting") && !parsed.errorMessage.includes("404")) {
            setErrorMsg(parsed.errorMessage);
            return;
          }
          setErrorMsg("Incorrect email or password. Please check your credentials.");
          return;
        }

        if (parsed.data?.session) {
          if (supabase) {
            await supabase.auth.setSession(parsed.data.session).catch(() => {});
          }
          onSuccess();
          onNavigate("/dashboard");
          return;
        }
      } catch {
        setErrorMsg("Incorrect email or password. Please check your credentials.");
      }
    } catch (err: any) {
      const msg = err?.message || "";
      const lowerMsg = msg.toLowerCase();

      if (lowerMsg.includes("email not confirmed") || lowerMsg.includes("email_not_confirmed")) {
        setIsEmailUnconfirmed(true);
        setErrorMsg("Email verification required: We've sent a verification code to your email. Please verify your email before continuing.");
      } else if (lowerMsg.includes("invalid login credentials") || lowerMsg.includes("invalid grant")) {
        setErrorMsg("Incorrect email or password. Please check your credentials.");
      } else {
        setErrorMsg(msg || "Failed to sign in. Please check your email and password.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) {
      setErrorMsg("Please enter your email address above first.");
      return;
    }

    setIsResending(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const parsed = await parseResponseSafely(res);
      if (!parsed.ok) {
        throw new Error(parsed.errorMessage || "Failed to resend verification code.");
      }

      setSuccessMsg("A new verification code has been dispatched to your email address!");
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to resend confirmation email. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F8FAFC] flex flex-col justify-center items-center py-4 px-3.5 sm:px-6 selection:bg-blue-500 selection:text-white">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-[440px] w-full p-5 sm:p-7 md:p-8 shadow-xl border border-slate-200/80 relative animate-in fade-in zoom-in-95 duration-200 my-auto">
        <div className="flex flex-col items-center text-center mb-3.5 sm:mb-5">
          <img
            src="/logo.png"
            alt="CloudVault Logo"
            className="w-11 h-11 sm:w-12 sm:h-12 object-contain mix-blend-multiply mb-1.5 sm:mb-2"
            referrerPolicy="no-referrer"
          />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Welcome back</h1>
          <p className="text-xs text-slate-500 mt-0.5 sm:mt-1">Sign in to access your secure CloudVault media storage</p>
        </div>

        {errorMsg && (
          <div role="alert" className="mb-3.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex flex-col gap-2 animate-in fade-in">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{errorMsg}</span>
            </div>
            {isEmailUnconfirmed && (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => onNavigate(`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-3 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Verify Email Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={isResending}
                  className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold py-1.5 px-3 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isResending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Resend Code</span>
                </button>
              </div>
            )}
          </div>
        )}

        {successMsg && (
          <div role="status" className="mb-3.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3 sm:space-y-3.5">
          <div>
            <label htmlFor="login-email" className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 sm:top-3 text-slate-400" />
              <input
                id="login-email"
                name="email"
                autoComplete="email"
                type="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 sm:py-2.5 pl-9 pr-3.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="login-password" className="block text-[11px] sm:text-xs font-semibold text-slate-700">Password</label>
              <button
                type="button"
                onClick={() => onNavigate("/forgot-password")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 sm:top-3 text-slate-400" />
              <input
                id="login-password"
                name="current-password"
                autoComplete="current-password"
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 sm:py-2.5 pl-9 pr-9 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 sm:top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                id="login-remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 shrink-0 cursor-pointer"
              />
              <span className="text-xs text-slate-600 font-medium select-none">Remember me</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 sm:py-3 px-4 rounded-xl text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer mt-1 sm:mt-1.5"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In to Vault</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-3.5 sm:mt-5 pt-3 sm:pt-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500">
            Don't have an account?{" "}
            <button
              type="button"
              onClick={() => onNavigate("/signup")}
              className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer ml-1"
            >
              Create account
            </button>
          </p>
        </div>

        <div className="mt-2.5 sm:mt-3 flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>PostgreSQL Row Level Security (RLS) Active</span>
        </div>
      </div>
    </div>
  );
}

