"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  color: string;
  category: string | null;
  totalRequirements?: number;
  completedRequirements?: number;
}

const COLOR_OPTIONS = [
  "#4f6ff5", "#e879a0", "#a78bfa", "#60a5fa",
  "#34d399", "#fbbf24", "#fb923c", "#f472b6",
  "#38bdf8", "#4ade80", "#c084fc", "#fb7185",
];

const STATUS_OPTIONS = ["active", "on-hold", "completed"];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form, setForm] = useState({ 
    name: "", 
    description: "", 
    status: "active", 
    color: "#4f6ff5",
    category: "" 
  });
  const [saving, setSaving] = useState(false);

  // Category management
  const [categories, setCategories] = useState<string[]>([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<Project | null>(null);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const json = await res.json();
      const projectsData = json.data || [];
      setProjects(projectsData);
      
      // Extract unique categories
      const uniqueCategories = Array.from(
        new Set(projectsData.map((p: Project) => p.category).filter(Boolean))
      ) as string[];
      setCategories(uniqueCategories.sort());
    } catch {
      showToast("Failed to load projects", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  // ── Open modal for Create or Edit ──
  const openCreate = () => {
    setEditingProject(null);
    setForm({ name: "", description: "", status: "active", color: "#4f6ff5", category: "" });
    setShowNewCategory(false);
    setNewCategoryInput("");
    setModalOpen(true);
  };

  const openEdit = (project: Project) => {
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
      const payload = {
        ...form,
        category: form.category || null,
      };

      if (editingProject) {
        // Update
        const res = await fetch("/api/projects", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingProject.id, ...payload }),
        });
        const json = await res.json();
        if (!res.ok) { showToast(json.error || "Update failed", "error"); return; }
        showToast("Project updated", "success");
      } else {
        // Create
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) { showToast(json.error || "Create failed", "error"); return; }
        showToast(`Created "${form.name}"`, "success");
      }
      setModalOpen(false);
      await fetchProjects();
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await fetch(`/api/projects?id=${deleteConfirm.id}`, { method: "DELETE" });
      showToast(`Deleted "${deleteConfirm.name}"`, "success");
      setDeleteConfirm(null);
      await fetchProjects();
    } catch {
      showToast("Delete failed", "error");
    }
  };

  // ───── RENDER ─────
  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Projects</h1>
          <p className="text-secondary text-sm mt-1">{projects.length} project{projects.length !== 1 ? "s" : ""}</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>+ New Project</button>
      </div>

      {/* Project Grid */}
      {loading ? (
        <p className="text-muted text-sm py-12 text-center">Loading...</p>
      ) : projects.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-muted text-sm mb-3">No projects yet.</p>
          <button className="btn-primary" onClick={openCreate}>Create your first project</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const total = Number(p.totalRequirements || 0);
            const done = Number(p.completedRequirements || 0);
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <div key={p.id} className="card p-5 flex flex-col gap-3 hover:shadow-lg transition-shadow" style={{ borderTop: `3px solid ${p.color}` }}>
                {/* Top: name + status */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-primary font-semibold text-base">{p.name}</h3>
                    {p.category && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: "#1e2130", color: "#9a9eb5" }}>
                        {p.category}
                      </span>
                    )}
                  </div>
                  <span className={`badge-${p.status === "active" ? "completed" : p.status === "on-hold" ? "pending" : "completed"}`}>
                    {p.status}
                  </span>
                </div>

                {/* Description */}
                {p.description && (
                  <p className="text-secondary text-sm line-clamp-2">{p.description}</p>
                )}

                {/* Progress */}
                <div>
                  <div className="flex justify-between text-xs text-muted mb-1">
                    <span>{done} / {total} requirements</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: "#1e2130" }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-default mt-auto">
                  <Link href={`/projects/${p.id}`} className="text-xs font-medium" style={{ color: p.color, textDecoration: "none" }}>
                    View Requirements →
                  </Link>
                  <div className="flex gap-2">
                    <button className="btn-ghost text-xs" onClick={() => openEdit(p)}>Edit</button>
                    <button className="btn-danger text-xs" onClick={() => setDeleteConfirm(p)}>Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingProject ? "Edit Project" : "New Project"}>
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

          {/* Category picker */}
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
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="__new__">+ Add new category</option>
                </select>
                {form.category && !categories.includes(form.category) && (
                  <p className="text-xs mt-1" style={{ color: "#34d399" }}>
                    ✓ New category "{form.category}" will be created
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
                    if (e.key === "Escape") { setShowNewCategory(false); setNewCategoryInput(""); }
                  }}
                  autoFocus
                />
                <button className="btn-primary" onClick={handleNewCategoryConfirm} disabled={!newCategoryInput.trim()}>Add</button>
                <button className="btn-ghost" onClick={() => { setShowNewCategory(false); setNewCategoryInput(""); }}>Cancel</button>
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
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace("-", " ")}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted mb-2 block">Accent Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  onClick={() => setForm({ ...form, color })}
                  className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                  style={{
                    backgroundColor: color,
                    outline: form.color === color ? `3px solid ${color}` : "none",
                    outlineOffset: "2px",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? "Saving..." : editingProject ? "Save Changes" : "Create Project"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Confirm Modal ── */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Project">
        <div>
          <p className="text-secondary text-sm mb-4">
            Are you sure you want to delete <strong className="text-primary">"{deleteConfirm?.name}"</strong>?
            This will also delete all its requirements and submission history.
          </p>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: "#f87171" }}
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
