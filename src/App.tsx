import React, { useEffect, useState } from "react";
import { LoginPage } from "./pages/LoginPage.js";
import { SignupPage } from "./pages/SignupPage.js";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage.js";
import { ResetPasswordPage } from "./pages/ResetPasswordPage.js";
import { DriveDashboard } from "./components/DriveDashboard.js";
import { ShareModal } from "./components/ShareModal.js";
import { ProfileModal } from "./components/ProfileModal.js";
import { PublicShareView } from "./components/PublicShareView.js";
import { NotificationPanel } from "./components/NotificationPanel.js";
import { ActivityView } from "./components/ActivityView.js";
import { SettingsView } from "./components/SettingsView.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { AdminLayout } from "./components/admin/AdminLayout.js";
import { fetchHealthStatus } from "./lib/api.js";
import { getSupabaseBrowserClient } from "./lib/supabase.js";
import { fetchUserNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "./lib/notifications.js";
import { fetchUserActivityLogs } from "./lib/activity.js";
import { ApiHealthResponse, FileItem, FolderItem, StorageQuota, UserProfile, NotificationItem, ActivityLogItem } from "./types/index.js";
import {
  HardDrive,
  Cloud,
  Server,
  ShieldCheck,
  Lock,
  LogOut,
  User as UserIcon,
  Star,
  Trash2,
  Share2,
  Settings as SettingsIcon,
  FileText,
  Clock,
  PieChart,
  Bell,
  Activity as ActivityIcon,
  Sparkles
} from "lucide-react";

export default function App() {
  // Routing & Navigation state
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname && window.location.pathname !== "/"
      ? window.location.pathname
      : "/dashboard";
  });

  const [activeTab, setActiveTab] = useState<"dashboard" | "files" | "starred" | "trash" | "shared" | "recent" | "storage" | "search" | "activity" | "settings">("dashboard");

  // Notifications State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Activity History State
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);
  const [isActivitiesLoading, setIsActivitiesLoading] = useState(false);

  // Theme State (Fixed to clean light theme)
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark" | "system">("light");

  // Health / Server Status
  const [healthData, setHealthData] = useState<ApiHealthResponse | null>(null);
  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline">("checking");
  const [publicShareToken, setPublicShareToken] = useState<string | null>(null);

  // Auth State
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [authToken, setAuthToken] = useState<string>("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Quota & Storage
  const [quota, setQuota] = useState<StorageQuota>({
    usedBytes: 0,
    totalBytes: 5368709120, // 5 GB
    fileCount: 0,
    folderCount: 0,
  });

  // Modals
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ type: "file" | "folder"; item: FileItem | FolderItem } | null>(null);
  const [isNotifPanelOpen, setIsNotifPanelOpen] = useState(false);

  // Router navigation helper
  const navigate = (route: string) => {
    window.history.pushState({}, "", route);
    setCurrentPath(route);
  };

  // Sync pathname changes on browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname || "/dashboard";
      setCurrentPath(path);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Check URL query parameters or pathname for public shares
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryToken = params.get("share");
    
    // Check path for /share/:token
    const pathMatch = window.location.pathname.match(/\/share\/([a-zA-Z0-9_-]+)/);
    const pathToken = pathMatch ? pathMatch[1] : null;

    if (queryToken || pathToken) {
      setPublicShareToken(queryToken || pathToken);
    } else {
      setPublicShareToken(null);
    }
  }, [currentPath]);

  // Initialize Supabase Auth Session Listener & Central Session Mechanism
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setIsAuthLoading(false);
      return;
    }

    const initAuth = async () => {
      setIsAuthLoading(true);
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error("Error getting auth session:", sessionError);
        }
        if (session?.user) {
          setUser({ id: session.user.id, email: session.user.email || "" });
          setAuthToken(session.access_token);
          await fetchUserProfile(session.user.id);
        } else {
          setUser(null);
          setAuthToken("");
          setProfile(null);
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
      } finally {
        setIsAuthLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email || "" });
        setAuthToken(session.access_token);
        await fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setAuthToken("");
        setProfile(null);
      }
      setIsAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch user profile from public.profiles table using authenticated user's ID
  const fetchUserProfile = async (userId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST303" || error.message?.includes("JWT issued at future")) {
          console.warn("JWT time skew detected (PGRST303), refreshing session...");
          await supabase.auth.refreshSession();
          const retryRes = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .single();
          if (!retryRes.error && retryRes.data) {
            const data = retryRes.data;
            const loadedProfile: UserProfile = {
              id: data.id,
              email: data.email,
              fullName: data.full_name,
              avatarUrl: data.avatar_url,
              role: data.role || "user",
              status: data.status || "active",
              storage_quota_bytes: data.storage_quota_bytes,
              createdAt: data.created_at,
              updatedAt: data.updated_at,
            };
            setProfile(loadedProfile);
            return loadedProfile;
          }
        }
        console.warn("Error querying public.profiles table for user ID", userId, ":", error.message);
      }

      if (data) {
        const loadedProfile: UserProfile = {
          id: data.id,
          email: data.email,
          fullName: data.full_name,
          avatarUrl: data.avatar_url,
          role: data.role || "user",
          status: data.status || "active",
          storage_quota_bytes: data.storage_quota_bytes,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
        setProfile(loadedProfile);
        return loadedProfile;
      }
    } catch (err) {
      console.warn("Could not load user profile:", err);
    }

    // Graceful fallback profile
    const { data: authData } = await supabase.auth.getUser();
    const email = authData?.user?.email || "";
    const fallbackProfile: UserProfile = {
      id: userId,
      email: email,
      fullName: email ? email.split("@")[0] : "User",
      avatarUrl: "",
      role: "user",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProfile(fallbackProfile);
    return fallbackProfile;
  };

  // Backend Health Check
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const data = await fetchHealthStatus();
        setHealthData(data);
        setServerStatus("online");
      } catch (err) {
        console.warn("Backend health check probe:", err);
        setServerStatus("offline");
      }
    };
    checkHealth();
  }, []);

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setAuthToken("");
    setProfile(null);
    navigate("/login");
  };

  // Route guarding and redirection logic
  useEffect(() => {
    if (isAuthLoading) return;

    // Check if the current route is a public share route
    if (currentPath.startsWith("/share") || publicShareToken) {
      return;
    }

    const publicRoutes = ["/login", "/signup", "/forgot-password", "/reset-password"];

    if (!user && !publicRoutes.includes(currentPath)) {
      navigate("/login");
    } else if (user && (publicRoutes.includes(currentPath) || currentPath === "/")) {
      navigate("/dashboard");
    } else if (user) {
      if (currentPath.startsWith("/activity")) setActiveTab("activity");
      else if (currentPath.startsWith("/settings")) setActiveTab("settings");
      else if (currentPath.startsWith("/recent")) setActiveTab("recent");
      else if (currentPath.startsWith("/storage")) setActiveTab("storage");
      else if (currentPath.startsWith("/search")) setActiveTab("search");
      else if (currentPath.startsWith("/starred")) setActiveTab("starred");
      else if (currentPath.startsWith("/shared")) setActiveTab("shared");
      else if (currentPath.startsWith("/trash")) setActiveTab("trash");
      else if (currentPath.startsWith("/files")) setActiveTab("files");
      else if (currentPath.startsWith("/drive") || currentPath.startsWith("/dashboard")) setActiveTab("dashboard");
    }
  }, [user, currentPath, isAuthLoading]);

  // Theme Management Effect (Enforce one fixed white and blue theme)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
  }, []);

  // Load User Notifications & Activities
  useEffect(() => {
    if (user?.id) {
      loadNotifications(user.id);
      loadActivities(user.id);
    }
  }, [user?.id, activeTab]);

  const loadNotifications = async (userId: string) => {
    const items = await fetchUserNotifications(userId);
    setNotifications(items);
  };

  const loadActivities = async (userId: string) => {
    setIsActivitiesLoading(true);
    const items = await fetchUserActivityLogs(userId);
    setActivities(items);
    setIsActivitiesLoading(false);
  };

  const handleMarkNotificationRead = async (notifId: string) => {
    if (!user) return;
    await markNotificationAsRead(user.id, notifId);
    setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n)));
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!user) return;
    await markAllNotificationsAsRead(user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleNotificationClick = (notif: NotificationItem) => {
    setIsNotifPanelOpen(false);
    if (notif.relatedFileId || notif.relatedFolderId) {
      setActiveTab("dashboard");
      navigate("/dashboard");
    }
  };

  const handleThemeChanged = (newTheme: "light" | "dark" | "system") => {
    setCurrentTheme(newTheme);
    localStorage.setItem("cloudvault_theme", newTheme);
  };

  // If viewing a public share link
  if (publicShareToken) {
    return (
      <PublicShareView
        shareToken={publicShareToken}
        onBackToApp={() => {
          if (window.location.pathname.startsWith("/share/")) {
            window.history.pushState({}, "", "/dashboard");
            setCurrentPath("/dashboard");
          } else {
            const url = new URL(window.location.href);
            url.searchParams.delete("share");
            window.history.pushState({}, "", url.pathname);
            setCurrentPath(url.pathname);
          }
          setPublicShareToken(null);
        }}
      />
    );
  }

  // If still loading session on initial mount
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <img
            src="https://i.ibb.co/Y4vr5f6J/image.png"
            alt="CloudVault Logo"
            className="w-12 h-12 object-contain mix-blend-multiply animate-pulse"
            referrerPolicy="no-referrer"
          />
          <p className="text-xs font-semibold text-slate-500 tracking-tight">Loading CloudVault...</p>
        </div>
      </div>
    );
  }

  // Render Public Auth Pages
  if (currentPath === "/login") {
    return (
      <LoginPage
        onSuccess={() => navigate("/dashboard")}
        onNavigate={(route) => navigate(route)}
      />
    );
  }
  if (currentPath === "/signup") {
    return (
      <SignupPage
        onSuccess={() => navigate("/dashboard")}
        onNavigate={(route) => navigate(route)}
      />
    );
  }
  if (currentPath === "/forgot-password") {
    return (
      <ForgotPasswordPage onNavigate={(route) => navigate(route)} />
    );
  }
  if (currentPath === "/reset-password") {
    return (
      <ResetPasswordPage onNavigate={(route) => navigate(route)} />
    );
  }

  // If unauthenticated trying to access any other route
  if (!user) {
    navigate("/login");
    return null;
  }

  // Render Admin Console if on /admin route
  if (currentPath.startsWith("/admin")) {
    return (
      <AdminLayout
        token={authToken}
        adminEmail={user.email}
        onReturnToApp={() => navigate("/dashboard")}
        onLogout={handleLogout}
      />
    );
  }

  const percentUsed = Math.min(100, Math.round((quota.usedBytes / quota.totalBytes) * 100));

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex flex-col md:flex-row selection:bg-blue-500 selection:text-white antialiased">
      {/* Clean Minimalism Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col justify-between p-6 shrink-0">
        <div>
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5 mb-8">
            <img
              src="https://i.ibb.co/Y4vr5f6J/image.png"
              alt="CloudVault Logo"
              className="w-9 h-9 object-contain mix-blend-multiply"
              referrerPolicy="no-referrer"
            />
            <div>
              <span className="text-lg font-semibold tracking-tight text-slate-900 block leading-tight">
                CloudVault
              </span>
              <span className="text-[10px] font-medium text-slate-400">Media Storage Service</span>
            </div>
          </div>

          {/* User Profile Widget */}
          <div className="mb-6">
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
              <button
                onClick={() => {
                  navigate("/profile");
                  setIsProfileModalOpen(true);
                }}
                className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 group-hover:bg-blue-700 transition-colors overflow-hidden">
                  {profile?.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    profile?.fullName?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {profile?.fullName || user.email.split("@")[0]}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                </div>
              </button>
              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
            {profile?.role === "admin" && (
              <button
                onClick={() => navigate("/admin")}
                className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-white" />
                <span>Admin Console</span>
              </button>
            )}
          </div>

          {/* Main Navigation */}
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-3 mb-2">
            Storage Views
          </div>
          <nav className="space-y-1">
            <button
              onClick={() => {
                setActiveTab("dashboard");
                navigate("/dashboard");
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs transition-colors cursor-pointer text-left ${
                activeTab === "dashboard"
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <HardDrive className="w-4 h-4" />
              <span>Drive Dashboard</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("files");
                navigate("/files");
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs transition-colors cursor-pointer text-left ${
                activeTab === "files"
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>All Files</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("recent");
                navigate("/recent");
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs transition-colors cursor-pointer text-left ${
                activeTab === "recent"
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Recent Files</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("starred");
                navigate("/starred");
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs transition-colors cursor-pointer text-left ${
                activeTab === "starred"
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Star className="w-4 h-4" />
              <span>Starred Items</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("shared");
                navigate("/shared");
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs transition-colors cursor-pointer text-left ${
                activeTab === "shared"
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Share2 className="w-4 h-4" />
              <span>Shared with Me</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("storage");
                navigate("/storage");
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs transition-colors cursor-pointer text-left ${
                activeTab === "storage"
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <PieChart className="w-4 h-4" />
              <span>Storage Usage</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("activity");
                navigate("/activity");
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs transition-colors cursor-pointer text-left ${
                activeTab === "activity"
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <ActivityIcon className="w-4 h-4" />
              <span>Activity History</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("settings");
                navigate("/settings");
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs transition-colors cursor-pointer text-left ${
                activeTab === "settings"
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              <span>Account & Settings</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("trash");
                navigate("/trash");
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs transition-colors cursor-pointer text-left ${
                activeTab === "trash"
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>Trash Bin</span>
            </button>
          </nav>
        </div>

        {/* Storage Meter & System Status Widget */}
        <div className="pt-6 border-t border-slate-100 mt-6 md:mt-0">
          <div className="flex justify-between text-xs font-medium text-slate-600 mb-1.5">
            <span>Storage Quota</span>
            <span className="font-semibold text-slate-800">{percentUsed}%</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                percentUsed > 90 ? "bg-rose-500" : percentUsed > 70 ? "bg-amber-500" : "bg-blue-600"
              }`}
              style={{ width: `${Math.max(percentUsed, 1)}%` }}
            ></div>
          </div>
          <p className="text-[10px] text-slate-400">
            {formatBytes(quota.usedBytes)} of {formatBytes(quota.totalBytes)} used
          </p>

          <div className="mt-4 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-600 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-slate-400" />
              <span>Backend API</span>
            </div>
            {serverStatus === "online" ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                :3000
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                Checking
              </span>
            )}
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Tab / Route Content */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          <ErrorBoundary key={activeTab}>
            {["dashboard", "files", "starred", "shared", "trash", "recent", "storage", "search"].includes(activeTab) ? (
              <DriveDashboard
                user={user}
                profile={profile}
                authToken={authToken}
                initialFilter={activeTab}
                currentPath={currentPath}
                onNavigate={(path) => navigate(path)}
                onOpenShareModal={(target) => setShareTarget(target)}
                onOpenProfileModal={() => setIsProfileModalOpen(true)}
                onQuotaUpdated={(newQuota) => setQuota(newQuota)}
                notifications={notifications}
                onMarkNotificationRead={handleMarkNotificationRead}
                onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
                onNotificationClick={handleNotificationClick}
              />
            ) : activeTab === "activity" ? (
              <ActivityView
                activities={activities}
                isLoading={isActivitiesLoading}
                user={user}
                profile={profile}
                onRefresh={() => user && loadActivities(user.id)}
              />
            ) : (
              <SettingsView
                user={user}
                profile={profile}
                quota={quota}
                authToken={authToken}
                onProfileUpdated={() => user && fetchUserProfile(user.id)}
                onLogout={handleLogout}
                onThemeChanged={handleThemeChanged}
                currentTheme={currentTheme}
              />
            )}
          </ErrorBoundary>
        </div>
      </main>

      {/* Modals */}
      <ShareModal
        isOpen={!!shareTarget}
        onClose={() => setShareTarget(null)}
        targetItem={shareTarget}
        authToken={authToken}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => {
          setIsProfileModalOpen(false);
          if (currentPath === "/profile") navigate("/dashboard");
        }}
        profile={profile}
        quota={quota}
        onProfileUpdated={() => user && fetchUserProfile(user.id)}
      />
    </div>
  );
}
