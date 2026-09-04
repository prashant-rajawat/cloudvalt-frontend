import React, { useState, useEffect, useCallback } from "react";
import { 
  createShareLink, 
  fetchAccessList, 
  revokeShareLink, 
  updateShareLink,
  resendShareInvitation
} from "../lib/api.js";
import { FileItem, FolderItem } from "../types/index.js";
import { logUserActivity } from "../lib/activity.js";
import { createNotification } from "../lib/notifications.js";
import { 
  Share2, 
  Link as LinkIcon, 
  Copy, 
  Check, 
  Trash2, 
  Globe, 
  Shield, 
  Loader2, 
  AlertCircle, 
  Clock, 
  User, 
  Users, 
  Lock, 
  X, 
  Mail, 
  ChevronDown, 
  Settings2,
  FileText,
  Folder,
  Calendar,
  Sparkles,
  Key
} from "lucide-react";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetItem: { type: "file" | "folder"; item: FileItem | FolderItem } | null;
  authToken: string;
}

interface AccessOwner {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  role: string;
}

interface AccessCollaborator {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  permission: "viewer" | "editor";
  shareToken: string;
  expiresAt: string | null;
  isExpired: boolean;
  passwordEnabled: boolean;
  accessType: "direct";
  createdAt: string;
}

interface AccessPublicLink {
  id: string;
  permission: "viewer" | "editor";
  shareToken: string;
  expiresAt: string | null;
  isExpired: boolean;
  passwordEnabled: boolean;
  accessType: "public";
  createdAt: string;
}

