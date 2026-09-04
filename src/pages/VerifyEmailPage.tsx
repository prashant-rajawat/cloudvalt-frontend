import React, { useState, useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase.js";
import { parseResponseSafely } from "../lib/api.js";
import { Mail, ArrowLeft, ArrowRight, ShieldCheck, AlertCircle, CheckCircle2, Loader2, RefreshCw, Clock } from "lucide-react";

interface VerifyEmailPageProps {
  onSuccess: () => void;
  onNavigate: (route: string) => void;
  initialEmail?: string;
  initialOtpLength?: number;
}

export function VerifyEmailPage({
  onSuccess,
  onNavigate,
  initialEmail = "",
  initialOtpLength = 6,
}: VerifyEmailPageProps) {
  // Read query params if present (e.g. ?token=123456&email=user@example.com)
  const urlParams = new URLSearchParams(window.location.search);
  const paramEmail = urlParams.get("email") || "";
  const paramToken = urlParams.get("token") || "";

  // Retrieve cached email from session storage if not passed
  const [email, setEmail] = useState<string>(() => {
    return (
      initialEmail ||
      paramEmail ||
      sessionStorage.getItem("cv_pending_verify_email") ||
      ""
    );
  });

  const [otpLength, setOtpLength] = useState<number>(() => {
    const cachedLength = sessionStorage.getItem("cv_pending_otp_length");
    return cachedLength ? parseInt(cachedLength, 10) : (initialOtpLength || 6);
  });

  const [otpValues, setOtpValues] = useState<string[]>(() =>
    Array(otpLength).fill("")
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isVerifiedSuccess, setIsVerifiedSuccess] = useState(false);
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState("");

  // Code Expiry Countdown (5 minutes = 300 seconds)
  const [expirySeconds, setExpirySeconds] = useState<number>(() => {
    const savedExpiry = sessionStorage.getItem("cv_otp_expiry_time");
    if (savedExpiry) {
      const remaining = Math.max(0, Math.floor((parseInt(savedExpiry, 10) - Date.now()) / 1000));
      return remaining > 0 ? remaining : 0;
    }
    const expiryTime = Date.now() + 300 * 1000;
    sessionStorage.setItem("cv_otp_expiry_time", expiryTime.toString());
    return 300;
  });

  // Resend Cooldown Countdown (60 seconds)
  const [resendCooldown, setResendCooldown] = useState<number>(() => {
    const savedCooldown = sessionStorage.getItem("cv_resend_cooldown_time");
    if (savedCooldown) {
      const remaining = Math.max(0, Math.floor((parseInt(savedCooldown, 10) - Date.now()) / 1000));
      return remaining > 0 ? remaining : 0;
    }
    return 0;
  });

  // Input refs for individual OTP boxes
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  // Double-submit ref guard
  const isSubmittingRef = useRef(false);

  // Sync otpValues when otpLength changes
  useEffect(() => {
    setOtpValues((prev) => {
      if (prev.length === otpLength) return prev;
      const next = Array(otpLength).fill("");
      for (let i = 0; i < Math.min(prev.length, otpLength); i++) {
        next[i] = prev[i];
      }
      return next;
    });
  }, [otpLength]);

  // Code Expiry timer effect
  useEffect(() => {
    if (expirySeconds <= 0) return;
    const interval = setInterval(() => {
      setExpirySeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [expirySeconds]);

  // Resend Cooldown timer effect
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Auto-fill from URL paramToken if present
  useEffect(() => {
    if (paramToken) {
      const clean = paramToken.replace(/\D/g, "").slice(0, otpLength);
      if (clean) {
        const newVals = Array(otpLength).fill("");
        clean.split("").forEach((ch, idx) => {
          if (idx < otpLength) newVals[idx] = ch;
        });
        setOtpValues(newVals);
        // Automatically verify if full length matches
        if (clean.length === otpLength && email) {
          handleVerify(clean);
        }
      }
    }
  }, [paramToken, otpLength]);

  // Auto-focus first input box on load
  useEffect(() => {
    if (!isVerifiedSuccess && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [isVerifiedSuccess]);

  // Helper to mask email address: user@example.com -> u***@example.com
  const maskEmail = (rawEmail: string) => {
    if (!rawEmail) return "your email";
    const parts = rawEmail.split("@");
    if (parts.length !== 2) return rawEmail;
    const [local, domain] = parts;
    if (local.length <= 2) {
      return `${local[0]}***@${domain}`;
    }
    return `${local[0]}***${local[local.length - 1]}@${domain}`;
  };

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
  };

  // Handle digit change in an OTP box
  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric digits
    const cleanDigit = value.replace(/\D/g, "");
    if (!cleanDigit && value !== "") return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const newValues = [...otpValues];
    // If user pasted multiple characters into a single box
    if (cleanDigit.length > 1) {
      const digits = cleanDigit.slice(0, otpLength).split("");
      digits.forEach((d, i) => {
        newValues[i] = d;
      });
      setOtpValues(newValues);
      const nextIdx = Math.min(digits.length, otpLength - 1);
      inputRefs.current[nextIdx]?.focus();

      if (digits.length === otpLength) {
        handleVerify(digits.join(""));
      }
      return;
    }

    newValues[index] = cleanDigit;
    setOtpValues(newValues);

    // Auto-advance to next input box if digit entered
    if (cleanDigit && index < otpLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if all boxes are now filled
    const fullCode = newValues.join("");
    if (fullCode.length === otpLength && !newValues.includes("")) {
      handleVerify(fullCode);
    }
  };

  // Handle backspace navigation between boxes
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!otpValues[index] && index > 0) {
        // Move focus to previous box
        inputRefs.current[index - 1]?.focus();
      } else if (otpValues[index]) {
        // Clear current box
        const newValues = [...otpValues];
        newValues[index] = "";
        setOtpValues(newValues);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < otpLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle pasting code into any OTP box
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain");
    const cleanDigits = pastedData.replace(/\D/g, "").slice(0, otpLength);

    if (!cleanDigits) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    // If pasted code has 8 digits and current boxes are 6, dynamically expand
    if (cleanDigits.length === 8 && otpLength === 6) {
      setOtpLength(8);
      sessionStorage.setItem("cv_pending_otp_length", "8");
    }

    const newValues = Array(cleanDigits.length >= 8 ? 8 : otpLength).fill("");
    cleanDigits.split("").forEach((d, i) => {
      if (i < newValues.length) newValues[i] = d;
    });
    setOtpValues(newValues);

    const targetIdx = Math.min(cleanDigits.length, newValues.length - 1);
    inputRefs.current[targetIdx]?.focus();

    if (cleanDigits.length === newValues.length) {
      handleVerify(cleanDigits);
    }
  };

  // Execute OTP Verification against backend / Supabase
  const handleVerify = async (codeToVerify?: string) => {
    const finalCode = (codeToVerify || otpValues.join("")).trim();

    if (isSubmittingRef.current) return;

    if (!email) {
      setErrorMsg("Email address is missing. Please re-enter your email.");
      return;
    }

    if (!finalCode) {
      setErrorMsg("Please enter the verification code.");
      return;
    }

    if (finalCode.length < otpLength) {
      setErrorMsg(`Please enter the complete ${otpLength}-digit verification code.`);
      return;
    }

    if (expirySeconds <= 0) {
      setErrorMsg("This verification code has expired. Please request a new code.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    isSubmittingRef.current = true;

    try {
      // 1. Call server verification endpoint (which verifies with Supabase & syncs public.profiles)
      const res = await fetch("/api/auth/verify-email-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          token: finalCode,
        }),
      });

      const parsed = await parseResponseSafely(res);
      const data = parsed.data || {};

      if (!parsed.ok) {
        // Fallback: try verifying directly via Supabase browser client if server returned an error
        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          const directRes = await supabase.auth.verifyOtp({
            email: email.trim().toLowerCase(),
            token: finalCode,
            type: "signup",
          });

          if (!directRes.error && directRes.data.user) {
            setIsVerifiedSuccess(true);
            setSuccessMsg("Email verified successfully! Activating your account...");
            sessionStorage.removeItem("cv_pending_verify_email");
            sessionStorage.removeItem("cv_pending_otp_length");
            sessionStorage.removeItem("cv_otp_expiry_time");
            sessionStorage.removeItem("cv_resend_cooldown_time");

            setTimeout(() => {
              onSuccess();
              onNavigate("/dashboard");
            }, 1200);
            return;
          }
        }

        if (data.isExpired) {
          setExpirySeconds(0);
          throw new Error("This verification code has expired. Please request a new code.");
        }
        throw new Error(data.message || parsed.errorMessage || "Invalid verification code. Please check the code and try again.");
      }

      // If server returned session, establish session in browser Supabase client
      if (data.session) {
        const supabase = getSupabaseBrowserClient();
        if (supabase && supabase.auth.setSession) {
          await supabase.auth.setSession(data.session);
        }
      }

      setIsVerifiedSuccess(true);
      setSuccessMsg("Email verified successfully! Welcome to CloudVault.");

      // Clean up session storage
      sessionStorage.removeItem("cv_pending_verify_email");
      sessionStorage.removeItem("cv_pending_otp_length");
      sessionStorage.removeItem("cv_otp_expiry_time");
      sessionStorage.removeItem("cv_resend_cooldown_time");

      setTimeout(() => {
        onSuccess();
        onNavigate("/dashboard");
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || "Verification failed. Please try again.");
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // Resend code with cooldown protection
  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;

    if (!email) {
      setErrorMsg("Please enter your email address to receive a verification code.");
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
      const data = parsed.data || {};

      if (!parsed.ok) {
        if (res.status === 429 && data.cooldownRemaining) {
          setResendCooldown(data.cooldownRemaining);
        }
        throw new Error(data.message || parsed.errorMessage || "Failed to resend verification code.");
      }

      if (data.otpLength && data.otpLength !== otpLength) {
        setOtpLength(data.otpLength);
        sessionStorage.setItem("cv_pending_otp_length", data.otpLength.toString());
      }

      // Clear input boxes & refocus
      setOtpValues(Array(data.otpLength || otpLength).fill(""));
      inputRefs.current[0]?.focus();

      // Reset expiration timer to 5 minutes
      const newExpiry = Date.now() + 300 * 1000;
      sessionStorage.setItem("cv_otp_expiry_time", newExpiry.toString());
      setExpirySeconds(300);

      // Start 60-second resend cooldown
      const newCooldown = Date.now() + 60 * 1000;
      sessionStorage.setItem("cv_resend_cooldown_time", newCooldown.toString());
      setResendCooldown(60);

      setSuccessMsg("A fresh verification code has been sent to your email.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to resend code. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  // Change Email Action
  const handleSaveNewEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newEmailInput.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!clean || !emailRegex.test(clean)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    setEmail(clean);
    sessionStorage.setItem("cv_pending_verify_email", clean);
    setIsChangingEmail(false);
    setNewEmailInput("");
    setErrorMsg(null);
    setSuccessMsg(`Email updated to ${clean}. Click "Resend Code" to receive your code.`);
  };

  return (
    <div className="min-h-[100dvh] bg-[#F8FAFC] flex flex-col justify-center items-center py-4 px-3.5 sm:px-6 selection:bg-blue-500 selection:text-white">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-[440px] w-full p-5 sm:p-7 md:p-8 shadow-xl border border-slate-200/80 relative animate-in fade-in zoom-in-95 duration-200 my-auto">
        
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-3.5 sm:mb-5">
          <div className="relative mb-2">
            <img
              src="/logo.png"
              alt="CloudVault Logo"
              className="w-12 h-12 sm:w-14 sm:h-14 object-contain mix-blend-multiply"
              referrerPolicy="no-referrer"
            />
            <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-1 shadow-sm">
              <Mail className="w-3.5 h-3.5" />
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Verify your email</h1>
          <p className="text-xs text-slate-500 mt-1">
            We sent a verification code to
          </p>
          <div className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-xs font-semibold text-slate-700">
            <span className="font-mono">{maskEmail(email)}</span>
            <button
              type="button"
              onClick={() => {
                setIsChangingEmail(!isChangingEmail);
                setNewEmailInput(email);
              }}
              className="text-blue-600 hover:text-blue-800 text-[11px] underline cursor-pointer ml-1"
            >
              Change
            </button>
          </div>
        </div>

        {/* Change Email Form Modal/Bar */}
        {isChangingEmail && (
          <form onSubmit={handleSaveNewEmail} className="mb-4 p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 animate-in fade-in">
            <label className="block text-[11px] font-semibold text-blue-900">Enter Correct Email</label>
            <div className="flex gap-2">
              <input
                type="email"
                required
                value={newEmailInput}
                onChange={(e) => setNewEmailInput(e.target.value)}
                placeholder="you@domain.com"
                className="flex-1 bg-white border border-blue-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Update
              </button>
              <button
                type="button"
                onClick={() => setIsChangingEmail(false)}
                className="text-slate-500 hover:text-slate-700 px-2 py-1.5 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div role="alert" className="mb-3.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{errorMsg}</span>
          </div>
        )}

        {/* Success Notification */}
        {successMsg && (
          <div role="status" className="mb-3.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span className="leading-relaxed font-medium">{successMsg}</span>
          </div>
        )}

        {/* Successful Verification View */}
        {isVerifiedSuccess ? (
          <div className="space-y-4 py-4 text-center animate-in fade-in">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Email Verified Successfully!</h2>
              <p className="text-xs text-slate-500 mt-1">Your 15 GB CloudVault account is now fully active.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                onSuccess();
                onNavigate("/dashboard");
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerify();
            }}
            className="space-y-4 sm:space-y-5"
          >
            {/* OTP Input Boxes */}
            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-2 text-center">
                Enter {otpLength}-Digit Verification Code
              </label>
              
              <div
                className="flex items-center justify-center gap-1.5 sm:gap-2.5"
                onPaste={handlePaste}
              >
                {otpValues.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    id={`otp-box-${index}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    disabled={isLoading || expirySeconds <= 0}
                    className={`w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-mono font-bold rounded-xl border bg-slate-50 text-slate-900 outline-none transition-all ${
                      expirySeconds <= 0
                        ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                        : digit
                        ? "border-blue-500 bg-blue-50/40 text-blue-900 ring-1 ring-blue-500"
                        : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Countdown & Expiration Indicator */}
            <div className="flex items-center justify-between text-xs px-1">
              <div className="flex items-center gap-1 text-slate-500">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {expirySeconds > 0 ? (
                  <span>
                    Code expires in:{" "}
                    <strong className="font-mono font-bold text-slate-700">
                      {formatTime(expirySeconds)}
                    </strong>
                  </span>
                ) : (
                  <span className="text-rose-600 font-semibold">
                    Code has expired
                  </span>
                )}
              </div>

              {/* Resend Action */}
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || isResending}
                className={`font-semibold transition-colors cursor-pointer flex items-center gap-1 text-xs ${
                  resendCooldown > 0 || isResending
                    ? "text-slate-400 cursor-not-allowed"
                    : "text-blue-600 hover:text-blue-700"
                }`}
              >
                {isResending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : resendCooldown > 0 ? (
                  <span>Resend in {resendCooldown}s</span>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Resend Code</span>
                  </>
                )}
              </button>
            </div>

            {/* Verify Button */}
            <button
              type="submit"
              disabled={isLoading || expirySeconds <= 0 || otpValues.join("").length < otpLength}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 sm:py-3 px-4 rounded-xl text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <span>Verify & Activate Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Secondary Options */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <button
            type="button"
            onClick={() => onNavigate("/signup")}
            className="text-slate-500 hover:text-slate-800 transition-colors cursor-pointer flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Change Details</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate("/login")}
            className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
          >
            Back to Sign In
          </button>
        </div>

        {/* Footer Security Badge */}
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Encrypted 256-bit Supabase Authentication</span>
        </div>

      </div>
    </div>
  );
}
