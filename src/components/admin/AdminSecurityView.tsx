import React, { useState, useEffect } from "react";
import { fetchAdminAbuseReports, updateAbuseReportStatus } from "../../lib/api.js";
import { ShieldAlert, CheckCircle, Clock, AlertTriangle, XCircle } from "lucide-react";

interface AdminSecurityViewProps {
  token: string;
}

export function AdminSecurityView({ token }: AdminSecurityViewProps) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, [token]);

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminAbuseReports(token);
      if (res.success) {
        setReports(res.reports || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load abuse reports");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await updateAbuseReportStatus(token, id, newStatus);
      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
    } catch (err: any) {
      alert(err.message || "Failed to update report status");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/60 rounded-2xl text-rose-600">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Content Abuse & Security Management</h3>
            <p className="text-xs text-slate-500">Review reported public share links, copyright issues, and spam flags.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm">Loading abuse reports...</div>
      ) : error ? (
        <div className="p-6 bg-rose-50 text-rose-800 rounded-2xl text-sm">{error}</div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4">Reason</th>
                  <th className="p-4">Details</th>
                  <th className="p-4">Reported At</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      No content abuse reports logged.
                    </td>
                  </tr>
                ) : (
                  reports.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-4">
                        <span className="font-bold text-slate-900 dark:text-white capitalize">{item.reason?.replace("_", " ")}</span>
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                        {item.details || "No additional comments"}
                      </td>
                      <td className="p-4 text-slate-400 text-[11px]">
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                            item.status === "open"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                              : item.status === "reviewing"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleUpdateStatus(item.id, "reviewing")}
                            className="px-2.5 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 rounded-lg font-semibold text-[10px] hover:bg-amber-100 cursor-pointer"
                          >
                            Reviewing
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(item.id, "resolved")}
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-lg font-semibold text-[10px] hover:bg-emerald-100 cursor-pointer"
                          >
                            Resolve
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(item.id, "rejected")}
                            className="px-2.5 py-1 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 rounded-lg font-semibold text-[10px] hover:bg-slate-200 cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
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
