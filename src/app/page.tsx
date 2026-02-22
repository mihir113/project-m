"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { buildCategoryColorMap, getCategoryColor } from "@/lib/categoryColors";

interface ProjectWithCounts {
  id: string;
  name: string;
  description: string | null;
  status: string;
  color: string;
  category: string | null;
  totalRequirements: number;
  completedRequirements: number;
}

interface TaskItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  ownerId: string | null;
  ownerNick: string | null;
  url: string | null;
  projectName: string | null;
  projectColor: string | null;
  projectId: string;
}

interface TeamMember {
  id: string;
  nick: string;
  role: string;
}

interface Template {
  id: string;
  name: string;
}

interface EquityScore {
  memberId: string;
  nick: string;
  role: string;
  observationCount: number;
  lastObservationDate: string | null;
  managerCommentCount: number;
  daysSinceLastInteraction: number;
  score: number;
}

const STATUS_OPTIONS = ["active", "on-hold", "completed"];

// ─── Sparkline (deterministic mini area chart) ───
function Sparkline({ completed, total, color }: { completed: number; total: number; color: string }) {
  const pct = total > 0 ? completed / total : 0;
  const steps = 7;
  const heights: number[] = [];
  for (let i = 0; i < steps; i++) {
    const progress = (i + 1) / steps;
    const base = pct * progress;
    const jitter = Math.sin((completed * 7 + i * 3 + total) * 1.7) * 0.08;
    heights.push(Math.max(0.05, Math.min(1, base + jitter)));
  }
  const pts = heights.map((h, i) => `${i * 7 + 3},${13 - h * 11}`).join(" ");
  const area = `0,14 ${pts} 48,14`;
  return (
    <svg width="48" height="16" viewBox="0 0 48 16" className="flex-shrink-0">
      <polyline points={area} fill={color} opacity="0.12" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
    </svg>
  );
}

// ─── Momentum Ring (SVG donut) ───
function MomentumRing({ percentage, size = 64 }: { percentage: number; size?: number }) {
  const sw = 5;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percentage / 100) * circ;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-default)" strokeWidth={sw} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="#4f6ff5" strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
          style={{ filter: "drop-shadow(0 0 6px rgba(79,111,245,0.5))" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-primary">{percentage}%</span>
      </div>
    </div>
  );
}

// ─── Category Icon SVGs ───
function CategoryIcon({ index, color, active }: { index: number; color: string; active: boolean }) {
  const icons = [
    <path key="r" d="M12 2L8 8h3v6h2V8h3l-4-6zM8 18h8v2H8v-2z" />,
    <path key="c" d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />,
    <path key="s" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />,
    <path key="b" d="M3 13h2v7H3v-7zm5-6h2v13H8V7zm5-4h2v17h-2V3zm5 8h2v9h-2v-9z" />,
    <path key="p" d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z" />,
    <path key="g" d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1112 8.4a3.6 3.6 0 010 7.2z" />,
    <path key="t" d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3-8a3 3 0 11-6 0 3 3 0 016 0z" />,
    <path key="l" d="M7 2v11h3v9l7-12h-4l4-8H7z" />,
    <path key="k" d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" />,
    <path key="st" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />,
    <path key="gl" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />,
    <path key="fl" d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z" />,
  ];
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={color} opacity={active ? 1 : 0.45}>
      {icons[index % icons.length]}
    </svg>
  );
}

// ─── Helpers ───
function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate + "T23:59:59") < new Date();
}

