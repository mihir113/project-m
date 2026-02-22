"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TeamMember {
  id: string;
  nick: string;
  role: string;
}

interface Observation {
  id: string;
  memberId: string;
  content: string;
  createdAt: string;
}

interface Goal {
  id: string;
  goal: string;
  successCriteria: string;
  reportUrl: string | null;
  displayOrder: number;
}

interface GoalArea {
  id: string;
  name: string;
  displayOrder: number;
  goals: Goal[];
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  goalAreas: GoalArea[];
}

interface PerformanceSnapshot {
  id: string;
  memberId: string;
  templateId: string | null;
  quarter: string;
  managerNotes: string | null;
  aiSynthesis: string | null;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  template: Template | null;
}

interface CheckInTemplate {
  id: string;
  name: string;
  description: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCurrentQuarter(): string {
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `${year}-Q${quarter}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function EngineerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.id as string;
  const { showToast } = useToast();

  const [member, setMember] = useState<TeamMember | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [snapshots, setSnapshots] = useState<PerformanceSnapshot[]>([]);
  const [allTemplates, setAllTemplates] = useState<CheckInTemplate[]>([]);

  const [loading, setLoading] = useState(true);
  const [obsText, setObsText] = useState("");
  const [savingObs, setSavingObs] = useState(false);
  const [synthesizing, setSynthesizing] = useState<string | null>(null); // snapshotId being synthesized

  // Snapshot creation state
  const [createSnapshotOpen, setCreateSnapshotOpen] = useState(false);
  const [snapshotForm, setSnapshotForm] = useState({
    quarter: getCurrentQuarter(),
    templateId: "",
    managerNotes: "",
  });
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);

  // Finalize confirmation
  const [finalizeId, setFinalizeId] = useState<string | null>(null);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      const [memberRes, obsRes, snapRes, templateRes] = await Promise.all([
        fetch(`/api/team?id=${memberId}`),
        fetch(`/api/manager-observations?memberId=${memberId}`),
        fetch(`/api/performance-snapshots?memberId=${memberId}`),
        fetch("/api/check-in-templates"),
      ]);

      const memberJson = await memberRes.json();
      const obsJson = await obsRes.json();
      const snapJson = await snapRes.json();
      const templateJson = await templateRes.json();

      if (!memberRes.ok || !memberJson.data) {
        showToast("Team member not found", "error");
        router.push("/team");
        return;
      }

      setMember(memberJson.data);
      setObservations(obsJson.data || []);
      setSnapshots(snapJson.data || []);
      setAllTemplates(templateJson.data || []);
    } catch {
      showToast("Failed to load engineer data", "error");
    } finally {
      setLoading(false);
    }
  }, [memberId, router, showToast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Save observation ──────────────────────────────────────────────────────

  const handleSaveObservation = async () => {
    if (!obsText.trim()) return;
    setSavingObs(true);
    try {
      const res = await fetch("/api/manager-observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, content: obsText.trim() }),
      });
      if (!res.ok) {
        const json = await res.json();
        showToast(json.error || "Failed to save observation", "error");
        return;
      }
      setObsText("");
      await fetchAll();
      showToast("Observation logged", "success");
    } finally {
      setSavingObs(false);
    }
  };

  const handleDeleteObservation = async (id: string) => {
    if (!confirm("Delete this observation?")) return;
    await fetch(`/api/manager-observations?id=${id}`, { method: "DELETE" });
    await fetchAll();
    showToast("Observation deleted", "success");
  };

  // ── Create snapshot ───────────────────────────────────────────────────────

  const handleCreateSnapshot = async () => {
    if (!snapshotForm.quarter.trim()) return;
    setCreatingSnapshot(true);
    try {
      const res = await fetch("/api/performance-snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          templateId: snapshotForm.templateId || null,
          quarter: snapshotForm.quarter.trim(),
          managerNotes: snapshotForm.managerNotes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || "Failed to create snapshot", "error");
        return;
      }
      showToast(`Snapshot created for ${snapshotForm.quarter}`, "success");
      setCreateSnapshotOpen(false);
      setSnapshotForm({ quarter: getCurrentQuarter(), templateId: "", managerNotes: "" });
      await fetchAll();
    } finally {
      setCreatingSnapshot(false);
    }
  };

  // ── AI Synthesis ──────────────────────────────────────────────────────────

  const handleSynthesize = async (snapshotId: string) => {
    setSynthesizing(snapshotId);
    try {
      const res = await fetch("/api/performance-snapshots/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || "Synthesis failed", "error");
        return;
      }
      showToast("AI synthesis complete", "success");
      await fetchAll();
    } finally {
      setSynthesizing(null);
    }
  };

  // ── Finalize snapshot ─────────────────────────────────────────────────────

  const handleFinalize = async (snapshotId: string) => {
    await fetch("/api/performance-snapshots", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: snapshotId, status: "finalized" }),
    });
    setFinalizeId(null);
    await fetchAll();
    showToast("Snapshot finalized", "success");
  };

  // ── Delete snapshot ───────────────────────────────────────────────────────

  const handleDeleteSnapshot = async (id: string) => {
    if (!confirm("Delete this snapshot? This cannot be undone.")) return;
    await fetch(`/api/performance-snapshots?id=${id}`, { method: "DELETE" });
    await fetchAll();
    showToast("Snapshot deleted", "success");
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="animate-fadeIn">
        <p className="text-muted text-sm py-12 text-center">Loading...</p>
      </div>
    );
  }

  if (!member) return null;

  const currentQuarter = getCurrentQuarter();
  const currentSnapshot = snapshots.find((s) => s.quarter === currentQuarter);

  return (
    <div className="animate-fadeIn max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        <button
          className="text-secondary hover:text-primary transition-colors text-sm mt-1"
          onClick={() => router.push("/team")}
        >
          ← Team
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-primary">{member.nick}</h1>
          <p className="text-secondary text-sm mt-0.5">{member.role}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            className="btn-primary text-sm"
            onClick={() => setCreateSnapshotOpen(true)}
          >
            + New Snapshot
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-6">
        {/* ── Left column: Observation Log ── */}
        <div className="md:col-span-2 space-y-4">
          {/* Quick-add observation */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-primary mb-3">The Log</h2>
            <p className="text-muted text-xs mb-3">
              Quick-add a manager observation about {member.nick}.
            </p>
            <textarea
              className="input-field w-full resize-none text-sm"
              rows={4}
              placeholder={`What did you observe about ${member.nick} this week?`}
              value={obsText}
              onChange={(e) => setObsText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSaveObservation();
              }}
            />
            <button
              className="btn-primary w-full mt-2 text-sm"
              onClick={handleSaveObservation}
              disabled={savingObs || !obsText.trim()}
            >
              {savingObs ? "Saving..." : "Log Observation"}
            </button>
            <p className="text-muted text-xs mt-1.5 text-center">⌘+Enter to save</p>
          </div>

          {/* Observation history */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-primary mb-3">
              Observations ({observations.length})
            </h2>
            {observations.length === 0 ? (
              <p className="text-muted text-xs py-4 text-center">
                No observations yet. Log one above.
              </p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {observations.map((obs) => (
                  <div
                    key={obs.id}
                    className="rounded-lg p-3 border border-default group relative"
                    style={{ backgroundColor: "var(--bg-tertiary)" }}
                  >
                    <p className="text-primary text-sm leading-relaxed">{obs.content}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-muted text-xs">{formatDate(obs.createdAt)}</span>
                      <span
                        className="text-muted text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:text-red-400"
                        onClick={() => handleDeleteObservation(obs.id)}
                      >
                        delete
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column: Performance Snapshots ── */}
        <div className="md:col-span-3 space-y-5">
          {snapshots.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-muted text-sm mb-3">No performance snapshots yet.</p>
              <p className="text-muted text-xs mb-4">
                Create a snapshot to track {member.nick}&apos;s progress against an IC template.
              </p>
              <button className="btn-primary text-sm" onClick={() => setCreateSnapshotOpen(true)}>
                + Create {currentQuarter} Snapshot
              </button>
            </div>
          ) : (
            snapshots.map((snap) => (
              <SnapshotCard
                key={snap.id}
                snap={snap}
                isCurrent={snap.quarter === currentQuarter}
                synthesizing={synthesizing === snap.id}
                onSynthesize={() => handleSynthesize(snap.id)}
                onFinalize={() => setFinalizeId(snap.id)}
                onDelete={() => handleDeleteSnapshot(snap.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Create Snapshot Modal ── */}
      <Modal
        open={createSnapshotOpen}
        onClose={() => setCreateSnapshotOpen(false)}
        title="New Performance Snapshot"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted mb-1 block">Quarter</label>
            <input
              className="input-field"
              placeholder="e.g. 2026-Q1"
              value={snapshotForm.quarter}
              onChange={(e) => setSnapshotForm({ ...snapshotForm, quarter: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">IC Template (optional)</label>
            <select
              className="input-field"
              value={snapshotForm.templateId}
              onChange={(e) => setSnapshotForm({ ...snapshotForm, templateId: e.target.value })}
            >
              <option value="">— No template linked —</option>
              {allTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Opening Notes (optional)</label>
            <textarea
              className="input-field w-full resize-none"
              rows={3}
              placeholder="Any context or goals for this quarter..."
              value={snapshotForm.managerNotes}
              onChange={(e) => setSnapshotForm({ ...snapshotForm, managerNotes: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setCreateSnapshotOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleCreateSnapshot}
              disabled={creatingSnapshot || !snapshotForm.quarter.trim()}
            >
              {creatingSnapshot ? "Creating..." : "Create Snapshot"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Finalize Confirmation Modal ── */}
      <Modal
        open={!!finalizeId}
        onClose={() => setFinalizeId(null)}
        title="Finalize Snapshot"
      >
        <div className="space-y-4">
          <p className="text-secondary text-sm">
            Finalizing this snapshot locks it as the official record for the quarter. You
            won&apos;t be able to edit it afterward.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setFinalizeId(null)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() => finalizeId && handleFinalize(finalizeId)}
            >
              Finalize
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Snapshot Card ────────────────────────────────────────────────────────────

function SnapshotCard({
  snap,
  isCurrent,
  synthesizing,
  onSynthesize,
  onFinalize,
  onDelete,
}: {
  snap: PerformanceSnapshot;
  isCurrent: boolean;
  synthesizing: boolean;
  onSynthesize: () => void;
  onFinalize: () => void;
  onDelete: () => void;
}) {
  const isFinalized = snap.status === "finalized";

  return (
    <div className="card p-5">
      {/* Snapshot header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-primary">{snap.quarter}</h3>
          {isCurrent && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "rgba(79,111,245,0.15)", color: "#4f6ff5" }}
            >
              Current
            </span>
          )}
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: isFinalized
                ? "rgba(52,211,153,0.15)"
                : "rgba(251,191,36,0.15)",
              color: isFinalized ? "#34d399" : "#fbbf24",
            }}
          >
            {isFinalized ? "Finalized" : "Draft"}
          </span>
          {snap.version > 1 && (
            <span className="text-muted text-xs">v{snap.version}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isFinalized && (
            <>
              <button
                className="btn-primary text-xs"
                onClick={onSynthesize}
                disabled={synthesizing}
              >
                {synthesizing ? "Synthesizing..." : "✦ Synthesize"}
              </button>
              <button className="btn-ghost text-xs" onClick={onFinalize}>
                Finalize
              </button>
            </>
          )}
          <button className="btn-danger text-xs" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>

      {/* IC Template goals */}
      {snap.template ? (
        <div className="mb-4">
          <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-2">
            IC Track: {snap.template.name}
          </p>
          {snap.template.goalAreas.length === 0 ? (
            <p className="text-muted text-xs">No goals defined in this template yet.</p>
          ) : (
            <div className="space-y-3">
              {snap.template.goalAreas.map((area) => (
                <div key={area.id}>
                  <p className="text-xs font-medium text-secondary mb-1">{area.name}</p>
                  <div className="space-y-1">
                    {area.goals.map((g) => (
                      <div key={g.id} className="rounded p-2.5 border border-default" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                        <p className="text-primary text-xs font-medium">{g.goal}</p>
                        {g.successCriteria && (
                          <p className="text-muted text-xs mt-0.5">{g.successCriteria}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-muted text-xs mb-4 italic">No IC template linked to this snapshot.</p>
      )}

      {/* Manager notes */}
      {snap.managerNotes && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-1">
            Manager Notes
          </p>
          <p className="text-secondary text-sm leading-relaxed">{snap.managerNotes}</p>
        </div>
      )}

      {/* AI Synthesis */}
      {snap.aiSynthesis ? (
        <div
          className="rounded-lg p-4 border"
          style={{
            borderColor: "rgba(79,111,245,0.3)",
            backgroundColor: "rgba(79,111,245,0.05)",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span style={{ color: "#4f6ff5", fontSize: "14px" }}>✦</span>
            <p className="text-xs font-semibold" style={{ color: "#4f6ff5" }}>
              AI Synthesis
            </p>
            <span className="text-muted text-xs ml-auto">
              Last updated {new Date(snap.updatedAt).toLocaleDateString()}
            </span>
          </div>
          <p className="text-secondary text-sm leading-relaxed whitespace-pre-line">
            {snap.aiSynthesis}
          </p>
          {!isFinalized && (
            <button
              className="mt-3 text-xs"
              style={{ color: "#4f6ff5" }}
              onClick={onSynthesize}
              disabled={synthesizing}
            >
              {synthesizing ? "Re-synthesizing..." : "↻ Re-synthesize"}
            </button>
          )}
        </div>
      ) : (
        !isFinalized && (
          <div
            className="rounded-lg p-4 border border-dashed text-center"
            style={{ borderColor: "rgba(79,111,245,0.3)" }}
          >
            <p className="text-muted text-xs mb-2">No synthesis yet.</p>
            <p className="text-muted text-xs mb-3">
              Log observations, then click &quot;✦ Synthesize&quot; to generate an AI assessment
              against this engineer&apos;s IC track.
            </p>
            <button
              className="btn-primary text-xs"
              onClick={onSynthesize}
              disabled={synthesizing}
            >
              {synthesizing ? "Synthesizing..." : "✦ Generate Synthesis"}
            </button>
          </div>
        )
      )}
    </div>
  );
}
