import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { submissions, metricEntries, teamMembers, metricTemplates } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// GET /api/submissions?requirementId=<uuid>&cycleLabel=<label>
// Fetches submissions for a requirement, optionally filtered by cycle.
// Returns submissions with their team member info and metric entries.
export async function GET(req: NextRequest) {
  try {
    const requirementId = req.nextUrl.searchParams.get("requirementId");
    const cycleLabel = req.nextUrl.searchParams.get("cycleLabel");

    if (!requirementId) {
      return NextResponse.json({ error: "requirementId is required" }, { status: 400 });
    }

    const conditions: any[] = [eq(submissions.requirementId, requirementId)];
    if (cycleLabel) conditions.push(eq(submissions.cycleLabel, cycleLabel));

    // Get submissions with team member info
    const rows = await db
      .select({
        ...submissions,
        teamMemberNick: teamMembers.nick,
        teamMemberRole: teamMembers.role,
      })
      .from(submissions)
      .leftJoin(teamMembers, eq(teamMembers.id, submissions.teamMemberId))
      .where(and(...conditions))
      .orderBy(submissions.createdAt);

    // For each submission, fetch its metric entries
    const enriched = await Promise.all(
      rows.map(async (sub) => {
        const entries = await db
          .select({
            ...metricEntries,
            metricName: metricTemplates.metricName,
            targetValue: metricTemplates.targetValue,
            unit: metricTemplates.unit,
            displayOrder: metricTemplates.displayOrder,
          })
          .from(metricEntries)
          .leftJoin(metricTemplates, eq(metricTemplates.id, metricEntries.metricTemplateId))
          .where(eq(metricEntries.submissionId, sub.id))
          .orderBy(metricTemplates.displayOrder);

        return { ...sub, metricEntries: entries };
      })
    );

    return NextResponse.json({ data: enriched });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 });
  }
}

// POST /api/submissions — log a completion
//
// For SIMPLE requirements:
//   Body: { requirementId, notes? }
//   → creates one submission row, no metric entries
//
// For PER-MEMBER check-ins:
//   Body: { requirementId, teamMemberId, cycleLabel, notes?, metricEntries: [{ metricTemplateId, actualValue, comments? }] }
//   → creates one submission + one metric_entry per metric
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { requirementId, teamMemberId, cycleLabel, notes, metricEntries: metrics } = body;

    if (!requirementId) {
      return NextResponse.json({ error: "requirementId is required" }, { status: 400 });
    }

    // Create the submission row
    const [submission] = await db
      .insert(submissions)
      .values({
        requirementId,
        teamMemberId: teamMemberId || null,
        cycleLabel: cycleLabel || null,
        notes: notes || null,
        completedAt: new Date(),
      })
      .returning();

    // If metric entries were provided, insert them
    if (metrics && Array.isArray(metrics) && metrics.length > 0) {
      const entryRows = metrics.map((m: any) => ({
        submissionId: submission.id,
        metricTemplateId: m.metricTemplateId,
        actualValue: String(m.actualValue),
        comments: m.comments || null,
      }));
      await db.insert(metricEntries).values(entryRows);
    }

    return NextResponse.json({ data: submission }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to log submission" }, { status: 500 });
  }
}

// GET /api/submissions/cycles?requirementId=<uuid>
// Returns all distinct cycle labels for a requirement (for the History tab)
// This is handled in the cycles sub-route file
