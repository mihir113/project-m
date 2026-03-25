"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";

interface UsefulLink {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export default function UsefulLinksPage() {
  const [links, setLinks] = useState<UsefulLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", url: "" });
  const { showToast } = useToast();

  const fetchLinks = async () => {
    try {
      const res = await fetch("/api/useful-links", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || "Failed to load links", "error");
        return;
      }
      setLinks(json.data || []);
    } catch {
      showToast("Failed to load links", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const handleAdd = async () => {
    if (!form.title.trim() || !form.url.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/useful-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title.trim(), url: form.url.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || "Failed to add link", "error");
        return;
      }
      showToast("Link added", "success");
      setForm({ title: "", url: "" });
      await fetchLinks();
    } catch {
      showToast("Failed to add link", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch("/api/useful-links", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || "Failed to delete link", "error");
        return;
      }
      showToast("Link deleted", "success");
      await fetchLinks();
    } catch {
      showToast("Failed to delete link", "error");
    }
  };

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">Useful Links</h1>
        <p className="text-secondary text-sm mt-1">
          Save frequently used links with a title and open them in one click.
        </p>
      </div>

      <div className="card p-4 mb-4 space-y-3">
        <div>
          <label className="text-xs text-muted mb-1 block">Title</label>
          <input
            className="input-field"
            placeholder="e.g. Jira Dashboard"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-muted mb-1 block">URL</label>
          <input
            className="input-field"
            placeholder="https://..."
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
        </div>
        <div className="flex justify-end">
          <button
            className="btn-primary"
            onClick={handleAdd}
            disabled={saving || !form.title.trim() || !form.url.trim()}
          >
            {saving ? "Adding..." : "Add Link"}
          </button>
        </div>
      </div>

      <div className="card p-4">
        {loading ? (
          <p className="text-sm text-muted">Loading links...</p>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted">No links yet. Add your first one above.</p>
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <div key={link.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-tertiary">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary truncate">{link.title}</p>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs hover:underline truncate block"
                    style={{ color: "#4f6ff5" }}
                    title={link.url}
                  >
                    {link.url}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost text-xs"
                  >
                    Open
                  </a>
                  <button className="btn-danger text-xs" onClick={() => handleDelete(link.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
