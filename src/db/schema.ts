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
// TABLE: projects
// ─────────────────────────────────────────────
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").unique().notNull(),
  description: text("description"),
  status: projectStatusEnum("status").default("active").notNull(),
  color: text("color").default("#4f6ff5").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
// RELATIONS
// ─────────────────────────────────────────────
export const teamMembersRelations = relations(teamMembers, ({ many }) => ({
  submissions: many(submissions),
  ownedRequirements: many(requirements),
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
