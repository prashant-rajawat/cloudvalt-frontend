import React, { useState, useEffect } from "react";
import { fetchAdminStorageStats, updateUserQuota } from "../../lib/api.js";
import { HardDrive, Image, FileText, Video, Music, Archive, File, ArrowUpRight } from "lucide-react";

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

interface AdminStorageViewProps {
  token: string;
}

export function AdminStorageView({ token }: AdminStorageViewProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStorageStats();
  }, [token]);

  const loadStorageStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminStorageStats(token);
      if (res.success) {
        setData(res.storage);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load storage statistics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-slate-500 text-sm">Analyzing system storage...</div>;
  if (error) return <div className="p-6 bg-rose-50 text-rose-800 rounded-2xl text-sm">{error}</div>;

  const categories = data?.categories || {};
  const totalBytes = data?.totalUsedBytes || 0;

  const catMeta: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
    image: { label: "Images", icon: <Image className="w-4 h-4 text-emerald-600" />, color: "bg-emerald-500", bg: "bg-emerald-50" },
    document: { label: "Documents", icon: <FileText className="w-4 h-4 text-blue-600" />, color: "bg-blue-500", bg: "bg-blue-50" },
    video: { label: "Videos", icon: <Video className="w-4 h-4 text-purple-600" />, color: "bg-purple-500", bg: "bg-purple-50" },
    audio: { label: "Audio", icon: <Music className="w-4 h-4 text-amber-600" />, color: "bg-amber-500", bg: "bg-amber-50" },
    archive: { label: "Archives", icon: <Archive className="w-4 h-4 text-rose-600" />, color: "bg-rose-500", bg: "bg-rose-50" },
    other: { label: "Other", icon: <File className="w-4 h-4 text-slate-600" />, color: "bg-slate-500", bg: "bg-slate-50" },
  };

  return (
    <div className="space-y-8">
      {/* Total Storage Summary Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">System-wide Storage Usage</span>
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">{formatBytes(totalBytes)}</h2>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-2xl text-blue-600">
            <HardDrive className="w-6 h-6" />
          </div>
        </div>

        {/* Multi-color Progress Stack Bar */}
        <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
          {Object.entries(categories).map(([key, val]: [string, any]) => {
            const pct = totalBytes > 0 ? (val.bytes / totalBytes) * 100 : 0;
            if (pct === 0) return null;
            return (
              <div
                key={key}
                className={`h-full ${catMeta[key]?.color || "bg-slate-400"}`}
                style={{ width: `${pct}%` }}
                title={`${catMeta[key]?.label}: ${formatBytes(val.bytes)} (${pct.toFixed(1)}%)`}
              />
            );
          })}
        </div>
      </div>

      {/* Category Breakdown Cards */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Storage by File Type</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Object.entries(categories).map(([key, val]: [string, any]) => {
            const pct = totalBytes > 0 ? ((val.bytes / totalBytes) * 100).toFixed(1) : "0";
            const meta = catMeta[key] || catMeta["other"];

            return (
              <div key={key} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${meta.bg}`}>{meta.icon}</div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{meta.label}</span>
                </div>

                <div>
                  <div className="text-base font-bold text-slate-900 dark:text-white">{formatBytes(val.bytes)}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{val.count} files ({pct}%)</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Consumers Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Top Storage Consumers</h3>

        {data?.topUsers?.length === 0 ? (
          <p className="text-xs text-slate-400 py-4">No storage data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3">User</th>
                  <th className="p-3">Storage Used</th>
                  <th className="p-3">Quota</th>
                  <th className="p-3">Usage Bar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data?.topUsers?.map((u: any) => {
                  const pct = Math.min(100, Math.round((u.usedBytes / u.quotaBytes) * 100));
                  return (
                    <tr key={u.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3">
                        <div className="font-semibold text-slate-900 dark:text-white">{u.fullName}</div>
                        <div className="text-[11px] text-slate-400">{u.email}</div>
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{formatBytes(u.usedBytes)}</td>
                      <td className="p-3 text-slate-500">{formatBytes(u.quotaBytes)}</td>
                      <td className="p-3 min-w-[150px]">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold">{pct}%</span>
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
    </div>
  );
}
