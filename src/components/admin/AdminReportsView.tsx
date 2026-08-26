import React, { useState, useEffect } from "react";
import { fetchAdminReportStats } from "../../lib/api.js";
import { TrendingUp, Users, UploadCloud, Share2, Trash } from "lucide-react";

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

interface AdminReportsViewProps {
  token: string;
}

export function AdminReportsView({ token }: AdminReportsViewProps) {
  const [reports, setReports] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, [token]);

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminReportStats(token);
      if (res.success) {
        setReports(res.reports);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load report analytics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-slate-500 text-sm">Generating system analytics...</div>;
  if (error) return <div className="p-6 bg-rose-50 text-rose-800 rounded-2xl text-sm">{error}</div>;

  const userGrowthKeys = Object.keys(reports?.userGrowth || {});
  const uploadActivityKeys = Object.keys(reports?.uploadActivity || {});
  const storageGrowthKeys = Object.keys(reports?.storageGrowth || {});

  return (
    <div className="space-y-8">
      {/* Overview Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">User Registrations</span>
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600"><Users className="w-5 h-5" /></div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {userGrowthKeys.reduce((sum, k) => sum + reports.userGrowth[k], 0)} Total
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Recorded signup days: {userGrowthKeys.length}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upload Frequency</span>
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600"><UploadCloud className="w-5 h-5" /></div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {uploadActivityKeys.reduce((sum, k) => sum + reports.uploadActivity[k], 0)} Files
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Recorded upload days: {uploadActivityKeys.length}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trashed Items</span>
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600"><Trash className="w-5 h-5" /></div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {reports?.trashedCount ?? 0} Items
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Pending automatic purge</p>
        </div>
      </div>

      {/* Visual Activity Day Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Timeline */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" /> User Registrations by Date
          </h3>

          {userGrowthKeys.length === 0 ? (
            <p className="text-xs text-slate-400 py-6">No user registration timelines found.</p>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {userGrowthKeys.map((date) => {
                const count = reports.userGrowth[date];
                return (
                  <div key={date} className="flex items-center justify-between text-xs p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{date}</span>
                    <span className="font-bold text-blue-600">{count} new user{count > 1 ? "s" : ""}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Storage Growth Progression */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-emerald-600" /> Storage Expansion Progression
          </h3>

          {storageGrowthKeys.length === 0 ? (
            <p className="text-xs text-slate-400 py-6">No storage progression timelines found.</p>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {storageGrowthKeys.map((date) => {
                const cumulativeBytes = reports.storageGrowth[date];
                return (
                  <div key={date} className="flex items-center justify-between text-xs p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{date}</span>
                    <span className="font-bold text-emerald-600">{formatBytes(cumulativeBytes)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
