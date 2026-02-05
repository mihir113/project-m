"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import Papa from "papaparse";

interface TeamMember {
  id: string;
  nick: string;
  role: string;
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [nick, setNick] = useState("");
  const [role, setRole] = useState("");
  const [adding, setAdding] = useState(false);

  // CSV import state
  const [csvPreview, setCsvPreview] = useState<{ nick: string; role: string }[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const { showToast } = useToast();

  // Collapsed role groups (persisted in localStorage)
  const [collapsedRoles, setCollapsedRoles] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem("team-collapsed-roles");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const toggleRole = (role: string) => {
    setCollapsedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      localStorage.setItem("team-collapsed-roles", JSON.stringify([...next]));
      return next;
    });
  };

  // Fetch team members
  const fetchMembers = async () => {
    try {
      const res = await fetch("/api/team");
      const json = await res.json();
      setMembers(json.data || []);
    } catch {
      showToast("Failed to load team", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  // ── Manual Add ──
  const handleAdd = async () => {
    if (!nick.trim() || !role.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nick: nick.trim(), role: role.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || "Failed to add member", "error");
        return;
      }
      showToast(`Added "${nick.trim()}" to the team`, "success");
      setNick("");
      setRole("");
      await fetchMembers();
    } finally {
      setAdding(false);
    }
  };

  // ── Delete ──
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}" from the team?`)) return;
    try {
      await fetch(`/api/team?id=${id}`, { method: "DELETE" });
      showToast(`Removed "${name}"`, "success");
      await fetchMembers();
    } catch {
      showToast("Failed to delete", "error");
    }
  };

  // ── CSV Import ──
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        const preview: { nick: string; role: string }[] = [];
        const errors: string[] = [];

        rows.forEach((row, i) => {
          const n = (row.nick || row.Nick || "").trim();
          const r = (row.role || row.Role || "").trim();
          if (!n || !r) {
            errors.push(`Row ${i + 1}: missing nick or role`);
          } else {
            preview.push({ nick: n, role: r });
          }
        });

        setCsvPreview(preview);
        setCsvErrors(errors);
      },
      error: () => {
        showToast("Failed to parse CSV file", "error");
      },
    });

    // Reset file input so same file can be re-uploaded if needed
    e.target.value = "";
  };

  const handleBulkImport = async () => {
    if (csvPreview.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch("/api/team/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members: csvPreview }),
      });
      const json = await res.json();
      const { imported, skipped, errors } = json.data || {};
      showToast(
        `Import done: ${imported} added, ${skipped} skipped`,
        imported > 0 ? "success" : "info"
      );
      if (errors?.length) {
        errors.forEach((err: string) => showToast(err, "error"));
      }
      setCsvPreview([]);
      setCsvErrors([]);
      await fetchMembers();
    } catch {
      showToast("Import failed", "error");
    } finally {
      setImporting(false);
    }
  };

  // ─── RENDER ───
  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">Team</h1>
        <p className="text-secondary text-sm mt-1">
          Your team roster. Members are a reference — they don't log in.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* ── Left: Add form + CSV import ── */}
        <div className="md:col-span-1 space-y-4">
          {/* Manual Add */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-primary mb-3">Add Member</h2>
            <div className="space-y-2">
              <input
                className="input-field"
                placeholder="Nick (e.g. Maria)"
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <input
                className="input-field"
                placeholder="Role (e.g. Direct Report)"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <button
                className="btn-primary w-full"
                onClick={handleAdd}
                disabled={adding || !nick.trim() || !role.trim()}
              >
                {adding ? "Adding..." : "Add Member"}
              </button>
            </div>
          </div>

          {/* CSV Import */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-primary mb-2">Bulk Import (CSV)</h2>
            <p className="text-muted text-xs mb-3">
              Upload a CSV with columns: <code className="text-secondary">nick, role</code>
            </p>
            <label className="block">
              <div
                className="border border-dashed border-default rounded-lg p-4 text-center cursor-pointer hover:border-focus transition-colors"
                style={{ borderColor: "#2a2d3a" }}
              >
                <p className="text-secondary text-sm">Click to upload CSV</p>
                <p className="text-muted text-xs mt-1">.csv file</p>
              </div>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>

            {/* Validation errors */}
            {csvErrors.length > 0 && (
              <div className="mt-3 space-y-1">
                {csvErrors.map((err, i) => (
                  <p key={i} className="text-xs" style={{ color: "#f87171" }}>{err}</p>
                ))}
              </div>
            )}

            {/* Preview table */}
            {csvPreview.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-secondary mb-2">
                  Preview — {csvPreview.length} row{csvPreview.length !== 1 ? "s" : ""}
                </p>
                <div className="rounded-lg overflow-hidden border border-default">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: "#1e2130" }}>
                        <th className="text-left px-3 py-2 text-muted text-xs font-medium">#</th>
                        <th className="text-left px-3 py-2 text-muted text-xs font-medium">Nick</th>
                        <th className="text-left px-3 py-2 text-muted text-xs font-medium">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.slice(0, 10).map((row, i) => (
                        <tr key={i} className="border-t border-default">
                          <td className="px-3 py-1.5 text-muted text-xs">{i + 1}</td>
                          <td className="px-3 py-1.5 text-primary text-xs">{row.nick}</td>
                          <td className="px-3 py-1.5 text-secondary text-xs">{row.role}</td>
                        </tr>
                      ))}
                      {csvPreview.length > 10 && (
                        <tr className="border-t border-default">
                          <td colSpan={3} className="px-3 py-1.5 text-muted text-xs text-center">
                            ... and {csvPreview.length - 10} more
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <button
                  className="btn-primary w-full mt-3"
                  onClick={handleBulkImport}
                  disabled={importing}
                >
                  {importing ? "Importing..." : `Import ${csvPreview.length} Members`}
                </button>
                <button
                  className="btn-ghost w-full mt-1 text-xs"
                  onClick={() => { setCsvPreview([]); setCsvErrors([]); }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Roster grouped by role ── */}
        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-primary">
              Roster ({members.length})
            </h2>
          </div>

          {loading ? (
            <div className="card p-5">
              <p className="text-muted text-sm py-8 text-center">Loading...</p>
            </div>
          ) : members.length === 0 ? (
            <div className="card p-5">
              <p className="text-muted text-sm py-8 text-center">
                No team members yet. Add one on the left.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(
                members.reduce<Record<string, TeamMember[]>>((acc, m) => {
                  const r = m.role || "Unassigned";
                  if (!acc[r]) acc[r] = [];
                  acc[r].push(m);
                  return acc;
                }, {})
              )
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([roleName, roleMembers]) => (
                  <div key={roleName} className="card p-5">
                    <div
                      className="flex items-center gap-3 pb-3 border-b border-default cursor-pointer select-none"
                      onClick={() => toggleRole(roleName)}
                    >
                      <svg
                        className={`w-4 h-4 text-muted transition-transform duration-200 ${collapsedRoles.has(roleName) ? "" : "rotate-90"}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      <h3 className="text-base font-semibold text-primary flex-1">{roleName}</h3>
                      <span className="text-xs text-muted">{roleMembers.length} member{roleMembers.length !== 1 ? "s" : ""}</span>
                    </div>

                    {!collapsedRoles.has(roleName) && (
                      <div className="rounded-lg overflow-hidden border border-default mt-4">
                        <table className="w-full">
                          <thead>
                            <tr style={{ backgroundColor: "#1e2130" }}>
                              <th className="text-left px-4 py-2.5 text-muted text-xs font-medium uppercase tracking-wide">Nick</th>
                              <th className="px-4 py-2.5"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {roleMembers.map((m) => (
                              <tr key={m.id} className="border-t border-default hover:bg-tertiary transition-colors">
                                <td className="px-4 py-3">
                                  <p className="text-primary text-sm font-medium">{m.nick}</p>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    className="btn-danger text-xs"
                                    onClick={() => handleDelete(m.id, m.nick)}
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
