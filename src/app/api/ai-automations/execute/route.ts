import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { aiAutomations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { executeAICommand } from "@/lib/aiAgentCore";

// POST /api/ai-automations/execute — run all enabled AI automations on schedule
// Called by cron-job.org daily
export async function POST(req: NextRequest) {
  try {
    // Authenticate with cron secret
    const token = req.headers.get("x-cron-secret");
    if (process.env.CRON_SECRET && token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all enabled AI automations
    const automations = await db
      .select()
      .from(aiAutomations)
      .where(eq(aiAutomations.enabled, true));

    const results = [];
    const now = new Date();
    const dayOfWeek = now.getDay();
    const dayOfMonth = now.getDate();

    for (const auto of automations) {
      // Check if today matches the schedule
      let shouldRun = false;

      switch (auto.schedule) {
        case "daily":
          shouldRun = true;
          break;
        case "weekly":
          shouldRun = auto.dayOfWeek === null || auto.dayOfWeek === dayOfWeek;
          break;
        case "monthly":
          shouldRun = auto.dayOfMonth === null
            ? dayOfMonth === 1
            : auto.dayOfMonth === dayOfMonth;
          break;
        default:
          shouldRun = false;
      }

      if (!shouldRun) {
        results.push({
          automationId: auto.id,
          name: auto.name,
          action: "skipped",
          reason: `Not scheduled for today (schedule: ${auto.schedule}, dayOfWeek: ${auto.dayOfWeek}, dayOfMonth: ${auto.dayOfMonth})`,
        });
        continue;
      }

      // Execute the AI command
      try {
        const result = await executeAICommand({
          prompt: auto.prompt,
          preview: false,
          rules: auto.rules || undefined,
          automationId: auto.id,
        });

        // Update the automation with last run info
        const status = result.success ? "success" : "error";
        await db
          .update(aiAutomations)
          .set({
            lastRunAt: now,
            lastRunStatus: status,
            lastRunSummary: result.message,
            lastRunLogId: result.logId || null,
            updatedAt: now,
          })
          .where(eq(aiAutomations.id, auto.id));

        results.push({
          automationId: auto.id,
          name: auto.name,
          action: "executed",
          success: result.success,
          message: result.message,
          operationsCount: result.operations.length,
          executionTimeMs: result.executionTimeMs,
          logId: result.logId,
        });
      } catch (err: any) {
        // Record failure but continue to next automation
        await db
          .update(aiAutomations)
          .set({
            lastRunAt: now,
            lastRunStatus: "error",
            lastRunSummary: `Execution failed: ${err.message}`,
            updatedAt: now,
          })
          .where(eq(aiAutomations.id, auto.id));

        results.push({
          automationId: auto.id,
          name: auto.name,
          action: "error",
          error: err.message,
        });
      }

      // Small delay between automations to avoid rate limits
      if (automations.indexOf(auto) < automations.length - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
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
    console.error("POST /api/ai-automations/execute error:", err);
    return NextResponse.json({ error: "Execution failed", details: String(err) }, { status: 500 });
  }
}
