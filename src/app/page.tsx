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

type ViewMode = "list" | "board";

const COLOR_OPTIONS = [
  "#4f6ff5", "#e879a0", "#a78bfa", "#60a5fa",
  "#34d399", "#fbbf24", "#fb923c", "#f472b6",
  "#38bdf8", "#4ade80", "#c084fc", "#fb7185",
];

const STATUS_OPTIONS = ["active", "on-hold", "completed"];

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
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

  // Group projects by category for board view
  const boardCategories = Array.from(
    new Set(filteredProjects.map((p) => p.category).filter(Boolean))
  ) as string[];
  const uncategorized = filteredProjects.filter((p) => !p.category);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", projectId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetCategory: string | null) => {
    e.preventDefault();
    const projectId = e.dataTransfer.getData("text/plain");
    const project = projects.find((p) => p.id === projectId);
    
    if (!project || project.category === targetCategory) return;

    // Optimistic update
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, category: targetCategory } : p))
    );

    // API update
    try {
      await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, category: targetCategory }),
      });
    } catch {
      // Revert on error
      fetchProjects();
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Projects" value={stats.activeProjects} color="#4f6ff5" href="/projects" />
        <StatCard label="Total Tasks" value={stats.totalRequirements} color="#9a9eb5" href="/tasks" />
        <StatCard label="Completed" value={stats.completedRequirements} color="#34d399" href="/projects" />
        <StatCard label="Completion %" value={`${completionPct}%`} color="#fbbf24" href="/projects" />
      </div>

      {/* View Toggle + Filters */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-primary">Projects</h2>
            {/* View Mode Toggle */}
            <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: "#1e2130" }}>
              <button
                onClick={() => setViewMode("list")}
                className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
                style={{
                  backgroundColor: viewMode === "list" ? "#252838" : "transparent",
                  color: viewMode === "list" ? "#f0f1f3" : "#9a9eb5",
                }}
              >
                List
              </button>
              <button
                onClick={() => setViewMode("board")}
                className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
                style={{
                  backgroundColor: viewMode === "board" ? "#252838" : "transparent",
                  color: viewMode === "board" ? "#f0f1f3" : "#9a9eb5",
                }}
              >
                Board
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Filter */}
            <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: "#1e2130" }}>
              {["all", "active", "on-hold", "completed"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: statusFilter === s ? "#252838" : "transparent",
                    color: statusFilter === s ? "#f0f1f3" : "#9a9eb5",
                  }}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1).replace("-", " ")}
                </button>
              ))}
            </div>
            <Link href="/projects" className="text-sm" style={{ color: "#4f6ff5" }}>
              View all →
            </Link>
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <p className="text-muted text-sm py-6 text-center">
            {projects.length === 0
              ? "No projects yet. Head to Projects to create your first one."
              : "No projects match the selected filter."}
          </p>
        ) : viewMode === "list" ? (
          <ListView projects={filteredProjects} />
        ) : (
          <BoardView
            categories={boardCategories}
            uncategorized={uncategorized}
            projects={filteredProjects}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onEdit={openEdit}
          />
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

// ─── List View ───
function ListView({ projects }: { projects: ProjectWithCounts[] }) {
  return (
    <div className="space-y-3">
      {projects.map((project) => {
        const total = Number(project.totalRequirements);
        const done = Number(project.completedRequirements);
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;

        return (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="block p-3 rounded-lg transition-colors"
            style={{ textDecoration: "none" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e2130")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
          >
            {/* Mobile-friendly layout */}
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: project.color }} />
              <div className="flex-1 min-w-0">
                {/* Header row with name and status */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-primary text-sm font-medium break-words">{project.name}</p>
                    {project.category && (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs mt-1" style={{ backgroundColor: "#1e2130", color: "#9a9eb5" }}>
                        {project.category}
                      </span>
                    )}
                  </div>
                  <span className={`badge-${project.status === "active" ? "completed" : project.status === "on-hold" ? "pending" : "completed"} flex-shrink-0 text-xs`}>
                    {project.status}
                  </span>
                </div>
                {/* Description */}
                {project.description && (
                  <p className="text-muted text-xs mb-2 line-clamp-2">{project.description}</p>
                )}
                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs text-muted mb-1">
                    <span>{done}/{total} tasks</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: "#1e2130" }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: project.color }} />
                  </div>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Board View ───
function BoardView({
  categories,
  uncategorized,
  projects,
  onDragStart,
  onDragOver,
  onDrop,
  onEdit,
}: {
  categories: string[];
  uncategorized: ProjectWithCounts[];
  projects: ProjectWithCounts[];
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, category: string | null) => void;
  onEdit: (project: ProjectWithCounts) => void;
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {/* Uncategorized Column */}
      <BoardColumn
        title="Uncategorized"
        projects={uncategorized}
        categoryKey={null}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onEdit={onEdit}
      />

      {/* Category Columns */}
      {categories.map((cat) => (
        <BoardColumn
          key={cat}
          title={cat}
          projects={projects.filter((p) => p.category === cat)}
          categoryKey={cat}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}

// ─── Board Column ───
function BoardColumn({
  title,
  projects,
  categoryKey,
  onDragStart,
  onDragOver,
  onDrop,
  onEdit,
}: {
  title: string;
  projects: ProjectWithCounts[];
  categoryKey: string | null;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, category: string | null) => void;
  onEdit: (project: ProjectWithCounts) => void;
}) {
  return (
    <div
      className="flex-shrink-0 rounded-lg p-4"
      style={{ width: "280px", backgroundColor: "#1e2130" }}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, categoryKey)}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
        <span className="text-xs text-muted">{projects.length}</span>
      </div>
      <div className="space-y-2">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} onDragStart={onDragStart} onEdit={onEdit} />
        ))}
        {projects.length === 0 && (
          <p className="text-muted text-xs text-center py-8">Drop projects here</p>
        )}
      </div>
    </div>
  );
}

// ─── Project Card (draggable) ───
function ProjectCard({
  project,
  onDragStart,
  onEdit,
}: {
  project: ProjectWithCounts;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onEdit: (project: ProjectWithCounts) => void;
}) {
  const total = Number(project.totalRequirements);
  const done = Number(project.completedRequirements);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const [showEdit, setShowEdit] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowEdit(true)}
      onMouseLeave={() => setShowEdit(false)}
    >
      <Link
        href={`/projects/${project.id}`}
        draggable
        onDragStart={(e) => onDragStart(e, project.id)}
        className="block p-3 rounded-lg transition-all cursor-move"
        style={{
          backgroundColor: "#171923",
          borderLeft: `3px solid ${project.color}`,
          textDecoration: "none",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#252838")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#171923")}
      >
        <div className="flex items-start justify-between mb-2">
          <p className="text-primary text-sm font-medium">{project.name}</p>
          <span className={`badge-${project.status === "active" ? "completed" : project.status === "on-hold" ? "pending" : "completed"} text-xs`}>
            {project.status}
          </span>
        </div>
        {project.description && (
          <p className="text-muted text-xs mb-2 line-clamp-2">{project.description}</p>
        )}
        <div className="flex justify-between text-xs text-muted mb-1">
          <span>{done}/{total} requirements</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: "#1e2130" }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: project.color }} />
        </div>
      </Link>
      {showEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(project);
          }}
          className="absolute top-2 right-2 btn-ghost text-xs px-2 py-1"
          style={{ zIndex: 10 }}
        >
          ✎ Edit
        </button>
      )}
    </div>
  );
}

// ─── Stat Card — clickable drill-down ───
function StatCard({ label, value, color, href }: { label: string; value: string | number; color: string; href: string }) {
  return (
    <Link
      href={href}
      className="card p-4 block transition-all duration-150"
      style={{ textDecoration: "none", cursor: "pointer" }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e2130")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#171923")}
    >
      <p className="text-muted text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </Link>
  );
}
