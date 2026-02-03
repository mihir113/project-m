import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { checkinResponses } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/checkin-responses?submissionId=<uuid>
// Returns all responses for a given submission, ordered by displayOrder
export async function GET(req: NextRequest) {
  try {
    const submissionId = req.nextUrl.searchParams.get("submissionId");
    if (!submissionId) return NextResponse.json({ error: "submissionId is required" }, { status: 400 });

    const rows = await db
      .select()
      .from(checkinResponses)
      .where(eq(checkinResponses.submissionId, submissionId))
      .orderBy(checkinResponses.displayOrder);

    return NextResponse.json({ data: rows });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch checkin responses" }, { status: 500 });
  }
}

// POST /api/checkin-responses
// Body: { responses: [{ submissionId, goalAreaName, goal, successCriteria, managerComments, engineerReportUrl, displayOrder }] }
// Bulk insert — all responses for one submission come in together
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { responses } = body;

    if (!Array.isArray(responses) || responses.length === 0) {
      return NextResponse.json({ error: "responses array is required" }, { status: 400 });
    }

    const rows = responses.map((r: any) => ({
      submissionId: r.submissionId,
      goalAreaName: r.goalAreaName,
      goal: r.goal,
      successCriteria: r.successCriteria,
      managerComments: r.managerComments || null,
      engineerReportUrl: r.engineerReportUrl || null,
      displayOrder: r.displayOrder,
    }));

    await db.insert(checkinResponses).values(rows);
    return NextResponse.json({ data: { inserted: rows.length } }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to save checkin responses" }, { status: 500 });
  }
}
