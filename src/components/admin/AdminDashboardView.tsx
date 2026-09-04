import React, { useEffect, useState } from "react";
import { fetchAdminDashboardStats, fetchAdminActivityLogs } from "../../lib/api.js";
import { Users, HardDrive, Share2, AlertOctagon, Activity, FileCheck, ArrowUpRight } from "lucide-react";

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

interface AdminDashboardViewProps {
  token: string;
  onNavigate: (tab: any) => void;
}

export function AdminDashboardView({ token, onNavigate }: AdminDashboardViewProps) {
  const [stats, setStats] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, [token]);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load stats & logs safely
      const statsPromise = fetchAdminDashboardStats(token).catch((err) => {
        console.warn("Could not fetch admin dashboard stats:", err);
        return { success: false, stats: null };
      });

      const logsPromise = fetchAdminActivityLogs(token, {}).catch((err) => {
        console.warn("Could not fetch admin activity logs:", err);
        return { success: false, logs: [] };
      });

      const [resStats, resLogs] = await Promise.all([statsPromise, logsPromise]);

      if (resStats?.success) {
        setStats(resStats.stats);
      }
      if (resLogs?.success) {
        setRecentLogs((resLogs.logs || []).slice(0, 6));
      }
    } catch (err: any) {
      setError(err.message || "Failed to load admin overview statistics.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex justify-center items-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const cards = [
    {
      title: "Total Registered Users",
      value: stats?.totalUsers ?? 0,
      subtext: `${stats?.activeUsers ?? 0} active accounts`,
      icon: <Users className="w-5 h-5 text-blue-600" />,
      bg: "bg-blue-50/80 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/50",
      tab: "users",
    },
    {
      title: "Total Files Stored",
      value: stats?.totalFiles ?? 0,
      subtext: `${stats?.totalFolders ?? 0} folders created`,
      icon: <FileCheck className="w-5 h-5 text-indigo-600" />,
      bg: "bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900/50",
      tab: "storage",
    },
    {
      title: "System Storage Consumed",
      value: formatBytes(stats?.totalStorageUsed ?? 0),
      subtext: "Across all active user drives",
      icon: <HardDrive className="w-5 h-5 text-emerald-600" />,
      bg: "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50",
      tab: "storage",
    },
    {
      title: "Active Shared Links",
      value: (stats?.sharedFiles ?? 0) + (stats?.sharedFolders ?? 0),
      subtext: `${stats?.sharedFiles ?? 0} files, ${stats?.sharedFolders ?? 0} folders`,
      icon: <Share2 className="w-5 h-5 text-purple-600" />,
      bg: "bg-purple-50/80 dark:bg-purple-950/30 border-purple-100 dark:border-purple-900/50",
      tab: "reports",
    },
    {
      title: "Open Abuse Reports",
      value: stats?.unresolvedReports ?? 0,
      subtext: stats?.unresolvedReports > 0 ? "Requires review" : "All clean",
      icon: <AlertOctagon className="w-5 h-5 text-rose-600" />,
      bg: "bg-rose-50/80 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/50",
      tab: "security",
    },
  ];

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200 rounded-2xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {cards.map((c, i) => (
          <div
            key={i}
            onClick={() => onNavigate(c.tab)}
            className={`p-5 rounded-2xl border ${c.bg} transition-all hover:shadow-md cursor-pointer group flex flex-col justify-between`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-tight uppercase">
                  {c.title}
                </p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tracking-tight">
                  {c.value}
                </h3>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 shadow-2xs border border-slate-200/60 dark:border-slate-700">
                {c.icon}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>{c.subtext}</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </div>
          </div>
        ))}
      </div>

      {/* Quick Action Bar & Activity Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity Log Stream */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Recent System Activity</h3>
            </div>
            <button
              onClick={() => onNavigate("activity")}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              View Full Logs →
            </button>
          </div>

          {recentLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No recent system activities recorded.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentLogs.map((log) => (
                <div key={log.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-600 dark:text-slate-300 shrink-0">
                      {log.userName?.[0] || "U"}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">
                        {log.userName || "User"} <span className="font-normal text-slate-500">({log.userEmail || "system"})</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">
                          {log.action?.replace("_", " ")}
                        </span>
                        {log.entityName && <span className="ml-1 text-blue-600 dark:text-blue-400">"{log.entityName}"</span>}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Management Shortcuts */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Quick Actions</h3>

          <button
            onClick={() => onNavigate("announcements")}
            className="w-full text-left p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all cursor-pointer group"
          >
            <div className="font-semibold text-xs text-slate-900 dark:text-white group-hover:text-blue-600">
              📢 Post Announcement
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Broadcast updates or maintenance warnings to users.</p>
          </button>

          <button
            onClick={() => onNavigate("users")}
            className="w-full text-left p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all cursor-pointer group"
          >
            <div className="font-semibold text-xs text-slate-900 dark:text-white group-hover:text-blue-600">
              👤 Manage User Quotas & Roles
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Adjust user storage limits or promote administrators.</p>
          </button>

          <button
            onClick={() => onNavigate("settings")}
            className="w-full text-left p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all cursor-pointer group"
          >
            <div className="font-semibold text-xs text-slate-900 dark:text-white group-hover:text-blue-600">
              🛠️ Toggle Maintenance Mode
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Temporarily restrict normal user access for updates.</p>
          </button>
        </div>
      </div>
    </div>
  );
}
