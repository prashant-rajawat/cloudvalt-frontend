import React, { useState, useEffect, useRef, useMemo } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase.js";
import { FileItem, FolderItem, FileCategory, StorageQuota, UserProfile, NotificationItem, DEFAULT_STORAGE_QUOTA_BYTES } from "../types/index.js";
import { 
  fetchSignedDownloadUrl, 
  permanentlyDeleteFile, 
  fetchSharedWithMe,
  removeSharedWithMe,
  createFolder,
  updateFolder,
  trashFolder,
  restoreFolder,
  permanentlyDeleteFolder,
  trashFile,
  restoreFile,
  cleanupTrash,
  initUpload,
  completeUpload,
  starFile,
  updateFile
} from "../lib/api.js";
import { logUserActivity } from "../lib/activity.js";
import { createNotification } from "../lib/notifications.js";
import { AnnouncementBanner } from "./AnnouncementBanner.js";
import { NotificationPanel, NotificationBell } from "./NotificationPanel.js";
import { FileCardPreview } from "./FileCardPreview.js";
import { FileGridCard } from "./FileGridCard.js";
import { FolderGridCard } from "./FolderGridCard.js";
import { VideoPlayer } from "./VideoPlayer.js";
import {
  Folder,
  Plus,
  Upload,
  Search,
  Star,
  Trash2,
  Share2,
  Download,
  Copy,
  MoreVertical,
  ChevronRight,
  ChevronLeft,
  FolderPlus,
  Eye,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  Code,
  LayoutGrid,
  List,
  RotateCcw,
  Clock,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowUpDown,
  Filter,
  X,
  Edit3,
  FolderInput,
  PieChart,
  BarChart3,
  AlertTriangle,
  ExternalLink,
  Layers,
  Sparkles,
  Database,
  Bell,
  Lock,
  Shield,
  ShieldCheck,
  UserCheck,
  Info
} from "lucide-react";

export interface AdvancedFilters {
  category: string; // "all" | "image" | "document" | "video" | "audio" | "archive" | "folder"
  location: string; // "all" | "my_drive" | "starred" | "trash" | "shared"
  dateRange: string; // "all" | "today" | "7days" | "30days" | "this_year" | "custom"
  customStartDate?: string;
  customEndDate?: string;
  sizeRange: string; // "all" | "small" | "medium" | "large" | "custom"
  minSizeBytes?: number;
  maxSizeBytes?: number;
}

export type SortOption = "name-asc" | "name-desc" | "date-desc" | "date-asc" | "size-desc" | "size-asc";

export interface DriveDashboardProps {
  user: { id: string; email: string };
  profile: UserProfile | null;
  authToken: string;
  initialFilter?: string;
  currentPath?: string;
  onNavigate?: (path: string) => void;
  onOpenShareModal: (item: { type: "file" | "folder"; item: FileItem | FolderItem }) => void;
  onOpenProfileModal: () => void;
  onQuotaUpdated: (quota: StorageQuota) => void;
  notifications: NotificationItem[];
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onNotificationClick: (notif: NotificationItem) => void;
}

