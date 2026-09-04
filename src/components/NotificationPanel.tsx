import React, { useState, useEffect, useRef } from "react";
import { NotificationItem } from "../types/index.js";
import {
  Bell,
  BellOff,
  CheckCheck,
  Share2,
  FileText,
  Shield,
  HardDrive,
  X,
  Clock,
  Megaphone,
  Folder,
  Trash2,
  RotateCcw,
  AlertTriangle,
  ChevronRight,
  Upload,
  Calendar,
} from "lucide-react";

interface NotificationPanelProps {
  notifications: NotificationItem[];
  isOpen: boolean;
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onNotificationClick: (notif: NotificationItem) => void;
  onViewAll?: () => void;
  isDisabled?: boolean;
}

export function NotificationPanel({
  notifications,
  isOpen,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onNotificationClick,
  onViewAll,
  isDisabled = false,
}: NotificationPanelProps) {
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<NotificationItem | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Icon & Style configuration according to notification type & title
  const getNotificationTypeConfig = (notif: NotificationItem) => {
    const type = notif.type;
    const titleLower = notif.title.toLowerCase();
    const messageLower = notif.message.toLowerCase();

    if (titleLower.includes("folder created") || titleLower.includes("created folder")) {
      return {
        icon: <Folder className="w-5 h-5 text-blue-600" />,
        bg: "bg-blue-50 border border-blue-100/80",
      };
    }
    if (
      titleLower.includes("moved to trash") ||
      titleLower.includes("trashed") ||
      messageLower.includes("moved to trash")
    ) {
      return {
        icon: <Trash2 className="w-5 h-5 text-emerald-600" />,
        bg: "bg-emerald-50 border border-emerald-100/80",
      };
    }
    if (titleLower.includes("restored") || messageLower.includes("restored")) {
      return {
        icon: <RotateCcw className="w-5 h-5 text-emerald-600" />,
        bg: "bg-emerald-50 border border-emerald-100/80",
      };
    }
    if (
      titleLower.includes("uploaded") ||
      titleLower.includes("file uploaded") ||
      messageLower.includes("uploaded")
    ) {
      return {
        icon: <FileText className="w-5 h-5 text-blue-600" />,
        bg: "bg-blue-50 border border-blue-100/80",
      };
    }
    if (
      type === "sharing" ||
      type === "sharing_changes" ||
      titleLower.includes("shared") ||
      titleLower.includes("item shared")
    ) {
      return {
        icon: <Share2 className="w-5 h-5 text-purple-600" />,
        bg: "bg-purple-50 border border-purple-100/80",
      };
    }
    if (type === "security" || titleLower.includes("security") || titleLower.includes("login")) {
      return {
        icon: <Shield className="w-5 h-5 text-amber-600" />,
        bg: "bg-amber-50 border border-amber-100/80",
      };
    }
    if (
      type === "storage" ||
      titleLower.includes("storage") ||
      titleLower.includes("warning") ||
      titleLower.includes("quota")
    ) {
      return {
        icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
        bg: "bg-amber-50 border border-amber-100/80",
      };
    }
    if (type === "announcement") {
      return {
        icon: <Megaphone className="w-5 h-5 text-blue-600" />,
        bg: "bg-blue-50 border border-blue-100/80",
      };
    }

    // Default fallback
    return {
      icon: <FileText className="w-5 h-5 text-blue-600" />,
      bg: "bg-blue-50 border border-blue-100/80",
    };
  };

  const formatTimestamp = (isoDate: string) => {
    const d = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const handleItemClick = (notif: NotificationItem) => {
    onMarkAsRead(notif.id);
    if (notif.type === "announcement") {
      setSelectedAnnouncement(notif);
    } else {
      onNotificationClick(notif);
    }
  };

  return (
    <>
      {/* DROPDOWN CONTAINER */}
      <div
        ref={dropdownRef}
        className="absolute right-0 top-full mt-2 w-full sm:w-[400px] max-w-[calc(100vw-2rem)] bg-white border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-200/50 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* HEADER */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Notifications</h3>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100/80 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-1 transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark all as read
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
              title="Close notifications"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* NOTIFICATION LIST */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100/80">
          {notifications.length === 0 ? (
            <div className="p-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Bell className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-xs font-bold text-slate-800">No notifications yet</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                Important updates, file activities, and announcements will appear here.
              </p>
            </div>
          ) : (
            notifications.map((notif) => {
              const typeConfig = getNotificationTypeConfig(notif);

              return (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`p-3.5 sm:p-4 transition-all cursor-pointer flex items-start gap-3.5 hover:bg-slate-50/80 ${
                    !notif.isRead ? "bg-blue-50/40" : "bg-white"
                  }`}
                >
                  {/* Category Icon */}
                  <div
                    className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${typeConfig.bg}`}
                  >
                    {typeConfig.icon}
                  </div>

                  {/* Content Area */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {notif.title}
                      </p>
                      {!notif.isRead && (
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0 shadow-2xs" />
                      )}
                    </div>

                    <p className="text-xs text-slate-600 leading-snug line-clamp-2">
                      {notif.message}
                    </p>

                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{formatTimestamp(notif.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
          <button
            onClick={() => {
              onClose();
              if (onViewAll) onViewAll();
            }}
            className="w-full px-4 py-3 text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center justify-between cursor-pointer"
          >
            <span>View all notifications</span>
            <ChevronRight className="w-4 h-4 text-blue-600" />
          </button>
        </div>
      </div>

      {/* ANNOUNCEMENT DETAIL MODAL */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 border border-blue-100">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    {selectedAnnouncement.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Published: {new Date(selectedAnnouncement.publishedAt || selectedAnnouncement.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAnnouncement(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed whitespace-pre-line">
              {selectedAnnouncement.message}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedAnnouncement(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

{/* STANDALONE NOTIFICATION BELL BUTTON WITH ALL 5 STATES */}
interface NotificationBellProps {
  notifications: NotificationItem[];
  isOpen: boolean;
  onToggle: () => void;
  isDisabled?: boolean;
}

export function NotificationBell({
  notifications,
  isOpen,
  onToggle,
  isDisabled = false,
}: NotificationBellProps) {
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const [isRinging, setIsRinging] = useState(false);
  const prevCountRef = useRef(unreadCount);

  // Trigger bell ringing animation when a new notification arrives
  useEffect(() => {
    if (unreadCount > prevCountRef.current) {
      setIsRinging(true);
      const timer = setTimeout(() => {
        setIsRinging(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount]);

  if (isDisabled) {
    return (
      <div
        className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center opacity-50 cursor-not-allowed text-slate-400"
        title="Notifications disabled"
      >
        <BellOff className="w-5 h-5" />
      </div>
    );
  }

  return (
    <button
      onClick={onToggle}
      className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer flex items-center justify-center ${
        isOpen ? "ring-2 ring-blue-500/20 border-blue-300 bg-blue-50/20" : ""
      }`}
      title="Notifications"
    >
      <Bell
        className={`w-5 h-5 text-slate-800 transition-transform ${
          isRinging ? "animate-bell-ring text-blue-600" : ""
        }`}
      />

      {/* UNREAD BADGE / DOT */}
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-blue-600 text-white font-bold text-[10px] rounded-full border-2 border-white flex items-center justify-center px-1 shadow-2xs">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}
