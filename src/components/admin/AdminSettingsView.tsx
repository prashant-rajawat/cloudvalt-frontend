import React, { useState, useEffect } from "react";
import { fetchAdminSettings, updateAdminSettings } from "../../lib/api.js";
import { Settings, Save, AlertTriangle, ShieldCheck } from "lucide-react";

interface AdminSettingsViewProps {
  token: string;
}

export function AdminSettingsView({ token }: AdminSettingsViewProps) {
  const [settings, setSettings] = useState<any>({
    default_user_quota_bytes: 5368709120,
    max_upload_size_bytes: 1073741824,
    maintenance_mode: false,
    allow_public_shares: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, [token]);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminSettings(token);
      if (res.success && res.settings) {
        setSettings((prev: any) => ({ ...prev, ...res.settings }));
      }
    } catch (err: any) {
      setError(err.message || "Failed to load system settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMessage(null);
    setError(null);

    try {
      await updateAdminSettings(token, settings);
      setSavedMessage("System configuration updated successfully!");
      setTimeout(() => setSavedMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-slate-500 text-sm">Loading system settings...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-2xl text-blue-600">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">System Management Settings</h3>
            <p className="text-xs text-slate-500">Configure global quotas, maintenance windows, and security features.</p>
          </div>
        </div>
      </div>

      {savedMessage && (
        <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl text-xs font-semibold">
          {savedMessage}
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 text-rose-800 border border-rose-200 rounded-2xl text-xs font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-6">
        {/* Maintenance Mode Toggle */}
        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="font-bold text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" /> Maintenance Mode
            </div>
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              When enabled, normal user access is restricted. Administrators retain full access.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={Boolean(settings.maintenance_mode)}
              onChange={(e) => setSettings({ ...settings, maintenance_mode: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-slate-600 peer-checked:bg-amber-600"></div>
          </label>
        </div>

        {/* Public Sharing Setting */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600" /> Allow Public Link Generation
            </div>
            <p className="text-[11px] text-slate-500">
              Permit users to generate public downloadable share links for files/folders.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={Boolean(settings.allow_public_shares)}
              onChange={(e) => setSettings({ ...settings, allow_public_shares: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-slate-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Default Quota */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Default User Storage Quota (GB)
          </label>
          <input
            type="number"
            min="1"
            max="1024"
            value={Math.round((settings.default_user_quota_bytes || 5368709120) / (1024 * 1024 * 1024))}
            onChange={(e) =>
              setSettings({
                ...settings,
                default_user_quota_bytes: Number(e.target.value) * 1024 * 1024 * 1024,
              })
            }
            className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:outline-hidden"
          />
          <span className="text-[11px] text-slate-400 mt-1 block">New user signups will automatically receive this quota.</span>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving Changes..." : "Save System Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
