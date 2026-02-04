"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";

interface Task {
  id: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  name: string;
  description: string | null;
  type: string;
  recurrence: string | null;
  dueDate: string;
  status: string;
  ownerId: string | null;
  ownerNick: string | null;
}

interface TeamMember {
  id: string;
  nick: string;
  role: string;
}

interface Project {
  id: string;
  name: string;
  color: string;
}

interface Template {
  id: string;
  name: string;
}

interface GroupedTasks {
  [projectId: string]: {
    projectName: string;
    projectColor: string;
    tasks: Task[];
  };
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingTask, setCompletingTask] = useState<string | null>(null);
  const { showToast } = useToast();

  // Add modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    projectId: "",
    name: "",
    description: "",
    type: "one-time" as "recurring" | "one-time",
    recurrence: "quarterly",
    dueDate: new Date().toISOString().split("T")[0],
    ownerId: "",
    isPerMemberCheckIn: false,
    templateId: "",
  });
  const [savingAdd, setSavingAdd] = useState(false);

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    dueDate: "",
    ownerId: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchTasks = async () => {
    try {
      // Fetch all projects, team members, and templates
      const [projectsRes, teamRes, tmplRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/team"),
        fetch("/api/check-in-templates"),
      ]);
      const [projectsJson, teamJson, tmplJson] = await Promise.all([
        projectsRes.json(),
        teamRes.json(),
        tmplRes.json(),
      ]);
      const projectsData = projectsJson.data || [];
      setProjects(projectsData);
      setTeamMembers(teamJson.data || []);
      setTemplates(tmplJson.data || []);

      // Fetch pending tasks for all projects
      const allTasks: Task[] = [];
      for (const project of projectsData) {
        const tasksRes = await fetch(`/api/requirements?projectId=${project.id}&status=pending`);
        const tasksJson = await tasksRes.json();
        const projectTasks = (tasksJson.data || []).map((t: any) => ({
          ...t,
          projectName: project.name,
          projectColor: project.color,
        }));
        allTasks.push(...projectTasks);
      }

      // Sort by due date (earliest first)
      allTasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      setTasks(allTasks);
    } catch {
      showToast("Failed to load tasks", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Open add modal
  const openAdd = () => {
    // Find Mihir's ID to set as default owner
    const mihir = teamMembers.find(m => m.nick.toLowerCase() === "mihir");
    setAddForm({
      projectId: projects.length > 0 ? projects[0].id : "",
      name: "",
      description: "",
      type: "one-time",
      recurrence: "quarterly",
      dueDate: new Date().toISOString().split("T")[0],
      ownerId: mihir?.id || "",
      isPerMemberCheckIn: false,
      templateId: "",
    });
    setAddModalOpen(true);
  };

  // Add new task
  const handleAddTask = async () => {
    if (!addForm.name.trim() || !addForm.projectId) return;
    setSavingAdd(true);
    try {
      const res = await fetch("/api/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: addForm.projectId,
          name: addForm.name,
          description: addForm.description || null,
          type: addForm.type,
          recurrence: addForm.type === "recurring" ? addForm.recurrence : null,
          dueDate: addForm.dueDate,
          ownerId: addForm.ownerId || null,
          isPerMemberCheckIn: addForm.isPerMemberCheckIn,
          templateId: addForm.templateId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || "Failed to create task", "error");
        return;
      }
      showToast(`Created "${addForm.name}"`, "success");
      setAddModalOpen(false);
      await fetchTasks();
    } catch {
      showToast("Failed to create task", "error");
    } finally {
      setSavingAdd(false);
    }
  };

  const handleComplete = async (task: Task) => {
    setCompletingTask(task.id);
    try {
      await fetch("/api/requirements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status: "completed" }),
      });
      showToast("Task completed", "success");
      await fetchTasks();
    } catch {
      showToast("Failed to complete task", "error");
    } finally {
      setCompletingTask(null);
    }
  };

  // Open edit modal
  const openEdit = (task: Task) => {
    setEditingTask(task);
    setEditForm({
      name: task.name,
      description: task.description || "",
      dueDate: task.dueDate,
      ownerId: task.ownerId || "",
    });
    setEditModalOpen(true);
  };

  // Save edited task
  const handleSaveEdit = async () => {
    if (!editingTask || !editForm.name.trim() || !editForm.dueDate) return;
    setSavingEdit(true);
    try {
      await fetch("/api/requirements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTask.id,
          name: editForm.name.trim(),
          description: editForm.description.trim() || null,
          dueDate: editForm.dueDate,
          ownerId: editForm.ownerId || null,
        }),
      });
      showToast("Task updated", "success");
      setEditModalOpen(false);
      await fetchTasks();
    } catch {
      showToast("Failed to update task", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete task from edit modal
  const handleDeleteTask = async () => {
    if (!editingTask) return;
    if (!confirm(`Are you sure you want to delete "${editingTask.name}"?`)) return;
    try {
      await fetch("/api/requirements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingTask.id }),
      });
      showToast("Task deleted", "success");
      setEditModalOpen(false);
      await fetchTasks();
    } catch {
      showToast("Failed to delete task", "error");
    }
  };

  // Group tasks by project
  const groupedTasks = tasks.reduce<GroupedTasks>((acc, task) => {
    if (!acc[task.projectId]) {
      acc[task.projectId] = {
        projectName: task.projectName,
        projectColor: task.projectColor,
        tasks: [],
      };
    }
    acc[task.projectId].tasks.push(task);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-secondary text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">My Tasks</h1>
          <p className="text-secondary text-sm mt-1">
            {tasks.length} open task{tasks.length !== 1 ? "s" : ""} across {Object.keys(groupedTasks).length} project{Object.keys(groupedTasks).length !== 1 ? "s" : ""}
          </p>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          + New Task
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-muted text-sm mb-3">No open tasks! 🎉</p>
          <Link href="/projects" className="btn-primary">
            Go to Projects
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTasks).map(([projectId, { projectName, projectColor, tasks }]) => (
            <div key={projectId} className="card p-4">
              {/* Project Header */}
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-default">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: projectColor }} />
                <h2 className="text-base font-semibold text-primary flex-1">{projectName}</h2>
                <span className="text-xs text-muted">{tasks.length} task{tasks.length !== 1 ? "s" : ""}</span>
                <Link
                  href={`/projects/${projectId}`}
                  className="text-xs font-medium"
                  style={{ color: projectColor }}
                >
                  View Project →
                </Link>
              </div>

              {/* Tasks List */}
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-tertiary cursor-pointer hover:bg-elevated transition-colors"
                    onClick={() => openEdit(task)}
                  >
                    {/* Task Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-1">
                        <p className="text-primary text-sm font-medium">{task.name}</p>
                        {task.recurrence && (
                          <span
                            className="px-2 py-0.5 rounded-full text-xs flex-shrink-0 bg-secondary"
                            style={{ color: "#fbbf24" }}
                          >
                            ↻ {task.recurrence}
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-muted text-xs mb-1 line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-secondary">
                        <span>Due: {new Date(task.dueDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        {task.ownerNick && <span>• {task.ownerNick}</span>}
                      </div>
                    </div>

                    {/* Complete Button */}
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleComplete(task)}
                        disabled={completingTask === task.id}
                        className="text-xs whitespace-nowrap px-3 py-1.5 rounded-lg font-medium transition-colors"
                        style={{
                          backgroundColor: completingTask === task.id ? "#6b7280" : "#10b981",
                          color: "white",
                          cursor: completingTask === task.id ? "not-allowed" : "pointer",
                          opacity: completingTask === task.id ? 0.6 : 1,
                        }}
                        onMouseEnter={(e) => {
                          if (completingTask !== task.id) {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#059669";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (completingTask !== task.id) {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#10b981";
                          }
                        }}
                      >
                        {completingTask === task.id ? "..." : "✓ Complete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Task Modal */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Task"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted mb-1 block">Project</label>
            <select
              className="input-field"
              value={addForm.projectId}
              onChange={(e) => setAddForm({ ...addForm, projectId: e.target.value })}
            >
              {projects.length === 0 ? (
                <option value="">No projects available</option>
              ) : (
                projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Task Name</label>
            <input
              className="input-field"
              placeholder="e.g. Weekly backup check"
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Description (optional)</label>
            <textarea
              className="input-field"
              rows={2}
              placeholder="Details..."
              value={addForm.description}
              onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
            />
          </div>

          {/* Type toggle */}
          <div className="flex gap-2">
            {["one-time", "recurring"].map((t) => (
              <button
                key={t}
                onClick={() => setAddForm({ ...addForm, type: t as any })}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  addForm.type === t
                    ? "bg-[#4f6ff5] text-white"
                    : "bg-tertiary text-secondary"
                }`}
              >
                {t === "one-time" ? "One-time" : "Recurring"}
              </button>
            ))}
          </div>

          {addForm.type === "recurring" && (
            <div>
              <label className="text-xs text-muted mb-1 block">Recurrence</label>
              <select
                className="input-field"
                value={addForm.recurrence}
                onChange={(e) => setAddForm({ ...addForm, recurrence: e.target.value })}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-xs text-muted mb-1 block">Due Date</label>
            <input
              type="date"
              className="input-field"
              value={addForm.dueDate}
              onChange={(e) => setAddForm({ ...addForm, dueDate: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Owner (optional)</label>
            <select
              className="input-field"
              value={addForm.ownerId}
              onChange={(e) => setAddForm({ ...addForm, ownerId: e.target.value })}
            >
              <option value="">Unassigned</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nick} — {m.role}
                </option>
              ))}
            </select>
          </div>

          {/* Per-member check-in toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-default" style={{ backgroundColor: "var(--bg-secondary)" }}>
            <div>
              <p className="text-sm text-primary font-medium">Per-member check-in</p>
              <p className="text-xs text-muted">One submission per team member each cycle</p>
            </div>
            <button
              onClick={() =>
                setAddForm({
                  ...addForm,
                  isPerMemberCheckIn: !addForm.isPerMemberCheckIn,
                  templateId: "",
                })
              }
              className="w-10 h-5 rounded-full transition-colors relative"
              style={{ backgroundColor: addForm.isPerMemberCheckIn ? "#4f6ff5" : "#d1d5db" }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                style={{ left: addForm.isPerMemberCheckIn ? "22px" : "2px" }}
              />
            </button>
          </div>

          {/* Template picker — only if per-member is on */}
          {addForm.isPerMemberCheckIn && (
            <div>
              <label className="text-xs text-muted mb-1 block">Check-in Template (optional)</label>
              <select
                className="input-field"
                value={addForm.templateId}
                onChange={(e) => setAddForm({ ...addForm, templateId: e.target.value })}
              >
                <option value="">No template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {templates.length === 0 && (
                <p className="text-xs text-muted mt-1">
                  No templates yet — create one on the{" "}
                  <a href="/templates" className="underline" style={{ color: "#4f6ff5" }}>
                    Templates
                  </a>{" "}
                  page.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setAddModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleAddTask}
              disabled={savingAdd || !addForm.name.trim() || !addForm.projectId}
            >
              {savingAdd ? "Adding..." : "Add Task"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Task"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted mb-1 block">Task Name</label>
            <input
              className="input-field"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Description (optional)</label>
            <textarea
              className="input-field"
              rows={2}
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Due Date</label>
            <input
              type="date"
              className="input-field"
              value={editForm.dueDate}
              onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Owner (optional)</label>
            <select
              className="input-field"
              value={editForm.ownerId}
              onChange={(e) => setEditForm({ ...editForm, ownerId: e.target.value })}
            >
              <option value="">Unassigned</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nick} — {m.role}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-between gap-2 pt-2">
            <button className="btn-danger" onClick={handleDeleteTask}>
              Delete Task
            </button>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setEditModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSaveEdit}
                disabled={savingEdit || !editForm.name.trim() || !editForm.dueDate}
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

