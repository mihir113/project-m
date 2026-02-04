import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { taskAutomations, requirements } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// POST /api/automations/execute — run all enabled automations
// This endpoint should be called by an external cron service (e.g. cron-job.org)
export async function POST(req: NextRequest) {
  try {
    // Optional: Add authentication here (e.g., check for a secret token in headers)
    // const token = req.headers.get("x-cron-secret");
    // if (token !== process.env.CRON_SECRET) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    // Get all enabled automations
    const automations = await db
      .select()
      .from(taskAutomations)
      .where(eq(taskAutomations.enabled, true));

    const results = [];
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    for (const auto of automations) {
      // Check if we should create a task based on recurrence
      // For simplicity, we'll create on every run and let skipIfExists handle duplicates
      // In production, you'd check last run date or use a more sophisticated scheduler

      if (auto.skipIfExists) {
        // Check if a pending task with this name already exists in this project
        const existing = await db
          .select()
          .from(requirements)
          .where(
            and(
              eq(requirements.projectId, auto.projectId),
              eq(requirements.name, auto.taskName),
              eq(requirements.status, "pending")
            )
          )
          .limit(1);

        if (existing.length > 0) {
          results.push({
            automationId: auto.id,
            taskName: auto.taskName,
            action: "skipped",
            reason: "Pending task already exists",
          });
          continue;
        }
      }

      // Create the task
      const [created] = await db
        .insert(requirements)
        .values({
          projectId: auto.projectId,
          name: auto.taskName,
          description: auto.description || null,
          type: "recurring",
          recurrence: auto.recurrence,
          dueDate: todayStr, // Set due date to today (can be customized)
          status: "pending",
          ownerId: auto.ownerId || null,
          isPerMemberCheckIn: false,
          templateId: null,
        })
        .returning();

      results.push({
        automationId: auto.id,
        taskName: auto.taskName,
        action: "created",
        taskId: created.id,
      });
    }

    return NextResponse.json({
      success: true,
      timestamp: today.toISOString(),
      processedCount: automations.length,
      results,
    });
  } catch (err) {
    console.error("POST /api/automations/execute error:", err);
    return NextResponse.json({ error: "Execution failed" }, { status: 500 });
  }
}
