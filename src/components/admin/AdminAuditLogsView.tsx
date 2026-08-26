import React, { useState, useEffect } from "react";
import { fetchAdminAuditLogs } from "../../lib/api.js";
import { FileText, Shield, Clock } from "lucide-react";

interface AdminAuditLogsViewProps {
  token: string;
}

export function AdminAuditLogsView({ token }: AdminAuditLogsViewProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAuditLogs();
  }, [token]);

  const loadAuditLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminAuditLogs(token);
      if (res.success) {
        setLogs(res.auditLogs || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load admin audit logs");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-50 dark:bg-purple-950/60 rounded-2xl text-purple-600">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Admin Audit Trail</h3>
            <p className="text-xs text-slate-500">Immutable record of all privileged administrative actions.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm">Loading admin audit trail...</div>
      ) : error ? (
        <div className="p-6 bg-rose-50 text-rose-800 rounded-2xl text-sm">{error}</div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4">Action</th>
                  <th className="p-4">Target Type</th>
                  <th className="p-4">Target ID</th>
                  <th className="p-4">Metadata</th>
                  <th className="p-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      No administrative audit logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                          {log.action?.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-slate-900 dark:text-white capitalize">{log.target_type || "-"}</td>
                      <td className="p-4 font-mono text-[11px] text-slate-500">{log.target_id || "-"}</td>
                      <td className="p-4 text-[11px] text-slate-500 max-w-xs truncate">
                        {log.metadata ? JSON.stringify(log.metadata) : "{}"}
                      </td>
                      <td className="p-4 text-slate-400 text-[11px]">
                        {new Date(log.created_at).toLocaleString()}
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
