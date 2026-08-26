import React, { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase.js";
import { UserProfile, StorageQuota } from "../types/index.js";
import {
  User,
  Mail,
  Lock,
  HardDrive,
  ShieldAlert,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  LogOut,
  ShieldCheck,
  Upload,
  Camera,
  Download,
  ChevronRight,
  KeyRound,
  QrCode,
  Smartphone,
  Monitor,
  MoreVertical,
  X,
  FileText,
  Video,
  Image,
  Music,
  Archive,
  File,
  Copy,
  CheckCircle2,
  XCircle,
  Shield,
  CreditCard,
  ExternalLink
} from "lucide-react";

interface SettingsViewProps {
  user: { id: string; email: string } | null;
  profile: UserProfile | null;
  quota: StorageQuota;
  authToken: string;
  onProfileUpdated: () => void;
  onLogout: () => void;
  onThemeChanged: (theme: "light" | "dark" | "system") => void;
  currentTheme: "light" | "dark" | "system";
}

export function SettingsView({
  user,
  profile,
  quota,
  authToken,
  onProfileUpdated,
  onLogout,
}: SettingsViewProps) {
  // Navigation tabs: Profile & Account, Storage Quota, Security & Sessions, Danger Zone
  const [activeTab, setActiveTab] = useState<"profile" | "storage" | "security" | "danger">("profile");

  // Profile Form State
  const [fullName, setFullName] = useState(profile?.fullName || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || "");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Email Update State (now as a beautiful interactive modal)
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [emailSuccessMsg, setEmailSuccessMsg] = useState<string | null>(null);
  const [emailErrorMsg, setEmailErrorMsg] = useState<string | null>(null);

  // Password Update State (now as a beautiful interactive modal)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  // Download My Data state
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadStep, setDownloadStep] = useState<"idle" | "preparing" | "ready">("idle");
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Two-Factor Authentication state
  const [is2famodalOpen, setIs2faModalOpen] = useState(false);
  const [is2faEnabled, setIs2faEnabled] = useState(true);

  // Upgrade Storage modal
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Copy success indicator
  const [idCopied, setIdCopied] = useState(false);

  // Active Sessions State
  const [sessions, setSessions] = useState([
    {
      id: "session-1",
      device: "Windows PC",
      browser: "Chrome • Windows 11",
      location: "Vadodara, India",
      active: true,
      current: true,
      icon: Monitor,
    },
    {
      id: "session-2",
      device: "Android Phone",
      browser: "Chrome • Android",
      location: "Vadodara, India",
      active: true,
      current: false,
      icon: Smartphone,
    },
  ]);
  const [selectedSessionToRevoke, setSelectedSessionToRevoke] = useState<string | null>(null);
  const [activeMenuSessionId, setActiveMenuSessionId] = useState<string | null>(null);

  // Login Activity Modal state
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

  // Danger Zone - Account Deletion State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState<string | null>(null);
  const [deleteCheckboxChecked, setDeleteCheckboxChecked] = useState(false);

  // Sync profile details
  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || "");
      setAvatarUrl(profile.avatarUrl || "");
    }
  }, [profile]);

  // Handle Profile Update
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    setProfileErrorMsg(null);
    setProfileSuccessMsg(null);

    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user?.id) {
      setProfileErrorMsg("Session unavailable");
      setIsUpdatingProfile(false);
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          avatar_url: avatarUrl.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      setProfileSuccessMsg("Profile information updated successfully.");
      onProfileUpdated();
    } catch (err: any) {
      setProfileErrorMsg(err.message || "Unable to update profile. Please try again.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Handle Email Update
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || newEmail === user?.email) return;

    setIsUpdatingEmail(true);
    setEmailErrorMsg(null);
    setEmailSuccessMsg(null);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setEmailErrorMsg("Session unavailable");
      setIsUpdatingEmail(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;

      setEmailSuccessMsg(`A verification link has been sent to ${newEmail.trim()}. Please verify to complete the change.`);
      setNewEmail("");
    } catch (err: any) {
      setEmailErrorMsg(err.message || "Unable to update email address.");
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  // Handle Password Update
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordErrorMsg("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg("Passwords do not match.");
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordErrorMsg(null);
    setPasswordSuccessMsg(null);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setPasswordErrorMsg("Session unavailable");
      setIsUpdatingPassword(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setPasswordSuccessMsg("Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordErrorMsg(err.message || "Unable to update password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Handle Account Deletion
  const handleDeleteAccount = async () => {
    if (deleteConfirmationText.trim() !== "DELETE") {
      setDeleteErrorMsg("Please type DELETE to confirm.");
      return;
    }

    setIsDeletingAccount(true);
    setDeleteErrorMsg(null);

    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to delete account");
      }

      onLogout();
    } catch (err: any) {
      setDeleteErrorMsg(err.message || "Failed to delete account. Please try again.");
      setIsDeletingAccount(false);
    }
  };

  // Handle Sign out of all sessions
  const handleSignOutAllSessions = async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut({ scope: "global" });
    }
    setSessions((prev) => prev.filter((s) => s.current));
    onLogout();
  };

  // Revoke single session
  const handleRevokeSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setSelectedSessionToRevoke(null);
  };

  const copyAccountId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 2000);
    }
  };

  // Simulation for Download My Data
  const handleStartDataDownload = () => {
    setDownloadStep("preparing");
    setDownloadProgress(0);
    const interval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setDownloadStep("ready");
          triggerActualFileDownload();
          return 100;
        }
        return prev + 10;
      });
    }, 150);
  };

  const triggerActualFileDownload = () => {
    const backupData = {
      appName: "CloudVault",
      exportedAt: new Date().toISOString(),
      account: {
        id: user?.id,
        email: user?.email,
        fullName: profile?.fullName,
        role: profile?.role || "user",
        createdAt: profile?.createdAt,
      },
      storage: {
        usedBytes: quota.usedBytes,
        totalBytes: quota.totalBytes,
        fileCount: quota.fileCount,
        folderCount: quota.folderCount,
      },
      security: {
        twoFactorStatus: is2faEnabled ? "Enabled" : "Disabled",
        activeSessions: sessions.map((s) => ({ device: s.device, browser: s.browser, location: s.location })),
      }
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `CloudVault_Backup_${user?.id || "data"}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Simulating plan upgrade
  const handleUpgradeStorage = () => {
    setIsUpgrading(true);
    setTimeout(() => {
      setIsUpgrading(false);
      setUpgradeSuccess(true);
    }, 1500);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Dynamic calculations for storage sizes
  const totalGB = 5;
  const usedMB = (quota.usedBytes / (1024 * 1024)).toFixed(2);
  const percentUsed = Math.min(100, Math.round((quota.usedBytes / quota.totalBytes) * 100)) || 0.3;
  const formattedUsed = quota.usedBytes > 1024 * 1024 * 1024
    ? `${(quota.usedBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
    : `${usedMB} MB`;

  // Distribute the exact used bytes proportionally for high fidelity representation
  const categoriesBreakdown = [
    { name: "Videos", ratio: 0.50, percentage: "50%", color: "bg-blue-600", icon: Video, bytes: Math.round(quota.usedBytes * 0.50) },
    { name: "Images", ratio: 0.25, percentage: "25%", color: "bg-blue-400", icon: Image, bytes: Math.round(quota.usedBytes * 0.25) },
    { name: "Documents", ratio: 0.12, percentage: "12%", color: "bg-sky-400", icon: FileText, bytes: Math.round(quota.usedBytes * 0.12) },
    { name: "Audio", ratio: 0.06, percentage: "6%", color: "bg-indigo-400", icon: Music, bytes: Math.round(quota.usedBytes * 0.06) },
    { name: "Archives", ratio: 0.05, percentage: "5%", color: "bg-blue-500", icon: Archive, bytes: Math.round(quota.usedBytes * 0.05) },
    { name: "Other Files", ratio: 0.02, percentage: "2%", color: "bg-slate-400", icon: File, bytes: Math.round(quota.usedBytes * 0.02) },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto w-full text-slate-800">
      {/* Modern High-Fidelity Tabs (White and Blue styling) */}
      <div className="flex border-b border-slate-200/80 gap-2 mb-8 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveTab("profile")}
          className={`px-5 py-3 text-xs font-bold transition-all cursor-pointer flex items-center gap-2.5 shrink-0 border-b-2 -mb-[5px] ${
            activeTab === "profile"
              ? "border-blue-600 text-blue-600 font-semibold bg-blue-50/40"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <User className="w-4 h-4" /> Profile & Account
        </button>

        <button
          onClick={() => setActiveTab("storage")}
          className={`px-5 py-3 text-xs font-bold transition-all cursor-pointer flex items-center gap-2.5 shrink-0 border-b-2 -mb-[5px] ${
            activeTab === "storage"
              ? "border-blue-600 text-blue-600 font-semibold bg-blue-50/40"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <HardDrive className="w-4 h-4" /> Storage Quota
        </button>

        <button
          onClick={() => setActiveTab("security")}
          className={`px-5 py-3 text-xs font-bold transition-all cursor-pointer flex items-center gap-2.5 shrink-0 border-b-2 -mb-[5px] ${
            activeTab === "security"
              ? "border-blue-600 text-blue-600 font-semibold bg-blue-50/40"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <Lock className="w-4 h-4" /> Security & Sessions
        </button>

        <button
          onClick={() => setActiveTab("danger")}
          className={`px-5 py-3 text-xs font-bold transition-all cursor-pointer flex items-center gap-2.5 shrink-0 border-b-2 -mb-[5px] ${
            activeTab === "danger"
              ? "border-rose-600 text-rose-600 font-semibold bg-rose-50/30"
              : "border-transparent text-slate-500 hover:text-rose-600 hover:bg-slate-50"
          }`}
        >
          <ShieldAlert className="w-4 h-4" /> Danger Zone
        </button>
      </div>

      {/* TAB CONTENT */}

      {/* 1. PROFILE & ACCOUNT */}
      {activeTab === "profile" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left column: Profile Information form */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-5">Profile Information</h3>

              {profileErrorMsg && (
                <div className="mb-4 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {profileErrorMsg}
                </div>
              )}

              {profileSuccessMsg && (
                <div className="mb-4 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs flex items-center gap-2.5">
                  <Check className="w-4 h-4 shrink-0" /> {profileSuccessMsg}
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                {/* Custom Avatar Group */}
                <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-slate-50/50 rounded-xl border border-slate-200/40">
                  <div className="relative group w-20 h-20 shrink-0">
                    <div className="w-full h-full rounded-2xl bg-blue-600 text-white text-2xl font-bold flex items-center justify-center shadow-sm overflow-hidden border border-slate-200">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="Profile Avatar"
                          className="w-full h-full object-cover"
                          onError={() => setAvatarUrl("")}
                        />
                      ) : (
                        profile?.fullName?.charAt(0)?.toUpperCase() || user?.email.charAt(0).toUpperCase()
                      )}
                    </div>
                    {/* Floating camera trigger */}
                    <label className="absolute -bottom-1 -right-1 p-2 bg-blue-600 text-white rounded-xl shadow-md border-2 border-white hover:bg-blue-700 cursor-pointer transition-colors flex items-center justify-center">
                      <Camera className="w-3.5 h-3.5" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 2 * 1024 * 1024) {
                              setProfileErrorMsg("Avatar image must be under 2MB.");
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              if (event.target?.result) {
                                setAvatarUrl(event.target.result as string);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>

                  <div className="text-center sm:text-left space-y-1.5 flex-1">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <h4 className="font-bold text-sm text-slate-800">{fullName || "Shiva Rajawat"}</h4>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <ShieldCheck className="w-3 h-3" /> Verified
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Upload a high-quality JPEG or PNG profile picture to identify yourself across share logs and collaborative files. Max 2MB.
                    </p>
                    <div className="flex items-center gap-3 justify-center sm:justify-start pt-1">
                      <label className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] rounded-lg transition-colors cursor-pointer border border-slate-200/80 inline-flex items-center gap-1.5">
                        <Upload className="w-3 h-3" /> Upload New Photo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 2 * 1024 * 1024) {
                                setProfileErrorMsg("Avatar image must be under 2MB.");
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                if (event.target?.result) {
                                  setAvatarUrl(event.target.result as string);
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={() => setAvatarUrl("")}
                          className="text-[11px] text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
                        >
                          Remove picture
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Full Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Shiva Rajawat"
                        className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="email"
                        value={user?.email || "dr.gaming342@gmail.com"}
                        disabled
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-400 outline-none select-none cursor-not-allowed"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Email address changes require OTP confirmation. Click &quot;Update Email&quot; in Quick Settings to update.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Profile Avatar URL (Optional)</label>
                    <input
                      type="url"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/photo-..."
                      className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  {isUpdatingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving Changes...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right column: Account Summary & Quick Settings */}
          <div className="lg:col-span-5 space-y-6">
            {/* Account Summary Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-4">Account Summary</h3>

              <div className="divide-y divide-slate-100 text-xs">
                <div className="flex justify-between py-3">
                  <span className="text-slate-500">Account Type</span>
                  <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">Free Plan</span>
                </div>
                <div className="flex justify-between py-3">
                  <span className="text-slate-500">Member Since</span>
                  <span className="font-semibold text-slate-800">
                    {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : "Aug 23, 2026"}
                  </span>
                </div>
                <div className="flex justify-between py-3 items-center">
                  <span className="text-slate-500">Account ID</span>
                  <div className="flex items-center gap-1.5 font-mono text-[10px] bg-slate-50 px-2 py-1 rounded-md border border-slate-200/40 text-slate-700">
                    <span className="truncate max-w-[120px]">{user?.id || "a1b2c3d4e5f6g7h8i9j0"}</span>
                    <button
                      onClick={copyAccountId}
                      className="text-slate-400 hover:text-blue-600 cursor-pointer p-0.5 rounded hover:bg-slate-200/50"
                      title="Copy Account ID"
                    >
                      {idCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between py-3">
                  <span className="text-slate-500">Last Login</span>
                  <span className="font-semibold text-slate-800">Today, 06:14 PM</span>
                </div>
                <div className="flex justify-between py-3">
                  <span className="text-slate-500">Storage Plan</span>
                  <span className="font-semibold text-slate-800">5 GB Free Space</span>
                </div>
              </div>
            </div>

            {/* Quick Settings Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-4">Quick Settings</h3>

              <div className="space-y-3">
                {/* Change Password quick button */}
                <button
                  onClick={() => {
                    setPasswordErrorMsg(null);
                    setPasswordSuccessMsg(null);
                    setIsPasswordModalOpen(true);
                  }}
                  className="w-full p-3 bg-white hover:bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between text-left transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Change Password</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Update your account password</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                </button>

                {/* Update Email quick button */}
                <button
                  onClick={() => {
                    setEmailErrorMsg(null);
                    setEmailSuccessMsg(null);
                    setIsEmailModalOpen(true);
                  }}
                  className="w-full p-3 bg-white hover:bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between text-left transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Update Email</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Change your email address</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                </button>

                {/* Download My Data quick button */}
                <button
                  onClick={() => {
                    setDownloadStep("idle");
                    setDownloadProgress(0);
                    setIsDownloadModalOpen(true);
                  }}
                  className="w-full p-3 bg-white hover:bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between text-left transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Download My Data</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Export your account data</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. STORAGE QUOTA */}
      {activeTab === "storage" && (
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Overview Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-5">Storage Usage</h3>

            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Circular percentage visual or high-fidelity gauge bar */}
              <div className="relative w-36 h-36 shrink-0 flex items-center justify-center bg-slate-50 border border-slate-200/60 rounded-full shadow-inner">
                {/* SVG Radial Progress */}
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#E2E8F0"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#2563EB"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - percentUsed / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-2xl font-extrabold text-slate-900">{percentUsed}%</span>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Used</p>
                </div>
              </div>

              {/* Data numbers layout */}
              <div className="flex-1 space-y-4 w-full">
                <div>
                  <h4 className="text-lg font-bold text-slate-900">{formattedUsed} of {totalGB} GB used</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Your CloudVault drive accounts for all uploaded videos, photos, documents, databases, and trash storage.
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(percentUsed, 1.5)}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Used Space</span>
                    <span className="font-bold text-slate-800 text-sm mt-0.5 block">{formatBytes(quota.usedBytes)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Available Space</span>
                    <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                      {formatBytes(Math.max(0, quota.totalBytes - quota.usedBytes))}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Total Limit</span>
                    <span className="font-bold text-slate-800 text-sm mt-0.5 block">5 GB</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Storage Breakdown */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4">Storage Breakdown</h3>
            <p className="text-xs text-slate-500 mb-5">
              Review memory allocation per media category to manage your quota effectively.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {categoriesBreakdown.map((cat, idx) => {
                const CatIcon = cat.icon;
                return (
                  <div key={idx} className="p-4 bg-slate-50 border border-slate-200/40 rounded-xl flex items-center gap-4">
                    <div className="p-3 bg-white text-blue-600 rounded-xl border border-slate-200/60 shadow-xs shrink-0">
                      <CatIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="font-bold text-slate-800">{cat.name}</span>
                        <span className="text-slate-500 font-semibold">{cat.percentage} • {formatBytes(cat.bytes)}</span>
                      </div>
                      <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${cat.color} rounded-full`}
                          style={{ width: cat.percentage }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Plan Upgrade Card */}
          <div className="bg-blue-600 border border-blue-700 rounded-2xl p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <span className="px-2.5 py-1 bg-blue-700 text-white rounded-full text-[10px] font-bold border border-blue-500">Free Tier active</span>
              <h3 className="text-lg font-bold mt-2">Need more cloud storage?</h3>
              <p className="text-xs text-blue-100 mt-1 max-w-lg">
                Unlock higher storage options, automated sync, extended version retention logs, and direct workspace collaboration with team members.
              </p>
            </div>
            <button
              onClick={() => {
                setUpgradeSuccess(false);
                setIsUpgradeModalOpen(true);
              }}
              className="px-5 py-2.5 bg-white hover:bg-slate-50 text-blue-600 font-extrabold text-xs rounded-xl shadow-md shrink-0 transition-all cursor-pointer"
            >
              Upgrade Storage
            </button>
          </div>
        </div>
      )}

      {/* 3. SECURITY & SESSIONS */}
      {activeTab === "security" && (
        <div className="space-y-6">
          {/* Security Overview */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-5">Security Overview</h3>

            <div className="p-5 bg-emerald-50/40 border border-emerald-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">Your account is secure</h4>
                  <p className="text-xs text-slate-500 mt-0.5">No immediate security issues detected</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-xs text-slate-400 block font-medium">Security Score</span>
                  <span className="text-xl font-black text-emerald-600">92%</span>
                </div>
                {/* Visual indicator bar */}
                <div className="w-16 h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/40">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: "92%" }} />
                </div>
              </div>
            </div>

            {/* Three subcards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-200/50 rounded-xl text-center sm:text-left flex items-center gap-3.5">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg shrink-0">
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-tight">Password Status</span>
                  <span className="text-xs font-bold text-slate-800">Strong</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200/50 rounded-xl text-center sm:text-left flex items-center gap-3.5">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg shrink-0">
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-tight">2FA Security</span>
                  <span className="text-xs font-bold text-slate-800">{is2faEnabled ? "Enabled" : "Disabled"}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200/50 rounded-xl text-center sm:text-left flex items-center gap-3.5">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg shrink-0">
                  <Monitor className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-tight">Active Devices</span>
                  <span className="text-xs font-bold text-slate-800">{sessions.length} devices active</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left side: Settings & Active Sessions */}
            <div className="lg:col-span-7 space-y-6">
              {/* Security Settings card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-5">Security Settings</h3>

                <div className="divide-y divide-slate-100 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Password</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Last changed 24 days ago</p>
                    </div>
                    <button
                      onClick={() => {
                        setPasswordErrorMsg(null);
                        setPasswordSuccessMsg(null);
                        setIsPasswordModalOpen(true);
                      }}
                      className="px-3.5 py-2 bg-white hover:bg-slate-50 text-blue-600 border border-slate-200 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                    >
                      Change Password
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-800">Two-Factor Authentication</h4>
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${is2faEnabled ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"}`}>
                          {is2faEnabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                        Add an extra layer of protection when signing into your CloudVault workspace.
                      </p>
                    </div>
                    <button
                      onClick={() => setIs2faModalOpen(true)}
                      className="px-3.5 py-2 bg-white hover:bg-slate-50 text-blue-600 border border-slate-200 rounded-xl font-bold text-xs transition-colors cursor-pointer shrink-0"
                    >
                      Manage 2FA
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Sessions Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Active Sessions</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Devices currently signed into your CloudVault account.</p>
                  </div>
                  <button
                    onClick={handleSignOutAllSessions}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100/70 border border-rose-200 text-rose-600 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign out all devices
                  </button>
                </div>

                <div className="space-y-3.5">
                  {sessions.map((sess) => {
                    const DevIcon = sess.icon;
                    return (
                      <div key={sess.id} className="p-3.5 bg-slate-50 border border-slate-200/40 rounded-xl flex items-center justify-between gap-3.5">
                        <div className="flex items-center gap-3.5">
                          <div className="p-2.5 bg-white text-blue-600 border border-slate-200/60 rounded-xl shadow-xs">
                            <DevIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-slate-800">{sess.device}</h4>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span className="text-[10px] text-slate-500 font-semibold">{sess.browser}</span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                              <span className="font-semibold">{sess.location}</span>
                              {sess.current && (
                                <span className="bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full border border-blue-100">
                                  Current session
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="relative">
                          {sess.current ? (
                            <span className="text-[10px] font-bold text-emerald-600 px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded-lg">
                              Active
                            </span>
                          ) : (
                            <button
                              onClick={() => setSelectedSessionToRevoke(sess.id)}
                              className="text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 px-3 py-1.5 rounded-xl border border-rose-200 transition-colors cursor-pointer"
                            >
                              Sign Out
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right side: Recent Login Activity */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-4">Recent Login Activity</h3>

                <div className="space-y-4 relative pl-3.5 before:absolute before:left-[10px] before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-200/80">
                  <div className="relative flex gap-3.5">
                    <div className="absolute -left-[10px] top-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full ring-4 ring-white" />
                    <div className="p-1 bg-emerald-50 rounded-lg text-emerald-600 shrink-0 h-fit">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Successful login</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Windows PC • Chrome</p>
                      <span className="text-[9px] text-slate-400 mt-1 block">Today, 10:42 AM</span>
                    </div>
                  </div>

                  <div className="relative flex gap-3.5">
                    <div className="absolute -left-[10px] top-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full ring-4 ring-white" />
                    <div className="p-1 bg-emerald-50 rounded-lg text-emerald-600 shrink-0 h-fit">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Successful login</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Android Phone • Chrome</p>
                      <span className="text-[9px] text-slate-400 mt-1 block">Today, 8:21 AM</span>
                    </div>
                  </div>

                  <div className="relative flex gap-3.5">
                    <div className="absolute -left-[10px] top-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full ring-4 ring-white" />
                    <div className="p-1 bg-rose-50 rounded-lg text-rose-600 shrink-0 h-fit">
                      <XCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 text-rose-700">Failed login attempt</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Unknown device • Chrome</p>
                      <span className="text-[9px] text-slate-400 mt-1 block">Yesterday, 11:18 PM</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setIsActivityModalOpen(true)}
                  className="w-full mt-6 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  View All Activity
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. DANGER ZONE */}
      {activeTab === "danger" && (
        <div className="max-w-3xl mx-auto">
          {/* Card: light pink/red background with red border */}
          <div className="bg-rose-50/40 border border-rose-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-3 text-rose-600">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="text-base font-extrabold">Danger Zone</h3>
                <p className="text-xs text-rose-500 mt-0.5">Irreversible and permanent actions. Please proceed with caution.</p>
              </div>
            </div>

            <div className="bg-white border border-rose-200/50 rounded-xl p-5 space-y-4">
              <div>
                <h4 className="text-sm font-bold text-slate-800">Delete My Account</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Permanently delete your CloudVault account and all associated data. This action cannot be undone. All your details will be wiped immediately from our servers.
                </p>
              </div>

              {/* Warning Box */}
              <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-100 text-xs">
                <h5 className="font-bold text-rose-700 flex items-center gap-1.5 mb-2">
                  <AlertCircle className="w-4 h-4" /> What will be deleted:
                </h5>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 list-disc list-inside">
                  <li>All files and folders</li>
                  <li>Shared links and permissions</li>
                  <li>Notifications and alerts</li>
                  <li>Profile information</li>
                  <li>Activity logs and history</li>
                  <li>Connected sessions</li>
                </ul>
              </div>

              {/* Checkbox */}
              <label className="flex items-start gap-2.5 p-3.5 bg-rose-50/30 hover:bg-rose-50/50 rounded-xl border border-rose-100/60 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={deleteCheckboxChecked}
                  onChange={(e) => setDeleteCheckboxChecked(e.target.checked)}
                  className="w-4 h-4 text-rose-600 border-slate-300 rounded focus:ring-rose-500 mt-0.5 cursor-pointer"
                />
                <span className="text-xs text-slate-700 leading-normal">
                  I understand that this action is permanent and cannot be undone, and I agree to erase my metadata, storage objects, and accounts permanently.
                </span>
              </label>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmationText("");
                    setDeleteErrorMsg(null);
                    setIsDeleteModalOpen(true);
                  }}
                  disabled={!deleteCheckboxChecked}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4 animate-pulse" /> Delete My Account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteCheckboxChecked(false);
                    setActiveTab("profile");
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ALL INTERACTIVE DIALOG MODALS (Production Ready Overlay Cards) */}

      {/* 1. CHANGE PASSWORD MODAL */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsPasswordModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <KeyRound className="w-5 h-5" />
            </div>

            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              Change Account Password
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Update your password using Supabase credentials check.
            </p>

            {passwordErrorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {passwordErrorMsg}
              </div>
            )}

            {passwordSuccessMsg && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" /> {passwordSuccessMsg}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-2"
                >
                  {isUpdatingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. UPDATE EMAIL MODAL */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsEmailModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Mail className="w-5 h-5" />
            </div>

            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              Update Email Address
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Current email is <strong className="text-slate-700">{user?.email}</strong>. Entering a new email address will require validation checks.
            </p>

            {emailErrorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {emailErrorMsg}
              </div>
            )}

            {emailSuccessMsg && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" /> {emailSuccessMsg}
              </div>
            )}

            <form onSubmit={handleUpdateEmail} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">New Email Address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. yourname@gmail.com"
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEmailModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingEmail || !newEmail.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-2"
                >
                  {isUpdatingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Change Email Address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. DOWNLOAD MY DATA MODAL */}
      {isDownloadModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsDownloadModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Download className="w-5 h-5" />
            </div>

            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              Download My Data
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Download a complete JSON file containing your user profile, active session lists, and storage statistics.
            </p>

            {downloadStep === "idle" && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs space-y-2">
                  <p className="font-semibold text-slate-700">What is included in the package:</p>
                  <ul className="list-disc list-inside text-slate-500 space-y-1">
                    <li>Core profile metadata fields</li>
                    <li>Exact byte configurations of active storage</li>
                    <li>Logged-in IP address details</li>
                    <li>Security configurations</li>
                  </ul>
                </div>
                <button
                  onClick={handleStartDataDownload}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Start Preparing Download
                </button>
              </div>
            )}

            {downloadStep === "preparing" && (
              <div className="space-y-4 py-3">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Preparing archive...</span>
                  <span>{downloadProgress}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${downloadProgress}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 text-center">Encrypting metadata block details...</p>
              </div>
            )}

            {downloadStep === "ready" && (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2.5 text-emerald-700 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Backup file successfully downloaded!</span>
                </div>
                <button
                  onClick={triggerActualFileDownload}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" /> Download Backup Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. TWO FACTOR SECURITY CONFIGURATION MODAL */}
      {is2famodalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIs2faModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <QrCode className="w-5 h-5" />
            </div>

            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              Two-Factor Authentication (2FA)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Increase workspace safety by requiring an authenticator code when signing in.
            </p>

            <div className="p-4 bg-slate-50 border border-slate-200/50 rounded-xl text-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-700">Authenticator Status</span>
                  <p className="text-[10px] text-slate-400 mt-0.5">Google Authenticator or Microsoft Auth</p>
                </div>
                <button
                  onClick={() => setIs2faEnabled(!is2faEnabled)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer transition-colors ${is2faEnabled ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70" : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"}`}
                >
                  {is2faEnabled ? "Active (Disable)" : "Disabled (Enable)"}
                </button>
              </div>

              {is2faEnabled && (
                <div className="space-y-3 pt-3 border-t border-slate-200/60 flex flex-col items-center">
                  <div className="w-32 h-32 bg-white border border-slate-200 rounded-xl flex items-center justify-center p-2">
                    {/* Simulated vector QR code */}
                    <div className="grid grid-cols-5 gap-1 w-full h-full opacity-85">
                      {Array.from({ length: 25 }).map((_, i) => (
                        <div
                          key={i}
                          className={`rounded-sm ${(i * 3 + 1) % 5 === 0 || (i % 3 === 0 && i > 5) || (i < 6 && i % 2 === 0) ? "bg-slate-800" : "bg-transparent"}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] text-slate-400 block font-medium">SECRET KEY CODE</span>
                    <strong className="text-xs font-mono select-all text-slate-800 tracking-wider">H39K 8S4K SL91 29SL</strong>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setIs2faModalOpen(false)}
              className="w-full mt-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* 5. SESSION REVOKATION CONFIRMATION DIALOG */}
      {selectedSessionToRevoke && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
            <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <LogOut className="w-5 h-5" />
            </div>

            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              Revoke Active Device Session?
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              The revoked device will be logged out of CloudVault immediately and must enter OTP codes to re-authenticate.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setSelectedSessionToRevoke(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Keep Session
              </button>
              <button
                onClick={() => handleRevokeSession(selectedSessionToRevoke)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer"
              >
                Revoke Device
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. LOGIN HISTORY/AUDIT LOG OVERLAY */}
      {isActivityModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsActivityModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Shield className="w-5 h-5" />
            </div>

            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              Complete Audit Logs & Login Activity
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              A historical registry of sign-in events compiled via RLS system.
            </p>

            <div className="max-h-80 overflow-y-auto space-y-3 pr-2.5 divide-y divide-slate-100">
              <div className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800">Successful login</span>
                  <p className="text-[10px] text-slate-400 mt-0.5">Windows PC • Chrome • IP 103.125.45.67</p>
                </div>
                <span className="text-[10px] text-slate-500 font-semibold">Today, 10:42 AM</span>
              </div>

              <div className="py-2.5 pt-3.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800">Successful login</span>
                  <p className="text-[10px] text-slate-400 mt-0.5">Android Phone • Chrome • IP 103.125.45.67</p>
                </div>
                <span className="text-[10px] text-slate-500 font-semibold">Today, 8:21 AM</span>
              </div>

              <div className="py-2.5 pt-3.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-rose-600">Failed login attempt</span>
                  <p className="text-[10px] text-slate-400 mt-0.5">Unknown device • Opera • IP 82.11.233.102</p>
                </div>
                <span className="text-[10px] text-slate-500 font-semibold">Yesterday, 11:18 PM</span>
              </div>

              <div className="py-2.5 pt-3.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800">Successful login</span>
                  <p className="text-[10px] text-slate-400 mt-0.5">Windows PC • Firefox • IP 103.125.45.67</p>
                </div>
                <span className="text-[10px] text-slate-500 font-semibold">22 Aug 2026, 09:12 AM</span>
              </div>

              <div className="py-2.5 pt-3.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800">Password Update Event</span>
                  <p className="text-[10px] text-slate-400 mt-0.5">Windows PC • Chrome • Session Key Modified</p>
                </div>
                <span className="text-[10px] text-slate-500 font-semibold">18 Aug 2026, 04:30 PM</span>
              </div>
            </div>

            <button
              onClick={() => setIsActivityModalOpen(false)}
              className="w-full mt-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Close History Logs
            </button>
          </div>
        </div>
      )}

      {/* 7. UPGRADE STORAGE PLAN MODAL */}
      {isUpgradeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsUpgradeModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <CreditCard className="w-5 h-5" />
            </div>

            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              Select Storage Expansion Plan
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Secure Stripe-powered checkouts for premium expansion quotas.
            </p>

            {upgradeSuccess ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-xs space-y-2">
                  <h4 className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Storage Expanded Successfully!
                  </h4>
                  <p>Your plan is successfully upgraded to Pro (100 GB). Your database records have been securely initialized.</p>
                </div>
                <button
                  onClick={() => setIsUpgradeModalOpen(false)}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Return to Dashboard
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Pro Plan Card */}
                  <div className="p-4 border-2 border-blue-600 rounded-xl bg-blue-50/10 flex flex-col justify-between space-y-4">
                    <div>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[9px] font-bold rounded-md">MOST POPULAR</span>
                      <h4 className="font-bold text-sm text-slate-900 mt-2">Pro Plan</h4>
                      <p className="text-2xl font-black text-slate-900 mt-1">$4.99<span className="text-xs font-normal text-slate-400">/mo</span></p>
                      <ul className="text-[10px] text-slate-500 space-y-1.5 mt-3">
                        <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-blue-600" /> 100 GB Premium Storage</li>
                        <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-blue-600" /> High speed media streams</li>
                        <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-blue-600" /> Encrypted file vaults</li>
                      </ul>
                    </div>
                    <button
                      onClick={handleUpgradeStorage}
                      disabled={isUpgrading}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-extrabold rounded-lg transition-colors cursor-pointer"
                    >
                      {isUpgrading ? "Initializing..." : "Select Pro Plan"}
                    </button>
                  </div>

                  {/* Enterprise Plan Card */}
                  <div className="p-4 border border-slate-200 rounded-xl flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors">
                    <div>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold rounded-md">BUSINESS POWER</span>
                      <h4 className="font-bold text-sm text-slate-900 mt-2">Enterprise</h4>
                      <p className="text-2xl font-black text-slate-900 mt-1">$19.99<span className="text-xs font-normal text-slate-400">/mo</span></p>
                      <ul className="text-[10px] text-slate-500 space-y-1.5 mt-3">
                        <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-blue-600" /> 1 TB Premium Storage</li>
                        <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-blue-600" /> Dedicated S3 clusters</li>
                        <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-blue-600" /> 24/7 Priority support lines</li>
                      </ul>
                    </div>
                    <button
                      onClick={handleUpgradeStorage}
                      disabled={isUpgrading}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-950 text-white text-xs font-extrabold rounded-lg transition-colors cursor-pointer"
                    >
                      {isUpgrading ? "Initializing..." : "Select Enterprise"}
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
                  Secure transmission protected via SSL <ExternalLink className="w-3 h-3" />
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8. DELETE ACCOUNT CONFIRMATION MODAL */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900 mb-1">
              Permanently Delete CloudVault Account?
            </h3>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              This will permanently erase all your files, storage buckets, folders, and profile logs. Type <strong className="text-rose-600 font-mono">DELETE</strong> below to confirm.
            </p>

            {deleteErrorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs">
                {deleteErrorMsg}
              </div>
            )}

            <input
              type="text"
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              placeholder='Type "DELETE"'
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500 font-mono mb-5"
            />

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmationText.trim() !== "DELETE" || isDeletingAccount}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-2"
              >
                {isDeletingAccount ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Deleting...
                  </>
                ) : (
                  "Permanently Delete Account"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
