import Groq from "groq-sdk";
import { db } from "@/db/client";
import {
  projects,
  requirements,
  teamMembers,
  checkInTemplates,
  templateGoalAreas,
  templateGoals,
  aiExecutionLogs,
} from "@/db/schema";
import { eq, sql, isNull } from "drizzle-orm";

// ─────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────

interface CreateTemplateParams {
  name: string;
  description?: string;
  goalAreas?: Array<{
    name: string;
    goals: Array<{
      goal: string;
      successCriteria: string;
      reportUrl?: string;
    }>;
  }>;
}

interface CreateProjectParams {
  name: string;
  description?: string;
  status?: "active" | "on-hold" | "completed";
  color?: string;
  category?: string;
}

interface CreateRequirementParams {
  projectId: string;
  name: string;
  description?: string;
  type: "recurring" | "one-time";
  recurrence?: "daily" | "weekly" | "monthly" | "quarterly";
  dueDate: string;
  ownerId?: string;
  isPerMemberCheckIn?: boolean;
  templateId?: string;
}

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface AgentResponse {
  success: boolean;
  message: string;
  operations: Array<{
    tool: string;
    status: "success" | "error";
    result?: any;
    error?: string;
  }>;
}

export interface ExecuteAICommandOptions {
  prompt: string;
  preview?: boolean;
  confirmedPlan?: any;
  rules?: string;
  automationId?: string;
}

export interface ExecuteAICommandResult {
  success: boolean;
  message: string;
  operations: AgentResponse["operations"];
  preview?: boolean;
  plan?: any;
  executionTimeMs: number;
  logId?: string;
  error?: string;
}

// ─────────────────────────────────────────────
// GROQ FUNCTION DEFINITIONS
// ─────────────────────────────────────────────

