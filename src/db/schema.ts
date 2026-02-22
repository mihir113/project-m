import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  date,
  numeric,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────
export const projectStatusEnum = pgEnum("project_status", [
  "active",
  "on-hold",
  "completed",
]);

export const requirementTypeEnum = pgEnum("requirement_type", [
  "recurring",
  "one-time",
]);

export const recurrenceEnum = pgEnum("recurrence", [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
]);

export const requirementStatusEnum = pgEnum("requirement_status", [
  "pending",
  "completed",
  "overdue",
]);

// ─────────────────────────────────────────────
// TABLE: team_members
// ─────────────────────────────────────────────
export const teamMembers = pgTable("team_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  nick: text("nick").unique().notNull(),
  role: text("role").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// TABLE: user_settings
// Single-row table for app-wide user preferences
// ─────────────────────────────────────────────
export const userSettings = pgTable("user_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  defaultOwnerId: uuid("default_owner_id").references(() => teamMembers.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// TABLE: projects
// ─────────────────────────────────────────────
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").unique().notNull(),
  description: text("description"),
  status: projectStatusEnum("status").default("active").notNull(),
  color: text("color").default("#4f6ff5").notNull(),
  category: text("category"), // Project category for board view organization
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// TABLE: task_automations
// Rules for automatic task creation
// ─────────────────────────────────────────────
export const taskAutomations = pgTable("task_automations", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  taskName: text("task_name").notNull(),
  description: text("description"),
  recurrence: recurrenceEnum("recurrence").notNull(), // daily, weekly, monthly, quarterly
  dayOfWeek: integer("day_of_week"), // 0=Sunday, 1=Monday, ..., 6=Saturday (for weekly only)
  dayOfMonth: integer("day_of_month"), // 1-31 (for monthly only)
  skipIfExists: boolean("skip_if_exists").default(true).notNull(), // Don't create if pending task with same name exists
  enabled: boolean("enabled").default(true).notNull(),
  ownerId: uuid("owner_id").references(() => teamMembers.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// TABLE: requirements
// ─────────────────────────────────────────────
export const requirements = pgTable("requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  type: requirementTypeEnum("type").notNull(),
  recurrence: recurrenceEnum("recurrence"),
  dueDate: date("due_date").notNull(),
  status: requirementStatusEnum("status").default("pending").notNull(),
  ownerId: uuid("owner_id").references(() => teamMembers.id),
  isPerMemberCheckIn: boolean("is_per_member_check_in").default(false).notNull(),
  // Link to a check-in template — null if not using one
  templateId: uuid("template_id").references(() => checkInTemplates.id),
  url: text("url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// TABLE: submissions
// ─────────────────────────────────────────────
export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  requirementId: uuid("requirement_id")
    .references(() => requirements.id, { onDelete: "cascade" })
    .notNull(),
  teamMemberId: uuid("team_member_id").references(() => teamMembers.id),
  cycleLabel: text("cycle_label"),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// TABLE: check_in_templates
// The reusable template library. e.g. "Check-In"
// ─────────────────────────────────────────────
export const checkInTemplates = pgTable("check_in_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").unique().notNull(),          // e.g. "Check-In"
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// TABLE: template_goal_areas
// Top-level sections inside a template. e.g. "ASE Strong", "Customer 2.0"
// ─────────────────────────────────────────────
export const templateGoalAreas = pgTable("template_goal_areas", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id")
    .references(() => checkInTemplates.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),                   // e.g. "ASE Strong"
  displayOrder: integer("display_order").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// TABLE: template_goals
// Sub-goals under a goal area. Each has a Goal name + Success Criteria (fixed part).
// ─────────────────────────────────────────────
export const templateGoals = pgTable("template_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  goalAreaId: uuid("goal_area_id")
    .references(() => templateGoalAreas.id, { onDelete: "cascade" })
    .notNull(),
  goal: text("goal").notNull(),                   // e.g. "Throughput"
  successCriteria: text("success_criteria").notNull().default(""),
  reportUrl: text("report_url"),                       // optional default URL, copied at check-in but editable
  displayOrder: integer("display_order").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// TABLE: checkin_responses
// The actual filled-in data per engineer per cycle per goal.
// Copies Goal + Success Criteria from template at submission time (editable).
// Manager Comments and Engineer URL are filled in each cycle.
// ─────────────────────────────────────────────
export const checkinResponses = pgTable("checkin_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id")
    .references(() => submissions.id, { onDelete: "cascade" })
    .notNull(),
  goalAreaName: text("goal_area_name").notNull(),       // copied from template (for grouping in history)
  goal: text("goal").notNull(),                         // copied from template, but editable
  successCriteria: text("success_criteria").notNull(), // copied from template, but editable
  managerComments: text("manager_comments"),           // filled each cycle
  engineerReportUrl: text("engineer_report_url"),      // filled each cycle
  displayOrder: integer("display_order").notNull(),    // preserves goal area + goal ordering
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// OLD TABLES — kept for now, can be removed later
// metric_templates and metric_entries are replaced
// by the new template system above.
// ─────────────────────────────────────────────
export const metricTemplates = pgTable("metric_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  requirementId: uuid("requirement_id")
    .references(() => requirements.id, { onDelete: "cascade" })
    .notNull(),
  metricName: text("metric_name").notNull(),
  targetValue: numeric("target_value").notNull(),
  unit: text("unit").notNull(),
  displayOrder: integer("display_order").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const metricEntries = pgTable("metric_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id")
    .references(() => submissions.id, { onDelete: "cascade" })
    .notNull(),
  metricTemplateId: uuid("metric_template_id")
    .references(() => metricTemplates.id, { onDelete: "cascade" })
    .notNull(),
  actualValue: numeric("actual_value").notNull(),
  comments: text("comments"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// TABLE: ai_execution_logs
// Logs for AI agent executions
// ─────────────────────────────────────────────
export const aiExecutionLogs = pgTable("ai_execution_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  prompt: text("prompt").notNull(),
  success: boolean("success").notNull(),
  operationsCount: integer("operations_count").notNull(),
  successCount: integer("success_count").notNull(),
  errorCount: integer("error_count").notNull(),
  operations: text("operations").notNull(), // JSON string of operations
  executionTimeMs: integer("execution_time_ms"),
  automationId: uuid("automation_id"), // Links to ai_automations if triggered by cron
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// TABLE: ai_automations
// Scheduled AI agent commands (e.g., "Categorize my uncategorized projects")
// ─────────────────────────────────────────────
export const aiAutomations = pgTable("ai_automations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  prompt: text("prompt").notNull(),
  rules: text("rules"), // Optional rules appended to AI system prompt
  schedule: recurrenceEnum("schedule").notNull(), // daily, weekly, monthly
  dayOfWeek: integer("day_of_week"), // 0=Sunday..6=Saturday (for weekly)
  dayOfMonth: integer("day_of_month"), // 1-31 (for monthly)
  enabled: boolean("enabled").default(true).notNull(),
  lastRunAt: timestamp("last_run_at"),
  lastRunStatus: text("last_run_status"), // "success" | "error"
  lastRunSummary: text("last_run_summary"),
  lastRunLogId: uuid("last_run_log_id"), // References aiExecutionLogs.id
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// TABLE: performance_snapshots
// Tracks engineer progress against IC level templates per quarter
// ─────────────────────────────────────────────
export const performanceSnapshots = pgTable("performance_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .references(() => teamMembers.id, { onDelete: "cascade" })
    .notNull(),
  templateId: uuid("template_id").references(() => checkInTemplates.id, {
    onDelete: "set null",
  }),
  quarter: text("quarter").notNull(), // e.g. "2026-Q1"
  managerNotes: text("manager_notes"),
  aiSynthesis: text("ai_synthesis"),
  status: text("status").default("draft").notNull(), // "draft" | "finalized"
  version: integer("version").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// TABLE: manager_observations
// Raw manager notes about engineers throughout the quarter
// ─────────────────────────────────────────────
export const managerObservations = pgTable("manager_observations", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .references(() => teamMembers.id, { onDelete: "cascade" })
    .notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// RELATIONS
// ─────────────────────────────────────────────
export const teamMembersRelations = relations(teamMembers, ({ many }) => ({
  submissions: many(submissions),
  ownedRequirements: many(requirements),
  performanceSnapshots: many(performanceSnapshots),
  managerObservations: many(managerObservations),
}));

export const performanceSnapshotsRelations = relations(performanceSnapshots, ({ one }) => ({
  member: one(teamMembers, {
    fields: [performanceSnapshots.memberId],
    references: [teamMembers.id],
  }),
  template: one(checkInTemplates, {
    fields: [performanceSnapshots.templateId],
    references: [checkInTemplates.id],
  }),
}));

export const managerObservationsRelations = relations(managerObservations, ({ one }) => ({
  member: one(teamMembers, {
    fields: [managerObservations.memberId],
    references: [teamMembers.id],
  }),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
  requirements: many(requirements),
}));

export const requirementsRelations = relations(requirements, ({ one, many }) => ({
  project: one(projects, {
    fields: [requirements.projectId],
    references: [projects.id],
  }),
  owner: one(teamMembers, {
    fields: [requirements.ownerId],
    references: [teamMembers.id],
  }),
  submissions: many(submissions),
  metricTemplates: many(metricTemplates),
  template: one(checkInTemplates, {
    fields: [requirements.templateId],
    references: [checkInTemplates.id],
  }),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  requirement: one(requirements, {
    fields: [submissions.requirementId],
    references: [requirements.id],
  }),
  teamMember: one(teamMembers, {
    fields: [submissions.teamMemberId],
    references: [teamMembers.id],
  }),
  metricEntries: many(metricEntries),
  checkinResponses: many(checkinResponses),
}));

export const checkInTemplatesRelations = relations(checkInTemplates, ({ many }) => ({
  goalAreas: many(templateGoalAreas),
  usedByRequirements: many(requirements),
}));

export const templateGoalAreasRelations = relations(templateGoalAreas, ({ one, many }) => ({
  template: one(checkInTemplates, {
    fields: [templateGoalAreas.templateId],
    references: [checkInTemplates.id],
  }),
  goals: many(templateGoals),
}));

export const templateGoalsRelations = relations(templateGoals, ({ one }) => ({
  goalArea: one(templateGoalAreas, {
    fields: [templateGoals.goalAreaId],
    references: [templateGoalAreas.id],
  }),
}));

export const checkinResponsesRelations = relations(checkinResponses, ({ one }) => ({
  submission: one(submissions, {
    fields: [checkinResponses.submissionId],
    references: [submissions.id],
  }),
}));

export const metricTemplatesRelations = relations(metricTemplates, ({ one, many }) => ({
  requirement: one(requirements, {
    fields: [metricTemplates.requirementId],
    references: [requirements.id],
  }),
  entries: many(metricEntries),
}));

export const metricEntriesRelations = relations(metricEntries, ({ one }) => ({
  submission: one(submissions, {
    fields: [metricEntries.submissionId],
    references: [submissions.id],
  }),
  template: one(metricTemplates, {
    fields: [metricEntries.metricTemplateId],
    references: [metricTemplates.id],
  }),
}));
