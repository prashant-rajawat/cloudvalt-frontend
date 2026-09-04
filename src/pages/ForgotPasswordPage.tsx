import React, { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase.js";
import { requestPasswordReset } from "../lib/api.js";
import { Mail, ArrowLeft, ArrowRight, ShieldCheck, AlertCircle, CheckCircle2, Loader2, Clock } from "lucide-react";

const CloudVaultLogo = () => {
  const [imageError, setImageError] = useState(false);

  if (imageError) {
    return (
      <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100 shadow-sm mb-3">
        <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src="/logo.png"
      alt="CloudVault Logo"
      className="w-14 h-14 object-contain mix-blend-multiply mb-3"
      referrerPolicy="no-referrer"
      onError={() => setImageError(true)}
    />
  );
};

interface ForgotPasswordPageProps {
  onNavigate: (route: string) => void;
}

export function ForgotPasswordPage({ onNavigate }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [cooldown, setCooldown] = useState<number>(0);

  // Countdown timer for cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const validateEmail = (val: string): boolean => {
    const trimmed = val.trim().toLowerCase();
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(trimmed);
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setErrorMsg("Please enter your account email address.");
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setErrorMsg("Please enter a valid email address (e.g. name@company.com).");
      return;
    }

    if (cooldown > 0) {
      setErrorMsg(`Please wait ${cooldown} seconds before sending another reset request.`);
      return;
    }

    // Immediately prevent double-clicks & duplicate requests
    setIsLoading(true);

    try {
      // 1. Primary: Use CloudVault backend password reset service with environment-aware origin
      const clientOrigin = window.location.origin;
      try {
        await requestPasswordReset(trimmedEmail, clientOrigin);
      } catch (apiErr: any) {
        console.warn("Backend reset endpoint notice:", apiErr.message);
        // 2. Fallback: Direct client-side Supabase password reset request
        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          const { error: supabaseErr } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
            redirectTo: `${clientOrigin}/reset-password`,
          });
          if (supabaseErr && !supabaseErr.message?.includes("not found")) {
            throw supabaseErr;
          }
        } else {
          throw apiErr;
        }
      }

      setIsSuccess(true);
      setCooldown(60); // 60s cooldown against duplicate spam
    } catch (err: any) {
      console.error("Password reset error:", err);
      setErrorMsg(err?.message || "Failed to send password reset email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F8FAFC] flex flex-col justify-center items-center py-4 px-3.5 sm:px-6 selection:bg-blue-500 selection:text-white">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-[440px] w-full p-5 sm:p-7 md:p-8 shadow-xl border border-slate-200/80 relative animate-in fade-in zoom-in-95 duration-200 my-auto">
        <div className="flex flex-col items-center text-center mb-3.5 sm:mb-5">
          <CloudVaultLogo />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Reset your password</h1>
          <p className="text-xs text-slate-500 mt-0.5 sm:mt-1">Enter your account email and we'll send you a secure reset link</p>
        </div>

        {errorMsg && (
          <div role="alert" className="mb-3.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{errorMsg}</span>
          </div>
        )}

        {isSuccess ? (
          <div className="space-y-4 sm:space-y-5 animate-in fade-in py-2">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm mb-1">Reset link sent successfully!</p>
                <p className="text-emerald-700 leading-relaxed">
                  We've sent a password reset link to <strong className="font-semibold">{email.trim().toLowerCase()}</strong>. Please check your inbox and follow the instructions.
                </p>
              </div>
            </div>

            {cooldown > 0 && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200/70 rounded-xl py-2 px-3">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Resend available in <strong className="font-semibold text-slate-700">{cooldown}s</strong></span>
              </div>
            )}

            <button
              type="button"
              onClick={() => onNavigate("/login")}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 sm:py-3 px-4 rounded-xl text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Sign In</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleResetRequest} className="space-y-3 sm:space-y-4">
            <div>
              <label htmlFor="forgot-email" className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-2.5 sm:top-3 text-slate-400" />
                <input
                  id="forgot-email"
                  name="email"
                  autoComplete="email"
                  type="email"
                  required
                  disabled={isLoading}
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 sm:py-2.5 pl-9 pr-3.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:opacity-60"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || cooldown > 0}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 sm:py-3 px-4 rounded-xl text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer mt-1 sm:mt-1.5"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending Reset Link...</span>
                </>
              ) : cooldown > 0 ? (
                <span>Wait {cooldown}s to Resend</span>
              ) : (
                <>
                  <span>Send Reset Link</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => onNavigate("/login")}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5 cursor-pointer py-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Sign In</span>
              </button>
            </div>
          </form>
        )}

        <div className="mt-3.5 sm:mt-5 pt-3 sm:pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Secure Tokenized Password Recovery</span>
        </div>
      </div>
    </div>
  );
}

