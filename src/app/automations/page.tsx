"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import AIAutomationsTab from "@/components/AIAutomationsTab";

interface Project {
  id: string;
  name: string;
  color: string;
}

interface TeamMember {
  id: string;
  nick: string;
  role: string;
}

interface Automation {
  id: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  taskName: string;
  description: string | null;
  recurrence: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  skipIfExists: boolean;
  enabled: boolean;
  ownerId: string | null;
  ownerNick: string | null;
}

type Tab = "task" | "ai";

export default function AutomationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("task");
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // Default owner setting
  const [defaultOwnerId, setDefaultOwnerId] = useState<string | null>(null);
  const [savingDefault, setSavingDefault] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [form, setForm] = useState({
    projectId: "",
    taskName: "",
    description: "",
    recurrence: "weekly" as string,
    dayOfWeek: null as number | null,
    dayOfMonth: null as number | null,
    skipIfExists: true,
    enabled: true,
    ownerId: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [autoRes, projRes, teamRes, settingsRes] = await Promise.all([
        fetch("/api/automations"),
        fetch("/api/projects"),
        fetch("/api/team"),
        fetch("/api/settings"),
      ]);
      const [autoJson, projJson, teamJson, settingsJson] = await Promise.all([
        autoRes.json(),
        projRes.json(),
        teamRes.json(),
        settingsRes.json(),
      ]);

      setAutomations(autoJson.data || []);
      setProjects(projJson.data || []);
      setTeamMembers(teamJson.data || []);
      setDefaultOwnerId(settingsJson.data?.defaultOwnerId || null);
    } catch {
      showToast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ── Save default owner ──
  const handleSaveDefaultOwner = async (ownerId: string | null) => {
    setSavingDefault(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultOwnerId: ownerId || null }),
      });
      setDefaultOwnerId(ownerId);
      showToast("Default owner updated", "success");
    } catch {
      showToast("Failed to update default owner", "error");
    } finally {
      setSavingDefault(false);
    }
  };

  // ── Open modal ──
  const openCreate = () => {
    setEditingAutomation(null);
    setForm({
      projectId: "",
      taskName: "",
      description: "",
      recurrence: "weekly",
      dayOfWeek: 1, // Default to Monday
      dayOfMonth: 1, // Default to 1st
      skipIfExists: true,
      enabled: true,
      ownerId: defaultOwnerId || "",
    });
    setModalOpen(true);
  };

  const openEdit = (auto: Automation) => {
    setEditingAutomation(auto);
    setForm({
      projectId: auto.projectId,
      taskName: auto.taskName,
      description: auto.description || "",
      recurrence: auto.recurrence,
      dayOfWeek: auto.dayOfWeek,
      dayOfMonth: auto.dayOfMonth,
      skipIfExists: auto.skipIfExists,
      enabled: auto.enabled,
      ownerId: auto.ownerId || "",
    });
    setModalOpen(true);
  };

  // ── Save automation ──
  const handleSave = async () => {
    if (!form.projectId || !form.taskName.trim() || !form.recurrence) {
      showToast("Project, task name, and recurrence are required", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        ownerId: form.ownerId || null,
      };

      if (editingAutomation) {
        await fetch("/api/automations", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingAutomation.id, ...payload }),
        });
        showToast("Automation updated", "success");
      } else {
        await fetch("/api/automations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        showToast("Automation created", "success");
      }
      setModalOpen(false);
      await fetchData();
    } catch {
      showToast("Failed to save automation", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete automation ──
  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/automations?id=${id}`, { method: "DELETE" });
      showToast("Automation deleted", "success");
      await fetchData();
    } catch {
      showToast("Failed to delete", "error");
    }
  };

  // ── Toggle enabled ──
  const handleToggleEnabled = async (auto: Automation) => {
    try {
      await fetch("/api/automations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: auto.id, enabled: !auto.enabled }),
      });
      await fetchData();
    } catch {
      showToast("Failed to toggle", "error");
    }
  };

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-primary">Automations</h1>
      </div>

      {/* Tab Bar */}
      <div
        className="flex gap-0 mb-6 border-b"
        style={{ borderColor: "var(--border-default, #2a2d3a)" }}
      >
        <button
          onClick={() => setActiveTab("task")}
          className="px-4 py-2.5 text-sm font-medium transition-colors relative"
          style={{
            color: activeTab === "task" ? "#4f6ff5" : "#9a9eb5",
            borderBottom: activeTab === "task" ? "2px solid #4f6ff5" : "2px solid transparent",
            marginBottom: "-1px",
          }}
        >
          Task Automations
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          className="px-4 py-2.5 text-sm font-medium transition-colors relative"
          style={{
            color: activeTab === "ai" ? "#a78bfa" : "#9a9eb5",
            borderBottom: activeTab === "ai" ? "2px solid #a78bfa" : "2px solid transparent",
            marginBottom: "-1px",
          }}
        >
          AI Automations
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "ai" ? (
        <AIAutomationsTab />
      ) : (
        <>
          {/* Default Owner Setting */}
          <div className="card p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-primary">Default Task Owner</p>
                <p className="text-xs text-muted mt-1">
                  All new tasks will be assigned to this person by default
                </p>
              </div>
              <select
                className="input-field"
                style={{ width: "200px" }}
                value={defaultOwnerId || ""}
                onChange={(e) => handleSaveDefaultOwner(e.target.value || null)}
                disabled={savingDefault}
              >
                <option value="">Unassigned</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nick} — {m.role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* + New Automation button */}
          <div className="flex justify-end mb-4">
            <button className="btn-primary" onClick={openCreate}>
              + New Automation
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-secondary text-sm">Loading...</p>
            </div>
          ) : automations.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-muted text-sm mb-3">No automations yet.</p>
              <button className="btn-primary" onClick={openCreate}>
                Create your first automation
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {automations.map((auto) => (
                <div
                  key={auto.id}
                  className="card p-4 flex items-center gap-4"
                  style={{
                    borderLeft: `3px solid ${auto.projectColor}`,
                    opacity: auto.enabled ? 1 : 0.5,
                  }}
                >
                  {/* Enable/Disable Toggle */}
                  <button
                    onClick={() => handleToggleEnabled(auto)}
                    className="w-10 h-5 rounded-full transition-colors relative flex-shrink-0"
                    style={{ backgroundColor: auto.enabled ? "#4f6ff5" : "#2a2d3a" }}
                    title={auto.enabled ? "Enabled" : "Disabled"}
                  >
                    <div
                      className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                      style={{ left: auto.enabled ? "22px" : "2px" }}
                    />
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-primary text-sm font-medium">{auto.taskName}</p>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs"
                        style={{ backgroundColor: "#1e2130", color: "#9a9eb5" }}
                      >
                        {auto.projectName}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs"
                        style={{ backgroundColor: "#1e2130", color: "#fbbf24" }}
                      >
                        ↻ {auto.recurrence}
                        {auto.recurrence === "weekly" && auto.dayOfWeek !== null &&
                          ` · ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][auto.dayOfWeek]}`
                        }
                        {auto.recurrence === "monthly" && auto.dayOfMonth !== null &&
                          ` · ${auto.dayOfMonth}${["th", "st", "nd", "rd"][auto.dayOfMonth % 10 > 3 ? 0 : auto.dayOfMonth % 10]}`
                        }
                      </span>
                      {auto.skipIfExists && (
                        <span
                          className="px-2 py-0.5 rounded-full text-xs"
                          style={{ backgroundColor: "rgba(52,211,153,0.12)", color: "#34d399" }}
                        >
                          Skip if exists
                        </span>
                      )}
                    </div>
                    {auto.description && (
                      <p className="text-muted text-xs">{auto.description}</p>
                    )}
                    {auto.ownerNick && (
                      <p className="text-secondary text-xs mt-1">Owner: {auto.ownerNick}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button className="btn-ghost text-xs" onClick={() => openEdit(auto)}>
                      Edit
                    </button>
                    <button
                      className="btn-danger text-xs"
                      onClick={() => handleDelete(auto.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Execution Instructions */}
          <div className="card p-4 mt-6 bg-secondary">
            <p className="text-sm font-semibold text-primary mb-2">
              How to run automations
            </p>
            <p className="text-xs text-secondary mb-2">
              Set up an external cron job (e.g., cron-job.org) to call this endpoint daily:
            </p>
            <code
              className="block px-3 py-2 rounded text-xs bg-tertiary"
              style={{ color: "#34d399" }}
            >
              POST {typeof window !== "undefined" ? window.location.origin : ""}/api/automations/execute
            </code>
            <p className="text-xs text-muted mt-2">
              This will check all enabled automations and create tasks as needed.
            </p>
          </div>

          {/* ── Create / Edit Modal ── */}
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title={editingAutomation ? "Edit Automation" : "New Automation"}
          >
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted mb-1 block">Project</label>
                <select
                  className="input-field"
                  value={form.projectId}
                  onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                >
                  <option value="">Select a project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-muted mb-1 block">Task Name</label>
                <input
                  className="input-field"
                  placeholder="e.g. Check for non-bugged SRs"
                  value={form.taskName}
                  onChange={(e) => setForm({ ...form, taskName: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs text-muted mb-1 block">
                  Description (optional)
                </label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="What does this task involve?"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs text-muted mb-1 block">Recurrence</label>
                <select
                  className="input-field"
                  value={form.recurrence}
                  onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>

              {/* Day of Week selector (for weekly) */}
              {form.recurrence === "weekly" && (
                <div>
                  <label className="text-xs text-muted mb-1 block">Day of Week</label>
                  <select
                    className="input-field"
                    value={form.dayOfWeek !== null ? form.dayOfWeek : ""}
                    onChange={(e) =>
                      setForm({ ...form, dayOfWeek: e.target.value ? parseInt(e.target.value) : null })
                    }
                  >
                    <option value="">Any day</option>
                    <option value="0">Sunday</option>
                    <option value="1">Monday</option>
                    <option value="2">Tuesday</option>
                    <option value="3">Wednesday</option>
                    <option value="4">Thursday</option>
                    <option value="5">Friday</option>
                    <option value="6">Saturday</option>
                  </select>
                </div>
              )}

              {/* Day of Month selector (for monthly) */}
              {form.recurrence === "monthly" && (
                <div>
                  <label className="text-xs text-muted mb-1 block">Day of Month</label>
                  <select
                    className="input-field"
                    value={form.dayOfMonth !== null ? form.dayOfMonth : ""}
                    onChange={(e) =>
                      setForm({ ...form, dayOfMonth: e.target.value ? parseInt(e.target.value) : null })
                    }
                  >
                    <option value="">1st of the month</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs text-muted mb-1 block">Owner (optional)</label>
                <select
                  className="input-field"
                  value={form.ownerId}
                  onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nick} — {m.role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Skip if exists toggle */}
              <div
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ backgroundColor: "#1e2130" }}
              >
                <div>
                  <p className="text-sm text-primary font-medium">
                    Skip if task already exists
                  </p>
                  <p className="text-xs text-muted">
                    Don't create if a pending task with the same name exists
                  </p>
                </div>
                <button
                  onClick={() =>
                    setForm({ ...form, skipIfExists: !form.skipIfExists })
                  }
                  className="w-10 h-5 rounded-full transition-colors relative"
                  style={{
                    backgroundColor: form.skipIfExists ? "#4f6ff5" : "#2a2d3a",
                  }}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                    style={{ left: form.skipIfExists ? "22px" : "2px" }}
                  />
                </button>
              </div>

              {/* Enabled toggle */}
              <div
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ backgroundColor: "#1e2130" }}
              >
                <div>
                  <p className="text-sm text-primary font-medium">Enabled</p>
                  <p className="text-xs text-muted">
                    Only enabled automations will run
                  </p>
                </div>
                <button
                  onClick={() => setForm({ ...form, enabled: !form.enabled })}
                  className="w-10 h-5 rounded-full transition-colors relative"
                  style={{ backgroundColor: form.enabled ? "#4f6ff5" : "#2a2d3a" }}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                    style={{ left: form.enabled ? "22px" : "2px" }}
                  />
                </button>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 pt-2">
                <button className="btn-ghost" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={saving || !form.projectId || !form.taskName.trim()}
                >
                  {saving
                    ? "Saving..."
                    : editingAutomation
                    ? "Save Changes"
                    : "Create Automation"}
                </button>
              </div>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}
