// ─────────────────────────────────────────────
// Core entity types — mirrors the DB schema but as plain JS objects
// Used when passing data between components and API routes
// ─────────────────────────────────────────────

export type ProjectStatus = "active" | "on-hold" | "completed";
export type RequirementType = "recurring" | "one-time";
export type Recurrence = "daily" | "weekly" | "monthly" | "quarterly";
export type RequirementStatus = "pending" | "completed" | "overdue";

export interface TeamMember {
  id: string;
  nick: string;
  role: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  color: string;
  createdAt: string;
}

export interface Requirement {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  type: RequirementType;
  recurrence: Recurrence | null;
  dueDate: string;
  status: RequirementStatus;
  ownerId: string | null;
  isPerMemberCheckIn: boolean;
  url: string | null;
  createdAt: string;
  // Populated via joins — not always present
  owner?: TeamMember | null;
  project?: Project | null;
  metricTemplates?: MetricTemplate[];
}

export interface Submission {
  id: string;
  requirementId: string;
  teamMemberId: string | null;
  cycleLabel: string | null;
  completedAt: string;
  notes: string | null;
  createdAt: string;
  // Populated via joins
  teamMember?: TeamMember | null;
  metricEntries?: MetricEntry[];
}

export interface MetricTemplate {
  id: string;
  requirementId: string;
  metricName: string;
  targetValue: string; // numeric comes back as string from PG
  unit: string;
  displayOrder: number;
  createdAt: string;
}

export interface MetricEntry {
  id: string;
  submissionId: string;
  metricTemplateId: string;
  actualValue: string; // numeric comes back as string from PG
  comments: string | null;
  createdAt: string;
  template?: MetricTemplate;
}

// ─────────────────────────────────────────────
// API response shapes
// ─────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// ─────────────────────────────────────────────
// Utility: generate cycle labels automatically based on recurrence
// ─────────────────────────────────────────────

export function generateCycleLabel(recurrence: Recurrence, date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed

  switch (recurrence) {
    case "quarterly": {
      const quarter = Math.floor(month / 3) + 1;
      return `Q${quarter} ${year}`;
    }
    case "monthly": {
      const months = [
        "Jan","Feb","Mar","Apr","May","Jun",
        "Jul","Aug","Sep","Oct","Nov","Dec",
      ];
      return `${months[month]} ${year}`;
    }
    case "weekly": {
      // ISO week number
      const jan1 = new Date(year, 0, 1);
      const days = Math.floor((date.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000));
      const week = Math.ceil((days + jan1.getDay() + 1) / 7);
      return `W${week} ${year}`;
    }
    case "daily": {
      return date.toISOString().split("T")[0]; // "2026-02-02"
    }
  }
}
