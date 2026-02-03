import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { templateGoalAreas } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/goal-areas?templateId=<uuid>
export async function GET(req: NextRequest) {
  try {
    const templateId = req.nextUrl.searchParams.get("templateId");
    if (!templateId) return NextResponse.json({ error: "templateId is required" }, { status: 400 });

    const areas = await db
      .select()
      .from(templateGoalAreas)
      .where(eq(templateGoalAreas.templateId, templateId))
      .orderBy(templateGoalAreas.displayOrder);

    return NextResponse.json({ data: areas });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch goal areas" }, { status: 500 });
  }
}

// POST /api/goal-areas
// Body: { templateId, name, displayOrder }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { templateId, name, displayOrder } = body;
    if (!templateId || !name) return NextResponse.json({ error: "templateId and name required" }, { status: 400 });

    const [created] = await db
      .insert(templateGoalAreas)
      .values({ templateId, name: name.trim(), displayOrder: displayOrder ?? 0 })
      .returning();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to add goal area" }, { status: 500 });
  }
}

// PUT /api/goal-areas
// Body: { id, name?, displayOrder? }
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, displayOrder } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name.trim();
    if (displayOrder !== undefined) updates.displayOrder = displayOrder;

    const [updated] = await db
      .update(templateGoalAreas)
      .set(updates)
      .where(eq(templateGoalAreas.id, id))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update goal area" }, { status: 500 });
  }
}

// DELETE /api/goal-areas?id=<uuid>
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await db.delete(templateGoalAreas).where(eq(templateGoalAreas.id, id));
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete goal area" }, { status: 500 });
  }
}
