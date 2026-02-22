"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";

// ─── Types ───
interface Template {
  id: string;
  name: string;
  description: string | null;
  goalAreas?: GoalArea[];
}

interface GoalArea {
  id: string;
  templateId: string;
  name: string;
  displayOrder: number;
  goals: Goal[];
}

interface Goal {
  id: string;
  goalAreaId: string;
  goal: string;
  successCriteria: string;
  reportUrl: string | null;
  displayOrder: number;
}

export default function TemplatesTab() {
  const { showToast } = useToast();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "" });

  // ── Template propagation state ──
  const [syncModal, setSyncModal] = useState<{
    open: boolean;
    affectedCount: number;
    templateId: string;
    actionLabel: string; // "goal" or "goal area"
  } | null>(null);
  const [syncing, setSyncing] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/check-in-templates");
      const json = await res.json();
      setTemplates(json.data || []);
    } catch {
      showToast("Failed to load templates", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const loadTemplate = async (id: string) => {
    try {
      const res = await fetch(`/api/check-in-templates?id=${id}`);
      const json = await res.json();
      setActiveTemplate(json.data);
    } catch {
      showToast("Failed to load template", "error");
    }
  };

  // After adding a goal or goal area, check if active snapshots use this template
  // and offer to sync if they do.
  const checkAndOfferSync = async (templateId: string, actionLabel: string) => {
    try {
      const res = await fetch(`/api/performance-snapshots/sync-template?templateId=${templateId}`);
      const json = await res.json();
      const count: number = json.data?.count ?? 0;
      if (count > 0) {
        setSyncModal({ open: true, affectedCount: count, templateId, actionLabel });
      }
    } catch {
      // Non-critical — don't block the user if this check fails
    }
  };

  const handleSyncConfirm = async () => {
    if (!syncModal) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/performance-snapshots/sync-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: syncModal.templateId }),
      });
      const json = await res.json();
      const updated = json.data?.updated ?? 0;
      showToast(
        `Synced to ${updated} active performance snapshot${updated !== 1 ? "s" : ""}`,
        "success"
      );
    } catch {
      showToast("Sync failed", "error");
    } finally {
      setSyncing(false);
      setSyncModal(null);
    }
  };

  const handleCreateTemplate = async () => {
    if (!createForm.name.trim()) return;
    try {
      const res = await fetch("/api/check-in-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast(`Created "${createForm.name}"`, "success");
      setCreateModalOpen(false);
      setCreateForm({ name: "", description: "" });
      await loadTemplate(json.data.id);
      await fetchTemplates();
    } catch {
      showToast("Failed to create template", "error");
    }
  };

  const handleDeleteTemplate = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"? This can't be undone.`)) return;
    try {
      await fetch(`/api/check-in-templates?id=${id}`, { method: "DELETE" });
      showToast(`Deleted "${name}"`, "success");
      if (activeTemplate?.id === id) setActiveTemplate(null);
      await fetchTemplates();
    } catch {
      showToast("Failed to delete", "error");
    }
  };

  const handleAddGoalArea = async () => {
    if (!activeTemplate) return;
    try {
      const res = await fetch("/api/goal-areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: activeTemplate.id,
          name: "New Goal Area",
          displayOrder: (activeTemplate.goalAreas?.length || 0),
        }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast("Goal area added", "success");
      await loadTemplate(activeTemplate.id);
      // Offer to sync to active performance snapshots
      await checkAndOfferSync(activeTemplate.id, "goal area");
    } catch {
      showToast("Failed to add goal area", "error");
    }
  };

  const handleUpdateGoalArea = async (areaId: string, name: string) => {
    try {
      await fetch("/api/goal-areas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: areaId, name }),
      });
    } catch {
      showToast("Failed to update goal area", "error");
    }
  };

  const handleDeleteGoalArea = async (areaId: string) => {
    if (!activeTemplate) return;
    if (!confirm("Delete this goal area and all its goals?")) return;
    try {
      await fetch(`/api/goal-areas?id=${areaId}`, { method: "DELETE" });
      showToast("Goal area deleted", "success");
      await loadTemplate(activeTemplate.id);
    } catch {
      showToast("Failed to delete goal area", "error");
    }
  };

  const handleAddGoal = async (goalAreaId: string, goalCount: number) => {
    if (!activeTemplate) return;
    try {
      const res = await fetch("/api/goal-areas/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalAreaId,
          goal: "New Goal",
          successCriteria: "",
          displayOrder: goalCount,
        }),
      });
      if (!res.ok) { showToast("Failed", "error"); return; }
      showToast("Goal added", "success");
      await loadTemplate(activeTemplate.id);
      // Offer to sync to active performance snapshots
      await checkAndOfferSync(activeTemplate.id, "goal");
    } catch {
      showToast("Failed to add goal", "error");
    }
  };

  const handleUpdateGoal = async (goalId: string, field: "goal" | "successCriteria" | "reportUrl", value: string) => {
    try {
      await fetch("/api/goal-areas/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: goalId, [field]: value }),
      });
    } catch {
      showToast("Failed to update goal", "error");
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!activeTemplate) return;
    try {
      await fetch(`/api/goal-areas/goals?id=${goalId}`, { method: "DELETE" });
      showToast("Goal removed", "success");
      await loadTemplate(activeTemplate.id);
    } catch {
      showToast("Failed to delete goal", "error");
    }
  };

  // ─── Active Template Builder View ───
  if (activeTemplate) {
    return (
      <div className="animate-fadeIn">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              className="text-secondary hover:text-primary transition-colors text-sm"
              onClick={() => setActiveTemplate(null)}
            >
              ← Back
            </button>
            <h2 className="text-xl font-semibold text-primary">{activeTemplate.name}</h2>
            {activeTemplate.description && (
              <span className="text-muted text-xs">— {activeTemplate.description}</span>
            )}
          </div>
          <button className="btn-primary text-sm" onClick={handleAddGoalArea}>+ Goal Area</button>
        </div>

        {(!activeTemplate.goalAreas || activeTemplate.goalAreas.length === 0) ? (
          <div className="card p-10 text-center">
            <p className="text-muted text-sm">No goal areas yet.</p>
            <button className="btn-primary mt-3 text-sm" onClick={handleAddGoalArea}>+ Add Goal Area</button>
          </div>
        ) : (
          <div className="space-y-5">
            {activeTemplate.goalAreas.map((area) => (
              <div key={area.id} className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <input
                    className="text-base font-semibold text-primary bg-transparent border-none outline-none border-b border-transparent hover:border-default focus:border-focus transition-colors"
                    style={{ width: "auto", minWidth: "120px" }}
                    value={area.name}
                    onChange={(e) => {
                      const updated = {
                        ...activeTemplate,
                        goalAreas: activeTemplate.goalAreas!.map((a) =>
                          a.id === area.id ? { ...a, name: e.target.value } : a
                        ),
                      };
                      setActiveTemplate(updated);
                    }}
                    onBlur={(e) => handleUpdateGoalArea(area.id, e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button className="btn-ghost text-xs" onClick={() => handleAddGoal(area.id, area.goals.length)}>+ Goal</button>
                    <button className="btn-danger text-xs" onClick={() => handleDeleteGoalArea(area.id)}>Delete</button>
                  </div>
                </div>

                {area.goals.length === 0 ? (
                  <p className="text-muted text-xs py-2">No goals yet — click &quot;+ Goal&quot; above.</p>
                ) : (
                  <div className="rounded-lg overflow-hidden border border-default">
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-tertiary">
                      <div className="col-span-3 text-muted text-xs font-medium uppercase tracking-wide">Goal</div>
                      <div className="col-span-4 text-muted text-xs font-medium uppercase tracking-wide">Success Criteria</div>
                      <div className="col-span-3 text-muted text-xs font-medium uppercase tracking-wide">Report URL</div>
                      <div className="col-span-1 text-muted text-xs font-medium uppercase tracking-wide">
                        <span className="text-xs" style={{ color: "#4f6ff5" }}>Comments</span>
                      </div>
                      <div className="col-span-1"></div>
                    </div>

                    {area.goals.map((g) => (
                      <div key={g.id} className="grid grid-cols-12 gap-2 px-3 py-2 border-t border-default items-center">
                        <div className="col-span-3">
                          <input
                            className="input-field text-sm"
                            value={g.goal}
                            onChange={(e) => {
                              const updated = {
                                ...activeTemplate,
                                goalAreas: activeTemplate.goalAreas!.map((a) =>
                                  a.id === area.id
                                    ? { ...a, goals: a.goals.map((gl) => gl.id === g.id ? { ...gl, goal: e.target.value } : gl) }
                                    : a
                                ),
                              };
                              setActiveTemplate(updated);
                            }}
                            onBlur={(e) => handleUpdateGoal(g.id, "goal", e.target.value)}
                          />
                        </div>
                        <div className="col-span-4">
                          <input
                            className="input-field text-sm"
                            value={g.successCriteria}
                            onChange={(e) => {
                              const updated = {
                                ...activeTemplate,
                                goalAreas: activeTemplate.goalAreas!.map((a) =>
                                  a.id === area.id
                                    ? { ...a, goals: a.goals.map((gl) => gl.id === g.id ? { ...gl, successCriteria: e.target.value } : gl) }
                                    : a
                                ),
                              };
                              setActiveTemplate(updated);
                            }}
                            onBlur={(e) => handleUpdateGoal(g.id, "successCriteria", e.target.value)}
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            className="input-field text-sm"
                            placeholder="URL (optional)"
                            value={g.reportUrl || ""}
                            onChange={(e) => {
                              const updated = {
                                ...activeTemplate,
                                goalAreas: activeTemplate.goalAreas!.map((a) =>
                                  a.id === area.id
                                    ? { ...a, goals: a.goals.map((gl) => gl.id === g.id ? { ...gl, reportUrl: e.target.value } : gl) }
                                    : a
                                ),
                              };
                              setActiveTemplate(updated);
                            }}
                            onBlur={(e) => handleUpdateGoal(g.id, "reportUrl", e.target.value)}
                          />
                        </div>
                        <div className="col-span-1 flex items-center justify-center">
                          <div className="w-full h-7 rounded border border-dashed border-default flex items-center justify-center">
                            <span className="text-muted" style={{ fontSize: "9px" }}>✎</span>
                          </div>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button className="text-muted hover:text-red-400 transition-colors" onClick={() => handleDeleteGoal(g.id)}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Template Propagation Sync Modal ── */}
        {syncModal && (
          <Modal
            open={syncModal.open}
            onClose={() => setSyncModal(null)}
            title="Sync to Engineer Tracks?"
          >
            <div className="space-y-4">
              <div
                className="rounded-lg p-4 border"
                style={{
                  borderColor: "rgba(79,111,245,0.3)",
                  backgroundColor: "rgba(79,111,245,0.05)",
                }}
              >
                <p className="text-secondary text-sm">
                  You added a new <strong className="text-primary">{syncModal.actionLabel}</strong> to this
                  template. There {syncModal.affectedCount === 1 ? "is" : "are"}{" "}
                  <strong className="text-primary">{syncModal.affectedCount}</strong> active performance
                  snapshot{syncModal.affectedCount !== 1 ? "s" : ""} linked to this IC track.
                </p>
              </div>
              <p className="text-secondary text-sm">
                Would you like to mark those snapshots as updated so engineers on this track know
                the template has changed? Their snapshot version will be bumped and they will see
                the latest goals on their next review.
              </p>
              <p className="text-muted text-xs">
                This does not modify any existing observations or AI syntheses — it only signals
                that a template update occurred.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button className="btn-ghost" onClick={() => setSyncModal(null)}>
                  Skip
                </button>
                <button
                  className="btn-primary"
                  onClick={handleSyncConfirm}
                  disabled={syncing}
                >
                  {syncing ? "Syncing..." : `Sync to ${syncModal.affectedCount} Snapshot${syncModal.affectedCount !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // ─── Template List View ───
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-secondary text-sm">Reusable check-in templates — define once, use every cycle</p>
        <button className="btn-primary" onClick={() => setCreateModalOpen(true)}>+ New Template</button>
      </div>

      {loading ? (
        <p className="text-muted text-sm py-12 text-center">Loading...</p>
      ) : templates.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-muted text-sm mb-3">No templates yet.</p>
          <button className="btn-primary" onClick={() => setCreateModalOpen(true)}>Create your first template</button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="card p-4 flex items-center justify-between hover:shadow-md transition-shadow">
              <div>
                <p className="text-primary font-medium">{t.name}</p>
                {t.description && <p className="text-muted text-xs mt-0.5">{t.description}</p>}
              </div>
              <div className="flex gap-2">
                <button className="btn-primary text-xs" onClick={() => loadTemplate(t.id)}>Edit</button>
                <button className="btn-danger text-xs" onClick={() => handleDeleteTemplate(t.id, t.name)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="New Template">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted mb-1 block">Template Name</label>
            <input
              className="input-field"
              placeholder="e.g. IC4 Track"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Description (optional)</label>
            <input
              className="input-field"
              placeholder="e.g. IC4 engineer expectations"
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setCreateModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleCreateTemplate} disabled={!createForm.name.trim()}>
              Create Template
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
