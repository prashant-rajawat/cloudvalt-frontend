import { ApiHealthResponse, SupabaseHealthResponse, SupabaseConfigResponse } from "../types/index.js";

/**
 * CloudVault API Client
 * Centralized fetch helper for communicating with the Node.js/Express backend.
 */

const API_BASE_URL = "/api";

async function fetchAPI(endpoint: string, options: RequestInit = {}, token?: string) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    ...options.headers as any,
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function fetchHealthStatus(probe: boolean = false): Promise<ApiHealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health${probe ? "?probe=true" : ""}`);
  if (!response.ok) {
    throw new Error(`Health check failed with status: ${response.status}`);
  }
  return response.json();
}

export async function fetchSupabaseHealth(): Promise<SupabaseHealthResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/supabase/health`);
    const status = response.status;
    let data: any = null;

    try {
      const text = await response.text();
      if (text) {
        data = JSON.parse(text);
      }
    } catch {
      // Body was not valid JSON
    }

    if (data && typeof data === "object") {
      const reachabilityData = data.reachability || {};
      const configData = data.config || {};
      const isReachable = Boolean(reachabilityData.reachable === true || (data.success === true && reachabilityData.reachable !== false));
      const isConfigured = Boolean(configData.isConfigured ?? reachabilityData.configured ?? false);

      return {
        success: isReachable,
        httpStatus: status,
        reachability: {
          reachable: isReachable,
          configured: isConfigured,
          latencyMs: reachabilityData.latencyMs ?? null,
          errorType: reachabilityData.errorType ?? (isReachable ? null : (status === 503 ? "DNS_ERROR" : (status === 500 ? "CONFIGURATION_ERROR" : "NETWORK_ERROR"))),
          status: isReachable ? "reachable" : (reachabilityData.status || (isConfigured ? "unreachable" : "unconfigured")),
          message: reachabilityData.message || (isReachable ? "Supabase is reachable" : "Backend could not reach Supabase"),
          hostname: reachabilityData.hostname || configData.hostname || "",
          endpoints: reachabilityData.endpoints || { auth: "unconfigured", rest: "unconfigured" },
        },
        config: {
          isConfigured: isConfigured,
          hasUrl: Boolean(configData.hasUrl),
          hasAnonKey: Boolean(configData.hasAnonKey),
          hasServiceRoleKey: Boolean(configData.hasServiceRoleKey),
          hostname: configData.hostname || reachabilityData.hostname || "",
          supabaseUrl: configData.supabaseUrl ?? null,
        },
        timestamp: data.timestamp || new Date().toISOString(),
      };
    }

    return {
      success: false,
      httpStatus: status,
      reachability: {
        reachable: false,
        configured: false,
        latencyMs: null,
        status: "configuration_error",
        errorType: "INTERNAL_ERROR",
        message: `HTTP ${status}: Non-JSON response received from health endpoint`,
        hostname: "",
        endpoints: { auth: "unconfigured", rest: "unconfigured" },
      },
      config: {
        isConfigured: false,
        hasUrl: false,
        hasAnonKey: false,
        hasServiceRoleKey: false,
        supabaseUrl: null,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (netErr: any) {
    return {
      success: false,
      httpStatus: 0,
      reachability: {
        reachable: false,
        configured: false,
        latencyMs: null,
        errorType: "NETWORK_ERROR",
        status: "unreachable",
        message: `Backend API Gateway Unreachable: ${netErr?.message || "Connection refused"}`,
        hostname: "",
        endpoints: { auth: "unconfigured", rest: "unconfigured" },
      },
      config: {
        isConfigured: false,
        hasUrl: false,
        hasAnonKey: false,
        hasServiceRoleKey: false,
        supabaseUrl: null,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

export async function fetchSupabaseConfig(): Promise<SupabaseConfigResponse> {
  const response = await fetch(`${API_BASE_URL}/supabase/config`);
  if (!response.ok) {
    throw new Error(`Failed to fetch Supabase config status: ${response.status}`);
  }
  return response.json();
}

export async function fetchFileStats(token: string) {
  const res = await fetch(`${API_BASE_URL}/files/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch file stats");
  return res.json();
}

export async function createShareLink(token: string, payload: { file_id?: string; folder_id?: string; is_public_link?: boolean; permission?: string; granted_to_email?: string; expires_at?: string }) {
  const res = await fetch(`${API_BASE_URL}/shares`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to create share");
  }
  return res.json();
}

export async function fetchMyShares(token: string) {
  const res = await fetch(`${API_BASE_URL}/shares/my`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch shares");
  return res.json();
}

export async function fetchSharedWithMe(token: string) {
  const res = await fetch(`${API_BASE_URL}/shares/shared-with-me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch shared items");
  return res.json();
}

export async function updateShareLink(token: string, shareId: string, payload: { permission?: string; expires_at?: string | null; is_public_link?: boolean }) {
  const res = await fetch(`${API_BASE_URL}/shares/${shareId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to update share");
  }
  return res.json();
}

export async function revokeShareLink(token: string, shareId: string) {
  const res = await fetch(`${API_BASE_URL}/shares/${shareId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to revoke share");
  return res.json();
}

export async function fetchPublicShareItem(shareToken: string) {
  const res = await fetch(`${API_BASE_URL}/shares/public/${shareToken}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to load public share");
  }
  return res.json();
}

export async function unlockPublicShare(shareToken: string, password: string) {
  const res = await fetch(`${API_BASE_URL}/shares/public/${shareToken}/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Incorrect password. Please try again.");
  }
  return res.json();
}

export async function renameSharedFile(shareToken: string, newName: string, password?: string) {
  const res = await fetch(`${API_BASE_URL}/shares/public/${shareToken}/rename`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newName, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to rename shared file");
  }
  return res.json();
}

export async function replaceSharedFile(
  shareToken: string,
  payload: { base64Data: string; fileName?: string; mimeType?: string; sizeBytes?: number; password?: string }
) {
  const res = await fetch(`${API_BASE_URL}/shares/public/${shareToken}/replace`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to update shared file");
  }
  return res.json();
}

export async function fetchSignedDownloadUrl(token: string, path: string) {
  const res = await fetch(`${API_BASE_URL}/storage/signed-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error("Failed to generate download URL");
  return res.json();
}

export async function permanentlyDeleteFile(token: string, fileId: string) {
  return fetchAPI("/files/permanent-delete", {
    method: "POST",
    body: JSON.stringify({ fileId }),
  }, token);
}

export const trashFile = (token: string, fileId: string) =>
  fetchAPI(`/files/${fileId}/trash`, { method: "POST" }, token);

export const restoreFile = (token: string, fileId: string) =>
  fetchAPI(`/files/${fileId}/restore`, { method: "POST" }, token);

export const createFolder = (token: string, payload: { name: string; parentId: string | null; color?: string }) =>
  fetchAPI("/folders", { method: "POST", body: JSON.stringify(payload) }, token);

export const updateFolder = (token: string, id: string, payload: { name?: string; parentId?: string | null; color?: string; isStarred?: boolean }) =>
  fetchAPI(`/folders/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token);

export const trashFolder = (token: string, id: string) =>
  fetchAPI(`/folders/${id}/trash`, { method: "POST" }, token);

export const restoreFolder = (token: string, id: string) =>
  fetchAPI(`/folders/${id}/restore`, { method: "POST" }, token);

export const permanentlyDeleteFolder = (token: string, id: string) =>
  fetchAPI(`/folders/${id}`, { method: "DELETE" }, token);

export const cleanupTrash = (token: string) =>
  fetchAPI("/folders/cleanup", { method: "POST" }, token);

// File Management API
export const initUpload = (token: string, data: { name: string; mimeType: string; sizeBytes: number; folderId: string | null }) =>
  fetchAPI("/files/init", { method: "POST", body: JSON.stringify(data) }, token);

export const completeUpload = (token: string, fileId: string) =>
  fetchAPI("/files/complete", { method: "POST", body: JSON.stringify({ fileId }) }, token);

export const starFile = (token: string, fileId: string, isStarred: boolean) =>
  fetchAPI(`/files/${fileId}/star`, { method: "POST", body: JSON.stringify({ isStarred }) }, token);

export const updateFile = (token: string, fileId: string, data: { name?: string; folderId?: string | null }) =>
  fetchAPI(`/files/${fileId}`, { method: "PATCH", body: JSON.stringify(data) }, token);

/* ==========================================================================
   ADMIN API CLIENT FUNCTIONS
   ========================================================================== */

export async function checkAdminAccess(token: string) {
  const res = await fetch(`${API_BASE_URL}/admin/check-access`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { success: false, isAdmin: false };
  return res.json();
}

export async function fetchAdminDashboardStats(token: string) {
  const res = await fetch(`${API_BASE_URL}/admin/dashboard-stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to fetch admin dashboard stats");
  }
  return res.json();
}

export async function fetchAdminUsers(token: string) {
  const res = await fetch(`${API_BASE_URL}/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to fetch user list");
  }
  return res.json();
}

export async function fetchAdminUserDetails(token: string, userId: string) {
  const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to fetch user details");
  }
  return res.json();
}

export async function updateUserRole(token: string, userId: string, role: string) {
  const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/role`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to update user role");
  }
  return res.json();
}

export async function updateUserQuota(token: string, userId: string, quotaBytes: number) {
  const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/quota`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ quotaBytes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to update storage quota");
  }
  return res.json();
}

export async function updateUserStatus(token: string, userId: string, status: string) {
  const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to update account status");
  }
  return res.json();
}

export async function deleteUserAccountAdmin(token: string, userId: string) {
  const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to delete user account");
  }
  return res.json();
}

export async function fetchAdminStorageStats(token: string) {
  const res = await fetch(`${API_BASE_URL}/admin/storage/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch storage stats");
  return res.json();
}

export async function fetchAdminReportStats(token: string) {
  const res = await fetch(`${API_BASE_URL}/admin/reports/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch report metrics");
  return res.json();
}

export async function fetchAdminActivityLogs(token: string, filters?: { action?: string; userId?: string; entityType?: string }) {
  const params = new URLSearchParams();
  if (filters?.action) params.append("action", filters.action);
  if (filters?.userId) params.append("userId", filters.userId);
  if (filters?.entityType) params.append("entityType", filters.entityType);

  const res = await fetch(`${API_BASE_URL}/admin/activity?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch admin activity logs");
  return res.json();
}

export async function fetchAdminAnnouncements(token: string) {
  const res = await fetch(`${API_BASE_URL}/admin/announcements`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch announcements");
  return res.json();
}

export async function createAnnouncement(token: string, announcement: any) {
  const res = await fetch(`${API_BASE_URL}/admin/announcements`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(announcement),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to create announcement");
  }
  return res.json();
}

export async function updateAnnouncement(token: string, id: string, updates: any) {
  const res = await fetch(`${API_BASE_URL}/admin/announcements/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update announcement");
  return res.json();
}

export async function deleteAnnouncement(token: string, id: string) {
  const res = await fetch(`${API_BASE_URL}/admin/announcements/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to delete announcement");
  return res.json();
}

export async function fetchActiveAnnouncements() {
  const res = await fetch(`${API_BASE_URL}/announcements/active`);
  if (!res.ok) return { success: true, announcements: [] };
  return res.json();
}

export async function submitAbuseReport(token: string, payload: any) {
  const res = await fetch(`${API_BASE_URL}/reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to submit report");
  }
  return res.json();
}

export async function fetchAdminAbuseReports(token: string) {
  const res = await fetch(`${API_BASE_URL}/admin/abuse-reports`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch abuse reports");
  return res.json();
}

export async function updateAbuseReportStatus(token: string, id: string, status: string) {
  const res = await fetch(`${API_BASE_URL}/admin/abuse-reports/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update report status");
  return res.json();
}

export async function fetchAdminAuditLogs(token: string) {
  const res = await fetch(`${API_BASE_URL}/admin/audit-logs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch admin audit logs");
  return res.json();
}

export async function fetchAdminSettings(token: string) {
  const res = await fetch(`${API_BASE_URL}/admin/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch admin settings");
  return res.json();
}

export async function updateAdminSettings(token: string, settings: any) {
  const res = await fetch(`${API_BASE_URL}/admin/settings`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error("Failed to update system settings");
  return res.json();
}

export async function fetchPublicSystemSettings() {
  const res = await fetch(`${API_BASE_URL}/system/settings/public`);
  if (!res.ok) return { success: true, maintenanceMode: false, allowPublicShares: true };
  return res.json();
}

/**
 * AI Assistant API Helpers
 */
export async function sendAIChatMessage(token: string, prompt: string, history: any[] = []) {
  const res = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ prompt, conversationHistory: history }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to generate AI response.");
  }
  return res.json();
}

export async function summarizeDocumentWithAI(token: string, fileId: string) {
  const res = await fetch(`${API_BASE_URL}/ai/summarize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fileId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to summarize document.");
  }
  return res.json();
}

export async function analyzeImageWithAI(token: string, fileId: string, prompt?: string) {
  const res = await fetch(`${API_BASE_URL}/ai/analyze-image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fileId, prompt }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to analyze image.");
  }
  return res.json();
}

export async function fetchAISmartOrganization(token: string) {
  const res = await fetch(`${API_BASE_URL}/ai/smart-organize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to generate smart organization suggestions.");
  }
  return res.json();
}

export async function fetchAIDuplicateFiles(token: string) {
  const res = await fetch(`${API_BASE_URL}/ai/duplicates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to scan duplicate files.");
  }
  return res.json();
}

export async function fetchAIStorageInsights(token: string) {
  const res = await fetch(`${API_BASE_URL}/ai/storage-insights`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to fetch AI storage insights.");
  }
  return res.json();
}

