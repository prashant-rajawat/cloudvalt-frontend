import React from "react";
import {
  LayoutDashboard,
  Users,
  HardDrive,
  BarChart3,
  Activity,
  Megaphone,
  ShieldAlert,
  Settings,
  FileText,
  LogOut,
  ArrowLeft,
  X,
  Cloud,
  Shield
} from "lucide-react";

export type AdminTab =
  | "dashboard"
  | "users"
  | "storage"
  | "reports"
  | "activity"
  | "announcements"
  | "security"
  | "settings"
  | "audit-logs";

interface AdminSidebarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  onReturnToApp: () => void;
  onLogout: () => void;
  adminEmail?: string;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function AdminSidebar({
  activeTab,
  onTabChange,
  onReturnToApp,
  onLogout,
  adminEmail,
  isMobileOpen,
  onCloseMobile,
}: AdminSidebarProps) {
  const navItems: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "users", label: "Users Management", icon: <Users className="w-4 h-4" /> },
    { id: "storage", label: "Storage Management", icon: <HardDrive className="w-4 h-4" /> },
    { id: "reports", label: "Analytics & Reports", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "activity", label: "System Activity", icon: <Activity className="w-4 h-4" /> },
    { id: "announcements", label: "Announcements", icon: <Megaphone className="w-4 h-4" /> },
    { id: "security", label: "Abuse & Security", icon: <ShieldAlert className="w-4 h-4" /> },
    { id: "settings", label: "System Settings", icon: <Settings className="w-4 h-4" /> },
    { id: "audit-logs", label: "Admin Audit Logs", icon: <FileText className="w-4 h-4" /> },
  ];

  const adminInitial = adminEmail ? adminEmail.charAt(0).toUpperCase() : "A";
  const adminName = adminEmail ? adminEmail.split("@")[0] : "Administrator";

  return (
    <>
      {/* Mobile Overlay Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed lg:static top-0 left-0 bottom-0 w-64 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 flex flex-col justify-between z-50 transition-transform duration-200 border-r border-slate-200 dark:border-slate-800 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div>
          {/* Header */}
          <div className="h-16 px-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo.png"
                alt="CloudVault Logo"
                className="w-9 h-9 object-contain mix-blend-multiply shrink-0"
                referrerPolicy="no-referrer"
              />
              <div>
                <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white block">
                  CloudVault
                </span>
                <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider">
                  Admin Control
                </span>
              </div>
            </div>

            {isMobileOpen && (
              <button
                onClick={onCloseMobile}
                className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Admin Profile Box */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                  {adminInitial}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block truncate">
                    {adminName}
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate">
                    {adminEmail || "admin@cloudvault.com"}
                  </span>
                </div>
              </div>

              <button
                onClick={onLogout}
                title="Sign Out"
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="p-4 space-y-1">
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
              System Management
            </div>

            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all cursor-pointer text-left ${
                    isActive
                      ? "bg-blue-50 text-blue-600 font-semibold dark:bg-blue-950/60 dark:text-blue-400 shadow-2xs"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <button
            onClick={onReturnToApp}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl transition-all cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Return to User Drive</span>
          </button>
        </div>
      </aside>
    </>
  );
}
