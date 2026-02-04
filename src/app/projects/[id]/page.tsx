"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { OwnerChip, UnassignedChip } from "@/components/OwnerChip";
import { generateCycleLabel } from "@/types";

// ─── Types ───
interface Project { id: string; name: string; description: string | null; status: string; color: string; }
interface TeamMember { id: string; nick: string; role: string; }
interface Requirement {
  id: string; projectId: string; name: string; description: string | null;
  type: string; recurrence: string | null; dueDate: string; status: string;
  ownerId: string | null; isPerMemberCheckIn: boolean; templateId: string | null;
  ownerNick?: string; metricCount?: number;
}
interface Template { id: string; name: string; goalAreas: GoalArea[]; }
interface GoalArea { id: string; name: string; goals: Goal[]; }
interface Goal { id: string; goal: string; successCriteria: string; reportUrl: string | null; }
interface Submission { id: string; teamMemberId: string | null; teamMemberNick?: string; cycleLabel: string | null; notes: string | null; }
interface CheckinResponse { goalAreaName: string; goal: string; successCriteria: string; managerComments: string | null; engineerReportUrl: string | null; displayOrder: number; }

// ── Editable row state for the check-in form (per goal)
interface EditableRow {
  goalAreaName: string;
  goal: string;
  successCriteria: string;
  managerComments: string;
  engineerReportUrl: string;
  displayOrder: number;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;
  const { showToast } = useToast();