export function DriveDashboard({
  user,
  profile,
  authToken,
  initialFilter = "all",
  currentPath = "/dashboard",
  onNavigate,
  onOpenShareModal,
  onOpenProfileModal,
  onQuotaUpdated,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onNotificationClick,
}: DriveDashboardProps) {
  // Navigation & Filter Mode State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: "My Drive" },
  ]);
  const [sidebarFilter, setSidebarFilter] = useState<"all" | "recent" | "starred" | "trash" | "shared" | "storage" | "search">("all");
  const [isNotifPanelOpen, setIsNotifPanelOpen] = useState(false);

  // Sync sidebarFilter with initialFilter / currentPath
  useEffect(() => {
    if (initialFilter === "starred") setSidebarFilter("starred");
    else if (initialFilter === "trash") setSidebarFilter("trash");
    else if (initialFilter === "shared") setSidebarFilter("shared");
    else if (initialFilter === "recent") setSidebarFilter("recent");
    else if (initialFilter === "storage") setSidebarFilter("storage");
    else if (initialFilter === "search") setSidebarFilter("search");
    else setSidebarFilter("all");
  }, [initialFilter]);

  // Search State & Debouncing
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Parse search query from URL if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) {
      setSearchInput(q);
      setDebouncedSearchQuery(q);
      setSidebarFilter("search");
    }
  }, []);

  // 300ms Debounce for Global Search
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim();
      setDebouncedSearchQuery(trimmed);
      if (trimmed && sidebarFilter !== "search") {
        setSidebarFilter("search");
        if (onNavigate) onNavigate(`/search?q=${encodeURIComponent(trimmed)}`);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Advanced Filters State
  const [filters, setFilters] = useState<AdvancedFilters>({
    category: "all",
    location: "all",
    dateRange: "all",
    sizeRange: "all",
  });

  // Sorting Choice (Persisted in LocalStorage)
  const [sortOption, setSortOption] = useState<SortOption>(() => {
    return (localStorage.getItem("cloudvault_sort_pref") as SortOption) || "date-desc";
  });

  useEffect(() => {
    localStorage.setItem("cloudvault_sort_pref", sortOption);
  }, [sortOption]);

  // View Mode Choice (Grid / List)
  const [viewMode, setViewMode] = useState<"grid" | "list">(
    (localStorage.getItem("cloudvault_view_mode") as "grid" | "list") || "grid"
  );

  useEffect(() => {
    localStorage.setItem("cloudvault_view_mode", viewMode);
  }, [viewMode]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 16;

  // Reset pagination when filters, sort, or folder change
  useEffect(() => {
    setCurrentPage(1);
  }, [currentFolderId, sidebarFilter, debouncedSearchQuery, filters, sortOption]);

  // Data State
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [sharedItems, setSharedItems] = useState<any[]>([]);
  const [sharedViewMode, setSharedViewMode] = useState<"list" | "grid">("list");
  const [sharedSortOption, setSharedSortOption] = useState<string>("date-desc");
  const [sharedCategoryFilter, setSharedCategoryFilter] = useState<string>("all");
  const [sharedPermissionFilter, setSharedPermissionFilter] = useState<string>("all");
  const [sharedPage, setSharedPage] = useState<number>(1);
  const [sharerProfiles, setSharerProfiles] = useState<Record<string, any>>({});
  const [selectedSharedItemMenu, setSelectedSharedItemMenu] = useState<string | null>(null);
  const [detailSharedItem, setDetailSharedItem] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setSuccessToast(message);
    setTimeout(() => {
      setSuccessToast(null);
    }, 3000);
  };

  // Version History State & Handlers
  const [versionHistoryTargetFile, setVersionHistoryTargetFile] = useState<FileItem | null>(null);
  const [versionHistoryList, setVersionHistoryList] = useState<any[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [versionActionLoading, setVersionActionLoading] = useState<string | null>(null);

  const handleOpenVersionHistory = async (file: FileItem) => {
    setVersionHistoryTargetFile(file);
    setIsLoadingVersions(true);
    try {
      const res = await fetch(`/api/files/${file.id}/versions`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setVersionHistoryList(data.versions || []);
        setCurrentVersionId(data.currentVersionId);
      } else {
        showToast(data.message || "Failed to load version history.");
      }
    } catch (err: any) {
      showToast("Error loading version history.");
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const handleUploadNewVersion = async (fileId: string, fileObj: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      setVersionActionLoading("upload");
      try {
        const res = await fetch(`/api/files/${fileId}/versions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({
            base64Data: base64,
            fileName: fileObj.name,
            mimeType: fileObj.type,
            sizeBytes: fileObj.size
          })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || "New version uploaded successfully.");
          loadData();
          if (versionHistoryTargetFile) {
            handleOpenVersionHistory(versionHistoryTargetFile);
          }
        } else {
          showToast(data.message || "Failed to upload new version.");
        }
      } catch (err: any) {
        showToast("Error uploading new version.");
      } finally {
        setVersionActionLoading(null);
      }
    };
    reader.readAsDataURL(fileObj);
  };

  const handleRestoreVersion = async (fileId: string, versionId: string, versionNum: number) => {
    if (!window.confirm(`Are you sure you want to restore Version ${versionNum} as current?`)) return;
    setVersionActionLoading(versionId);
    try {
      const res = await fetch(`/api/files/${fileId}/versions/${versionId}/restore`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Version restored successfully.");
        loadData();
        if (versionHistoryTargetFile) {
          handleOpenVersionHistory(versionHistoryTargetFile);
        }
      } else {
        showToast(data.message || "Failed to restore version.");
      }
    } catch (err: any) {
      showToast("Error restoring version.");
    } finally {
      setVersionActionLoading(null);
    }
  };

  const handleDownloadVersion = async (fileId: string, versionId: string) => {
    setVersionActionLoading(versionId);
    try {
      const res = await fetch(`/api/files/${fileId}/versions/${versionId}/download`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success && data.downloadUrl) {
        const a = document.createElement("a");
        a.href = data.downloadUrl;
        a.download = "";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast("Version download started.");
      } else {
        showToast(data.message || "Failed to download version.");
      }
    } catch (err: any) {
      showToast("Error downloading version.");
    } finally {
      setVersionActionLoading(null);
    }
  };

  // Upload State
  const [uploads, setUploads] = useState<Record<string, {
    id: string;
    name: string;
    progress: number;
    status: "uploading" | "completed" | "failed" | "pending";
    error?: string;
    file: File;
  }>>({});
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag & Drop State
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ type: "file" | "folder"; id: string; name: string } | null>(null);

  // Modals & Menu Targets
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("blue");
  const [previewFile, setPreviewFile] = useState<{ file: FileItem; url: string } | null>(null);
  const [selectedFileForMenu, setSelectedFileForMenu] = useState<string | null>(null);
  const [selectedFolderForMenu, setSelectedFolderForMenu] = useState<string | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ type: "file" | "folder"; item: FileItem | FolderItem } | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ type: "file" | "folder"; id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [modalErrorMsg, setModalErrorMsg] = useState<string | null>(null);

  const openRenameModal = (type: "file" | "folder", id: string, name: string) => {
    setRenameTarget({ type, id, name });
    setRenameValue(name);
    setModalErrorMsg(null);
  };
  const [moveTarget, setMoveTarget] = useState<{ type: "file" | "folder"; id: string; name: string; currentParentId: string | null } | null>(null);
  const [selectedMoveFolderId, setSelectedMoveFolderId] = useState<string | null>(null);
  const [moveModalNavFolderId, setMoveModalNavFolderId] = useState<string | null>(null);
  const [moveSearchQuery, setMoveSearchQuery] = useState<string>("");
  const [moveModalErrorMsg, setMoveModalErrorMsg] = useState<string | null>(null);

  // Copy Modal States
  const [copyTarget, setCopyTarget] = useState<FileItem | null>(null);
  const [selectedCopyFolderId, setSelectedCopyFolderId] = useState<string | null>(null);
  const [copyModalNavFolderId, setCopyModalNavFolderId] = useState<string | null>(null);
  const [copySearchQuery, setCopySearchQuery] = useState<string>("");
  const [copyModalErrorMsg, setCopyModalErrorMsg] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState<boolean>(false);

  const openCopyModal = (file: FileItem, permission?: string) => {
    if (permission === "viewer") {
      setErrorMsg("Viewers cannot copy files if not permitted.");
      return;
    }
    setCopyTarget(file);
    setSelectedCopyFolderId(file.folderId);
    setCopyModalNavFolderId(file.folderId);
    setCopySearchQuery("");
    setCopyModalErrorMsg(null);
  };

  const handleCopySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copyTarget) return;

    setIsCopying(true);
    setCopyModalErrorMsg(null);

    try {
      const response = await fetch(`/api/files/${copyTarget.id}/copy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ folderId: selectedCopyFolderId }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to copy file");
      }

      showToast(`File copied successfully: "${data.file?.name || copyTarget.name}"`);
      setCopyTarget(null);
      setSelectedCopyFolderId(null);
      setCopyModalNavFolderId(null);
      setCopySearchQuery("");
      setCopyModalErrorMsg(null);
      loadData();
    } catch (err: any) {
      setCopyModalErrorMsg(err.message || "Failed to copy file");
    } finally {
      setIsCopying(false);
    }
  };

  // Multiple File Selection & Bulk Delete States
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState<boolean>(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);

  const handleToggleFileSelect = (fileId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const handleSelectAllVisibleFiles = () => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      const visibleIds = paginatedFiles.map((f) => f.id);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => next.has(id));
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedFileIds(new Set());
  };

  const handleBulkDeleteSubmit = async () => {
    if (selectedFileIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const response = await fetch("/api/files/bulk-trash", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ fileIds: Array.from(selectedFileIds) }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to complete bulk delete");
      }
      showToast(data.message || `${data.trashedCount} files moved to Trash.`);
      setSelectedFileIds(new Set());
      setIsBulkDeleteModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to perform bulk delete");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const openMoveModal = (item: FileItem | FolderItem, type: "file" | "folder", permission?: string) => {
    if (permission === "viewer") {
      setErrorMsg("Viewers cannot move files. You need editor permission to move this file.");
      return;
    }
    const currentParent = type === "file" ? (item as FileItem).folderId : (item as FolderItem).parentId;
    setMoveTarget({ type, id: item.id, name: item.name, currentParentId: currentParent });
    setSelectedMoveFolderId(currentParent);
    setMoveModalNavFolderId(currentParent);
    setMoveSearchQuery("");
    setMoveModalErrorMsg(null);
  };

  // Redesigned Storage States
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [storageTimeFilter, setStorageTimeFilter] = useState<string>("this_month");
  const [selectedStorageFileMenu, setSelectedStorageFileMenu] = useState<string | null>(null);

  // Redesigned Trash & Folder Lifecycle States
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [selectedTrashItems, setSelectedTrashItems] = useState<Set<string>>(new Set());
  const [trashSortOption, setTrashSortOption] = useState<"expires-soonest" | "date-desc" | "date-asc" | "size-desc" | "size-asc" | "name-asc" | "name-desc">("expires-soonest");
  
  // Trashing & Restore States
  const [undoTarget, setUndoTarget] = useState<{ type: "file" | "folder"; item: FileItem | FolderItem } | null>(null);
  const [folderTrashConfirmTarget, setFolderTrashConfirmTarget] = useState<FolderItem | null>(null);
  const [fileTrashConfirmTarget, setFileTrashConfirmTarget] = useState<FileItem | null>(null);
  const [isEmptyTrashOpen, setIsEmptyTrashOpen] = useState(false);
  const [restoreRecoveryTarget, setRestoreRecoveryTarget] = useState<{
    type: "file" | "folder";
    item: FileItem | FolderItem;
    originalParentId: string | null;
  } | null>(null);
  const [selectedRecoveryParentId, setSelectedRecoveryParentId] = useState<string | null>(null);
  const [bulkActionTarget, setBulkActionTarget] = useState<"restore" | "delete" | null>(null);

  // Live countdown ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initial & Reactive Load Data
  useEffect(() => {
    loadData();
  }, [user.id, sidebarFilter]);

  const fetchSharerProfiles = async (shares: any[]) => {
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      const ownerIds = Array.from(new Set(shares.map(item => item.owner_id).filter(Boolean)));
      if (ownerIds.length === 0) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url")
        .in("id", ownerIds);
      if (error) {
        console.error("Error fetching profiles:", error);
        return;
      }
      if (data) {
        const profileMap: Record<string, any> = {};
        data.forEach(p => {
          profileMap[p.id] = p;
        });
        setSharerProfiles(prev => ({ ...prev, ...profileMap }));
      }
    } catch (err) {
      console.error("Failed to load profiles:", err);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    try {
      if (authToken) {
        const res = await removeSharedWithMe(authToken, shareId);
        if (!res.success) {
          throw new Error(res.error || "Failed to remove shared item");
        }
      } else {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) return;
        const { error } = await supabase
          .from("shares")
          .delete()
          .eq("id", shareId);
        if (error) throw error;
      }
      showToast("Successfully removed shared item from your list.");
      setSharedItems(prev => prev.filter(item => item.id !== shareId));
    } catch (err: any) {
      alert("Failed to remove: " + (err.message || "An error occurred"));
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setErrorMsg("Supabase client is not connected.");
      setIsLoading(false);
      return;
    }

    try {
      // Trigger background trash cleanup
      if (authToken) {
        cleanupTrash(authToken).catch(() => {});
      }

      if (sidebarFilter === "shared") {
        const res = await fetchSharedWithMe(authToken);
        if (res.success) {
          setSharedItems(res.shares || []);
          fetchSharerProfiles(res.shares || []);
        }
        setIsLoading(false);
        return;
      }

      // Fetch Folders owned by user
      const { data: dbFolders, error: folderErr } = await supabase
        .from("folders")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (folderErr) throw folderErr;

      // Fetch Files owned by user
      const { data: dbFiles, error: fileErr } = await supabase
        .from("files")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (fileErr) throw fileErr;

      const mappedFolders: FolderItem[] = (dbFolders || []).map((f) => ({
        id: f.id,
        name: f.name,
        parentId: f.parent_id,
        ownerId: f.owner_id,
        color: f.color || "blue",
        isStarred: f.is_starred || false,
        isTrash: f.is_trash || false,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
      }));

      const mappedFiles: FileItem[] = (dbFiles || []).map((f) => ({
        id: f.id,
        ownerId: f.owner_id,
        name: f.name,
        originalName: f.original_name,
        extension: f.extension,
        mimeType: f.mime_type,
        category: f.category || "other",
        sizeBytes: f.size_bytes || 0,
        storagePath: f.storage_path,
        folderId: f.folder_id,
        isStarred: f.is_starred || false,
        isTrash: f.is_trash || false,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
      }));

      setFolders(mappedFolders);
      setFiles(mappedFiles);

      // Compute total quota and used storage (Default 15 GB)
      const activeFiles = mappedFiles.filter((f) => !f.isTrash);
      const usedBytes = activeFiles.reduce((acc, curr) => acc + curr.sizeBytes, 0);
      const totalBytes = (!profile?.storage_quota_bytes || profile.storage_quota_bytes === 5368709120)
        ? DEFAULT_STORAGE_QUOTA_BYTES
        : profile.storage_quota_bytes;

      onQuotaUpdated({
        usedBytes,
        totalBytes,
        fileCount: activeFiles.length,
        folderCount: mappedFolders.filter((f) => !f.isTrash).length,
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to fetch drive data.");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to detect category from mime/extension
  const detectCategory = (mimeType: string, filename: string): FileCategory => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (mimeType.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext)) return "image";
    if (mimeType.startsWith("video/") || ["mp4", "mkv", "webm", "mov", "avi"].includes(ext)) return "video";
    if (mimeType.startsWith("audio/") || ["mp3", "wav", "ogg", "flac", "aac"].includes(ext)) return "audio";
    if (
      mimeType.includes("pdf") ||
      mimeType.includes("document") ||
      mimeType.includes("text") ||
      ["pdf", "docx", "doc", "txt", "rtf", "md", "csv", "xlsx", "pptx"].includes(ext)
    )
      return "document";
    if (mimeType.includes("zip") || mimeType.includes("tar") || ["zip", "rar", "7z", "tar", "gz"].includes(ext))
      return "archive";
    return "other";
  };

  // Robust File Upload Handler
  const startUpload = async (filesToUpload: FileList | File[]) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setErrorMsg("Supabase client unavailable.");
      return;
    }

    const filesArray = Array.from(filesToUpload);
    const newUploads = { ...uploads };
    const uploadIds: string[] = [];

    // Initial validation and adding to state
    for (const file of filesArray) {
      const uploadId = `${Date.now()}-${file.name}-${Math.random().toString(36).substr(2, 9)}`;
      newUploads[uploadId] = {
        id: uploadId,
        name: file.name,
        progress: 0,
        status: "pending",
        file,
      };
      uploadIds.push(uploadId);
    }
    setUploads(newUploads);
    setShowUploadPanel(true);

    // Process uploads
    for (const uploadId of uploadIds) {
      const upload = newUploads[uploadId];
      const { file } = upload;

      try {
        setUploads(prev => ({
          ...prev,
          [uploadId]: { ...prev[uploadId], status: "uploading", progress: 5 }
        }));

        // 1. Initialize Upload (Backend)
        const initRes = await initUpload(authToken, {
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          folderId: currentFolderId,
        });

        if (!initRes.success) throw new Error(initRes.message || "Init failed");

        const { file: dbFile, storagePath } = initRes;

        setUploads(prev => ({
          ...prev,
          [uploadId]: { ...prev[uploadId], progress: 20 }
        }));

        // 2. Upload to Storage
        const { error: storageError } = await supabase.storage
          .from("cloudvault-files")
          .upload(storagePath, file, {
            contentType: file.type || "application/octet-stream",
            upsert: true,
          });

        if (storageError) throw storageError;

        setUploads(prev => ({
          ...prev,
          [uploadId]: { ...prev[uploadId], progress: 80 }
        }));

        // 3. Complete Upload (Backend)
        const completeRes = await completeUpload(authToken, dbFile.id);
        if (!completeRes.success) throw new Error(completeRes.message || "Complete failed");

        setUploads(prev => ({
          ...prev,
          [uploadId]: { ...prev[uploadId], status: "completed", progress: 100 }
        }));

        logUserActivity(user.id, "upload", "file", file.name, null, { size: file.size });
        createNotification(user.id, "file_activity", "File Uploaded", `Your file ${file.name} was successfully uploaded.`);
        
      } catch (err: any) {
        console.error("Upload failed for", file.name, err);
        setUploads(prev => ({
          ...prev,
          [uploadId]: { ...prev[uploadId], status: "failed", error: err.message }
        }));
      }
    }

    loadData();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      startUpload(event.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const retryUpload = (uploadId: string) => {
    const upload = uploads[uploadId];
    if (!upload) return;
    
    setUploads(prev => ({
      ...prev,
      [uploadId]: { ...prev[uploadId], status: "pending", progress: 0, error: undefined }
    }));
    
    startUpload([upload.file]);
  };

  const clearCompletedUploads = () => {
    setUploads(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(id => {
        if (next[id].status === "completed") delete next[id];
      });
      return next;
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      startUpload(e.dataTransfer.files);
    }
  };

  // Recursive child check to prevent circular folder nesting
  const isChild = (targetParentId: string | null, movingFolderId: string): boolean => {
    if (!targetParentId) return false;
    if (targetParentId === movingFolderId) return true;
    const parent = folders.find((f) => f.id === targetParentId);
    if (!parent) return false;
    if (parent.parentId === movingFolderId) return true;
    return isChild(parent.parentId, movingFolderId);
  };

  // Folder color styling map
  const getFolderColorClasses = (color?: string) => {
    switch (color) {
      case "indigo":
        return { text: "text-indigo-600", bg: "bg-indigo-50", fill: "fill-indigo-500/20", border: "border-indigo-200" };
      case "rose":
        return { text: "text-rose-600", bg: "bg-rose-50", fill: "fill-rose-500/20", border: "border-rose-200" };
      case "emerald":
        return { text: "text-emerald-600", bg: "bg-emerald-50", fill: "fill-emerald-500/20", border: "border-emerald-200" };
      case "amber":
        return { text: "text-amber-600", bg: "bg-amber-50", fill: "fill-amber-500/20", border: "border-amber-200" };
      case "purple":
        return { text: "text-purple-600", bg: "bg-purple-50", fill: "fill-purple-500/20", border: "border-purple-200" };
      case "blue":
      default:
        return { text: "text-blue-600", bg: "bg-blue-50", fill: "fill-blue-500/20", border: "border-blue-200" };
    }
  };

  // Get active item counts inside a folder as formatted string
  const getFolderItemCount = (folderId: string): string => {
    const fileCount = files.filter((f) => f.folderId === folderId && !f.isTrash).length;
    const subfolderCount = folders.filter((f) => f.parentId === folderId && !f.isTrash).length;
    const total = fileCount + subfolderCount;
    return total === 0 ? "0 items" : total === 1 ? "1 item" : `${total} items`;
  };

  // Validate folder name against empty, invalid characters and duplicates
  const validateFolderName = (
    name: string,
    parentId: string | null,
    excludeId?: string
  ): { valid: boolean; error?: string } => {
    const trimmed = name.trim();
    if (!trimmed) {
      return { valid: false, error: "Folder name is required." };
    }
    const INVALID_CHARS_REGEX = /[\\/:*?"<>|]/;
    if (INVALID_CHARS_REGEX.test(trimmed)) {
      return {
        valid: false,
        error: 'Folder name cannot contain any of the following characters: \\ / : * ? " < > |',
      };
    }
    if (trimmed.length > 255) {
      return { valid: false, error: "Folder name cannot exceed 255 characters." };
    }
    const exists = folders.some(
      (f) =>
        !f.isTrash &&
        (f.parentId || null) === (parentId || null) &&
        f.name.toLowerCase() === trimmed.toLowerCase() &&
        f.id !== excludeId
    );
    if (exists) {
      return {
        valid: false,
        error: "A folder with this name already exists in this location.",
      };
    }
    return { valid: true };
  };

  // Get breadcrumb array for folder navigation inside Move modal
  const getFolderBreadcrumbs = (folderId: string | null): FolderItem[] => {
    const crumbs: FolderItem[] = [];
    let currId = folderId;
    const visited = new Set<string>();
    while (currId && !visited.has(currId)) {
      visited.add(currId);
      const folder = folders.find((f) => f.id === currId && !f.isTrash);
      if (!folder) break;
      crumbs.unshift(folder);
      currId = folder.parentId;
    }
    return crumbs;
  };

  // Build hierarchical folder tree options for Move modal
  const getFolderTreeOptions = (
    allFolders: FolderItem[],
    excludeId: string | null
  ): { id: string; name: string; depth: number; color: string }[] => {
    const activeFolders = allFolders.filter((f) => !f.isTrash);
    const buildOptions = (parentId: string | null = null, depth: number = 0): { id: string; name: string; depth: number; color: string }[] => {
      const children = activeFolders.filter((f) => (f.parentId || null) === parentId);
      let result: { id: string; name: string; depth: number; color: string }[] = [];
      for (const child of children) {
        if (excludeId && (child.id === excludeId || isChild(child.id, excludeId))) {
          continue;
        }
        result.push({
          id: child.id,
          name: child.name,
          depth,
          color: child.color || "blue",
        });
        result = result.concat(buildOptions(child.id, depth + 1));
      }
      return result;
    };
    return buildOptions(null, 0);
  };

  // Handle Drag & Drop move onto a folder or breadcrumb
  const handleDropOnFolder = async (targetFolderId: string | null) => {
    if (!draggedItem) return;
    const item = draggedItem;
    setDraggedItem(null);

    if (item.type === "folder") {
      if (targetFolderId === item.id) {
        setErrorMsg("Cannot move a folder into itself.");
        return;
      }
      if (isChild(targetFolderId, item.id)) {
        setErrorMsg("Cannot move a folder into one of its subfolders.");
        return;
      }
      setIsLoading(true);
      try {
        const res = await updateFolder(authToken, item.id, { parentId: targetFolderId });
        if (!res.success) throw new Error(res.message || "Failed to move folder");
        showToast(`Moved "${item.name}" to ${getFolderName(targetFolderId)}`);
        loadData();
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to move folder");
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(true);
      try {
        const res = await updateFile(authToken, item.id, { folderId: targetFolderId });
        if (!res.success) throw new Error(res.message || "Failed to move file");
        showToast(`Moved "${item.name}" to ${getFolderName(targetFolderId)}`);
        loadData();
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to move file");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Create Folder Handler
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateFolderName(newFolderName, currentFolderId);
    if (!validation.valid) {
      setErrorMsg(validation.error || "Invalid folder name");
      return;
    }

    const trimmedName = newFolderName.trim();
    setIsLoading(true);
    try {
      const res = await createFolder(authToken, {
        name: trimmedName,
        parentId: currentFolderId || null,
        color: newFolderColor,
      });

      if (!res.success) throw new Error(res.message || "Failed to create folder");

      logUserActivity(user.id, "create_folder", "folder", trimmedName);
      createNotification(user.id, "file_activity", "Folder Created", `Created folder ${trimmedName}.`);

      setIsNewFolderOpen(false);
      setNewFolderName("");
      showToast("Folder created successfully");
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create folder");
    } finally {
      setIsLoading(false);
    }
  };

  // Rename Handler
  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget) return;

    setModalErrorMsg(null);
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setModalErrorMsg("Name cannot be empty.");
      return;
    }

    const INVALID_CHARS_REGEX = /[\\/:*?"<>|]/;
    if (INVALID_CHARS_REGEX.test(trimmed)) {
      setModalErrorMsg('Name cannot contain any of the following characters: \\ / : * ? " < > |');
      return;
    }
    if (trimmed.length > 255) {
      setModalErrorMsg("Name cannot exceed 255 characters.");
      return;
    }

    if (renameTarget.type === "folder") {
      const currentFolder = folders.find((f) => f.id === renameTarget.id);
      const parentId = currentFolder ? currentFolder.parentId : null;
      const validation = validateFolderName(trimmed, parentId, renameTarget.id);
      if (!validation.valid) {
        setModalErrorMsg(validation.error || "Invalid folder name");
        return;
      }
    }

    setIsLoading(true);
    try {
      if (renameTarget.type === "folder") {
        const res = await updateFolder(authToken, renameTarget.id, { name: trimmed });
        if (!res.success) throw new Error(res.message || "Failed to rename folder");
        setFolders((prev) =>
          prev.map((f) => (f.id === renameTarget.id ? { ...f, name: res.folder?.name || trimmed } : f))
        );
      } else {
        const res = await updateFile(authToken, renameTarget.id, { name: trimmed });
        if (!res.success) throw new Error(res.message || "Failed to rename file");
        
        const updatedFile = res.file;
        if (updatedFile) {
          // Update main files state immediately for instant UI reaction across all views
          setFiles((prev) =>
            prev.map((f) =>
              f.id === updatedFile.id
                ? {
                    ...f,
                    name: updatedFile.name,
                    originalName: updatedFile.original_name || updatedFile.name,
                    extension: updatedFile.extension,
                    updatedAt: updatedFile.updated_at,
                  }
                : f
            )
          );

          // Update previewFile state if currently open
          setPreviewFile((prev) =>
            prev && prev.file.id === updatedFile.id
              ? {
                  ...prev,
                  file: {
                    ...prev.file,
                    name: updatedFile.name,
                    originalName: updatedFile.original_name || updatedFile.name,
                    extension: updatedFile.extension,
                    updatedAt: updatedFile.updated_at,
                  },
                }
              : prev
          );

          // Update sharedItems state if present
          setSharedItems((prev) =>
            prev.map((item) => {
              if (item.fileId === updatedFile.id || item.files?.id === updatedFile.id) {
                return {
                  ...item,
                  fileName: updatedFile.name,
                  files: item.files
                    ? { ...item.files, name: updatedFile.name, extension: updatedFile.extension }
                    : item.files,
                };
              }
              return item;
            })
          );
        }
      }

      setRenameTarget(null);
      setRenameValue("");
      setModalErrorMsg(null);
      showToast(`${renameTarget.type === "folder" ? "Folder" : "File"} renamed successfully`);
      loadData();
    } catch (err: any) {
      setModalErrorMsg(err.message || "Failed to rename item");
    } finally {
      setIsLoading(false);
    }
  };

  // Move Handler
  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveTarget) return;

    if (selectedMoveFolderId === moveTarget.currentParentId) {
      setMoveModalErrorMsg("Item is already located in this folder.");
      return;
    }

    setIsLoading(true);
    setMoveModalErrorMsg(null);
    try {
      if (moveTarget.type === "folder") {
        if (selectedMoveFolderId === moveTarget.id) {
          setMoveModalErrorMsg("Cannot move a folder into itself.");
          setIsLoading(false);
          return;
        }

        if (isChild(selectedMoveFolderId, moveTarget.id)) {
          setMoveModalErrorMsg("Cannot move a folder into one of its subfolders.");
          setIsLoading(false);
          return;
        }

        const res = await updateFolder(authToken, moveTarget.id, { parentId: selectedMoveFolderId });
        if (!res.success) {
          setMoveModalErrorMsg(res.message || "Failed to move folder");
          setIsLoading(false);
          return;
        }
      } else {
        const res = await updateFile(authToken, moveTarget.id, { folderId: selectedMoveFolderId });
        if (!res.success) {
          setMoveModalErrorMsg(res.message || "Failed to move file");
          setIsLoading(false);
          return;
        }
      }

      logUserActivity(user.id, "move", moveTarget.type, moveTarget.name, moveTarget.id, {
        previous_folder_id: moveTarget.currentParentId,
        new_folder_id: selectedMoveFolderId,
      });
      createNotification(user.id, "file_activity", "Item Moved", `Moved ${moveTarget.name} to new location.`);

      const destName = getFolderName(selectedMoveFolderId);
      showToast(`Moved "${moveTarget.name}" to ${destName}`);

      setMoveTarget(null);
      setSelectedMoveFolderId(null);
      setMoveModalNavFolderId(null);
      setMoveSearchQuery("");
      setMoveModalErrorMsg(null);
      loadData();
    } catch (err: any) {
      setMoveModalErrorMsg(err.message || "Failed to move item");
    } finally {
      setIsLoading(false);
    }
  };

  // Star/Unstar Toggle Handler
  const handleToggleStar = async (item: FileItem | FolderItem, type: "file" | "folder") => {
    setIsLoading(true);
    try {
      const newStarred = !item.isStarred;

      if (type === "file") {
        const res = await starFile(authToken, item.id, newStarred);
        if (!res.success) throw new Error(res.message || "Failed to update file star status");
        setFiles((prev) => prev.map((f) => (f.id === item.id ? { ...f, isStarred: newStarred } : f)));
      } else {
        const res = await updateFolder(authToken, item.id, { isStarred: newStarred });
        if (!res.success) throw new Error(res.message || "Failed to update folder star status");
        setFolders((prev) => prev.map((f) => (f.id === item.id ? { ...f, isStarred: newStarred } : f)));
      }
      showToast(`${type === "file" ? "File" : "Folder"} ${newStarred ? "starred" : "unstarred"} successfully`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update star status");
    } finally {
      setIsLoading(false);
    }
  };

  // Trash Item Handler - opens professional confirmation modal
  const handleTrash = (item: FileItem | FolderItem, type: "file" | "folder") => {
    if (type === "folder") {
      setFolderTrashConfirmTarget(item as FolderItem);
    } else {
      setFileTrashConfirmTarget(item as FileItem);
    }
  };

  // Executed after file trash confirmation
  const executeFileTrash = async (file: FileItem) => {
    setIsLoading(true);
    try {
      const res = await trashFile(authToken, file.id);
      if (!res.success) throw new Error(res.message || "Failed to move file to trash");

      logUserActivity(user.id, "trash", "file", file.name, file.id, { folder_id: file.folderId });
      createNotification(user.id, "file_activity", "Moved to Trash", `${file.name} was moved to Trash.`);

      setFileTrashConfirmTarget(null);
      setUndoTarget({ type: "file", item: file });
      showToast("File moved to Trash");

      if (previewFile && previewFile.file.id === file.id) {
        setPreviewFile(null);
      }

      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to move file to trash");
      setFileTrashConfirmTarget(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Executed after folder trash confirmation
  const executeFolderTrash = async (folder: FolderItem) => {
    setIsLoading(true);
    try {
      const res = await trashFolder(authToken, folder.id);
      if (!res.success) throw new Error(res.message || "Failed to move folder to trash");

      logUserActivity(user.id, "trash", "folder", folder.name);
      createNotification(user.id, "file_activity", "Moved to Trash", `${folder.name} was moved to Trash.`);

      setFolderTrashConfirmTarget(null);
      setUndoTarget({ type: "folder", item: folder });
      showToast("Folder and contents moved to Trash");
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to move folder to trash");
      setFolderTrashConfirmTarget(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Undo Trashing
  const handleUndoTrash = async () => {
    if (!undoTarget) return;
    const { type, item } = undoTarget;

    setIsLoading(true);
    try {
      if (type === "folder") {
        const res = await restoreFolder(authToken, item.id);
        if (!res.success) throw new Error(res.message || "Failed to restore folder");
      } else {
        const res = await restoreFile(authToken, item.id);
        if (!res.success) throw new Error(res.message || "Failed to restore file");
      }

      showToast(`${type === "folder" ? "Folder" : "File"} restored successfully`);
      setUndoTarget(null);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to undo trash action");
    } finally {
      setIsLoading(false);
    }
  };

  // Initiate Restoration (with original location validation)
  const initiateRestore = async (item: FileItem | FolderItem, type: "file" | "folder") => {
    // If the original parent is gone, we might need a recovery target, but for now we'll just restore.
    // The backend handles the recursive restore of structure.
    
    setIsLoading(true);
    try {
      if (type === "folder") {
        const res = await restoreFolder(authToken, item.id);
        if (!res.success) throw new Error(res.message || "Failed to restore folder");
        showToast("Folder and contents restored successfully");
      } else {
        const res = await restoreFile(authToken, item.id);
        if (!res.success) throw new Error(res.message || "Failed to restore file");
        showToast("File restored successfully");
      }

      logUserActivity(user.id, "restore", type, item.name);
      createNotification(user.id, "file_activity", "Restored Item", `${item.name} was restored.`);
      
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to restore item");
    } finally {
      setIsLoading(false);
    }
  };

  const executePermanentDeleteFolderRecursively = async (folderId: string) => {
    setIsLoading(true);
    try {
      const res = await permanentlyDeleteFolder(authToken, folderId);
      if (!res.success) throw new Error(res.message || "Failed to permanently delete folder");

      showToast("Folder and all contents permanently deleted");
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to permanently delete folder");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (item: FileItem | FolderItem, type: "file" | "folder") => {
    await initiateRestore(item, type);
  };

  const handlePermanentDelete = (item: FileItem | FolderItem, type: "file" | "folder" = "file") => {
    setDeleteConfirmTarget({ type, item });
  };

  const executePermanentDelete = async () => {
    if (!deleteConfirmTarget) return;
    const { type, item } = deleteConfirmTarget;

    try {
      if (type === "file") {
        const res = await permanentlyDeleteFile(authToken, item.id);
        if (!res.success) {
          throw new Error(res.error || "Failed to permanently delete file");
        }
        
        const metadataStr = localStorage.getItem("cloudvault_trash_metadata") || "{}";
        const trashMetadata = JSON.parse(metadataStr);
        delete trashMetadata[item.id];
        localStorage.setItem("cloudvault_trash_metadata", JSON.stringify(trashMetadata));

        showToast("File permanently deleted");
      } else {
        await executePermanentDeleteFolderRecursively(item.id);
      }
      setDeleteConfirmTarget(null);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to permanently delete item");
      setDeleteConfirmTarget(null);
    }
  };

  // Empty Entire Trash Action
  const executeEmptyTrash = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setIsLoading(true);
    try {
      const trashedFiles = files.filter((f) => f.isTrash);
      const trashedFolders = folders.filter((f) => f.isTrash);

      // Delete files
      for (const f of trashedFiles) {
        try {
          await permanentlyDeleteFile(authToken, f.id);
        } catch (e) {
          console.error("Failed to delete file from storage during empty trash", e);
        }
      }

      // Delete folders
      if (trashedFolders.length > 0) {
        const folderIds = trashedFolders.map((f) => f.id);
        const { error } = await supabase.from("folders").delete().in("id", folderIds);
        if (error) throw error;
      }

      // Clear trash metadata
      const metadataStr = localStorage.getItem("cloudvault_trash_metadata") || "{}";
      const trashMetadata = JSON.parse(metadataStr);
      trashedFiles.forEach((f) => delete trashMetadata[f.id]);
      trashedFolders.forEach((f) => delete trashMetadata[f.id]);
      localStorage.setItem("cloudvault_trash_metadata", JSON.stringify(trashMetadata));

      showToast("Trash emptied successfully");
      setIsEmptyTrashOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to empty trash");
      setIsEmptyTrashOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Bulk Actions
  const executeBulkRestore = async () => {
    const itemsToRestore = [...files, ...folders].filter((item) => selectedTrashItems.has(item.id));
    for (const item of itemsToRestore) {
      const isFolder = "parentId" in item;
      await initiateRestore(item, isFolder ? "folder" : "file");
    }
    setSelectedTrashItems(new Set());
    setBulkActionTarget(null);
  };

  const executeBulkDelete = async () => {
    const itemsToDelete = [...files, ...folders].filter((item) => selectedTrashItems.has(item.id));
    for (const item of itemsToDelete) {
      const isFolder = "parentId" in item;
      try {
        if (isFolder) {
          await executePermanentDeleteFolderRecursively(item.id);
        } else {
          await permanentlyDeleteFile(authToken, item.id);
          const metadataStr = localStorage.getItem("cloudvault_trash_metadata") || "{}";
          const trashMetadata = JSON.parse(metadataStr);
          delete trashMetadata[item.id];
          localStorage.setItem("cloudvault_trash_metadata", JSON.stringify(trashMetadata));
        }
      } catch (err) {
        console.error("Bulk delete failed for item", item.id, err);
      }
    }
    showToast("Selected items permanently deleted");
    setSelectedTrashItems(new Set());
    setBulkActionTarget(null);
    loadData();
  };

  // File Preview & Download Handler
  const handlePreviewFile = async (file: FileItem) => {
    try {
      // First attempt to get a secure signed URL from storage
      const res = await fetchSignedDownloadUrl(authToken, file.storagePath);
      if (res.success && res.signedUrl) {
        setPreviewFile({ file, url: res.signedUrl });
      } else {
        // Fallback to streaming proxy or public URL if available
        const fallbackUrl = file.publicUrl || `/api/storage/stream?path=${encodeURIComponent(file.storagePath)}`;
        setPreviewFile({ file, url: fallbackUrl });
      }
    } catch (err: any) {
      console.warn("Signed URL fetch failed, trying streaming fallback:", err);
      const fallbackUrl = file.publicUrl || `/api/storage/stream?path=${encodeURIComponent(file.storagePath)}`;
      setPreviewFile({ file, url: fallbackUrl });
    }
  };

  const handleDownloadFile = async (file: FileItem) => {
    try {
      const res = await fetchSignedDownloadUrl(authToken, file.storagePath);
      if (res.success && res.signedUrl) {
        const link = document.createElement("a");
        link.href = res.signedUrl;
        link.download = file.name;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: any) {
      alert("Download error: " + err.message);
    }
  };

  const handleOpenSharedItem = (item: any) => {
    const resolved = resolveSharedItemInfo(item);
    if (resolved.isFolder) {
      setCurrentFolderId(resolved.id);
      setSidebarFilter("all");
      setFolderPath([{ id: null, name: "My Drive" }, { id: resolved.id, name: resolved.name }]);
    } else if (resolved.share_token) {
      if (onNavigate) {
        onNavigate(`/share/${resolved.share_token}`);
      } else {
        window.history.pushState({}, "", `/share/${resolved.share_token}`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    } else {
      handlePreviewFile(resolved as any);
    }
  };

  // Sync folderPath with currentFolderId and folders list automatically
  useEffect(() => {
    // If we are in a special view (Recent, Starred, Trash, Shared), breadcrumbs should just show that view
    if (sidebarFilter !== "all" && sidebarFilter !== "search") {
      let viewName = "My Drive";
      if (sidebarFilter === "recent") viewName = "Recent";
      else if (sidebarFilter === "starred") viewName = "Starred";
      else if (sidebarFilter === "trash") viewName = "Trash";
      else if (sidebarFilter === "shared") viewName = "Shared";
      else if (sidebarFilter === "storage") viewName = "Storage";
      
      setFolderPath([{ id: null, name: viewName }]);
      return;
    }

    if (!currentFolderId) {
      setFolderPath([{ id: null, name: "My Drive" }]);
      return;
    }

    const path: { id: string | null; name: string }[] = [];
    let currId: string | null = currentFolderId;
    const visited = new Set(); // Prevent infinite loops

    while (currId) {
      if (visited.has(currId)) break;
      visited.add(currId);

      const folder = folders.find(f => f.id === currId);
      if (folder) {
        path.unshift({ id: folder.id, name: folder.name });
        currId = folder.parentId;
      } else {
        break;
      }
    }
    path.unshift({ id: null, name: "My Drive" });
    setFolderPath(path);
  }, [currentFolderId, folders, sidebarFilter]);

  // Navigation handlers
  const handleOpenFolder = (folder: FolderItem) => {
    setSidebarFilter("all");
    setCurrentFolderId(folder.id);
    if (onNavigate) onNavigate(`/drive/folder/${folder.id}`);
  };

  const handleNavigateBreadcrumb = (index: number) => {
    const target = folderPath[index];
    setSidebarFilter("all");
    setCurrentFolderId(target.id);
    if (onNavigate) {
      if (target.id) onNavigate(`/drive/folder/${target.id}`);
      else onNavigate(`/dashboard`);
    }
  };

  // Calculate Storage Stats
  const activeUserFiles = useMemo(() => files.filter((f) => !f.isTrash), [files]);
  const activeUserFolders = useMemo(() => folders.filter((f) => !f.isTrash), [folders]);

  const usedStorageBytes = useMemo(() => {
    return activeUserFiles.reduce((sum, f) => sum + f.sizeBytes, 0);
  }, [activeUserFiles]);

  const totalQuotaBytes = (!profile?.storage_quota_bytes || profile.storage_quota_bytes === 5368709120)
    ? DEFAULT_STORAGE_QUOTA_BYTES
    : profile.storage_quota_bytes; // 15 GB default
  const remainingStorageBytes = Math.max(0, totalQuotaBytes - usedStorageBytes);
  const percentUsed = Math.min(100, Math.round((usedStorageBytes / totalQuotaBytes) * 1000) / 10);

  // Storage Breakdown by category
  const storageBreakdown = useMemo(() => {
    const categories = ["image", "document", "video", "audio", "archive", "other"];
    const breakdown: Record<string, { bytes: number; count: number }> = {
      image: { bytes: 0, count: 0 },
      document: { bytes: 0, count: 0 },
      video: { bytes: 0, count: 0 },
      audio: { bytes: 0, count: 0 },
      archive: { bytes: 0, count: 0 },
      other: { bytes: 0, count: 0 },
    };

    activeUserFiles.forEach((f) => {
      const cat = categories.includes(f.category) ? f.category : "other";
      breakdown[cat].bytes += f.sizeBytes;
      breakdown[cat].count += 1;
    });

    return breakdown;
  }, [activeUserFiles]);

  // Largest Files
  const largestFiles = useMemo(() => {
    return [...activeUserFiles].sort((a, b) => b.sizeBytes - a.sizeBytes).slice(0, 10);
  }, [activeUserFiles]);

  // Advanced Filtering & Sorting Logic
  const filteredFolders = useMemo(() => {
    return folders.filter((f) => {
      // Sidebar tab filtering
      if (sidebarFilter === "trash") return f.isTrash;
      if (sidebarFilter === "starred") return f.isStarred && !f.isTrash;
      if (f.isTrash) return false;

      // Search query filtering
      if (debouncedSearchQuery) {
        if (!f.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase())) return false;
      } else if (sidebarFilter === "all") {
        // Only show matching parent folder when not searching
        if (f.parentId !== currentFolderId) return false;
      }

      // Location filter
      if (filters.location === "starred" && !f.isStarred) return false;
      if (filters.location === "my_drive" && f.isTrash) return false;

      // Category filter (folders match if filter is 'all' or 'folder')
      if (filters.category !== "all" && filters.category !== "folder") return false;

      return true;
    });
  }, [folders, sidebarFilter, debouncedSearchQuery, currentFolderId, filters]);

  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      // Sidebar tab filtering
      if (sidebarFilter === "trash") return file.isTrash;
      if (sidebarFilter === "starred") return file.isStarred && !file.isTrash;
      if (sidebarFilter === "recent") return !file.isTrash;
      if (file.isTrash) return false;

      // Global Search Query
      if (debouncedSearchQuery) {
        const query = debouncedSearchQuery.toLowerCase();
        const matchName = file.name.toLowerCase().includes(query);
        const matchOrig = file.originalName.toLowerCase().includes(query);
        const matchCat = file.category.toLowerCase().includes(query);
        if (!matchName && !matchOrig && !matchCat) return false;
      } else if (sidebarFilter === "all") {
        if (file.folderId !== currentFolderId) return false;
      }

      // Advanced Filters
      // Category / Type
      if (filters.category !== "all") {
        if (filters.category === "folder") return false;
        if (file.category !== filters.category) return false;
      }

      // Location
      if (filters.location === "starred" && !file.isStarred) return false;

      // Date Range Filter
      if (filters.dateRange !== "all") {
        const fileDate = new Date(file.createdAt).getTime();
        const now = Date.now();
        const DAY_MS = 86400000;

        if (filters.dateRange === "today" && now - fileDate > DAY_MS) return false;
        if (filters.dateRange === "7days" && now - fileDate > 7 * DAY_MS) return false;
        if (filters.dateRange === "30days" && now - fileDate > 30 * DAY_MS) return false;
        if (filters.dateRange === "this_year") {
          const currentYear = new Date().getFullYear();
          if (new Date(file.createdAt).getFullYear() !== currentYear) return false;
        }
        if (filters.dateRange === "custom") {
          if (filters.customStartDate && fileDate < new Date(filters.customStartDate).getTime()) return false;
          if (filters.customEndDate && fileDate > new Date(filters.customEndDate).getTime() + DAY_MS) return false;
        }
      }

      // Size Range Filter
      if (filters.sizeRange !== "all") {
        const MB = 1048576;
        if (filters.sizeRange === "small" && file.sizeBytes >= 1 * MB) return false;
        if (filters.sizeRange === "medium" && (file.sizeBytes < 1 * MB || file.sizeBytes > 10 * MB)) return false;
        if (filters.sizeRange === "large" && file.sizeBytes <= 10 * MB) return false;
        if (filters.sizeRange === "custom") {
          if (filters.minSizeBytes !== undefined && file.sizeBytes < filters.minSizeBytes) return false;
          if (filters.maxSizeBytes !== undefined && file.sizeBytes > filters.maxSizeBytes) return false;
        }
      }

      return true;
    });
  }, [files, sidebarFilter, debouncedSearchQuery, currentFolderId, filters]);

  // Apply Sorting
  const sortedFolders = useMemo(() => {
    const list = [...filteredFolders];
    list.sort((a, b) => {
      if (sortOption === "name-asc") return a.name.localeCompare(b.name);
      if (sortOption === "name-desc") return b.name.localeCompare(a.name);
      if (sortOption === "date-asc") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return list;
  }, [filteredFolders, sortOption]);

  const sortedFiles = useMemo(() => {
    const list = [...filteredFiles];
    list.sort((a, b) => {
      if (sortOption === "name-asc") return a.name.localeCompare(b.name);
      if (sortOption === "name-desc") return b.name.localeCompare(a.name);
      if (sortOption === "size-desc") return b.sizeBytes - a.sizeBytes;
      if (sortOption === "size-asc") return a.sizeBytes - b.sizeBytes;
      if (sortOption === "date-asc") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return list;
  }, [filteredFiles, sortOption]);

  const starredItems = useMemo(() => {
    const combined = [
      ...filteredFolders.map((f) => ({ ...f, isFolder: true, category: "folder" as const, sizeBytes: 0 })),
      ...filteredFiles.map((f) => ({ ...f, isFolder: false })),
    ];

    combined.sort((a, b) => {
      if (sortOption === "name-asc") return a.name.localeCompare(b.name);
      if (sortOption === "name-desc") return b.name.localeCompare(a.name);
      if (sortOption === "date-asc") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortOption === "date-desc") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      
      if (sortOption === "size-desc") {
        const aSize = a.isFolder ? -1 : a.sizeBytes;
        const bSize = b.isFolder ? -1 : b.sizeBytes;
        return bSize - aSize;
      }
      if (sortOption === "size-asc") {
        const aSize = a.isFolder ? Infinity : a.sizeBytes;
        const bSize = b.isFolder ? Infinity : b.sizeBytes;
        return aSize - bSize;
      }
      return 0;
    });

    return combined;
  }, [filteredFolders, filteredFiles, sortOption]);

  const trashedFoldersToShow = useMemo(() => folders.filter((f) => f.isTrash), [folders]);
  const trashedFilesToShow = useMemo(() => files.filter((f) => f.isTrash), [files]);

  const isAllTrashSelected = useMemo(() => {
    const total = trashedFoldersToShow.length + trashedFilesToShow.length;
    return total > 0 && selectedTrashItems.size === total;
  }, [trashedFoldersToShow, trashedFilesToShow, selectedTrashItems]);

  const handleToggleSelectAllTrash = () => {
    if (isAllTrashSelected) {
      setSelectedTrashItems(new Set());
    } else {
      const allIds = new Set<string>();
      trashedFoldersToShow.forEach((f) => allIds.add(f.id));
      trashedFilesToShow.forEach((f) => allIds.add(f.id));
      setSelectedTrashItems(allIds);
    }
  };

  const handleToggleTrashSelect = (id: string) => {
    const next = new Set(selectedTrashItems);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedTrashItems(next);
  };

  // Helper to construct complete folder path string for display
  const getFolderPathString = (folderId: string | null): string => {
    if (!folderId) return "/My Drive";
    const pathParts: string[] = [];
    let currentId: string | null = folderId;
    let visited = new Set<string>();
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const f = folders.find((fol) => fol.id === currentId);
      if (f) {
        pathParts.unshift(f.name);
        currentId = f.parentId;
      } else {
        break;
      }
    }
    return "/My Drive/" + pathParts.join("/");
  };

  // Helper to retrieve exact deleted timestamp from metadata or fallback
  const getDeletedAt = (item: FileItem | FolderItem): Date => {
    const trashMetadataStr = localStorage.getItem("cloudvault_trash_metadata");
    if (trashMetadataStr) {
      try {
        const trashMetadata = JSON.parse(trashMetadataStr);
        if (trashMetadata[item.id]?.deletedAt) {
          return new Date(trashMetadata[item.id].deletedAt);
        }
      } catch (e) {
        console.error("Failed to parse trash metadata", e);
      }
    }
    const dateStr = item.updatedAt || item.createdAt || new Date().toISOString();
    return new Date(dateStr);
  };

  // Helper to calculate exact remaining milliseconds before 30-day auto-deletion
  const getRemainingTimeMs = (item: FileItem | FolderItem): number => {
    const deletedAt = getDeletedAt(item);
    const expiresAt = new Date(deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    const remaining = expiresAt.getTime() - currentTime;
    return Math.max(0, remaining);
  };

  // Helper to format remaining milliseconds into live ticking string
  const formatRemainingTime = (ms: number): string => {
    if (ms <= 0) return "Expired";
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));

    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  };

  // Helper to obtain the original path of a trashed item
  const getOriginalPath = (item: FileItem | FolderItem): string => {
    const trashMetadataStr = localStorage.getItem("cloudvault_trash_metadata");
    if (trashMetadataStr) {
      try {
        const trashMetadata = JSON.parse(trashMetadataStr);
        if (trashMetadata[item.id]?.originalPath) {
          return trashMetadata[item.id].originalPath;
        }
      } catch (e) {
        console.error("Failed to parse trash metadata", e);
      }
    }
    const parentId = "parentId" in item ? item.parentId : (item as FileItem).folderId;
    return getFolderPathString(parentId);
  };

  // Helper to count files and folders recursively inside a folder
  const getRecursiveItemCount = (folderId: string): number => {
    const allFolderIds = new Set<string>([folderId]);
    const queue = [folderId];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = folders.filter((f) => f.parentId === currentId);
      children.forEach((child) => {
        if (!allFolderIds.has(child.id)) {
          allFolderIds.add(child.id);
          queue.push(child.id);
        }
      });
    }
    const fileCount = files.filter((f) => f.folderId && allFolderIds.has(f.folderId)).length;
    const folderCount = allFolderIds.size - 1; // subtract root
    return fileCount + folderCount;
  };

  // Automated background deletion when item countdown reaches zero
  useEffect(() => {
    const expiredItems = [...files, ...folders].filter(
      (item) => item.isTrash && getRemainingTimeMs(item) <= 0
    );

    if (expiredItems.length > 0) {
      let dataChanged = false;
      expiredItems.forEach(async (item) => {
        try {
          const isFolder = "parentId" in item;
          if (isFolder) {
            const supabase = getSupabaseBrowserClient();
            if (supabase) {
              await supabase.from("folders").delete().eq("id", item.id);
              dataChanged = true;
            }
          } else {
            await permanentlyDeleteFile(authToken, item.id);
            dataChanged = true;
          }
          
          // Remove from local trash metadata
          const metadataStr = localStorage.getItem("cloudvault_trash_metadata");
          if (metadataStr) {
            const meta = JSON.parse(metadataStr);
            delete meta[item.id];
            localStorage.setItem("cloudvault_trash_metadata", JSON.stringify(meta));
          }
        } catch (err) {
          console.error("Background auto-deletion failed", err);
        }
      });
      if (dataChanged) {
        loadData();
      }
    }
  }, [currentTime]);

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const day = date.getDate();
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      
      let hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      
      return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
    } catch {
      return dateString;
    }
  };

  const getTypeBadge = (item: any) => {
    if (item.isFolder) {
      return (
        <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          Folder
        </span>
      );
    }
    
    const ext = (item.extension || "").toUpperCase();
    const cat = item.category;

    let bg = "bg-blue-50 text-blue-700 border-blue-100";
    let label = ext || "FILE";

    if (cat === "image") {
      bg = "bg-indigo-50 text-indigo-700 border-indigo-100";
      label = ext || "IMAGE";
    } else if (cat === "video") {
      bg = "bg-rose-50 text-rose-700 border-rose-100";
      label = ext || "VIDEO";
    } else if (cat === "document") {
      if (ext === "PDF") {
        bg = "bg-red-50 text-red-700 border-red-100";
        label = "PDF";
      } else if (ext === "DOC" || ext === "DOCX") {
        bg = "bg-blue-50 text-blue-700 border-blue-100";
        label = "Document";
      } else if (ext === "XLS" || ext === "XLSX" || ext === "CSV") {
        bg = "bg-emerald-50 text-emerald-700 border-emerald-100";
        label = "Spreadsheet";
      } else {
        bg = "bg-cyan-50 text-cyan-700 border-cyan-100";
        label = ext || "Document";
      }
    } else if (cat === "audio") {
      bg = "bg-amber-50 text-amber-700 border-amber-100";
      label = ext || "AUDIO";
    } else if (ext === "TXT") {
      bg = "bg-slate-50 text-slate-700 border-slate-200";
      label = "Text";
    }

    return (
      <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-full border ${bg} uppercase tracking-wider`}>
        {label}
      </span>
    );
  };

  // Paginated Results
  const totalPages = Math.ceil((sortedFiles.length + sortedFolders.length) / ITEMS_PER_PAGE) || 1;
  const paginatedFiles = useMemo(() => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedFiles.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [sortedFiles, currentPage]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.category !== "all") count++;
    if (filters.location !== "all") count++;
    if (filters.dateRange !== "all") count++;
    if (filters.sizeRange !== "all") count++;
    return count;
  }, [filters]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileCategoryIcon = (category: FileCategory) => {
    switch (category) {
      case "image":
        return <ImageIcon className="w-5 h-5 text-indigo-500" />;
      case "video":
        return <Film className="w-5 h-5 text-rose-500" />;
      case "audio":
        return <Music className="w-5 h-5 text-amber-500" />;
      case "archive":
        return <Archive className="w-5 h-5 text-purple-500" />;
      default:
        return <FileText className="w-5 h-5 text-blue-500" />;
    }
  };

  // Helper to find folder name for location display
  const getFolderName = (folderId: string | null) => {
    if (!folderId) return "My Drive";
    const found = folders.find((f) => f.id === folderId);
    return found ? found.name : "My Drive";
  };

  // Helper for relative time formatting
  const getRelativeTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays} days ago`;
      return date.toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const resolveSharedItemInfo = (item: any) => {
    const isFolder = !!item.folder_id;
    const target = isFolder ? (item.folder || item.folders) : (item.file || item.files);
    const owner = item.owner || sharerProfiles[item.owner_id] || null;
    const ownerName = owner?.full_name || (owner?.email ? owner.email.split("@")[0] : null) || (item.owner_id ? item.owner_id.split("-")[0] : "Owner");
    const ownerEmail = owner?.email || "No email available";
    const ownerAvatar = owner?.avatar_url || null;

    return {
      id: target?.id || item.id,
      shareId: item.id,
      name: target?.name || (isFolder ? "Shared Folder" : "Shared File"),
      isFolder,
      extension: target?.extension || (isFolder ? "" : (target?.name ? target.name.split(".").pop() : "") || "file"),
      category: target?.category || (isFolder ? "folder" : "other"),
      sizeBytes: target?.size_bytes || target?.sizeBytes || 0,
      folderId: target?.folder_id || target?.folderId || null,
      mimeType: target?.mime_type || target?.mimeType || "",
      created_at: item.created_at || target?.created_at,
      updated_at: target?.updated_at || target?.created_at || item.created_at,
      storagePath: target?.storage_path || null,
      permission: (item.permission || "viewer").toLowerCase(),
      expires_at: item.expires_at || null,
      password_enabled: !!item.password_enabled,
      share_token: item.share_token,
      ownerName,
      ownerEmail,
      ownerAvatar,
    };
  };

  const getSharedFileIcon = (isFolder: boolean, extension: string, category: string) => {
    if (isFolder) {
      return <Folder className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />;
    }
    const ext = (extension || "").toUpperCase();
    if (category === "image") {
      return <ImageIcon className="w-4 h-4 text-indigo-500 shrink-0" />;
    }
    if (category === "video") {
      return <Film className="w-4 h-4 text-rose-500 shrink-0" />;
    }
    if (ext === "PDF") {
      return <FileText className="w-4 h-4 text-red-500 shrink-0" />;
    }
    if (ext === "XLS" || ext === "XLSX" || ext === "CSV") {
      return <FileText className="w-4 h-4 text-emerald-500 shrink-0" />;
    }
    if (ext === "ZIP" || ext === "RAR" || ext === "TAR") {
      return <Archive className="w-4 h-4 text-amber-600 shrink-0" />;
    }
    return <FileText className="w-4 h-4 text-blue-500 shrink-0" />;
  };

  const getSharedTypeBadge = (isFolder: boolean, extension: string, category: string) => {
    if (isFolder) {
      return (
        <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-100 uppercase whitespace-nowrap">
          Folder
        </span>
      );
    }
    const ext = (extension || "").toUpperCase();
    let bg = "bg-slate-50 text-slate-600 border-slate-200";
    let label = ext || "FILE";
    
    if (category === "image") {
      bg = "bg-indigo-50 text-indigo-700 border-indigo-100";
      label = ext || "PNG";
    } else if (category === "video") {
      bg = "bg-rose-50 text-rose-700 border-rose-100";
      label = ext || "MP4";
    } else if (ext === "PDF") {
      bg = "bg-red-50 text-red-700 border-red-100";
      label = "PDF";
    } else if (ext === "XLS" || ext === "XLSX" || ext === "CSV") {
      bg = "bg-emerald-50 text-emerald-700 border-emerald-100";
      label = ext || "XLSX";
    } else if (ext === "DOC" || ext === "DOCX") {
      bg = "bg-blue-50 text-blue-700 border-blue-100";
      label = ext || "DOCX";
    } else if (ext === "PPT" || ext === "PPTX") {
      bg = "bg-amber-50 text-amber-700 border-amber-100";
      label = ext || "PPTX";
    } else if (ext === "TXT") {
      bg = "bg-slate-50 text-slate-700 border-slate-200";
      label = "TXT";
    }
    
    return (
      <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border uppercase whitespace-nowrap ${bg}`}>
        {label}
      </span>
    );
  };

  const sortedSharedItems = useMemo(() => {
    let items = [...sharedItems];
    
    // Search query: filters across file name, owner name, owner email, and file extension
    if (debouncedSearchQuery) {
      const q = debouncedSearchQuery.toLowerCase().trim();
      items = items.filter(item => {
        const resolved = resolveSharedItemInfo(item);
        return (
          resolved.name.toLowerCase().includes(q) ||
          resolved.ownerName.toLowerCase().includes(q) ||
          resolved.ownerEmail.toLowerCase().includes(q) ||
          resolved.extension.toLowerCase().includes(q)
        );
      });
    }

    // Category filter
    if (sharedCategoryFilter !== "all") {
      items = items.filter(item => {
        const resolved = resolveSharedItemInfo(item);
        if (sharedCategoryFilter === "folder") return resolved.isFolder;
        return !resolved.isFolder && resolved.category === sharedCategoryFilter;
      });
    }

    // Permission filter
    if (sharedPermissionFilter !== "all") {
      items = items.filter(item => {
        const perm = String(item.permission || "viewer").toLowerCase();
        return perm === sharedPermissionFilter.toLowerCase();
      });
    }
    
    // Sort
    items.sort((a, b) => {
      const resA = resolveSharedItemInfo(a);
      const resB = resolveSharedItemInfo(b);
      
      if (sharedSortOption === "name-asc") {
        return resA.name.localeCompare(resB.name);
      } else if (sharedSortOption === "name-desc") {
        return resB.name.localeCompare(resA.name);
      } else if (sharedSortOption === "size-desc") {
        return resB.sizeBytes - resA.sizeBytes;
      } else if (sharedSortOption === "size-asc") {
        return resA.sizeBytes - resB.sizeBytes;
      } else if (sharedSortOption === "date-asc") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else {
        // Default: date-desc (newest shared first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    
    return items;
  }, [sharedItems, sharedSortOption, sharedCategoryFilter, sharedPermissionFilter, debouncedSearchQuery, sharerProfiles]);

  const sharedItemsPerPage = 8;

  const paginatedSharedItems = useMemo(() => {
    const startIndex = (sharedPage - 1) * sharedItemsPerPage;
    return sortedSharedItems.slice(startIndex, startIndex + sharedItemsPerPage);
  }, [sortedSharedItems, sharedPage]);

  const totalSharedPages = Math.max(1, Math.ceil(sortedSharedItems.length / sharedItemsPerPage));

  return (
    <div 
      className={`flex-1 flex flex-col min-w-0 bg-[#F8FAFC] relative ${isDragging ? "bg-blue-50/50" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* DRAG AND DROP OVERLAY */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-blue-600/10 backdrop-blur-[2px] flex items-center justify-center pointer-events-none border-4 border-dashed border-blue-500/50 m-4 rounded-3xl animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 text-blue-600 border border-blue-100">
            <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center animate-bounce">
              <Upload className="w-10 h-10" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-black mb-1">Drop to Upload</h2>
              <p className="text-sm font-medium text-slate-500">Add files to {currentFolderId ? "this folder" : "My Drive"}</p>
            </div>
          </div>
        </div>
      )}
      {/* System Announcements Banner */}
      <AnnouncementBanner />

      {/* GLOBAL SEARCH HEADER BAR */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-30 shadow-2xs">
        {/* Search Bar Input */}
        <div className="relative flex-1 w-full max-w-2xl flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search files, folders, shared items by name..."
              className="w-full bg-slate-100 hover:bg-slate-100/80 focus:bg-white text-slate-800 text-xs pl-10 pr-9 py-2.5 rounded-xl border border-transparent focus:border-blue-500 outline-none transition-all"
            />
            {searchInput && (
              <button
                onClick={() => {
                  setSearchInput("");
                  setDebouncedSearchQuery("");
                  if (sidebarFilter === "search") setSidebarFilter("all");
                  if (onNavigate) onNavigate("/dashboard");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Advanced Filter Toggle Button */}
          <button
            onClick={() => setIsFilterModalOpen(!isFilterModalOpen)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shrink-0 ${
              activeFilterCount > 0
                ? "bg-blue-50 text-blue-700 border-blue-300 shadow-2xs"
                : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Action Controls: New Folder, Upload File, Notifications */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <input type="file" multiple ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

          <button
            onClick={() => setIsNewFolderOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">New Folder</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all cursor-pointer mr-1"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Files</span>
          </button>

          {/* Notifications Toggle */}
          <div className="relative">
            <NotificationBell
              notifications={notifications || []}
              isOpen={isNotifPanelOpen}
              onToggle={() => setIsNotifPanelOpen(!isNotifPanelOpen)}
            />

            <NotificationPanel
              notifications={notifications || []}
              isOpen={isNotifPanelOpen}
              onClose={() => setIsNotifPanelOpen(false)}
              onMarkAsRead={onMarkNotificationRead}
              onMarkAllAsRead={onMarkAllNotificationsRead}
              onNotificationClick={onNotificationClick}
              onViewAll={() => {
                onNavigate("/activity");
              }}
            />
          </div>
        </div>
      </div>

      {/* STORAGE WARNING BANNER */}
      {percentUsed >= 80 && (
        <div
          className={`px-6 py-2.5 border-b flex items-center justify-between text-xs font-medium ${
            percentUsed >= 100
              ? "bg-rose-50 text-rose-800 border-rose-200"
              : percentUsed >= 90
              ? "bg-orange-50 text-orange-800 border-orange-200"
              : "bg-amber-50 text-amber-800 border-amber-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse" />
            <span>
              {percentUsed >= 100
                ? "Storage is full. Delete files to upload new content."
                : percentUsed >= 90
                ? "Storage is almost full. You are using over 90% of your allotted quota."
                : "You're using most of your storage (80%+ used)."}
            </span>
          </div>
          <button
            onClick={() => {
              setSidebarFilter("storage");
              if (onNavigate) onNavigate("/storage");
            }}
            className="underline font-semibold hover:text-slate-900 cursor-pointer"
          >
            Manage Storage
          </button>
        </div>
      )}

      {/* ADVANCED FILTER MODAL / DRAWER */}
      {isFilterModalOpen && (
        <div className="bg-white border-b border-slate-200 p-6 shadow-md animate-in slide-in-from-top-2 duration-150 z-20">
          <div className="max-w-4xl mx-auto space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600" />
                <span>Advanced Search & Filters</span>
              </h3>
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Category / Type Filter */}
              <div>
                <label className="block text-slate-500 font-semibold mb-1.5">File Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 outline-none"
                >
                  <option value="all">All Categories</option>
                  <option value="image">Images</option>
                  <option value="document">Documents</option>
                  <option value="video">Videos</option>
                  <option value="audio">Audio</option>
                  <option value="archive">Archives</option>
                  <option value="folder">Folders Only</option>
                </select>
              </div>

              {/* Location Filter */}
              <div>
                <label className="block text-slate-500 font-semibold mb-1.5">Location</label>
                <select
                  value={filters.location}
                  onChange={(e) => setFilters((prev) => ({ ...prev, location: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 outline-none"
                >
                  <option value="all">All Locations</option>
                  <option value="my_drive">My Drive</option>
                  <option value="starred">Starred Items</option>
                  <option value="shared">Shared With Me</option>
                </select>
              </div>

              {/* Date Filter */}
              <div>
                <label className="block text-slate-500 font-semibold mb-1.5">Date Modified</label>
                <select
                  value={filters.dateRange}
                  onChange={(e) => setFilters((prev) => ({ ...prev, dateRange: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 outline-none"
                >
                  <option value="all">Any Time</option>
                  <option value="today">Today</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="this_year">This Year</option>
                </select>
              </div>

              {/* Size Filter */}
              <div>
                <label className="block text-slate-500 font-semibold mb-1.5">File Size</label>
                <select
                  value={filters.sizeRange}
                  onChange={(e) => setFilters((prev) => ({ ...prev, sizeRange: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 outline-none"
                >
                  <option value="all">Any Size</option>
                  <option value="small">Small (&lt; 1 MB)</option>
                  <option value="medium">Medium (1 MB – 10 MB)</option>
                  <option value="large">Large (&gt; 10 MB)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() =>
                  setFilters({
                    category: "all",
                    location: "all",
                    dateRange: "all",
                    sizeRange: "all",
                  })
                }
                className="px-3 py-1.5 text-slate-600 hover:text-slate-800 font-medium rounded-lg"
              >
                Reset Filters
              </button>
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="px-4 py-1.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-2xs"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ERROR / NOTIFICATION BANNER */}
      {errorMsg && (
        <div className="bg-rose-50 border-b border-rose-200 px-6 py-2.5 flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700 p-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TOP NAVIGATION & CONTROLS BAR */}
      <div className="px-6 py-3 bg-white/60 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Breadcrumb Navigation or View Title */}
        <div className="flex items-center gap-1 text-sm font-medium text-slate-600 overflow-x-auto whitespace-nowrap py-0.5">
          {folderPath.map((item, idx) => {
            const isLast = idx === folderPath.length - 1;
            const isDragTarget = dragOverFolderId === (item.id || "root");
            return (
              <React.Fragment key={item.id || "root"}>
                {idx > 0 && <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mx-0.5" />}
                <button
                  type="button"
                  onClick={() => handleNavigateBreadcrumb(idx)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverFolderId(item.id || "root");
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (dragOverFolderId === (item.id || "root")) setDragOverFolderId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverFolderId(null);
                    handleDropOnFolder(item.id);
                  }}
                  className={`flex items-center gap-1.5 py-1 px-2.5 rounded-xl cursor-pointer transition-all ${
                    isLast
                      ? "text-slate-900 font-bold bg-slate-100/90 shadow-2xs"
                      : "text-slate-600 hover:text-blue-600 hover:bg-slate-100"
                  } ${isDragTarget ? "ring-2 ring-blue-500 bg-blue-50 text-blue-700 font-bold scale-105" : ""}`}
                >
                  {idx === 0 ? (
                    <HardDrive className="w-4 h-4 text-blue-600 shrink-0" />
                  ) : (
                    <Folder className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  )}
                  <span>{item.name}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Sorting & Grid/List View Controls */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Storage Time Filter */}
          {sidebarFilter === "storage" && (
            <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl px-2.5 py-1 text-xs text-slate-600 font-semibold">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={storageTimeFilter}
                onChange={(e) => setStorageTimeFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-700 outline-none font-semibold cursor-pointer"
              >
                <option value="this_month">This Month</option>
                <option value="all_time">All Time</option>
              </select>
            </div>
          )}

          {/* Consistent Sort Select */}
          {sidebarFilter === "shared" ? (
            <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl px-2.5 py-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={sharedSortOption}
                onChange={(e) => {
                  setSharedSortOption(e.target.value);
                  setSharedPage(1);
                }}
                className="bg-transparent text-xs text-slate-700 outline-none font-semibold cursor-pointer"
              >
                <option value="date-desc">Last Shared (Newest)</option>
                <option value="date-asc">Oldest Shared</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="size-desc">Largest First</option>
                <option value="size-asc">Smallest First</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl px-2 py-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="bg-transparent text-xs text-slate-700 outline-none font-semibold cursor-pointer"
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="size-desc">Largest First</option>
                <option value="size-asc">Smallest First</option>
              </select>
            </div>
          )}

          {/* Grid / List View Toggle */}
          {sidebarFilter === "shared" ? (
            <div className="flex items-center bg-slate-100 rounded-xl p-1">
              <button
                onClick={() => setSharedViewMode("grid")}
                className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                  sharedViewMode === "grid" ? "bg-white text-blue-600 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800"
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSharedViewMode("list")}
                className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                  sharedViewMode === "list" ? "bg-white text-blue-600 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800"
                }`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center bg-slate-100 rounded-xl p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                  viewMode === "grid" ? "bg-white text-blue-600 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800"
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                  viewMode === "list" ? "bg-white text-blue-600 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800"
                }`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MAIN VIEW CONTENT AREA */}
      <div className="flex-1 p-6 space-y-6">
        {isLoading && sidebarFilter !== "shared" ? (
          <div className="py-20 text-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3 mx-auto" />
            <p className="text-sm font-medium">Loading content from Supabase...</p>
          </div>
        ) : sidebarFilter === "recent" ? (
          /* RECENT FILES REDESIGNED VIEW (GOOGLE DRIVE STYLE) */
          <div className="space-y-6 max-w-7xl mx-auto">
            {/* Files Content */}
            {sortedFiles.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/60">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                  <Clock className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-800 mb-1">No recent files</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">Files you open or edit will appear here.</p>
              </div>
            ) : viewMode === "grid" ? (
              /* Recent Grid View */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {paginatedFiles.map((file) => (
                  <FileGridCard
                    key={file.id}
                    file={file}
                    authToken={authToken}
                    isSelected={selectedFileIds.has(file.id)}
                    isMenuOpen={selectedFileForMenu === file.id}
                    currentUserId={user?.id}
                    onToggleSelect={handleToggleFileSelect}
                    onPreview={handlePreviewFile}
                    onDownload={handleDownloadFile}
                    onShare={(f) => onOpenShareModal({ type: "file", item: f })}
                    onRename={(f) => openRenameModal("file", f.id, f.name)}
                    onMove={(f) => {
                      setMoveTarget({ type: "file", id: f.id, name: f.name, currentParentId: f.folderId });
                      setSelectedMoveFolderId(f.folderId);
                    }}
                    onToggleStar={(f) => handleToggleStar(f, "file")}
                    onTrash={(f) => handleTrash(f, "file")}
                    onToggleMenu={(id) => setSelectedFileForMenu(selectedFileForMenu === id ? null : id)}
                    onCloseMenu={() => setSelectedFileForMenu(null)}
                    onDragStart={(e, f) => {
                      e.dataTransfer.setData("text/plain", f.id);
                      setDraggedItem({ type: "file", id: f.id, name: f.name });
                    }}
                  />
                ))}
              </div>
            ) : (
              /* Recent List View (Table) */
              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-6">Name</th>
                      <th className="py-3.5 px-6">Owner</th>
                      <th className="py-3.5 px-6">Last Opened</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {paginatedFiles.map((file) => (
                      <tr key={file.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                              {getFileCategoryIcon(file.category)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className="font-bold text-slate-900 hover:text-blue-600 cursor-pointer truncate max-w-sm"
                                  onClick={() => handlePreviewFile(file)}
                                  title={file.name}
                                >
                                  {file.name}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase shrink-0">
                                  {file.extension || file.category}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                <span>{formatBytes(file.sizeBytes)}</span>
                                <span>•</span>
                                <span>Location: {getFolderName(file.folderId)}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2 min-w-0">
                            {profile?.avatarUrl ? (
                              <img
                                src={profile.avatarUrl}
                                alt="Owner Avatar"
                                className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                                {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-800 truncate">
                                  {profile?.fullName || user.email.split("@")[0]}
                                </span>
                                <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full shrink-0">
                                  me
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-slate-600 font-medium whitespace-nowrap">
                          <span title={new Date(file.createdAt).toLocaleString()}>
                            {getRelativeTime(file.createdAt)}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="inline-block relative text-left" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setSelectedFileForMenu(selectedFileForMenu === file.id ? null : file.id)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {selectedFileForMenu === file.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setSelectedFileForMenu(null)} />
                                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg p-1 z-50 text-xs text-slate-700 text-left">
                                  <button
                                    onClick={() => { setSelectedFileForMenu(null); handlePreviewFile(file); }}
                                    className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-blue-600" /> Open / Preview
                                  </button>
                                  <button
                                    onClick={() => { setSelectedFileForMenu(null); handleDownloadFile(file); }}
                                    className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5 text-slate-600" /> Download
                                  </button>
                                  <button
                                    onClick={() => { setSelectedFileForMenu(null); onOpenShareModal({ type: "file", item: file }); }}
                                    className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                  >
                                    <Share2 className="w-3.5 h-3.5 text-indigo-600" /> Share
                                  </button>
                                  <button
                                    onClick={() => { setSelectedFileForMenu(null); openRenameModal("file", file.id, file.name); }}
                                    className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 text-amber-600" /> Rename
                                  </button>
                                  <button
                                    onClick={() => { setSelectedFileForMenu(null); setMoveTarget({ type: "file", id: file.id, name: file.name, currentParentId: file.folderId }); setSelectedMoveFolderId(file.folderId); }}
                                    className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                  >
                                    <FolderInput className="w-3.5 h-3.5 text-purple-600" /> Move
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedFileForMenu(null);
                                      setSidebarFilter("all");
                                      setCurrentFolderId(file.folderId);
                                    }}
                                    className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" /> Open Location
                                  </button>
                                  <div className="my-1 border-t border-slate-100" />
                                  <button
                                    onClick={() => { setSelectedFileForMenu(null); handleTrash(file, "file"); }}
                                    className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Move to Trash
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : sidebarFilter === "storage" ? (
          /* REDESIGNED PREMIUM STORAGE USAGE DASHBOARD VIEW */
          (() => {
            const categoriesList = [
              { id: "video", name: "Videos", colorClass: "stroke-rose-500 hover:stroke-rose-600", textClass: "text-rose-500", bgClass: "bg-rose-500", badgeBg: "bg-rose-50 text-rose-700 border-rose-100" },
              { id: "image", name: "Images", colorClass: "stroke-indigo-500 hover:stroke-indigo-600", textClass: "text-indigo-500", bgClass: "bg-indigo-500", badgeBg: "bg-indigo-50 text-indigo-700 border-indigo-100" },
              { id: "document", name: "Documents", colorClass: "stroke-blue-500 hover:stroke-blue-600", textClass: "text-blue-500", bgClass: "bg-blue-500", badgeBg: "bg-blue-50 text-blue-700 border-blue-100" },
              { id: "audio", name: "Audio", colorClass: "stroke-amber-500 hover:stroke-amber-600", textClass: "text-amber-500", bgClass: "bg-amber-500", badgeBg: "bg-amber-50 text-amber-700 border-amber-100" },
              { id: "archive", name: "Archives", colorClass: "stroke-emerald-500 hover:stroke-emerald-600", textClass: "text-emerald-500", bgClass: "bg-emerald-50 text-emerald-700 border-emerald-100" },
              { id: "other", name: "Other Files", colorClass: "stroke-slate-400 hover:stroke-slate-500", textClass: "text-slate-400", bgClass: "bg-slate-400", badgeBg: "bg-slate-50 text-slate-700 border-slate-100" },
            ];

            return (
              <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
                {/* ERROR STATE */}
                {errorMsg ? (
                  <div className="py-16 text-center border border-rose-200 bg-rose-50/50 rounded-2xl max-w-xl mx-auto">
                    <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-800 mb-1">Unable to load storage information</h4>
                    <p className="text-xs text-slate-500 mb-4 px-6">{errorMsg}</p>
                    <button
                      onClick={() => {
                        setErrorMsg(null);
                        setIsLoading(true);
                        loadData();
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                ) : isLoading ? (
                  /* SKELETON LOADING STATE */
                  <div className="space-y-6">
                    {/* Upper Cards Skeleton */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Overview Card Skeleton */}
                      <div className="bg-white border border-slate-200/85 rounded-2xl p-6 shadow-2xs space-y-4">
                        <div className="h-4 w-36 bg-slate-100 animate-pulse rounded" />
                        <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
                          <div className="w-32 h-32 rounded-full border-8 border-slate-50 animate-pulse bg-slate-100/50 shrink-0" />
                          <div className="space-y-3 w-full">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5"><div className="h-3 bg-slate-100 animate-pulse rounded w-16" /><div className="h-5 bg-slate-100 animate-pulse rounded w-20" /></div>
                              <div className="space-y-1.5"><div className="h-3 bg-slate-100 animate-pulse rounded w-16" /><div className="h-5 bg-slate-100 animate-pulse rounded w-20" /></div>
                            </div>
                            <div className="pt-2 border-t border-slate-50 space-y-2">
                              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-slate-100 animate-pulse" /><div className="h-3 bg-slate-100 animate-pulse rounded w-32" /></div>
                              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-slate-100 animate-pulse" /><div className="h-3 bg-slate-100 animate-pulse rounded w-32" /></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Donut Card Skeleton */}
                      <div className="bg-white border border-slate-200/85 rounded-2xl p-6 shadow-2xs space-y-4">
                        <div className="h-4 w-40 bg-slate-100 animate-pulse rounded" />
                        <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
                          <div className="w-32 h-32 rounded-full border-8 border-slate-50 animate-pulse bg-slate-100/50 shrink-0" />
                          <div className="space-y-2.5 w-full">
                            {[1, 2, 3, 4].map((i) => (
                              <div key={i} className="flex justify-between items-center">
                                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-slate-100 animate-pulse" /><div className="h-3 bg-slate-100 animate-pulse rounded w-16" /></div>
                                <div className="h-3 bg-slate-100 animate-pulse rounded w-12" />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Breakdown Skeletons */}
                    <div className="space-y-3">
                      <div className="h-4 w-36 bg-slate-100 animate-pulse rounded" />
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {[1, 2, 3, 4, 5, 6].map((idx) => (
                          <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 animate-pulse" />
                            <div className="space-y-1.5">
                              <div className="h-3.5 bg-slate-100 animate-pulse rounded w-2/3" />
                              <div className="h-3 bg-slate-100 animate-pulse rounded w-1/2" />
                            </div>
                            <div className="h-1.5 bg-slate-100 animate-pulse rounded w-full" />
                            <div className="h-2.5 bg-slate-100 animate-pulse rounded w-1/3" />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Largest Files Skeleton */}
                    <div className="bg-white border border-slate-200/85 rounded-2xl p-6 shadow-2xs space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="space-y-1"><div className="h-4 w-28 bg-slate-100 animate-pulse rounded" /><div className="h-3 w-44 bg-slate-100 animate-pulse rounded" /></div>
                        <div className="h-4 w-24 bg-slate-100 animate-pulse rounded" />
                      </div>
                      <div className="border-t border-slate-100 pt-3 space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex justify-between items-center py-2.5 border-b border-slate-50 last:border-0">
                            <div className="flex items-center gap-3 w-1/3"><div className="w-8 h-8 bg-slate-100 animate-pulse rounded-lg shrink-0" /><div className="h-3.5 bg-slate-100 animate-pulse rounded w-3/4" /></div>
                            <div className="h-4 bg-slate-100 animate-pulse rounded w-16" />
                            <div className="h-3.5 bg-slate-100 animate-pulse rounded w-12" />
                            <div className="h-3.5 bg-slate-100 animate-pulse rounded w-20" />
                            <div className="h-6 bg-slate-100 animate-pulse rounded w-10" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : activeUserFiles.length === 0 ? (
                  /* EMPTY STATE */
                  <div className="py-20 text-center border border-slate-200 bg-white rounded-2xl shadow-2xs max-w-xl mx-auto animate-fade-in">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 shadow-3xs">
                      <HardDrive className="w-7 h-7" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 mb-1">No storage used yet</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed px-4 mb-5">
                      Upload your first file to start using CloudVault storage.
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition-colors inline-flex items-center gap-2"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Files
                    </button>
                  </div>
                ) : (
                  /* MAIN RENDERED STORAGE CONTENT */
                  <>
                    {/* 1. Storage Overview & 2. Storage by File Type (Grid) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Card 1: Storage Overview */}
                      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs flex flex-col justify-between">
                        <h3 className="text-sm font-bold text-slate-800 mb-5">Storage Overview</h3>
                        <div className="flex flex-col sm:flex-row items-center gap-8">
                          {/* Left side: Circular Progress Indicator */}
                          <div className="relative flex items-center justify-center w-36 h-36 shrink-0">
                            {/* Circle SVG */}
                            <svg className="w-full h-full transform -rotate-90">
                              {/* Circle Background Track */}
                              <circle
                                cx="72"
                                cy="72"
                                r="54"
                                className="stroke-slate-100"
                                strokeWidth="10"
                                fill="transparent"
                              />
                              {/* Circle Progress Bar */}
                              <circle
                                cx="72"
                                cy="72"
                                r="54"
                                className="stroke-blue-600 transition-all duration-500 ease-in-out"
                                strokeWidth="10"
                                fill="transparent"
                                strokeDasharray="339.29"
                                strokeDashoffset={339.29 - (percentUsed / 100) * 339.29}
                                strokeLinecap="round"
                              />
                            </svg>
                            
                            {/* Circle Center Text */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                              <span className="text-sm font-black text-slate-800 leading-tight">
                                {formatBytes(usedStorageBytes)}
                              </span>
                              <span className="text-[10px] text-slate-400 mt-0.5 leading-none">
                                of {formatBytes(totalQuotaBytes)}
                              </span>
                              
                              {/* Small rounded usage badge inside circle */}
                              <div className="mt-1.5 px-2 py-0.5 text-[9px] font-black text-blue-700 bg-blue-50 border border-blue-100 rounded-full leading-none">
                                {percentUsed}%
                              </div>
                            </div>
                          </div>

                          {/* Right side: Quota Details & Legend */}
                          <div className="w-full space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-slate-50/70 rounded-xl p-3 border border-slate-100">
                                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Remaining Storage</span>
                                <span className="text-sm font-bold text-slate-800 mt-0.5 block">{formatBytes(remainingStorageBytes)}</span>
                              </div>
                              <div className="bg-slate-50/70 rounded-xl p-3 border border-slate-100">
                                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Total Storage</span>
                                <span className="text-sm font-bold text-slate-800 mt-0.5 block">{formatBytes(totalQuotaBytes)}</span>
                              </div>
                            </div>
                            
                            {/* Legend */}
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                                  <span className="text-slate-500 font-medium">Used</span>
                                </div>
                                <span className="font-semibold text-slate-700">{formatBytes(usedStorageBytes)}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-slate-200 inline-block" />
                                  <span className="text-slate-500 font-medium">Available</span>
                                </div>
                                <span className="font-semibold text-slate-700">{formatBytes(remainingStorageBytes)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card 2: Storage by File Type */}
                      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs flex flex-col justify-between">
                        <h3 className="text-sm font-bold text-slate-800 mb-5">Storage by File Type</h3>
                        <div className="flex flex-col sm:flex-row items-center gap-8">
                          {/* Left side: Interactive Donut SVG */}
                          <div className="relative flex items-center justify-center w-36 h-36 shrink-0">
                            <svg className="w-full h-full transform -rotate-90">
                              {/* Inner / outer circles for hover guidelines */}
                              <circle cx="72" cy="72" r="48" className="stroke-transparent fill-transparent" />
                              {/* Main segments drawing */}
                              {usedStorageBytes === 0 ? (
                                <circle
                                  cx="72"
                                  cy="72"
                                  r="40"
                                  className="stroke-slate-100"
                                  strokeWidth="11"
                                  fill="transparent"
                                />
                              ) : (
                                categoriesList.map((cat) => {
                                  const stat = storageBreakdown[cat.id] || { bytes: 0, count: 0 };
                                  const fraction = usedStorageBytes > 0 ? stat.bytes / usedStorageBytes : 0;
                                  if (fraction === 0) return null;
                                  
                                  // Math calculations for sequential segments
                                  let accum = 0;
                                  for (let i = 0; i < categoriesList.length; i++) {
                                    if (categoriesList[i].id === cat.id) break;
                                    const prevStat = storageBreakdown[categoriesList[i].id] || { bytes: 0, count: 0 };
                                    accum += prevStat.bytes / usedStorageBytes;
                                  }

                                  const strokeLength = fraction * 251.33; // C = 2 * Math.PI * 40
                                  const strokeOffset = 251.33 - (accum * 251.33);

                                  return (
                                    <circle
                                      key={cat.id}
                                      cx="72"
                                      cy="72"
                                      r="40"
                                      className={`${cat.colorClass} transition-all duration-300 stroke-[11px] hover:stroke-[14px] cursor-pointer`}
                                      strokeWidth="11"
                                      fill="transparent"
                                      strokeDasharray={`${strokeLength} 251.33`}
                                      strokeDashoffset={strokeOffset}
                                      strokeLinecap="round"
                                      onMouseEnter={() => setHoveredCategory(cat.id)}
                                      onMouseLeave={() => setHoveredCategory(null)}
                                    />
                                  );
                                })
                              )}
                            </svg>

                            {/* Interactive Center text on Hover */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2">
                              {hoveredCategory ? (
                                (() => {
                                  const activeCat = categoriesList.find((c) => c.id === hoveredCategory);
                                  const stat = storageBreakdown[hoveredCategory] || { bytes: 0, count: 0 };
                                  const pct = usedStorageBytes > 0 ? ((stat.bytes / usedStorageBytes) * 100).toFixed(1) : "0";
                                  return (
                                    <>
                                      <span className={`text-[10px] font-black uppercase tracking-wider leading-none truncate max-w-full ${activeCat?.textClass}`}>
                                        {activeCat?.name}
                                      </span>
                                      <span className="text-xs font-bold text-slate-800 leading-tight mt-1 truncate">
                                        {formatBytes(stat.bytes)}
                                      </span>
                                      <span className="text-[9px] text-slate-400 mt-0.5 font-semibold">
                                        {pct}%
                                      </span>
                                    </>
                                  );
                                })()
                              ) : (
                                <>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">
                                    Total Used
                                  </span>
                                  <span className="text-sm font-black text-slate-800 leading-tight mt-1">
                                    {formatBytes(usedStorageBytes)}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-semibold mt-0.5">
                                    100%
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Right side: Legend and exact stats */}
                          <div className="w-full space-y-2 max-h-[140px] overflow-y-auto pr-1">
                            {categoriesList.map((cat) => {
                              const stat = storageBreakdown[cat.id] || { bytes: 0, count: 0 };
                              const percent = usedStorageBytes > 0 ? ((stat.bytes / usedStorageBytes) * 100).toFixed(1) : "0";
                              return (
                                <div 
                                  key={cat.id} 
                                  className={`flex items-center justify-between text-xs p-1 rounded-lg transition-colors ${
                                    hoveredCategory === cat.id ? "bg-slate-50 font-bold" : ""
                                  }`}
                                  onMouseEnter={() => setHoveredCategory(cat.id)}
                                  onMouseLeave={() => setHoveredCategory(null)}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${cat.bgClass}`} />
                                    <span className="text-slate-600 truncate">{cat.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 text-slate-500">
                                    <span className="font-semibold text-slate-800">{formatBytes(stat.bytes)}</span>
                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded min-w-[40px] text-right">{percent}%</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3. Storage Breakdown Section */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-slate-800">Storage Breakdown</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {categoriesList.map((cat) => {
                          const stat = storageBreakdown[cat.id] || { bytes: 0, count: 0 };
                          const percent = usedStorageBytes > 0 ? ((stat.bytes / usedStorageBytes) * 100).toFixed(1) : "0";
                          return (
                            <div 
                              key={cat.id} 
                              className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between group h-[145px]"
                            >
                              <div className="flex justify-between items-start">
                                {/* Category Icon */}
                                <div className={`p-2.5 rounded-xl border shrink-0 ${cat.badgeBg}`}>
                                  {getFileCategoryIcon(cat.id as any)}
                                </div>
                                
                                {/* Percentage Tag */}
                                <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-600">
                                  {percent}%
                                </span>
                              </div>

                              <div className="space-y-1.5 mt-3">
                                <h4 className="text-xs font-bold text-slate-800 truncate">{cat.name}</h4>
                                <p className="text-xs font-black text-slate-900">{formatBytes(stat.bytes)}</p>
                              </div>

                              {/* Progress bar inside card */}
                              <div className="mt-3 space-y-1.5">
                                <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${cat.bgClass}`} 
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                                <p className="text-[10px] text-slate-400 font-semibold leading-none">
                                  {stat.count} {stat.count === 1 ? "file" : "files"}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 4. Largest Files Section */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs">
                      <div className="flex items-center justify-between gap-4 mb-4 border-b border-slate-100 pb-4">
                        <div>
                          <h3 className="text-sm font-bold text-slate-800">Largest Files</h3>
                          <p className="text-xs text-slate-400 mt-0.5">Files using the most storage</p>
                        </div>
                        <button
                          onClick={() => setSidebarFilter("all")}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 cursor-pointer hover:underline transition-colors"
                        >
                          View All Files →
                        </button>
                      </div>

                      {largestFiles.length === 0 ? (
                        <div className="py-12 text-center text-slate-400">
                          <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          <p className="text-xs">No files found in storage.</p>
                        </div>
                      ) : (
                        <>
                          {/* DESKTOP TABLE VIEW */}
                          <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
                                <tr>
                                  <th className="py-3 px-4">Name</th>
                                  <th className="py-3 px-4">Category</th>
                                  <th className="py-3 px-4">Size</th>
                                  <th className="py-3 px-4">Location</th>
                                  <th className="py-3 px-4">Modified</th>
                                  <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-slate-700">
                                {largestFiles.map((file) => {
                                  const catConfig = categoriesList.find((c) => c.id === file.category) || categoriesList[5];
                                  return (
                                    <tr key={file.id} className="hover:bg-slate-50/70 transition-colors group">
                                      <td className="py-3 px-4 font-semibold text-slate-800 flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100/80 flex items-center justify-center shrink-0">
                                          {getFileCategoryIcon(file.category)}
                                        </div>
                                        <span className="truncate max-w-xs cursor-pointer hover:text-blue-600" onClick={() => handlePreviewFile(file)}>
                                          {file.name}
                                        </span>
                                      </td>
                                      <td className="py-3 px-4">
                                        <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${catConfig.badgeBg}`}>
                                          {file.category.charAt(0).toUpperCase() + file.category.slice(1)}
                                        </span>
                                      </td>
                                      <td className="py-3 px-4 font-bold text-slate-900">{formatBytes(file.sizeBytes)}</td>
                                      <td className="py-3 px-4 font-medium text-slate-500">{getFolderName(file.folderId)}</td>
                                      <td className="py-3 px-4 text-slate-400">
                                        {new Date(file.createdAt).toLocaleDateString("en-GB", {
                                          day: "2-digit",
                                          month: "2-digit",
                                          year: "numeric"
                                        })}
                                      </td>
                                      <td className="py-3 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                          <button
                                            onClick={() => handlePreviewFile(file)}
                                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                            title="Preview"
                                          >
                                            <Eye className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => handleDownloadFile(file)}
                                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                            title="Download"
                                          >
                                            <Download className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => openRenameModal("file", file.id, file.name)}
                                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer transition-colors"
                                            title="Rename"
                                          >
                                            <Edit3 className="w-4 h-4" />
                                          </button>
                                          
                                          {/* Menu Action for files */}
                                          <div className="relative">
                                            <button
                                              onClick={() => setSelectedStorageFileMenu(selectedStorageFileMenu === file.id ? null : file.id)}
                                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                              title="More"
                                            >
                                              <MoreVertical className="w-4 h-4" />
                                            </button>
                                            
                                            {selectedStorageFileMenu === file.id && (
                                              <>
                                                <div className="fixed inset-0 z-40" onClick={() => setSelectedStorageFileMenu(null)} />
                                                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-50 text-xs text-slate-700 text-left animate-fade-in">
                                                  <button
                                                    onClick={() => {
                                                      setSelectedStorageFileMenu(null);
                                                      handlePreviewFile(file);
                                                    }}
                                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-left text-xs font-semibold"
                                                  >
                                                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                                                    Preview File
                                                  </button>
                                                  <button
                                                    onClick={() => {
                                                      setSelectedStorageFileMenu(null);
                                                      openRenameModal("file", file.id, file.name);
                                                    }}
                                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-left text-xs font-semibold"
                                                  >
                                                    <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                                                    Rename
                                                  </button>
                                                  <button
                                                    onClick={() => {
                                                      setSelectedStorageFileMenu(null);
                                                      handleDownloadFile(file);
                                                    }}
                                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-left text-xs font-semibold"
                                                  >
                                                    <Download className="w-3.5 h-3.5 text-slate-400" />
                                                    Download
                                                  </button>
                                                  <button
                                                    onClick={() => {
                                                      setSelectedStorageFileMenu(null);
                                                      handleTrash(file, "file");
                                                    }}
                                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 text-rose-600 border-t border-slate-100 mt-1 pt-1.5 cursor-pointer text-left text-xs font-bold"
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                                    Move to Trash
                                                  </button>
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* MOBILE RESPONSIVE CARDS VIEW */}
                          <div className="block sm:hidden divide-y divide-slate-100">
                            {largestFiles.map((file) => {
                              const catConfig = categoriesList.find((c) => c.id === file.category) || categoriesList[5];
                              return (
                                <div key={file.id} className="py-3 flex items-center justify-between gap-3 bg-white">
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                                      {getFileCategoryIcon(file.category)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <span 
                                        className="font-bold text-slate-800 text-xs truncate block cursor-pointer hover:text-blue-600" 
                                        onClick={() => handlePreviewFile(file)}
                                      >
                                        {file.name}
                                      </span>
                                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                        <span className="font-semibold text-slate-600">{formatBytes(file.sizeBytes)}</span>
                                        <span>•</span>
                                        <span>{getFolderName(file.folderId)}</span>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={() => handlePreviewFile(file)}
                                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    
                                    <div className="relative">
                                      <button
                                        onClick={() => setSelectedStorageFileMenu(selectedStorageFileMenu === file.id ? null : file.id)}
                                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                                      >
                                        <MoreVertical className="w-4 h-4" />
                                      </button>

                                      {selectedStorageFileMenu === file.id && (
                                        <>
                                          <div className="fixed inset-0 z-40" onClick={() => setSelectedStorageFileMenu(null)} />
                                          <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-50 text-xs text-slate-700 text-left">
                                            <button
                                              onClick={() => {
                                                setSelectedStorageFileMenu(null);
                                                handlePreviewFile(file);
                                              }}
                                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-left text-xs font-semibold"
                                            >
                                              <Eye className="w-3.5 h-3.5 text-slate-400" />
                                              Preview File
                                            </button>
                                            <button
                                              onClick={() => {
                                                setSelectedStorageFileMenu(null);
                                                handleDownloadFile(file);
                                              }}
                                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-left text-xs font-semibold"
                                            >
                                              <Download className="w-3.5 h-3.5 text-slate-400" />
                                              Download
                                            </button>
                                            <button
                                              onClick={() => {
                                                setSelectedStorageFileMenu(null);
                                                handleTrash(file, "file");
                                              }}
                                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 text-rose-600 border-t border-slate-100 mt-1 pt-1.5 cursor-pointer text-left text-xs font-bold"
                                            >
                                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                              Move to Trash
                                            </button>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })()
        ) : sidebarFilter === "shared" ? (
          /* REDESIGNED SHARED WITH ME VIEW (GOOGLE DRIVE STYLE) */
          <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
            {/* SHARED FILTER AND CATEGORY BAR */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              {/* Type Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {[
                  { id: "all", label: "All items" },
                  { id: "document", label: "Documents" },
                  { id: "image", label: "Images" },
                  { id: "video", label: "Videos" },
                  { id: "folder", label: "Folders" },
                  { id: "other", label: "Other" },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSharedCategoryFilter(cat.id);
                      setSharedPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      sharedCategoryFilter === cat.id
                        ? "bg-blue-50 text-blue-600 border border-blue-200/60 shadow-2xs font-bold"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-transparent"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Permission & Status Filter */}
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <span className="text-xs font-medium text-slate-500">Access:</span>
                <select
                  value={sharedPermissionFilter}
                  onChange={(e) => {
                    setSharedPermissionFilter(e.target.value);
                    setSharedPage(1);
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 font-semibold outline-none cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <option value="all">All Permissions</option>
                  <option value="viewer">Can View</option>
                  <option value="editor">Can Edit</option>
                </select>

                {(sharedCategoryFilter !== "all" || sharedPermissionFilter !== "all" || debouncedSearchQuery) && (
                  <button
                    onClick={() => {
                      setSharedCategoryFilter("all");
                      setSharedPermissionFilter("all");
                      setSearchInput("");
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold px-2 py-1 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* ERROR STATE */}
            {errorMsg ? (
              <div className="py-16 text-center border border-rose-200 bg-rose-50/50 rounded-2xl max-w-xl mx-auto">
                <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800 mb-1">Failed to load shared files</h4>
                <p className="text-xs text-slate-500 mb-4 px-6">{errorMsg}</p>
                <button
                  onClick={() => {
                    setErrorMsg(null);
                    setIsLoading(true);
                    loadData();
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition-colors"
                >
                  Retry Connection
                </button>
              </div>
            ) : isLoading ? (
              /* SKELETON LOADER SPECIFIC TO SHARED SECTION */
              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs p-6 space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                  <div className="h-4 w-24 bg-slate-100 animate-pulse rounded" />
                  <div className="h-4 w-28 bg-slate-100 animate-pulse rounded" />
                  <div className="h-4 w-16 bg-slate-100 animate-pulse rounded" />
                  <div className="h-4 w-12 bg-slate-100 animate-pulse rounded" />
                  <div className="h-4 w-24 bg-slate-100 animate-pulse rounded" />
                  <div className="h-4 w-10 bg-slate-100 animate-pulse rounded" />
                </div>
                {[1, 2, 3, 4, 5].map((idx) => (
                  <div key={idx} className="flex justify-between items-center py-4 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-3 w-1/4">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 animate-pulse shrink-0" />
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="h-3.5 bg-slate-100 animate-pulse rounded w-3/4" />
                        <div className="h-2.5 bg-slate-100 animate-pulse rounded w-1/2" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 w-1/4">
                      <div className="w-7 h-7 rounded-full bg-slate-100 animate-pulse shrink-0" />
                      <div className="space-y-1 flex-1">
                        <div className="h-3 bg-slate-100 animate-pulse rounded w-16" />
                        <div className="h-2 bg-slate-100 animate-pulse rounded w-20" />
                      </div>
                    </div>
                    <div className="w-1/8">
                      <div className="h-5 bg-slate-100 animate-pulse rounded-full w-12" />
                    </div>
                    <div className="w-1/12">
                      <div className="h-3 bg-slate-100 animate-pulse rounded w-8" />
                    </div>
                    <div className="w-1/6">
                      <div className="h-3 bg-slate-100 animate-pulse rounded w-24" />
                    </div>
                    <div className="w-[60px]">
                      <div className="h-6 bg-slate-100 animate-pulse rounded w-8" />
                    </div>
                  </div>
                ))}
              </div>
            ) : sortedSharedItems.length === 0 ? (
              /* EMPTY STATE */
              <div className="py-20 text-center border border-slate-200 bg-white rounded-2xl shadow-2xs">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 shadow-3xs">
                  <Share2 className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 mb-1">
                  {sharedCategoryFilter !== "all" || sharedPermissionFilter !== "all" || debouncedSearchQuery
                    ? "No matching shared items found"
                    : "Nothing shared with you yet"}
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed px-4">
                  {sharedCategoryFilter !== "all" || sharedPermissionFilter !== "all" || debouncedSearchQuery
                    ? "Try adjusting or resetting your filter criteria to see other shared files."
                    : "When other CloudVault users share files or folders with your email, they will automatically appear here."}
                </p>
                {(sharedCategoryFilter !== "all" || sharedPermissionFilter !== "all" || debouncedSearchQuery) && (
                  <button
                    onClick={() => {
                      setSharedCategoryFilter("all");
                      setSharedPermissionFilter("all");
                      setSearchInput("");
                    }}
                    className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              /* SHARED ITEMS VIEW CONTAINER */
              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs animate-fade-in">
                {sharedViewMode === "list" ? (
                  /* DESKTOP/TABLET TABLE LIST VIEW */
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-3.5 px-5 font-bold">Name</th>
                          <th className="py-3.5 px-5 font-bold">Owner</th>
                          <th className="py-3.5 px-5 font-bold">Type</th>
                          <th className="py-3.5 px-5 font-bold">Size</th>
                          <th className="py-3.5 px-5 font-bold">Shared On</th>
                          <th className="py-3.5 px-5 font-bold">Access</th>
                          <th className="py-3.5 px-5 font-bold">Status</th>
                          <th className="py-3.5 px-5 font-bold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {paginatedSharedItems.map((item) => {
                          const resolved = resolveSharedItemInfo(item);
                          const isFolder = resolved.isFolder;
                          const isExpired = resolved.expires_at ? new Date(resolved.expires_at) < new Date() : false;
                          
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                              {/* NAME COLUMN */}
                              <td className="py-3 px-5">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-slate-50 text-slate-500 border border-slate-100 flex items-center justify-center group-hover:bg-white transition-colors shrink-0 shadow-3xs">
                                    {getSharedFileIcon(isFolder, resolved.extension, resolved.category)}
                                  </div>
                                  <div className="min-w-0 max-w-[200px] lg:max-w-[260px]">
                                    <span 
                                      className="font-semibold text-slate-800 text-xs block truncate cursor-pointer hover:text-blue-600 transition-colors" 
                                      onClick={() => handleOpenSharedItem(item)}
                                    >
                                      {resolved.name}
                                    </span>
                                    <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
                                      {resolved.extension ? `${resolved.extension.toUpperCase()} File` : (isFolder ? "Folder" : "File")}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* OWNER COLUMN */}
                              <td className="py-3 px-5">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-full flex items-center justify-center bg-blue-50 border border-blue-100 text-blue-600 font-bold text-[10px] shrink-0 relative overflow-hidden">
                                    {resolved.ownerAvatar ? (
                                      <img
                                        src={resolved.ownerAvatar}
                                        alt={resolved.ownerName}
                                        className="absolute inset-0 w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : null}
                                    <span>{(resolved.ownerName || "U").charAt(0).toUpperCase()}</span>
                                  </div>
                                  <div className="min-w-0 max-w-[150px]">
                                    <p className="text-xs font-semibold text-slate-800 leading-tight truncate">{resolved.ownerName}</p>
                                    <p className="text-[10px] text-slate-400 truncate mt-0.5 leading-none">{resolved.ownerEmail}</p>
                                  </div>
                                </div>
                              </td>

                              {/* TYPE COLUMN */}
                              <td className="py-3 px-5">
                                {getSharedTypeBadge(isFolder, resolved.extension, resolved.category)}
                              </td>

                              {/* SIZE COLUMN */}
                              <td className="py-3 px-5 font-medium text-slate-600 whitespace-nowrap">
                                {isFolder ? getFolderItemCount(resolved.id) : formatBytes(resolved.sizeBytes)}
                              </td>

                              {/* SHARED ON COLUMN */}
                              <td className="py-3 px-5 text-slate-500 whitespace-nowrap">
                                {new Date(item.created_at).toLocaleString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </td>

                              {/* ACCESS COLUMN */}
                              <td className="py-3 px-5 whitespace-nowrap">
                                {resolved.permission === "editor" ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 uppercase">
                                    <Edit3 className="w-3 h-3 text-emerald-600" />
                                    Editor
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200/70 uppercase">
                                    <Eye className="w-3 h-3 text-blue-600" />
                                    Viewer
                                  </span>
                                )}
                              </td>

                              {/* STATUS COLUMN */}
                              <td className="py-3 px-5 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  {resolved.password_enabled && (
                                    <span className="p-1 bg-amber-50 text-amber-600 rounded-md border border-amber-200/60" title="Password Protected">
                                      <Lock className="w-3 h-3" />
                                    </span>
                                  )}
                                  {resolved.expires_at ? (
                                    isExpired ? (
                                      <span className="px-2 py-0.5 text-[9px] font-bold bg-rose-50 text-rose-600 rounded-full border border-rose-200">
                                        Expired
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 text-[9px] font-medium bg-slate-100 text-slate-600 rounded-full" title={`Expires on ${new Date(resolved.expires_at).toLocaleDateString()}`}>
                                        Expiring
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-medium">
                                      Active
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* ACTIONS COLUMN */}
                              <td className="py-3 px-5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                  {!isFolder && (
                                    <>
                                      <button
                                        onClick={() => handleOpenSharedItem(item)}
                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                                        title="Preview/Open"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDownloadFile(resolved as any)}
                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                                        title="Download"
                                      >
                                        <Download className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                  
                                  {/* THREE DOT ACTIONS MENU */}
                                  <div className="relative">
                                    <button
                                      onClick={() => setSelectedSharedItemMenu(selectedSharedItemMenu === item.id ? null : item.id)}
                                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                      title="More Actions"
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                    </button>

                                    {selectedSharedItemMenu === item.id && (
                                      <>
                                        <div className="fixed inset-0 z-40" onClick={() => setSelectedSharedItemMenu(null)} />
                                        <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-50 text-xs text-slate-700 text-left animate-fade-in">
                                          {!isFolder && (
                                            <>
                                              <button
                                                onClick={() => {
                                                  setSelectedSharedItemMenu(null);
                                                  handleOpenSharedItem(item);
                                                }}
                                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-left text-xs text-slate-700 font-medium"
                                              >
                                                <Eye className="w-3.5 h-3.5 text-slate-400" />
                                                Preview / Open
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setSelectedSharedItemMenu(null);
                                                  handleDownloadFile(resolved as any);
                                                }}
                                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-left text-xs text-slate-700 font-medium"
                                              >
                                                <Download className="w-3.5 h-3.5 text-slate-400" />
                                                Download
                                              </button>
                                            </>
                                          )}
                                          <button
                                            onClick={() => {
                                              setSelectedSharedItemMenu(null);
                                              setDetailSharedItem(item);
                                            }}
                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-left text-xs text-slate-700 font-medium"
                                          >
                                            <Share2 className="w-3.5 h-3.5 text-slate-400" />
                                            View Details
                                          </button>
                                          <button
                                            onClick={() => {
                                              setSelectedSharedItemMenu(null);
                                              handleRemoveShare(item.id);
                                            }}
                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 text-rose-600 cursor-pointer text-left text-xs font-semibold border-t border-slate-100 mt-1 pt-1.5"
                                          >
                                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                            Remove from shared
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* DESKTOP/TABLET GRID VIEW */
                  <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-5">
                    {paginatedSharedItems.map((item) => {
                      const resolved = resolveSharedItemInfo(item);
                      const isFolder = resolved.isFolder;
                      
                      return (
                        <div key={item.id} className="bg-slate-50/50 hover:bg-white hover:shadow-sm border border-slate-200/60 rounded-2xl p-4 transition-all group flex flex-col justify-between min-h-[175px]">
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2.5">
                              <div className="flex gap-2.5 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-3xs">
                                  {getSharedFileIcon(isFolder, resolved.extension, resolved.category)}
                                </div>
                                <div className="min-w-0">
                                  <h4 
                                    className="text-xs font-bold text-slate-800 truncate cursor-pointer hover:text-blue-600 block transition-colors" 
                                    onClick={() => handleOpenSharedItem(item)}
                                  >
                                    {resolved.name}
                                  </h4>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    {getSharedTypeBadge(isFolder, resolved.extension, resolved.category)}
                                    {resolved.permission === "editor" ? (
                                      <span className="px-1.5 py-0.5 text-[8px] font-bold rounded-md bg-emerald-50 text-emerald-700 uppercase">
                                        Editor
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 text-[8px] font-bold rounded-md bg-blue-50 text-blue-700 uppercase">
                                        Viewer
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Options action dropdown */}
                              <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => setSelectedSharedItemMenu(selectedSharedItemMenu === item.id ? null : item.id)}
                                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                >
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </button>

                                {selectedSharedItemMenu === item.id && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setSelectedSharedItemMenu(null)} />
                                    <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-50 text-xs text-slate-700 text-left">
                                      {!isFolder && (
                                        <>
                                          <button
                                            onClick={() => {
                                              setSelectedSharedItemMenu(null);
                                              handleOpenSharedItem(item);
                                            }}
                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-left text-xs font-medium"
                                          >
                                            <Eye className="w-3.5 h-3.5 text-slate-400" />
                                            Preview / Open
                                          </button>
                                          <button
                                            onClick={() => {
                                              setSelectedSharedItemMenu(null);
                                              handleDownloadFile(resolved as any);
                                            }}
                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-left text-xs font-medium"
                                          >
                                            <Download className="w-3.5 h-3.5 text-slate-400" />
                                            Download
                                          </button>
                                        </>
                                      )}
                                      <button
                                        onClick={() => {
                                          setSelectedSharedItemMenu(null);
                                          setDetailSharedItem(item);
                                        }}
                                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-left text-xs font-medium"
                                      >
                                        <Share2 className="w-3.5 h-3.5 text-slate-400" />
                                        View Details
                                      </button>
                                      <button
                                        onClick={() => {
                                          setSelectedSharedItemMenu(null);
                                          handleRemoveShare(item.id);
                                        }}
                                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 text-rose-600 cursor-pointer text-left text-xs font-semibold border-t border-slate-100 mt-1 pt-1.5"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                        Remove from shared
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-100/80 pt-3 mt-3 text-[10px] text-slate-400">
                            {/* Sharer Mini Card */}
                            <div className="flex items-center gap-1.5 min-w-0 max-w-[130px]">
                              <div className="w-5 h-5 rounded-full flex items-center justify-center bg-blue-50 border border-blue-100 text-blue-600 font-bold text-[8px] shrink-0 relative overflow-hidden">
                                {resolved.ownerAvatar ? (
                                  <img
                                    src={resolved.ownerAvatar}
                                    alt={resolved.ownerName}
                                    className="absolute inset-0 w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : null}
                                <span>{(resolved.ownerName || "U").charAt(0).toUpperCase()}</span>
                              </div>
                              <span className="truncate font-semibold text-slate-600">{resolved.ownerName}</span>
                            </div>

                            {/* Size badge */}
                            <span className="font-medium shrink-0 bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {isFolder ? getFolderItemCount(resolved.id) : formatBytes(resolved.sizeBytes)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* MOBILE RESPONSIVE CARDS/LIST VIEW (COMPACT CARD LISTS FOR SMALL SCREENS) */}
                <div className="block sm:hidden divide-y divide-slate-100">
                  {paginatedSharedItems.map((item) => {
                    const resolved = resolveSharedItemInfo(item);
                    const isFolder = resolved.isFolder;
                    
                    return (
                      <div key={item.id} className="p-4 flex items-center justify-between gap-3 bg-white hover:bg-slate-50/50">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-500 border border-slate-100 flex items-center justify-center shrink-0 shadow-3xs">
                            {getSharedFileIcon(isFolder, resolved.extension, resolved.category)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span 
                              className="font-bold text-slate-800 text-xs truncate block cursor-pointer hover:text-blue-600" 
                              onClick={() => handleOpenSharedItem(item)}
                            >
                              {resolved.name}
                            </span>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-400 mt-1">
                              <span>By {resolved.ownerName}</span>
                              <span>•</span>
                              <span>{isFolder ? "Folder" : formatBytes(resolved.sizeBytes)}</span>
                              <span>•</span>
                              <span className="font-semibold text-blue-600 uppercase text-[9px]">
                                {resolved.permission}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Mobile Actions block */}
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {!isFolder && (
                            <button
                              onClick={() => handleOpenSharedItem(item)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg cursor-pointer"
                              title="Open File"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <div className="relative">
                            <button
                              onClick={() => setSelectedSharedItemMenu(selectedSharedItemMenu === item.id ? null : item.id)}
                              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {selectedSharedItemMenu === item.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setSelectedSharedItemMenu(null)} />
                                <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-50 text-xs text-slate-700 text-left">
                                  {!isFolder && (
                                    <>
                                      <button
                                        onClick={() => {
                                          setSelectedSharedItemMenu(null);
                                          handleOpenSharedItem(item);
                                        }}
                                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-left text-xs font-medium"
                                      >
                                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                                        Preview / Open
                                      </button>
                                      <button
                                        onClick={() => {
                                          setSelectedSharedItemMenu(null);
                                          handleDownloadFile(resolved as any);
                                        }}
                                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-left text-xs font-medium"
                                      >
                                        <Download className="w-3.5 h-3.5 text-slate-400" />
                                        Download
                                      </button>
                                    </>
                                  )}
                                  <button
                                    onClick={() => {
                                      setSelectedSharedItemMenu(null);
                                      setDetailSharedItem(item);
                                    }}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-left text-xs font-medium"
                                  >
                                    <Share2 className="w-3.5 h-3.5 text-slate-400" />
                                    View Details
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedSharedItemMenu(null);
                                      handleRemoveShare(item.id);
                                    }}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 text-rose-600 cursor-pointer text-left text-xs font-semibold border-t border-slate-100 mt-1 pt-1.5"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                    Remove from shared
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* PAGINATION COMPONENT FOR LARGE DATASETS */}
                {sortedSharedItems.length > sharedItemsPerPage && (
                  <div className="flex items-center justify-between bg-slate-50/80 px-6 py-4 border-t border-slate-100 text-xs">
                    <span className="text-slate-500 font-medium">
                      Showing {(sharedPage - 1) * sharedItemsPerPage + 1}–{Math.min(sharedPage * sharedItemsPerPage, sortedSharedItems.length)} of {sortedSharedItems.length} items
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSharedPage(prev => Math.max(1, prev - 1))}
                        disabled={sharedPage === 1}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-600 transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setSharedPage(prev => Math.min(totalSharedPages, prev + 1))}
                        disabled={sharedPage === totalSharedPages}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-600 transition-colors cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SHARED DETAILS MODAL DIALOG */}
            {detailSharedItem && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[100] p-4 animate-fade-in">
                <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-100 shadow-2xl overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-blue-600" />
                      <h3 className="text-sm font-bold text-slate-800">Shared File Information</h3>
                    </div>
                    <button
                      onClick={() => setDetailSharedItem(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="p-6 space-y-5">
                    {(() => {
                      const resolved = resolveSharedItemInfo(detailSharedItem);
                      
                      return (
                        <>
                          {/* Item Preview Card */}
                          <div className="flex items-center gap-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-3xs">
                              {getSharedFileIcon(resolved.isFolder, resolved.extension, resolved.category)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-slate-800 truncate">{resolved.name}</h4>
                              <p className="text-[10px] text-slate-400 mt-0.5">{resolved.isFolder ? "Folder" : (resolved.extension ? `${resolved.extension.toUpperCase()} Document` : "File")}</p>
                            </div>
                            <div>
                              {getSharedTypeBadge(resolved.isFolder, resolved.extension, resolved.category)}
                            </div>
                          </div>

                          {/* Owner Profile Card */}
                          <div>
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">File Owner</p>
                            <div className="flex items-center gap-3 bg-blue-50/50 p-3.5 rounded-2xl border border-blue-100">
                              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center border border-blue-200 relative overflow-hidden text-xs shrink-0">
                                {resolved.ownerAvatar ? (
                                  <img
                                    src={resolved.ownerAvatar}
                                    alt={resolved.ownerName}
                                    className="absolute inset-0 w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : null}
                                <span>{(resolved.ownerName || "O").charAt(0).toUpperCase()}</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-800 leading-tight truncate">{resolved.ownerName}</p>
                                <p className="text-[10px] text-slate-500 leading-normal truncate mt-0.5">{resolved.ownerEmail}</p>
                              </div>
                              <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-blue-100 text-blue-700">
                                Owner
                              </span>
                            </div>
                          </div>
                          
                          {/* Grid of properties */}
                          <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                            <div>
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">File Size</p>
                              <p className="font-semibold text-slate-700">{resolved.isFolder ? getFolderItemCount(resolved.id) : formatBytes(resolved.sizeBytes)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Your Permission</p>
                              {resolved.permission === "editor" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                                  <Edit3 className="w-3 h-3" />
                                  Editor (Can edit)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                                  <Eye className="w-3 h-3" />
                                  Viewer (Can view)
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Shared Date</p>
                              <p className="font-semibold text-slate-700">
                                {new Date(detailSharedItem.created_at).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Security / Expiry</p>
                              <p className="font-semibold text-slate-700">
                                {resolved.password_enabled ? "Password Protected • " : ""}
                                {resolved.expires_at ? `Expires ${new Date(resolved.expires_at).toLocaleDateString()}` : "Never Expires"}
                              </p>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => {
                        const idToRemove = detailSharedItem.id;
                        setDetailSharedItem(null);
                        handleRemoveShare(idToRemove);
                      }}
                      className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Remove from Shared
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDetailSharedItem(null)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                      >
                        Close
                      </button>
                      <button
                        onClick={() => {
                          const itemToOpen = detailSharedItem;
                          setDetailSharedItem(null);
                          handleOpenSharedItem(itemToOpen);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors shadow-2xs flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Open File
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : sidebarFilter === "starred" ? (
          /* REDESIGNED STARRED ITEMS VIEW */
          <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
            {starredItems.length === 0 ? (
              /* EMPTY STATE */
              <div className="py-24 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white shadow-2xs">
                <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4">
                  <Star className="w-8 h-8 fill-amber-500" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">No starred items</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Star files and folders to quickly access them here.
                </p>
              </div>
            ) : viewMode === "list" ? (
              /* LIST VIEW */
              <div className="space-y-4">
                {/* DESKTOP TABLE */}
                <div className="hidden md:block bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-3.5 px-6">Name</th>
                          <th className="py-3.5 px-6">Location</th>
                          <th className="py-3.5 px-6">Type</th>
                          <th className="py-3.5 px-6">Size</th>
                          <th className="py-3.5 px-6">Modified</th>
                          <th className="py-3.5 px-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {starredItems.map((rawItem) => {
                          const item = rawItem as any;
                          const isFolder = item.isFolder;
                          const parentName = isFolder ? getFolderName(item.parentId) : getFolderName(item.folderId);
                          
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/60 transition-colors group">
                              {/* Name */}
                              <td className="py-3.5 px-6">
                                <div className="flex items-center gap-3 min-w-0">
                                  {/* Interactive Star icon */}
                                  <button
                                    onClick={() => handleToggleStar(item, isFolder ? "folder" : "file")}
                                    className="p-1 rounded text-amber-500 fill-amber-500 hover:bg-amber-50 transition-colors cursor-pointer"
                                    title="Unstar item"
                                  >
                                    <Star className="w-4 h-4 fill-amber-500" />
                                  </button>
                                  
                                  {/* Folder/File category icon */}
                                  <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                                    {isFolder ? (
                                      <Folder className={`w-4 h-4 text-${item.color || 'blue'}-500 fill-${item.color || 'blue'}-500/25`} />
                                    ) : (
                                      getFileCategoryIcon(item.category)
                                    )}
                                  </div>

                                  {/* Item Name (click to open/preview) */}
                                  <span
                                    onClick={() => isFolder ? handleOpenFolder(item) : handlePreviewFile(item)}
                                    className="font-semibold text-slate-800 hover:text-blue-600 cursor-pointer truncate max-w-[200px] md:max-w-[300px]"
                                    title={item.name}
                                  >
                                    {item.name}
                                  </span>
                                </div>
                              </td>

                              {/* Location */}
                              <td className="py-3.5 px-6">
                                <span className="font-medium text-slate-500">
                                  {parentName}
                                </span>
                              </td>

                              {/* Type badge */}
                              <td className="py-3.5 px-6">
                                {getTypeBadge(item)}
                              </td>

                              {/* Size */}
                              <td className="py-3.5 px-6 font-semibold text-slate-700">
                                {isFolder ? getFolderItemCount(item.id) : formatBytes(item.sizeBytes)}
                              </td>

                              {/* Modified */}
                              <td className="py-3.5 px-6 text-slate-500 font-medium">
                                {formatDateTime(item.updatedAt || item.createdAt)}
                              </td>

                              {/* Actions */}
                              <td className="py-3.5 px-6 text-right">
                                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                  <div className="relative">
                                    <button
                                      onClick={() => {
                                        if (isFolder) {
                                          setSelectedFolderForMenu(selectedFolderForMenu === item.id ? null : item.id);
                                          setSelectedFileForMenu(null);
                                        } else {
                                          setSelectedFileForMenu(selectedFileForMenu === item.id ? null : item.id);
                                          setSelectedFolderForMenu(null);
                                        }
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                    </button>
                                    
                                    {/* Dropdown Menu */}
                                    {((isFolder && selectedFolderForMenu === item.id) || (!isFolder && selectedFileForMenu === item.id)) && (
                                      <>
                                        <div
                                          className="fixed inset-0 z-40"
                                          onClick={() => {
                                            setSelectedFileForMenu(null);
                                            setSelectedFolderForMenu(null);
                                          }}
                                        />
                                        <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg p-1 z-50 text-xs text-slate-700 text-left">
                                          <button
                                            onClick={() => {
                                              setSelectedFileForMenu(null);
                                              setSelectedFolderForMenu(null);
                                              if (isFolder) {
                                                handleOpenFolder(item);
                                              } else {
                                                handlePreviewFile(item);
                                              }
                                            }}
                                            className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                          >
                                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                                            {isFolder ? "Open Folder" : "Preview / Open"}
                                          </button>
                                          <button
                                            onClick={() => {
                                              setSelectedFileForMenu(null);
                                              setSelectedFolderForMenu(null);
                                              openRenameModal(isFolder ? "folder" : "file", item.id, item.name);
                                            }}
                                            className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                          >
                                            <Edit3 className="w-3.5 h-3.5 text-amber-600" /> Rename
                                          </button>

                                          {!isFolder && (
                                            <button
                                              onClick={() => {
                                                setSelectedFileForMenu(null);
                                                handleDownloadFile(item);
                                              }}
                                              className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                            >
                                              <Download className="w-3.5 h-3.5 text-emerald-600" /> Download
                                            </button>
                                          )}

                                          <button
                                            onClick={() => {
                                              setSelectedFileForMenu(null);
                                              setSelectedFolderForMenu(null);
                                              setSidebarFilter("all");
                                              if (isFolder) {
                                                setCurrentFolderId(item.parentId);
                                              } else {
                                                setCurrentFolderId(item.folderId);
                                              }
                                            }}
                                            className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5 text-indigo-600" /> Open Location
                                          </button>

                                          <button
                                            onClick={() => {
                                              setSelectedFileForMenu(null);
                                              setSelectedFolderForMenu(null);
                                              handleToggleStar(item, isFolder ? "folder" : "file");
                                            }}
                                            className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                          >
                                            <Star className="w-3.5 h-3.5 text-amber-500" /> Unstar Item
                                          </button>

                                          <div className="my-1 border-t border-slate-100" />

                                          <button
                                            onClick={() => {
                                              setSelectedFileForMenu(null);
                                              setSelectedFolderForMenu(null);
                                              handleTrash(item, isFolder ? "folder" : "file");
                                            }}
                                            className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" /> Move to Trash
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* MOBILE LIST CARDS VIEW */}
                <div className="md:hidden space-y-3">
                  {starredItems.map((rawItem) => {
                    const item = rawItem as any;
                    const isFolder = item.isFolder;
                    const parentName = isFolder ? getFolderName(item.parentId) : getFolderName(item.folderId);
                    
                    return (
                      <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3 relative">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                              {isFolder ? (
                                <Folder className={`w-4 h-4 text-${item.color || 'blue'}-500 fill-${item.color || 'blue'}-500/25`} />
                              ) : (
                                getFileCategoryIcon(item.category)
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4
                                onClick={() => isFolder ? handleOpenFolder(item) : handlePreviewFile(item)}
                                className="font-bold text-slate-800 hover:text-blue-600 cursor-pointer truncate text-xs"
                                title={item.name}
                              >
                                {item.name}
                              </h4>
                              <p className="text-[10px] text-slate-400 font-medium truncate">
                                in {parentName}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleToggleStar(item, isFolder ? "folder" : "file")}
                              className="p-1 rounded text-amber-500 fill-amber-500 hover:bg-amber-50 transition-colors cursor-pointer"
                              title="Unstar item"
                            >
                              <Star className="w-3.5 h-3.5 fill-amber-500" />
                            </button>

                            <div className="relative">
                              <button
                                onClick={() => {
                                  if (isFolder) {
                                    setSelectedFolderForMenu(selectedFolderForMenu === item.id ? null : item.id);
                                    setSelectedFileForMenu(null);
                                  } else {
                                    setSelectedFileForMenu(selectedFileForMenu === item.id ? null : item.id);
                                    setSelectedFolderForMenu(null);
                                  }
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>

                              {/* Dropdown Menu */}
                              {((isFolder && selectedFolderForMenu === item.id) || (!isFolder && selectedFileForMenu === item.id)) && (
                                <>
                                  <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => {
                                      setSelectedFileForMenu(null);
                                      setSelectedFolderForMenu(null);
                                    }}
                                  />
                                  <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg p-1 z-50 text-xs text-slate-700 text-left">
                                    <button
                                      onClick={() => {
                                        setSelectedFileForMenu(null);
                                        setSelectedFolderForMenu(null);
                                        if (isFolder) {
                                          handleOpenFolder(item);
                                        } else {
                                          handlePreviewFile(item);
                                        }
                                      }}
                                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                                      {isFolder ? "Open Folder" : "Preview / Open"}
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedFileForMenu(null);
                                        setSelectedFolderForMenu(null);
                                        openRenameModal(isFolder ? "folder" : "file", item.id, item.name);
                                      }}
                                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                    >
                                      <Edit3 className="w-3.5 h-3.5 text-amber-600" /> Rename
                                    </button>

                                    {!isFolder && (
                                      <button
                                        onClick={() => {
                                          setSelectedFileForMenu(null);
                                          handleDownloadFile(item);
                                        }}
                                        className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                      >
                                        <Download className="w-3.5 h-3.5 text-emerald-600" /> Download
                                      </button>
                                    )}

                                    <button
                                      onClick={() => {
                                        setSelectedFileForMenu(null);
                                        setSelectedFolderForMenu(null);
                                        setSidebarFilter("all");
                                        if (isFolder) {
                                          setCurrentFolderId(item.parentId);
                                        } else {
                                          setCurrentFolderId(item.folderId);
                                        }
                                      }}
                                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5 text-indigo-600" /> Open Location
                                    </button>

                                    <button
                                      onClick={() => {
                                        setSelectedFileForMenu(null);
                                        setSelectedFolderForMenu(null);
                                        handleToggleStar(item, isFolder ? "folder" : "file");
                                      }}
                                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                    >
                                      <Star className="w-3.5 h-3.5 text-amber-500" /> Unstar Item
                                    </button>

                                    <div className="my-1 border-t border-slate-100" />

                                    <button
                                      onClick={() => {
                                        setSelectedFileForMenu(null);
                                        setSelectedFolderForMenu(null);
                                        handleTrash(item, isFolder ? "folder" : "file");
                                      }}
                                      className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Move to Trash
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-[10px]">
                          {getTypeBadge(item)}
                          <div className="flex gap-4 text-right">
                            <div>
                              <p className="text-[10px] font-bold text-slate-700">
                                {isFolder ? getFolderItemCount(item.id) : formatBytes(item.sizeBytes)}
                              </p>
                              <p className="text-[9px] text-slate-400 font-medium">Size</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-700">
                                {formatDateTime(item.updatedAt || item.createdAt)}
                              </p>
                              <p className="text-[9px] text-slate-400 font-medium">Modified</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* GRID VIEW */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {starredItems.map((rawItem) => {
                  const item = rawItem as any;
                  const isFolder = item.isFolder;
                  
                  if (isFolder) {
                    return (
                      <FolderGridCard
                        key={item.id}
                        folder={item}
                        itemCount={getFolderItemCount(item.id)}
                        authToken={authToken}
                        isMenuOpen={selectedFolderForMenu === item.id}
                        currentUserId={user?.id}
                        onOpenFolder={handleOpenFolder}
                        onShare={(f) => onOpenShareModal({ type: "folder", item: f })}
                        onRename={(f) => openRenameModal("folder", f.id, f.name)}
                        onMove={(f) => openMoveModal(f, "folder")}
                        onToggleStar={(f) => handleToggleStar(f, "folder")}
                        onTrash={(f) => handleTrash(f, "folder")}
                        onToggleMenu={(id) => {
                          setSelectedFolderForMenu(selectedFolderForMenu === id ? null : id);
                          setSelectedFileForMenu(null);
                        }}
                        onCloseMenu={() => setSelectedFolderForMenu(null)}
                      />
                    );
                  }

                  return (
                    <FileGridCard
                      key={item.id}
                      file={item}
                      authToken={authToken}
                      isSelected={selectedFileIds.has(item.id)}
                      isMenuOpen={selectedFileForMenu === item.id}
                      currentUserId={user?.id}
                      onToggleSelect={handleToggleFileSelect}
                      onPreview={handlePreviewFile}
                      onDownload={handleDownloadFile}
                      onShare={(f) => onOpenShareModal({ type: "file", item: f })}
                      onRename={(f) => openRenameModal("file", f.id, f.name)}
                      onMove={(f) => {
                        setMoveTarget({ type: "file", id: f.id, name: f.name, currentParentId: f.folderId });
                        setSelectedMoveFolderId(f.folderId);
                      }}
                      onToggleStar={(f) => handleToggleStar(f, "file")}
                      onTrash={(f) => handleTrash(f, "file")}
                      onToggleMenu={(id) => {
                        setSelectedFileForMenu(selectedFileForMenu === id ? null : id);
                        setSelectedFolderForMenu(null);
                      }}
                      onCloseMenu={() => setSelectedFileForMenu(null)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ) : sidebarFilter === "trash" ? (
          /* DEDICATED REDESIGNED TRASH BIN PAGE */
          <div className="space-y-6 max-w-7xl mx-auto">
            {/* Page header and title */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs relative overflow-hidden">
              <div className="absolute right-0 top-0 w-24 h-24 bg-rose-50 rounded-full blur-2xl opacity-50 -mr-6 -mt-6"></div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-rose-500" />
                  <span>Trash Bin</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Files and folders in Trash will be permanently deleted after the retention period of 30 days.
                </p>
              </div>
              
              {/* Auto-Delete Countdown Header Card */}
              {([...files, ...folders].filter(i => i.isTrash).length > 0) && (
                <div className="flex flex-col items-end gap-1.5 shrink-0 bg-rose-50/50 border border-rose-100 rounded-xl px-4 py-2.5 max-w-xs">
                  <div className="flex items-center gap-1.5 text-rose-700 font-extrabold text-[10px] uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5 animate-pulse text-rose-500 shrink-0" />
                    <span>Auto-delete in:</span>
                    <span className="font-mono font-bold lowercase text-rose-800 bg-white px-1.5 py-0.5 rounded border border-rose-200">
                      {(() => {
                        const trashed = [...files, ...folders].filter(i => i.isTrash);
                        if (trashed.length === 0) return "N/A";
                        const mins = trashed.map(i => getRemainingTimeMs(i));
                        const minMs = Math.min(...mins);
                        return formatRemainingTime(minMs);
                      })()}
                    </span>
                  </div>
                  <span className="text-[9px] text-rose-600 font-medium text-right">
                    Expires soonest countdown
                  </span>
                </div>
              )}
            </div>

            {/* TRASH CONTROLS BAR */}
            {([...files, ...folders].filter(i => i.isTrash).length > 0) && (
              <div className="flex flex-wrap items-center justify-between gap-4 bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleToggleSelectAllTrash}
                    className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isAllTrashSelected}
                      onChange={handleToggleSelectAllTrash}
                      onClick={(e) => e.stopPropagation()}
                      className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                    <span>Select All</span>
                  </button>

                  <button
                    onClick={() => setIsEmptyTrashOpen(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 px-3.5 py-2 rounded-xl border border-rose-100 cursor-pointer transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Empty Trash</span>
                  </button>
                </div>

                {/* Trash sorting */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sort By:</span>
                  <select
                    value={trashSortOption}
                    onChange={(e: any) => setTrashSortOption(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500 font-medium cursor-pointer hover:border-slate-300"
                  >
                    <option value="expires-soonest">Expires Soonest</option>
                    <option value="date-desc">Deleted (Newest)</option>
                    <option value="date-asc">Deleted (Oldest)</option>
                    <option value="size-desc">Size (Largest)</option>
                    <option value="size-asc">Size (Smallest)</option>
                    <option value="name-asc">Name A-Z</option>
                    <option value="name-desc">Name Z-A</option>
                  </select>
                </div>
              </div>
            )}

            {/* STATISTICS CARD */}
            {(() => {
              const trashedFiles = files.filter(f => f.isTrash);
              const trashedFolders = folders.filter(f => f.isTrash);
              const allTrash = [...trashedFiles, ...trashedFolders];

              if (allTrash.length === 0) return null;

              const totalSize = trashedFiles.reduce((sum, f) => sum + f.sizeBytes, 0);
              
              // Oldest item
              let oldestItemText = "N/A";
              if (allTrash.length > 0) {
                const dates = allTrash.map(item => ({ item, ms: getRemainingTimeMs(item) }));
                dates.sort((a, b) => a.ms - b.ms);
                const oldest = dates[0];
                if (oldest) {
                  const daysLeft = Math.ceil(oldest.ms / (1000 * 60 * 60 * 24));
                  oldestItemText = `${getDeletedAt(oldest.item).toLocaleDateString()} (${daysLeft}d left)`;
                }
              }

              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Total items */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400">Total Items</h4>
                      <p className="text-base font-bold text-slate-800">{allTrash.length}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                        {trashedFiles.length} file{trashedFiles.length !== 1 ? "s" : ""} • {trashedFolders.length} folder{trashedFolders.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  {/* Total Size */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <HardDrive className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400">Total Size</h4>
                      <p className="text-base font-bold text-slate-800">{formatBytes(totalSize)}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Storage to reclaim</p>
                    </div>
                  </div>

                  {/* Oldest Item */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400">Oldest Item</h4>
                      <p className="text-xs font-bold text-slate-800 truncate max-w-[150px]" title={oldestItemText}>
                        {oldestItemText}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Deleted earliest</p>
                    </div>
                  </div>

                  {/* Retention Period */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400">Retention</h4>
                      <p className="text-base font-bold text-slate-800">30 Days</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Auto-permanent delete</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* SECTIONS FOR FOLDERS AND FILES */}
            {(() => {
              const trashedFolders = folders.filter(f => f.isTrash);
              const trashedFiles = files.filter(f => f.isTrash);

              if (trashedFolders.length === 0 && trashedFiles.length === 0) {
                return (
                  <div className="py-24 text-center bg-white rounded-3xl border border-slate-200/80 shadow-2xs">
                    <div className="w-16 h-16 rounded-3xl bg-slate-50 border border-slate-100 text-slate-300 flex items-center justify-center mx-auto mb-4 shadow-3xs">
                      <Trash2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800">Trash bin is empty</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                      Deleted files and folders will appear here before they are permanently removed from your account.
                    </p>
                  </div>
                );
              }

              // Sorting logic for Trash items
              const sortTrash = (items: any[]) => {
                return [...items].sort((a, b) => {
                  if (trashSortOption === "expires-soonest") {
                    return getRemainingTimeMs(a) - getRemainingTimeMs(b);
                  }
                  if (trashSortOption === "date-desc") {
                    return getDeletedAt(b).getTime() - getDeletedAt(a).getTime();
                  }
                  if (trashSortOption === "date-asc") {
                    return getDeletedAt(a).getTime() - getDeletedAt(b).getTime();
                  }
                  if (trashSortOption === "size-desc") {
                    const aSize = "sizeBytes" in a ? a.sizeBytes : 0;
                    const bSize = "sizeBytes" in b ? b.sizeBytes : 0;
                    return bSize - aSize;
                  }
                  if (trashSortOption === "size-asc") {
                    const aSize = "sizeBytes" in a ? a.sizeBytes : 0;
                    const bSize = "sizeBytes" in b ? b.sizeBytes : 0;
                    return aSize - bSize;
                  }
                  if (trashSortOption === "name-asc") {
                    return a.name.localeCompare(b.name);
                  }
                  if (trashSortOption === "name-desc") {
                    return b.name.localeCompare(a.name);
                  }
                  return 0;
                });
              };

              const sortedTrashFolders = sortTrash(trashedFolders);
              const sortedTrashFiles = sortTrash(trashedFiles);

              return (
                <div className="space-y-8">
                  {/* TRASH FOLDERS */}
                  {sortedTrashFolders.length > 0 && (
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                        <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Folder className="w-4 h-4 text-slate-400" />
                          <span>Folders ({sortedTrashFolders.length})</span>
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {sortedTrashFolders.map((folder) => {
                          const isSelected = selectedTrashItems.has(folder.id);
                          return (
                            <div
                              key={folder.id}
                              onClick={() => handleToggleTrashSelect(folder.id)}
                              className={`group relative bg-white border rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all hover:shadow-xs ${
                                isSelected ? "border-blue-500 bg-blue-50/10 shadow-3xs" : "border-slate-200"
                              }`}
                            >
                              <div className="flex items-center gap-3.5 min-w-0">
                                {/* Circular checkbox overlay on hover or when selected */}
                                <div className="absolute top-4 left-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      handleToggleTrashSelect(folder.id);
                                    }}
                                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                                  />
                                </div>

                                <div className={`w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 text-${folder.color || 'blue'}-500 flex items-center justify-center shrink-0`}>
                                  <Folder className={`w-5 h-5 text-${folder.color || 'blue'}-500 fill-${folder.color || 'blue'}-500/20`} />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-slate-800 truncate" title={folder.name}>
                                    {folder.name}
                                  </h4>
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    {getRecursiveItemCount(folder.id)} items • deleted {getDeletedAt(folder).toLocaleDateString()}
                                  </p>
                                  {/* Expiration warning badge */}
                                  <div className="flex items-center gap-1 text-[9px] text-rose-600 font-extrabold uppercase mt-1.5 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded w-max">
                                    <Clock className="w-3 h-3 text-rose-500 shrink-0" />
                                    <span>expires in {formatRemainingTime(getRemainingTimeMs(folder))}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Actions menu */}
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => initiateRestore(folder, "folder")}
                                  className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                  title="Restore Folder"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handlePermanentDelete(folder, "folder")}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                  title="Delete Permanently"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TRASH FILES */}
                  {sortedTrashFiles.length > 0 && (
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                        <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-slate-400" />
                          <span>Files ({sortedTrashFiles.length})</span>
                        </h3>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                <th className="py-3 px-4 w-10"></th>
                                <th className="py-3 px-4">Name</th>
                                <th className="py-3 px-4">Original Path</th>
                                <th className="py-3 px-4">Size</th>
                                <th className="py-3 px-4">Deleted At</th>
                                <th className="py-3 px-4">Expires In</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortedTrashFiles.map((file) => {
                                const isSelected = selectedTrashItems.has(file.id);
                                return (
                                  <tr
                                    key={file.id}
                                    onClick={() => handleToggleTrashSelect(file.id)}
                                    className={`group hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-none cursor-pointer ${
                                      isSelected ? "bg-blue-50/20" : ""
                                    }`}
                                  >
                                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleToggleTrashSelect(file.id)}
                                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                                      />
                                    </td>
                                    <td className="py-3 px-4">
                                      <div className="flex items-center gap-3.5 min-w-0">
                                        <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                          {getFileCategoryIcon(file.category)}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="font-bold text-slate-800 truncate" title={file.name}>
                                            {file.name}
                                          </p>
                                          <p className="text-[10px] text-slate-400">{file.category.toUpperCase()}</p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 text-slate-500 font-medium max-w-[200px] truncate" title={getOriginalPath(file)}>
                                      {getOriginalPath(file)}
                                    </td>
                                    <td className="py-3 px-4 text-slate-600 font-semibold">{formatBytes(file.sizeBytes)}</td>
                                    <td className="py-3 px-4 text-slate-500 font-medium">
                                      {getDeletedAt(file).toLocaleDateString()} {getDeletedAt(file).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="py-3 px-4 font-extrabold text-rose-600">
                                      <div className="flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>{formatRemainingTime(getRemainingTimeMs(file))}</span>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center justify-end gap-1">
                                        <button
                                          onClick={() => initiateRestore(file, "file")}
                                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                          title="Restore File"
                                        >
                                          <RotateCcw className="w-4.5 h-4.5" />
                                        </button>
                                        <button
                                          onClick={() => handlePermanentDelete(file, "file")}
                                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                          title="Delete Permanently"
                                        >
                                          <Trash2 className="w-4.5 h-4.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : (
          /* STANDARD / RECENT / SEARCH DRIVE VIEW */
          <div className="space-y-6">
            {/* FOLDERS SECTION */}
            {sortedFolders.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>Folders ({sortedFolders.length})</span>
                </h3>
                {viewMode === "grid" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {sortedFolders.map((folder) => {
                      const itemCount = getFolderItemCount(folder.id);
                      const isDragTarget = dragOverFolderId === folder.id;

                      return (
                        <FolderGridCard
                          key={folder.id}
                          folder={folder}
                          itemCount={itemCount}
                          authToken={authToken}
                          isMenuOpen={selectedFolderForMenu === folder.id}
                          currentUserId={user?.id}
                          isDragTarget={isDragTarget}
                          onOpenFolder={handleOpenFolder}
                          onShare={(f) => onOpenShareModal({ type: "folder", item: f })}
                          onRename={(f) => openRenameModal("folder", f.id, f.name)}
                          onMove={(f) => openMoveModal(f, "folder")}
                          onToggleStar={(f) => handleToggleStar(f, "folder")}
                          onTrash={(f) => handleTrash(f, "folder")}
                          onToggleMenu={(id) => {
                            setSelectedFolderForMenu(selectedFolderForMenu === id ? null : id);
                            setSelectedFileForMenu(null);
                          }}
                          onCloseMenu={() => setSelectedFolderForMenu(null)}
                          onDragStart={(e, f) => {
                            e.dataTransfer.setData("text/plain", f.id);
                            setDraggedItem({ type: "folder", id: f.id, name: f.name });
                          }}
                          onDragOver={(e, f) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (draggedItem?.id !== f.id) {
                              setDragOverFolderId(f.id);
                            }
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (dragOverFolderId === folder.id) {
                              setDragOverFolderId(null);
                            }
                          }}
                          onDrop={(e, f) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDragOverFolderId(null);
                            if (draggedItem?.id !== f.id) {
                              handleDropOnFolder(f.id);
                            }
                          }}
                        />
                      );
                    })}
                  </div>
                ) : (
                  /* LIST VIEW FOR FOLDERS */
                  <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs mb-4">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4">Name</th>
                          <th className="py-2.5 px-4">Type</th>
                          <th className="py-2.5 px-4">Items</th>
                          <th className="py-2.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {sortedFolders.map((folder) => {
                          const colorCls = getFolderColorClasses(folder.color);
                          const itemCount = getFolderItemCount(folder.id);
                          const isDragTarget = dragOverFolderId === folder.id;

                          return (
                            <tr
                              key={folder.id}
                              draggable={true}
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", folder.id);
                                setDraggedItem({ type: "folder", id: folder.id, name: folder.name });
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (draggedItem?.id !== folder.id) setDragOverFolderId(folder.id);
                              }}
                              onDragLeave={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (dragOverFolderId === folder.id) setDragOverFolderId(null);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDragOverFolderId(null);
                                if (draggedItem?.id !== folder.id) handleDropOnFolder(folder.id);
                              }}
                              onClick={() => handleOpenFolder(folder)}
                              className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                                isDragTarget ? "bg-blue-50/80 ring-2 ring-blue-500" : ""
                              }`}
                            >
                              <td className="py-2.5 px-4">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <Folder className={`w-4 h-4 shrink-0 ${colorCls.text}`} />
                                  <span className="font-semibold text-slate-800 hover:text-blue-600 truncate max-w-xs">
                                    {folder.name}
                                  </span>
                                  {folder.isStarred && (
                                    <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-4 text-slate-500">Folder</td>
                              <td className="py-2.5 px-4 text-slate-500 font-medium">{itemCount}</td>
                              <td className="py-2.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenFolder(folder)}
                                    className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded-lg font-semibold"
                                  >
                                    Open
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onOpenShareModal({ type: "folder", item: folder })}
                                    className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100"
                                    title="Share"
                                  >
                                    <Share2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRenameTarget({ type: "folder", id: folder.id, name: folder.name });
                                      setRenameValue(folder.name);
                                    }}
                                    className="p-1 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-slate-100"
                                    title="Rename"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMoveTarget({ type: "folder", id: folder.id, name: folder.name, currentParentId: folder.parentId });
                                      setSelectedMoveFolderId(folder.parentId);
                                    }}
                                    className="p-1 text-slate-400 hover:text-purple-600 rounded-lg hover:bg-slate-100"
                                    title="Move"
                                  >
                                    <FolderInput className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleTrash(folder, "folder")}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                                    title="Move to Trash"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* FILES SECTION */}
            <div>
              <div className="flex items-center justify-between mb-4 bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={paginatedFiles.length > 0 && paginatedFiles.every(f => selectedFileIds.has(f.id))}
                    onChange={handleSelectAllVisibleFiles}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    title="Select all visible files"
                  />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Files ({sortedFiles.length}) {selectedFileIds.size > 0 && `(${selectedFileIds.size} selected)`}
                  </h3>
                </div>
                {selectedFileIds.size > 0 && (
                  <button
                    onClick={handleClearSelection}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                  >
                    Clear selection
                  </button>
                )}
              </div>

              {sortedFiles.length === 0 && sortedFolders.length === 0 ? (
                /* EMPTY STATES */
                <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/40">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    {(sidebarFilter as string) === "starred" ? (
                      <Star className="w-6 h-6 text-amber-400" />
                    ) : (sidebarFilter as string) === "trash" ? (
                      <Trash2 className="w-6 h-6 text-rose-400" />
                    ) : debouncedSearchQuery ? (
                      <Search className="w-6 h-6 text-blue-400" />
                    ) : (
                      <Folder className="w-6 h-6 text-blue-400" />
                    )}
                  </div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-1">
                    {(sidebarFilter as string) === "starred"
                      ? "Nothing starred yet"
                      : (sidebarFilter as string) === "trash"
                      ? "Trash bin is empty"
                      : debouncedSearchQuery
                      ? `No files or folders found matching "${debouncedSearchQuery}"`
                      : "This folder is empty"}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                    {(sidebarFilter as string) === "starred"
                      ? "Star important files and folders to access them quickly here."
                      : (sidebarFilter as string) === "trash"
                      ? "Deleted items will appear here before being permanently removed."
                      : debouncedSearchQuery
                      ? "Try searching with a different keyword or clearing applied filters."
                      : "Upload files or create folders using the buttons above to get started."}
                  </p>

                  {debouncedSearchQuery && (
                    <button
                      onClick={() => {
                        setSearchInput("");
                        setDebouncedSearchQuery("");
                        setSidebarFilter("all");
                      }}
                      className="px-4 py-2 bg-blue-600 text-white font-semibold text-xs rounded-xl shadow-2xs hover:bg-blue-700 transition-all cursor-pointer"
                    >
                      Clear Search
                    </button>
                  )}
                </div>
              ) : viewMode === "grid" ? (
                /* GRID VIEW WITH VISUAL PREVIEWS */
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {paginatedFiles.map((file) => (
                    <FileGridCard
                      key={file.id}
                      file={file}
                      authToken={authToken}
                      isSelected={selectedFileIds.has(file.id)}
                      isMenuOpen={selectedFileForMenu === file.id}
                      currentUserId={user?.id}
                      onToggleSelect={handleToggleFileSelect}
                      onPreview={handlePreviewFile}
                      onDownload={handleDownloadFile}
                      onShare={(f) => onOpenShareModal({ type: "file", item: f })}
                      onRename={(f) => {
                        setRenameTarget({ type: "file", id: f.id, name: f.name });
                        setRenameValue(f.name);
                      }}
                      onMove={(f) => {
                        setMoveTarget({ type: "file", id: f.id, name: f.name, currentParentId: f.folderId });
                        setSelectedMoveFolderId(f.folderId);
                      }}
                      onToggleStar={(f) => handleToggleStar(f, "file")}
                      onTrash={(f) => handleTrash(f, "file")}
                      onToggleMenu={(id) => {
                        setSelectedFileForMenu(selectedFileForMenu === id ? null : id);
                        setSelectedFolderForMenu(null);
                      }}
                      onCloseMenu={() => setSelectedFileForMenu(null)}
                      onDragStart={(e, f) => {
                        e.dataTransfer.setData("text/plain", f.id);
                        setDraggedItem({ type: "file", id: f.id, name: f.name });
                      }}
                      onNavigateToAi={(f) => {
                        if (onNavigate) onNavigate("/ai-assistant");
                      }}
                    />
                  ))}
                </div>
              ) : (
                /* LIST VIEW TABLE */
                <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4 w-10">
                          <input
                            type="checkbox"
                            checked={paginatedFiles.length > 0 && paginatedFiles.every(f => selectedFileIds.has(f.id))}
                            onChange={handleSelectAllVisibleFiles}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                            title="Select all visible files"
                          />
                        </th>
                        <th className="py-3 px-4">Name</th>
                        <th className="py-3 px-4">Location</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Size</th>
                        <th className="py-3 px-4">Modified</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {paginatedFiles.map((file) => {
                        const isSelected = selectedFileIds.has(file.id);
                        return (
                          <tr
                            key={file.id}
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", file.id);
                              setDraggedItem({ type: "file", id: file.id, name: file.name });
                            }}
                            className={`hover:bg-slate-50 transition-colors select-none cursor-grab active:cursor-grabbing ${isSelected ? "bg-blue-50/40" : ""}`}
                          >
                            <td className="py-3 px-4 w-10">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleFileSelect(file.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2 min-w-0">
                                {getFileCategoryIcon(file.category)}
                                <span
                                  className="font-semibold text-slate-800 hover:text-blue-600 cursor-pointer truncate max-w-xs"
                                  onClick={() => handlePreviewFile(file)}
                                >
                                  {file.name}
                                </span>
                              </div>
                            </td>
                          <td className="py-3 px-4 text-slate-500 font-medium">{getFolderName(file.folderId)}</td>
                          <td className="py-3 px-4 capitalize text-slate-500">{file.category}</td>
                          <td className="py-3 px-4 text-slate-600 font-medium">{formatBytes(file.sizeBytes)}</td>
                          <td className="py-3 px-4 text-slate-400">{new Date(file.createdAt).toLocaleDateString()}</td>
                          <td className="py-3 px-4 text-right space-x-1">
                            {(sidebarFilter as string) === "trash" || file.isTrash ? (
                              <>
                                <button
                                  onClick={() => handleRestore(file, "file")}
                                  className="px-2.5 py-1 text-emerald-600 hover:bg-emerald-50 rounded-lg font-medium cursor-pointer"
                                >
                                  Restore
                                </button>
                                <button
                                  onClick={() => handlePermanentDelete(file, "file")}
                                  className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded-lg font-medium cursor-pointer"
                                >
                                  Delete
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handlePreviewFile(file)}
                                  className="px-2.5 py-1 text-blue-600 hover:bg-blue-50 rounded-lg font-medium cursor-pointer"
                                >
                                  Preview
                                </button>
                                <button
                                  onClick={() => handleDownloadFile(file)}
                                  className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                                >
                                  Download
                                </button>
                                <button
                                  onClick={() => onOpenShareModal({ type: "file", item: file })}
                                  className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                                >
                                  Share
                                </button>
                                <button
                                  onClick={() => handleTrash(file, "file")}
                                  className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded-lg font-medium cursor-pointer"
                                >
                                  Trash
                                </button>
                              </>
                            )}

                            <div className="inline-block relative text-left align-middle" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setSelectedFileForMenu(selectedFileForMenu === file.id ? null : file.id)}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                              {selectedFileForMenu === file.id && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setSelectedFileForMenu(null)} />
                                  <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg p-1 z-50 text-xs text-slate-700 text-left">
                                    {file.isTrash ? (
                                      <>
                                        <button
                                          onClick={() => { setSelectedFileForMenu(null); handleRestore(file, "file"); }}
                                          className="w-full text-left px-3 py-2 text-emerald-700 hover:bg-emerald-50 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                        >
                                          <RotateCcw className="w-3.5 h-3.5" /> Restore
                                        </button>
                                        <button
                                          onClick={() => { setSelectedFileForMenu(null); handlePermanentDelete(file, "file"); }}
                                          className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" /> Delete Permanently
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => { setSelectedFileForMenu(null); handlePreviewFile(file); }}
                                          className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                        >
                                          <Eye className="w-3.5 h-3.5 text-blue-600" /> Preview
                                        </button>
                                        <button
                                          onClick={() => {
                                            setSelectedFileForMenu(null);
                                            if (onNavigate) onNavigate("/ai-assistant");
                                          }}
                                          className="w-full text-left px-3 py-2 text-indigo-700 hover:bg-indigo-50 rounded-lg flex items-center gap-2 font-semibold cursor-pointer"
                                        >
                                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> AI Assistant
                                        </button>
                                        <button
                                          onClick={() => { setSelectedFileForMenu(null); handleDownloadFile(file); }}
                                          className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                        >
                                          <Download className="w-3.5 h-3.5 text-slate-600" /> Download
                                        </button>
                                        <button
                                          onClick={() => { setSelectedFileForMenu(null); onOpenShareModal({ type: "file", item: file }); }}
                                          className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                        >
                                          <Share2 className="w-3.5 h-3.5 text-indigo-600" /> Share
                                        </button>
                                        <button
                                          onClick={() => { setSelectedFileForMenu(null); setRenameTarget({ type: "file", id: file.id, name: file.name }); setRenameValue(file.name); }}
                                          className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                        >
                                          <Edit3 className="w-3.5 h-3.5 text-amber-600" /> Rename
                                        </button>
                                        <button
                                          onClick={() => { setSelectedFileForMenu(null); setMoveTarget({ type: "file", id: file.id, name: file.name, currentParentId: file.folderId }); setSelectedMoveFolderId(file.folderId); }}
                                          className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                        >
                                          <FolderInput className="w-3.5 h-3.5 text-purple-600" /> Move
                                        </button>
                                        <button
                                          onClick={() => { setSelectedFileForMenu(null); handleToggleStar(file, "file"); }}
                                          className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                                        >
                                          <Star className={`w-3.5 h-3.5 ${file.isStarred ? "text-amber-500 fill-amber-500" : "text-slate-400"}`} />
                                          {file.isStarred ? "Remove Star" : "Star Item"}
                                        </button>
                                        <div className="my-1 border-t border-slate-100" />
                                        <button
                                          onClick={() => { setSelectedFileForMenu(null); handleTrash(file, "file"); }}
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
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* PAGINATION CONTROLS */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-200 mt-6 text-xs text-slate-600">
                  <span>
                    Showing page <strong className="text-slate-900">{currentPage}</strong> of{" "}
                    <strong className="text-slate-900">{totalPages}</strong>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg disabled:opacity-40 font-medium hover:bg-slate-50 cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg disabled:opacity-40 font-medium hover:bg-slate-50 cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* NEW FOLDER MODAL */}
      {isNewFolderOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 mb-4">Create New Folder</h3>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Folder Name</label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. Work Documents"
                  autoFocus
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Accent Color</label>
                <div className="flex items-center gap-2">
                  {["blue", "indigo", "rose", "emerald", "amber", "purple"].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewFolderColor(color)}
                      className={`w-7 h-7 rounded-full bg-${color}-500 border-2 transition-transform cursor-pointer ${
                        newFolderColor === color ? "border-slate-900 scale-110" : "border-transparent hover:scale-105"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewFolderOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-2xs cursor-pointer"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FILE PREVIEW MODAL */}
      {previewFile && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className={`bg-white border border-slate-200 rounded-2xl w-full ${
            previewFile.file.category === "video" ? "max-w-4xl" : "max-w-3xl"
          } overflow-hidden shadow-2xl flex flex-col max-h-[92vh]`}>
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                {getFileCategoryIcon(previewFile.file.category)}
                <span className="font-bold text-slate-800 text-sm truncate">{previewFile.file.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openRenameModal("file", previewFile.file.id, previewFile.file.name)}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-600" /> Rename
                </button>
                <button
                  onClick={() => handleDownloadFile(previewFile.file)}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1 hover:bg-blue-700 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
                <button onClick={() => setPreviewFile(null)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className={`p-4 sm:p-6 overflow-y-auto flex-1 flex items-center justify-center ${
              previewFile.file.category === "video" ? "bg-black p-0 sm:p-2" : "bg-slate-900/5 min-h-[300px]"
            }`}>
              {previewFile.file.category === "image" ? (
                <img src={previewFile.url} alt={previewFile.file.name} className="max-h-[65vh] object-contain rounded-lg shadow-md" />
              ) : previewFile.file.category === "video" ? (
                <div className="w-full flex items-center justify-center">
                  <VideoPlayer
                    file={previewFile.file}
                    srcUrl={previewFile.url}
                    authToken={authToken}
                    onDownload={() => handleDownloadFile(previewFile.file)}
                  />
                </div>
              ) : previewFile.file.category === "audio" ? (
                <audio src={previewFile.url} controls className="w-full max-w-md" />
              ) : (
                <div className="text-center p-8 bg-white border border-slate-200 rounded-2xl shadow-2xs max-w-md">
                  <FileText className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                  <h4 className="font-bold text-slate-800 text-sm mb-1">{previewFile.file.name}</h4>
                  <p className="text-xs text-slate-400 mb-4">{formatBytes(previewFile.file.sizeBytes)} • {previewFile.file.mimeType}</p>
                  <a
                    href={previewFile.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 shadow-2xs"
                  >
                    Open Document <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PERMANENT DELETE CONFIRMATION MODAL */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">
              Permanently Delete {deleteConfirmTarget.type === "file" ? "File" : "Folder"}?
            </h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-slate-800">"{deleteConfirmTarget.item.name}"</strong>? This action cannot be undone and will remove it permanently.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executePermanentDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENAME MODAL */}
      {renameTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Edit3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Rename {renameTarget.type === "folder" ? "Folder" : "File"}
                </h3>
                <p className="text-[11px] text-slate-500">Enter a new name for this {renameTarget.type}</p>
              </div>
            </div>

            <form onSubmit={handleRenameSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => {
                    setRenameValue(e.target.value);
                    if (modalErrorMsg) setModalErrorMsg(null);
                  }}
                  placeholder="Enter name..."
                  autoFocus
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white font-medium"
                />
                {renameTarget.type === "file" && (
                  <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-blue-500 inline shrink-0" />
                    File extension will be preserved automatically if omitted.
                  </p>
                )}
                {modalErrorMsg && (
                  <div className="text-xs font-semibold text-rose-600 mt-2.5 bg-rose-50 border border-rose-200 rounded-xl p-2.5 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{modalErrorMsg}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRenameTarget(null);
                    setRenameValue("");
                    setModalErrorMsg(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!renameValue.trim() || isLoading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOVE MODAL */}
      {moveTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-5 shadow-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <FolderInput className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900 truncate">
                  Move "{moveTarget.name}"
                </h3>
                <p className="text-xs text-slate-500">
                  Select destination folder in CloudVault
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMoveTarget(null);
                  setSelectedMoveFolderId(null);
                  setMoveModalNavFolderId(null);
                  setMoveSearchQuery("");
                  setMoveModalErrorMsg(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Location vs Target Location Banner */}
            <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600 mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-slate-400">Current:</span>
                <span className="font-semibold text-slate-800 truncate">
                  {getFolderName(moveTarget.currentParentId)}
                </span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-slate-400">Target:</span>
                <span className="font-semibold text-blue-600 truncate">
                  {getFolderName(selectedMoveFolderId)}
                </span>
              </div>
            </div>

            {/* Error Message Banner if Conflict / Fail */}
            {moveModalErrorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium flex items-start gap-2 mb-3 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 leading-snug">{moveModalErrorMsg}</div>
                <button
                  type="button"
                  onClick={() => setMoveModalErrorMsg(null)}
                  className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
                >
                  ×
                </button>
              </div>
            )}

            {/* Same location Warning */}
            {selectedMoveFolderId === moveTarget.currentParentId && !moveModalErrorMsg && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-medium flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>File is already located in this folder.</span>
              </div>
            )}

            {/* Modal Folder Navigation & Quick Search Bar */}
            <div className="space-y-2 mb-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={moveSearchQuery}
                  onChange={(e) => setMoveSearchQuery(e.target.value)}
                  placeholder="Filter folders by name..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:bg-white"
                />
                {moveSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setMoveSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Breadcrumb row inside Modal */}
              {!moveSearchQuery && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setMoveModalNavFolderId(null)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                      moveModalNavFolderId === null
                        ? "bg-blue-100 text-blue-700 font-bold"
                        : "hover:bg-slate-100 text-slate-600 font-medium"
                    }`}
                  >
                    <HardDrive className="w-3.5 h-3.5 text-blue-600" /> My Drive
                  </button>

                  {getFolderBreadcrumbs(moveModalNavFolderId).map((crumb) => (
                    <React.Fragment key={crumb.id}>
                      <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <button
                        type="button"
                        onClick={() => setMoveModalNavFolderId(crumb.id)}
                        className={`px-2 py-1 rounded-lg transition-colors cursor-pointer shrink-0 truncate max-w-[120px] ${
                          moveModalNavFolderId === crumb.id
                            ? "bg-blue-100 text-blue-700 font-bold"
                            : "hover:bg-slate-100 text-slate-600 font-medium"
                        }`}
                      >
                        {crumb.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>

            {/* Folder Browser Directory View */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 min-h-[180px] max-h-[250px] bg-slate-50/50">
              {/* My Drive (Root) button */}
              {moveModalNavFolderId === null && !moveSearchQuery && (
                <button
                  type="button"
                  onClick={() => setSelectedMoveFolderId(null)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all cursor-pointer ${
                    selectedMoveFolderId === null
                      ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs"
                      : "text-slate-700 hover:bg-slate-100 border border-transparent bg-white"
                  }`}
                >
                  <HardDrive className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>My Drive (Root)</span>
                  {selectedMoveFolderId === null && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 ml-auto shrink-0" />
                  )}
                </button>
              )}

              {/* Folders List */}
              {(() => {
                const availableFolders = folders.filter((f) => {
                  if (f.isTrash) return false;
                  if (moveTarget.type === "folder") {
                    if (f.id === moveTarget.id || isChild(f.id, moveTarget.id)) return false;
                  }
                  if (moveSearchQuery.trim()) {
                    return f.name.toLowerCase().includes(moveSearchQuery.trim().toLowerCase());
                  }
                  return (f.parentId || null) === moveModalNavFolderId;
                });

                if (availableFolders.length === 0) {
                  return (
                    <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1.5">
                      <Folder className="w-8 h-8 text-slate-300 stroke-1" />
                      <span>{moveSearchQuery ? "No matching folders found" : "This folder is empty"}</span>
                    </div>
                  );
                }

                return availableFolders.map((f) => {
                  const isSelected = selectedMoveFolderId === f.id;
                  const colorCls = getFolderColorClasses(f.color || "blue");
                  const hasSubfolders = folders.some((child) => (child.parentId || null) === f.id && !child.isTrash);

                  return (
                    <div
                      key={f.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all bg-white border ${
                        isSelected
                          ? "bg-blue-50 text-blue-700 border-blue-200 font-semibold shadow-2xs"
                          : "text-slate-700 hover:bg-slate-100 border-slate-200/60"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedMoveFolderId(f.id)}
                        className="flex-1 flex items-center gap-2 text-left cursor-pointer min-w-0"
                      >
                        <Folder className={`w-4 h-4 shrink-0 ${colorCls.text}`} />
                        <span className="truncate">{f.name}</span>
                        {isSelected && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 ml-auto shrink-0" />
                        )}
                      </button>

                      {hasSubfolders && !moveSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setMoveModalNavFolderId(f.id)}
                          title="Open folder"
                          className="p-1 hover:bg-slate-200/70 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Footer buttons */}
            <form onSubmit={handleMoveSubmit} className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => {
                  setMoveTarget(null);
                  setSelectedMoveFolderId(null);
                  setMoveModalNavFolderId(null);
                  setMoveSearchQuery("");
                  setMoveModalErrorMsg(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={selectedMoveFolderId === moveTarget.currentParentId || isLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 rounded-xl shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Moving...
                  </>
                ) : (
                  <>
                    <FolderInput className="w-3.5 h-3.5" /> Move Here
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* COPY FILE MODAL */}
      {copyTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-5 shadow-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                <Copy className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900 truncate">
                  Make a copy of "{copyTarget.name}"
                </h3>
                <p className="text-xs text-slate-500">
                  Select destination folder for the new copy
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCopyTarget(null);
                  setSelectedCopyFolderId(null);
                  setCopyModalNavFolderId(null);
                  setCopySearchQuery("");
                  setCopyModalErrorMsg(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Location Banner */}
            <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600 mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-slate-400">Destination:</span>
                <span className="font-semibold text-teal-700 truncate">
                  {getFolderName(selectedCopyFolderId)}
                </span>
              </div>
            </div>

            {/* Error Message Banner */}
            {copyModalErrorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium flex items-start gap-2 mb-3 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 leading-snug">{copyModalErrorMsg}</div>
                <button
                  type="button"
                  onClick={() => setCopyModalErrorMsg(null)}
                  className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
                >
                  ×
                </button>
              </div>
            )}

            {/* Modal Folder Navigation & Quick Search Bar */}
            <div className="space-y-2 mb-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={copySearchQuery}
                  onChange={(e) => setCopySearchQuery(e.target.value)}
                  placeholder="Filter folders by name..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:bg-white"
                />
                {copySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setCopySearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Breadcrumb row inside Modal */}
              {!copySearchQuery && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setCopyModalNavFolderId(null)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                      copyModalNavFolderId === null
                        ? "bg-teal-100 text-teal-700 font-bold"
                        : "hover:bg-slate-100 text-slate-600 font-medium"
                    }`}
                  >
                    <HardDrive className="w-3.5 h-3.5 text-teal-600" /> My Drive
                  </button>

                  {getFolderBreadcrumbs(copyModalNavFolderId).map((crumb) => (
                    <React.Fragment key={crumb.id}>
                      <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <button
                        type="button"
                        onClick={() => setCopyModalNavFolderId(crumb.id)}
                        className={`px-2 py-1 rounded-lg transition-colors cursor-pointer shrink-0 truncate max-w-[120px] ${
                          copyModalNavFolderId === crumb.id
                            ? "bg-teal-100 text-teal-700 font-bold"
                            : "hover:bg-slate-100 text-slate-600 font-medium"
                        }`}
                      >
                        {crumb.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>

            {/* Folder Browser Directory View */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 min-h-[180px] max-h-[250px] bg-slate-50/50">
              {/* My Drive (Root) button */}
              {copyModalNavFolderId === null && !copySearchQuery && (
                <button
                  type="button"
                  onClick={() => setSelectedCopyFolderId(null)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all cursor-pointer ${
                    selectedCopyFolderId === null
                      ? "bg-teal-50 text-teal-700 border border-teal-200 shadow-2xs"
                      : "text-slate-700 hover:bg-slate-100 border border-transparent bg-white"
                  }`}
                >
                  <HardDrive className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>My Drive (Root)</span>
                  {selectedCopyFolderId === null && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 ml-auto shrink-0" />
                  )}
                </button>
              )}

              {/* Folders List */}
              {(() => {
                const availableFolders = folders.filter((f) => {
                  if (f.isTrash) return false;
                  if (copySearchQuery.trim()) {
                    return f.name.toLowerCase().includes(copySearchQuery.trim().toLowerCase());
                  }
                  return (f.parentId || null) === copyModalNavFolderId;
                });

                if (availableFolders.length === 0) {
                  return (
                    <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1.5">
                      <Folder className="w-8 h-8 text-slate-300 stroke-1" />
                      <span>{copySearchQuery ? "No matching folders found" : "This folder is empty"}</span>
                    </div>
                  );
                }

                return availableFolders.map((f) => {
                  const isSelected = selectedCopyFolderId === f.id;
                  const colorCls = getFolderColorClasses(f.color || "blue");
                  const hasSubfolders = folders.some((child) => (child.parentId || null) === f.id && !child.isTrash);

                  return (
                    <div
                      key={f.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all bg-white border ${
                        isSelected
                          ? "bg-teal-50 text-teal-700 border-teal-200 font-semibold shadow-2xs"
                          : "text-slate-700 hover:bg-slate-100 border-slate-200/60"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedCopyFolderId(f.id)}
                        className="flex-1 flex items-center gap-2 text-left cursor-pointer min-w-0"
                      >
                        <Folder className={`w-4 h-4 shrink-0 ${colorCls.text}`} />
                        <span className="truncate">{f.name}</span>
                        {isSelected && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 ml-auto shrink-0" />
                        )}
                      </button>

                      {hasSubfolders && !copySearchQuery && (
                        <button
                          type="button"
                          onClick={() => setCopyModalNavFolderId(f.id)}
                          title="Open folder"
                          className="p-1 hover:bg-slate-200/70 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Footer buttons */}
            <form onSubmit={handleCopySubmit} className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => {
                  setCopyTarget(null);
                  setSelectedCopyFolderId(null);
                  setCopyModalNavFolderId(null);
                  setCopySearchQuery("");
                  setCopyModalErrorMsg(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCopying}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-xl shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                {isCopying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Copying...
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copy Here
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FILE TRASH CONFIRMATION MODAL */}
      {fileTrashConfirmTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">
              Move File to Trash?
            </h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Are you sure you want to move <strong className="text-slate-900 font-semibold">"{fileTrashConfirmTarget.name}"</strong> to Trash?
            </p>
            <p className="text-[11px] text-slate-400 mb-6 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              💡 You can restore this file anytime from the Trash bin before it is permanently deleted.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setFileTrashConfirmTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = fileTrashConfirmTarget;
                  setFileTrashConfirmTarget(null);
                  executeFileTrash(target);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Move to Trash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOLDER TRASH CONFIRMATION MODAL */}
      {folderTrashConfirmTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">
              Move Folder to Trash?
            </h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Moving <strong className="text-slate-900 font-semibold">"{folderTrashConfirmTarget.name}"</strong> to Trash will also move all files and subfolders inside it to Trash.
            </p>
            <p className="text-[11px] text-slate-400 mb-6 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              💡 You can restore this folder and its contents anytime from the Trash bin before it is permanently deleted.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setFolderTrashConfirmTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = folderTrashConfirmTarget;
                  setFolderTrashConfirmTarget(null);
                  executeFolderTrash(target);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Move to Trash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FILE UPLOAD PROGRESS PANEL */}
      {showUploadPanel && Object.keys(uploads).length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-slate-900 px-4 py-3 flex items-center justify-between">
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <Upload className="w-3.5 h-3.5" /> 
              Uploading {Object.values(uploads).filter(u => u.status === "uploading" || u.status === "pending").length} items
            </h4>
            <div className="flex items-center gap-1">
              <button 
                onClick={clearCompletedUploads}
                className="p-1 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors cursor-pointer"
                title="Clear completed"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setShowUploadPanel(false)}
                className="p-1 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 p-1">
            {Object.values(uploads).sort((a, b) => b.id.localeCompare(a.id)).map((upload) => (
              <div key={upload.id} className="p-3 bg-white hover:bg-slate-50 transition-colors rounded-xl">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="shrink-0 w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-800 truncate" title={upload.name}>
                      {upload.name}
                    </span>
                  </div>
                  <div className="shrink-0">
                    {upload.status === "completed" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : upload.status === "failed" ? (
                      <div className="flex items-center gap-1">
                        <AlertCircle className="w-4 h-4 text-rose-500" />
                        <button 
                          onClick={() => retryUpload(upload.id)}
                          className="p-1 hover:bg-rose-100 text-rose-600 rounded-lg"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    )}
                  </div>
                </div>
                
                {upload.status === "failed" ? (
                  <p className="text-[10px] text-rose-500 font-medium px-9 mb-1">{upload.error}</p>
                ) : (
                  <div className="pl-9 space-y-1">
                    <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${upload.status === "completed" ? "bg-emerald-500" : "bg-blue-600"}`}
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      <span>{upload.status}</span>
                      <span>{upload.progress}%</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FLOATING SELECTION TOOLBAR */}
      {selectedFileIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
              {selectedFileIds.size}
            </span>
            <span className="text-xs font-semibold">Selected</span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                paginatedFiles
                  .filter(f => selectedFileIds.has(f.id))
                  .forEach(f => handleDownloadFile(f));
              }}
              className="px-3 py-1.5 text-xs font-semibold hover:bg-slate-800 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-slate-200"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" /> Download
            </button>
            <button
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold hover:bg-rose-950/50 text-rose-300 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <button
            onClick={handleClearSelection}
            className="text-xs text-slate-400 hover:text-white font-medium cursor-pointer"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* BULK DELETE CONFIRMATION MODAL */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Move {selectedFileIds.size} file{selectedFileIds.size === 1 ? "" : "s"} to Trash?
                </h3>
                <p className="text-xs text-slate-500">
                  Selected files will be moved to Trash and can be restored later.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-6">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={handleBulkDeleteSubmit}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                {isBulkDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Moving to Trash...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" /> Move to Trash
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VERSION HISTORY MODAL */}
      {versionHistoryTargetFile && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">Version History</h2>
                  <p className="text-xs text-slate-500 truncate max-w-sm">{versionHistoryTargetFile.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition-all">
                  <Upload className="w-3.5 h-3.5" /> Upload New Version
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleUploadNewVersion(versionHistoryTargetFile.id, e.target.files[0]);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
                <button
                  onClick={() => setVersionHistoryTargetFile(null)}
                  className="w-8 h-8 rounded-full hover:bg-slate-200/60 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {isLoadingVersions ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <p className="text-sm font-medium">Loading version history...</p>
                </div>
              ) : versionHistoryList.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Clock className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">No previous versions available.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {versionHistoryList.map((ver) => {
                    const isCurrent = ver.id === currentVersionId || ver.versionNumber === Math.max(...versionHistoryList.map(v => v.versionNumber));
                    return (
                      <div
                        key={ver.id}
                        className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                          isCurrent ? "bg-blue-50/40 border-blue-200 shadow-xs" : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isCurrent ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                          }`}>
                            v{ver.versionNumber}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-800">Version {ver.versionNumber}</span>
                              {isCurrent && (
                                <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  Current
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {new Date(ver.createdAt).toLocaleString()} • {(ver.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDownloadVersion(versionHistoryTargetFile.id, ver.id)}
                            disabled={versionActionLoading === ver.id}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                            title="Download this version"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </button>
                          {!isCurrent && (
                            <button
                              onClick={() => handleRestoreVersion(versionHistoryTargetFile.id, ver.id, ver.versionNumber)}
                              disabled={versionActionLoading === ver.id}
                              className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                              title="Restore this version as current"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Restore
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
              <span>Restoring a version preserves all previous version history.</span>
              <button
                onClick={() => setVersionHistoryTargetFile(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS TOAST NOTIFICATION */}
      {successToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-fade-in border border-slate-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successToast}</span>
          {undoTarget && successToast.includes("Trash") && (
            <button
              type="button"
              onClick={() => {
                handleUndoTrash();
                setSuccessToast(null);
              }}
              className="ml-2 bg-slate-800 hover:bg-slate-700 text-amber-400 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
