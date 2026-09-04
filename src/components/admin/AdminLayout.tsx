import React, { useState, useEffect } from "react";
import { AdminSidebar, AdminTab } from "./AdminSidebar.js";
import { AdminDashboardView } from "./AdminDashboardView.js";
import { AdminUsersView } from "./AdminUsersView.js";
import { AdminStorageView } from "./AdminStorageView.js";
import { AdminReportsView } from "./AdminReportsView.js";
import { AdminActivityView } from "./AdminActivityView.js";
import { AdminAnnouncementsView } from "./AdminAnnouncementsView.js";
import { AdminSecurityView } from "./AdminSecurityView.js";
import { AdminSettingsView } from "./AdminSettingsView.js";
import { AdminAuditLogsView } from "./AdminAuditLogsView.js";
import { ErrorBoundary } from "../ErrorBoundary.js";
import { getSupabaseBrowserClient } from "../../lib/supabase.js";
import { Menu, ShieldAlert, ArrowLeft } from "lucide-react";

interface AdminLayoutProps {
  token: string;
  adminEmail?: string;
  onReturnToApp: () => void;
  onLogout: () => void;
}

export function AdminLayout({ token, adminEmail, onReturnToApp, onLogout }: AdminLayoutProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    verifyAdmin();
  }, [token]);

  const verifyAdmin = async () => {
    setCheckingAccess(true);
    setAccessError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setIsAdminAuthorized(false);
        setAccessError("Supabase browser client unavailable.");
        return;
      }

      // 1. Get authenticated user session
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error("Auth session check error in AdminLayout:", userError);
        setIsAdminAuthorized(false);
        setAccessError(userError?.message || "No authenticated session found.");
        return;
      }

      // 2. Query public.profiles using authenticated user's ID
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, email")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Profile query error for user ID", user.id, ":", profileError);
        setIsAdminAuthorized(false);
        setAccessError(`Profile query error: ${profileError.message} (${profileError.code || "ERR"})`);
        return;
      }

      // 3. Authorization check
      if (profile?.role !== "admin") {
        setIsAdminAuthorized(false);
        setAccessError(`Access Denied. Your profile role is '${profile?.role || "user"}', but 'admin' is required.`);
        return;
      }

      setIsAdminAuthorized(true);
    } catch (err: any) {
      console.error("Admin authorization check exception:", err);
      setIsAdminAuthorized(false);
      setAccessError(err.message || "Failed to verify admin authorization.");
    } finally {
      setCheckingAccess(false);
    }
  };

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Verifying administrator authorization...</p>
        </div>
      </div>
    );
  }

  if (!isAdminAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-5 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-2xs">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Access Denied</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {accessError || "You do not have administrative privileges to access this area."}
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={onReturnToApp}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4" /> Return to User Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row">
      {/* Admin Sidebar Navigation */}
      <AdminSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onReturnToApp={onReturnToApp}
        onLogout={onLogout}
        adminEmail={adminEmail}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Admin Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header */}
        <header className="h-16 px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              <Menu className="w-5 h-5" />
            </button>

            <h1 className="font-bold text-base tracking-tight text-slate-900 dark:text-white capitalize">
              {activeTab.replace("-", " ")}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Admin Console</span>
            </span>

            <button
              onClick={onReturnToApp}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer shadow-2xs hidden sm:flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Drive</span>
            </button>
          </div>
        </header>

        {/* Tab Body */}
        <main className="p-6 md:p-8 flex-1 max-w-7xl w-full mx-auto">
          <ErrorBoundary key={activeTab}>
            {activeTab === "dashboard" && <AdminDashboardView token={token} onNavigate={setActiveTab} />}
            {activeTab === "users" && <AdminUsersView token={token} />}
            {activeTab === "storage" && <AdminStorageView token={token} />}
            {activeTab === "reports" && <AdminReportsView token={token} />}
            {activeTab === "activity" && <AdminActivityView token={token} />}
            {activeTab === "announcements" && <AdminAnnouncementsView token={token} />}
            {activeTab === "security" && <AdminSecurityView token={token} />}
            {activeTab === "settings" && <AdminSettingsView token={token} />}
            {activeTab === "audit-logs" && <AdminAuditLogsView token={token} />}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
