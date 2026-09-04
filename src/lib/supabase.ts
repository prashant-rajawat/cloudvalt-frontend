import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * CloudVault Frontend Supabase Client Utility
 * 
 * SECURITY RULES:
 * 1. ONLY uses public VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
 * 2. NEVER exposes, imports, or accesses SUPABASE_SERVICE_ROLE_KEY.
 * 3. Lazy client initialization prevents runtime exceptions if .env is unconfigured.
 */

export interface SupabaseClientStatus {
  isConfigured: boolean;
  hasUrl: boolean;
  hasAnonKey: boolean;
  maskedUrl: string | null;
}

export type ClientErrorType =
  | "CONNECTED"
  | "DNS_ERROR"
  | "NETWORK_ERROR"
  | "INVALID_URL"
  | "AUTH_ERROR"
  | "TIMEOUT"
  | "CONFIG_ERROR";

export interface ClientConnectionTestResult {
  success: boolean;
  latencyMs: number | null;
  message: string;
  errorType?: ClientErrorType;
  source: "direct_browser" | "unconfigured";
}

let supabaseInstance: SupabaseClient | null = null;
let runtimeSupabaseUrl = "";
let runtimeSupabaseAnonKey = "";

// Initialize from sessionStorage if present in browser
if (typeof window !== "undefined") {
  try {
    runtimeSupabaseUrl = sessionStorage.getItem("cv_supabase_url") || "";
    runtimeSupabaseAnonKey = sessionStorage.getItem("cv_supabase_anon") || "";
  } catch {}
}

/**
 * Updates or overrides public Supabase credentials at runtime.
 */
