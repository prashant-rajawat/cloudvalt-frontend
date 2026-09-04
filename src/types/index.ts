/**
 * CloudVault - Core TypeScript Interfaces & Data Models
 * Prepared for phased feature implementation.
 */

export type FileCategory = "image" | "video" | "audio" | "document" | "archive" | "other";

export type AccessPermission = "viewer" | "editor" | "owner";

export interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  role?: "user" | "admin" | string;
  status?: "active" | "suspended" | string;
  storage_quota_bytes?: number;
  createdAt: string;
  updatedAt: string;
}

// 15 GB default quota in bytes (15 * 1024 * 1024 * 1024)
export const DEFAULT_STORAGE_QUOTA_BYTES = 16106127360;
export const DEFAULT_STORAGE_QUOTA_GB = 15;

export interface StorageQuota {
  usedBytes: number;
  totalBytes: number;
  fileCount: number;
  folderCount: number;
}

export interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  ownerId: string;
  color?: string;
  isStarred: boolean;
  isTrash: boolean;
  deletedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileItem {
  id: string;
  name: string;
  originalName: string;
  extension: string;
  mimeType: string;
  category: FileCategory;
  sizeBytes: number;
  storagePath: string;
  publicUrl?: string;
  folderId: string | null;
  ownerId: string;
  isStarred: boolean;
  isTrash: boolean;
  deletedAt?: string;
  expiresAt?: string;
  thumbnailUrl?: string;
  versionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FileVersion {
  id: string;
  fileId: string;
  versionNumber: number;
  storageKey: string;
  sizeBytes: number;
  checksum?: string;
  createdAt: string;
}

export interface SharePermission {
  id: string;
  fileId?: string;
  folderId?: string;
  grantedToEmail?: string;
  permission: AccessPermission;
  isPublicLink: boolean;
  shareToken?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface ApiHealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  environment: string;
  modules: {
    auth: { status: string; provider: string };
    storage: { status: string; provider: string };
    database: { status: string; provider: string };
    files: { status: string; features: string[] };
  };
  configState: {
    supabaseConfigured: boolean;
    hasUrl: boolean;
    hasAnonKey: boolean;
    hasServiceRoleKey: boolean;
  };
  liveProbe?: SupabaseHealthResponse["reachability"];
}

export interface SupabaseHealthResponse {
  success: boolean;
  httpStatus?: number;
  reachability: {
    reachable: boolean;
    configured: boolean;
    latencyMs: number | null;
    status: "reachable" | "connected" | "unconfigured" | "unreachable" | "configuration_error" | "invalid_url";
    errorType?: "NETWORK_ERROR" | "TIMEOUT" | "DNS_ERROR" | "TLS_ERROR" | "AUTH_ERROR" | "UNCONFIGURED" | "CONFIGURATION_ERROR" | "HTTP_ERROR" | "INTERNAL_ERROR" | string | null;
    message: string;
    hostname?: string;
    endpoints: {
      auth: "healthy" | "unhealthy" | "unconfigured" | "reachable" | "unreachable";
      rest: "healthy" | "unhealthy" | "unconfigured" | "reachable" | "unreachable";
    };
  };
  config: {
    isConfigured: boolean;
    hasUrl: boolean;
    hasAnonKey: boolean;
    hasServiceRoleKey: boolean;
    hostname?: string;
    supabaseUrl: string | null;
  };
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: "sharing" | "file_activity" | "sharing_changes" | "storage" | "security" | "announcement";
  title: string;
  message: string;
  relatedFileId?: string | null;
  relatedFolderId?: string | null;
  relatedUserId?: string | null;
  announcementType?: string | null;
  publishedAt?: string | null;
  expiresAt?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface ActivityLogItem {
  id: string;
  userId: string;
  action: "upload" | "download" | "create_folder" | "rename" | "move" | "trash" | "restore" | "permanent_delete" | "share" | "remove_share" | "create_link" | "delete_link" | "security";
  entityType: "file" | "folder" | "share" | "security" | "account";
  entityId?: string | null;
  entityName: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface NotificationPreferences {
  emailSharing: boolean;
  emailSecurity: boolean;
  emailStorage: boolean;
  inAppSharing: boolean;
  inAppFileActivity: boolean;
  inAppStorage: boolean;
}

export interface SupabaseConfigResponse {
  status: string;
  config: {
    isConfigured: boolean;
    hasUrl: boolean;
    hasAnonKey: boolean;
    hasServiceRoleKey: boolean;
    supabaseUrl: string | null;
  };
  security: {
    serviceRoleExposedToClient: boolean;
    anonKeySafeForClient: boolean;
    encryption: string;
  };
  timestamp: string;
}

