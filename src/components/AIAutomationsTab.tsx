"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";

interface AIAutomation {
  id: string;
  name: string;
  prompt: string;
  rules: string | null;
  schedule: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunSummary: string | null;
  lastRunLogId: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AIAutomationsTab() {
  const [automations, setAutomations] = useState<AIAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AIAutomation | null>(null);
  const [form, setForm] = useState({
    name: "",
    prompt: "",
    rules: "",
    schedule: "daily" as string,
    dayOfWeek: null as number | null,
    dayOfMonth: null as number | null,
    enabled: true,
  });
  const [saving, setSaving] = useState(false);

  // Run state
  const [runningId, setRunningId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/ai-automations");
      const json = await res.json();
      setAutomations(json.data || []);
    } catch {
      showToast("Failed to load AI automations", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ── Open modal ──
  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      prompt: "",
      rules: "",
      schedule: "daily",
      dayOfWeek: 1,
      dayOfMonth: 1,
      enabled: true,
    });
    setModalOpen(true);
  };

  const openEdit = (auto: AIAutomation) => {
    setEditing(auto);
    setForm({
      name: auto.name,
      prompt: auto.prompt,
      rules: auto.rules || "",
      schedule: auto.schedule,
      dayOfWeek: auto.dayOfWeek,
      dayOfMonth: auto.dayOfMonth,
      enabled: auto.enabled,
    });
    setModalOpen(true);
  };

