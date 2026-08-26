import React, { useState, useEffect } from "react";
import {
  fetchAdminAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "../../lib/api.js";
import {
  Megaphone,
  Plus,
  Trash2,
  Edit3,
  AlertTriangle,
  Info,
  CheckCircle,
  X,
  Search,
  Shield,
  Wrench,
  Sparkles,
  Save,
  Send,
  Calendar,
  Clock,
  Filter,
  Eye,
} from "lucide-react";

interface AdminAnnouncementsViewProps {
  token: string;
}

export type AnnouncementType = "info" | "success" | "warning" | "security" | "maintenance" | "feature";
export type AnnouncementStatus = "draft" | "published" | "scheduled" | "expired";

interface RecommendedTemplate {
  id: string;
  name: string;
  title: string;
  message: string;
  type: AnnouncementType;
  icon: React.ElementType;
}

const RECOMMENDED_TEMPLATES: RecommendedTemplate[] = [
  {
    id: "maint",
    name: "System Maintenance",
    title: "Scheduled System Maintenance",
    message:
      "CloudVault will undergo scheduled maintenance to improve system performance and reliability. During this period, some services may be temporarily unavailable. We apologize for any inconvenience.",
    type: "maintenance",
    icon: Wrench,
  },
  {
    id: "feature",
    name: "New Feature",
    title: "New Features Are Now Available",
    message:
      "We've added new features and improvements to CloudVault to make your file storage experience faster, simpler, and more secure. Explore the latest updates in your dashboard.",
    type: "feature",
    icon: Sparkles,
  },
  {
    id: "security",
    name: "Security Update",
    title: "Important Security Update",
    message:
      "We've made important security improvements to help keep your CloudVault account and files protected. Please make sure your account information and security settings are up to date.",
    type: "security",
    icon: Shield,
  },
  {
    id: "storage",
    name: "Storage Update",
    title: "Storage System Update",
    message:
      "CloudVault storage services have been updated to improve upload performance, reliability, and file management. Your existing files remain safe and available.",
    type: "info",
    icon: Info,
  },
  {
    id: "restored",
    name: "Service Restored",
    title: "Service Has Been Restored",
    message:
      "The CloudVault service is now operating normally. Thank you for your patience while we resolved the issue.",
    type: "success",
    icon: CheckCircle,
  },
  {
    id: "notice",
    name: "Important Notice",
    title: "Important Notice",
    message:
      "Please review this important CloudVault update. We recommend checking your account and dashboard for any actions that may require your attention.",
    type: "warning",
    icon: AlertTriangle,
  },
];

export function AdminAnnouncementsView({ token }: AdminAnnouncementsViewProps) {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<AnnouncementType>("info");
  const [status, setStatus] = useState<AnnouncementStatus>("draft");
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Templates section toggle in modal
  const [showTemplates, setShowTemplates] = useState(true);

  // Confirmation Modals
  const [publishConfirmItem, setPublishConfirmItem] = useState<any | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    loadAnnouncements();
  }, [token]);

  const loadAnnouncements = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminAnnouncements(token);
      if (res.success) {
        setAnnouncements(res.announcements || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load announcements");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNew = () => {
    setEditingId(null);
    setTitle("");
    setMessage("");
    setType("info");
    setStatus("draft");
    setExpiresAt("");
    setShowTemplates(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingId(item.id);
    setTitle(item.title);
    setMessage(item.message);
    setType(item.type || "info");
    setStatus(item.status || "draft");
    setExpiresAt(item.expires_at ? item.expires_at.split("T")[0] : "");
    setShowTemplates(false);
    setIsModalOpen(true);
  };

  const handleSelectTemplate = (template: RecommendedTemplate) => {
    setTitle(template.title);
    setMessage(template.message);
    setType(template.type);
    setShowTemplates(false);
  };

  const handleSaveDraft = async () => {
    if (!title || !message) {
      alert("Title and message are required to save a draft.");
      return;
    }
    await saveAnnouncement("draft");
  };

  const handleBroadcastClick = () => {
    if (!title || !message) {
      alert("Title and message are required.");
      return;
    }
    // Ask for confirmation
    setPublishConfirmItem({
      id: editingId,
      title,
      message,
      type,
      expiresAt,
    });
  };

  const saveAnnouncement = async (targetStatus: AnnouncementStatus) => {
    setSubmitting(true);
    try {
      const payload = {
        title,
        message,
        type,
        status: targetStatus,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      };

      if (editingId) {
        await updateAnnouncement(token, editingId, payload);
      } else {
        await createAnnouncement(token, payload);
      }

      setIsModalOpen(false);
      setPublishConfirmItem(null);
      loadAnnouncements();
    } catch (err: any) {
      alert(err.message || "Failed to save announcement");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishExistingDraft = async (item: any) => {
    setPublishConfirmItem(item);
  };

  const confirmPublish = async () => {
    if (!publishConfirmItem) return;
    if (publishConfirmItem.id && !isModalOpen) {
      // Direct publish from card action
      setSubmitting(true);
      try {
        await updateAnnouncement(token, publishConfirmItem.id, {
          status: "published",
        });
        setPublishConfirmItem(null);
        loadAnnouncements();
      } catch (err: any) {
        alert(err.message || "Failed to publish announcement");
      } finally {
        setSubmitting(false);
      }
    } else {
      // From modal form
      await saveAnnouncement("published");
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteAnnouncement(token, deleteConfirmId);
      setAnnouncements((prev) => prev.filter((a) => a.id !== deleteConfirmId));
      setDeleteConfirmId(null);
    } catch (err: any) {
      alert(err.message || "Failed to delete announcement");
    }
  };

  // Filtered list
  const filteredAnnouncements = announcements.filter((item) => {
    const matchesSearch =
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.message?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ? true : item.status?.toLowerCase() === statusFilter.toLowerCase();

    const matchesType =
      typeFilter === "all" ? true : item.type?.toLowerCase() === typeFilter.toLowerCase();

    return matchesSearch && matchesStatus && matchesType;
  });

  const getTypeBadge = (itemType: string) => {
    switch (itemType) {
      case "warning":
        return {
          label: "Warning",
          className: "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800",
          icon: AlertTriangle,
        };
      case "maintenance":
        return {
          label: "Maintenance",
          className: "bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 border-orange-200 dark:border-orange-800",
          icon: Wrench,
        };
      case "security":
        return {
          label: "Security",
          className: "bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-800",
          icon: Shield,
        };
      case "success":
        return {
          label: "Success",
          className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
          icon: CheckCircle,
        };
      case "feature":
        return {
          label: "Feature",
          className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
          icon: Sparkles,
        };
      default:
        return {
          label: "Info",
          className: "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-800",
          icon: Info,
        };
    }
  };

  const getStatusBadge = (itemStatus: string) => {
    switch (itemStatus) {
      case "published":
        return {
          label: "Published",
          className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
        };
      case "scheduled":
        return {
          label: "Scheduled",
          className: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
        };
      case "expired":
        return {
          label: "Expired",
          className: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
        };
      default:
        return {
          label: "Draft",
          className: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">System Announcements</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Broadcast platform updates, system maintenance alerts, and security notices to CloudVault users.
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Announcement</span>
        </button>
      </div>

      {/* Recommended Templates Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Recommended Announcements
          </h4>
          <span className="text-[11px] text-slate-400">Click a template to quickly pre-fill form</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {RECOMMENDED_TEMPLATES.map((tmpl) => {
            const Icon = tmpl.icon;
            return (
              <div
                key={tmpl.id}
                onClick={() => {
                  handleOpenNew();
                  handleSelectTemplate(tmpl);
                }}
                className="group relative p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all cursor-pointer shadow-2xs hover:shadow-md flex flex-col justify-between space-y-2"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      <Icon className="w-4 h-4 text-blue-500 shrink-0" />
                      {tmpl.name}
                    </span>
                    <span className="text-[10px] text-slate-400 group-hover:text-blue-500 font-medium transition-colors">
                      Use Template →
                    </span>
                  </div>
                  <h5 className="font-semibold text-xs text-slate-900 dark:text-white line-clamp-1">
                    {tmpl.title}
                  </h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                    {tmpl.message}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search & Filtering Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search announcements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Drafts</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
            <option value="expired">Expired</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="security">Security</option>
            <option value="maintenance">Maintenance</option>
            <option value="feature">Feature</option>
          </select>
        </div>
      </div>

      {/* Announcements List */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm">Loading announcements...</div>
      ) : error ? (
        <div className="p-6 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 rounded-2xl text-sm">
          {error}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAnnouncements.length === 0 ? (
            <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
              No announcements match the selected filter or search query.
            </div>
          ) : (
            filteredAnnouncements.map((item) => {
              const typeBadge = getTypeBadge(item.type);
              const statusBadge = getStatusBadge(item.status);
              const TypeIcon = typeBadge.icon;

              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-start justify-between gap-4"
                >
                  <div className="space-y-2.5 max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${typeBadge.className}`}
                      >
                        <TypeIcon className="w-3 h-3" />
                        {typeBadge.label}
                      </span>

                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusBadge.className}`}
                      >
                        {statusBadge.label}
                      </span>

                      {item.created_at && (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Created: {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      )}

                      {item.expires_at && (
                        <span className="text-[11px] text-rose-500 dark:text-rose-400 flex items-center gap-1 font-medium">
                          <Calendar className="w-3 h-3" />
                          Expires: {new Date(item.expires_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{item.title}</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                      {item.message}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-start shrink-0 pt-2 md:pt-0">
                    {item.status === "draft" && (
                      <button
                        onClick={() => handlePublishExistingDraft(item)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        title="Publish Announcement"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Publish</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-2 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Edit Announcement"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setDeleteConfirmId(item.id)}
                      className="p-2 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Delete Announcement"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Main Create/Edit Announcement Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {editingId ? "Edit Announcement" : "Create Announcement"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template Selector Inside Modal */}
            {!editingId && (
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Recommended Announcement Templates
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowTemplates(!showTemplates)}
                    className="text-[11px] text-blue-600 dark:text-blue-400 font-medium hover:underline cursor-pointer"
                  >
                    {showTemplates ? "Hide Templates" : "Show Templates"}
                  </button>
                </div>

                {showTemplates && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {RECOMMENDED_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => handleSelectTemplate(tmpl)}
                        className="text-left p-2.5 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-all cursor-pointer group"
                      >
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {tmpl.name}
                        </div>
                        <div className="text-[10px] text-slate-400 line-clamp-1">{tmpl.title}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Announcement Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Scheduled System Maintenance"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Message <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter detailed broadcast message for CloudVault users..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Announcement Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as AnnouncementType)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs border border-slate-200 dark:border-slate-700 focus:outline-none"
                  >
                    <option value="info">Info</option>
                    <option value="success">Success</option>
                    <option value="warning">Warning</option>
                    <option value="security">Security</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="feature">Feature</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AnnouncementStatus)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs border border-slate-200 dark:border-slate-700 focus:outline-none"
                  >
                    <option value="draft">Draft (Private)</option>
                    <option value="published">Published (Visible to Users)</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Expiration Date (Optional)
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs border border-slate-200 dark:border-slate-700 focus:outline-none"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSaveDraft}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Draft</span>
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleBroadcastClick}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Broadcast</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Publish/Broadcast */}
      {publishConfirmItem && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-60">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
              <div className="p-2.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white">Publish Announcement?</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This announcement will immediately become visible to CloudVault users in their dashboard and notifications.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {publishConfirmItem.title}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                {publishConfirmItem.message}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPublishConfirmItem(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={confirmPublish}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {submitting ? "Publishing..." : "Confirm & Broadcast"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Delete */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-60">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 rounded-full bg-rose-100 dark:bg-rose-950/60">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white">Delete Announcement?</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Are you sure you want to delete this announcement? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
