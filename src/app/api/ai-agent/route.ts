import { NextRequest, NextResponse } from "next/server";
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
import { eq } from "drizzle-orm";
import { aiAgentRateLimiter, getClientIP } from "@/lib/rateLimiter";

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

interface AssignProjectParams {
  projectId: string;
  ownerId: string;
}

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface AgentResponse {
  success: boolean;
  message: string;
  operations: Array<{
    tool: string;
    status: "success" | "error";
    result?: any;
    error?: string;
  }>;
}

// ─────────────────────────────────────────────
// GROQ FUNCTION DEFINITIONS
// ─────────────────────────────────────────────

const tools = [
  {
    type: "function",
    function: {
      name: "get_team_members",
      description: "Get all team members from the database. Use this to find team member IDs for assignment.",
      parameters: {
        type: "object",
        properties: {},
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
] as const;

// ─────────────────────────────────────────────
// TOOL IMPLEMENTATION FUNCTIONS
// ─────────────────────────────────────────────

// Helper function to generate human-readable descriptions
function getToolDescription(toolName: string, args: any): string {
  switch (toolName) {
    case "get_team_members":
      return "Fetch all team members from the database";
    case "create_template":
      return `Create template "${args.name}"${args.goalAreas ? ` with ${args.goalAreas.length} goal area(s)` : ""}`;
    case "create_project":
      return `Create project "${args.name}"${args.category ? ` in category "${args.category}"` : ""}`;
    case "create_requirement":
      return `Create ${args.type} requirement "${args.name}" due ${args.dueDate}`;
    default:
      return `Execute ${toolName}`;
  }
}

async function executeGetTeamMembers(): Promise<any> {
  const members = await db.select().from(teamMembers).orderBy(teamMembers.nick);
  return { members };
}

async function executeCreateTemplate(params: CreateTemplateParams): Promise<any> {
  // Create the template
  const [template] = await db
    .insert(checkInTemplates)
    .values({
      name: params.name.trim(),
      description: params.description?.trim() || null,
    })
    .returning();

  // If goal areas are provided, create them with their goals
  if (params.goalAreas && params.goalAreas.length > 0) {
    for (let i = 0; i < params.goalAreas.length; i++) {
      const area = params.goalAreas[i];
      const [goalArea] = await db
        .insert(templateGoalAreas)
        .values({
          templateId: template.id,
          name: area.name.trim(),
          displayOrder: i,
        })
        .returning();

      // Create goals for this area
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
      description: params.description?.trim() || null,
      status: params.status || "active",
      color: params.color || "#4f6ff5",
      category: params.category?.trim() || null,
    })
    .returning();

  return { project };
}

async function executeCreateRequirement(params: CreateRequirementParams): Promise<any> {
  const [requirement] = await db
    .insert(requirements)
    .values({
      projectId: params.projectId,
      name: params.name.trim(),
      description: params.description?.trim() || null,
      type: params.type,
      recurrence: params.type === "recurring" ? params.recurrence : null,
      dueDate: params.dueDate,
      status: "pending",
      ownerId: params.ownerId || null,
      isPerMemberCheckIn: params.isPerMemberCheckIn || false,
      templateId: params.templateId || null,
    })
    .returning();

  return { requirement };
}

// ─────────────────────────────────────────────
// MAIN API HANDLER
// ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  // Rate limiting
  const clientIP = getClientIP(req);
  const rateLimit = aiAgentRateLimiter.check(clientIP);

  if (!rateLimit.allowed) {
    const resetInSeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      {
        success: false,
        message: "Rate limit exceeded",
        error: `Too many requests. Please try again in ${resetInSeconds} seconds.`,
        operations: [],
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateLimit.resetAt.toString(),
          "Retry-After": resetInSeconds.toString(),
        },
      }
    );
  }

  try {
    const body = await req.json();
    const { prompt, preview = false, confirmedPlan } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "prompt is required and must be a string" },
        { status: 400 }
      );
    }

    // Check if API key is configured
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          message: "Groq API key not configured",
          error: "GROQ_API_KEY environment variable is not set. Please add it to your environment variables.",
          operations: [],
        },
        { status: 500 }
      );
    }

    // Initialize Groq client
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    // Step 1: Send prompt to Groq with function calling
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are an AI assistant that helps users manage their OpSync database through natural language commands.
You have access to tools for creating templates, projects, requirements, and querying team members.
Always use get_team_members first if the user mentions assigning to someone by name.
When creating requirements, use ISO date format (YYYY-MM-DD) for dueDate.
Execute operations in logical order (e.g., create project before adding requirements to it).`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama-3.3-70b-versatile",
      tools: tools as any,
      tool_choice: "auto",
      temperature: 0.3,
      max_tokens: 4096,
    });

    const responseMessage = chatCompletion.choices[0]?.message;
    const toolCalls = responseMessage?.tool_calls as ToolCall[] | undefined;

    if (!toolCalls || toolCalls.length === 0) {
      return NextResponse.json({
        success: false,
        message: responseMessage?.content || "No operations identified from your request.",
        operations: [],
      });
    }

    // PREVIEW MODE: Return plan without executing
    if (preview) {
      const plannedOperations = toolCalls.map((toolCall) => {
        let args: any;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = {};
        }
        return {
          tool: toolCall.function.name,
          arguments: args,
          description: getToolDescription(toolCall.function.name, args),
        };
      });

      return NextResponse.json({
        success: true,
        preview: true,
        message: `Found ${plannedOperations.length} operation(s) to execute. Please confirm.`,
        operations: plannedOperations,
        plan: toolCalls, // Store the plan for execution
      });
    }

    // Use confirmed plan if provided, otherwise use fresh tool calls
    const executionPlan = confirmedPlan || toolCalls;

    // Step 2: Execute tool calls sequentially (to maintain order dependencies)
    const operations: AgentResponse["operations"] = [];
    const executionContext: Record<string, any> = {}; // Store results for cross-tool reference

    for (const toolCall of executionPlan) {
      const functionName = toolCall.function.name;
      let functionArgs: any;

      try {
        functionArgs = JSON.parse(toolCall.function.arguments);
      } catch (parseError) {
        operations.push({
          tool: functionName,
          status: "error",
          error: "Failed to parse function arguments",
        });
        continue;
      }

      try {
        let result: any;

        switch (functionName) {
          case "get_team_members":
            result = await executeGetTeamMembers();
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

          case "create_requirement":
            // Allow using lastProject.id if projectId is missing
            if (!functionArgs.projectId && executionContext.lastProject) {
              functionArgs.projectId = executionContext.lastProject.id;
            }
            // Allow using lastTemplate.id if templateId is missing
            if (!functionArgs.templateId && executionContext.lastTemplate) {
              functionArgs.templateId = executionContext.lastTemplate.id;
            }
            result = await executeCreateRequirement(functionArgs);
            break;

          default:
            throw new Error(`Unknown function: ${functionName}`);
        }

        operations.push({
          tool: functionName,
          status: "success",
          result,
        });
      } catch (error: any) {
        operations.push({
          tool: functionName,
          status: "error",
          error: error.message || "Unknown error occurred",
        });
      }
    }

    // Step 3: Generate summary message
    const successCount = operations.filter((op) => op.status === "success").length;
    const errorCount = operations.filter((op) => op.status === "error").length;

    let message = `Completed ${successCount} operation(s) successfully`;
    if (errorCount > 0) {
      message += `, ${errorCount} failed`;
    }
    message += ".";

    const response: AgentResponse = {
      success: errorCount === 0,
      message,
      operations,
    };

    // Log execution to database
    const executionTime = Date.now() - startTime;
    try {
      await db.insert(aiExecutionLogs).values({
        prompt,
        success: errorCount === 0,
        operationsCount: operations.length,
        successCount,
        errorCount,
        operations: JSON.stringify(operations),
        executionTimeMs: executionTime,
      });
    } catch (logError) {
      console.error("Failed to log AI execution:", logError);
      // Don't fail the request if logging fails
    }

    // Add rate limit headers to successful responses
    const rateLimitStatus = aiAgentRateLimiter.getStatus(clientIP);
    return NextResponse.json(response, {
      headers: {
        "X-RateLimit-Limit": "10",
        "X-RateLimit-Remaining": rateLimitStatus.remaining.toString(),
        "X-RateLimit-Reset": rateLimitStatus.resetAt.toString(),
      },
    });
  } catch (error: any) {
    console.error("AI Agent error:", error);

    // Provide more specific error messages
    let errorMessage = error.message || "Unknown error";
    let userMessage = "Failed to process AI request";

    if (error.message?.includes("API key")) {
      userMessage = "Authentication failed";
      errorMessage = "Invalid or missing Groq API key. Please check your GROQ_API_KEY environment variable.";
    } else if (error.message?.includes("rate limit")) {
      userMessage = "Rate limit exceeded";
      errorMessage = "Too many requests. Please try again in a few moments.";
    } else if (error.message?.includes("network") || error.code === "ENOTFOUND") {
      userMessage = "Network error";
      errorMessage = "Unable to connect to Groq API. Please check your internet connection.";
    }

    return NextResponse.json(
      {
        success: false,
        message: userMessage,
        error: errorMessage,
        operations: [],
      },
      { status: 500 }
    );
  }
}
