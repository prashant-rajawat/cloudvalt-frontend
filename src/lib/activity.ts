import { getSupabaseBrowserClient } from "./supabase.js";
import { ActivityLogItem } from "../types/index.js";

const LOCAL_STORAGE_KEY = "cloudvault_activity_logs_v1";

function getLocalActivityLogs(userId: string): ActivityLogItem[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalActivityLogs(userId: string, items: ActivityLogItem[]) {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_${userId}`, JSON.stringify(items));
  } catch (e) {
    console.warn("Failed to save local activity logs:", e);
  }
}

/**
 * Fetch activity logs for current user
 */
export async function fetchUserActivityLogs(userId: string): Promise<ActivityLogItem[]> {
  const supabase = getSupabaseBrowserClient();
  let dbItems: ActivityLogItem[] = [];
  let dbFailed = false;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        dbItems = data.map((row: any) => ({
          id: row.id,
          userId: row.user_id,
          action: row.action || "upload",
          entityType: row.entity_type || "file",
          entityId: row.entity_id || null,
          entityName: row.entity_name || "Item",
          metadata: row.metadata || {},
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

  const localItems = getLocalActivityLogs(userId);
  if (dbFailed) {
    return localItems;
  }

  const map = new Map<string, ActivityLogItem>();
  for (const item of [...dbItems, ...localItems]) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  const merged = Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  saveLocalActivityLogs(userId, merged);
  return merged;
}

/**
 * Log a user activity
 */
export async function logUserActivity(
  userId: string,
  action: ActivityLogItem["action"],
  entityType: ActivityLogItem["entityType"],
  entityName: string,
  entityId?: string | null,
  metadata?: Record<string, any>
): Promise<ActivityLogItem> {
  const newItem: ActivityLogItem = {
    id: crypto.randomUUID(),
    userId,
    action,
    entityType,
    entityId: entityId || null,
    entityName: entityName || "Unknown Item",
    metadata: metadata || {},
    createdAt: new Date().toISOString(),
  };

  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    try {
      await supabase.from("activity_logs").insert({
        id: newItem.id,
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId || null,
        entity_name: entityName,
        metadata: metadata || {},
        created_at: newItem.createdAt,
      });
    } catch (e) {
      console.warn("Could not insert activity log into DB:", e);
    }
  }

  const current = getLocalActivityLogs(userId);
  const updated = [newItem, ...current];
  saveLocalActivityLogs(userId, updated);

  return newItem;
}
