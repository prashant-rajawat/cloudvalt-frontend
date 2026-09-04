import React, { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase.js";
import { UserProfile, StorageQuota } from "../types/index.js";
import { User, Mail, HardDrive, ShieldCheck, Check, Loader2, AlertCircle, Camera, Upload } from "lucide-react";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  quota: StorageQuota;
  authToken?: string;
  onProfileUpdated: () => void;
  onOpenDeleteAccount?: () => void;
}

export function ProfileModal({ isOpen, onClose, profile, quota, authToken, onProfileUpdated, onOpenDeleteAccount }: ProfileModalProps) {
  const [fullName, setFullName] = useState(profile?.fullName || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || "");
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<{
    file: File;
    dataUrl: string;
    name: string;
    type: string;
  } | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string>("");
  const [isAvatarRemoved, setIsAvatarRemoved] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || "");
      setAvatarUrl(profile.avatarUrl || "");
      setSelectedAvatarFile(null);
      setAvatarPreviewUrl("");
      setIsAvatarRemoved(false);
    }
  }, [profile, isOpen]);

  if (!isOpen) return null;

  const handleAvatarFileChange = (file: File) => {
    setErrorMsg(null);
    setSuccessMsg(false);

    // Validate MIME type
    const validMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    const isImage = file.type.startsWith("image/") || validMimes.some((m) => file.type.toLowerCase().includes(m.split("/")[1]));
    if (!isImage) {
      setErrorMsg("Invalid file type. Please upload a JPEG, PNG, WEBP, or GIF image.");
      return;
    }

    // Validate size limit (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Image size exceeds the 5MB limit. Please choose a smaller image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const dataUrl = event.target.result as string;
        setSelectedAvatarFile({
          file,
          dataUrl,
          name: file.name,
          type: file.type || "image/png",
        });
        setAvatarPreviewUrl(dataUrl);
        setIsAvatarRemoved(false);
      }
    };
    reader.onerror = () => {
      setErrorMsg("Failed to read image file.");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setSelectedAvatarFile(null);
    setAvatarPreviewUrl("");
    setAvatarUrl("");
    setIsAvatarRemoved(true);
    setErrorMsg(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setErrorMsg("Full name must be at least 2 characters long.");
      return;
    }
    if (trimmedName.length > 50) {
      setErrorMsg("Full name cannot exceed 50 characters.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(false);

    try {
      // 1. Upload avatar file if selected
      if (selectedAvatarFile && authToken) {
        const uploadRes = await fetch("/api/auth/avatar", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            avatarData: selectedAvatarFile.dataUrl,
            fileName: selectedAvatarFile.name,
            mimeType: selectedAvatarFile.type,
          }),
        });
        const uploadJson = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok || !uploadJson.success) {
          throw new Error(uploadJson.message || "Failed to upload avatar image.");
        }
      } else if (isAvatarRemoved && authToken) {
        // 2. Remove avatar
        const removeRes = await fetch("/api/auth/profile", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            removeAvatar: true,
          }),
        });
        const removeJson = await removeRes.json().catch(() => ({}));
        if (!removeRes.ok || !removeJson.success) {
          throw new Error(removeJson.message || "Failed to remove avatar.");
        }
      }

      // 3. Update profile details
      if (authToken) {
        const profileRes = await fetch("/api/auth/profile", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            fullName: trimmedName,
            ...(!selectedAvatarFile && !isAvatarRemoved ? { avatarUrl: avatarUrl.trim() || null } : {}),
          }),
        });
        const profileJson = await profileRes.json().catch(() => ({}));
        if (!profileRes.ok || !profileJson.success) {
          throw new Error(profileJson.message || "Failed to update profile.");
        }
      } else {
        const supabase = getSupabaseBrowserClient();
        if (supabase && profile?.id) {
          const { error } = await supabase
            .from("profiles")
            .update({
              full_name: trimmedName,
              avatar_url: isAvatarRemoved ? null : (avatarUrl.trim() || null),
              updated_at: new Date().toISOString(),
            })
            .eq("id", profile.id);
          if (error) throw error;
        }
      }

      setSelectedAvatarFile(null);
      setAvatarPreviewUrl("");
      setIsAvatarRemoved(false);
      setSuccessMsg(true);
      onProfileUpdated();
      setTimeout(() => setSuccessMsg(false), 2500);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const percentUsed = Math.min(100, Math.round((quota.usedBytes / quota.totalBytes) * 100));
  const activeAvatarDisplay = avatarPreviewUrl || (!isAvatarRemoved ? (avatarUrl || profile?.avatarUrl) : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="relative group w-11 h-11 shrink-0">
              <div className="w-full h-full bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-xs text-sm overflow-hidden border border-slate-200">
                {activeAvatarDisplay ? (
                  <img src={activeAvatarDisplay} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  profile?.fullName?.charAt(0)?.toUpperCase() || profile?.email?.charAt(0)?.toUpperCase() || "U"
                )}
              </div>
              <label className="absolute -bottom-1 -right-1 p-1 bg-blue-600 text-white rounded-md shadow border border-white hover:bg-blue-700 cursor-pointer transition-colors flex items-center justify-center" title="Upload avatar">
                <Camera className="w-3 h-3" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAvatarFileChange(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 leading-tight">Account & Profile</h2>
              <p className="text-xs text-slate-500">{profile?.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>Profile updated successfully!</span>
          </div>
        )}

        {/* Real Storage Quota Card */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 mb-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-800 mb-2">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-blue-600" />
              <span>Storage Quota</span>
            </div>
            <span>{percentUsed}% used</span>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                percentUsed > 90 ? "bg-rose-500" : percentUsed > 70 ? "bg-amber-500" : "bg-blue-600"
              }`}
              style={{ width: `${Math.max(percentUsed, 2)}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>{formatBytes(quota.usedBytes)} used</span>
            <span>{formatBytes(quota.totalBytes)} total</span>
          </div>
        </div>

        {/* Profile Edit Form */}
        <form onSubmit={handleUpdate} className="space-y-4">
          {/* Avatar Actions */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60">
            <div className="text-[11px] text-slate-600">
              <span className="font-semibold block text-slate-700">Profile Photo</span>
              <span>JPEG, PNG, WEBP, or GIF (max 5MB)</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-[11px] rounded-lg border border-slate-200 cursor-pointer inline-flex items-center gap-1 shadow-2xs">
                <Upload className="w-3 h-3 text-blue-600" /> Photo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAvatarFileChange(file);
                    e.target.value = "";
                  }}
                />
              </label>
              {activeAvatarDisplay && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your name"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                required
                minLength={2}
                maxLength={50}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email (Read Only)</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="email"
                disabled
                value={profile?.email || ""}
                className="w-full bg-slate-100 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <span>Save Changes</span>
            )}
          </button>
        </form>

        <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>PostgreSQL RLS Active</span>
          </div>

          {onOpenDeleteAccount && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenDeleteAccount();
              }}
              className="text-rose-600 hover:text-rose-700 font-semibold hover:underline cursor-pointer"
            >
              Delete Account
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