  // ── Core data ──
  const [project, setProject] = useState<Project | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]); // flat list for dropdown
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [filterOwner, setFilterOwner] = useState("all");

  // ── Add Requirement modal ──
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [reqForm, setReqForm] = useState({
    name: "", description: "",
    type: "one-time" as "recurring" | "one-time",
    recurrence: "quarterly" as string,
    dueDate: new Date().toISOString().split("T")[0],
    ownerId: "",
    isPerMemberCheckIn: false,
    templateId: "",
  });
  const [savingReq, setSavingReq] = useState(false);

  // ── Edit Requirement modal ──
  const [editModalReq, setEditModalReq] = useState<Requirement | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", description: "",
    type: "one-time" as "recurring" | "one-time",
    recurrence: "quarterly" as string,
    dueDate: "",
    ownerId: "",
    isPerMemberCheckIn: false,
    templateId: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // ── Simple completion modal ──
  const [completeModalReq, setCompleteModalReq] = useState<Requirement | null>(null);
  const [completeNotes, setCompleteNotes] = useState("");

  // ── Per-member check-in: roster view ──
  const [checkinReq, setCheckinReq] = useState<Requirement | null>(null);
  const [checkinCycle, setCheckinCycle] = useState("");
  const [checkinSubmissions, setCheckinSubmissions] = useState<Submission[]>([]);

  // ── Per-member check-in: metric entry for one engineer ──
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [editableRows, setEditableRows] = useState<EditableRow[]>([]);
  const [checkinNotes, setCheckinNotes] = useState("");

  // ── History modal ──
  const [historyReq, setHistoryReq] = useState<Requirement | null>(null);
  const [historyCycles, setHistoryCycles] = useState<string[]>([]);
  const [historySelectedCycle, setHistorySelectedCycle] = useState<string | null>(null);
  const [historySubmissions, setHistorySubmissions] = useState<(Submission & { responses?: CheckinResponse[] })[]>([]);

  // ── Project Edit/Delete ──
  const [editProjectModalOpen, setEditProjectModalOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({ name: "", description: "", status: "active", color: "#4f6ff5" });
  const [savingProject, setSavingProject] = useState(false);
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState(false);

  // ── Fetch everything ──
  const fetchData = useCallback(async () => {
    try {
      const [projRes, reqRes, teamRes, tmplRes] = await Promise.all([
        fetch("/api/projects"),
        fetch(`/api/requirements?projectId=${projectId}`),
        fetch("/api/team"),
        fetch("/api/check-in-templates"),
      ]);
      const [projJson, reqJson, teamJson, tmplJson] = await Promise.all([
        projRes.json(), reqRes.json(), teamRes.json(), tmplRes.json(),
      ]);

      const proj = (projJson.data || []).find((p: Project) => p.id === projectId);
      if (!proj) { router.push("/projects"); return; }

      setProject(proj);
      setRequirements(reqJson.data || []);
      setTeamMembers(teamJson.data || []);
      setTemplates(tmplJson.data || []);
    } catch {
      showToast("Failed to load project data", "error");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { if (projectId) fetchData(); }, [projectId, fetchData]);

  // ── Add Requirement ──
  const handleAddRequirement = async () => {
    if (!reqForm.name.trim()) return;
    setSavingReq(true);
    try {
      const res = await fetch("/api/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          name: reqForm.name,
          description: reqForm.description || null,
          type: reqForm.type,
          recurrence: reqForm.type === "recurring" ? reqForm.recurrence : null,
          dueDate: reqForm.dueDate,
          ownerId: reqForm.ownerId || null,
          isPerMemberCheckIn: reqForm.isPerMemberCheckIn,
          templateId: reqForm.templateId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast(`Added "${reqForm.name}"`, "success");
      setAddModalOpen(false);
      setReqForm({ name: "", description: "", type: "one-time", recurrence: "quarterly", dueDate: new Date().toISOString().split("T")[0], ownerId: "", isPerMemberCheckIn: false, templateId: "" });
      await fetchData();
    } finally { setSavingReq(false); }
  };

  // ── Open Edit modal — seed form from existing requirement ──
  const openEdit = (req: Requirement) => {
    setEditForm({
      name: req.name,
      description: req.description || "",
      type: req.type as "recurring" | "one-time",
      recurrence: req.recurrence || "quarterly",
      dueDate: req.dueDate,
      ownerId: req.ownerId || "",
      isPerMemberCheckIn: req.isPerMemberCheckIn,
      templateId: req.templateId || "",
    });
    setEditModalReq(req);
  };

  // ── Edit Requirement ──
  const handleEditRequirement = async () => {
    if (!editModalReq || !editForm.name.trim()) return;
    setSavingEdit(true);
    try {
      const res = await fetch("/api/requirements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editModalReq.id,
          name: editForm.name,
          description: editForm.description || null,
          type: editForm.type,
          recurrence: editForm.type === "recurring" ? editForm.recurrence : null,
          dueDate: editForm.dueDate,
          ownerId: editForm.ownerId || null,
          isPerMemberCheckIn: editForm.isPerMemberCheckIn,
          templateId: editForm.templateId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast(`Updated "${editForm.name}"`, "success");
      setEditModalReq(null);
      await fetchData();
    } finally { setSavingEdit(false); }
  };

  // ── Delete Requirement ──
  const handleDeleteRequirement = async (req: Requirement) => {
    try {
      const res = await fetch(`/api/requirements?id=${req.id}`, { method: "DELETE" });
      if (!res.ok) { showToast("Failed to delete", "error"); return; }
      showToast(`Deleted "${req.name}"`, "success");
      setEditModalReq(null);
      await fetchData();
    } catch { showToast("Failed to delete", "error"); }
  };

  // ── Simple Completion ──
  const handleSimpleComplete = async () => {
    if (!completeModalReq) return;
    try {
      await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirementId: completeModalReq.id, notes: completeNotes || null }),
      });
      await fetch("/api/requirements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: completeModalReq.id, status: "completed" }),
      });
      showToast(`"${completeModalReq.name}" marked complete`, "success");
      setCompleteModalReq(null);
      setCompleteNotes("");
      await fetchData();
    } catch { showToast("Failed to complete", "error"); }
  };

  // ── Open check-in roster for a per-member requirement ──
  const openCheckin = async (req: Requirement) => {
    setCheckinReq(req);
    const cycle = req.recurrence ? generateCycleLabel(req.recurrence as any) : "";
    setCheckinCycle(cycle);

    const subRes = await fetch(`/api/submissions?requirementId=${req.id}&cycleLabel=${cycle}`);
    const subJson = await subRes.json();
    setCheckinSubmissions(subJson.data || []);
    setSelectedMember(null);
  };

  // ── Open metric entry modal for one engineer ──
  // If the requirement has a template, we pull that template's structure and pre-populate Goal + Success Criteria.
  // If no template, we fall back to empty rows (legacy/manual mode).
  const openMemberMetrics = async (member: TeamMember) => {
    setSelectedMember(member);
    setCheckinNotes("");

    if (checkinReq?.templateId) {
      // Load the full template with goal areas + goals
      const res = await fetch(`/api/check-in-templates?id=${checkinReq.templateId}`);
      const json = await res.json();
      const tmpl = json.data;

      // Flatten into editable rows: one row per goal, ordered by goal area then goal
      const rows: EditableRow[] = [];
      let order = 0;
      if (tmpl?.goalAreas) {
        for (const area of tmpl.goalAreas) {
          for (const g of area.goals) {
            rows.push({
              goalAreaName: area.name,
              goal: g.goal,
              successCriteria: g.successCriteria,
              managerComments: "",
              engineerReportUrl: g.reportUrl || "",
              displayOrder: order++,
            });
          }
        }
      }
      setEditableRows(rows);
    } else {
      // No template — empty single row as fallback
      setEditableRows([{ goalAreaName: "", goal: "", successCriteria: "", managerComments: "", engineerReportUrl: "", displayOrder: 0 }]);
    }
  };

  // ── Save one engineer's check-in ──
  const handleMemberCheckin = async () => {
    if (!checkinReq || !selectedMember) return;
    try {
      // 1. Create the submission row
      const subRes = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirementId: checkinReq.id,
          teamMemberId: selectedMember.id,
          cycleLabel: checkinCycle,
          notes: checkinNotes || null,
        }),
      });
      const subJson = await subRes.json();
      const submissionId = subJson.data.id;

      // 2. Save all the checkin responses (goal rows)
      await fetch("/api/checkin-responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses: editableRows.map((r) => ({
            submissionId,
            goalAreaName: r.goalAreaName,
            goal: r.goal,
            successCriteria: r.successCriteria,
            managerComments: r.managerComments || null,
            engineerReportUrl: r.engineerReportUrl || null,
            displayOrder: r.displayOrder,
          })),
        }),
      });

      showToast(`Check-in saved for ${selectedMember.nick}`, "success");
      setSelectedMember(null);

      // Refresh submissions for roster view
      const refreshRes = await fetch(`/api/submissions?requirementId=${checkinReq.id}&cycleLabel=${checkinCycle}`);
      const refreshJson = await refreshRes.json();
      setCheckinSubmissions(refreshJson.data || []);

      // If all members done, mark requirement completed
      const completedIds = new Set((refreshJson.data || []).map((s: Submission) => s.teamMemberId));
      if (teamMembers.every((m) => completedIds.has(m.id))) {
        await fetch("/api/requirements", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: checkinReq.id, status: "completed" }),
        });
        showToast("All members complete — requirement marked done!", "success");
        await fetchData();
      }
    } catch { showToast("Failed to save check-in", "error"); }
  };

  // ── History: open ──
  const openHistory = async (req: Requirement) => {
    setHistoryReq(req);
    const res = await fetch(`/api/submissions/cycles?requirementId=${req.id}`);
    const json = await res.json();
    setHistoryCycles(json.data || []);
    setHistorySelectedCycle(null);
    setHistorySubmissions([]);
  };

  // ── History: load one cycle ──
  const loadHistoryCycle = async (cycle: string) => {
    setHistorySelectedCycle(cycle);
    if (!historyReq) return;

    const subRes = await fetch(`/api/submissions?requirementId=${historyReq.id}&cycleLabel=${cycle}`);
    const subJson = await subRes.json();
    const subs: Submission[] = subJson.data || [];

    // For each submission, load its checkin responses
    const enriched = await Promise.all(
      subs.map(async (sub) => {
        const rRes = await fetch(`/api/checkin-responses?submissionId=${sub.id}`);
        const rJson = await rRes.json();
        return { ...sub, responses: rJson.data || [] };
      })
    );
    setHistorySubmissions(enriched);
  };

  // ── Filtered requirements ──
  const filtered = requirements.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterOwner !== "all" && r.ownerId !== filterOwner) return false;
    return true;
  });

  // ── Project Edit/Delete Handlers ──
  const openEditProject = () => {
    if (!project) return;
    setProjectForm({
      name: project.name,
      description: project.description || "",
      status: project.status,
      color: project.color,
    });
    setEditProjectModalOpen(true);
  };

  const handleSaveProject = async () => {
    if (!projectForm.name.trim()) return;
    setSavingProject(true);
    try {
      await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: projectId,
          name: projectForm.name,
          description: projectForm.description || null,
          status: projectForm.status,
          color: projectForm.color,
        }),
      });
      showToast("Project updated", "success");
      setEditProjectModalOpen(false);
      await fetchData();
    } catch {
      showToast("Failed to update project", "error");
    } finally {
      setSavingProject(false);
    }
  };

  const handleDeleteProject = async () => {
    try {
      await fetch(`/api/projects?id=${projectId}`, {
        method: "DELETE",
      });
      showToast("Project deleted", "success");
      router.push("/projects");
    } catch {
      showToast("Failed to delete project", "error");
    }
  };

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  if (loading || !project) {
    return <div className="flex items-center justify-center h-64"><p className="text-secondary text-sm">Loading...</p></div>;
  }

  const total = requirements.length;
  const done = requirements.filter((r) => r.status === "completed").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Group editable rows by goalAreaName for rendering
  const groupedRows = editableRows.reduce<Record<string, EditableRow[]>>((acc, row) => {
    const key = row.goalAreaName || "General";
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  return (
    <div className="animate-fadeIn">
      {/* Back Button - with mobile margin */}
      <button
        onClick={() => router.back()}
        className="btn-ghost text-sm mb-4 flex items-center gap-1 ml-0 md:ml-0"
        style={{ padding: "0.25rem 0.5rem", marginLeft: "0" }}
      >
        ← Back
      </button>

      {/* Header - responsive layout */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-start sm:items-center gap-3 flex-wrap min-w-0">
          <div className="w-4 h-4 rounded-full flex-shrink-0 mt-1 sm:mt-0" style={{ backgroundColor: project.color }} />
          <h1 className="text-xl sm:text-2xl font-semibold text-primary break-words">{project.name}</h1>
          <span className={`badge-${project.status === "active" ? "completed" : project.status === "on-hold" ? "pending" : "completed"}`}>{project.status}</span>
        </div>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <button className="btn-ghost text-xs sm:text-sm whitespace-nowrap" onClick={openEditProject}>✎ Edit</button>
          <button className="btn-danger text-xs sm:text-sm whitespace-nowrap" onClick={() => setDeleteProjectConfirm(true)}>Delete</button>
          <button className="btn-primary text-xs sm:text-sm whitespace-nowrap" onClick={() => setAddModalOpen(true)}>+ Requirement</button>
        </div>
      </div>
      {project.description && <p className="text-secondary text-sm mb-4">{project.description}</p>}

      {/* Progress bar */}
      <div className="card p-4 mb-6">
        <div className="flex justify-between text-xs text-muted mb-2">
          <span>{done} of {total} requirements completed</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full h-2 rounded-full" style={{ backgroundColor: "#1e2130" }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: project.color }} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: "#1e2130" }}>
          {["all", "pending", "completed", "overdue"].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)} className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
              style={{ backgroundColor: filterStatus === s ? "#252838" : "transparent", color: filterStatus === s ? "#f0f1f3" : "#9a9eb5" }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <select className="input-field text-xs" style={{ width: "160px" }} value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)}>
          <option value="all">All Owners</option>
          {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.nick}</option>)}
        </select>
      </div>

      {/* Requirements List */}
      {filtered.length === 0 ? (
        <div className="card p-10 text-center"><p className="text-muted text-sm">No requirements match your filters.</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((req) => (
            <div key={req.id} className="card p-4">
              {/* Mobile-friendly flex layout */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Status indicator + Content */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: req.status === "completed" ? "#34d399" : req.status === "overdue" ? "#f87171" : "#fbbf24" }} />
                  <div className="flex-1 min-w-0">
                    {/* Title and badges */}
                    <div className="flex items-start gap-2 flex-wrap mb-1">
                      <p className="text-primary text-sm font-medium">{req.name}</p>
                      <span className={`badge-${req.status}`}>{req.status}</span>
                      {req.isPerMemberCheckIn && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(79,111,245,0.12)", color: "#4f6ff5" }}>Per-member</span>}
                      {req.templateId && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(52,211,153,0.12)", color: "#34d399" }}>Has template</span>}
                      {req.type === "recurring" && req.recurrence && <span className="text-xs text-muted">↻ {req.recurrence}</span>}
                    </div>
                    {/* Due date and owner */}
                    <div className="flex items-center gap-3 text-xs text-muted flex-wrap">
                      <span>Due {formatDate(req.dueDate)}</span>
                      {req.ownerNick && <span>• {req.ownerNick}</span>}
                    </div>
                  </div>
                </div>

                {/* Action buttons - stack on mobile */}
                <div className="flex gap-2 flex-wrap sm:flex-nowrap sm:flex-shrink-0">
                  {req.status !== "completed" && (
                    req.isPerMemberCheckIn
                      ? <button className="btn-primary text-xs whitespace-nowrap" onClick={() => openCheckin(req)}>Check-ins</button>
                      : <button className="btn-primary text-xs whitespace-nowrap" onClick={() => { setCompleteModalReq(req); setCompleteNotes(""); }}>✓ Complete</button>
                  )}
                  {req.isPerMemberCheckIn && <button className="btn-ghost text-xs" onClick={() => openHistory(req)}>History</button>}
                  <button className="btn-ghost text-xs" onClick={() => openEdit(req)} title="Edit">✎ Edit</button>
                  <button className="btn-danger text-xs" onClick={() => handleDeleteRequirement(req)} title="Delete">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* MODALS                                       */}
      {/* ════════════════════════════════════════════ */}

      {/* ── Add Requirement Modal ── */}
      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Requirement">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted mb-1 block">Name</label>
            <input className="input-field" placeholder="e.g. Weekly backup check" value={reqForm.name} onChange={(e) => setReqForm({ ...reqForm, name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Description (optional)</label>
            <textarea className="input-field" rows={2} placeholder="Details..." value={reqForm.description} onChange={(e) => setReqForm({ ...reqForm, description: e.target.value })} />
          </div>

          {/* Type toggle */}
          <div className="flex gap-2">
            {["one-time", "recurring"].map((t) => (
              <button key={t} onClick={() => setReqForm({ ...reqForm, type: t as any })}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ backgroundColor: reqForm.type === t ? "#4f6ff5" : "#1e2130", color: reqForm.type === t ? "#fff" : "#9a9eb5" }}>
                {t === "one-time" ? "One-time" : "Recurring"}
              </button>
            ))}
          </div>

          {reqForm.type === "recurring" && (
            <div>
              <label className="text-xs text-muted mb-1 block">Recurrence</label>
              <select className="input-field" value={reqForm.recurrence} onChange={(e) => setReqForm({ ...reqForm, recurrence: e.target.value })}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-xs text-muted mb-1 block">Due Date</label>
            <input type="date" className="input-field" value={reqForm.dueDate} onChange={(e) => setReqForm({ ...reqForm, dueDate: e.target.value })} />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Owner (optional)</label>
            <select className="input-field" value={reqForm.ownerId} onChange={(e) => setReqForm({ ...reqForm, ownerId: e.target.value })}>
              <option value="">Unassigned</option>
              {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.nick} — {m.role}</option>)}
            </select>
          </div>

          {/* Per-member check-in toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: "#1e2130" }}>
            <div>
              <p className="text-sm text-primary font-medium">Per-member check-in</p>
              <p className="text-xs text-muted">One submission per team member each cycle</p>
            </div>
            <button onClick={() => setReqForm({ ...reqForm, isPerMemberCheckIn: !reqForm.isPerMemberCheckIn, templateId: "" })}
              className="w-10 h-5 rounded-full transition-colors relative" style={{ backgroundColor: reqForm.isPerMemberCheckIn ? "#4f6ff5" : "#2a2d3a" }}>
              <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform" style={{ left: reqForm.isPerMemberCheckIn ? "22px" : "2px" }} />
            </button>
          </div>

          {/* Template picker — only if per-member is on */}
          {reqForm.isPerMemberCheckIn && (
            <div>
              <label className="text-xs text-muted mb-1 block">Check-in Template (optional)</label>
              <select className="input-field" value={reqForm.templateId} onChange={(e) => setReqForm({ ...reqForm, templateId: e.target.value })}>
                <option value="">No template</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {templates.length === 0 && (
                <p className="text-xs text-muted mt-1">No templates yet — create one on the <a href="/templates" className="underline" style={{ color: "#4f6ff5" }}>Templates</a> page.</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setAddModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleAddRequirement} disabled={savingReq || !reqForm.name.trim()}>
              {savingReq ? "Adding..." : "Add Requirement"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Requirement Modal ── */}
      <Modal open={!!editModalReq} onClose={() => setEditModalReq(null)} title="Edit Requirement">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted mb-1 block">Name</label>
            <input className="input-field" placeholder="e.g. Weekly backup check" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Description (optional)</label>
            <textarea className="input-field" rows={2} placeholder="Details..." value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
          </div>

          {/* Type toggle */}
          <div className="flex gap-2">
            {["one-time", "recurring"].map((t) => (
              <button key={t} onClick={() => setEditForm({ ...editForm, type: t as any })}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ backgroundColor: editForm.type === t ? "#4f6ff5" : "#1e2130", color: editForm.type === t ? "#fff" : "#9a9eb5" }}>
                {t === "one-time" ? "One-time" : "Recurring"}
              </button>
            ))}
          </div>

          {editForm.type === "recurring" && (
            <div>
              <label className="text-xs text-muted mb-1 block">Recurrence</label>
              <select className="input-field" value={editForm.recurrence} onChange={(e) => setEditForm({ ...editForm, recurrence: e.target.value })}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-xs text-muted mb-1 block">Due Date</label>
            <input type="date" className="input-field" value={editForm.dueDate} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Owner (optional)</label>
            <select className="input-field" value={editForm.ownerId} onChange={(e) => setEditForm({ ...editForm, ownerId: e.target.value })}>
              <option value="">Unassigned</option>
              {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.nick} — {m.role}</option>)}
            </select>
          </div>

          {/* Per-member check-in toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: "#1e2130" }}>
            <div>
              <p className="text-sm text-primary font-medium">Per-member check-in</p>
              <p className="text-xs text-muted">One submission per team member each cycle</p>
            </div>
            <button onClick={() => setEditForm({ ...editForm, isPerMemberCheckIn: !editForm.isPerMemberCheckIn, templateId: "" })}
              className="w-10 h-5 rounded-full transition-colors relative" style={{ backgroundColor: editForm.isPerMemberCheckIn ? "#4f6ff5" : "#2a2d3a" }}>
              <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform" style={{ left: editForm.isPerMemberCheckIn ? "22px" : "2px" }} />
            </button>
          </div>

          {/* Template picker — only if per-member is on */}
          {editForm.isPerMemberCheckIn && (
            <div>
              <label className="text-xs text-muted mb-1 block">Check-in Template (optional)</label>
              <select className="input-field" value={editForm.templateId} onChange={(e) => setEditForm({ ...editForm, templateId: e.target.value })}>
                <option value="">No template</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button className="btn-danger" onClick={() => handleDeleteRequirement(editModalReq!)}>Delete</button>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setEditModalReq(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleEditRequirement} disabled={savingEdit || !editForm.name.trim()}>
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Simple Completion Modal ── */}
      <Modal open={!!completeModalReq} onClose={() => setCompleteModalReq(null)} title="Mark Complete">
        <div className="space-y-3">
          <p className="text-secondary text-sm">Completing: <strong className="text-primary">{completeModalReq?.name}</strong></p>
          <div>
            <label className="text-xs text-muted mb-1 block">Notes (optional)</label>
            <textarea className="input-field" rows={3} placeholder="Any notes..." value={completeNotes} onChange={(e) => setCompleteNotes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setCompleteModalReq(null)}>Cancel</button>
            <button className="btn-primary" onClick={handleSimpleComplete}>Mark Complete</button>
          </div>
        </div>
      </Modal>

      {/* ── Per-Member Check-in Roster ── */}
      <Modal open={!!checkinReq && !selectedMember} onClose={() => setCheckinReq(null)} title={`Check-ins — ${checkinReq?.name || ""}`} maxWidth="560px">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Cycle</label>
            <input className="input-field" value={checkinCycle} onChange={(e) => setCheckinCycle(e.target.value)} />
          </div>
          <p className="text-xs text-muted mt-3 mb-2">Team Members — {checkinCycle}</p>
          <div className="space-y-1">
            {teamMembers.map((member) => {
              const isDone = checkinSubmissions.some((s) => s.teamMemberId === member.id);
              return (
                <div key={member.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{ backgroundColor: isDone ? "rgba(52,211,153,0.08)" : "#1e2130" }}>
                  <div className="flex items-center gap-2">
                    <OwnerChip nick={member.nick} size="sm" />
                    <span className="text-sm text-primary">{member.nick}</span>
                  </div>
                  {isDone
                    ? <span className="badge-completed text-xs">✓ Done</span>
                    : <button className="btn-primary text-xs" onClick={() => openMemberMetrics(member)}>Fill in</button>
                  }
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* ── Per-Member: Check-in Form (goals from template) ── */}
      <Modal open={!!checkinReq && !!selectedMember} onClose={() => setSelectedMember(null)} title={`${selectedMember?.nick} — ${checkinCycle}`} maxWidth="700px">
        <div className="space-y-4">
          {/* Grouped by Goal Area */}
          {Object.entries(groupedRows).map(([areaName, rows]) => (
            <div key={areaName}>
              {/* Goal Area heading */}
              <p className="text-sm font-semibold text-primary mb-2 mt-1" style={{ color: "#4f6ff5" }}>{areaName}</p>

              {/* Column headers */}
              <div className="grid grid-cols-12 gap-2 px-2 mb-1">
                <div className="col-span-3 text-muted text-xs font-medium uppercase tracking-wide">Goal</div>
                <div className="col-span-3 text-muted text-xs font-medium uppercase tracking-wide">Success Criteria</div>
                <div className="col-span-4 text-muted text-xs font-medium uppercase tracking-wide">Manager Comments</div>
                <div className="col-span-2 text-muted text-xs font-medium uppercase tracking-wide">Report URL</div>
              </div>

              {/* Goal rows */}
              {rows.map((row, idx) => {
                // Find the index in the full editableRows array for state updates
                const globalIdx = editableRows.findIndex(
                  (r) => r.goalAreaName === row.goalAreaName && r.displayOrder === row.displayOrder
                );
                return (
                  <div key={idx} className="grid grid-cols-12 gap-2 px-2 py-1.5 rounded-lg mb-1" style={{ backgroundColor: "#1e2130" }}>
                    {/* Goal — editable */}
                    <div className="col-span-3">
                      <input className="input-field text-xs" value={row.goal}
                        onChange={(e) => {
                          const updated = [...editableRows];
                          updated[globalIdx] = { ...updated[globalIdx], goal: e.target.value };
                          setEditableRows(updated);
                        }} />
                    </div>
                    {/* Success Criteria — editable (copied from template) */}
                    <div className="col-span-3">
                      <input className="input-field text-xs" value={row.successCriteria}
                        onChange={(e) => {
                          const updated = [...editableRows];
                          updated[globalIdx] = { ...updated[globalIdx], successCriteria: e.target.value };
                          setEditableRows(updated);
                        }} />
                    </div>
                    {/* Manager Comments — open */}
                    <div className="col-span-4">
                      <textarea className="input-field text-xs" rows={2} placeholder="Comments..."
                        value={row.managerComments}
                        onChange={(e) => {
                          const updated = [...editableRows];
                          updated[globalIdx] = { ...updated[globalIdx], managerComments: e.target.value };
                          setEditableRows(updated);
                        }} />
                    </div>
                    {/* Engineer URL — open */}
                    <div className="col-span-2">
                      <input className="input-field text-xs" placeholder="URL..."
                        value={row.engineerReportUrl}
                        onChange={(e) => {
                          const updated = [...editableRows];
                          updated[globalIdx] = { ...updated[globalIdx], engineerReportUrl: e.target.value };
                          setEditableRows(updated);
                        }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Overall notes */}
          <div>
            <label className="text-xs text-muted mb-1 block">Overall Notes (optional)</label>
            <textarea className="input-field" rows={2} value={checkinNotes} onChange={(e) => setCheckinNotes(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setSelectedMember(null)}>Back</button>
            <button className="btn-primary" onClick={handleMemberCheckin}>Save & Complete</button>
          </div>
        </div>
      </Modal>

      {/* ── History Modal ── */}
      <Modal open={!!historyReq} onClose={() => { setHistoryReq(null); setHistoryCycles([]); setHistorySelectedCycle(null); setHistorySubmissions([]); }} title={`History — ${historyReq?.name || ""}`} maxWidth="700px">
        <div className="space-y-4">
          {historyCycles.length === 0 ? (
            <p className="text-muted text-sm text-center py-4">No past cycles recorded yet.</p>
          ) : (
            <>
              {/* Cycle picker */}
              <div className="flex flex-wrap gap-2">
                {historyCycles.map((cycle) => (
                  <button key={cycle} onClick={() => loadHistoryCycle(cycle)}
                    className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                    style={{ backgroundColor: historySelectedCycle === cycle ? "#4f6ff5" : "#1e2130", color: historySelectedCycle === cycle ? "#fff" : "#9a9eb5" }}>
                    {cycle}
                  </button>
                ))}
              </div>

              {/* Submissions for selected cycle */}
              {historySelectedCycle && (
                <div className="space-y-4">
                  {historySubmissions.length === 0 ? (
                    <p className="text-muted text-sm text-center py-2">No data for this cycle.</p>
                  ) : historySubmissions.map((sub) => (
                    <div key={sub.id} className="p-4 rounded-lg border border-default" style={{ backgroundColor: "#1e2130" }}>
                      {/* Engineer name */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-primary font-semibold">{sub.teamMemberNick || "N/A"}</span>
                        <span className="badge-completed text-xs">✓ Done</span>
                      </div>

                      {/* Responses grouped by goal area */}
                      {sub.responses && sub.responses.length > 0 && (() => {
                        const grouped = sub.responses!.reduce<Record<string, CheckinResponse[]>>((acc, r) => {
                          const key = r.goalAreaName || "General";
                          if (!acc[key]) acc[key] = [];
                          acc[key].push(r);
                          return acc;
                        }, {});

                        return Object.entries(grouped).map(([areaName, responses]) => (
                          <div key={areaName} className="mb-3">
                            <p className="text-xs font-semibold mb-1.5" style={{ color: "#4f6ff5" }}>{areaName}</p>
                            <div className="space-y-1.5">
                              {responses.map((r, i) => (
                                <div key={i} className="p-2 rounded" style={{ backgroundColor: "#171923" }}>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-primary font-medium">{r.goal}</span>
                                    <span className="text-muted">Target: {r.successCriteria}</span>
                                  </div>
                                  {r.managerComments && <p className="text-secondary text-xs mt-1">{r.managerComments}</p>}
                                  {r.engineerReportUrl && (
                                    <a href={r.engineerReportUrl} target="_blank" rel="noopener noreferrer"
                                      className="text-xs mt-0.5 block truncate" style={{ color: "#4f6ff5" }}>
                                      {r.engineerReportUrl}
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}

                      {sub.notes && <p className="text-muted text-xs mt-2 italic">"{sub.notes}"</p>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* ── Edit Project Modal ── */}
      <Modal open={editProjectModalOpen} onClose={() => setEditProjectModalOpen(false)} title="Edit Project">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted mb-1 block">Project Name</label>
            <input
              className="input-field"
              value={projectForm.name}
              onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Description (optional)</label>
            <textarea
              className="input-field"
              rows={2}
              value={projectForm.description}
              onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Status</label>
            <select
              className="input-field"
              value={projectForm.status}
              onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="on-hold">On Hold</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Color</label>
            <div className="flex flex-wrap gap-2">
              {["#4f6ff5", "#e879a0", "#a78bfa", "#60a5fa", "#34d399", "#fbbf24", "#fb923c", "#f472b6", "#38bdf8", "#4ade80", "#c084fc", "#fb7185"].map((c) => (
                <button
                  key={c}
                  onClick={() => setProjectForm({ ...projectForm, color: c })}
                  className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: projectForm.color === c ? "#fff" : "transparent",
                  }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setEditProjectModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleSaveProject} disabled={savingProject}>
              {savingProject ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Project Confirmation ── */}
      <Modal open={deleteProjectConfirm} onClose={() => setDeleteProjectConfirm(false)} title="Delete Project">
        <div className="space-y-4">
          <p className="text-secondary text-sm">
            Are you sure you want to delete <strong className="text-primary">{project.name}</strong>? This will also delete all {requirements.length} requirement{requirements.length !== 1 ? "s" : ""} in this project.
          </p>
          <p className="text-xs text-muted">This action cannot be undone.</p>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setDeleteProjectConfirm(false)}>Cancel</button>
            <button className="btn-danger" onClick={handleDeleteProject}>
              Delete Project
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
