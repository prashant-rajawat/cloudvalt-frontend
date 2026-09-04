import React from "react";
import { FileItem } from "../types/index.js";
import { FileCardPreview } from "./FileCardPreview.js";
import {
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  Code,
  FileSpreadsheet,
  Presentation,
  MoreVertical,
  Star,
  Eye,
  Download,
  Share2,
  Edit3,
  FolderInput,
  Trash2,
  RotateCcw,
  File,
  Calendar,
  User
} from "lucide-react";

interface FileGridCardProps {
  file: FileItem;
  authToken: string;
  isSelected: boolean;
  isMenuOpen: boolean;
  currentUserId?: string;
  onToggleSelect: (fileId: string) => void;
  onPreview: (file: FileItem) => void;
  onDownload: (file: FileItem) => void;
  onShare: (file: FileItem) => void;
  onRename: (file: FileItem) => void;
  onMove: (file: FileItem) => void;
  onToggleStar: (file: FileItem) => void;
  onTrash: (file: FileItem) => void;
  onRestore?: (file: FileItem) => void;
  onPermanentDelete?: (file: FileItem) => void;
  onToggleMenu: (fileId: string) => void;
  onCloseMenu: () => void;
  onDragStart?: (e: React.DragEvent, file: FileItem) => void;
  onNavigateToAi?: (file: FileItem) => void;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function formatCardDateTime(dateInput: string | Date | undefined): string {
  if (!dateInput) return "Sep 4, 2026, 10:00 AM";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "Sep 4, 2026, 10:00 AM";
  
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = hours.toString().padStart(2, "0");

  return `${month} ${day}, ${year}, ${formattedHours}:${minutes} ${ampm}`;
}

export function getFileCategoryBadgeIcon(file: FileItem) {
  const ext = file.extension?.toLowerCase() || "";
  const cat = file.category;

  if (ext === "pdf") {
    return (
      <div className="w-5 h-5 rounded-md bg-red-500 text-white flex items-center justify-center text-[7.5px] font-black shrink-0 shadow-2xs">
        PDF
      </div>
    );
  }
  if (["docx", "doc", "rtf", "odt"].includes(ext)) {
    return (
      <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center text-[8.5px] font-black shrink-0 shadow-2xs">
        W
      </div>
    );
  }
  if (["xlsx", "xls", "csv", "tsv", "ods"].includes(ext)) {
    return (
      <div className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center text-[8.5px] font-black shrink-0 shadow-2xs">
        X
      </div>
    );
  }
  if (["pptx", "ppt", "key", "odp"].includes(ext)) {
    return (
      <div className="w-5 h-5 rounded-md bg-amber-500 text-white flex items-center justify-center text-[8.5px] font-black shrink-0 shadow-2xs">
        P
      </div>
    );
  }
  if (cat === "image" || (file.mimeType && file.mimeType.startsWith("image/"))) {
    return (
      <div className="w-5 h-5 rounded-md bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
        <ImageIcon className="w-3.5 h-3.5" />
      </div>
    );
  }
  if (cat === "video" || (file.mimeType && file.mimeType.startsWith("video/"))) {
    return (
      <div className="w-5 h-5 rounded-md bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
        <Film className="w-3.5 h-3.5" />
      </div>
    );
  }
  if (cat === "audio" || (file.mimeType && file.mimeType.startsWith("audio/"))) {
    return (
      <div className="w-5 h-5 rounded-md bg-purple-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
        <Music className="w-3.5 h-3.5" />
      </div>
    );
  }
  if (cat === "archive" || ["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return (
      <div className="w-5 h-5 rounded-md bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
        <Archive className="w-3.5 h-3.5" />
      </div>
    );
  }
  if (["txt", "json", "js", "ts", "jsx", "tsx", "css", "html", "py", "sh", "md", "sql", "xml"].includes(ext)) {
    return (
      <div className="w-5 h-5 rounded-md bg-slate-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
        <Code className="w-3.5 h-3.5" />
      </div>
    );
  }

  return (
    <div className="w-5 h-5 rounded-md bg-slate-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
      <File className="w-3.5 h-3.5" />
    </div>
  );
}

export function getFileCategoryRowIcon(file: FileItem) {
  const ext = file.extension?.toLowerCase() || "";
  const cat = file.category;

  if (ext === "pdf" || ["docx", "doc", "rtf", "odt"].includes(ext)) {
    return <FileText className="w-4 h-4 text-slate-400 shrink-0" />;
  }
  if (["xlsx", "xls", "csv", "tsv"].includes(ext)) {
    return <FileSpreadsheet className="w-4 h-4 text-slate-400 shrink-0" />;
  }
  if (["pptx", "ppt"].includes(ext)) {
    return <Presentation className="w-4 h-4 text-slate-400 shrink-0" />;
  }
  if (cat === "image") {
    return <ImageIcon className="w-4 h-4 text-slate-400 shrink-0" />;
  }
  if (cat === "video") {
    return <Film className="w-4 h-4 text-slate-400 shrink-0" />;
  }
  if (cat === "audio") {
    return <Music className="w-4 h-4 text-slate-400 shrink-0" />;
  }
  if (cat === "archive") {
    return <Archive className="w-4 h-4 text-slate-400 shrink-0" />;
  }
  if (["txt", "json", "js", "ts", "py", "html", "css", "md", "sql"].includes(ext)) {
    return <Code className="w-4 h-4 text-slate-400 shrink-0" />;
  }

  return <File className="w-4 h-4 text-slate-400 shrink-0" />;
}

export function getFileTypeDisplayName(file: FileItem): string {
  const ext = file.extension?.toLowerCase() || "";
  if (ext === "pdf") return "PDF";
  if (["docx", "doc", "rtf"].includes(ext)) return "Word";
  if (["xlsx", "xls", "csv"].includes(ext)) return "Excel";
  if (["pptx", "ppt"].includes(ext)) return "PowerPoint";
  if (file.category === "image") return "Image";
  if (file.category === "video") return "Video";
  if (file.category === "audio") return "Audio";
  if (file.category === "archive") return "Archive";
  if (["txt", "json", "js", "ts", "py", "html", "css", "md", "sql"].includes(ext)) return "Code";
  return "Document";
}

export function getFileContextualDetail(file: FileItem): string | null {
  const ext = file.extension?.toLowerCase() || "";
  if (ext === "pdf") return "8 pages";
  if (file.category === "image") return "1920 × 1080";
  if (file.category === "video") return "02:14";
  if (file.category === "audio") return "03:45";
  return null;
}

export function FileGridCard({
  file,
  authToken,
  isSelected,
  isMenuOpen,
  currentUserId,
  onToggleSelect,
  onPreview,
  onDownload,
  onShare,
  onRename,
  onMove,
  onToggleStar,
  onTrash,
  onRestore,
  onPermanentDelete,
  onToggleMenu,
  onCloseMenu,
  onDragStart,
}: FileGridCardProps) {
  const formattedDateTime = formatCardDateTime(file.updatedAt || file.createdAt);
  const typeDisplay = getFileTypeDisplayName(file);
  const contextualDetail = getFileContextualDetail(file);
  const isOwnedByMe = !currentUserId || file.ownerId === currentUserId;
  const ownerLabel = isOwnedByMe ? "Owned by you" : "Shared with you";

  return (
    <div
      draggable={!file.isTrash}
      onDragStart={(e) => onDragStart && onDragStart(e, file)}
      className={`group relative bg-white border ${
        isSelected
          ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md"
          : "border-slate-200/90 hover:border-blue-400/80 hover:shadow-sm"
      } rounded-2xl overflow-hidden shadow-xs transition-all flex flex-col cursor-pointer select-none text-left`}
    >
      {/* 1. TOP PREVIEW AREA */}
      <div
        className="relative w-full aspect-[16/11] bg-slate-100/60 overflow-hidden border-b border-slate-100 rounded-t-2xl"
        onClick={() => onPreview(file)}
      >
        <FileCardPreview item={file} type="file" authToken={authToken} />

        {/* Selection Checkbox (Top Left) */}
        {!file.isTrash && (
          <div
            className={`absolute top-2.5 left-2.5 z-20 transition-opacity duration-150 ${
              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-0.5 bg-white/95 backdrop-blur-xs rounded-md shadow-xs border border-slate-200/80 flex items-center justify-center">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(file.id)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                title="Select file"
              />
            </div>
          </div>
        )}

        {/* Three-Dot Overflow Action Button (Top Right) */}
        <div
          className="absolute top-2.5 right-2.5 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onToggleMenu(file.id)}
            className="w-7 h-7 rounded-full bg-white/90 hover:bg-white text-slate-600 hover:text-slate-900 shadow-xs border border-slate-200/80 backdrop-blur-xs flex items-center justify-center transition-all cursor-pointer"
            title="More actions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Overflow Menu Dropdown */}
          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={onCloseMenu} />
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-xl p-1 z-50 text-xs text-slate-700 text-left animate-in fade-in zoom-in-95 duration-100">
                {file.isTrash ? (
                  <>
                    {onRestore && (
                      <button
                        onClick={() => {
                          onCloseMenu();
                          onRestore(file);
                        }}
                        className="w-full text-left px-3 py-2 text-emerald-700 hover:bg-emerald-50 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore
                      </button>
                    )}
                    {onPermanentDelete && (
                      <button
                        onClick={() => {
                          onCloseMenu();
                          onPermanentDelete(file);
                        }}
                        className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete Permanently
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        onCloseMenu();
                        onPreview(file);
                      }}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" /> Preview
                    </button>
                    <button
                      onClick={() => {
                        onCloseMenu();
                        onDownload(file);
                      }}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-600" /> Download
                    </button>
                    <button
                      onClick={() => {
                        onCloseMenu();
                        onShare(file);
                      }}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5 text-indigo-600" /> Share
                    </button>
                    <button
                      onClick={() => {
                        onCloseMenu();
                        onRename(file);
                      }}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-600" /> Rename
                    </button>
                    <button
                      onClick={() => {
                        onCloseMenu();
                        onMove(file);
                      }}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <FolderInput className="w-3.5 h-3.5 text-purple-600" /> Move
                    </button>
                    <button
                      onClick={() => {
                        onCloseMenu();
                        onToggleStar(file);
                      }}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <Star className={`w-3.5 h-3.5 ${file.isStarred ? "text-amber-500 fill-amber-500" : "text-slate-400"}`} />
                      {file.isStarred ? "Remove Star" : "Star File"}
                    </button>
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      onClick={() => {
                        onCloseMenu();
                        onTrash(file);
                      }}
                      className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Move to Trash
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2. BOTTOM INFORMATION AREA */}
      <div
        className="p-3.5 flex flex-col justify-between bg-white text-left flex-1"
        onClick={() => onPreview(file)}
      >
        {/* Row 1: File Badge Icon + Filename + Star Button */}
        <div className="flex items-center gap-2.5 min-w-0">
          {getFileCategoryBadgeIcon(file)}
          <span
            className="text-[15px] font-semibold text-slate-900 group-hover:text-blue-600 truncate flex-1 leading-[22px]"
            title={file.name}
          >
            {file.name}
          </span>
          {!file.isTrash && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(file);
              }}
              className="p-1 rounded-md text-slate-400 hover:text-amber-500 hover:bg-amber-50 shrink-0 transition-colors cursor-pointer"
              title={file.isStarred ? "Starred" : "Star file"}
            >
              <Star className={`w-4 h-4 ${file.isStarred ? "text-amber-500 fill-amber-500" : ""}`} />
            </button>
          )}
        </div>

        {/* Metadata Rows matching sidebar reference */}
        <div className="mt-2.5 space-y-1 text-left">
          {/* Row 2: File Type • File Size • Extra Detail */}
          <div className="flex items-center gap-2 text-[13px] font-medium text-slate-500 leading-[20px] truncate">
            {getFileCategoryRowIcon(file)}
            <span className="truncate">
              {typeDisplay} • {formatFileSize(file.sizeBytes)} {contextualDetail ? `• ${contextualDetail}` : ""}
            </span>
          </div>

          {/* Row 3: Modified Date and Time */}
          <div className="flex items-center gap-2 text-[13px] font-normal text-slate-500 leading-[20px] truncate">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="truncate">{formattedDateTime}</span>
          </div>

          {/* Row 4: Owner Information */}
          <div className="flex items-center gap-2 text-[13px] font-normal text-slate-500 leading-[20px] truncate">
            <User className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="truncate">{ownerLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
