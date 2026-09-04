import React, { useState, useEffect } from "react";
import { fetchActiveAnnouncements } from "../lib/api.js";
import { Megaphone, AlertTriangle, Info, CheckCircle, Wrench, Shield, Sparkles, X, Clock, Calendar } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "security" | "maintenance" | "feature";
  created_at?: string;
  published_at?: string | null;
  expires_at?: string | null;
}

export function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("cloudvault_dismissed_announcements");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      const res = await fetchActiveAnnouncements();
      if (res.success && Array.isArray(res.announcements)) {
        setAnnouncements(res.announcements);
      }
    } catch (e) {
      console.warn("Failed to load active announcements:", e);
    }
  };

  const handleDismiss = (id: string) => {
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    try {
      localStorage.setItem("cloudvault_dismissed_announcements", JSON.stringify(updated));
    } catch (e) {
      console.warn("Could not save dismissed announcements:", e);
    }
  };

  const visibleAnnouncements = announcements.filter((a) => !dismissedIds.includes(a.id));

  if (visibleAnnouncements.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {visibleAnnouncements.map((item) => {
        let bgClass = "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200";
        let icon = <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />;
        let typeBadge = { label: "Info", bg: "bg-blue-200/60 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300" };

        if (item.type === "warning") {
          bgClass = "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200";
          icon = <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />;
          typeBadge = { label: "Warning", bg: "bg-amber-200/60 text-amber-900 dark:bg-amber-900/60 dark:text-amber-300" };
        } else if (item.type === "maintenance") {
          bgClass = "bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-200";
          icon = <Wrench className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />;
          typeBadge = { label: "Maintenance", bg: "bg-orange-200/60 text-orange-900 dark:bg-orange-900/60 dark:text-orange-300" };
        } else if (item.type === "security") {
          bgClass = "bg-purple-50 border-purple-200 text-purple-900 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-200";
          icon = <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />;
          typeBadge = { label: "Security", bg: "bg-purple-200/60 text-purple-900 dark:bg-purple-900/60 dark:text-purple-300" };
        } else if (item.type === "success") {
          bgClass = "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200";
          icon = <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />;
          typeBadge = { label: "Success", bg: "bg-emerald-200/60 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-300" };
        } else if (item.type === "feature") {
          bgClass = "bg-cyan-50 border-cyan-200 text-cyan-900 dark:bg-cyan-950/40 dark:border-cyan-800 dark:text-cyan-200";
          icon = <Sparkles className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />;
          typeBadge = { label: "Feature", bg: "bg-cyan-200/60 text-cyan-900 dark:bg-cyan-900/60 dark:text-cyan-300" };
        }

        return (
          <div
            key={item.id}
            className={`p-4 rounded-2xl border flex items-start justify-between gap-4 shadow-2xs transition-all ${bgClass}`}
          >
            <div className="flex items-start gap-3">
              {icon}
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${typeBadge.bg}`}>
                    {typeBadge.label}
                  </span>
                  <div className="font-bold text-sm tracking-tight">{item.title}</div>
                </div>

                <p className="text-xs opacity-90 leading-relaxed whitespace-pre-line">{item.message}</p>

                <div className="flex items-center gap-3 text-[10px] opacity-70 pt-0.5">
                  {item.published_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Published: {new Date(item.published_at).toLocaleDateString()}
                    </span>
                  )}
                  {item.expires_at && (
                    <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                      <Calendar className="w-3 h-3" />
                      Expires: {new Date(item.expires_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => handleDismiss(item.id)}
              className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              title="Dismiss announcement"
            >
              <X className="w-4 h-4 opacity-70 hover:opacity-100" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
