import React, { useState, useMemo, useEffect } from "react";
import { ActivityLogItem, UserProfile } from "../types/index.js";
import { getSupabaseBrowserClient } from "../lib/supabase.js";
import {
  Clock,
  Upload,
  Download,
  FolderPlus,
  Edit3,
  FolderInput,
  Trash2,
  RotateCcw,
  Share2,
  Link,
  Shield,
  Filter,
  ArrowUpDown,
  Search,
  Calendar,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  MoreVertical,
  Activity,
  ShieldCheck,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Eye,
  User,
  X,
  Info,
  ExternalLink,
  Folder
} from "lucide-react";

interface ActivityViewProps {
  activities: ActivityLogItem[];
  isLoading?: boolean;
  user?: { id: string; email: string } | null;
  profile?: UserProfile | null;
  onRefresh?: () => void;
}

export function ActivityView({
  activities,
  isLoading = false,
  user = null,
  profile = null,
  onRefresh
}: ActivityViewProps) {
  // Filters & State
  const [selectedActionFilter, setSelectedActionFilter] = useState<string>("all");
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  // UI state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedDetailLog, setSelectedDetailLog] = useState<ActivityLogItem | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Resolved user profiles state
  const [resolvedProfiles, setResolvedProfiles] = useState<Record<string, { fullName: string; email: string; avatarUrl?: string }>>({});

  // Fetch profiles of other users involved in activity log
  useEffect(() => {
    const fetchProfiles = async () => {
      const uniqueUserIds = Array.from(
        new Set(
          activities
            .map((a) => a.userId)
            .filter((id) => id && id !== user?.id)
        )
      );
      if (uniqueUserIds.length === 0) return;

      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, email, full_name, avatar_url")
          .in("id", uniqueUserIds);

        if (!error && data) {
          const profilesMap: Record<string, { fullName: string; email: string; avatarUrl?: string }> = {};
          data.forEach((row: any) => {
            profilesMap[row.id] = {
              fullName: row.full_name || row.email?.split("@")[0] || "User",
              email: row.email || "",
              avatarUrl: row.avatar_url || undefined,
            };
          });
          setResolvedProfiles((prev) => ({ ...prev, ...profilesMap }));
        }
      } catch (err) {
        console.warn("Error fetching other user profiles in ActivityView:", err);
      }
    };

    if (activities.length > 0 && user?.id) {
      fetchProfiles();
    }
  }, [activities, user?.id]);

  // Click outside to close menus
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMenuId(null);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // Show Toast Auto-dismiss
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  useEffect(() => {
    if (errorToast) {
      const timer = setTimeout(() => setErrorToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [errorToast]);

  // Reset page to 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedActionFilter, selectedDateFilter, searchQuery, sortOrder]);

  // Activity summary stats calculations
  const stats = useMemo(() => {
    let total = activities.length;
    let uploads = 0;
    let downloads = 0;
    let shares = 0;
    let security = 0;
    let others = 0;

    activities.forEach((act) => {
      if (act.action === "upload") {
        uploads++;
      } else if (act.action === "download") {
        downloads++;
      } else if (["share", "remove_share", "create_link", "delete_link"].includes(act.action)) {
        shares++;
      } else if (act.action === "security") {
        security++;
      } else {
        others++;
      }
    });

    return { total, uploads, downloads, shares, security, others };
  }, [activities]);

  // Date range label formatter
  const dateRangeLabel = useMemo(() => {
    const now = new Date();
    const formatDate = (d: Date) => {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };

    if (selectedDateFilter === "today") {
      return formatDate(now);
    } else if (selectedDateFilter === "7days") {
      const past = new Date();
      past.setDate(now.getDate() - 7);
      return `${formatDate(past)} – ${formatDate(now)}`;
    } else if (selectedDateFilter === "30days") {
      const past = new Date();
      past.setDate(now.getDate() - 30);
      return `${formatDate(past)} – ${formatDate(now)}`;
    } else {
      if (activities.length > 0) {
        const dates = activities.map((a) => new Date(a.createdAt).getTime());
        const earliest = new Date(Math.min(...dates));
        return `${formatDate(earliest)} – ${formatDate(now)}`;
      }
      return "All Time";
    }
  }, [selectedDateFilter, activities]);

  // Activity icon mapping helper
  const getActivityIcon = (action: ActivityLogItem["action"]) => {
    switch (action) {
      case "upload":
        return <Upload className="w-4 h-4" />;
      case "download":
        return <Download className="w-4 h-4" />;
      case "create_folder":
        return <FolderPlus className="w-4 h-4" />;
      case "rename":
        return <Edit3 className="w-4 h-4" />;
      case "move":
        return <FolderInput className="w-4 h-4" />;
      case "trash":
      case "permanent_delete":
        return <Trash2 className="w-4 h-4" />;
      case "restore":
        return <RotateCcw className="w-4 h-4" />;
      case "share":
      case "remove_share":
        return <Share2 className="w-4 h-4" />;
      case "create_link":
      case "delete_link":
        return <Link className="w-4 h-4" />;
      case "security":
        return <Shield className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  // Activity styling color mapper
  const getActivityStyles = (action: ActivityLogItem["action"]) => {
    switch (action) {
      case "upload":
        return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case "download":
        return "bg-blue-50 text-blue-600 border-blue-100";
      case "create_folder":
      case "rename":
      case "move":
        return "bg-amber-50 text-amber-600 border-amber-100";
      case "trash":
      case "permanent_delete":
        return "bg-rose-50 text-rose-600 border-rose-100";
      case "restore":
        return "bg-teal-50 text-teal-600 border-teal-100";
      case "share":
      case "remove_share":
      case "create_link":
      case "delete_link":
        return "bg-purple-50 text-purple-600 border-purple-100";
      case "security":
        return "bg-emerald-50 text-emerald-600 border-emerald-100";
      default:
        return "bg-slate-50 text-slate-500 border-slate-100";
    }
  };

  // Activity friendly title
  const getActivityLabel = (item: ActivityLogItem) => {
    const isFolder = item.entityType === "folder";
    switch (item.action) {
      case "upload":
        return "File Uploaded";
      case "download":
        return "File Downloaded";
      case "create_folder":
        return "Folder Created";
      case "rename":
        return isFolder ? "Folder Renamed" : "File Renamed";
      case "move":
        return isFolder ? "Folder Moved" : "File Moved";
      case "trash":
        return isFolder ? "Folder Deleted" : "File Deleted";
      case "permanent_delete":
        return isFolder ? "Folder Purged" : "File Purged";
      case "restore":
        return isFolder ? "Folder Restored" : "File Restored";
      case "share":
        return isFolder ? "Folder Shared" : "File Shared";
      case "remove_share":
        return isFolder ? "Folder Share Removed" : "File Share Removed";
      case "create_link":
        return "Public Link Created";
      case "delete_link":
        return "Public Link Deleted";
      case "security":
        return "Security Event";
      default:
        return "Other Action";
    }
  };

  // Item column helper
  const getItemTypeInfo = (item: ActivityLogItem) => {
    if (item.entityType === "folder" || item.action === "create_folder") {
      return {
        ext: "Folder",
        icon: <Folder className="w-4 h-4 text-amber-500" />
      };
    }

    const name = item.entityName || "";
    const parts = name.split(".");
    const ext = parts.length > 1 ? parts.pop()?.toUpperCase() : "File";

    const extensionLower = ext?.toLowerCase() || "";
    let icon = <FileText className="w-4 h-4 text-slate-400" />;

    if (["pdf"].includes(extensionLower)) {
      icon = <FileText className="w-4 h-4 text-rose-500" />;
    } else if (["doc", "docx", "txt", "rtf"].includes(extensionLower)) {
      icon = <FileText className="w-4 h-4 text-blue-500" />;
    } else if (["xls", "xlsx", "csv"].includes(extensionLower)) {
      icon = <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
    } else if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(extensionLower)) {
      icon = <ImageIcon className="w-4 h-4 text-indigo-500" />;
    } else if (["mp4", "mov", "avi", "mkv"].includes(extensionLower)) {
      icon = <Film className="w-4 h-4 text-rose-500" />;
    } else if (["mp3", "wav", "m4a", "ogg"].includes(extensionLower)) {
      icon = <Music className="w-4 h-4 text-amber-500" />;
    } else if (["zip", "tar", "gz", "rar", "7z"].includes(extensionLower)) {
      icon = <Archive className="w-4 h-4 text-purple-500" />;
    }

    return { ext, icon };
  };

  // Details Column helper
  const renderDetails = (item: ActivityLogItem) => {
    if (item.action === "share" || item.action === "remove_share") {
      const email = item.metadata?.grantedEmail || item.metadata?.details || "Collaborator";
      return (
        <div className="flex flex-col min-w-0">
          <span className="text-xs text-slate-700 font-medium">Shared with</span>
          <span className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[150px]" title={email}>
            {email}
          </span>
        </div>
      );
    }
    if (item.action === "upload") {
      const folder = item.metadata?.folderName || "My Drive";
      return (
        <div className="flex flex-col min-w-0">
          <span className="text-xs text-slate-700 font-medium">Uploaded to</span>
          <span className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[150px]" title={folder}>
            {folder}
          </span>
        </div>
      );
    }
    if (item.action === "create_folder") {
      const parentFolder = item.metadata?.parentFolderName || "My Drive";
      return (
        <div className="flex flex-col min-w-0">
          <span className="text-xs text-slate-700 font-medium">Created in</span>
          <span className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[150px]" title={parentFolder}>
            {parentFolder}
          </span>
        </div>
      );
    }
    if (item.action === "trash") {
      return <span className="text-xs text-slate-500 font-medium">Moved to trash</span>;
    }
    if (item.action === "security") {
      return <span className="text-xs text-slate-500 font-medium">Successful login</span>;
    }
    if (item.metadata?.details) {
      return (
        <span className="text-xs text-slate-500 font-medium truncate max-w-[150px]" title={item.metadata.details}>
          {item.metadata.details}
        </span>
      );
    }
    return <span className="text-xs text-slate-400">Completed</span>;
  };

  // User details rendering helper
  const renderUser = (item: ActivityLogItem) => {
    const isSelf = item.userId === user?.id;

    let name = "You";
    let email = user?.email || "";
    let avatarUrl = profile?.avatarUrl;
    let initials = profile?.fullName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "Y";

    if (!isSelf) {
      const otherProf = resolvedProfiles[item.userId];
      name = otherProf?.fullName || item.metadata?.user_name || "User";
      email = otherProf?.email || item.metadata?.user_email || "user@cloudvault.com";
      avatarUrl = otherProf?.avatarUrl || item.metadata?.user_avatar;
      initials = name.charAt(0).toUpperCase();
    }

    return (
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-black flex items-center justify-center shrink-0 overflow-hidden shadow-3xs">
          {avatarUrl ? (
            <img src={avatarUrl} alt="User Avatar" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
         </div>
         <div className="min-w-0 flex flex-col leading-none">
           <span className="text-xs font-bold text-slate-800 truncate">{name}</span>
           <span className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[140px]" title={email}>
             {email}
           </span>
         </div>
      </div>
    );
  };

  // Time Formatter helper
  const formatActivityTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (d.toDateString() === todayStr) {
      return `Today, ${timeStr}`;
    } else if (d.toDateString() === yesterdayStr) {
      return `Yesterday, ${timeStr}`;
    } else {
      const dateOptions: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" };
      return `${d.toLocaleDateString("en-GB", dateOptions)}, ${timeStr}`;
    }
  };

  // Active query filters and sorts
  const filteredActivities = useMemo(() => {
    return activities
      .filter((item) => {
        // Search text
        if (searchQuery.trim()) {
          const matchName = item.entityName.toLowerCase().includes(searchQuery.toLowerCase());
          const matchAction = item.action.toLowerCase().includes(searchQuery.toLowerCase());
          const matchLabel = getActivityLabel(item).toLowerCase().includes(searchQuery.toLowerCase());
          if (!matchName && !matchAction && !matchLabel) {
            return false;
          }
        }

        // Action Filter
        if (selectedActionFilter !== "all") {
          if (selectedActionFilter === "uploads" && item.action !== "upload") return false;
          if (selectedActionFilter === "downloads" && item.action !== "download") return false;
          if (selectedActionFilter === "folders" && item.action !== "create_folder") return false;
          if (
            selectedActionFilter === "sharing" &&
            !["share", "remove_share", "create_link", "delete_link"].includes(item.action)
          ) {
            return false;
          }
          if (selectedActionFilter === "trash" && item.action !== "trash") return false;
          if (selectedActionFilter === "restores" && item.action !== "restore") return false;
          if (selectedActionFilter === "security" && item.action !== "security") return false;
        }

        // Date Filter
        if (selectedDateFilter !== "all") {
          const itemDate = new Date(item.createdAt).getTime();
          const now = Date.now();
          const oneDayMs = 24 * 60 * 60 * 1000;

          if (selectedDateFilter === "today" && now - itemDate > oneDayMs) return false;
          if (selectedDateFilter === "7days" && now - itemDate > 7 * oneDayMs) return false;
          if (selectedDateFilter === "30days" && now - itemDate > 30 * oneDayMs) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
      });
  }, [activities, selectedActionFilter, selectedDateFilter, sortOrder, searchQuery]);

  // Pagination bounds
  const totalPages = Math.ceil(filteredActivities.length / itemsPerPage) || 1;
  const paginatedActivities = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredActivities.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredActivities, currentPage]);

  const fromNumber = filteredActivities.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const toNumber = Math.min(currentPage * itemsPerPage, filteredActivities.length);

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto w-full animate-fade-in space-y-6">
      {/* Toast notifications */}
      {successToast && (
        <div className="fixed top-6 right-6 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold z-50 animate-fade-in">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}
      {errorToast && (
        <div className="fixed top-6 right-6 bg-rose-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold z-50 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorToast}</span>
        </div>
      )}

      {/* 2. Horizontal Statistics Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Activities */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total</span>
            <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100/60 text-slate-500">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-xl font-extrabold text-slate-900 block leading-none">{stats.total}</span>
            <span className="text-[9px] text-slate-400 font-semibold mt-1 block">Account events</span>
          </div>
        </div>

        {/* Uploads */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Uploads</span>
            <div className="p-1.5 rounded-lg bg-blue-50 border border-blue-100/50 text-blue-600">
              <Upload className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-xl font-extrabold text-slate-900 block leading-none">{stats.uploads}</span>
            <span className="text-[9px] text-slate-400 font-semibold mt-1 block">File ingestion</span>
          </div>
        </div>

        {/* Downloads */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Downloads</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-100/50 text-emerald-600">
              <Download className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-xl font-extrabold text-slate-900 block leading-none">{stats.downloads}</span>
            <span className="text-[9px] text-slate-400 font-semibold mt-1 block">File downloads</span>
          </div>
        </div>

        {/* Shares */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Shares</span>
            <div className="p-1.5 rounded-lg bg-purple-50 border border-purple-100/50 text-purple-600">
              <Share2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-xl font-extrabold text-slate-900 block leading-none">{stats.shares}</span>
            <span className="text-[9px] text-slate-400 font-semibold mt-1 block">Collaborations</span>
          </div>
        </div>

        {/* Security Events */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Security</span>
            <div className="p-1.5 rounded-lg bg-rose-50 border border-rose-100/50 text-rose-600">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-xl font-extrabold text-slate-900 block leading-none">{stats.security}</span>
            <span className="text-[9px] text-slate-400 font-semibold mt-1 block">Shielded audits</span>
          </div>
        </div>

        {/* Other Actions */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Other</span>
            <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100/50 text-slate-400">
              <MoreHorizontal className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-xl font-extrabold text-slate-900 block leading-none">{stats.others}</span>
            <span className="text-[9px] text-slate-400 font-semibold mt-1 block">Administrative</span>
          </div>
        </div>
      </div>

      {/* 3. Filter and Search Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search activity history..."
            className="w-full bg-slate-50/70 hover:bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl py-1.5 pl-10 pr-4 text-xs text-slate-800 outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Action Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs text-slate-700 hover:bg-slate-100/50 transition-colors">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedActionFilter}
              onChange={(e) => setSelectedActionFilter(e.target.value)}
              className="bg-transparent outline-none cursor-pointer font-bold"
            >
              <option value="all">All Actions</option>
              <option value="uploads">Uploads</option>
              <option value="downloads">Downloads</option>
              <option value="folders">Folders</option>
              <option value="sharing">Sharing</option>
              <option value="trash">Trash</option>
              <option value="restores">Restores</option>
              <option value="security">Security</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs text-slate-700 hover:bg-slate-100/50 transition-colors">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="bg-transparent outline-none cursor-pointer font-bold"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </div>

          {/* Sort button */}
          <button
            onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
            className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-3xs"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span>{sortOrder === "newest" ? "Newest First" : "Oldest First"}</span>
          </button>
        </div>
      </div>

      {/* 4. Main Activity Table & List */}
      {isLoading ? (
        /* SKELETON ROW LOADING STATE */
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <div className="h-4 w-32 bg-slate-100 animate-pulse rounded" />
            <div className="h-4 w-44 bg-slate-100 animate-pulse rounded" />
          </div>
          <div className="divide-y divide-slate-100">
            {[1, 2, 3, 4, 5].map((index) => (
              <div key={index} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-1/4">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 animate-pulse shrink-0" />
                  <div className="space-y-1.5 w-full">
                    <div className="h-3.5 bg-slate-100 animate-pulse rounded w-3/4" />
                  </div>
                </div>
                <div className="flex items-center gap-2 w-1/5">
                  <div className="w-7 h-7 rounded-full bg-slate-100 animate-pulse shrink-0" />
                  <div className="space-y-1 w-full">
                    <div className="h-3 bg-slate-100 animate-pulse rounded w-2/3" />
                  </div>
                </div>
                <div className="h-3.5 bg-slate-100 animate-pulse rounded w-1/6" />
                <div className="h-3.5 bg-slate-100 animate-pulse rounded w-1/6" />
                <div className="h-7 w-7 bg-slate-100 animate-pulse rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ) : activities.length === 0 ? (
        /* NO ACTIVITY YET EMPTY STATE */
        <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-2xs max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 shadow-3xs">
            <Clock className="w-7 h-7" />
          </div>
          <h4 className="text-sm font-bold text-slate-800 mb-1">No activity yet</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Your recent file and account activity will appear here.
          </p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition-colors flex items-center gap-1.5 mx-auto"
            >
              <RefreshCw className="w-3 h-3" />
              Sync History
            </button>
          )}
        </div>
      ) : filteredActivities.length === 0 ? (
        /* NO MATCHING FILTER RESULTS EMPTY STATE */
        <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-2xs max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-4 shadow-3xs">
            <Search className="w-7 h-7" />
          </div>
          <h4 className="text-sm font-bold text-slate-800 mb-1">No matching activity</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed mb-4">
            Try changing your filters, search term, or date range.
          </p>
          <button
            onClick={() => {
              setSelectedActionFilter("all");
              setSelectedDateFilter("all");
              setSearchQuery("");
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE LAYOUT */}
          <div className="hidden sm:block bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4 font-bold">Activity</th>
                    <th className="py-3.5 px-4 font-bold">Item</th>
                    <th className="py-3.5 px-4 font-bold">Details</th>
                    <th className="py-3.5 px-4 font-bold">User</th>
                    <th className="py-3.5 px-4 font-bold">Time</th>
                    <th className="py-3.5 px-4 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedActivities.map((item) => {
                    const typeInfo = getItemTypeInfo(item);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* 1. Activity Type */}
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${getActivityStyles(item.action)}`}>
                              {getActivityIcon(item.action)}
                            </div>
                            <span className="text-xs font-bold text-slate-800">{getActivityLabel(item)}</span>
                          </div>
                        </td>

                        {/* 2. Item description */}
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                              {typeInfo.icon}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-800 block truncate max-w-[180px]" title={item.entityName}>
                                {item.entityName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold block uppercase mt-0.5">{typeInfo.ext}</span>
                            </div>
                          </div>
                        </td>

                        {/* 3. Dynamic Details */}
                        <td className="py-3.5 px-4">{renderDetails(item)}</td>

                        {/* 4. Resolved user profiles */}
                        <td className="py-3.5 px-4">{renderUser(item)}</td>

                        {/* 5. Human friendly Time stamp */}
                        <td className="py-3.5 px-4 font-semibold text-slate-500 whitespace-nowrap">
                          {formatActivityTime(item.createdAt)}
                        </td>

                        {/* 6. Action dots */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {activeMenuId === item.id && (
                              <div className="absolute right-0 top-full mt-1.5 w-40 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-40 text-xs text-slate-700 text-left animate-fade-in">
                                <button
                                  onClick={() => {
                                    setSelectedDetailLog(item);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-left text-xs font-semibold text-slate-700"
                                >
                                  <Info className="w-3.5 h-3.5 text-slate-400" />
                                  View Details
                                </button>
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setSuccessToast(`Selected file: ${item.entityName}`);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-left text-xs font-semibold text-slate-700 border-t border-slate-50 mt-1 pt-1"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                                  View File
                                </button>
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setSuccessToast(`Viewing owner credentials`);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-left text-xs font-semibold text-slate-700"
                                >
                                  <User className="w-3.5 h-3.5 text-slate-400" />
                                  View User
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE CARDS RESPONSIVE LAYOUT */}
          <div className="block sm:hidden space-y-4">
            {paginatedActivities.map((item) => {
              const typeInfo = getItemTypeInfo(item);
              return (
                <div key={item.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-3xs space-y-3 relative">
                  <div className="flex items-center justify-between gap-2.5">
                    {/* Activity Type Badge */}
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${getActivityStyles(item.action)}`}>
                        {getActivityIcon(item.action)}
                      </div>
                      <span className="text-xs font-bold text-slate-800">{getActivityLabel(item)}</span>
                    </div>

                    {/* Action trigger menu */}
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeMenuId === item.id && (
                        <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-40 text-xs text-slate-700 text-left">
                          <button
                            onClick={() => {
                              setSelectedDetailLog(item);
                              setActiveMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 font-semibold"
                          >
                            <Info className="w-3.5 h-3.5 text-slate-400" />
                            View Details
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Item block */}
                  <div className="flex items-center gap-2.5 bg-slate-50/70 p-2 rounded-xl border border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center shrink-0">
                      {typeInfo.icon}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-800 block truncate max-w-[200px]" title={item.entityName}>
                        {item.entityName}
                      </span>
                      <span className="text-[9px] text-slate-400 font-bold block uppercase mt-0.5">{typeInfo.ext}</span>
                    </div>
                  </div>

                  {/* Details column representation */}
                  <div className="text-xs text-slate-600">
                    {renderDetails(item)}
                  </div>

                  {/* User profile & Timestamp footer */}
                  <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-slate-100">
                    {renderUser(item)}
                    <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                      {formatActivityTime(item.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 5. Pagination controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
            <span className="text-xs font-semibold text-slate-400">
              Showing <span className="font-bold text-slate-700">{fromNumber}</span>–
              <span className="font-bold text-slate-700">{toNumber}</span> of{" "}
              <span className="font-bold text-slate-700">{filteredActivities.length}</span> activities
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                {/* Previous button */}
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-slate-200 hover:border-slate-300 disabled:opacity-40 disabled:hover:border-slate-200 rounded-lg cursor-pointer transition-all bg-white text-slate-600 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Individual pages */}
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pageNo = idx + 1;
                  const isActive = currentPage === pageNo;
                  return (
                    <button
                      key={pageNo}
                      onClick={() => setCurrentPage(pageNo)}
                      className={`min-w-8 h-8 px-2 flex items-center justify-center text-xs font-bold rounded-lg transition-all border cursor-pointer ${
                        isActive
                          ? "bg-blue-50 text-blue-600 border-blue-200"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50/70"
                      }`}
                    >
                      {pageNo}
                    </button>
                  );
                })}

                {/* Next button */}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-slate-200 hover:border-slate-300 disabled:opacity-40 disabled:hover:border-slate-200 rounded-lg cursor-pointer transition-all bg-white text-slate-600 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* 6. Custom Modal Dialog for Detail audits */}
      {selectedDetailLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg border ${getActivityStyles(selectedDetailLog.action)}`}>
                  {getActivityIcon(selectedDetailLog.action)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Activity Details</h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5 uppercase tracking-wider">
                    ID: {selectedDetailLog.id.slice(0, 8)}...
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetailLog(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700">
              {/* Event description */}
              <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-50">
                <span className="font-bold text-slate-400">Event Type</span>
                <span className="col-span-2 font-bold text-slate-800">{getActivityLabel(selectedDetailLog)}</span>
              </div>

              {/* Related Item */}
              <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-50">
                <span className="font-bold text-slate-400">Item Name</span>
                <span className="col-span-2 font-bold text-slate-800 break-all">{selectedDetailLog.entityName}</span>
              </div>

              {/* Action type */}
              <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-50">
                <span className="font-bold text-slate-400">Action</span>
                <span className="col-span-2 font-semibold text-slate-600 capitalize">{selectedDetailLog.action}</span>
              </div>

              {/* Performed by */}
              <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-50">
                <span className="font-bold text-slate-400">Performed By</span>
                <span className="col-span-2">{renderUser(selectedDetailLog)}</span>
              </div>

              {/* Timestamp */}
              <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-50">
                <span className="font-bold text-slate-400">Timestamp</span>
                <span className="col-span-2 font-medium text-slate-500">
                  {new Date(selectedDetailLog.createdAt).toLocaleString([], {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                  })}
                </span>
              </div>

              {/* Metadata JSON fields representation */}
              {selectedDetailLog.metadata && Object.keys(selectedDetailLog.metadata).length > 0 && (
                <div className="pt-2">
                  <span className="font-bold text-slate-400 block mb-2">Event Metadata</span>
                  <pre className="bg-slate-50 text-[10px] text-slate-600 p-3 rounded-xl border border-slate-100 overflow-x-auto max-h-[140px] font-mono leading-relaxed">
                    {JSON.stringify(selectedDetailLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="bg-slate-50/50 p-4 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                onClick={() => setSelectedDetailLog(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