  // ── Save ──
  const handleSave = async () => {
    if (!form.name.trim() || !form.prompt.trim() || !form.schedule) {
      showToast("Name, prompt, and schedule are required", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        rules: form.rules.trim() || null,
      };

      if (editing) {
        await fetch("/api/ai-automations", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editing.id, ...payload }),
        });
        showToast("AI automation updated", "success");
      } else {
        await fetch("/api/ai-automations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        showToast("AI automation created", "success");
      }
      setModalOpen(false);
      await fetchData();
    } catch {
      showToast("Failed to save AI automation", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──
  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/ai-automations?id=${id}`, { method: "DELETE" });
      showToast("AI automation deleted", "success");
      await fetchData();
    } catch {
      showToast("Failed to delete", "error");
    }
  };

  // ── Toggle enabled ──
  const handleToggle = async (auto: AIAutomation) => {
    try {
      await fetch("/api/ai-automations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: auto.id, enabled: !auto.enabled }),
      });
      await fetchData();
    } catch {
      showToast("Failed to toggle", "error");
    }
  };

  // ── Manual run ──
  const handleRun = async (auto: AIAutomation) => {
    setRunningId(auto.id);
    try {
      const res = await fetch("/api/ai-automations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: auto.id }),
      });
      const json = await res.json();

      if (json.success) {
        showToast(
          `Ran "${auto.name}": ${json.operationsCount} operation(s) in ${json.executionTimeMs}ms`,
          "success"
        );
      } else {
        showToast(`Run failed: ${json.message || json.error}`, "error");
      }
      await fetchData();
    } catch {
      showToast("Failed to run automation", "error");
    } finally {
      setRunningId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-secondary text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-secondary text-sm">
            AI-powered automations that use natural language prompts to manage your data
          </p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          + New AI Automation
        </button>
      </div>

      {/* List */}
      {automations.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-muted text-sm mb-3">No AI automations yet.</p>
          <button className="btn-primary" onClick={openCreate}>
            Create your first AI automation
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map((auto) => (
            <div
              key={auto.id}
              className="card p-4 flex items-center gap-4"
              style={{
                borderLeft: "3px solid #a78bfa",
                opacity: auto.enabled ? 1 : 0.5,
              }}
            >
              {/* Toggle */}
              <button
                onClick={() => handleToggle(auto)}
                className="w-10 h-5 rounded-full transition-colors relative flex-shrink-0"
                style={{ backgroundColor: auto.enabled ? "#a78bfa" : "#2a2d3a" }}
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
                  <p className="text-primary text-sm font-medium">{auto.name}</p>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs"
                    style={{ backgroundColor: "#1e2130", color: "#a78bfa" }}
                  >
                    AI
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs"
                    style={{ backgroundColor: "#1e2130", color: "#fbbf24" }}
                  >
                    {auto.schedule}
                    {auto.schedule === "weekly" &&
                      auto.dayOfWeek !== null &&
                      ` · ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][auto.dayOfWeek]}`}
                    {auto.schedule === "monthly" &&
                      auto.dayOfMonth !== null &&
                      ` · ${auto.dayOfMonth}${["th", "st", "nd", "rd"][auto.dayOfMonth % 10 > 3 ? 0 : auto.dayOfMonth % 10]}`}
                  </span>
                  {auto.lastRunStatus && (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs"
                      style={{
                        backgroundColor:
                          auto.lastRunStatus === "success"
                            ? "rgba(52,211,153,0.12)"
                            : "rgba(239,68,68,0.12)",
                        color: auto.lastRunStatus === "success" ? "#34d399" : "#ef4444",
                      }}
                    >
                      Last: {auto.lastRunStatus}
                    </span>
                  )}
                </div>
                <p className="text-muted text-xs truncate">{auto.prompt}</p>
                {auto.lastRunSummary && (
                  <p className="text-secondary text-xs mt-1 truncate">
                    {auto.lastRunSummary}
                  </p>
                )}
                {auto.lastRunAt && (
                  <p className="text-muted text-xs mt-0.5">
                    Last run: {new Date(auto.lastRunAt).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-shrink-0">
                <button
                  className="btn-ghost text-xs"
                  onClick={() => handleRun(auto)}
                  disabled={runningId === auto.id}
                  style={
                    runningId === auto.id
                      ? { opacity: 0.5, cursor: "not-allowed" }
                      : {}
                  }
                >
                  {runningId === auto.id ? "Running..." : "Run Now"}
                </button>
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

      {/* Cron instructions */}
      <div className="card p-4 mt-6 bg-secondary">
        <p className="text-sm font-semibold text-primary mb-2">
          How AI automations run
        </p>
        <p className="text-xs text-secondary mb-2">
          Set up an external cron job to call this endpoint daily. It will check
          schedules and run matching AI automations:
        </p>
        <code
          className="block px-3 py-2 rounded text-xs bg-tertiary"
          style={{ color: "#a78bfa" }}
        >
          POST {typeof window !== "undefined" ? window.location.origin : ""}/api/ai-automations/execute
        </code>
        <p className="text-xs text-muted mt-2">
          Or use the "Run Now" button to trigger any automation manually.
        </p>
      </div>

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit AI Automation" : "New AI Automation"}
        maxWidth="580px"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted mb-1 block">Name</label>
            <input
              className="input-field"
              placeholder='e.g. "Categorize new projects"'
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Prompt</label>
            <textarea
              className="input-field"
              rows={3}
              placeholder='e.g. "Find all uncategorized projects and assign them to appropriate categories based on their name and description"'
              value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">
              Rules (optional)
            </label>
            <textarea
              className="input-field"
              rows={2}
              placeholder='e.g. "Only use categories: Engineering, Operations, Planning. Never create new projects."'
              value={form.rules}
              onChange={(e) => setForm({ ...form, rules: e.target.value })}
            />
            <p className="text-xs text-muted mt-1">
              Extra rules appended to the AI system prompt to constrain behavior.
            </p>
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Schedule</label>
            <select
              className="input-field"
              value={form.schedule}
              onChange={(e) => setForm({ ...form, schedule: e.target.value })}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {form.schedule === "weekly" && (
            <div>
              <label className="text-xs text-muted mb-1 block">Day of Week</label>
              <select
                className="input-field"
                value={form.dayOfWeek !== null ? form.dayOfWeek : ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    dayOfWeek: e.target.value ? parseInt(e.target.value) : null,
                  })
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

          {form.schedule === "monthly" && (
            <div>
              <label className="text-xs text-muted mb-1 block">Day of Month</label>
              <select
                className="input-field"
                value={form.dayOfMonth !== null ? form.dayOfMonth : ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    dayOfMonth: e.target.value ? parseInt(e.target.value) : null,
                  })
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

          {/* Enabled toggle */}
          <div
            className="flex items-center justify-between p-3 rounded-lg"
            style={{ backgroundColor: "#1e2130" }}
          >
            <div>
              <p className="text-sm text-primary font-medium">Enabled</p>
              <p className="text-xs text-muted">
                Only enabled automations run on schedule
              </p>
            </div>
            <button
              onClick={() => setForm({ ...form, enabled: !form.enabled })}
              className="w-10 h-5 rounded-full transition-colors relative"
              style={{ backgroundColor: form.enabled ? "#a78bfa" : "#2a2d3a" }}
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
              disabled={saving || !form.name.trim() || !form.prompt.trim()}
            >
              {saving
                ? "Saving..."
                : editing
                  ? "Save Changes"
                  : "Create Automation"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
