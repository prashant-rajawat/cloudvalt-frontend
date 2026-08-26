import { getSupabaseBrowserClient } from "./supabase.js";
import { NotificationItem } from "../types/index.js";
import { fetchActiveAnnouncements } from "./api.js";

const LOCAL_STORAGE_KEY = "cloudvault_notifications_v1";

function getLocalNotifications(userId: string): NotificationItem[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalNotifications(userId: string, items: NotificationItem[]) {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_${userId}`, JSON.stringify(items));
  } catch (e) {
    console.warn("Failed to save local notifications:", e);
  }
}

/**
 * Fetch notifications for current user from Supabase + Active System Announcements
 */
export async function fetchUserNotifications(userId: string): Promise<NotificationItem[]> {
  const supabase = getSupabaseBrowserClient();
  let dbItems: NotificationItem[] = [];
  let dbFailed = false;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        dbItems = data.map((row: any) => ({
          id: row.id,
          userId: row.user_id,
          type: row.type || "file_activity",
          title: row.title || "Notification",
          message: row.message || "",
          relatedFileId: row.related_file_id || null,
          relatedFolderId: row.related_folder_id || null,
          relatedUserId: row.related_user_id || null,
          isRead: Boolean(row.is_read),
          createdAt: row.created_at || new Date().toISOString(),
        }));
      } else {
        dbFailed = true;
      }
    } catch {
      dbFailed = true;
    }
  } else {
    dbFailed = true;
  }

  // Merge with local notifications
  const localItems = getLocalNotifications(userId);
  const localMap = new Map<string, NotificationItem>();
  for (const item of localItems) {
    localMap.set(item.id, item);
  }

  // Fetch published active announcements
  let announcementItems: NotificationItem[] = [];
  try {
    const annRes = await fetchActiveAnnouncements();
    if (annRes.success && Array.isArray(annRes.announcements)) {
      const now = new Date();
      announcementItems = annRes.announcements
        .filter((a: any) => a.status === "published" && (!a.expires_at || new Date(a.expires_at) > now))
        .map((a: any) => {
          const id = `announcement_${a.id}`;
          const existingLocal = localMap.get(id);
          return {
            id,
            userId,
            type: "announcement" as const,
            title: a.title,
            message: a.message,
            announcementType: a.type || "info",
            publishedAt: a.published_at || a.created_at,
            expiresAt: a.expires_at || null,
            isRead: existingLocal ? existingLocal.isRead : false,
            createdAt: a.published_at || a.created_at || new Date().toISOString(),
          };
        });
    }
  } catch (err) {
    console.warn("Could not fetch active announcements for notifications:", err);
  }

  // Combine DB, Local, and Announcement items (dedup by ID)
  const map = new Map<string, NotificationItem>();
  for (const item of [...announcementItems, ...(dbFailed ? localItems : dbItems), ...localItems]) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }

  const merged = Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  saveLocalNotifications(userId, merged);
  return merged;
}

/**
 * Create a new notification for a user
 */
export async function createNotification(
  userId: string,
  type: "sharing" | "file_activity" | "sharing_changes" | "storage" | "security",
  title: string,
  message: string,
  relatedFileId?: string | null,
  relatedFolderId?: string | null,
  relatedUserId?: string | null
): Promise<NotificationItem> {
  const newNotif: NotificationItem = {
    id: crypto.randomUUID(),
    userId,
    type,
    title,
    message,
    relatedFileId: relatedFileId || null,
    relatedFolderId: relatedFolderId || null,
    relatedUserId: relatedUserId || null,
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    try {
      await supabase.from("notifications").insert({
        id: newNotif.id,
        user_id: userId,
        type,
        title,
        message,
        related_file_id: relatedFileId || null,
        related_folder_id: relatedFolderId || null,
        related_user_id: relatedUserId || null,
        is_read: false,
        created_at: newNotif.createdAt,
      });
    } catch (e) {
      console.warn("Could not insert notification into DB:", e);
    }
  }

  // Save to local storage
  const current = getLocalNotifications(userId);
  const updated = [newNotif, ...current];
  saveLocalNotifications(userId, updated);

  return newNotif;
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(userId: string, notifId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notifId)
        .eq("user_id", userId);
    } catch (e) {
      console.warn("Could not update notification in DB:", e);
    }
  }

  const current = getLocalNotifications(userId);
  const updated = current.map((item) => (item.id === notifId ? { ...item, isRead: true } : item));
  saveLocalNotifications(userId, updated);
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);
    } catch (e) {
      console.warn("Could not mark all read in DB:", e);
    }
  }

  const current = getLocalNotifications(userId);
  const updated = current.map((item) => ({ ...item, isRead: true }));
  saveLocalNotifications(userId, updated);
}
