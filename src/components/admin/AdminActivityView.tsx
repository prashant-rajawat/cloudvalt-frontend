import React, { useState, useEffect } from "react";
import { fetchAdminActivityLogs } from "../../lib/api.js";
import { Search, Filter, Activity, RefreshCw } from "lucide-react";

interface AdminActivityViewProps {
  token: string;
}

export function AdminActivityView({ token }: AdminActivityViewProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    loadLogs();
  }, [token, actionFilter]);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminActivityLogs(token, {
        action: actionFilter || undefined,
      });
      if (res.success) {
        setLogs(res.logs || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load activity logs");
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.toLowerCase();
    return (
      log.userEmail?.toLowerCase().includes(q) ||
      log.userName?.toLowerCase().includes(q) ||
      log.action?.toLowerCase().includes(q) ||
      log.entityName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Search & Action Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search activity by user, action, or file..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 border border-slate-200 dark:border-slate-700 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 focus:outline-hidden"
          >
            <option value="">All Action Types</option>
            <option value="upload">Upload</option>
            <option value="download">Download</option>
            <option value="delete">Delete</option>
            <option value="restore">Restore</option>
            <option value="rename">Rename</option>
            <option value="move">Move</option>
            <option value="share">Share</option>
            <option value="login">Login</option>
          </select>

          <button
            onClick={loadLogs}
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 cursor-pointer"
            title="Refresh Logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Activity Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm">Fetching system activity logs...</div>
      ) : error ? (
        <div className="p-6 bg-rose-50 text-rose-800 rounded-2xl text-sm">{error}</div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Entity / Target</th>
                  <th className="p-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400">
                      No logs match your filter query.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="p-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{log.userName}</div>
                        <div className="text-[11px] text-slate-400">{log.userEmail}</div>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {log.action?.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-slate-900 dark:text-white">
                        {log.entityName || log.entityType || "-"}
                      </td>
                      <td className="p-4 text-slate-400 text-[11px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
