import React, { useState, useEffect, useRef } from "react";
import {
  fetchPublicShareItem,
  unlockPublicShare,
  renameSharedFile,
  replaceSharedFile,
  fetchSharedFileText,
  saveSharedFileText,
} from "../lib/api.js";
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
  Check,
  CheckCircle2,
  FileUp,
  Save,
  Code,
  Eye,
  RefreshCw,
} from "lucide-react";

interface PublicShareViewProps {
  shareToken: string;
  onBackToApp: () => void;
}

type ErrorStateKind = "expired" | "not_found" | "file_deleted" | "forbidden" | "general" | null;

export function PublicShareView({ shareToken, onBackToApp }: PublicShareViewProps) {
  const [shareData, setShareData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorKind, setErrorKind] = useState<ErrorStateKind>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState("");
  const [unlockedPassword, setUnlockedPassword] = useState<string | undefined>(undefined);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Editor states
  const [isRenaming, setIsRenaming] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [isSavingRename, setIsSavingRename] = useState(false);
  const [isUploadingVersion, setIsUploadingVersion] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Text editor state for text files
  const [activeTab, setActiveTab] = useState<"preview" | "editor">("preview");
  const [textContent, setTextContent] = useState<string>("");
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [isSavingText, setIsSavingText] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadShare();
  }, [shareToken]);

  const loadShare = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setErrorKind(null);
    setPasswordError(null);

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
          if (isTextFile(res.share?.file?.name, res.share?.file?.mimeType)) {
            loadTextContent(unlockedPassword);
          }
        }
      } else {
        classifyError(res.message || "Invalid or unavailable share link.");
      }
    } catch (err: any) {
      classifyError(err.message || "Failed to load share item.");
    } finally {
      setIsLoading(false);
    }
  };

  const classifyError = (rawMsg: string) => {
    const lower = rawMsg.toLowerCase();
    if (lower.includes("expired")) {
      setErrorKind("expired");
      setErrorMsg("This sharing link has expired and is no longer available.");
    } else if (lower.includes("deleted") || lower.includes("no longer available")) {
      setErrorKind("file_deleted");
      setErrorMsg("The shared file has been deleted or is no longer available.");
    } else if (lower.includes("permission") || lower.includes("forbidden") || lower.includes("viewer only")) {
      setErrorKind("forbidden");
      setErrorMsg("You don't have permission to perform this action.");
    } else {
      setErrorKind("not_found");
      setErrorMsg("This share link is invalid or has been revoked by the owner.");
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setIsUnlocking(true);
    setPasswordError(null);

    try {
      const res = await unlockPublicShare(shareToken, password);
      if (res.success && res.share) {
        setShareData(res.share);
        setPasswordRequired(false);
        setUnlockedPassword(password);
        if (res.share?.file?.name) {
          setNewFileName(res.share.file.name);
        }
        if (isTextFile(res.share?.file?.name, res.share?.file?.mimeType)) {
          loadTextContent(password);
        }
      }
    } catch (err: any) {
      setPasswordError(err.message || "Incorrect password. Please try again.");
    } finally {
      setIsUnlocking(false);
    }
  };

  const isTextFile = (fileName?: string, mimeType?: string) => {
    if (!fileName && !mimeType) return false;
    const textExtensions = ["txt", "md", "json", "csv", "js", "jsx", "ts", "tsx", "html", "css", "xml", "py", "sh", "yaml", "yml", "env", "sql", "log"];
    const ext = (fileName || "").split(".").pop()?.toLowerCase() || "";
    if (textExtensions.includes(ext)) return true;
    if (mimeType && (mimeType.startsWith("text/") || mimeType.includes("json") || mimeType.includes("javascript") || mimeType.includes("xml"))) {
      return true;
    }
    return false;
  };

  const loadTextContent = async (pw?: string) => {
    setIsLoadingText(true);
    try {
      const res = await fetchSharedFileText(shareToken, pw);
      if (res.success && typeof res.content === "string") {
        setTextContent(res.content);
      }
    } catch (err) {
      console.warn("Could not load text content:", err);
    } finally {
      setIsLoadingText(false);
    }
  };

  const handleSaveText = async () => {
    setIsSavingText(true);
    setActionErrorMsg(null);
    setActionSuccessMsg(null);

    try {
      const res = await saveSharedFileText(shareToken, textContent, unlockedPassword);
      if (res.success && res.file) {
        setShareData((prev: any) => ({
          ...prev,
          file: {
            ...prev.file,
            ...res.file,
          },
        }));
        setActionSuccessMsg("File content saved successfully.");
        setTimeout(() => setActionSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || "Failed to save file content.");
    } finally {
      setIsSavingText(false);
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
            if (isTextFile(res.file.name, res.file.mimeType)) {
              loadTextContent(unlockedPassword);
            }
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
        return <ImageIcon className="w-7 h-7 text-blue-600" />;
      case "video":
        return <Film className="w-7 h-7 text-purple-600" />;
      case "audio":
        return <Music className="w-7 h-7 text-amber-600" />;
      case "archive":
        return <Archive className="w-7 h-7 text-slate-600" />;
      default:
        return <FileText className="w-7 h-7 text-blue-600" />;
    }
  };

  const isEditor = shareData?.permission?.toLowerCase() === "editor";
  const editableText = isTextFile(shareData?.file?.name, shareData?.file?.mimeType);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 selection:bg-blue-500 selection:text-white">
      {/* Top Header */}
      <div className="w-full max-w-2xl mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="CloudVault Logo"
            className="w-8 h-8 object-contain mix-blend-multiply shrink-0"
            referrerPolicy="no-referrer"
          />
          <span className="font-bold text-slate-900 tracking-tight text-base">CloudVault</span>
        </div>
        <button
          onClick={onBackToApp}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Open CloudVault</span>
        </button>
      </div>

      <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200/80 shadow-xl p-6 sm:p-8">
        {/* Loading View */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-9 h-9 animate-spin text-blue-600 mb-3" />
            <p className="text-sm font-semibold text-slate-700">Opening shared file...</p>
            <p className="text-xs text-slate-400 mt-1">Verifying secure token permissions</p>
          </div>
        ) : errorKind ? (
          /* Error States: Expired / Revoked / Deleted / Forbidden */
          <div className="py-12 text-center">
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1.5">
              {errorKind === "expired"
                ? "Link Expired"
                : errorKind === "file_deleted"
                ? "File No Longer Available"
                : errorKind === "forbidden"
                ? "Access Denied"
                : "Access Revoked"}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
              {errorMsg}
            </p>
            <button
              onClick={onBackToApp}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              Go to CloudVault Homepage
            </button>
          </div>
        ) : passwordRequired ? (
          /* Password Protection Screen */
          <div className="py-6">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-2xs">
              <Lock className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Password Protected File</h3>
            <p className="text-xs text-slate-500 text-center mb-6 max-w-sm mx-auto">
              This file is protected with a password. Enter the password below to access the file.
            </p>

            {passwordError && (
              <div className="mb-4 max-w-sm mx-auto p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-medium">{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleUnlock} className="space-y-4 max-w-sm mx-auto">
              <div>
                <input
                  type="password"
                  placeholder="Enter access password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={isUnlocking || !password}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isUnlocking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                <span>Unlock File</span>
              </button>
            </form>
          </div>
        ) : shareData?.file ? (
          /* File Loaded: Viewer and Editor Layout */
          <div className="space-y-6">
            {/* Feedback Notifications */}
            {actionSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span className="font-medium">{actionSuccessMsg}</span>
              </div>
            )}
            {actionErrorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-medium">{actionErrorMsg}</span>
              </div>
            )}

            {/* Header info */}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center shrink-0">
                {getCategoryIcon(shareData.file.category)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                      isEditor
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                  >
                    {isEditor ? <Edit2 className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                    {isEditor ? "Editor Access" : "Viewer Access"}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {formatBytes(shareData.file.sizeBytes)}
                  </span>
                  {shareData.file.extension && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {shareData.file.extension}
                    </span>
                  )}
                </div>

                {/* Inline Rename Form or File Title */}
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

            {/* If editable text file & Editor mode, render tabs */}
            {editableText && isEditor && (
              <div className="flex items-center border-b border-slate-200">
                <button
                  onClick={() => setActiveTab("preview")}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === "preview"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>
                <button
                  onClick={() => setActiveTab("editor")}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === "editor"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>Text Editor</span>
                </button>
              </div>
            )}

            {/* Text Editor Tab View (Editor only) */}
            {editableText && isEditor && activeTab === "editor" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">File Content (Live Edit)</span>
                  <button
                    onClick={handleSaveText}
                    disabled={isSavingText || isLoadingText}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    {isSavingText ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Save Content</span>
                  </button>
                </div>
                {isLoadingText ? (
                  <div className="h-64 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                    <span className="text-xs">Loading text content...</span>
                  </div>
                ) : (
                  <textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    rows={12}
                    className="w-full font-mono text-xs text-slate-800 bg-slate-900/5 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                    placeholder="Empty file..."
                  />
                )}
              </div>
            ) : (
              /* Media / Document Preview Section */
              shareData.file.downloadUrl && (
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
                  ) : editableText ? (
                    <div className="w-full h-72 overflow-y-auto p-4 bg-slate-900 text-slate-100 font-mono text-xs rounded-xl">
                      {isLoadingText ? (
                        <div className="flex items-center justify-center h-full text-slate-400">
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                          <span>Loading preview...</span>
                        </div>
                      ) : (
                        <pre className="whitespace-pre-wrap">{textContent || "Empty file content"}</pre>
                      )}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-xs text-slate-400">
                      Preview not rendered in-browser for this format. Download to view.
                    </div>
                  )}
                </div>
              )
            )}

            {/* Actions: Download and Editor Options */}
            <div className="space-y-2.5">
              {shareData.file.downloadUrl && (
                <a
                  href={shareData.file.downloadUrl}
                  download={shareData.file.name}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download File ({formatBytes(shareData.file.sizeBytes)})</span>
                </a>
              )}

              {/* Editor Capabilities: Upload New Version & Rename */}
              {isEditor && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingVersion}
                    className="w-full bg-white border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 text-slate-700 font-semibold py-2.5 px-4 rounded-xl text-xs shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isUploadingVersion ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                        <span>Uploading new version...</span>
                      </>
                    ) : (
                      <>
                        <FileUp className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Upload New Version</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setIsRenaming(true)}
                    className="w-full bg-white border border-slate-200 hover:border-blue-500 hover:bg-blue-50/30 text-slate-700 font-semibold py-2.5 px-4 rounded-xl text-xs shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Rename File</span>
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

