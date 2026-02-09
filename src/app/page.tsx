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
  status: string;
  dueDate: string | null;
  projectName: string | null;
  projectColor: string | null;
  projectId: string;
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

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { showToast } = useToast();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithCounts | null>(null);
  const [form, setForm] = useState({ name: "", description: "", status: "active", category: "" });
  const [saving, setSaving] = useState(false);

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

  // Group by category
  const projectsByCategory = useMemo(() => {
    const map: Record<string, ProjectWithCounts[]> = {};
    for (const p of projects) {
      const cat = p.category || "Uncategorized";
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    }
    return map;
  }, [projects]);

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

  const fetchData = async () => {
    try {
      const [projRes, taskRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/requirements"),
      ]);
      const projJson = await projRes.json();
      const taskJson = await taskRes.json();
      const projectsData = projJson.data || [];
      setProjects(projectsData);
      setTasks(taskJson.data || []);
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
    <div className="animate-fadeIn">
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
          <p className="text-[10px] uppercase tracking-widest text-muted font-semibold mb-2">
            Priority Tasks
          </p>
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

        {/* Compact Stats + New Project — side by side on mobile */}
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

        {/* New Project */}
        <button
          onClick={openCreate}
          className="mosaic-glass-accent flex md:flex-col items-center justify-center px-5 py-3 gap-2 md:gap-1"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          <span className="text-white text-[10px] font-semibold uppercase tracking-wider">
            New Project
          </span>
        </button>
      </div>

      {/* ─── Main: Focus Sidebar + Category Grid ─── */}
      <div className="flex gap-3">
        {/* Focus Mode Sidebar — hidden on mobile */}
        <div className="hidden md:flex flex-col gap-1.5 flex-shrink-0 w-[52px]">
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
                <p className="text-muted text-sm mb-3">No projects yet</p>
                <button onClick={openCreate} className="btn-primary text-sm">
                  Create your first project
                </button>
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

                    {/* Project Rows */}
                    <div className="px-2 pb-2.5 space-y-0.5">
                      {catProjects.slice(0, 3).map((project) => {
                        const projPct =
                          project.totalRequirements > 0
                            ? Math.round(
                                (project.completedRequirements / project.totalRequirements) * 100
                              )
                            : 100;
                        return (
                          <Link
                            key={project.id}
                            href={`/projects/${project.id}`}
                            className="mosaic-row group"
                          >
                            <div
                              className="w-[3px] h-6 rounded-full flex-shrink-0 transition-opacity"
                              style={{
                                backgroundColor: color,
                                opacity: project.status === "completed" ? 0.25 : 0.65,
                              }}
                            />
                            <div className="min-w-0 flex-1">
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
                            </div>
                            <Sparkline
                              completed={project.completedRequirements}
                              total={project.totalRequirements}
                              color={color}
                            />
                          </Link>
                        );
                      })}
                      {catProjects.length > 3 && (
                        <Link
                          href="/projects"
                          className="block text-[9px] text-muted text-center pt-1 hover:text-primary transition-colors"
                          style={{ textDecoration: "none" }}
                        >
                          +{catProjects.length - 3} more
                        </Link>
                      )}
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
    </div>
  );
}
