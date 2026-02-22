import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { performanceSnapshots, checkInTemplates, templateGoalAreas, templateGoals } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

// GET /api/performance-snapshots?memberId=<uuid>
// Returns all snapshots for a member, each with full template goal tree
export async function GET(req: NextRequest) {
  try {
    const memberId = req.nextUrl.searchParams.get("memberId");
    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    }

    const snapshots = await db
      .select()
      .from(performanceSnapshots)
      .where(eq(performanceSnapshots.memberId, memberId))
      .orderBy(desc(performanceSnapshots.createdAt));

    // Enrich each snapshot with its template's goal structure
    const enriched = await Promise.all(
      snapshots.map(async (snap) => {
        if (!snap.templateId) return { ...snap, template: null };

        const [template] = await db
          .select()
          .from(checkInTemplates)
          .where(eq(checkInTemplates.id, snap.templateId));

        if (!template) return { ...snap, template: null };

        const goalAreas = await db
          .select()
          .from(templateGoalAreas)
          .where(eq(templateGoalAreas.templateId, snap.templateId))
          .orderBy(templateGoalAreas.displayOrder);

        const areasWithGoals = await Promise.all(
          goalAreas.map(async (area) => {
            const goals = await db
              .select()
              .from(templateGoals)
              .where(eq(templateGoals.goalAreaId, area.id))
              .orderBy(templateGoals.displayOrder);
            return { ...area, goals };
          })
        );

        return { ...snap, template: { ...template, goalAreas: areasWithGoals } };
      })
    );

    return NextResponse.json({ data: enriched });
  } catch {
    return NextResponse.json({ error: "Failed to fetch snapshots" }, { status: 500 });
  }
}

// POST /api/performance-snapshots
// Body: { memberId, templateId?, quarter, managerNotes? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { memberId, templateId, quarter, managerNotes } = body;

    if (!memberId || !quarter) {
      return NextResponse.json({ error: "memberId and quarter are required" }, { status: 400 });
    }

    // Check for existing snapshot for this member+quarter
    const existing = await db
      .select()
      .from(performanceSnapshots)
      .where(
        and(
          eq(performanceSnapshots.memberId, memberId),
          eq(performanceSnapshots.quarter, quarter)
        )
      );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "A snapshot for this quarter already exists" },
        { status: 409 }
      );
    }

    const [created] = await db
      .insert(performanceSnapshots)
      .values({
        memberId,
        templateId: templateId || null,
        quarter,
        managerNotes: managerNotes?.trim() || null,
        status: "draft",
        version: 1,
      })
      .returning();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create snapshot" }, { status: 500 });
  }
}

// PUT /api/performance-snapshots
// Body: { id, managerNotes?, templateId?, status? }
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, managerNotes, templateId, status, aiSynthesis } = body;

    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (managerNotes !== undefined) updates.managerNotes = managerNotes?.trim() || null;
    if (templateId !== undefined) updates.templateId = templateId || null;
    if (status !== undefined) updates.status = status;
    if (aiSynthesis !== undefined) updates.aiSynthesis = aiSynthesis;

    const [updated] = await db
      .update(performanceSnapshots)
      .set(updates)
      .where(eq(performanceSnapshots.id, id))
      .returning();

    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update snapshot" }, { status: 500 });
  }
}

// DELETE /api/performance-snapshots?id=<uuid>
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    await db.delete(performanceSnapshots).where(eq(performanceSnapshots.id, id));
    return NextResponse.json({ data: { deleted: true } });
  } catch {
    return NextResponse.json({ error: "Failed to delete snapshot" }, { status: 500 });
  }
}
