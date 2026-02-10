import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { taskAutomations, requirements, teamMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// POST /api/automations/execute — run all enabled automations
// This endpoint should be called by an external cron service (e.g. cron-job.org)
export async function POST(req: NextRequest) {
  try {
    // Optional: Add authentication here
    const token = req.headers.get("x-cron-secret");
    if (process.env.CRON_SECRET && token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all enabled automations
    const automations = await db
      .select()
      .from(taskAutomations)
      .where(eq(taskAutomations.enabled, true));

    const results = [];
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const dayOfMonth = now.getDate(); // 1-31

    for (const auto of automations) {
      // Check if today matches the schedule
      let shouldRun = false;

      switch (auto.recurrence) {
        case "daily":
          shouldRun = true;
          break;
        case "weekly":
          // Only run if dayOfWeek matches
          if (auto.dayOfWeek === null) {
            // No day specified = run every day (legacy behavior)
            shouldRun = true;
          } else if (auto.dayOfWeek === 7) {
            // Business days: Monday (1) through Friday (5)
            shouldRun = dayOfWeek >= 1 && dayOfWeek <= 5;
          } else {
            shouldRun = auto.dayOfWeek === dayOfWeek;
          }
          break;
        case "monthly":
          // Only run if dayOfMonth matches
          if (auto.dayOfMonth === null) {
            // No day specified = run on 1st
            shouldRun = dayOfMonth === 1;
          } else {
            shouldRun = auto.dayOfMonth === dayOfMonth;
          }
          break;
        case "quarterly":
          // Run on first day of quarter (Jan 1, Apr 1, Jul 1, Oct 1)
          const month = now.getMonth() + 1;
          shouldRun = dayOfMonth === 1 && (month === 1 || month === 4 || month === 7 || month === 10);
          break;
        default:
          shouldRun = false;
      }

      if (!shouldRun) {
        results.push({
          automationId: auto.id,
          taskName: auto.taskName,
          action: "skipped",
          reason: `Not scheduled for today (recurrence: ${auto.recurrence}, dayOfWeek: ${auto.dayOfWeek}, dayOfMonth: ${auto.dayOfMonth}, today: dayOfWeek=${dayOfWeek}, dayOfMonth=${dayOfMonth})`,
        });
        continue;
      }

      if (auto.skipIfExists) {
        // Check if a pending task with this name created TODAY already exists
        // If yes, delete it and create a fresh one (this handles "replace" behavior)
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
          // Delete the old one
          await db.delete(requirements).where(eq(requirements.id, existing[0].id));
          
          results.push({
            automationId: auto.id,
            taskName: auto.taskName,
            action: "replaced",
            reason: "Deleted existing pending task and creating new one",
            deletedTaskId: existing[0].id,
          });
        }
      }

      // Default owner to Mihir if not set on the automation
      let resolvedOwnerId = auto.ownerId || null;
      if (!resolvedOwnerId) {
        const [mihir] = await db
          .select({ id: teamMembers.id })
          .from(teamMembers)
          .where(eq(teamMembers.nick, "Mihir"))
          .limit(1);
        if (mihir) resolvedOwnerId = mihir.id;
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
          dueDate: todayStr,
          status: "pending",
          ownerId: resolvedOwnerId,
          isPerMemberCheckIn: false,
          templateId: null,
        })
        .returning();

      results.push({
        automationId: auto.id,
        taskName: auto.taskName,
        action: "created",
        taskId: created.id,
        dueDate: todayStr,
      });
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      serverDay: {
        dayOfWeek,
        dayOfMonth,
        dayName: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek],
      },
      processedCount: automations.length,
      results,
    });
  } catch (err) {
    console.error("POST /api/automations/execute error:", err);
    return NextResponse.json({ error: "Execution failed", details: String(err) }, { status: 500 });
  }
}