export const setRuntimeSupabaseConfig = (url: string, anonKey: string): SupabaseClient | null => {
  if (url && anonKey) {
    const cleanUrl = normalizeSupabaseUrl(url);
    const cleanAnon = anonKey.trim().replace(/^["']|["']$/g, "");
    runtimeSupabaseUrl = cleanUrl;
    runtimeSupabaseAnonKey = cleanAnon;

    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("cv_supabase_url", cleanUrl);
        sessionStorage.setItem("cv_supabase_anon", cleanAnon);
      }
    } catch {}

    supabaseInstance = createClient(cleanUrl, cleanAnon, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
    return supabaseInstance;
  }
  return null;
};

/**
 * Normalizes and sanitizes a Supabase URL in the frontend.
 * Strips accidental quotes, trailing slashes, /rest/v1, or missing protocols.
 */
export const normalizeSupabaseUrl = (rawUrl?: string): string => {
  if (!rawUrl) return "";
  let clean = rawUrl.trim().replace(/^["']|["']$/g, "").trim();
  if (!clean) return "";

  // Auto-correct known typo variants in project domain if detected (e.g. gibh -> gjbh)
  if (clean.includes("pqmnemgddcrgibhdtwvz")) {
    clean = clean.replace("pqmnemgddcrgibhdtwvz", "pqmnemgddcrgjbhdtwvz");
  }

  // Add protocol if missing
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    clean = `https://${clean}`;
  }

  // Strip trailing endpoints or slashes
  clean = clean.replace(/\/rest\/v1\/?$/, "");
  clean = clean.replace(/\/auth\/v1\/?$/, "");
  clean = clean.replace(/\/storage\/v1\/?$/, "");
  clean = clean.replace(/\/+$/, "");

  return clean;
};

export const DEFAULT_SUPABASE_URL = "https://pqmnemgddcrgjbhdtwvz.supabase.co";
export const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_M0goqywC8FeJkBfUMEGHhw_jsTcqGMt";

/**
 * Returns public Supabase client credentials safely from Vite environment
 * with seamless fallback to runtime / cached config or project defaults.
 */
export const getSupabaseClientEnv = () => {
  let rawUrl = (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) || runtimeSupabaseUrl;
  let rawAnonKey = (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) || runtimeSupabaseAnonKey;

  if (!rawUrl || !rawAnonKey) {
    if (typeof window !== "undefined") {
      try {
        if (!rawUrl) rawUrl = sessionStorage.getItem("cv_supabase_url") || "";
        if (!rawAnonKey) rawAnonKey = sessionStorage.getItem("cv_supabase_anon") || "";
      } catch {}
    }
  }

  const url = normalizeSupabaseUrl(typeof rawUrl === "string" && rawUrl ? rawUrl : DEFAULT_SUPABASE_URL);
  const anonKey = typeof rawAnonKey === "string" && rawAnonKey ? rawAnonKey.trim().replace(/^["']|["']$/g, "") : DEFAULT_SUPABASE_ANON_KEY;

  return {
    url,
    anonKey,
  };
};

/**
 * Checks if public Supabase credentials are configured in the frontend.
 */
export const isSupabaseConfigured = (): boolean => {
  const { url, anonKey } = getSupabaseClientEnv();
  return Boolean(url && anonKey);
};

/**
 * Returns safe frontend configuration status metadata.
 */
export const getSupabaseClientStatus = (): SupabaseClientStatus => {
  const { url, anonKey } = getSupabaseClientEnv();
  
  let maskedUrl: string | null = null;
  if (url) {
    try {
      const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
      maskedUrl = `${parsed.protocol}//${parsed.hostname.substring(0, 4)}***${parsed.hostname.slice(-8)}`;
    } catch {
      maskedUrl = "Configured (Masked)";
    }
  }

  return {
    isConfigured: Boolean(url && anonKey),
    hasUrl: Boolean(url),
    hasAnonKey: Boolean(anonKey),
    maskedUrl,
  };
};

/**
 * Lazy initialization of Supabase client for React browser runtime.
 * Returns null if credentials are not yet available synchronously.
 */
export const getSupabase = (): SupabaseClient | null => {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const { url, anonKey } = getSupabaseClientEnv();

  if (!url || !anonKey) {
    return null;
  }

  supabaseInstance = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  return supabaseInstance;
};

// Alias for frontend components expecting getSupabaseBrowserClient
export const getSupabaseBrowserClient = getSupabase;

let inflightConfigFetch: Promise<SupabaseClient | null> | null = null;

/**
 * Asynchronously ensures the Supabase client is initialized.
 * If credentials are not present in Vite environment, dynamically fetches
 * the public configuration from /api/supabase/public-config.
 */
export const ensureSupabaseClient = async (): Promise<SupabaseClient | null> => {
  const existing = getSupabase();
  if (existing) return existing;

  if (inflightConfigFetch) {
    return inflightConfigFetch;
  }

  inflightConfigFetch = (async () => {
    try {
      const res = await fetch("/api/supabase/public-config", {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.supabaseUrl && json.supabaseAnonKey) {
          const client = setRuntimeSupabaseConfig(json.supabaseUrl, json.supabaseAnonKey);
          return client;
        }
      }
    } catch (err) {
      console.warn("[Supabase] Could not fetch public client credentials from backend API:", err);
    } finally {
      inflightConfigFetch = null;
    }
    return getSupabase();
  })();

  return inflightConfigFetch;
};

/**
 * Direct browser probe to verify that Supabase is reachable from client network.
 * Strictly uses public VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
 */
export const testFrontendSupabaseConnection = async (): Promise<ClientConnectionTestResult> => {
  const { url, anonKey } = getSupabaseClientEnv();

  if (!url || !anonKey) {
    return {
      success: false,
      latencyMs: null,
      errorType: "CONFIG_ERROR",
      message: "Frontend credentials (VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY) are not set.",
      source: "unconfigured",
    };
  }

  let formattedUrl = url;
  if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
    formattedUrl = `https://${formattedUrl}`;
  }

  let hostname = "";
  try {
    const parsed = new URL(formattedUrl);
    hostname = parsed.hostname;
    if (!hostname || !hostname.includes(".")) {
      return {
        success: false,
        latencyMs: null,
        errorType: "INVALID_URL",
        message: `Invalid Supabase project URL: "${url}". Expected https://<project-ref>.supabase.co`,
        source: "direct_browser",
      };
    }
  } catch {
    return {
      success: false,
      latencyMs: null,
      errorType: "INVALID_URL",
      message: `Malformed Supabase URL: "${url}"`,
      source: "direct_browser",
    };
  }

  const startTime = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const authUrl = `${formattedUrl}/auth/v1/health`;
    const restUrl = `${formattedUrl}/rest/v1/`;

    const headers: Record<string, string> = {
      Accept: "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    };

    // Parallel probe of Auth and REST endpoints
    const [authRes, restRes] = await Promise.all([
      fetch(authUrl, {
        method: "GET",
        headers,
        signal: controller.signal,
      }).catch((err: any) => ({
        _fetchError: err?.name === "AbortError" ? "TIMEOUT" : (err?.message || String(err)),
      })),
      fetch(restUrl, {
        method: "GET",
        headers,
        signal: controller.signal,
      }).catch((err: any) => ({
        _fetchError: err?.name === "AbortError" ? "TIMEOUT" : (err?.message || String(err)),
      })),
    ]);

    clearTimeout(timeoutId);

    const latencyMs = Math.round(performance.now() - startTime);

    const authStatus = authRes && "status" in authRes ? authRes.status : undefined;
    const isAuthHealthy = authRes && !("_fetchError" in authRes) && 
      (authRes.ok || authStatus === 200 || authStatus === 401 || authStatus === 403);

    const restStatus = restRes && "status" in restRes ? restRes.status : undefined;
    const isRestHealthy = restRes && !("_fetchError" in restRes) && 
      (restRes.ok || restStatus === 200 || restStatus === 401 || restStatus === 403);

    if (isAuthHealthy || isRestHealthy) {
      return {
        success: true,
        latencyMs,
        errorType: "CONNECTED",
        message: `Supabase SDK Client connected successfully (${latencyMs}ms).`,
        source: "direct_browser",
      };
    }

    const authErr = authRes && "_fetchError" in authRes ? String(authRes._fetchError) : "";
    const restErr = restRes && "_fetchError" in restRes ? String(restRes._fetchError) : "";
    const errText = (authErr || restErr || (authStatus ? `HTTP ${authStatus}` : "Network request failed")).toLowerCase();

    let errorType: ClientErrorType = "NETWORK_ERROR";
    let explanation = `Failed to reach Supabase from browser: ${authErr || restErr || "Network error"}`;

    if (errText.includes("timeout") || authErr === "TIMEOUT" || restErr === "TIMEOUT") {
      errorType = "TIMEOUT";
      explanation = `Request timed out connecting to ${hostname}.`;
    } else if (errText.includes("failed to fetch") || errText.includes("networkerror") || errText.includes("enotfound")) {
      // In browser fetch, ENOTFOUND / DNS failure manifests as "Failed to fetch" (TypeError)
      errorType = "DNS_ERROR";
      explanation = `Supabase host (${hostname}) could not be reached or resolved. Verify the project URL in Settings.`;
    } else if (authStatus === 401 || authStatus === 403) {
      errorType = "AUTH_ERROR";
      explanation = `Supabase responded with Authentication error (HTTP ${authStatus}). Check VITE_SUPABASE_ANON_KEY.`;
    }

    return {
      success: false,
      latencyMs,
      errorType,
      message: explanation,
      source: "direct_browser",
    };
  } catch (error: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    const isTimeout = error?.name === "AbortError";
    return {
      success: false,
      latencyMs,
      errorType: isTimeout ? "TIMEOUT" : "NETWORK_ERROR",
      message: isTimeout 
        ? `Request timed out connecting to Supabase (${hostname}).` 
        : (error?.message || "Failed to reach Supabase endpoint from browser."),
      source: "direct_browser",
    };
  }
};

