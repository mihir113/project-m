import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { templateGoals } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/goal-areas/goals?goalAreaId=<uuid>
export async function GET(req: NextRequest) {
  try {
    const goalAreaId = req.nextUrl.searchParams.get("goalAreaId");
    if (!goalAreaId) return NextResponse.json({ error: "goalAreaId is required" }, { status: 400 });

    const goals = await db
      .select()
      .from(templateGoals)
      .where(eq(templateGoals.goalAreaId, goalAreaId))
      .orderBy(templateGoals.displayOrder);

    return NextResponse.json({ data: goals });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 });
  }
}

// POST /api/goal-areas/goals
// Body: { goalAreaId, goal, successCriteria, displayOrder }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { goalAreaId, goal, successCriteria, reportUrl, displayOrder } = body;
    if (!goalAreaId || !goal) {
      return NextResponse.json({ error: "goalAreaId and goal are required" }, { status: 400 });
    }

    const [created] = await db
      .insert(templateGoals)
      .values({
        goalAreaId,
        goal: goal.trim(),
        successCriteria: (successCriteria || "").trim(),
        reportUrl: reportUrl?.trim() || null,
        displayOrder: displayOrder ?? 0,
      })
      .returning();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to add goal" }, { status: 500 });
  }
}

// PUT /api/goal-areas/goals
// Body: { id, goal?, successCriteria?, displayOrder? }
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, goal, successCriteria, reportUrl, displayOrder } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const updates: Record<string, any> = {};
    if (goal !== undefined) updates.goal = goal.trim();
    if (successCriteria !== undefined) updates.successCriteria = successCriteria.trim();
    if (reportUrl !== undefined) updates.reportUrl = reportUrl?.trim() || null;
    if (displayOrder !== undefined) updates.displayOrder = displayOrder;

    const [updated] = await db
      .update(templateGoals)
      .set(updates)
      .where(eq(templateGoals.id, id))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update goal" }, { status: 500 });
  }
}

// DELETE /api/goal-areas/goals?id=<uuid>
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await db.delete(templateGoals).where(eq(templateGoals.id, id));
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete goal" }, { status: 500 });
  }
}
