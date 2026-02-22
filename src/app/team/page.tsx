"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import Papa from "papaparse";

interface TeamMember {
  id: string;
  nick: string;
  role: string;
}

interface EquityScore {
  memberId: string;
  nick: string;
  role: string;
  observationCount: number;
  lastObservationDate: string | null;
  managerCommentCount: number;
  daysSinceLastInteraction: number;
  score: number; // 0-100, lower = needs more attention
}

// ── Attention Meter component ────────────────────────────────────────────────
// score: 0-100 (lower = red = needs attention)
function AttentionMeter({ score, days }: { score: number; days: number }) {
  const color =
    score < 25
      ? "#f87171"  // red — critical
      : score < 50
      ? "#fbbf24"  // amber — low
      : score < 75
      ? "#60a5fa"  // blue — moderate
      : "#34d399"; // green — good

  const label =
    score < 25 ? "Low" : score < 50 ? "Moderate" : score < 75 ? "Good" : "Strong";

  return (
    <div className="flex items-center gap-2" title={`${label} attention — ${days}d since last interaction`}>
      {/* Bar */}
      <div
        className="rounded-full overflow-hidden"
        style={{ width: "48px", height: "5px", backgroundColor: "var(--bg-tertiary)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      {/* Days badge */}
      <span className="text-xs" style={{ color, minWidth: "28px" }}>
        {days >= 31 ? "31+" : days}d
      </span>
    </div>
  );
}

export default function TeamPage() {
  const router = useRouter();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [equityScores, setEquityScores] = useState<EquityScore[]>([]);
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

  // Fetch team members and equity scores
  const fetchAll = async () => {
    try {
      const [membersRes, equityRes] = await Promise.all([
        fetch("/api/team"),
        fetch("/api/management-equity"),
      ]);
      const membersJson = await membersRes.json();
      const equityJson = await equityRes.json();
      setMembers(membersJson.data || []);
      setEquityScores(equityJson.data || []);
    } catch {
      showToast("Failed to load team", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const getEquity = (memberId: string): EquityScore | undefined =>
    equityScores.find((e) => e.memberId === memberId);

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
      await fetchAll();
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
      await fetchAll();
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
      await fetchAll();
    } catch {
      showToast("Import failed", "error");
    } finally {
      setImporting(false);
    }
  };

  // ── Compute nudges: 3 members with lowest scores ──
  const nudges = equityScores.slice(0, 3).filter((e) => e.score < 75);

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">Team</h1>
        <p className="text-secondary text-sm mt-1">
          Your team roster. Click a name to open the performance workbench.
        </p>
      </div>

      {/* ── Manager Nudges card ── */}
      {!loading && nudges.length > 0 && (
        <div
          className="card p-5 mb-6"
          style={{
            borderColor: "rgba(251,191,36,0.35)",
            backgroundColor: "rgba(251,191,36,0.04)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span style={{ color: "#fbbf24", fontSize: "16px" }}>⚠</span>
            <h2 className="text-sm font-semibold" style={{ color: "#fbbf24" }}>
              Manager Nudges
            </h2>
          </div>
          <div className="space-y-2">
            {nudges.map((nudge) => {
              const daysText =
                nudge.daysSinceLastInteraction >= 31
                  ? "over 30 days"
                  : `${nudge.daysSinceLastInteraction} day${nudge.daysSinceLastInteraction !== 1 ? "s" : ""}`;
              const totalInteractions = nudge.observationCount + nudge.managerCommentCount;
              const message =
                totalInteractions === 0
                  ? `You haven't logged any notes for ${nudge.nick} in the last 30 days.`
                  : `You last interacted with ${nudge.nick} ${daysText} ago (${totalInteractions} note${totalInteractions !== 1 ? "s" : ""} this month).`;

              return (
                <div
                  key={nudge.memberId}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 border border-default cursor-pointer hover:border-focus transition-colors"
                  style={{ backgroundColor: "var(--bg-tertiary)" }}
                  onClick={() => router.push(`/team/${nudge.memberId}`)}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor:
                          nudge.score < 25 ? "#f87171" : "#fbbf24",
                      }}
                    />
                    <p className="text-secondary text-sm">{message}</p>
                  </div>
                  <span className="text-xs text-muted flex-shrink-0 ml-3">Check in →</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

            {csvErrors.length > 0 && (
              <div className="mt-3 space-y-1">
                {csvErrors.map((err, i) => (
                  <p key={i} className="text-xs" style={{ color: "#f87171" }}>{err}</p>
                ))}
              </div>
            )}

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
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "#34d399" }} />
                Strong
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "#60a5fa" }} />
                Good
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "#fbbf24" }} />
                Low
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "#f87171" }} />
                Critical
              </span>
            </div>
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
                              <th className="px-4 py-2.5 text-muted text-xs font-medium uppercase tracking-wide text-left">Attention</th>
                              <th className="px-4 py-2.5"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {roleMembers.map((m) => {
                              const eq = getEquity(m.id);
                              return (
                                <tr
                                  key={m.id}
                                  className="border-t border-default hover:bg-tertiary transition-colors cursor-pointer"
                                  onClick={() => router.push(`/team/${m.id}`)}
                                >
                                  <td className="px-4 py-3">
                                    <p className="text-primary text-sm font-medium hover:underline">{m.nick}</p>
                                  </td>
                                  <td className="px-4 py-3">
                                    {eq ? (
                                      <AttentionMeter score={eq.score} days={eq.daysSinceLastInteraction} />
                                    ) : (
                                      <span className="text-muted text-xs">—</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      className="btn-danger text-xs"
                                      onClick={() => handleDelete(m.id, m.nick)}
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
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
