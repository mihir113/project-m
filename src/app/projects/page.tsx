"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { buildCategoryColorMap, getCategoryColor } from "@/lib/categoryColors";

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

const STATUS_OPTIONS = ["active", "on-hold", "completed"];

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const statusFromUrl = searchParams.get("status");
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
    category: ""
  });
  const [saving, setSaving] = useState(false);

  // Category management
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryColorMap, setCategoryColorMap] = useState<Record<string, string>>({});
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<Project | null>(null);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const json = await res.json();
      const projectsData = json.data || [];
      setProjects(projectsData);
      
      // Extract unique categories and build color map
      const uniqueCategories = Array.from(
        new Set(projectsData.map((p: Project) => p.category).filter(Boolean))
      ) as string[];
      setCategories(uniqueCategories.sort());
      setCategoryColorMap(buildCategoryColorMap(projectsData));
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
    setForm({ name: "", description: "", status: "active", category: "" });
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
        color: getCategoryColor(form.category || null, categoryColorMap),
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
  // Filter projects based on URL parameter, search query, and category
  const filteredProjects = projects.filter((p) => {
    if (statusFromUrl && p.status !== statusFromUrl) return false;
    if (selectedCategory === "__uncategorized__" && p.category) return false;
    if (selectedCategory && selectedCategory !== "__uncategorized__" && p.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesName = p.name.toLowerCase().includes(q);
      const matchesDesc = p.description?.toLowerCase().includes(q);
      const matchesCat = p.category?.toLowerCase().includes(q);
      if (!matchesName && !matchesDesc && !matchesCat) return false;
    }
    return true;
  });

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">
            Projects{statusFromUrl ? ` - ${statusFromUrl.charAt(0).toUpperCase() + statusFromUrl.slice(1)}` : ""}
          </h1>
          <p className="text-secondary text-sm mt-1">
            {filteredProjects.length === projects.length
              ? `${projects.length} project${projects.length !== 1 ? "s" : ""}`
              : `${filteredProjects.length} of ${projects.length} project${projects.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button className="btn-primary" onClick={openCreate}>+ New Project</button>
      </div>

      {/* Search & Category Filters */}
      {!loading && projects.length > 0 && (
        <div className="mb-5 space-y-3">
          {/* Search box */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              className="input-field pl-10"
              placeholder="Search projects by name, description, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Category filter chips */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedCategory === null
                    ? "bg-[#4f6ff5] text-white"
                    : "bg-tertiary text-secondary hover:text-primary"
                }`}
              >
                All
              </button>
              {categories.map((cat) => {
                const catColor = getCategoryColor(cat, categoryColorMap);
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      selectedCategory === cat
                        ? "text-white"
                        : "bg-tertiary text-secondary hover:text-primary"
                    }`}
                    style={selectedCategory === cat ? { backgroundColor: catColor } : undefined}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1.5"
                      style={{ backgroundColor: catColor }}
                    />
                    {cat}
                  </button>
                );
              })}
              {projects.some(p => !p.category) && (
                <button
                  onClick={() => setSelectedCategory(selectedCategory === "__uncategorized__" ? null : "__uncategorized__")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    selectedCategory === "__uncategorized__"
                      ? "bg-[#4f6ff5] text-white"
                      : "bg-tertiary text-secondary hover:text-primary"
                  }`}
                >
                  Uncategorized
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Project Grid */}
      {loading ? (
        <p className="text-muted text-sm py-12 text-center">Loading...</p>
      ) : filteredProjects.length === 0 ? (
        <div className="card p-12 text-center">
          {(searchQuery || selectedCategory) ? (
            <>
              <p className="text-muted text-sm mb-3">No projects match your filters.</p>
              <button className="btn-ghost" onClick={() => { setSearchQuery(""); setSelectedCategory(null); }}>Clear filters</button>
            </>
          ) : (
            <>
              <p className="text-muted text-sm mb-3">No {statusFromUrl || ""} projects yet.</p>
              <button className="btn-primary" onClick={openCreate}>Create your first project</button>
            </>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((p) => {
            const total = Number(p.totalRequirements || 0);
            const done = Number(p.completedRequirements || 0);
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="card p-5 flex flex-col gap-3 hover:shadow-lg transition-shadow cursor-pointer"
                style={{ borderTop: `3px solid ${getCategoryColor(p.category, categoryColorMap)}`, textDecoration: "none" }}
              >
                {/* Top: name + status */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-primary font-semibold text-base">{p.name}</h3>
                    {p.category && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs bg-tertiary text-secondary">
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
                  <div className="w-full h-1.5 rounded-full bg-tertiary">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: getCategoryColor(p.category, categoryColorMap) }} />
                  </div>
                </div>
              </Link>
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
