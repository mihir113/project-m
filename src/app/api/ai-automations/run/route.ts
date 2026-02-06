import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { aiAutomations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { executeAICommand } from "@/lib/aiAgentCore";

// POST /api/ai-automations/run — manually trigger a single AI automation
// Body: { id: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Fetch the automation
    const [automation] = await db
      .select()
      .from(aiAutomations)
      .where(eq(aiAutomations.id, id));

    if (!automation) {
      return NextResponse.json({ error: "AI automation not found" }, { status: 404 });
    }

    // Execute the AI command
    const result = await executeAICommand({
      prompt: automation.prompt,
      preview: false,
      rules: automation.rules || undefined,
      automationId: automation.id,
    });

    // Update the automation with last run info
    const now = new Date();
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
      .where(eq(aiAutomations.id, id));

    return NextResponse.json({
      success: result.success,
      automationId: id,
      name: automation.name,
      message: result.message,
      operationsCount: result.operations.length,
      executionTimeMs: result.executionTimeMs,
      logId: result.logId,
      operations: result.operations,
    });
  } catch (err: any) {
    console.error("POST /api/ai-automations/run error:", err);
    return NextResponse.json(
      { error: "Failed to run AI automation", details: err.message },
      { status: 500 }
    );
  }
}
