import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { aiExecutionLogs } from "@/db/schema";
import { desc } from "drizzle-orm";

// GET /api/ai-logs — returns all AI execution logs
// Supports pagination via ?limit=N&offset=N
export async function GET(req: NextRequest) {
  try {
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");
    const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0");

    const logs = await db
      .select()
      .from(aiExecutionLogs)
      .orderBy(desc(aiExecutionLogs.createdAt))
      .limit(Math.min(limit, 100)) // Max 100 per request
      .offset(offset);

    // Parse operations JSON for each log
    const logsWithParsedOperations = logs.map((log) => ({
      ...log,
      operations: JSON.parse(log.operations),
    }));

    return NextResponse.json({ data: logsWithParsedOperations });
  } catch (err) {
    console.error("GET /api/ai-logs error:", err);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
