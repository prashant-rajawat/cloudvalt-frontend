import React, { useState, useEffect } from "react";
import {
  fetchAdminUsers,
  fetchAdminUserDetails,
  updateUserRole,
  updateUserQuota,
  updateUserStatus,
  deleteUserAccountAdmin,
} from "../../lib/api.js";
import {
  Search,
  Shield,
  UserCheck,
  Ban,
  Trash2,
  HardDrive,
  Eye,
  Check,
  X,
  AlertTriangle,
  UserPlus
} from "lucide-react";

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

interface AdminUsersViewProps {
  token: string;
}

export function AdminUsersView({ token }: AdminUsersViewProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modals state
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isQuotaOpen, setIsQuotaOpen] = useState(false);
  const [newQuotaGB, setNewQuotaGB] = useState<number>(5);
  const [actionLoading, setActionLoading] = useState(false);
  const [userModalData, setUserModalData] = useState<any | null>(null);

  useEffect(() => {
    loadUsers();
  }, [token]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminUsers(token);
      if (res.success) {
        setUsers(res.users || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load user list");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetails = async (user: any) => {
    setSelectedUser(user);
    setIsDetailsOpen(true);
    try {
      const res = await fetchAdminUserDetails(token, user.id);
      if (res.success) {
        setUserModalData(res.user);
      }
    } catch (e) {
      console.warn("Could not load full user details:", e);
    }
  };

  const handleToggleRole = async (user: any) => {
    const nextRole = user.role === "admin" ? "user" : "admin";
    if (!confirm(`Are you sure you want to change ${user.email}'s role to ${nextRole.toUpperCase()}?`)) return;

    setActionLoading(true);
    try {
      await updateUserRole(token, user.id, nextRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: nextRole } : u))
      );
    } catch (err: any) {
      alert(err.message || "Failed to update role");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (user: any) => {
    const nextStatus = user.status === "suspended" ? "active" : "suspended";
    const actionText = nextStatus === "suspended" ? "SUSPEND" : "REACTIVATE";
    if (!confirm(`Are you sure you want to ${actionText} account ${user.email}?`)) return;

    setActionLoading(true);
    try {
      await updateUserStatus(token, user.id, nextStatus);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u))
      );
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenQuota = (user: any) => {
    setSelectedUser(user);
    setNewQuotaGB(Math.round((user.storageQuotaBytes || 5368709120) / (1024 * 1024 * 1024)));
    setIsQuotaOpen(true);
  };

  const handleSaveQuota = async () => {
    if (!selectedUser) return;
    const quotaBytes = newQuotaGB * 1024 * 1024 * 1024;

    setActionLoading(true);
    try {
      await updateUserQuota(token, selectedUser.id, quotaBytes);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id ? { ...u, storageQuotaBytes: quotaBytes } : u
        )
      );
      setIsQuotaOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to save storage quota");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (!confirm(`CRITICAL WARNING: This will permanently delete ${user.email}, all their stored files, folders, and shares. This operation cannot be undone. Continue?`)) return;

    setActionLoading(true);
    try {
      await deleteUserAccountAdmin(token, user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err: any) {
      alert(err.message || "Failed to delete user account");
    } finally {
      setActionLoading(false);
    }
  };

  // Filters
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesStatus = statusFilter === "all" || u.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 focus:outline-hidden"
          >
            <option value="all">All Roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 focus:outline-hidden"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm">Loading user directory...</div>
      ) : error ? (
        <div className="p-6 bg-rose-50 text-rose-800 rounded-2xl text-sm">{error}</div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Storage Usage</th>
                  <th className="p-4">Files</th>
                  <th className="p-4">Joined</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No users match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const usagePercent = Math.min(
                      100,
                      Math.round((user.storageUsedBytes / user.storageQuotaBytes) * 100)
                    );

                    return (
                      <tr key={user.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 uppercase">
                              {user.fullName?.[0] || user.email?.[0] || "U"}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {user.fullName}
                              </div>
                              <div className="text-slate-400 text-[11px]">{user.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                              user.role === "admin"
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>

                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                              user.status === "suspended"
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                            }`}
                          >
                            {user.status}
                          </span>
                        </td>

                        <td className="p-4 min-w-[160px]">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-slate-500">
                              <span>{formatBytes(user.storageUsedBytes)}</span>
                              <span>of {formatBytes(user.storageQuotaBytes)}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  usagePercent > 90
                                    ? "bg-rose-500"
                                    : usagePercent > 75
                                    ? "bg-amber-500"
                                    : "bg-blue-600"
                                }`}
                                style={{ width: `${usagePercent}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="p-4 font-medium">{user.fileCount}</td>

                        <td className="p-4 text-slate-400 text-[11px]">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>

                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenDetails(user)}
                              title="View Details"
                              className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleOpenQuota(user)}
                              title="Modify Quota"
                              className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <HardDrive className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleToggleRole(user)}
                              title={user.role === "admin" ? "Demote to User" : "Promote to Admin"}
                              className="p-1.5 text-slate-400 hover:text-purple-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Shield className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleToggleStatus(user)}
                              title={user.status === "suspended" ? "Reactivate Account" : "Suspend Account"}
                              className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ${
                                user.status === "suspended"
                                  ? "text-emerald-600 hover:text-emerald-700"
                                  : "text-amber-500 hover:text-amber-600"
                              }`}
                            >
                              {user.status === "suspended" ? <UserCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                            </button>

                            <button
                              onClick={() => handleDeleteUser(user)}
                              title="Delete Account"
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Storage Quota Modal */}
      {isQuotaOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Modify Storage Quota for {selectedUser.fullName}
            </h3>
            <p className="text-xs text-slate-500">
              Current used: <span className="font-semibold">{formatBytes(selectedUser.storageUsedBytes)}</span>
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                New Storage Quota (GB)
              </label>
              <input
                type="number"
                min="1"
                max="1024"
                value={newQuotaGB}
                onChange={(e) => setNewQuotaGB(Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm border border-slate-200 dark:border-slate-700 focus:outline-hidden"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Default quota is 5 GB. Maximum limit is 1,024 GB (1 TB).
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsQuotaOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuota}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-xs disabled:opacity-50"
              >
                Save Quota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {isDetailsOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center font-bold text-blue-700 dark:text-blue-300 text-base">
                  {selectedUser.fullName?.[0] || "U"}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">{selectedUser.fullName}</h3>
                  <p className="text-xs text-slate-500">{selectedUser.email}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsDetailsOpen(false);
                  setUserModalData(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl text-xs">
              <div>
                <span className="text-slate-400 block">User Role</span>
                <span className="font-bold capitalize text-slate-900 dark:text-white">{selectedUser.role}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Account Status</span>
                <span className="font-bold capitalize text-slate-900 dark:text-white">{selectedUser.status}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Storage Used</span>
                <span className="font-bold text-slate-900 dark:text-white">{formatBytes(selectedUser.storageUsedBytes)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Quota Limit</span>
                <span className="font-bold text-slate-900 dark:text-white">{formatBytes(selectedUser.storageQuotaBytes)}</span>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-xs text-slate-900 dark:text-white mb-2">Recent User Activity Logs</h4>
              {userModalData?.recentActivity?.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {userModalData.recentActivity.map((act: any) => (
                    <div key={act.id} className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-xs flex justify-between">
                      <span>{act.action?.replace("_", " ")} - <span className="font-medium text-blue-600">{act.entity_name || act.entity_type}</span></span>
                      <span className="text-[10px] text-slate-400">{new Date(act.created_at).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No activity recorded for this user.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
