import React, { useState, useMemo, useRef } from "react";
import { Lock, Mail, User, Eye, EyeOff, ArrowRight, ShieldCheck, AlertCircle, Loader2, Check, X } from "lucide-react";
import { registerAccount } from "../lib/api.js";
import { getSupabaseBrowserClient, ensureSupabaseClient } from "../lib/supabase.js";

interface SignupPageProps {
  onSuccess: () => void;
  onNavigate: (route: string) => void;
}

export function SignupPage({ onSuccess, onNavigate }: SignupPageProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Prevent double click/submission
  const isSubmittingRef = useRef(false);

  // Full Name validation rule:
  // 2-100 characters, alphabetic, allowed: spaces, hyphens, apostrophes. No numbers or arbitrary symbols.
  const trimmedName = fullName.trim().replace(/\s+/g, " ");
  const isNameLengthValid = trimmedName.length >= 2 && trimmedName.length <= 100;
  const hasAlphabeticChar = /[a-zA-Z]/.test(trimmedName);
  const hasNoNumbersOrIllegalSymbols = /^[a-zA-Z\s'-]*$/.test(trimmedName) && !/\d/.test(trimmedName);
  const isFullNameValid = isNameLengthValid && hasAlphabeticChar && hasNoNumbersOrIllegalSymbols;

  // Email format validation: RFC compliant, no spaces
  const cleanEmail = email.trim().toLowerCase();
  const isEmailValid = useMemo(() => {
    if (!cleanEmail || /\s/.test(cleanEmail)) return false;
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    return emailRegex.test(cleanEmail) && cleanEmail.length <= 254;
  }, [cleanEmail]);

  // Password rules
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password);

  // Password must not match email or name
  const matchesEmail = Boolean(
    cleanEmail &&
    (password.toLowerCase() === cleanEmail ||
      (cleanEmail.includes("@") && password.toLowerCase() === cleanEmail.split("@")[0]))
  );
  const matchesName = Boolean(trimmedName.length >= 3 && password.toLowerCase() === trimmedName.toLowerCase());

  const isPasswordStrong = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial && !matchesEmail && !matchesName;

  // Confirm password
  const isConfirmMatch = confirmPassword.length > 0 && password === confirmPassword;
  const showConfirmMismatch = touched.confirmPassword && confirmPassword.length > 0 && !isConfirmMatch;

  // Can submit check
  const isFormSubmittable = isFullNameValid && isEmailValid && isPasswordStrong && isConfirmMatch && acceptTerms;

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    setErrorMsg(null);
    setIsAlreadyRegistered(false);

    // Validate Full Name
    if (!isFullNameValid) {
      setErrorMsg("Please enter a valid full name (letters, spaces, hyphens, and apostrophes only, 2-100 characters).");
      return;
    }

    // Validate Email
    if (!isEmailValid) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    // Validate Password
    if (!isPasswordStrong) {
      if (matchesEmail || matchesName) {
        setErrorMsg("Password cannot match your name or email address.");
      } else {
        setErrorMsg("Please satisfy all password security requirements.");
      }
      return;
    }

    // Validate Password Match
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    // Validate Terms
    if (!acceptTerms) {
      setErrorMsg("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }

    setIsLoading(true);
    isSubmittingRef.current = true;

    try {
      try {
        const data = await registerAccount({
          fullName: trimmedName,
          email: cleanEmail,
          password,
          confirmPassword,
          acceptTerms: true,
        });

        // Store pending email for OTP verification page
        sessionStorage.setItem("cv_pending_verify_email", cleanEmail);
        if (data.otpLength) {
          sessionStorage.setItem("cv_pending_otp_length", data.otpLength.toString());
        }
        const expiry = Date.now() + (data.expiresInSeconds || 300) * 1000;
        sessionStorage.setItem("cv_otp_expiry_time", expiry.toString());

        // Navigate to dedicated verification screen
        onNavigate(`/verify-email?email=${encodeURIComponent(cleanEmail)}`);
        return;
      } catch (apiErr: any) {
        if (apiErr?.isAlreadyRegistered || apiErr?.status === 409) {
          setIsAlreadyRegistered(true);
          throw apiErr;
        }

        // Direct browser Supabase signup fallback
        let supabase = getSupabaseBrowserClient();
        if (!supabase) {
          supabase = await ensureSupabaseClient();
        }

        if (supabase) {
          const { data: sbData, error: sbError } = await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                full_name: trimmedName,
                name: trimmedName,
              },
            },
          });

          if (sbError) {
            const sbMsg = sbError.message || "";
            if (sbMsg.toLowerCase().includes("already registered") || sbMsg.toLowerCase().includes("user already registered")) {
              setIsAlreadyRegistered(true);
              throw new Error("An account already exists with this email. Try signing in or resetting your password.");
            }
            throw sbError;
          }

          if (sbData?.user) {
            sessionStorage.setItem("cv_pending_verify_email", cleanEmail);
            sessionStorage.setItem("cv_pending_otp_length", "8");
            const expiry = Date.now() + 300 * 1000;
            sessionStorage.setItem("cv_otp_expiry_time", expiry.toString());
            onNavigate(`/verify-email?email=${encodeURIComponent(cleanEmail)}`);
            return;
          }
        }

        throw apiErr;
      }
    } catch (err: any) {
      if (err?.isAlreadyRegistered || err?.status === 409) {
        setIsAlreadyRegistered(true);
      }
      const msg = err?.message || "";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setErrorMsg("Unable to connect to the authentication server. Please check your internet connection.");
      } else {
        setErrorMsg(msg || "Failed to create account. Please check your details.");
      }
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F8FAFC] flex flex-col justify-center items-center py-3 sm:py-5 px-3.5 sm:px-6 selection:bg-blue-500 selection:text-white antialiased">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-[430px] w-full p-4 sm:p-6 md:p-7 shadow-xl border border-slate-200/80 relative animate-in fade-in zoom-in-95 duration-200 my-auto">
        
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-3 sm:mb-4">
          <img
            src="/logo.png"
            alt="CloudVault Logo"
            className="w-10 h-10 sm:w-11 sm:h-11 object-contain mix-blend-multiply mb-1"
            referrerPolicy="no-referrer"
          />
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Create your account</h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            15 GB secure cloud storage with end-to-end email verification
          </p>
        </div>

        {/* Global Error Banner */}
        {errorMsg && (
          <div role="alert" className="mb-3 p-2.5 sm:p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex flex-col gap-2 animate-in fade-in">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{errorMsg}</span>
            </div>
            {isAlreadyRegistered && (
              <button
                type="button"
                onClick={() => onNavigate(`/login?email=${encodeURIComponent(cleanEmail)}`)}
                className="mt-0.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-1.5 px-3 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer self-start"
              >
                <span>Sign in instead</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Signup Form */}
        <form onSubmit={handleSignup} className="space-y-2.5 sm:space-y-3">
          
          {/* 1. Full Name */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="signup-fullname" className="block text-[11px] sm:text-xs font-semibold text-slate-700">
                Full Name
              </label>
              {touched.fullName && (
                <span className={`text-[10px] ${isFullNameValid ? "text-emerald-600" : "text-rose-500"}`}>
                  {isFullNameValid ? "Valid" : "Letters & spaces only (2-100)"}
                </span>
              )}
            </div>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                id="signup-fullname"
                name="name"
                autoComplete="name"
                type="text"
                required
                maxLength={100}
                placeholder="Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onBlur={() => handleBlur("fullName")}
                className={`w-full bg-slate-50 border rounded-xl py-2 pl-9 pr-3.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white outline-none transition-all ${
                  touched.fullName && !isFullNameValid
                    ? "border-rose-300 focus:ring-2 focus:ring-rose-400"
                    : "border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                }`}
              />
            </div>
          </div>

          {/* 2. Email Address */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="signup-email" className="block text-[11px] sm:text-xs font-semibold text-slate-700">
                Email Address
              </label>
              {touched.email && (
                <span className={`text-[10px] ${isEmailValid ? "text-emerald-600" : "text-rose-500"}`}>
                  {isEmailValid ? "Valid format" : "Valid email required"}
                </span>
              )}
            </div>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                id="signup-email"
                name="email"
                autoComplete="email"
                type="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => handleBlur("email")}
                className={`w-full bg-slate-50 border rounded-xl py-2 pl-9 pr-3.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white outline-none transition-all ${
                  touched.email && !isEmailValid
                    ? "border-rose-300 focus:ring-2 focus:ring-rose-400"
                    : "border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                }`}
              />
            </div>
          </div>

          {/* 3. Password */}
          <div>
            <label htmlFor="signup-password" className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                id="signup-password"
                name="new-password"
                autoComplete="new-password"
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => handleBlur("password")}
                className={`w-full bg-slate-50 border rounded-xl py-2 pl-9 pr-9 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white outline-none transition-all ${
                  touched.password && !isPasswordStrong
                    ? "border-amber-300 focus:ring-2 focus:ring-amber-400"
                    : "border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 4. Confirm Password */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="signup-confirm-password" className="block text-[11px] sm:text-xs font-semibold text-slate-700">
                Confirm Password
              </label>
              {confirmPassword.length > 0 && (
                <span className={`text-[10px] ${isConfirmMatch ? "text-emerald-600" : "text-rose-500"}`}>
                  {isConfirmMatch ? "Passwords match" : "Passwords do not match"}
                </span>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                id="signup-confirm-password"
                name="confirm-password"
                autoComplete="new-password"
                type={showConfirmPassword ? "text" : "password"}
                required
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => handleBlur("confirmPassword")}
                className={`w-full bg-slate-50 border rounded-xl py-2 pl-9 pr-9 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white outline-none transition-all ${
                  showConfirmMismatch
                    ? "border-rose-300 focus:ring-2 focus:ring-rose-400"
                    : "border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Password Security Checklist - Compact responsive grid */}
          {password.length > 0 && (
            <div className="p-2 sm:p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-[10px] sm:text-[11px] animate-in fade-in">
              <div className="font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Password Requirements</span>
                <span className={isPasswordStrong ? "text-emerald-600 font-bold" : "text-slate-400"}>
                  {isPasswordStrong ? "Strong" : "Incomplete"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                <div className={`flex items-center gap-1 ${hasMinLength ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                  <Check className={`w-3 h-3 ${hasMinLength ? "opacity-100" : "opacity-30"}`} />
                  <span>8+ characters</span>
                </div>
                <div className={`flex items-center gap-1 ${hasUppercase ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                  <Check className={`w-3 h-3 ${hasUppercase ? "opacity-100" : "opacity-30"}`} />
                  <span>Uppercase letter</span>
                </div>
                <div className={`flex items-center gap-1 ${hasLowercase ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                  <Check className={`w-3 h-3 ${hasLowercase ? "opacity-100" : "opacity-30"}`} />
                  <span>Lowercase letter</span>
                </div>
                <div className={`flex items-center gap-1 ${hasNumber ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                  <Check className={`w-3 h-3 ${hasNumber ? "opacity-100" : "opacity-30"}`} />
                  <span>Number</span>
                </div>
                <div className={`flex items-center gap-1 col-span-2 ${hasSpecial ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                  <Check className={`w-3 h-3 ${hasSpecial ? "opacity-100" : "opacity-30"}`} />
                  <span>Special character (!@#$%^&*)</span>
                </div>
              </div>
            </div>
          )}

          {/* Terms & Conditions Checkbox */}
          <div className="flex items-start gap-2 pt-0.5">
            <input
              type="checkbox"
              id="terms"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 shrink-0 cursor-pointer"
            />
            <label htmlFor="terms" className="text-[11px] sm:text-xs text-slate-600 select-none cursor-pointer leading-snug">
              I agree to the <span className="text-blue-600 font-medium">Terms of Service</span> & Privacy Policy
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || (confirmPassword.length > 0 && !isConfirmMatch)}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-xl text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Create Account & Verify</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Navigation */}
        <div className="mt-3 pt-3 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => onNavigate("/login")}
              className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer ml-0.5"
            >
              Sign in
            </button>
          </p>
        </div>

        {/* Status Indicator */}
        <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Email Verification & PostgreSQL RLS Protected</span>
        </div>

      </div>
    </div>
  );
}
