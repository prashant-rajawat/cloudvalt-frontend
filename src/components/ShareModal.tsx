import React, { useState, useEffect } from "react";
import { createShareLink, fetchMyShares, revokeShareLink, updateShareLink } from "../lib/api.js";
import { FileItem, FolderItem } from "../types/index.js";
import { logUserActivity } from "../lib/activity.js";
import { createNotification } from "../lib/notifications.js";
import { Share2, Link as LinkIcon, Copy, Check, Trash2, Globe, Shield, Loader2, AlertCircle, Clock } from "lucide-react";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetItem: { type: "file" | "folder"; item: FileItem | FolderItem } | null;
  authToken: string;
}

export function ShareModal({ isOpen, onClose, targetItem, authToken }: ShareModalProps) {
  const [permission, setPermission] = useState<"viewer" | "editor">("viewer");
  const [grantedEmail, setGrantedEmail] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [expirationOption, setExpirationOption] = useState<string>("never");
  const [createdShareUrl, setCreatedShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [existingShares, setExistingShares] = useState<any[]>([]);

  // Password Protection State
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && authToken && targetItem) {
      loadShares();
      setCreatedShareUrl(null);
      setCopied(false);
      setCopiedShareId(null);
      setErrorMsg(null);
      setSuccessMsg(null);
      setGrantedEmail("");
      setPasswordEnabled(false);
      setPassword("");
      setConfirmPassword("");
    }
  }, [isOpen, targetItem, authToken]);

  const loadShares = async () => {
    try {
      const res = await fetchMyShares(authToken);
      if (res.success) {
        const itemShares = res.shares.filter((s: any) =>
          targetItem?.type === "file" ? s.file_id === targetItem.item.id : s.folder_id === targetItem.item.id
        );
        setExistingShares(itemShares);
      }
    } catch (err) {
      console.warn("Failed to load existing shares:", err);
    }
  };

  if (!isOpen || !targetItem) return null;

  const calculateExpiresAt = (option: string) => {
    if (option === "never") return null;
    const now = new Date();
    if (option === "1day") now.setDate(now.getDate() + 1);
    else if (option === "7days") now.setDate(now.getDate() + 7);
    else if (option === "30days") now.setDate(now.getDate() + 30);
    return now.toISOString();
  };

  const handleGenerateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (passwordEnabled) {
        if (password.length < 6) {
          setErrorMsg("Password must be at least 6 characters.");
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setErrorMsg("Passwords do not match.");
          setIsLoading(false);
          return;
        }
      }

      const payload: any = {
        permission,
        is_public_link: isPublic,
        expires_at: calculateExpiresAt(expirationOption),
        password_enabled: passwordEnabled,
        password: passwordEnabled ? password : null,
      };

      if (targetItem.type === "file") {
        payload.file_id = targetItem.item.id;
      } else {
        payload.folder_id = targetItem.item.id;
      }

      if (grantedEmail.trim()) {
        const emailTrim = grantedEmail.trim().toLowerCase();
        // Check duplicate
        const alreadyExists = existingShares.some(
          (s) => s.granted_to_email && s.granted_to_email.toLowerCase() === emailTrim
        );
        if (alreadyExists) {
          setErrorMsg("This user already has access to this item.");
          setIsLoading(false);
          return;
        }
        payload.granted_to_email = emailTrim;
      }

      const res = await createShareLink(authToken, payload);
      if (res.success && res.share) {
        const origin = window.location.origin;
        const link = `${origin}/share/${res.share.share_token}`;
        setCreatedShareUrl(link);
        
        if (payload.granted_to_email) {
          if (res.emailSent) {
            setSuccessMsg("Shared successfully and email sent.");
            setErrorMsg(null);
          } else {
            setSuccessMsg("Share created, but email could not be sent.");
            setErrorMsg(res.emailError || "Email could not be delivered by the mail server. You can copy the link below and share it directly.");
          }
        } else {
          setSuccessMsg("Share link created successfully!");
          setErrorMsg(null);
        }

        // Log Activity and Notification
        if (targetItem.item.ownerId) {
          logUserActivity(
            targetItem.item.ownerId,
            grantedEmail.trim() ? "share" : "create_link",
            targetItem.type,
            targetItem.item.name
          );
          createNotification(
            targetItem.item.ownerId,
            "sharing",
            grantedEmail.trim() ? "Item Shared" : "Public Link Created",
            grantedEmail.trim()
              ? `You shared ${targetItem.item.name} with ${grantedEmail.trim()}`
              : `Created public share link for ${targetItem.item.name}`
          );
        }

        setGrantedEmail("");
        loadShares();
      } else {
        throw new Error(res.message || "Could not generate share link");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create share link");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setSuccessMsg("Link copied to clipboard!");
    setTimeout(() => {
      setCopied(false);
      setSuccessMsg(null);
    }, 2500);
  };

  const handleRevoke = async (shareId: string) => {
    try {
      await revokeShareLink(authToken, shareId);
      loadShares();
      if (createdShareUrl?.includes(shareId)) {
        setCreatedShareUrl(null);
      }
      setSuccessMsg("Access removed.");
      setTimeout(() => setSuccessMsg(null), 2000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to revoke share");
    }
  };

  const handleTogglePermission = async (share: any) => {
    const newPerm = share.permission === "viewer" ? "editor" : "viewer";
    try {
      await updateShareLink(authToken, share.id, { permission: newPerm });
      loadShares();
      setSuccessMsg(`Permission updated to ${newPerm}.`);
      setTimeout(() => setSuccessMsg(null), 2000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update permission");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-xs">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 leading-tight">
                Share {targetItem.type === "file" ? "File" : "Folder"}
              </h2>
              <p className="text-xs text-slate-500 truncate max-w-xs">{targetItem.item.name}</p>
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
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleGenerateShare} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Share with People (Email)</label>
            <input
              type="email"
              placeholder="collaborator@example.com"
              value={grantedEmail}
              onChange={(e) => setGrantedEmail(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Permission</label>
              <select
                value={permission}
                onChange={(e: any) => setPermission(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="viewer">Viewer (Read & Download)</option>
                <option value="editor">Editor (Full Access)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Link Expiration</label>
              <select
                value={expirationOption}
                onChange={(e) => setExpirationOption(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="never">Never expires</option>
                <option value="1day">1 Day</option>
                <option value="7days">7 Days</option>
                <option value="30days">30 Days</option>
              </select>
            </div>
          </div>
          
          {/* PASSWORD PROTECTION SECTION */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="passwordEnabled"
                checked={passwordEnabled}
                onChange={(e) => setPasswordEnabled(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <label htmlFor="passwordEnabled" className="text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-blue-500" />
                Require password to access this file
              </label>
            </div>

            {passwordEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-[13px] text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-[10px] font-bold uppercase tracking-wider"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-[13px] text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-[10px] text-slate-500 sm:col-span-2 px-1">
                  Password must be at least 6 characters. Confirm password must match.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 px-1">
            <input
              type="checkbox"
              id="isPublicCheck"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <label htmlFor="isPublicCheck" className="text-xs text-slate-600 cursor-pointer">
              Enable public link access for anyone with the URL
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Share...</span>
              </>
            ) : (
              <>
                <LinkIcon className="w-4 h-4" />
                <span>Create Share / Send Access</span>
              </>
            )}
          </button>
        </form>

        {/* Display newly created share link */}
        {createdShareUrl && (
          <div className="mt-4 p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                Share Link Ready
              </span>
              <span className="text-[11px] text-blue-600 font-medium">Valid token</span>
            </div>
            <div className="flex items-center gap-2 bg-white border border-blue-200 rounded-lg p-1.5 pl-3">
              <input
                type="text"
                readOnly
                value={createdShareUrl}
                className="w-full text-xs text-slate-700 bg-transparent outline-none truncate"
              />
              <button
                onClick={() => handleCopy(createdShareUrl)}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-blue-700 flex items-center gap-1 transition-all shrink-0 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>
        )}

        {/* People with Access & Active Shares */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <h4 className="text-xs font-semibold text-slate-700 mb-2">People with Access & Links</h4>
          {existingShares.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No shares created for this item yet.</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {existingShares.map((s) => {
                const sUrl = `${window.location.origin}/share/${s.share_token}`;
                const isItemCopied = copiedShareId === s.id;
                return (
                  <div key={s.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-slate-800 truncate">
                        {s.granted_to_email || (s.is_public_link ? "Anyone with public link" : "Restricted Link")}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Permission: <span className="font-medium text-slate-600 uppercase">{s.permission}</span>
                        {s.expires_at ? ` • Expires: ${new Date(s.expires_at).toLocaleDateString()}` : " • Never expires"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(sUrl);
                          setCopiedShareId(s.id);
                          setTimeout(() => setCopiedShareId(null), 2000);
                        }}
                        className="px-2 py-1 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 rounded-lg text-[11px] font-medium shadow-2xs cursor-pointer flex items-center gap-1"
                        title="Copy Link"
                      >
                        {isItemCopied ? <Check className="w-3 h-3 text-emerald-600" /> : null}
                        <span>{isItemCopied ? "Copied!" : "Copy"}</span>
                      </button>
                      <button
                        onClick={() => handleTogglePermission(s)}
                        className="px-2 py-1 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 rounded-lg text-[11px] font-medium shadow-2xs cursor-pointer"
                        title="Change Permission"
                      >
                        {s.permission === "viewer" ? "Make Editor" : "Make Viewer"}
                      </button>
                      <button
                        onClick={() => handleRevoke(s.id)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 cursor-pointer"
                        title="Remove Access"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-blue-500" />
            <span>RLS Token-based Access Protection</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 font-medium">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