function formatShortDate(dueDate: string | null): string {
  if (!dueDate) return "";
  const d = new Date(dueDate + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function playCompletionSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    [520, 780].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.3);
    });
  } catch {}
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(true);
  const { showToast } = useToast();

  // Collapsed projects (tasks hidden) — persisted in localStorage
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem("dashboard-collapsed-projects");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [completingTask, setCompletingTask] = useState<string | null>(null);

  // Edit task modal state
  const [editTaskModalOpen, setEditTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [editTaskForm, setEditTaskForm] = useState({ name: "", description: "", dueDate: "", ownerId: "", url: "" });
  const [savingEditTask, setSavingEditTask] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithCounts | null>(null);
  const [form, setForm] = useState({ name: "", description: "", status: "active", category: "" });
  const [saving, setSaving] = useState(false);

  // Task add modal state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [equityScores, setEquityScores] = useState<EquityScore[]>([]);

  // Team Pulse widget collapsed state
  const [teamPulseCollapsed, setTeamPulseCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("dashboard-team-pulse-collapsed") === "true"; }
    catch { return false; }
  });
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    projectId: "",
    name: "",
    description: "",
    type: "one-time" as "recurring" | "one-time",
    recurrence: "quarterly",
    dueDate: new Date().toISOString().split("T")[0],
    ownerId: "",
    isPerMemberCheckIn: false,
    templateId: "",
    url: "",
  });
  const [savingTask, setSavingTask] = useState(false);

  // Category management
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryColorMap, setCategoryColorMap] = useState<Record<string, string>>({});
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");

  // Stats
  const stats = useMemo(() => {
    const activeProjects = projects.filter((p) => p.status === "active").length;
    const totalReqs = projects.reduce((s, p) => s + Number(p.totalRequirements), 0);
    const completedReqs = projects.reduce((s, p) => s + Number(p.completedRequirements), 0);
    const pct = totalReqs > 0 ? Math.round((completedReqs / totalReqs) * 100) : 100;
    const onHold = projects.filter((p) => p.status === "on-hold").length;
    const done = projects.filter((p) => p.status === "completed").length;
    return { activeProjects, totalReqs, completedReqs, pct, onHold, done };
  }, [projects]);

  // Focus mode: hide projects at 100% (all tasks done)
  const displayProjects = useMemo(() => {
    if (!focusMode) return projects;
    return projects.filter(
      (p) => Number(p.totalRequirements) - Number(p.completedRequirements) > 0
    );
  }, [projects, focusMode]);

  // Group by category
  const projectsByCategory = useMemo(() => {
    const map: Record<string, ProjectWithCounts[]> = {};
    for (const p of displayProjects) {
      const cat = p.category || "Uncategorized";
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    }
    return map;
  }, [displayProjects]);

  const sortedCategories = useMemo(() => {
    return Object.keys(projectsByCategory).sort((a, b) => {
      if (a === "Uncategorized") return 1;
      if (b === "Uncategorized") return -1;
      return a.localeCompare(b);
    });
  }, [projectsByCategory]);

  // Top 3 pending tasks
  const topTasks = useMemo(() => {
    return tasks
      .filter((t) => t.status === "pending" || t.status === "overdue")
      .sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      })
      .slice(0, 3);
  }, [tasks]);

  // Group open tasks by project for inline display
  const tasksByProject = useMemo(() => {
    const map: Record<string, TaskItem[]> = {};
    for (const t of tasks) {
      if (t.status !== "pending" && t.status !== "overdue") continue;
      if (!map[t.projectId]) map[t.projectId] = [];
      map[t.projectId].push(t);
    }
    // Sort each group by due date
    for (const pid of Object.keys(map)) {
      map[pid].sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    }
    return map;
  }, [tasks]);

  const toggleProjectTasks = (projectId: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      localStorage.setItem("dashboard-collapsed-projects", JSON.stringify([...next]));
      return next;
    });
  };

  const handleCompleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCompletingTask(taskId);
    try {
      await fetch("/api/requirements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: "completed" }),
      });
      playCompletionSound();
      if (navigator.vibrate) navigator.vibrate(80);
      showToast("Task completed", "success");
      await fetchData();
    } catch {
      showToast("Failed to complete task", "error");
    } finally {
      setCompletingTask(null);
    }
  };

  const openEditTask = (task: TaskItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingTask(task);
    setEditTaskForm({
      name: task.name,
      description: task.description || "",
      dueDate: task.dueDate || "",
      ownerId: task.ownerId || "",
      url: task.url || "",
    });
    setEditTaskModalOpen(true);
  };

  const handleSaveEditTask = async () => {
    if (!editingTask || !editTaskForm.name.trim()) return;
    setSavingEditTask(true);
    try {
      await fetch("/api/requirements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTask.id,
          name: editTaskForm.name.trim(),
          description: editTaskForm.description.trim() || null,
          dueDate: editTaskForm.dueDate || null,
          ownerId: editTaskForm.ownerId || null,
          url: editTaskForm.url.trim() || null,
        }),
      });
      showToast("Task updated", "success");
      setEditTaskModalOpen(false);
      await fetchData();
    } catch {
      showToast("Failed to update task", "error");
    } finally {
      setSavingEditTask(false);
    }
  };

  const handleDeleteTaskFromEdit = async () => {
    if (!editingTask) return;
    if (!confirm(`Are you sure you want to delete "${editingTask.name}"?`)) return;
    try {
      await fetch("/api/requirements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingTask.id }),
      });
      showToast("Task deleted", "success");
      setEditTaskModalOpen(false);
      await fetchData();
    } catch {
      showToast("Failed to delete task", "error");
    }
  };

  const fetchData = async () => {
    try {
      const [projRes, taskRes, teamRes, tmplRes, equityRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/requirements"),
        fetch("/api/team"),
        fetch("/api/check-in-templates"),
        fetch("/api/management-equity"),
      ]);
      const [projJson, taskJson, teamJson, tmplJson, equityJson] = await Promise.all([
        projRes.json(),
        taskRes.json(),
        teamRes.json(),
        tmplRes.json(),
        equityRes.json(),
      ]);
      const projectsData = projJson.data || [];
      setProjects(projectsData);
      setTasks(taskJson.data || []);
      setTeamMembers(teamJson.data || []);
      setTemplates(tmplJson.data || []);
      setEquityScores(equityJson.data || []);
      const uniqueCategories = Array.from(
        new Set(projectsData.map((p: ProjectWithCounts) => p.category).filter(Boolean))
      ) as string[];
      setCategories(uniqueCategories.sort());
      setCategoryColorMap(buildCategoryColorMap(projectsData));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ── Modal handlers ──
  const openCreate = () => {
    setEditingProject(null);
    setForm({ name: "", description: "", status: "active", category: "" });
    setShowNewCategory(false);
    setNewCategoryInput("");
    setModalOpen(true);
  };

  const openEdit = (project: ProjectWithCounts) => {
    setEditingProject(project);
    setForm({
      name: project.name,
      description: project.description || "",
      status: project.status,
      category: project.category || "",
    });
    setShowNewCategory(false);
    setNewCategoryInput("");
    setModalOpen(true);
  };

  const handleCategoryChange = (value: string) => {
    if (value === "__new__") {
      setShowNewCategory(true);
      setForm({ ...form, category: "" });
    } else {
      setShowNewCategory(false);
      setForm({ ...form, category: value });
    }
  };

  const handleNewCategoryConfirm = () => {
    if (newCategoryInput.trim()) {
      setForm({ ...form, category: newCategoryInput.trim() });
      setShowNewCategory(false);
      setNewCategoryInput("");
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        category: form.category || null,
        color: getCategoryColor(form.category || null, categoryColorMap),
      };
      if (editingProject) {
        const res = await fetch("/api/projects", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingProject.id, ...payload }),
        });
        const json = await res.json();
        if (!res.ok) {
          showToast(json.error || "Update failed", "error");
          return;
        }
        showToast("Project updated", "success");
      } else {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) {
          showToast(json.error || "Create failed", "error");
          return;
        }
        showToast(`Created "${form.name}"`, "success");
      }
      setModalOpen(false);
      await fetchData();
    } finally {
      setSaving(false);
    }
  };

  // ── Task modal handlers ──
  const openAddTask = () => {
    const mihir = teamMembers.find((m) => m.nick.toLowerCase() === "mihir");
    setTaskForm({
      projectId: projects.length > 0 ? projects[0].id : "",
      name: "",
      description: "",
      type: "one-time",
      recurrence: "quarterly",
      dueDate: new Date().toISOString().split("T")[0],
      ownerId: mihir?.id || "",
      isPerMemberCheckIn: false,
      templateId: "",
      url: "",
    });
    setTaskModalOpen(true);
  };

  const handleAddTask = async () => {
    if (!taskForm.name.trim() || !taskForm.projectId) return;
    setSavingTask(true);
    try {
      const res = await fetch("/api/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: taskForm.projectId,
          name: taskForm.name,
          description: taskForm.description || null,
          type: taskForm.type,
          recurrence: taskForm.type === "recurring" ? taskForm.recurrence : null,
          dueDate: taskForm.dueDate,
          ownerId: taskForm.ownerId || null,
          isPerMemberCheckIn: taskForm.isPerMemberCheckIn,
          templateId: taskForm.templateId || null,
          url: taskForm.url.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || "Failed to create task", "error");
        return;
      }
      showToast(`Created "${taskForm.name}"`, "success");
      setTaskModalOpen(false);
      await fetchData();
    } catch {
      showToast("Failed to create task", "error");
    } finally {
      setSavingTask(false);
    }
  };

  // Visible categories (filtered by sidebar selection)
  const visibleCategories = sortedCategories.filter(
    (cat) => !activeCategory || activeCategory === cat
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-secondary text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn dashboard-bg">
      {/* ─── Header Row: Momentum + Top Tasks + Stats + New Project ─── */}
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto_auto] gap-3 mb-4">
        {/* Weekly Momentum */}
        <div className="mosaic-glass flex items-center gap-4 px-5 py-3">
          <MomentumRing percentage={stats.pct} size={60} />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted font-semibold">
              Weekly Momentum
            </p>
            <p className="text-lg font-bold text-primary leading-tight">
              {stats.completedReqs}
              <span className="text-muted font-normal text-xs"> / {stats.totalReqs}</span>
            </p>
            <p className="text-[10px] text-muted mt-0.5">
              {stats.activeProjects} active &middot; {stats.onHold} paused &middot; {stats.done} done
            </p>
          </div>
        </div>

        {/* Top 3 Tasks */}
        <div className="mosaic-glass px-5 py-3 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-widest text-muted font-semibold">
              Priority Tasks
            </p>
          </div>
          {topTasks.length === 0 ? (
            <p className="text-xs text-muted italic">All clear — no pending tasks</p>
          ) : (
            <div className="space-y-1.5">
              {topTasks.map((task, i) => (
                <Link
                  key={task.id}
                  href={`/projects/${task.projectId}`}
                  className="flex items-center gap-2 min-w-0 group"
                  style={{ textDecoration: "none" }}
                >
                  <span className="text-[10px] font-bold w-4 text-muted flex-shrink-0">
                    {i + 1}.
                  </span>
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: task.projectColor || "#4f6ff5",
                      boxShadow: `0 0 4px ${task.projectColor || "#4f6ff5"}60`,
                    }}
                  />
                  <span className="text-xs text-primary truncate flex-1 group-hover:text-accent-blue transition-colors">
                    {task.name}
                  </span>
                  {task.projectName && (
                    <span className="text-[9px] text-muted flex-shrink-0 hidden sm:inline">
                      {task.projectName}
                    </span>
                  )}
                  {task.dueDate && (
                    <span className="text-[10px] text-muted flex-shrink-0 tabular-nums">
                      {task.dueDate}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Compact Stats */}
        <div className="flex md:flex-col gap-1.5 col-span-1 md:col-span-1">
          <Link href="/projects?status=active" className="mosaic-stat flex-1" style={{ textDecoration: "none" }}>
            <p className="text-lg font-bold" style={{ color: "#4f6ff5" }}>{stats.activeProjects}</p>
            <p className="text-[9px] text-muted uppercase tracking-wide">Active</p>
          </Link>
          <Link href="/tasks" className="mosaic-stat flex-1" style={{ textDecoration: "none" }}>
            <p className="text-lg font-bold" style={{ color: "#34d399" }}>{stats.completedReqs}</p>
            <p className="text-[9px] text-muted uppercase tracking-wide">Done</p>
          </Link>
        </div>

        {/* New Task + New Project */}
        <div className="flex md:flex-col gap-1.5">
          <button
            onClick={openAddTask}
            className="mosaic-glass-accent flex md:flex-col items-center justify-center px-5 py-3 gap-2 md:gap-1 flex-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            <span className="text-white text-[10px] font-semibold uppercase tracking-wider">
              New Task
            </span>
          </button>
          <button
            onClick={openCreate}
            className="mosaic-glass-accent flex md:flex-col items-center justify-center px-5 py-3 gap-2 md:gap-1 flex-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            <span className="text-white text-[10px] font-semibold uppercase tracking-wider">
              New Project
            </span>
          </button>
        </div>
      </div>

      {/* ─── Direct Reports Pulse ─── */}
      {equityScores.length > 0 && (
        <div className="mosaic-glass mb-3 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-default)]">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-muted font-semibold">
                Direct Reports Pulse
              </span>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: "rgba(79,111,245,0.15)", color: "#4f6ff5" }}
              >
                {equityScores.length}
              </span>
              {/* Nudge pills — show up to 2 low-attention names inline */}
              {equityScores
                .filter((e) => e.score < 50)
                .slice(0, 2)
                .map((e) => (
                  <Link
                    key={e.memberId}
                    href={`/team/${e.memberId}`}
                    className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-medium transition-opacity hover:opacity-80"
                    style={{ backgroundColor: "rgba(251,191,36,0.15)", color: "#fbbf24", textDecoration: "none" }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: e.score < 25 ? "#f87171" : "#fbbf24" }}
                    />
                    {e.nick} · {e.daysSinceLastInteraction >= 31 ? "31+" : e.daysSinceLastInteraction}d
                  </Link>
                ))}
            </div>
            <button
              onClick={() => {
                const next = !teamPulseCollapsed;
                setTeamPulseCollapsed(next);
                localStorage.setItem("dashboard-team-pulse-collapsed", String(next));
              }}
              className="text-muted hover:text-primary transition-colors p-0.5"
              title={teamPulseCollapsed ? "Expand" : "Collapse"}
            >
              <svg
                width="12" height="12" viewBox="0 0 12 12"
                className="transition-transform duration-200"
                style={{ transform: teamPulseCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
              >
                <path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {!teamPulseCollapsed && (
            <div className="px-4 py-2">
              {/* Nudge rows — only members with score < 75 */}
              {equityScores.some((e) => e.score < 75) && (
                <div className="mb-2 space-y-1">
                  {equityScores
                    .filter((e) => e.score < 75)
                    .slice(0, 3)
                    .map((e) => {
                      const daysText = e.daysSinceLastInteraction >= 31
                        ? "over 30 days"
                        : `${e.daysSinceLastInteraction}d ago`;
                      const total = e.observationCount + e.managerCommentCount;
                      return (
                        <Link
                          key={e.memberId}
                          href={`/team/${e.memberId}`}
                          className="flex items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-tertiary"
                          style={{ textDecoration: "none" }}
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: e.score < 25 ? "#f87171" : "#fbbf24" }}
                          />
                          <span className="text-secondary text-xs flex-1 truncate">
                            {total === 0
                              ? `No notes logged for ${e.nick} in 30 days`
                              : `${e.nick} — last interaction ${daysText}`}
                          </span>
                          <span className="text-muted text-[10px] flex-shrink-0">Check in →</span>
                        </Link>
                      );
                    })}
                </div>
              )}

              {/* Roster strip — all directs */}
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {equityScores.map((e) => {
                  const color =
                    e.score < 25 ? "#f87171"
                    : e.score < 50 ? "#fbbf24"
                    : e.score < 75 ? "#60a5fa"
                    : "#34d399";
                  return (
                    <Link
                      key={e.memberId}
                      href={`/team/${e.memberId}`}
                      className="flex items-center gap-2 min-w-[140px] hover:opacity-80 transition-opacity"
                      style={{ textDecoration: "none" }}
                    >
                      <span className="text-primary text-[11px] font-medium w-16 truncate">{e.nick}</span>
                      <div
                        className="rounded-full overflow-hidden flex-shrink-0"
                        style={{ width: "40px", height: "4px", backgroundColor: "var(--bg-tertiary)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${e.score}%`, backgroundColor: color }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums" style={{ color, minWidth: "24px" }}>
                        {e.daysSinceLastInteraction >= 31 ? "31+" : e.daysSinceLastInteraction}d
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Focus Toggle (mobile) ─── */}
      <div className="flex md:hidden items-center justify-between mb-2">
        <button
          onClick={() => setFocusMode(!focusMode)}
          className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors"
          style={{ color: focusMode ? "#4f6ff5" : "var(--text-muted)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            {focusMode
              ? <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
              : <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
            }
          </svg>
          Focus {focusMode ? "On" : "Off"}
        </button>
        {focusMode && displayProjects.length < projects.length && (
          <span className="text-[9px] text-muted">
            {projects.length - displayProjects.length} completed hidden
          </span>
        )}
      </div>

      {/* ─── Main: Focus Sidebar + Category Grid ─── */}
      <div className="flex gap-3">
        {/* Focus Mode Sidebar — hidden on mobile */}
        <div className="hidden md:flex flex-col gap-1.5 flex-shrink-0 w-[52px]">
          {/* Focus toggle */}
          <button
            onClick={() => setFocusMode(!focusMode)}
            className={`mosaic-icon-btn ${focusMode ? "mosaic-icon-active" : ""}`}
            title={focusMode ? "Focus: showing incomplete only" : "Focus: showing all projects"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" opacity={focusMode ? 0.9 : 0.4}>
              {focusMode
                ? <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                : <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
              }
            </svg>
          </button>

          {/* Divider */}
          <div className="h-px mx-2 bg-[var(--border-default)]" />

          {/* All button */}
          <button
            onClick={() => setActiveCategory(null)}
            className={`mosaic-icon-btn ${activeCategory === null ? "mosaic-icon-active" : ""}`}
            title="All categories"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" opacity={activeCategory === null ? 0.9 : 0.4}>
              <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z" />
            </svg>
          </button>

          {sortedCategories.map((cat, i) => {
            const color = getCategoryColor(cat === "Uncategorized" ? null : cat, categoryColorMap);
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(isActive ? null : cat)}
                className={`mosaic-icon-btn ${isActive ? "mosaic-icon-active" : ""}`}
                title={cat}
                style={isActive ? ({ "--glow-color": `${color}50` } as React.CSSProperties) : undefined}
              >
                <CategoryIcon index={i} color={color} active={isActive} />
              </button>
            );
          })}
        </div>

        {/* Category Cards Grid */}
        <div className="flex-1 min-w-0">
          {visibleCategories.length === 0 ? (
            <div className="mosaic-glass flex items-center justify-center py-16">
              <div className="text-center">
                {focusMode && projects.length > 0 ? (
                  <>
                    <p className="text-muted text-sm mb-1">All projects are complete</p>
                    <p className="text-muted text-xs mb-3">
                      {projects.length} project{projects.length !== 1 ? "s" : ""} hidden by Focus Mode
                    </p>
                    <button
                      onClick={() => setFocusMode(false)}
                      className="text-xs font-medium transition-colors"
                      style={{ color: "#4f6ff5" }}
                    >
                      Show all projects
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-muted text-sm mb-3">No projects yet</p>
                    <button onClick={openCreate} className="btn-primary text-sm">
                      Create your first project
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {visibleCategories.map((category, catIdx) => {
                const catProjects = projectsByCategory[category];
                const color = getCategoryColor(
                  category === "Uncategorized" ? null : category,
                  categoryColorMap
                );
                const catCompleted = catProjects.reduce(
                  (s, p) => s + Number(p.completedRequirements),
                  0
                );
                const catTotal = catProjects.reduce(
                  (s, p) => s + Number(p.totalRequirements),
                  0
                );
                const catPct = catTotal > 0 ? Math.round((catCompleted / catTotal) * 100) : 100;

                return (
                  <div
                    key={category}
                    className={`mosaic-card ${activeCategory === category ? "mosaic-card-active" : ""}`}
                    style={{ "--card-accent": color } as React.CSSProperties}
                  >
                    {/* Card top accent line */}
                    <div
                      className="h-[2px]"
                      style={{
                        background: `linear-gradient(90deg, ${color}, transparent)`,
                        opacity: 0.6,
                      }}
                    />

                    {/* Card Header */}
                    <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: color,
                            boxShadow: `0 0 6px ${color}50`,
                          }}
                        />
                        <h3 className="text-xs font-bold text-primary truncate">{category}</h3>
                        <span className="text-[9px] text-muted">
                          {catProjects.length}p
                        </span>
                      </div>
                      <span
                        className="text-[10px] font-bold tabular-nums"
                        style={{ color }}
                      >
                        {catPct}%
                      </span>
                    </div>

                    {/* Category Progress Bar */}
                    <div className="mx-3 mb-2">
                      <div className="h-[2px] rounded-full bg-tertiary overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${catPct}%`,
                            backgroundColor: color,
                            boxShadow: `0 0 8px ${color}60`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Project Rows with Inline Tasks */}
                    <div className="px-2 pb-2.5 space-y-0.5">
                      {catProjects.map((project) => {
                        const projPct =
                          project.totalRequirements > 0
                            ? Math.round(
                                (project.completedRequirements / project.totalRequirements) * 100
                              )
                            : 100;
                        const openTasks = tasksByProject[project.id] || [];
                        const isCollapsed = collapsedProjects.has(project.id);
                        return (
                          <div key={project.id}>
                            {/* Project Header Row */}
                            <div className="mosaic-row group flex items-center gap-2">
                              {/* Expand/Collapse chevron */}
                              {openTasks.length > 0 ? (
                                <button
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleProjectTasks(project.id); }}
                                  className="flex-shrink-0 p-0.5 rounded hover:bg-tertiary transition-colors"
                                  title={isCollapsed ? "Show tasks" : "Hide tasks"}
                                >
                                  <svg
                                    width="12" height="12" viewBox="0 0 12 12"
                                    className="text-muted transition-transform duration-200"
                                    style={{ transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
                                  >
                                    <path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                              ) : (
                                <div className="w-[16px] flex-shrink-0" />
                              )}
                              <div
                                className="w-[3px] h-6 rounded-full flex-shrink-0 transition-opacity"
                                style={{
                                  backgroundColor: color,
                                  opacity: project.status === "completed" ? 0.25 : 0.65,
                                }}
                              />
                              <Link
                                href={`/projects/${project.id}`}
                                className="min-w-0 flex-1 no-underline"
                              >
                                <p className="text-[11px] font-medium text-primary truncate leading-tight group-hover:text-accent-blue transition-colors">
                                  {project.name}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <div
                                    className="h-[2px] rounded-full bg-tertiary flex-1"
                                    style={{ maxWidth: 64 }}
                                  >
                                    <div
                                      className="h-full rounded-full transition-all duration-500"
                                      style={{
                                        width: `${projPct}%`,
                                        backgroundColor: color,
                                      }}
                                    />
                                  </div>
                                  <span className="text-[9px] text-muted tabular-nums">
                                    {project.completedRequirements}/{project.totalRequirements}
                                  </span>
                                </div>
                              </Link>
                              <Sparkline
                                completed={project.completedRequirements}
                                total={project.totalRequirements}
                                color={color}
                              />
                            </div>

                            {/* Inline Open Tasks */}
                            {openTasks.length > 0 && !isCollapsed && (
                              <div className="ml-[35px] pl-2 border-l border-default space-y-px mb-1">
                                {openTasks.map((task) => {
                                  const overdue = task.status === "overdue" || isOverdue(task.dueDate);
                                  return (
                                    <div
                                      key={task.id}
                                      className="flex items-center gap-1.5 py-[3px] px-1.5 rounded hover:bg-tertiary transition-colors group/task"
                                    >
                                      <button
                                        onClick={(e) => handleCompleteTask(task.id, e)}
                                        disabled={completingTask === task.id}
                                        className="flex-shrink-0 w-[14px] h-[14px] rounded-full border-[1.5px] flex items-center justify-center transition-colors"
                                        style={{
                                          borderColor: completingTask === task.id ? "#10b981" : overdue ? "#f87171" : "var(--border-default)",
                                          backgroundColor: completingTask === task.id ? "#10b981" : "transparent",
                                        }}
                                        title="Mark complete"
                                      >
                                        {completingTask === task.id && (
                                          <svg width="8" height="8" viewBox="0 0 8 8">
                                            <path d="M1.5 4L3.5 6L6.5 2" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                          </svg>
                                        )}
                                      </button>
                                      <button
                                        onClick={(e) => openEditTask(task, e)}
                                        className="text-[10px] text-primary truncate flex-1 leading-tight text-left hover:underline cursor-pointer"
                                        title="Edit task"
                                      >
                                        {task.name}
                                      </button>
                                      {task.dueDate && (
                                        <span
                                          className="text-[9px] tabular-nums flex-shrink-0"
                                          style={{ color: overdue ? "#f87171" : "var(--text-muted)" }}
                                        >
                                          {formatShortDate(task.dueDate)}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Create / Edit Modal ─── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProject ? "Edit Project" : "New Project"}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted mb-1 block">Project Name</label>
            <input
              className="input-field"
              placeholder="e.g. Security Compliance"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Description (optional)</label>
            <textarea
              className="input-field"
              rows={2}
              placeholder="What is this project about?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Category (optional)</label>
            {!showNewCategory ? (
              <>
                <select
                  className="input-field"
                  value={form.category || ""}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                >
                  <option value="">No category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="__new__">+ Add new category</option>
                </select>
                {form.category && !categories.includes(form.category) && (
                  <p className="text-xs mt-1" style={{ color: "#34d399" }}>
                    New category &quot;{form.category}&quot; will be created
                  </p>
                )}
              </>
            ) : (
              <div className="flex gap-2">
                <input
                  className="input-field flex-1"
                  placeholder="Enter category name"
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleNewCategoryConfirm();
                    if (e.key === "Escape") {
                      setShowNewCategory(false);
                      setNewCategoryInput("");
                    }
                  }}
                  autoFocus
                />
                <button
                  className="btn-primary"
                  onClick={handleNewCategoryConfirm}
                  disabled={!newCategoryInput.trim()}
                >
                  Add
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setShowNewCategory(false);
                    setNewCategoryInput("");
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Status</label>
            <select
              className="input-field"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1).replace("-", " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
            >
              {saving ? "Saving..." : editingProject ? "Save Changes" : "Create Project"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Add Task Modal ─── */}
      <Modal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        title="Add Task"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted mb-1 block">Project</label>
            <select
              className="input-field"
              value={taskForm.projectId}
              onChange={(e) => setTaskForm({ ...taskForm, projectId: e.target.value })}
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
              value={taskForm.name}
              onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Description (optional)</label>
            <textarea
              className="input-field"
              rows={2}
              placeholder="Details..."
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
            />
          </div>

          {/* Type toggle */}
          <div className="flex gap-2">
            {["one-time", "recurring"].map((t) => (
              <button
                key={t}
                onClick={() => setTaskForm({ ...taskForm, type: t as any })}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  taskForm.type === t
                    ? "bg-[#4f6ff5] text-white"
                    : "bg-tertiary text-secondary"
                }`}
              >
                {t === "one-time" ? "One-time" : "Recurring"}
              </button>
            ))}
          </div>

          {taskForm.type === "recurring" && (
            <div>
              <label className="text-xs text-muted mb-1 block">Recurrence</label>
              <select
                className="input-field"
                value={taskForm.recurrence}
                onChange={(e) => setTaskForm({ ...taskForm, recurrence: e.target.value })}
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
              value={taskForm.dueDate}
              onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Owner (optional)</label>
            <select
              className="input-field"
              value={taskForm.ownerId}
              onChange={(e) => setTaskForm({ ...taskForm, ownerId: e.target.value })}
            >
              <option value="">Unassigned</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nick} — {m.role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">URL (optional)</label>
            <input
              className="input-field"
              type="url"
              placeholder="https://..."
              value={taskForm.url}
              onChange={(e) => setTaskForm({ ...taskForm, url: e.target.value })}
            />
          </div>

          {/* Per-member check-in toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-default" style={{ backgroundColor: "var(--bg-secondary)" }}>
            <div>
              <p className="text-sm text-primary font-medium">Per-member check-in</p>
              <p className="text-xs text-muted">One submission per team member each cycle</p>
            </div>
            <button
              onClick={() =>
                setTaskForm({
                  ...taskForm,
                  isPerMemberCheckIn: !taskForm.isPerMemberCheckIn,
                  templateId: "",
                })
              }
              className="w-10 h-5 rounded-full transition-colors relative"
              style={{ backgroundColor: taskForm.isPerMemberCheckIn ? "#4f6ff5" : "#d1d5db" }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                style={{ left: taskForm.isPerMemberCheckIn ? "22px" : "2px" }}
              />
            </button>
          </div>

          {/* Template picker — only if per-member is on */}
          {taskForm.isPerMemberCheckIn && (
            <div>
              <label className="text-xs text-muted mb-1 block">Check-in Template (optional)</label>
              <select
                className="input-field"
                value={taskForm.templateId}
                onChange={(e) => setTaskForm({ ...taskForm, templateId: e.target.value })}
              >
                <option value="">No template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setTaskModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleAddTask}
              disabled={savingTask || !taskForm.name.trim() || !taskForm.projectId}
            >
              {savingTask ? "Adding..." : "Add Task"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Edit Task Modal ─── */}
      <Modal
        open={editTaskModalOpen}
        onClose={() => setEditTaskModalOpen(false)}
        title="Edit Task"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted mb-1 block">Task Name</label>
            <input
              className="input-field"
              value={editTaskForm.name}
              onChange={(e) => setEditTaskForm({ ...editTaskForm, name: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Description (optional)</label>
            <textarea
              className="input-field"
              rows={2}
              value={editTaskForm.description}
              onChange={(e) => setEditTaskForm({ ...editTaskForm, description: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Due Date</label>
            <input
              type="date"
              className="input-field"
              value={editTaskForm.dueDate}
              onChange={(e) => setEditTaskForm({ ...editTaskForm, dueDate: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Owner (optional)</label>
            <select
              className="input-field"
              value={editTaskForm.ownerId}
              onChange={(e) => setEditTaskForm({ ...editTaskForm, ownerId: e.target.value })}
            >
              <option value="">Unassigned</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nick} — {m.role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">URL (optional)</label>
            <input
              className="input-field"
              type="url"
              placeholder="https://..."
              value={editTaskForm.url}
              onChange={(e) => setEditTaskForm({ ...editTaskForm, url: e.target.value })}
            />
          </div>

          <div className="flex justify-between gap-2 pt-2">
            <button className="btn-danger" onClick={handleDeleteTaskFromEdit}>
              Delete Task
            </button>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setEditTaskModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSaveEditTask}
                disabled={savingEditTask || !editTaskForm.name.trim()}
              >
                {savingEditTask ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
