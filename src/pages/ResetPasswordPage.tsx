import React, { useState, useEffect } from "react";
import { getSupabaseBrowserClient, ensureSupabaseClient } from "../lib/supabase.js";
import { 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ArrowLeft, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Check, 
  RefreshCw,
  KeyRound,
  Mail,
  Key
} from "lucide-react";

interface ResetPasswordPageProps {
  onNavigate: (route: string) => void;
}

const CloudVaultLogo = () => {
  const [imageError, setImageError] = useState(false);

  if (imageError) {
    return (
      <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100 shadow-sm mb-3">
        <svg className="w-8 h-8 text-blue-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

export function ResetPasswordPage({ onNavigate }: ResetPasswordPageProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [isVerifying, setIsVerifying] = useState(true);
  const [isLinkExpired, setIsLinkExpired] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Manual OTP recovery code entry states
  const [manualEmail, setManualEmail] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // Requirement 5: CloudVault Password Complexity Rules
  // - At least 8 characters
  // - At least one uppercase letter
  // - At least one lowercase letter
  // - At least one number
  // - At least one special character
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password);
  const passwordsMatch = Boolean(password && confirmPassword && password === confirmPassword);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;

  useEffect(() => {
    let isMounted = true;

    const establishRecoverySession = async () => {
      setIsVerifying(true);
      setErrorMsg(null);

      // Parse search query and hash fragments
      const searchParams = new URLSearchParams(window.location.search);
      const hashString = window.location.hash.replace(/^#/, "");
      const hashParams = new URLSearchParams(hashString);

      // Check for explicit error parameters from Supabase redirect
      const urlError = searchParams.get("error") || hashParams.get("error");
      const urlErrorCode = searchParams.get("error_code") || hashParams.get("error_code");
      const urlErrorDesc = searchParams.get("error_description") || hashParams.get("error_description");

      if (urlError || urlErrorCode || urlErrorDesc) {
        console.warn("[ResetPassword] Detected error parameter in URL:", { urlError, urlErrorCode, urlErrorDesc });
        if (isMounted) {
          setIsLinkExpired(true);
          setIsVerifying(false);
        }
        return;
      }

      let supabase = getSupabaseBrowserClient();
      if (!supabase) {
        supabase = await ensureSupabaseClient();
      }

      if (!supabase) {
        if (isMounted) {
          setErrorMsg("Authentication service is currently unavailable. Please reload the page.");
          setIsVerifying(false);
        }
        return;
      }

      // Check for token_hash in search parameters (from direct CloudVault email link)
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");
      if (tokenHash) {
        console.log("[ResetPassword] Verifying recovery token_hash via Supabase verifyOtp...");
        try {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: (type as any) || "recovery",
          });

          if (error) {
            console.warn("[ResetPassword] verifyOtp error:", error.message);
            if (isMounted) {
              setIsLinkExpired(true);
              setIsVerifying(false);
            }
            return;
          }

          if (data.session || data.user) {
            console.log("[ResetPassword] Recovery session verified successfully via token_hash!");
            if (isMounted) {
              setHasSession(true);
              setIsVerifying(false);
            }
            return;
          }
        } catch (err) {
          console.error("[ResetPassword] verifyOtp exception:", err);
          if (isMounted) {
            setIsLinkExpired(true);
            setIsVerifying(false);
          }
          return;
        }
      }

      // Check for PKCE code in search parameters
      const code = searchParams.get("code");
      if (code) {
        console.log("[ResetPassword] Exchanging PKCE code for recovery session...");
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.warn("[ResetPassword] exchangeCodeForSession error:", error.message);
            if (isMounted) {
              setIsLinkExpired(true);
              setIsVerifying(false);
            }
            return;
          }

          if (data.session) {
            console.log("[ResetPassword] PKCE session exchange successful!");
            if (isMounted) {
              setHasSession(true);
              setIsVerifying(false);
            }
            return;
          }
        } catch (err) {
          console.error("[ResetPassword] PKCE exchange exception:", err);
        }
      }

      // Check for implicit tokens in hash fragment (#access_token=...&refresh_token=...&type=recovery)
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token") || "";
      const hashType = hashParams.get("type");

      if (accessToken) {
        console.log("[ResetPassword] Setting session from URL hash tokens...");
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.warn("[ResetPassword] setSession error from hash:", error.message);
            if (isMounted) {
              setIsLinkExpired(true);
              setIsVerifying(false);
            }
            return;
          }

          if (data.session) {
            console.log("[ResetPassword] Session successfully established from hash!");
            if (isMounted) {
              setHasSession(true);
              setIsVerifying(false);
            }
            return;
          }
        } catch (err) {
          console.error("[ResetPassword] setSession exception:", err);
        }
      }

      // Check if an active session already exists (e.g. from onAuthStateChange PASSWORD_RECOVERY)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log("[ResetPassword] Active session found for:", session.user?.email);
        if (isMounted) {
          setHasSession(true);
          setIsVerifying(false);
        }
        return;
      }

      // If neither tokens nor session exist, the link is invalid or expired
      console.warn("[ResetPassword] No recovery credentials found.");
      if (isMounted) {
        setIsLinkExpired(true);
        setIsVerifying(false);
      }
    };

    establishRecoverySession();

    // Listen to Supabase PASSWORD_RECOVERY auth event as an additional fail-safe
    const supabase = getSupabaseBrowserClient();
    let authListener: any = null;
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
          console.log("[ResetPassword] onAuthStateChange recovery event caught:", event);
          if (isMounted) {
            setHasSession(true);
            setIsVerifying(false);
            setIsLinkExpired(false);
          }
        }
      });
      authListener = data?.subscription;
    }

    return () => {
      isMounted = false;
      if (authListener) authListener.unsubscribe();
    };
  }, []);

  const handleVerifyManualCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    const cleanEmail = manualEmail.trim().toLowerCase();
    const cleanCode = manualCode.trim();

    if (!cleanEmail || !cleanCode) {
      setManualError("Please provide both your account email and the recovery code.");
      return;
    }

    setManualLoading(true);
    let supabase = getSupabaseBrowserClient();
    if (!supabase) {
      supabase = await ensureSupabaseClient();
    }
    if (!supabase) {
      setManualError("Authentication service is temporarily unavailable.");
      setManualLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: "recovery",
      });

      if (error) throw error;

      if (data.session || data.user) {
        setHasSession(true);
        setIsLinkExpired(false);
        setErrorMsg(null);
      }
    } catch (err: any) {
      setManualError(err?.message || "Invalid or expired recovery code. Please check and try again.");
    } finally {
      setManualLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please re-enter your confirm password.");
      return;
    }

    if (!isPasswordValid) {
      setErrorMsg("Password does not meet all required complexity criteria.");
      return;
    }

    setIsLoading(true);

    let supabase = getSupabaseBrowserClient();
    if (!supabase) {
      supabase = await ensureSupabaseClient();
    }
    if (!supabase) {
      setErrorMsg("Authentication service is temporarily unavailable. Please refresh.");
      setIsLoading(false);
      return;
    }

    try {
      // Requirement 6: Standard Supabase user password update
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      // Invalidate recovery session and sign out cleanly
      await supabase.auth.signOut().catch(() => {});

      setIsSuccess(true);
    } catch (err: any) {
      console.error("[ResetPassword] updateUser error:", err);
      setErrorMsg(err?.message || "Failed to update password. Please request a new reset link.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F8FAFC] flex flex-col justify-center items-center py-4 px-3.5 sm:px-6 selection:bg-blue-500 selection:text-white">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-[440px] w-full p-5 sm:p-7 md:p-8 shadow-xl border border-slate-200/80 relative animate-in fade-in zoom-in-95 duration-200 my-auto">
        
        {/* Loading / Link Verification State */}
        {isVerifying ? (
          <div className="flex flex-col items-center text-center py-8 sm:py-10 space-y-3 sm:space-y-4 animate-in fade-in">
            <CloudVaultLogo />
            <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 animate-spin" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">Verifying Reset Link</h2>
            <p className="text-xs text-slate-400 max-w-[260px] leading-relaxed">
              Validating your secure password recovery session with CloudVault. Please wait...
            </p>
          </div>
        ) : isLinkExpired ? (
          /* Requirement 7: Expired or Invalid Reset Links Screen */
          <div className="space-y-4 sm:space-y-5 animate-in fade-in text-center py-2">
            <div className="flex flex-col items-center mb-4">
              <CloudVaultLogo />
              <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 text-rose-500 flex items-center justify-center mb-3 mt-1 shadow-sm">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Reset link expired or invalid</h1>
              <p className="text-xs text-slate-500 mt-2 max-w-[300px] leading-relaxed">
                This password reset link is no longer valid. Please request a new password reset link.
              </p>
            </div>

            <div className="space-y-2.5 sm:space-y-3">
              <button
                type="button"
                onClick={() => onNavigate("/forgot-password")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 sm:py-3 px-4 rounded-xl text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Request New Reset Link</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate("/login")}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 sm:py-3 px-4 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Sign In</span>
              </button>
            </div>

            {/* Optional Manual Recovery Code Entry */}
            <div className="pt-3 border-t border-slate-100 text-center">
              {!showManualEntry ? (
                <button
                  type="button"
                  onClick={() => setShowManualEntry(true)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1.5 cursor-pointer py-1"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Have a 6-digit recovery code? Enter it manually</span>
                </button>
              ) : (
                <form onSubmit={handleVerifyManualCode} className="space-y-2.5 text-left pt-1">
                  <p className="text-xs font-semibold text-slate-700">Enter Recovery Code</p>
                  {manualError && (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{manualError}</span>
                    </div>
                  )}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Account Email</label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="email"
                        required
                        placeholder="you@company.com"
                        value={manualEmail}
                        onChange={(e) => setManualEmail(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">6-Digit Code</label>
                    <div className="relative">
                      <KeyRound className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        required
                        placeholder="123456"
                        maxLength={8}
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value.replace(/\s+/g, ""))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-8 pr-3 text-xs tracking-widest font-mono text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={manualLoading}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-3 rounded-lg text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {manualLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Verify Code"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManualEntry(false)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium py-1.5 px-3 rounded-lg text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : isSuccess ? (
          /* Requirement 8: Successful Password Reset Screen */
          <div className="space-y-4 sm:space-y-5 animate-in fade-in text-center py-2">
            <div className="flex flex-col items-center mb-4">
              <CloudVaultLogo />
              <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mb-3 mt-1 shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Password updated successfully</h1>
              <p className="text-xs text-slate-600 mt-2 max-w-[310px] leading-relaxed">
                Your CloudVault password has been changed. You can now sign in with your new password.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate("/login")}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 sm:py-3 px-4 rounded-xl text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Back to Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Requirement 3: Dedicated Reset your password Form */
          <>
            <div className="flex flex-col items-center text-center mb-3.5 sm:mb-5">
              <CloudVaultLogo />
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Reset your password</h1>
              <p className="text-xs text-slate-500 mt-0.5 sm:mt-1">Create a new secure password for your CloudVault account.</p>
            </div>

            {errorMsg && (
              <div role="alert" className="mb-3.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-3 sm:space-y-3.5">
              <div>
                <label htmlFor="reset-new-password" className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-1">New Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 sm:top-3 text-slate-400" />
                  <input
                    id="reset-new-password"
                    name="new-password"
                    autoComplete="new-password"
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
                    className="absolute right-3 top-2.5 sm:top-3 text-slate-400 hover:text-slate-600 outline-none transition-colors cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="reset-confirm-password" className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 sm:top-3 text-slate-400" />
                  <input
                    id="reset-confirm-password"
                    name="confirm-new-password"
                    autoComplete="new-password"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 sm:py-2.5 pl-9 pr-9 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 sm:top-3 text-slate-400 hover:text-slate-600 outline-none transition-colors cursor-pointer"
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Requirement 5: Live Password Requirements Display */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 text-[11px] select-none">
                <div className="font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                  <span>Password Requirements</span>
                </div>

                <div className={`flex items-center gap-1.5 transition-colors ${hasMinLength ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                  <Check className={`w-3.5 h-3.5 ${hasMinLength ? "opacity-100 text-emerald-600" : "opacity-30 text-slate-300"}`} />
                  <span>At least 8 characters</span>
                </div>

                <div className={`flex items-center gap-1.5 transition-colors ${hasUppercase ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                  <Check className={`w-3.5 h-3.5 ${hasUppercase ? "opacity-100 text-emerald-600" : "opacity-30 text-slate-300"}`} />
                  <span>One uppercase letter</span>
                </div>

                <div className={`flex items-center gap-1.5 transition-colors ${hasLowercase ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                  <Check className={`w-3.5 h-3.5 ${hasLowercase ? "opacity-100 text-emerald-600" : "opacity-30 text-slate-300"}`} />
                  <span>One lowercase letter</span>
                </div>

                <div className={`flex items-center gap-1.5 transition-colors ${hasNumber ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                  <Check className={`w-3.5 h-3.5 ${hasNumber ? "opacity-100 text-emerald-600" : "opacity-30 text-slate-300"}`} />
                  <span>One number</span>
                </div>

                <div className={`flex items-center gap-1.5 transition-colors ${hasSpecialChar ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                  <Check className={`w-3.5 h-3.5 ${hasSpecialChar ? "opacity-100 text-emerald-600" : "opacity-30 text-slate-300"}`} />
                  <span>One special character (!@#$%^&amp;*...)</span>
                </div>

                {confirmPassword && (
                  <div className={`flex items-center gap-1.5 transition-colors pt-0.5 border-t border-slate-200/50 ${passwordsMatch ? "text-emerald-600 font-medium" : "text-rose-500 font-medium"}`}>
                    <Check className={`w-3.5 h-3.5 ${passwordsMatch ? "opacity-100 text-emerald-600" : "opacity-40 text-rose-400"}`} />
                    <span>{passwordsMatch ? "Passwords match" : "Passwords do not match"}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || !isPasswordValid || !passwordsMatch}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 sm:py-3 px-4 rounded-xl text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer mt-1 sm:mt-1.5"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <span>Update Password</span>
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
                  <span>Back to Sign In</span>
                </button>
              </div>
            </form>
          </>
        )}

        <div className="mt-3.5 sm:mt-5 pt-3 sm:pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Secure Auth Cryptography</span>
        </div>
      </div>
    </div>
  );
}

