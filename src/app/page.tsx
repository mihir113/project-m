"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";

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

const COLOR_OPTIONS = [
  "#4f6ff5", "#e879a0", "#a78bfa", "#60a5fa",
  "#34d399", "#fbbf24", "#fb923c", "#f472b6",
  "#38bdf8", "#4ade80", "#c084fc", "#fb7185",
];

const STATUS_OPTIONS = ["active", "on-hold", "completed"];

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { showToast } = useToast();

  // Modal state for create/edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithCounts | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    status: "active",
    color: "#4f6ff5",
    category: "",
  });
  const [saving, setSaving] = useState(false);

  // Category management
  const [categories, setCategories] = useState<string[]>([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");

  // Collapsed categories (persisted in localStorage)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem("dashboard-collapsed-categories");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      localStorage.setItem("dashboard-collapsed-categories", JSON.stringify([...next]));
      return next;
    });
  };

  // Summary stats — computed from projects data
  const stats = {
    activeProjects: projects.filter((p) => p.status === "active").length,
    totalRequirements: projects.reduce((sum, p) => sum + Number(p.totalRequirements), 0),
    completedRequirements: projects.reduce((sum, p) => sum + Number(p.completedRequirements), 0),
  };
  const completionPct =
    stats.totalRequirements > 0
      ? Math.round((stats.completedRequirements / stats.totalRequirements) * 100)
      : 0;

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const json = await res.json();
      const projectsData = json.data || [];
      setProjects(projectsData);

      // Extract unique categories
      const uniqueCategories = Array.from(
        new Set(projectsData.map((p: ProjectWithCounts) => p.category).filter(Boolean))
      ) as string[];
      setCategories(uniqueCategories.sort());
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // ── Open modal for Create or Edit ──
  const openCreate = () => {
    setEditingProject(null);
    setForm({ name: "", description: "", status: "active", color: "#4f6ff5", category: "" });
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
      color: project.color,
      category: project.category || "",
    });
    setShowNewCategory(false);
    setNewCategoryInput("");
    setModalOpen(true);
  };

  // ── Handle category selection ──
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

  // ── Save (create or update) ──
  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, category: form.category || null };

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
      await fetchProjects();
    } finally {
      setSaving(false);
    }
  };

  // Filter projects by status
  const filteredProjects = projects.filter((p) => {
    if (statusFilter === "all") return true;
    return p.status === statusFilter;
  });

  // Group projects by category
  const projectsByCategory = filteredProjects.reduce<Record<string, ProjectWithCounts[]>>((acc, project) => {
    const category = project.category || "Uncategorized";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(project);
    return acc;
  }, {});

  // Sort categories alphabetically, but keep "Uncategorized" at the end
  const sortedCategories = Object.keys(projectsByCategory).sort((a, b) => {
    if (a === "Uncategorized") return 1;
    if (b === "Uncategorized") return -1;
    return a.localeCompare(b);
  });

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Dashboard</h1>
          <p className="text-secondary text-sm mt-1">Welcome back to Project M</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          + New Project
        </button>
      </div>

      {/* Stat Cards — each is a drill-down link */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Active Projects" value={stats.activeProjects} color="#4f6ff5" href="/projects?status=active" />
        <StatCard label="Total Tasks" value={stats.totalRequirements} color="#9a9eb5" href="/tasks" />
        <StatCard label="Completed" value={stats.completedRequirements} color="#34d399" href="/projects?status=completed" />
      </div>

      {/* Filters and Projects */}
      <div className="space-y-6">
        {/* Filter Bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-primary">Projects by Category</h2>
          <div className="flex items-center gap-3">
            {/* Status Filter */}
            <div className="flex gap-1 rounded-lg p-1 bg-tertiary">
              {["all", "active", "on-hold", "completed"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? "bg-elevated text-primary"
                      : "text-secondary"
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1).replace("-", " ")}
                </button>
              ))}
            </div>
            <Link href="/projects" className="text-sm whitespace-nowrap" style={{ color: "#4f6ff5" }}>
              View all →
            </Link>
          </div>
        </div>

        {/* Projects Grouped by Category */}
        {filteredProjects.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-muted text-sm">
              {projects.length === 0
                ? "No projects yet. Create your first project to get started!"
                : "No projects match the selected filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedCategories.map((category) => (
              <div key={category} className="card p-6">
                {/* Category Header */}
                <div
                  className="flex items-center gap-3 pb-3 border-b border-default cursor-pointer select-none"
                  onClick={() => toggleCategory(category)}
                >
                  <svg
                    className={`w-4 h-4 text-muted transition-transform duration-200 ${collapsedCategories.has(category) ? "" : "rotate-90"}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-primary">{category}</h3>
                    <p className="text-xs text-muted mt-0.5">
                      {projectsByCategory[category].length} project{projectsByCategory[category].length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {/* Project Cards Grid */}
                {!collapsedCategories.has(category) && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  {projectsByCategory[category].map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="block p-4 rounded-lg border border-default hover:shadow-md transition-all bg-secondary"
                      style={{ textDecoration: "none" }}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                          style={{ backgroundColor: project.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-primary mb-1 break-words">
                            {project.name}
                          </h4>
                          <span className={`badge-${project.status} text-xs`}>
                            {project.status}
                          </span>
                        </div>
                      </div>

                      {project.description && (
                        <p className="text-xs text-secondary mb-3 line-clamp-2">
                          {project.description}
                        </p>
                      )}

                      {/* Progress */}
                      <div>
                        <div className="flex justify-between text-xs text-muted mb-1">
                          <span>
                            {project.completedRequirements} / {project.totalRequirements} tasks
                          </span>
                          <span>
                            {project.totalRequirements > 0
                              ? Math.round((project.completedRequirements / project.totalRequirements) * 100)
                              : 0}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-tertiary">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${
                                project.totalRequirements > 0
                                  ? Math.round((project.completedRequirements / project.totalRequirements) * 100)
                                  : 0
                              }%`,
                              backgroundColor: project.color,
                            }}
                          />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingProject ? "Edit Project" : "New Project"}>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted mb-1 block">Project Name</label>
            <input className="input-field" placeholder="e.g. Security Compliance" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Description (optional)</label>
            <textarea className="input-field" rows={2} placeholder="What is this project about?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Category (optional)</label>
            {!showNewCategory ? (
              <>
                <select className="input-field" value={form.category || ""} onChange={(e) => handleCategoryChange(e.target.value)}>
                  <option value="">No category</option>
                  {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  <option value="__new__">+ Add new category</option>
                </select>
                {form.category && !categories.includes(form.category) && (
                  <p className="text-xs mt-1" style={{ color: "#34d399" }}>✓ New category "{form.category}" will be created</p>
                )}
              </>
            ) : (
              <div className="flex gap-2">
                <input className="input-field flex-1" placeholder="Enter category name" value={newCategoryInput} onChange={(e) => setNewCategoryInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleNewCategoryConfirm(); if (e.key === "Escape") { setShowNewCategory(false); setNewCategoryInput(""); } }} autoFocus />
                <button className="btn-primary" onClick={handleNewCategoryConfirm} disabled={!newCategoryInput.trim()}>Add</button>
                <button className="btn-ghost" onClick={() => { setShowNewCategory(false); setNewCategoryInput(""); }}>Cancel</button>
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Status</label>
            <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace("-", " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted mb-2 block">Accent Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button key={color} onClick={() => setForm({ ...form, color })} className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: color, outline: form.color === color ? `3px solid ${color}` : "none", outlineOffset: "2px" }} />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? "Saving..." : editingProject ? "Save Changes" : "Create Project"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Stat Card — clickable drill-down ───
function StatCard({ label, value, color, href }: { label: string; value: string | number; color: string; href: string }) {
  return (
    <Link
      href={href}
      className="card p-4 block transition-all duration-150 hover:bg-tertiary"
      style={{ textDecoration: "none", cursor: "pointer" }}
    >
      <p className="text-muted text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </Link>
  );
}