const tools = [
  {
    type: "function",
    function: {
      name: "get_team_members",
      description: "Get team members from the database with optional filters. Use this to find team member IDs for assignment or to filter by specific roles.",
      parameters: {
        type: "object",
        properties: {
          role: {
            type: "string",
            description: "Optional filter by role (e.g., 'Engineer', 'Manager', 'Direct', 'COE'). If not provided, returns all team members.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_template",
      description: "Create a new check-in template with optional goal areas and goals.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The name of the template (e.g., 'SR Quality Review')",
          },
          description: {
            type: "string",
            description: "Optional description of the template",
          },
          goalAreas: {
            type: "array",
            description: "Optional array of goal areas with their goals",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Name of the goal area",
                },
                goals: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      goal: {
                        type: "string",
                        description: "The goal name",
                      },
                      successCriteria: {
                        type: "string",
                        description: "Success criteria for the goal",
                      },
                      reportUrl: {
                        type: "string",
                        description: "Optional URL for the report",
                      },
                    },
                    required: ["goal", "successCriteria"],
                  },
                },
              },
              required: ["name", "goals"],
            },
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_project",
      description: "Create a new project in the database.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The name of the project",
          },
          description: {
            type: "string",
            description: "Optional description of the project",
          },
          status: {
            type: "string",
            enum: ["active", "on-hold", "completed"],
            description: "Project status (default: active)",
          },
          color: {
            type: "string",
            description: "Hex color code for the project (default: #4f6ff5)",
          },
          category: {
            type: "string",
            description: "Optional category for organizing projects",
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_projects",
      description: "Get existing projects from the database. Use this to find projects, especially uncategorized ones. Always call this before updating projects.",
      parameters: {
        type: "object",
        properties: {
          uncategorizedOnly: {
            type: "boolean",
            description: "If true, only return projects that have no category assigned",
          },
          status: {
            type: "string",
            enum: ["active", "on-hold", "completed"],
            description: "Optional filter by project status",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_project",
      description: "Update an existing project. Use this to change a project's category, name, description, status, or color. Use this when the user wants to categorize, recategorize, or modify existing projects.",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "UUID of the project to update",
          },
          name: {
            type: "string",
            description: "New name for the project",
          },
          description: {
            type: "string",
            description: "New description for the project",
          },
          status: {
            type: "string",
            enum: ["active", "on-hold", "completed"],
            description: "New status for the project",
          },
          color: {
            type: "string",
            description: "New hex color code for the project",
          },
          category: {
            type: "string",
            description: "New category for organizing the project (e.g., 'Engineering', 'Operations', 'Planning')",
          },
        },
        required: ["projectId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_requirement",
      description: "Create a new requirement (task) for a project.",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "UUID of the project to add the requirement to",
          },
          name: {
            type: "string",
            description: "Name of the requirement/task",
          },
          description: {
            type: "string",
            description: "Optional description",
          },
          type: {
            type: "string",
            enum: ["recurring", "one-time"],
            description: "Type of requirement",
          },
          recurrence: {
            type: "string",
            enum: ["daily", "weekly", "monthly", "quarterly"],
            description: "Recurrence pattern (required if type is recurring)",
          },
          dueDate: {
            type: "string",
            description: "Due date in YYYY-MM-DD format",
          },
          ownerId: {
            type: "string",
            description: "Optional UUID of the team member assigned to this requirement",
          },
          isPerMemberCheckIn: {
            type: "boolean",
            description: "Whether this is a per-member check-in requirement",
          },
          templateId: {
            type: "string",
            description: "Optional UUID of the check-in template to use",
          },
        },
        required: ["projectId", "name", "type", "dueDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_requirements_for_all_team_members",
      description: "Create a requirement for each team member. Use this when the user asks to create a task/requirement for each or all team members. Supports filtering by role.",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "UUID of the project to add requirements to",
          },
          name: {
            type: "string",
            description: "Base name of the requirement (will be prefixed with team member name)",
          },
          description: {
            type: "string",
            description: "Optional description",
          },
          type: {
            type: "string",
            enum: ["recurring", "one-time"],
            description: "Type of requirement",
          },
          recurrence: {
            type: "string",
            enum: ["daily", "weekly", "monthly", "quarterly"],
            description: "Recurrence pattern (required if type is recurring)",
          },
          dueDate: {
            type: "string",
            description: "Due date in YYYY-MM-DD format",
          },
          isPerMemberCheckIn: {
            type: "boolean",
            description: "Whether this is a per-member check-in requirement",
          },
          templateId: {
            type: "string",
            description: "Optional UUID of the check-in template to use",
          },
          role: {
            type: "string",
            description: "Optional filter by role (e.g., 'Engineer', 'Manager', 'Direct', 'COE'). If provided, creates requirements only for team members with this role.",
          },
        },
        required: ["projectId", "name", "type", "dueDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_project",
      description: "Delete a project and all its associated requirements from the database.",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "UUID of the project to delete",
          },
        },
        required: ["projectId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_requirements",
      description: "Get requirements (tasks) from the database with optional filters. Use this to find existing requirements by project, status, or owner.",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "Optional UUID of the project to filter requirements by",
          },
          status: {
            type: "string",
            enum: ["pending", "completed", "overdue"],
            description: "Optional filter by requirement status",
          },
          ownerId: {
            type: "string",
            description: "Optional UUID of the team member to filter requirements by",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_requirement",
      description: "Update an existing requirement (task). Use this to change a requirement's name, description, status, type, due date, owner, or other fields.",
      parameters: {
        type: "object",
        properties: {
          requirementId: {
            type: "string",
            description: "UUID of the requirement to update",
          },
          name: {
            type: "string",
            description: "New name for the requirement",
          },
          description: {
            type: "string",
            description: "New description for the requirement",
          },
          type: {
            type: "string",
            enum: ["recurring", "one-time"],
            description: "New type for the requirement",
          },
          recurrence: {
            type: "string",
            enum: ["daily", "weekly", "monthly", "quarterly"],
            description: "New recurrence pattern",
          },
          dueDate: {
            type: "string",
            description: "New due date in YYYY-MM-DD format",
          },
          status: {
            type: "string",
            enum: ["pending", "completed", "overdue"],
            description: "New status for the requirement",
          },
          ownerId: {
            type: "string",
            description: "UUID of the team member to assign the requirement to",
          },
        },
        required: ["requirementId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_requirement",
      description: "Delete a requirement (task) from the database.",
      parameters: {
        type: "object",
        properties: {
          requirementId: {
            type: "string",
            description: "UUID of the requirement to delete",
          },
        },
        required: ["requirementId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_team_member",
      description: "Add a new team member to the database.",
      parameters: {
        type: "object",
        properties: {
          nick: {
            type: "string",
            description: "The nickname/name of the team member (must be unique)",
          },
          role: {
            type: "string",
            description: "The role of the team member (e.g., 'Engineer', 'Manager', 'Direct', 'COE', 'Contractor')",
          },
        },
        required: ["nick", "role"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_team_member",
      description: "Update an existing team member's nick or role.",
      parameters: {
        type: "object",
        properties: {
          memberId: {
            type: "string",
            description: "UUID of the team member to update",
          },
          nick: {
            type: "string",
            description: "New nickname for the team member",
          },
          role: {
            type: "string",
            description: "New role for the team member (e.g., 'Engineer', 'Manager', 'Direct', 'COE', 'Contractor')",
          },
        },
        required: ["memberId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_team_member",
      description: "Remove a team member from the database.",
      parameters: {
        type: "object",
        properties: {
          memberId: {
            type: "string",
            description: "UUID of the team member to delete",
          },
        },
        required: ["memberId"],
      },
    },
  },
] as const;

// ─────────────────────────────────────────────
// TOOL IMPLEMENTATION FUNCTIONS
// ─────────────────────────────────────────────

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function getToolDescription(toolName: string, args: any, teamMemberName?: string): string {
  switch (toolName) {
    case "get_team_members":
      return args.role
        ? `Fetch team members with role "${args.role}"`
        : "Fetch all team members from the database";
    case "create_template":
      return `Create template "${args.name}"${args.goalAreas ? ` with ${args.goalAreas.length} goal area(s)` : ""}`;
    case "create_project":
      return `Create project "${args.name}"${args.category ? ` in category "${args.category}"` : ""}`;
    case "get_projects":
      return args.uncategorizedOnly
        ? "Fetch uncategorized projects from the database"
        : args.status
          ? `Fetch projects with status "${args.status}"`
          : "Fetch all projects from the database";
    case "update_project": {
      const updates = [];
      if (args.category) updates.push(`category to "${args.category}"`);
      if (args.name) updates.push(`name to "${args.name}"`);
      if (args.status) updates.push(`status to "${args.status}"`);
      if (args.color) updates.push(`color to "${args.color}"`);
      if (args.description) updates.push(`description`);
      return `Update project ${args.projectId}: set ${updates.join(", ") || "fields"}`;
    }
    case "create_requirement": {
      const assignedTo = teamMemberName ? ` assigned to ${teamMemberName}` : (args.ownerId ? " (assigned)" : "");
      return `Create ${args.type} requirement "${args.name}"${assignedTo} due ${args.dueDate}`;
    }
    case "create_requirements_for_all_team_members":
      return `Create ${args.type} requirement "${args.name}" for each team member, due ${args.dueDate}`;
    case "delete_project":
      return `Delete project ${args.projectId} and all its requirements`;
    case "get_requirements": {
      const filters = [];
      if (args.projectId) filters.push(`project ${args.projectId}`);
      if (args.status) filters.push(`status "${args.status}"`);
      if (args.ownerId) filters.push(`owner ${args.ownerId}`);
      return filters.length > 0
        ? `Fetch requirements filtered by ${filters.join(", ")}`
        : "Fetch all requirements from the database";
    }
    case "update_requirement": {
      const reqUpdates = [];
      if (args.name) reqUpdates.push(`name to "${args.name}"`);
      if (args.status) reqUpdates.push(`status to "${args.status}"`);
      if (args.dueDate) reqUpdates.push(`due date to ${args.dueDate}`);
      if (args.ownerId) reqUpdates.push(`owner`);
      if (args.type) reqUpdates.push(`type to "${args.type}"`);
      return `Update requirement ${args.requirementId}: set ${reqUpdates.join(", ") || "fields"}`;
    }
    case "delete_requirement":
      return `Delete requirement ${args.requirementId}`;
    case "create_team_member":
      return `Add team member "${args.nick}" with role "${args.role}"`;
    case "update_team_member": {
      const memberUpdates = [];
      if (args.nick) memberUpdates.push(`nick to "${args.nick}"`);
      if (args.role) memberUpdates.push(`role to "${args.role}"`);
      return `Update team member ${args.memberId}: set ${memberUpdates.join(", ") || "fields"}`;
    }
    case "delete_team_member":
      return `Remove team member ${args.memberId}`;
    default:
      return `Execute ${toolName}`;
  }
}

async function executeGetTeamMembers(params?: { role?: string }): Promise<any> {
  let normalizedRole: string | null = null;
  if (params?.role) {
    const roleMap: Record<string, string> = {
      'engineer': 'Engineer', 'engineers': 'Engineer',
      'manager': 'Manager', 'managers': 'Manager',
      'direct': 'Direct', 'directs': 'Direct',
      'coe': 'COE',
      'contractor': 'Contractor', 'contractors': 'Contractor',
    };
    normalizedRole = roleMap[params.role.toLowerCase()] || params.role;
  }

  const members = normalizedRole
    ? await db.select().from(teamMembers).where(eq(teamMembers.role, normalizedRole)).orderBy(teamMembers.nick)
    : await db.select().from(teamMembers).orderBy(teamMembers.nick);

  return { members, filter: normalizedRole ? { role: normalizedRole } : null, count: members.length };
}

async function executeCreateTemplate(params: CreateTemplateParams): Promise<any> {
  const [template] = await db
    .insert(checkInTemplates)
    .values({
      name: params.name.trim(),
      description: params.description ? sql`${params.description.trim()}` : sql`NULL`,
    })
    .returning();

  if (params.goalAreas && params.goalAreas.length > 0) {
    for (let i = 0; i < params.goalAreas.length; i++) {
      const area = params.goalAreas[i];
      const [goalArea] = await db
        .insert(templateGoalAreas)
        .values({ templateId: template.id, name: area.name.trim(), displayOrder: i })
        .returning();

      for (let j = 0; j < area.goals.length; j++) {
        const goal = area.goals[j];
        await db.insert(templateGoals).values({
          goalAreaId: goalArea.id,
          goal: goal.goal.trim(),
          successCriteria: goal.successCriteria.trim(),
          reportUrl: goal.reportUrl || null,
          displayOrder: j,
        });
      }
    }
  }

  return { template };
}

async function executeCreateProject(params: CreateProjectParams): Promise<any> {
  const [project] = await db
    .insert(projects)
    .values({
      name: params.name.trim(),
      description: params.description ? sql`${params.description.trim()}` : sql`NULL`,
      status: params.status || "active",
      color: params.color || "#4f6ff5",
      category: params.category ? sql`${params.category.trim()}` : sql`NULL`,
    })
    .returning();

  return { project };
}

async function executeGetProjects(params?: { uncategorizedOnly?: boolean; status?: string }): Promise<any> {
  const query = db.select().from(projects);

  const conditions = [];
  if (params?.uncategorizedOnly) conditions.push(isNull(projects.category));
  if (params?.status) conditions.push(eq(projects.status, params.status as any));

  const results = conditions.length > 0
    ? await query.where(conditions.length === 1 ? conditions[0] : sql`${conditions[0]} AND ${conditions[1]}`)
    : await query;

  return {
    projects: results,
    count: results.length,
    filter: { uncategorizedOnly: params?.uncategorizedOnly || false, status: params?.status || null },
  };
}

async function executeUpdateProject(params: { projectId: string; name?: string; description?: string; status?: string; color?: string; category?: string }): Promise<any> {
  if (!params.projectId || !isValidUUID(params.projectId)) {
    throw new Error(`Invalid project ID: "${params.projectId}". Expected a valid UUID format.`);
  }

  const updateData: Record<string, any> = {};
  if (params.name !== undefined) updateData.name = params.name.trim();
  if (params.description !== undefined) updateData.description = params.description.trim();
  if (params.status !== undefined) updateData.status = params.status;
  if (params.color !== undefined) updateData.color = params.color;
  if (params.category !== undefined) updateData.category = params.category.trim();

  if (Object.keys(updateData).length === 0) {
    throw new Error("No fields to update. Provide at least one field (name, description, status, color, or category).");
  }

  const [updated] = await db.update(projects).set(updateData).where(eq(projects.id, params.projectId)).returning();
  if (!updated) throw new Error(`Project with ID "${params.projectId}" not found.`);

  return { project: updated };
}

async function executeDeleteProject(params: { projectId: string }): Promise<any> {
  if (!params.projectId || !isValidUUID(params.projectId)) {
    throw new Error(`Invalid project ID: "${params.projectId}". Expected a valid UUID format.`);
  }

  await db.delete(requirements).where(eq(requirements.projectId, params.projectId));
  await db.delete(projects).where(eq(projects.id, params.projectId));

  return { deleted: true, projectId: params.projectId };
}

async function executeGetRequirements(params?: { projectId?: string; status?: string; ownerId?: string }): Promise<any> {
  const conditions: any[] = [];
  if (params?.projectId) {
    if (!isValidUUID(params.projectId)) throw new Error(`Invalid project ID: "${params.projectId}". Expected a valid UUID format.`);
    conditions.push(eq(requirements.projectId, params.projectId));
  }
  if (params?.status) conditions.push(eq(requirements.status, params.status as any));
  if (params?.ownerId) {
    if (!isValidUUID(params.ownerId)) throw new Error(`Invalid owner ID: "${params.ownerId}". Expected a valid UUID format.`);
    conditions.push(eq(requirements.ownerId, params.ownerId));
  }

  const rows = await db
    .select({
      id: requirements.id, name: requirements.name, description: requirements.description,
      type: requirements.type, recurrence: requirements.recurrence, dueDate: requirements.dueDate,
      status: requirements.status, projectId: requirements.projectId, ownerId: requirements.ownerId,
      ownerNick: teamMembers.nick, projectName: projects.name,
    })
    .from(requirements)
    .leftJoin(teamMembers, eq(teamMembers.id, requirements.ownerId))
    .leftJoin(projects, eq(projects.id, requirements.projectId))
    .where(conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined)
    .orderBy(requirements.createdAt);

  return { requirements: rows, count: rows.length };
}

async function executeUpdateRequirement(params: { requirementId: string; name?: string; description?: string; type?: string; recurrence?: string; dueDate?: string; status?: string; ownerId?: string }): Promise<any> {
  if (!params.requirementId || !isValidUUID(params.requirementId)) {
    throw new Error(`Invalid requirement ID: "${params.requirementId}". Expected a valid UUID format.`);
  }

  const updateData: Record<string, any> = {};
  if (params.name !== undefined) updateData.name = params.name.trim();
  if (params.description !== undefined) updateData.description = params.description.trim();
  if (params.type !== undefined) updateData.type = params.type;
  if (params.recurrence !== undefined) updateData.recurrence = params.recurrence;
  if (params.dueDate !== undefined) updateData.dueDate = params.dueDate;
  if (params.status !== undefined) updateData.status = params.status;
  if (params.ownerId !== undefined) updateData.ownerId = params.ownerId || null;

  if (Object.keys(updateData).length === 0) throw new Error("No fields to update.");

  const [updated] = await db.update(requirements).set(updateData).where(eq(requirements.id, params.requirementId)).returning();
  if (!updated) throw new Error(`Requirement with ID "${params.requirementId}" not found.`);

  return { requirement: updated };
}

async function executeDeleteRequirement(params: { requirementId: string }): Promise<any> {
  if (!params.requirementId || !isValidUUID(params.requirementId)) {
    throw new Error(`Invalid requirement ID: "${params.requirementId}". Expected a valid UUID format.`);
  }
  await db.delete(requirements).where(eq(requirements.id, params.requirementId));
  return { deleted: true, requirementId: params.requirementId };
}

async function executeCreateTeamMember(params: { nick: string; role: string }): Promise<any> {
  const existing = await db.select().from(teamMembers).where(eq(teamMembers.nick, params.nick.trim()));
  if (existing.length > 0) throw new Error(`A team member with nick "${params.nick}" already exists.`);

  const [member] = await db.insert(teamMembers).values({ nick: params.nick.trim(), role: params.role.trim() }).returning();
  return { member };
}

async function executeUpdateTeamMember(params: { memberId: string; nick?: string; role?: string }): Promise<any> {
  if (!params.memberId || !isValidUUID(params.memberId)) {
    throw new Error(`Invalid member ID: "${params.memberId}". Expected a valid UUID format.`);
  }

  const updateData: Record<string, any> = {};
  if (params.nick !== undefined) updateData.nick = params.nick.trim();
  if (params.role !== undefined) updateData.role = params.role.trim();

  if (Object.keys(updateData).length === 0) throw new Error("No fields to update. Provide at least nick or role.");

  const [updated] = await db.update(teamMembers).set(updateData).where(eq(teamMembers.id, params.memberId)).returning();
  if (!updated) throw new Error(`Team member with ID "${params.memberId}" not found.`);

  return { member: updated };
}

async function executeDeleteTeamMember(params: { memberId: string }): Promise<any> {
  if (!params.memberId || !isValidUUID(params.memberId)) {
    throw new Error(`Invalid member ID: "${params.memberId}". Expected a valid UUID format.`);
  }
  await db.delete(teamMembers).where(eq(teamMembers.id, params.memberId));
  return { deleted: true, memberId: params.memberId };
}

async function executeCreateRequirement(params: CreateRequirementParams): Promise<any> {
  if (!params.projectId || !isValidUUID(params.projectId)) {
    throw new Error(`Invalid project ID: "${params.projectId}". Expected a valid UUID format.`);
  }

  // Default owner to Mihir if not provided
  let resolvedOwnerId = params.ownerId || null;
  if (!resolvedOwnerId) {
    const [mihir] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(eq(teamMembers.nick, "Mihir"))
      .limit(1);
    if (mihir) resolvedOwnerId = mihir.id;
  }

  const [requirement] = await db
    .insert(requirements)
    .values({
      projectId: params.projectId,
      name: params.name.trim(),
      description: params.description ? sql`${params.description.trim()}` : sql`NULL`,
      type: params.type,
      recurrence: params.type === "recurring" && params.recurrence ? params.recurrence : sql`NULL`,
      dueDate: params.dueDate,
      status: "pending" as const,
      ownerId: resolvedOwnerId || sql`NULL`,
      isPerMemberCheckIn: params.isPerMemberCheckIn || false,
      templateId: params.templateId || sql`NULL`,
    })
    .returning();

  return { requirement };
}

async function executeCreateRequirementsForAllTeamMembers(params: Omit<CreateRequirementParams, "ownerId"> & { role?: string }): Promise<any> {
  if (!params.projectId || !isValidUUID(params.projectId)) {
    throw new Error(`Invalid project ID: "${params.projectId}". Expected a valid UUID format.`);
  }

  let normalizedRole: string | null = null;
  if (params.role) {
    const roleMap: Record<string, string> = {
      'engineer': 'Engineer', 'engineers': 'Engineer',
      'manager': 'Manager', 'managers': 'Manager',
      'direct': 'Direct', 'directs': 'Direct',
      'coe': 'COE',
      'contractor': 'Contractor', 'contractors': 'Contractor',
    };
    normalizedRole = roleMap[params.role.toLowerCase()] || params.role;
  }

  const members = normalizedRole
    ? await db.select().from(teamMembers).where(eq(teamMembers.role, normalizedRole)).orderBy(teamMembers.nick)
    : await db.select().from(teamMembers).orderBy(teamMembers.nick);

  if (members.length === 0) {
    const roleMsg = normalizedRole ? ` with role "${normalizedRole}"` : "";
    throw new Error(`No team members found in database${roleMsg}`);
  }

  const createdRequirements = [];
  for (const member of members) {
    const [requirement] = await db
      .insert(requirements)
      .values({
        projectId: params.projectId,
        name: `${params.name} - ${member.nick}`.trim(),
        description: params.description ? sql`${params.description.trim()}` : sql`NULL`,
        type: params.type,
        recurrence: params.type === "recurring" && params.recurrence ? params.recurrence : sql`NULL`,
        dueDate: params.dueDate,
        status: "pending" as const,
        ownerId: member.id,
        isPerMemberCheckIn: params.isPerMemberCheckIn || false,
        templateId: params.templateId || sql`NULL`,
      })
      .returning();
    createdRequirements.push(requirement);
  }

  return {
    requirements: createdRequirements,
    count: createdRequirements.length,
    teamMembers: members.map(m => ({ id: m.id, nick: m.nick })),
  };
}

// ─────────────────────────────────────────────
// PROJECT DICTIONARY & CONTEXT BUILDERS
// ─────────────────────────────────────────────

const COMMON_ABBREVIATIONS: Record<string, string[]> = {
  operations: ["ops", "oper"],
  engineering: ["eng", "engg"],
  management: ["mgmt", "mgt"],
  development: ["dev", "devel"],
  production: ["prod"],
  infrastructure: ["infra"],
  security: ["sec"],
  compliance: ["comp"],
  administration: ["admin"],
  communication: ["comm", "comms"],
  communications: ["comm", "comms"],
  performance: ["perf"],
  quality: ["qa", "qual"],
  requirements: ["reqs", "req"],
  configuration: ["config", "cfg"],
  documentation: ["docs", "doc"],
  automation: ["auto"],
  integration: ["integ", "integr"],
  monitoring: ["mon"],
  review: ["rev"],
  planning: ["plan"],
  training: ["train"],
  recruitment: ["recruit", "hiring"],
  onboarding: ["onboard"],
  customer: ["cust"],
  technical: ["tech"],
  financial: ["fin", "finance"],
  marketing: ["mktg", "mkt"],
  technology: ["tech"],
  services: ["svc", "svcs"],
  service: ["svc"],
  analysis: ["analysis"],
  analytics: ["analytics"],
  assessment: ["assess"],
  improvement: ["improv"],
  optimization: ["optim", "opt"],
  transformation: ["transform"],
  leadership: ["lead"],
  reporting: ["report", "rpt"],
  delivery: ["deliv"],
  architecture: ["arch"],
  governance: ["gov"],
  maintenance: ["maint"],
  support: ["sup"],
  strategy: ["strat"],
  program: ["prog", "pgm"],
  project: ["proj"],
  enablement: ["enable"],
  excellence: ["excel"],
  continuous: ["cont"],
};

async function buildProjectDictionary(): Promise<string> {
  const allProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      category: projects.category,
      status: projects.status,
    })
    .from(projects);

  if (allProjects.length === 0) return "";

  const entries = allProjects.map((p) => {
    const aliases: string[] = [];
    const words = p.name.split(/\s+/);

    // Acronym from first letters (only if multi-word)
    if (words.length > 1) {
      aliases.push(words.map((w) => w[0].toLowerCase()).join(""));
    }

    // Each individual word as an alias (lowercase)
    for (const word of words) {
      const lower = word.toLowerCase();
      aliases.push(lower);
      // Add common abbreviations for this word
      if (COMMON_ABBREVIATIONS[lower]) {
        aliases.push(...COMMON_ABBREVIATIONS[lower]);
      }
    }

    // Generate abbreviated forms: replace each word with its abbreviation
    if (words.length > 1) {
      for (let i = 0; i < words.length; i++) {
        const wordLower = words[i].toLowerCase();
        const abbrevs = COMMON_ABBREVIATIONS[wordLower];
        if (abbrevs) {
          for (const abbr of abbrevs) {
            const parts = [...words];
            parts[i] = abbr;
            aliases.push(parts.join(" ").toLowerCase());
          }
        }
      }
    }

    // Deduplicate
    const uniqueAliases = [...new Set(aliases)].filter(
      (a) => a !== p.name.toLowerCase() && a.length > 1
    );

    const catInfo = p.category ? `, category: "${p.category}"` : "";
    return `  - "${p.name}" (ID: ${p.id}, status: ${p.status}${catInfo})\n    aliases: ${uniqueAliases.join(", ")}`;
  });

  return `\n\nPROJECT DICTIONARY — use this to match user input to the correct project:
${entries.join("\n")}

MATCHING RULES:
- When the user mentions a project by name, abbreviation, partial name, or typo, use this dictionary to find the best matching project ID.
- Be flexible: "ops" → "Operations", "sec review" → "Security Review", "eng" → "Engineering", etc.
- If the user's input matches multiple projects, pick the most likely one based on context.
- If truly ambiguous, ask the user to clarify.
- NEVER create a new project when the user is clearly referring to an existing one.
- Always use the project ID (UUID) from this dictionary when calling tools.`;
}

async function buildTeamContext(): Promise<string> {
  const members = await db
    .select({ id: teamMembers.id, nick: teamMembers.nick, role: teamMembers.role })
    .from(teamMembers)
    .orderBy(teamMembers.nick);

  if (members.length === 0) return "";

  const mihir = members.find((m) => m.nick.toLowerCase() === "mihir");
  const lines = members.map(
    (m) =>
      `  - "${m.nick}" (ID: ${m.id}, Role: ${m.role})${m.nick.toLowerCase() === "mihir" ? " ← DEFAULT OWNER" : ""}`
  );

  return `\n\nTEAM MEMBERS:
${lines.join("\n")}

DEFAULT ASSIGNMENT: When creating tasks/requirements without a specified owner, ALWAYS assign to ${mihir ? `"${mihir.nick}" (ID: ${mihir.id})` : "the default owner"}.`;
}

// ─────────────────────────────────────────────
// CORE AI EXECUTION PIPELINE
// ─────────────────────────────────────────────

const READ_OPERATIONS = ["get_projects", "get_team_members", "get_requirements"];

async function executeReadOperation(name: string, args: any): Promise<any> {
  switch (name) {
    case "get_projects": return await executeGetProjects(args);
    case "get_team_members": return await executeGetTeamMembers(args);
    case "get_requirements": return await executeGetRequirements(args);
    default: return null;
  }
}

export async function executeAICommand(options: ExecuteAICommandOptions): Promise<ExecuteAICommandResult> {
  const startTime = Date.now();
  const { prompt, preview = false, confirmedPlan, rules, automationId } = options;

  if (!process.env.GROQ_API_KEY) {
    return {
      success: false,
      message: "Groq API key not configured",
      error: "GROQ_API_KEY environment variable is not set.",
      operations: [],
      executionTimeMs: Date.now() - startTime,
    };
  }

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    let systemPrompt = `You are an AI assistant that helps users manage their OpSync database through natural language commands.
You have access to tools for full CRUD (create, read, update, delete) operations on projects, requirements (tasks), and team members, as well as creating templates.

TEAM MEMBER ROLES:
The database contains team members with the following role values (case-sensitive):
- "Engineer" - Software engineers and developers
- "Manager" - Team managers and leads
- "Direct" - Direct reports
- "COE" - Center of Excellence members
- "Contractor" - External contractors
When filtering by role, use the exact capitalization shown above.

IMPORTANT RULES:
- When the user says "for each team member" or "for all team members", use create_requirements_for_all_team_members
- When the user mentions a specific role (e.g., "directs", "engineers", "COE members"), ALWAYS pass the role parameter to filter by that role:
  * If using get_team_members, include { role: "Direct" } (or appropriate role)
  * If using create_requirements_for_all_team_members, include { role: "Direct" } (or appropriate role)
  * Pay attention to keywords like "with role X", "for directs", "engineers only", etc.
- Always use get_team_members first if the user mentions assigning to someone by specific name
- When creating requirements, use ISO date format (YYYY-MM-DD) for dueDate
- Execute operations in logical order (e.g., create project before adding requirements to it)
- When the user asks to categorize, recategorize, or organize existing projects, ALWAYS use get_projects first to fetch existing projects, then use update_project to update their categories. NEVER use create_project for this purpose.
- When the user asks to update, modify, or change existing entities, use the appropriate update tool (update_project, update_requirement, update_team_member). Do NOT create new entities when the user wants to modify existing ones.
- When the user asks to delete or remove entities, use the appropriate delete tool (delete_project, delete_requirement, delete_team_member).`;

    if (rules) {
      systemPrompt += `\n\nADDITIONAL RULES (follow these strictly):\n${rules}`;
    }

    // Inject project dictionary and team context for fuzzy matching
    const [projectDict, teamCtx] = await Promise.all([
      buildProjectDictionary(),
      buildTeamContext(),
    ]);
    systemPrompt += projectDict;
    systemPrompt += teamCtx;

    // Multi-round function calling
    const messages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ];

    const allToolCalls: ToolCall[] = [];
    const MAX_ROUNDS = 5;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const chatCompletion = await groq.chat.completions.create({
        messages,
        model: "llama-3.3-70b-versatile",
        tools: tools as any,
        tool_choice: "auto",
        temperature: 0.3,
        max_tokens: 4096,
      });

      const responseMessage = chatCompletion.choices[0]?.message;
      const roundToolCalls = responseMessage?.tool_calls as ToolCall[] | undefined;

      if (!roundToolCalls || roundToolCalls.length === 0) {
        if (round === 0) {
          return {
            success: false,
            message: responseMessage?.content || "No operations identified from your request.",
            operations: [],
            executionTimeMs: Date.now() - startTime,
          };
        }
        break;
      }

      messages.push(responseMessage);

      let hasReadOps = false;
      for (const tc of roundToolCalls) {
        let args: any;
        try { args = JSON.parse(tc.function.arguments); } catch { args = {}; }

        if (READ_OPERATIONS.includes(tc.function.name)) {
          hasReadOps = true;
          try {
            const result = await executeReadOperation(tc.function.name, args);
            messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
          } catch (err: any) {
            messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: err.message }) });
          }
        } else {
          messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ status: "queued" }) });
        }

        allToolCalls.push(tc);
      }

      if (!hasReadOps) break;
    }

    const toolCalls = allToolCalls;

    if (toolCalls.length === 0) {
      return {
        success: false,
        message: "No operations identified from your request.",
        operations: [],
        executionTimeMs: Date.now() - startTime,
      };
    }

    // PREVIEW MODE
    if (preview) {
      const plannedOperations = [];

      for (const toolCall of toolCalls) {
        let args: any;
        try { args = JSON.parse(toolCall.function.arguments); } catch { args = {}; }

        if (toolCall.function.name === "create_requirements_for_all_team_members") {
          let normalizedRole: string | null = null;
          if (args.role) {
            const roleMap: Record<string, string> = {
              'engineer': 'Engineer', 'engineers': 'Engineer',
              'manager': 'Manager', 'managers': 'Manager',
              'direct': 'Direct', 'directs': 'Direct',
              'coe': 'COE',
              'contractor': 'Contractor', 'contractors': 'Contractor',
            };
            normalizedRole = roleMap[args.role.toLowerCase()] || args.role;
          }

          const members = normalizedRole
            ? await db.select().from(teamMembers).where(eq(teamMembers.role, normalizedRole)).orderBy(teamMembers.nick)
            : await db.select().from(teamMembers).orderBy(teamMembers.nick);

          for (const member of members) {
            plannedOperations.push({
              tool: "create_requirement",
              arguments: { ...args, ownerId: member.id, name: `${args.name} - ${member.nick}` },
              description: getToolDescription("create_requirement", args, member.nick),
              _expandedFrom: "create_requirements_for_all_team_members",
            });
          }
        } else {
          plannedOperations.push({
            tool: toolCall.function.name,
            arguments: args,
            description: getToolDescription(toolCall.function.name, args),
          });
        }
      }

      return {
        success: true,
        preview: true,
        message: `Found ${plannedOperations.length} operation(s) to execute. Please confirm.`,
        operations: plannedOperations as any,
        plan: toolCalls,
        executionTimeMs: Date.now() - startTime,
      };
    }

    // EXECUTION MODE
    const executionPlan = confirmedPlan || toolCalls;
    const operations: AgentResponse["operations"] = [];
    const executionContext: Record<string, any> = {};

    for (const toolCall of executionPlan) {
      const functionName = toolCall.function.name;
      let functionArgs: any;

      try {
        functionArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        operations.push({ tool: functionName, status: "error", error: "Failed to parse function arguments" });
        continue;
      }

      try {
        let result: any;

        switch (functionName) {
          case "get_team_members":
            result = await executeGetTeamMembers(functionArgs);
            executionContext.teamMembers = result.members;
            break;
          case "create_template":
            result = await executeCreateTemplate(functionArgs);
            executionContext.lastTemplate = result.template;
            break;
          case "create_project":
            result = await executeCreateProject(functionArgs);
            executionContext.lastProject = result.project;
            break;
          case "get_projects":
            result = await executeGetProjects(functionArgs);
            executionContext.projects = result.projects;
            break;
          case "update_project":
            result = await executeUpdateProject(functionArgs);
            break;
          case "delete_project":
            result = await executeDeleteProject(functionArgs);
            break;
          case "get_requirements":
            result = await executeGetRequirements(functionArgs);
            break;
          case "update_requirement":
            result = await executeUpdateRequirement(functionArgs);
            break;
          case "delete_requirement":
            result = await executeDeleteRequirement(functionArgs);
            break;
          case "create_team_member":
            result = await executeCreateTeamMember(functionArgs);
            break;
          case "update_team_member":
            result = await executeUpdateTeamMember(functionArgs);
            break;
          case "delete_team_member":
            result = await executeDeleteTeamMember(functionArgs);
            break;
          case "create_requirement":
            if ((!functionArgs.projectId || !isValidUUID(functionArgs.projectId)) && executionContext.lastProject) {
              functionArgs.projectId = executionContext.lastProject.id;
            }
            if ((!functionArgs.templateId || !isValidUUID(functionArgs.templateId)) && executionContext.lastTemplate) {
              functionArgs.templateId = executionContext.lastTemplate.id;
            }
            result = await executeCreateRequirement(functionArgs);
            break;
          case "create_requirements_for_all_team_members":
            if ((!functionArgs.projectId || !isValidUUID(functionArgs.projectId)) && executionContext.lastProject) {
              functionArgs.projectId = executionContext.lastProject.id;
            }
            if ((!functionArgs.templateId || !isValidUUID(functionArgs.templateId)) && executionContext.lastTemplate) {
              functionArgs.templateId = executionContext.lastTemplate.id;
            }
            result = await executeCreateRequirementsForAllTeamMembers(functionArgs);
            break;
          default:
            throw new Error(`Unknown function: ${functionName}`);
        }

        operations.push({ tool: functionName, status: "success", result });
      } catch (error: any) {
        operations.push({ tool: functionName, status: "error", error: error.message || "Unknown error occurred" });
      }
    }

    // Generate summary
    const successCount = operations.filter((op) => op.status === "success").length;
    const errorCount = operations.filter((op) => op.status === "error").length;

    let message = `Completed ${successCount} operation(s) successfully`;
    if (errorCount > 0) message += `, ${errorCount} failed`;
    message += ".";

    const executionTime = Date.now() - startTime;

    // Log execution
    let logId: string | undefined;
    try {
      const [logEntry] = await db.insert(aiExecutionLogs).values({
        prompt,
        success: errorCount === 0,
        operationsCount: operations.length,
        successCount,
        errorCount,
        operations: JSON.stringify(operations),
        executionTimeMs: executionTime,
        automationId: automationId || null,
      }).returning({ id: aiExecutionLogs.id });
      logId = logEntry?.id;
    } catch (logError: any) {
      console.error("Failed to log AI execution:", logError);
    }

    return {
      success: errorCount === 0,
      message,
      operations,
      executionTimeMs: executionTime,
      logId,
    };
  } catch (error: any) {
    console.error("AI Agent error:", error);

    let errorMessage = error.message || "Unknown error";
    let userMessage = "Failed to process AI request";

    if (error.message?.includes("API key")) {
      userMessage = "Authentication failed";
      errorMessage = "Invalid or missing Groq API key.";
    } else if (error.message?.includes("rate limit")) {
      userMessage = "Rate limit exceeded";
      errorMessage = "Too many requests. Please try again in a few moments.";
    } else if (error.message?.includes("network") || error.code === "ENOTFOUND") {
      userMessage = "Network error";
      errorMessage = "Unable to connect to Groq API.";
    }

    // Log error
    const executionTime = Date.now() - startTime;
    try {
      await db.insert(aiExecutionLogs).values({
        prompt,
        success: false,
        operationsCount: 0,
        successCount: 0,
        errorCount: 1,
        operations: JSON.stringify([{ tool: "system", status: "error", error: errorMessage }]),
        executionTimeMs: executionTime,
        automationId: automationId || null,
      });
    } catch (logError) {
      console.error("Failed to log AI execution error:", logError);
    }

    return {
      success: false,
      message: userMessage,
      error: errorMessage,
      operations: [],
      executionTimeMs: executionTime,
    };
  }
}