export function ShareModal({ isOpen, onClose, targetItem, authToken }: ShareModalProps) {
  // Invite Form State
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermission, setInvitePermission] = useState<"viewer" | "editor">("viewer");
  const [inviteExpiration, setInviteExpiration] = useState<string>("never");
  const [showAdvancedInvite, setShowAdvancedInvite] = useState(false);

  // Invite Password Protection State
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // People with Access State
  const [owner, setOwner] = useState<AccessOwner | null>(null);
  const [collaborators, setCollaborators] = useState<AccessCollaborator[]>([]);
  const [publicLink, setPublicLink] = useState<AccessPublicLink | null>(null);
  const [isLoadingAccessList, setIsLoadingAccessList] = useState(false);

  // Action / Mutation / Loading States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingPublicLink, setIsCreatingPublicLink] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [isUpdatingPermissionId, setIsUpdatingPermissionId] = useState<string | null>(null);
  const [resendingShareId, setResendingShareId] = useState<string | null>(null);

  // Ref to prevent double clicks and race conditions
  const inFlightRef = React.useRef(false);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: "collaborator" | "publicLink";
    item?: AccessCollaborator | AccessPublicLink;
    isDeleting?: boolean;
  }>({
    isOpen: false,
    type: "collaborator",
  });

  // Edit Security & Expiration Settings Modal for existing share
  const [editSettingsModal, setEditSettingsModal] = useState<{
    isOpen: boolean;
    targetShare: AccessCollaborator | AccessPublicLink | null;
    expirationOption: string;
    enablePassword: boolean;
    newPassword: string;
    isSaving: boolean;
  }>({
    isOpen: false,
    targetShare: null,
    expirationOption: "never",
    enablePassword: false,
    newPassword: "",
    isSaving: false,
  });

  const targetType = targetItem?.type;
  const targetId = targetItem?.item?.id;
  const targetOwnerId = targetItem?.item?.ownerId;

  const loadAccessData = useCallback(async () => {
    if (!targetType || !targetId || !authToken) return;
    setIsLoadingAccessList(true);
    try {
      const res = await fetchAccessList(authToken, targetType, targetId);
      if (res.success) {
        setOwner(res.owner || null);
        setCollaborators(res.collaborators || []);
        setPublicLink(res.publicLink || null);
      }
    } catch (err: any) {
      console.warn("Failed to load access list:", err);
      if (targetOwnerId) {
        setOwner((prev) => prev || {
          id: targetOwnerId,
          email: "Owner",
          fullName: "Owner",
          role: "Owner",
        });
      }
    } finally {
      setIsLoadingAccessList(false);
    }
  }, [authToken, targetType, targetId, targetOwnerId]);

  useEffect(() => {
    if (isOpen && authToken && targetId) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setInviteEmail("");
      setInvitePermission("viewer");
      setInviteExpiration("never");
      setShowAdvancedInvite(false);
      setPasswordEnabled(false);
      setPassword("");
      setConfirmPassword("");
      setCopiedTokenId(null);
      setConfirmModal({ isOpen: false, type: "collaborator" });
      setEditSettingsModal({
        isOpen: false,
        targetShare: null,
        expirationOption: "never",
        enablePassword: false,
        newPassword: "",
        isSaving: false,
      });
      loadAccessData();
    }
  }, [isOpen, authToken, targetType, targetId, loadAccessData]);

  if (!isOpen || !targetItem) return null;

  const calculateExpiresAt = (option: string) => {
    if (option === "never") return null;
    const now = new Date();
    if (option === "1day") now.setDate(now.getDate() + 1);
    else if (option === "7days") now.setDate(now.getDate() + 7);
    else if (option === "30days") now.setDate(now.getDate() + 30);
    return now.toISOString();
  };

  const formatExpirationDate = (expiresAt: string | null) => {
    if (!expiresAt) return "No expiration";
    try {
      const exp = new Date(expiresAt);
      const isPast = exp < new Date();
      if (isPast) return "Expired";
      return `Expires: ${exp.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`;
    } catch {
      return "No expiration";
    }
  };

  const getInitials = (nameOrEmail: string) => {
    if (!nameOrEmail) return "U";
    const parts = nameOrEmail.trim().split(/[\s@._-]+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return nameOrEmail.slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (str: string) => {
    const colors = [
      "bg-blue-600 text-white",
      "bg-emerald-600 text-white",
      "bg-indigo-600 text-white",
      "bg-violet-600 text-white",
      "bg-amber-600 text-white",
      "bg-teal-600 text-white",
      "bg-rose-600 text-white",
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const handleCopyLink = (token: string, identifier: string) => {
    const origin = window.location.origin;
    const linkUrl = `${origin}/share/${token}`;
    navigator.clipboard.writeText(linkUrl);
    setCopiedTokenId(identifier);
    setSuccessMsg("Share link copied to clipboard");
    setTimeout(() => {
      setCopiedTokenId(null);
      setSuccessMsg(null);
    }, 2500);
  };

  // Add / Invite Collaborator (Direct email sharing only - completely independent of public link)
  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || inFlightRef.current) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const emailTrim = inviteEmail.trim().toLowerCase();
    if (!emailTrim) {
      setErrorMsg("Enter an email address to share this file.");
      return;
    }

    // Standard email format validation regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailTrim)) {
      setErrorMsg("Enter a valid email address.");
      return;
    }

    if (owner && owner.email && owner.email.toLowerCase() === emailTrim) {
      setErrorMsg("You cannot share a file with yourself.");
      return;
    }

    // Duplicate collaborator check on frontend
    if (collaborators.some((c) => c.email.toLowerCase() === emailTrim)) {
      setErrorMsg("This person already has access to this file.");
      return;
    }

    if (passwordEnabled) {
      if (password.length < 6) {
        setErrorMsg("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg("Passwords do not match.");
        return;
      }
    }

    setIsSubmitting(true);
    inFlightRef.current = true;

    try {
      const payload: any = {
        permission: invitePermission,
        is_public_link: false,
        expires_at: calculateExpiresAt(inviteExpiration),
        password_enabled: passwordEnabled,
        password: passwordEnabled ? password : null,
        granted_to_email: emailTrim,
      };

      if (targetItem.type === "file") {
        payload.file_id = targetItem.item.id;
      } else {
        payload.folder_id = targetItem.item.id;
      }

      const res = await createShareLink(authToken, payload);
      if (res.success && res.share) {
        if (res.isDuplicateUpdated) {
          setSuccessMsg(`Updated permissions for ${emailTrim}.`);
        } else if (res.emailSent) {
          setSuccessMsg(`Shared successfully with ${emailTrim} and invitation email sent.`);
        } else {
          setSuccessMsg(`Access granted to ${emailTrim}.`);
        }

        // Reset invite fields
        setInviteEmail("");
        setPasswordEnabled(false);
        setPassword("");
        setConfirmPassword("");
        setShowAdvancedInvite(false);

        // Refresh access list immediately from backend
        await loadAccessData();

        // Log Activity & Notification
        if (targetItem.item.ownerId) {
          logUserActivity(
            targetItem.item.ownerId,
            "share",
            targetItem.type,
            targetItem.item.name
          );
          createNotification(
            targetItem.item.ownerId,
            "sharing",
            "Item Shared",
            `You shared ${targetItem.item.name} with ${emailTrim}`
          );
        }
      } else {
        throw new Error(res.message || "Failed to create share");
      }
    } catch (err: any) {
      if (err.status === 429 || err.errorType === "rate_limit") {
        setErrorMsg("Too many share access requests. Please try again in 15 minutes.");
      } else if (err.errorType === "already_shared") {
        setErrorMsg("This person already has access to this file.");
      } else {
        setErrorMsg(err.message || "Failed to create share. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
      inFlightRef.current = false;
    }
  };

  // Immediate Permission Change (Viewer <-> Editor)
  const handleUpdatePermission = async (
    shareId: string, 
    newPermission: "viewer" | "editor",
    emailTarget?: string
  ) => {
    setIsUpdatingPermissionId(shareId);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Optimistic UI update
    setCollaborators((prev) =>
      prev.map((c) => (c.id === shareId ? { ...c, permission: newPermission } : c))
    );
    if (publicLink && publicLink.id === shareId) {
      setPublicLink({ ...publicLink, permission: newPermission });
    }

    try {
      const res = await updateShareLink(authToken, shareId, { permission: newPermission });
      if (res.success) {
        const roleLabel = newPermission === "editor" ? "Editor" : "Viewer";
        setSuccessMsg(
          emailTarget 
            ? `Permission for ${emailTarget} updated to ${roleLabel}.` 
            : `General link permission updated to ${roleLabel}.`
        );
        setTimeout(() => setSuccessMsg(null), 3000);
        await loadAccessData();
      } else {
        throw new Error(res.message || "Failed to update permission");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to change permission. Reverting...");
      await loadAccessData();
    } finally {
      setIsUpdatingPermissionId(null);
    }
  };

  // Resend Email Sharing Invitation
  const handleResendInvitation = async (shareId: string, emailTarget: string) => {
    setResendingShareId(shareId);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await resendShareInvitation(authToken, shareId);
      if (res.success) {
        setSuccessMsg(`Sharing invitation email resent successfully to ${emailTarget}.`);
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        throw new Error(res.message || "Failed to resend invitation.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to resend sharing invitation email.");
      setTimeout(() => setErrorMsg(null), 5000);
    } finally {
      setResendingShareId(null);
    }
  };

  // Remove / Revoke Handlers
  const handlePromptRemoveCollaborator = (collaborator: AccessCollaborator) => {
    setConfirmModal({
      isOpen: true,
      type: "collaborator",
      item: collaborator,
      isDeleting: false,
    });
  };

  const handlePromptDisablePublicLink = (link: AccessPublicLink) => {
    setConfirmModal({
      isOpen: true,
      type: "publicLink",
      item: link,
      isDeleting: false,
    });
  };

  const handleConfirmRevoke = async () => {
    if (!confirmModal.item) return;
    setConfirmModal((prev) => ({ ...prev, isDeleting: true }));
    setErrorMsg(null);

    const isCollaborator = confirmModal.type === "collaborator";
    const collaboratorEmail = isCollaborator ? (confirmModal.item as AccessCollaborator).email : "";

    try {
      const res = await revokeShareLink(authToken, confirmModal.item.id);
      if (res.success) {
        setConfirmModal({ isOpen: false, type: "collaborator" });
        setSuccessMsg(
          isCollaborator 
            ? `Access removed successfully for ${collaboratorEmail}.` 
            : "Public link disabled successfully."
        );
        setTimeout(() => setSuccessMsg(null), 3000);
        // Sync fresh backend database state
        await loadAccessData();
      } else {
        throw new Error(res.message || "Unable to remove access. Please try again.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Unable to remove access. Please try again.");
      setConfirmModal((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  // Create or Copy Public Link (independent of email field)
  const handleCreateOrCopyPublicLink = async () => {
    if (publicLink && !publicLink.isExpired) {
      handleCopyLink(publicLink.shareToken, "footer");
      return;
    }

    setIsCreatingPublicLink(true);
    setErrorMsg(null);
    try {
      const payload: any = {
        permission: "viewer",
        is_public_link: true,
        expires_at: null,
      };
      if (targetItem.type === "file") payload.file_id = targetItem.item.id;
      else payload.folder_id = targetItem.item.id;

      const res = await createShareLink(authToken, payload);
      if (res.success && res.share) {
        const origin = window.location.origin;
        const linkUrl = `${origin}/share/${res.share.share_token}`;
        navigator.clipboard.writeText(linkUrl);
        setCopiedTokenId("footer");
        setSuccessMsg("Public link created and copied to clipboard!");
        setTimeout(() => {
          setCopiedTokenId(null);
          setSuccessMsg(null);
        }, 3000);
        await loadAccessData();
      } else {
        throw new Error(res.message || "Failed to enable public link");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create public link. Please try again.");
    } finally {
      setIsCreatingPublicLink(false);
    }
  };

  // Quick Enable Public Link in the Public Link Row
  const handleQuickEnablePublicLink = async () => {
    setIsCreatingPublicLink(true);
    setErrorMsg(null);
    try {
      const payload: any = {
        permission: "viewer",
        is_public_link: true,
        expires_at: null,
      };
      if (targetItem.type === "file") payload.file_id = targetItem.item.id;
      else payload.folder_id = targetItem.item.id;

      const res = await createShareLink(authToken, payload);
      if (res.success) {
        setSuccessMsg("Public link enabled. Anyone with the link can now view.");
        setTimeout(() => setSuccessMsg(null), 3000);
        await loadAccessData();
      } else {
        throw new Error(res.message || "Failed to enable public link");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to enable public link");
    } finally {
      setIsCreatingPublicLink(false);
    }
  };

  // Open Edit Settings for Existing Share
  const handleOpenEditSettings = (share: AccessCollaborator | AccessPublicLink) => {
    setEditSettingsModal({
      isOpen: true,
      targetShare: share,
      expirationOption: "never",
      enablePassword: share.passwordEnabled,
      newPassword: "",
      isSaving: false,
    });
  };

  const handleSaveShareSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSettingsModal.targetShare) return;

    setEditSettingsModal((prev) => ({ ...prev, isSaving: true }));
    setErrorMsg(null);

    try {
      const payload: any = {};
      if (editSettingsModal.expirationOption !== "keep") {
        payload.expires_at = calculateExpiresAt(editSettingsModal.expirationOption);
      }

      if (editSettingsModal.enablePassword) {
        if (editSettingsModal.newPassword) {
          if (editSettingsModal.newPassword.length < 6) {
            setErrorMsg("Password must be at least 6 characters.");
            setEditSettingsModal((prev) => ({ ...prev, isSaving: false }));
            return;
          }
          payload.password_enabled = true;
          payload.password = editSettingsModal.newPassword;
        }
      } else {
        payload.password_enabled = false;
        payload.password = null;
      }

      const res = await updateShareLink(authToken, editSettingsModal.targetShare.id, payload);
      if (res.success) {
        setSuccessMsg("Security & expiration settings updated.");
        setEditSettingsModal({
          isOpen: false,
          targetShare: null,
          expirationOption: "never",
          enablePassword: false,
          newPassword: "",
          isSaving: false,
        });
        setTimeout(() => setSuccessMsg(null), 3000);
        await loadAccessData();
      } else {
        throw new Error(res.message || "Failed to update settings");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update share settings");
      setEditSettingsModal((prev) => ({ ...prev, isSaving: false }));
    }
  };

  const activeCollaboratorsCount = collaborators.filter((c) => !c.isExpired).length;
  const isGeneralAccessActive = Boolean(publicLink && !publicLink.isExpired);

  return (
    <div 
      id="share-modal-container"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div 
        id="share-modal-card"
        className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-100 relative animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-xs shrink-0">
              {targetItem.type === "folder" ? (
                <Folder className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 leading-tight truncate">
                  Share "{targetItem.item.name}"
                </h2>
              </div>
              
              {/* Sharing Status Indicators */}
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500 capitalize">
                  {targetItem.type} Access Management
                </span>
                <span className="text-slate-300">•</span>
                {isGeneralAccessActive ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <Globe className="w-2.5 h-2.5" />
                    Public Link Active
                  </span>
                ) : activeCollaboratorsCount > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                    <Users className="w-2.5 h-2.5" />
                    Shared ({activeCollaboratorsCount})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    <Lock className="w-2.5 h-2.5" />
                    Restricted
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            id="share-modal-close-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Alerts / Feedback Banners */}
        {errorMsg && (
          <div 
            id="share-error-banner" 
            className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 shrink-0 animate-in fade-in duration-150"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMsg}</div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-600 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successMsg && (
          <div 
            id="share-success-banner" 
            className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2.5 shrink-0 animate-in fade-in duration-150"
          >
            <Check className="w-4 h-4 shrink-0" />
            <div className="flex-1 font-medium">{successMsg}</div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-600 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-5">
          {/* Invite Collaborator Form */}
          <form onSubmit={handleAddCollaborator} className="space-y-3">
            <div>
              <label 
                htmlFor="invite-email-input" 
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Add people and groups
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="invite-email-input"
                    type="email"
                    placeholder="Enter email (e.g. collaborator@example.com)"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>

                <select
                  id="invite-permission-select"
                  value={invitePermission}
                  onChange={(e: any) => setInvitePermission(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>

                <button
                  id="invite-submit-btn"
                  type="submit"
                  disabled={isSubmitting || !inviteEmail.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold py-2 px-4 rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Share</span>
                  )}
                </button>
              </div>
            </div>

            {/* Advanced Security & Expiration Accordion */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvancedInvite(!showAdvancedInvite)}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 hover:underline cursor-pointer"
              >
                <Settings2 className="w-3 h-3" />
                <span>{showAdvancedInvite ? "Hide options" : "Security & expiration options"}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showAdvancedInvite ? "rotate-180" : ""}`} />
              </button>

              {showAdvancedInvite && (
                <div className="mt-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs animate-in fade-in duration-150">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      Expiration Date
                    </label>
                    <select
                      value={inviteExpiration}
                      onChange={(e) => setInviteExpiration(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                    >
                      <option value="never">No expiration</option>
                      <option value="1day">1 Day</option>
                      <option value="7days">7 Days</option>
                      <option value="30days">30 Days</option>
                    </select>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="modal-password-toggle"
                        checked={passwordEnabled}
                        onChange={(e) => setPasswordEnabled(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                      />
                      <label htmlFor="modal-password-toggle" className="font-semibold text-slate-700 cursor-pointer flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-blue-600" />
                        Protect with password
                      </label>
                    </div>

                    {passwordEnabled && (
                      <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Password (6+ chars)"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-[10px] font-bold uppercase cursor-pointer"
                          >
                            {showPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Confirm password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </form>

          {/* Section: People with access */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                People with access ({1 + collaborators.length})
              </h3>
              {isLoadingAccessList && (
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading...
                </span>
              )}
            </div>

            <div className="space-y-2">
              {/* 1. OWNER (PROTECTED & IMMUTABLE) */}
              {owner && (
                <div 
                  id="access-item-owner"
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {owner.avatarUrl ? (
                      <img
                        src={owner.avatarUrl}
                        alt={owner.fullName}
                        className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-2xs shrink-0">
                        {getInitials(owner.fullName || owner.email)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {owner.fullName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          (you)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {owner.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span 
                      id="owner-badge"
                      className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg shadow-2xs"
                    >
                      Owner
                    </span>
                  </div>
                </div>
              )}

              {/* 2. DIRECT COLLABORATORS */}
              {collaborators.length === 0 && !isLoadingAccessList && (
                <div className="p-3.5 text-center rounded-xl bg-slate-50/60 border border-dashed border-slate-200 text-slate-500 text-xs">
                  No collaborators added yet. Enter an email address above to grant access.
                </div>
              )}

              {collaborators.map((collaborator) => {
                const isCopied = copiedTokenId === collaborator.id;
                const isUpdating = isUpdatingPermissionId === collaborator.id;
                const expirationText = formatExpirationDate(collaborator.expiresAt);

                return (
                  <div 
                    key={collaborator.id}
                    id={`access-item-collaborator-${collaborator.id}`}
                    className={`flex items-center justify-between p-3 rounded-xl bg-white border transition-all ${
                      collaborator.isExpired 
                        ? "border-rose-200 bg-rose-50/20" 
                        : "border-slate-200 hover:border-slate-300 hover:shadow-xs"
                    }`}
                  >
                    {/* Collaborator Details */}
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      {collaborator.avatarUrl ? (
                        <img
                          src={collaborator.avatarUrl}
                          alt={collaborator.fullName}
                          className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className={`w-9 h-9 rounded-full ${getAvatarColor(collaborator.email)} font-bold text-xs flex items-center justify-center shadow-2xs shrink-0`}>
                          {getInitials(collaborator.fullName || collaborator.email)}
                        </div>
                      )}

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-900 truncate">
                            {collaborator.fullName !== collaborator.email ? collaborator.fullName : collaborator.email}
                          </span>
                        </div>
                        {collaborator.fullName !== collaborator.email && (
                          <p className="text-[10px] text-slate-500 truncate">{collaborator.email}</p>
                        )}

                        {/* Metadata Pills */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className="text-slate-400 font-medium">Direct share</span>
                          <span className="text-slate-300">•</span>

                          {/* Expiration Status */}
                          {collaborator.isExpired ? (
                            <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                              <Clock className="w-3 h-3 text-rose-500" />
                              Expired
                            </span>
                          ) : collaborator.expiresAt ? (
                            <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {expirationText}
                            </span>
                          ) : (
                            <span className="text-slate-400">No expiration</span>
                          )}

                          {/* Password Indicator */}
                          {collaborator.passwordEnabled && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="inline-flex items-center gap-1 text-blue-700 font-medium bg-blue-50 px-1.5 py-0.5 rounded">
                                <Shield className="w-3 h-3 text-blue-500" />
                                Password protected
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Permission Dropdown */}
                      <div className="relative">
                        <select
                          id={`perm-select-${collaborator.id}`}
                          value={collaborator.permission}
                          disabled={isUpdating}
                          onChange={(e) => handleUpdatePermission(
                            collaborator.id, 
                            e.target.value as "viewer" | "editor", 
                            collaborator.email
                          )}
                          className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg py-1.5 pl-2.5 pr-7 text-xs font-semibold text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer transition-colors"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-slate-400">
                          {isUpdating ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </div>

                      {/* Edit Security / Expiration Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditSettings(collaborator)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Configure expiration or password"
                      >
                        <Settings2 className="w-4 h-4" />
                      </button>

                      {/* Copy Direct Link Button */}
                      <button
                        id={`copy-collaborator-link-${collaborator.id}`}
                        type="button"
                        onClick={() => handleCopyLink(collaborator.shareToken, collaborator.id)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="Copy direct share link"
                      >
                        {isCopied ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>

                      {/* Resend Invitation Button */}
                      <button
                        id={`resend-invitation-btn-${collaborator.id}`}
                        type="button"
                        onClick={() => handleResendInvitation(collaborator.id, collaborator.email)}
                        disabled={resendingShareId === collaborator.id}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40 rounded-lg transition-colors cursor-pointer"
                        title="Resend invitation email"
                      >
                        {resendingShareId === collaborator.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Mail className="w-4 h-4" />
                        )}
                      </button>

                      {/* Remove Access Button */}
                      <button
                        id={`remove-collaborator-btn-${collaborator.id}`}
                        type="button"
                        onClick={() => handlePromptRemoveCollaborator(collaborator)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Remove collaborator access"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* 3. PUBLIC LINK ("ANYONE WITH THE LINK") */}
              <div 
                id="access-item-public-link"
                className={`p-3 rounded-xl border transition-all space-y-2 ${
                  publicLink && !publicLink.isExpired
                    ? "bg-white border-slate-200 hover:border-slate-300"
                    : "bg-slate-50/50 border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className={`w-9 h-9 rounded-full ${publicLink && !publicLink.isExpired ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"} flex items-center justify-center shrink-0`}>
                      <Globe className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <h4 className="text-xs font-semibold text-slate-900 truncate">
                        Anyone with the link
                      </h4>
                      
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="text-slate-400 font-medium">General access</span>
                        <span className="text-slate-300">•</span>

                        {publicLink ? (
                          <>
                            {publicLink.isExpired ? (
                              <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                <Clock className="w-3 h-3 text-rose-500" />
                                Expired
                              </span>
                            ) : publicLink.expiresAt ? (
                              <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {formatExpirationDate(publicLink.expiresAt)}
                              </span>
                            ) : (
                              <span className="text-slate-400">No expiration</span>
                            )}

                            {publicLink.passwordEnabled && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="inline-flex items-center gap-1 text-blue-700 font-medium bg-blue-50 px-1.5 py-0.5 rounded">
                                  <Shield className="w-3 h-3 text-blue-500" />
                                  Password protected
                                </span>
                              </>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400 italic">
                            Restricted — Only added collaborators can open
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Public Link Controls */}
                  {publicLink ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Permission Dropdown */}
                      <div className="relative">
                        <select
                          id="public-perm-select"
                          value={publicLink.permission}
                          disabled={isUpdatingPermissionId === publicLink.id}
                          onChange={(e) => handleUpdatePermission(publicLink.id, e.target.value as "viewer" | "editor")}
                          className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg py-1.5 pl-2.5 pr-7 text-xs font-semibold text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer transition-colors"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-slate-400">
                          {isUpdatingPermissionId === publicLink.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </div>

                      {/* Edit Security / Expiration */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditSettings(publicLink)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Configure expiration or password"
                      >
                        <Settings2 className="w-4 h-4" />
                      </button>

                      {/* Copy Public Link Button */}
                      <button
                        id="copy-public-link-btn"
                        type="button"
                        onClick={() => handleCopyLink(publicLink.shareToken, publicLink.id)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="Copy public link"
                      >
                        {copiedTokenId === publicLink.id ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>

                      {/* Disable Public Link Button */}
                      <button
                        id="disable-public-link-btn"
                        type="button"
                        onClick={() => handlePromptDisablePublicLink(publicLink)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Disable public link"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      id="enable-public-link-btn"
                      type="button"
                      onClick={handleQuickEnablePublicLink}
                      disabled={isCreatingPublicLink}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                    >
                      {isCreatingPublicLink ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Globe className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      <span>Enable link</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer / Copy Link Bar */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-2">
            <button
              id="footer-copy-link-btn"
              type="button"
              onClick={handleCreateOrCopyPublicLink}
              disabled={isCreatingPublicLink}
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 text-blue-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {isCreatingPublicLink ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating link...</span>
                </>
              ) : copiedTokenId === "footer" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Link copied!</span>
                </>
              ) : (
                <>
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>Copy link</span>
                </>
              )}
            </button>
          </div>

          <button
            id="share-modal-done-btn"
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>

        {/* Custom Confirmation Modal for Removing Access */}
        {confirmModal.isOpen && (
          <div 
            id="remove-access-confirm-backdrop"
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs animate-in fade-in duration-150"
          >
            <div 
              id="remove-access-confirm-card"
              className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {confirmModal.type === "collaborator" ? "Remove access?" : "Disable public link?"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {confirmModal.type === "collaborator" ? "Revoke collaborator permissions" : "Disable general link sharing"}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {confirmModal.type === "collaborator" ? (
                  <>
                    Remove access for <strong className="text-slate-900">{(confirmModal.item as AccessCollaborator)?.email}</strong>? They will immediately lose access to this shared {targetItem.type}.
                  </>
                ) : (
                  <>
                    Anyone who previously accessed this {targetItem.type} using the public link will no longer have access.
                  </>
                )}
              </p>
              
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-500 flex items-start gap-2">
                <Shield className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span>The original file and other collaborators will remain completely unaffected.</span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  id="confirm-modal-cancel-btn"
                  type="button"
                  onClick={() => setConfirmModal({ isOpen: false, type: "collaborator" })}
                  disabled={confirmModal.isDeleting}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="confirm-modal-submit-btn"
                  type="button"
                  onClick={handleConfirmRevoke}
                  disabled={confirmModal.isDeleting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {confirmModal.isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Removing...</span>
                    </>
                  ) : (
                    <span>{confirmModal.type === "collaborator" ? "Remove access" : "Disable link"}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Security & Expiration Settings Modal */}
        {editSettingsModal.isOpen && editSettingsModal.targetShare && (
          <div 
            id="edit-settings-backdrop"
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs animate-in fade-in duration-150"
          >
            <div 
              id="edit-settings-card"
              className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                    <Settings2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Security & Expiration
                    </h3>
                    <p className="text-xs text-slate-500 truncate max-w-[200px]">
                      {(editSettingsModal.targetShare as AccessCollaborator).email || "Public Link"}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditSettingsModal({ ...editSettingsModal, isOpen: false })}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveShareSettings} className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    Expiration Date
                  </label>
                  <select
                    value={editSettingsModal.expirationOption}
                    onChange={(e) => setEditSettingsModal({ ...editSettingsModal, expirationOption: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                  >
                    <option value="keep">Keep current ({formatExpirationDate(editSettingsModal.targetShare.expiresAt)})</option>
                    <option value="never">Remove expiration (No limit)</option>
                    <option value="1day">Expire in 1 Day</option>
                    <option value="7days">Expire in 7 Days</option>
                    <option value="30days">Expire in 30 Days</option>
                  </select>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="edit-modal-password-toggle"
                      checked={editSettingsModal.enablePassword}
                      onChange={(e) => setEditSettingsModal({ ...editSettingsModal, enablePassword: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                    />
                    <label htmlFor="edit-modal-password-toggle" className="text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-blue-600" />
                      Require password to access
                    </label>
                  </div>

                  {editSettingsModal.enablePassword && (
                    <div className="mt-2.5">
                      <input
                        type="password"
                        placeholder="Enter new password (or leave blank to keep)"
                        value={editSettingsModal.newPassword}
                        onChange={(e) => setEditSettingsModal({ ...editSettingsModal, newPassword: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditSettingsModal({ ...editSettingsModal, isOpen: false })}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSettingsModal.isSaving}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {editSettingsModal.isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Changes</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
