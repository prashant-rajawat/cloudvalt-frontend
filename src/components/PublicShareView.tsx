import React, { useState, useEffect, useRef } from "react";
import { fetchPublicShareItem, unlockPublicShare, renameSharedFile, replaceSharedFile } from "../lib/api.js";
import {
  Download,
  FileText,
  Film,
  Music,
  Image as ImageIcon,
  Archive,
  Shield,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Lock,
  Unlock,
  Clock,
  Edit2,
  Upload,
  Check,
  CheckCircle2,
  FileUp,
} from "lucide-react";

interface PublicShareViewProps {
  shareToken: string;
  onBackToApp: () => void;
}

export function PublicShareView({ shareToken, onBackToApp }: PublicShareViewProps) {
  const [shareData, setShareData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState("");
  const [unlockedPassword, setUnlockedPassword] = useState<string | undefined>(undefined);
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Editor states
  const [isRenaming, setIsRenaming] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [isSavingRename, setIsSavingRename] = useState(false);
  const [isUploadingVersion, setIsUploadingVersion] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadShare();
  }, [shareToken]);

  const loadShare = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchPublicShareItem(shareToken);
      if (res.success) {
        if (res.passwordRequired) {
          setPasswordRequired(true);
          setShareData(res.share);
        } else {
          setShareData(res.share);
          setPasswordRequired(false);
          if (res.share?.file?.name) {
            setNewFileName(res.share.file.name);
          }
        }
      } else {
        throw new Error(res.message || "Invalid or unavailable share link.");
      }
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.toLowerCase().includes("expired")) {
        setErrorMsg("This share link has expired. Please contact the file owner to request a new link.");
      } else {
        setErrorMsg("This share link is invalid or has been revoked by the owner.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setIsUnlocking(true);
    setErrorMsg(null);
    try {
      const res = await unlockPublicShare(shareToken, password);
      if (res.success && res.share) {
        setShareData(res.share);
        setPasswordRequired(false);
        setUnlockedPassword(password);
        if (res.share?.file?.name) {
          setNewFileName(res.share.file.name);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Incorrect password. Please try again.");
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    setIsSavingRename(true);
    setActionErrorMsg(null);
    setActionSuccessMsg(null);

    try {
      const res = await renameSharedFile(shareToken, newFileName.trim(), unlockedPassword);
      if (res.success && res.file) {
        setShareData((prev: any) => ({
          ...prev,
          file: {
            ...prev.file,
            ...res.file,
          },
        }));
        setIsRenaming(false);
        setActionSuccessMsg("File renamed successfully.");
        setTimeout(() => setActionSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || "Failed to rename file.");
    } finally {
      setIsSavingRename(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingVersion(true);
    setActionErrorMsg(null);
    setActionSuccessMsg(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(",")[1];
          const res = await replaceSharedFile(shareToken, {
            base64Data,
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            password: unlockedPassword,
          });

          if (res.success && res.file) {
            setShareData((prev: any) => ({
              ...prev,
              file: {
                ...prev.file,
                ...res.file,
              },
            }));
            setNewFileName(res.file.name);
            setActionSuccessMsg("File updated with new version.");
            setTimeout(() => setActionSuccessMsg(null), 3000);
          }
        } catch (uploadErr: any) {
          setActionErrorMsg(uploadErr.message || "Failed to update file.");
        } finally {
          setIsUploadingVersion(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      };
      reader.onerror = () => {
        setActionErrorMsg("Failed to read file.");
        setIsUploadingVersion(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setActionErrorMsg(err.message || "Failed to process file.");
      setIsUploadingVersion(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "image":
        return <ImageIcon className="w-8 h-8 text-indigo-500" />;
      case "video":
        return <Film className="w-8 h-8 text-rose-500" />;
      case "audio":
        return <Music className="w-8 h-8 text-amber-500" />;
      case "archive":
        return <Archive className="w-8 h-8 text-purple-500" />;
      default:
        return <FileText className="w-8 h-8 text-blue-500" />;
    }
  };

  const isEditor = shareData?.permission?.toLowerCase() === "editor";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 selection:bg-blue-500 selection:text-white">
      {/* Top Header */}
      <div className="w-full max-w-xl mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src="https://i.ibb.co/Y4vr5f6J/image.png"
            alt="CloudVault Logo"
            className="w-8 h-8 object-contain mix-blend-multiply"
            referrerPolicy="no-referrer"
          />
          <span className="font-bold text-slate-900 tracking-tight text-base">CloudVault</span>
        </div>
        <button
          onClick={onBackToApp}
          className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Open CloudVault</span>
        </button>
      </div>

      <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200/80 shadow-xl p-6 sm:p-8">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm font-medium">Opening shared item...</p>
          </div>
        ) : errorMsg && !passwordRequired ? (
          <div className="py-12 text-center">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-1">Access Unavailable</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">{errorMsg}</p>
            <button
              onClick={onBackToApp}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-4 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              Go to CloudVault Homepage
            </button>
          </div>
        ) : passwordRequired ? (
          <div className="py-6">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Password Protected File</h3>
            <p className="text-xs text-slate-500 text-center mb-6">
              Enter the password provided by the sender to view and download this file.
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleUnlock} className="space-y-4 max-w-sm mx-auto">
              <input
                type="password"
                placeholder="Enter access password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                autoFocus
              />
              <button
                type="submit"
                disabled={isUnlocking || !password}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isUnlocking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                <span>Unlock File</span>
              </button>
            </form>
          </div>
        ) : shareData?.file ? (
          <div className="space-y-6">
            {/* Notification Feedback */}
            {actionSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{actionSuccessMsg}</span>
              </div>
            )}
            {actionErrorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionErrorMsg}</span>
              </div>
            )}

            {/* Header info */}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center shrink-0">
                {getCategoryIcon(shareData.file.category)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                      isEditor
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                  >
                    {isEditor ? "Editor Access" : "Viewer Access"}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {formatBytes(shareData.file.sizeBytes)}
                  </span>
                </div>

                {/* Inline Rename Form or File Display */}
                {isRenaming ? (
                  <form onSubmit={handleRename} className="mt-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      className="text-sm font-semibold text-slate-900 border border-blue-400 rounded-lg px-2.5 py-1 outline-none w-full bg-blue-50/30"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={isSavingRename || !newFileName.trim()}
                      className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                      title="Save name"
                    >
                      {isSavingRename ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRenaming(false);
                        setNewFileName(shareData.file.name);
                      }}
                      className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-xs font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <h2 className="text-lg font-bold text-slate-900 leading-tight truncate">
                      {shareData.file.name}
                    </h2>
                    {isEditor && (
                      <button
                        onClick={() => setIsRenaming(true)}
                        className="text-slate-400 hover:text-blue-600 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Rename file"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-0.5">{shareData.file.mimeType}</p>
              </div>
            </div>

            {/* Media Preview Section */}
            {shareData.file.downloadUrl && (
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900/5 max-h-80 flex items-center justify-center">
                {shareData.file.category === "image" ? (
                  <img
                    src={shareData.file.downloadUrl}
                    alt={shareData.file.name}
                    className="max-h-80 w-auto object-contain rounded-lg"
                  />
                ) : shareData.file.category === "video" ? (
                  <video
                    src={shareData.file.downloadUrl}
                    controls
                    className="max-h-80 w-full rounded-lg"
                  />
                ) : shareData.file.category === "audio" ? (
                  <div className="p-6 w-full">
                    <audio src={shareData.file.downloadUrl} controls className="w-full" />
                  </div>
                ) : shareData.file.mimeType === "application/pdf" ? (
                  <iframe
                    src={shareData.file.downloadUrl}
                    title="PDF Preview"
                    className="w-full h-80 border-none"
                  />
                ) : (
                  <div className="py-12 text-center text-xs text-slate-400">
                    Preview not rendered in-browser for this format. Download to view.
                  </div>
                )}
              </div>
            )}

            {/* Actions: Download and Editor Options */}
            <div className="space-y-2.5">
              {shareData.file.downloadUrl && (
                <a
                  href={shareData.file.downloadUrl}
                  download={shareData.file.name}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download File ({formatBytes(shareData.file.sizeBytes)})</span>
                </a>
              )}

              {/* Editor Capabilities: Upload New Version */}
              {isEditor && (
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingVersion}
                    className="w-full bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 text-slate-700 font-medium py-2.5 px-4 rounded-xl text-xs shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isUploadingVersion ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                        <span>Uploading new version...</span>
                      </>
                    ) : (
                      <>
                        <FileUp className="w-3.5 h-3.5 text-blue-600" />
                        <span>Upload New Version (Editor)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Footer metadata */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                <span>Protected Cloud Storage</span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                {shareData.expiresAt ? (
                  <div className="flex items-center gap-1 text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>Expires: {new Date(shareData.expiresAt).toLocaleDateString()}</span>
                  </div>
                ) : (
                  <span>Never expires</span>
                )}
                <span>Token: {shareToken.slice(0, 8)}...</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
