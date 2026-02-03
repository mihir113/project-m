import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { submissions } from "@/db/schema";
import { eq, isNotNull, and, sql } from "drizzle-orm";

// GET /api/submissions/cycles?requirementId=<uuid>
// Returns all unique cycle labels for a given requirement, ordered newest first
export async function GET(req: NextRequest) {
  try {
    const requirementId = req.nextUrl.searchParams.get("requirementId");
    if (!requirementId) {
      return NextResponse.json({ error: "requirementId is required" }, { status: 400 });
    }

    const rows = await db
      .select({ cycleLabel: submissions.cycleLabel })
      .from(submissions)
      .where(
        and(
          eq(submissions.requirementId, requirementId),
          isNotNull(submissions.cycleLabel)
        )
      )
      .groupBy(submissions.cycleLabel)
      .orderBy(sql`${submissions.cycleLabel} DESC`);

    const cycles = rows.map((r) => r.cycleLabel).filter(Boolean);
    return NextResponse.json({ data: cycles });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch cycles" }, { status: 500 });
  }
}
