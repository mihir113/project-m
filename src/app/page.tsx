"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ProjectWithCounts {
  id: string;
  name: string;
  description: string | null;
  status: string;
  color: string;
  totalRequirements: number;
  completedRequirements: number;
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((json) => {
        setProjects(json.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-primary">Dashboard</h1>
        <p className="text-secondary text-sm mt-1">Welcome back to Project M</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Projects" value={stats.activeProjects} color="#4f6ff5" />
        <StatCard label="Total Requirements" value={stats.totalRequirements} color="#9a9eb5" />
        <StatCard label="Completed" value={stats.completedRequirements} color="#34d399" />
        <StatCard label="Completion %" value={`${completionPct}%`} color="#fbbf24" />
      </div>

      {/* Project List */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-primary">Projects</h2>
          <Link href="/projects" className="text-sm" style={{ color: "#4f6ff5" }}>
            View all →
          </Link>
        </div>

        {projects.length === 0 ? (
          <p className="text-muted text-sm py-6 text-center">
            No projects yet. Head to Projects to create your first one.
          </p>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => {
              const total = Number(project.totalRequirements);
              const done = Number(project.completedRequirements);
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;

              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-4 p-3 rounded-lg transition-colors hover:bg-tertiary"
                  style={{ textDecoration: "none" }}
                >
                  {/* Color dot */}
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: project.color }}
                  />

                  {/* Name + description */}
                  <div className="flex-1 min-w-0">
                    <p className="text-primary text-sm font-medium truncate">{project.name}</p>
                    {project.description && (
                      <p className="text-muted text-xs truncate">{project.description}</p>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="w-32 flex-shrink-0">
                    <div className="flex justify-between text-xs text-muted mb-1">
                      <span>{done}/{total}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: "#1e2130" }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: project.color }}
                      />
                    </div>
                  </div>

                  {/* Status badge */}
                  <span className={`badge-${project.status === "active" ? "completed" : project.status === "on-hold" ? "pending" : "completed"} flex-shrink-0`}>
                    {project.status}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stat Card Component ───
function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="card p-4">
      <p className="text-muted text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}
