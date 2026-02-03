import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { metricTemplates } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// GET /api/metric-templates?requirementId=<uuid>
export async function GET(req: NextRequest) {
  try {
    const requirementId = req.nextUrl.searchParams.get("requirementId");
    if (!requirementId) {
      return NextResponse.json({ error: "requirementId is required" }, { status: 400 });
    }

    const rows = await db
      .select()
      .from(metricTemplates)
      .where(eq(metricTemplates.requirementId, requirementId))
      .orderBy(metricTemplates.displayOrder);

    return NextResponse.json({ data: rows });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch metric templates" }, { status: 500 });
  }
}

// POST /api/metric-templates — add one metric template
// Body: { requirementId, metricName, targetValue, unit, displayOrder }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { requirementId, metricName, targetValue, unit, displayOrder } = body;

    if (!requirementId || !metricName || targetValue === undefined || !unit || displayOrder === undefined) {
      return NextResponse.json({ error: "requirementId, metricName, targetValue, unit, displayOrder are required" }, { status: 400 });
    }

    const [created] = await db
      .insert(metricTemplates)
      .values({
        requirementId,
        metricName: metricName.trim(),
        targetValue: String(targetValue),
        unit: unit.trim(),
        displayOrder,
      })
      .returning();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to add metric template" }, { status: 500 });
  }
}

// PUT /api/metric-templates — update one metric (name, target, unit, or reorder)
// Body: { id, metricName?, targetValue?, unit?, displayOrder? }
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, metricName, targetValue, unit, displayOrder } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (metricName !== undefined) updates.metricName = metricName.trim();
    if (targetValue !== undefined) updates.targetValue = String(targetValue);
    if (unit !== undefined) updates.unit = unit.trim();
    if (displayOrder !== undefined) updates.displayOrder = displayOrder;

    const [updated] = await db
      .update(metricTemplates)
      .set(updates)
      .where(eq(metricTemplates.id, id))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update metric template" }, { status: 500 });
  }
}

// DELETE /api/metric-templates?id=<uuid>
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await db.delete(metricTemplates).where(eq(metricTemplates.id, id));
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete metric template" }, { status: 500 });
  }
}
