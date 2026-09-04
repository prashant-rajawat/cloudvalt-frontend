import React from "react";
import { FolderItem } from "../types/index.js";
import { FileCardPreview } from "./FileCardPreview.js";
import { formatCardDateTime } from "./FileGridCard.js";
import {
  Folder,
  MoreVertical,
  Star,
  Share2,
  Edit3,
  FolderInput,
  Trash2,
  RotateCcw,
  Calendar,
  User
} from "lucide-react";

interface FolderGridCardProps {
  folder: FolderItem;
  itemCount?: number | string;
  authToken: string;
  isMenuOpen: boolean;
  currentUserId?: string;
  isDragTarget?: boolean;
  onOpenFolder: (folder: FolderItem) => void;
  onShare: (folder: FolderItem) => void;
  onRename: (folder: FolderItem) => void;
  onMove: (folder: FolderItem) => void;
  onToggleStar: (folder: FolderItem) => void;
  onTrash: (folder: FolderItem) => void;
  onRestore?: (folder: FolderItem) => void;
  onPermanentDelete?: (folder: FolderItem) => void;
  onToggleMenu: (folderId: string) => void;
  onCloseMenu: () => void;
  onDragStart?: (e: React.DragEvent, folder: FolderItem) => void;
  onDragOver?: (e: React.DragEvent, folder: FolderItem) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, folder: FolderItem) => void;
}

export function FolderGridCard({
  folder,
  itemCount,
  authToken,
  isMenuOpen,
  currentUserId,
  isDragTarget,
  onOpenFolder,
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
  onDragOver,
  onDragLeave,
  onDrop,
}: FolderGridCardProps) {
  const formattedDateTime = formatCardDateTime(folder.updatedAt || folder.createdAt);
  const isOwnedByMe = !currentUserId || folder.ownerId === currentUserId;
  const ownerLabel = isOwnedByMe ? "Owned by you" : "Shared with you";

  const countDisplay = typeof itemCount === "number" ? `${itemCount} ${itemCount === 1 ? "item" : "items"}` : itemCount ? `${itemCount} items` : "0 items";

  return (
    <div
      draggable={!folder.isTrash}
      onDragStart={(e) => onDragStart && onDragStart(e, folder)}
      onDragOver={(e) => onDragOver && onDragOver(e, folder)}
      onDragLeave={(e) => onDragLeave && onDragLeave(e)}
      onDrop={(e) => onDrop && onDrop(e, folder)}
      className={`group relative bg-white border ${
        isDragTarget
          ? "border-blue-500 ring-2 ring-blue-400 bg-blue-50/20"
          : "border-slate-200/90 hover:border-blue-400/80 hover:shadow-sm"
      } rounded-2xl overflow-hidden shadow-xs transition-all flex flex-col cursor-pointer select-none text-left`}
    >
      {/* 1. TOP PREVIEW AREA */}
      <div
        className="relative w-full aspect-[16/11] bg-blue-50/40 overflow-hidden border-b border-slate-100 rounded-t-2xl"
        onClick={() => onOpenFolder(folder)}
      >
        <FileCardPreview item={folder} type="folder" authToken={authToken} />

        {/* Three-Dot Overflow Action Button (Top Right) */}
        <div
          className="absolute top-2.5 right-2.5 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onToggleMenu(folder.id)}
            className="w-7 h-7 rounded-full bg-white/90 hover:bg-white text-slate-600 hover:text-slate-900 shadow-xs border border-slate-200/80 backdrop-blur-xs flex items-center justify-center transition-all cursor-pointer"
            title="More actions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Dropdown Menu */}
          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={onCloseMenu} />
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-xl p-1 z-50 text-xs text-slate-700 text-left animate-in fade-in zoom-in-95 duration-100">
                {folder.isTrash ? (
                  <>
                    {onRestore && (
                      <button
                        onClick={() => {
                          onCloseMenu();
                          onRestore(folder);
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
                          onPermanentDelete(folder);
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
                        onOpenFolder(folder);
                      }}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <Folder className="w-3.5 h-3.5 text-blue-600" /> Open Folder
                    </button>
                    <button
                      onClick={() => {
                        onCloseMenu();
                        onShare(folder);
                      }}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5 text-indigo-600" /> Share
                    </button>
                    <button
                      onClick={() => {
                        onCloseMenu();
                        onRename(folder);
                      }}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-600" /> Rename
                    </button>
                    <button
                      onClick={() => {
                        onCloseMenu();
                        onMove(folder);
                      }}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <FolderInput className="w-3.5 h-3.5 text-purple-600" /> Move
                    </button>
                    <button
                      onClick={() => {
                        onCloseMenu();
                        onToggleStar(folder);
                      }}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <Star className={`w-3.5 h-3.5 ${folder.isStarred ? "text-amber-500 fill-amber-500" : "text-slate-400"}`} />
                      {folder.isStarred ? "Remove Star" : "Star Folder"}
                    </button>
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      onClick={() => {
                        onCloseMenu();
                        onTrash(folder);
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
        onClick={() => onOpenFolder(folder)}
      >
        {/* Row 1: Folder Icon + Folder Name + Star Button */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-5 h-5 rounded-md bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Folder className="w-3.5 h-3.5 fill-white" />
          </div>
          <span
            className="text-[15px] font-semibold text-slate-900 group-hover:text-blue-600 truncate flex-1 leading-[22px]"
            title={folder.name}
          >
            {folder.name}
          </span>
          {!folder.isTrash && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(folder);
              }}
              className="p-1 rounded-md text-slate-400 hover:text-amber-500 hover:bg-amber-50 shrink-0 transition-colors cursor-pointer"
              title={folder.isStarred ? "Starred" : "Star folder"}
            >
              <Star className={`w-4 h-4 ${folder.isStarred ? "text-amber-500 fill-amber-500" : ""}`} />
            </button>
          )}
        </div>

        {/* Metadata Rows matching sidebar reference */}
        <div className="mt-2.5 space-y-1 text-left">
          {/* Row 2: Folder • Item Count */}
          <div className="flex items-center gap-2 text-[13px] font-medium text-slate-500 leading-[20px] truncate">
            <Folder className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="truncate">Folder • {countDisplay}</span>
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
