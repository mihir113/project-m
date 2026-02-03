import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { checkInTemplates, templateGoalAreas, templateGoals } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/check-in-templates
// No params → returns all templates (flat list)
// ?id=<uuid>  → returns one template with full goal areas + goals nested
export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");

    if (id) {
      const template = await db.select().from(checkInTemplates).where(eq(checkInTemplates.id, id));
      if (!template.length) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }

      const goalAreas = await db
        .select()
        .from(templateGoalAreas)
        .where(eq(templateGoalAreas.templateId, id))
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

      return NextResponse.json({ data: { ...template[0], goalAreas: areasWithGoals } });
    }

    const templates = await db.select().from(checkInTemplates).orderBy(checkInTemplates.createdAt);
    return NextResponse.json({ data: templates });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

// POST /api/check-in-templates
// Body: { name, description? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description } = body;
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const [created] = await db
      .insert(checkInTemplates)
      .values({ name: name.trim(), description: description?.trim() || null })
      .returning();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}

// PUT /api/check-in-templates
// Body: { id, name?, description? }
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, description } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;

    const [updated] = await db
      .update(checkInTemplates)
      .set(updates)
      .where(eq(checkInTemplates.id, id))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

// DELETE /api/check-in-templates?id=<uuid>
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await db.delete(checkInTemplates).where(eq(checkInTemplates.id, id));
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
