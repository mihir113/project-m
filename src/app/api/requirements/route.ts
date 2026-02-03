import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { requirements, teamMembers, metricTemplates } from "@/db/schema";
// 1. Add getTableColumns to your imports
import { eq, and, sql, getTableColumns } from "drizzle-orm";

// GET /api/requirements?projectId=<uuid>&status=<status>&ownerId=<uuid>
// All filters are optional except projectId
export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    const status = req.nextUrl.searchParams.get("status");
    const ownerId = req.nextUrl.searchParams.get("ownerId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const conditions: any[] = [eq(requirements.projectId, projectId)];
    if (status && status !== "all") conditions.push(eq(requirements.status, status as any));
    if (ownerId) conditions.push(eq(requirements.ownerId, ownerId));

    const rows = await db
      .select({
        // 2. Use getTableColumns(requirements) instead of ...requirements
        ...getTableColumns(requirements),
        ownerNick: teamMembers.nick,
        ownerRole: teamMembers.role,
        metricCount: sql<number>`(SELECT COUNT(*) FROM metric_templates WHERE metric_templates.requirement_id = ${requirements.id})`,
      })
      .from(requirements)
      .leftJoin(teamMembers, eq(teamMembers.id, requirements.ownerId))
      .where(and(...conditions))
      .orderBy(requirements.createdAt);

    return NextResponse.json({ data: rows });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch requirements" }, { status: 500 });
  }
}

// POST /api/requirements — create a requirement
// Body: { projectId, name, description?, type, recurrence?, dueDate, ownerId?, isPerMemberCheckIn?, metricTemplates? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, name, description, type, recurrence, dueDate, ownerId, isPerMemberCheckIn, templateId, metricTemplates: metrics } = body;

    if (!projectId || !name || !type || !dueDate) {
      return NextResponse.json({ error: "projectId, name, type, and dueDate are required" }, { status: 400 });
    }

    // Create the requirement
    const [created] = await db
      .insert(requirements)
      .values({
        projectId,
        name: name.trim(),
        description: description?.trim() || null,
        type,
        recurrence: type === "one-time" ? null : recurrence,
        dueDate,
        status: "pending",
        ownerId: ownerId || null,
        isPerMemberCheckIn: isPerMemberCheckIn || false,
        templateId: templateId || null,
      })
      .returning();

    // If metric templates were provided (for per-member check-ins), insert them too
    if (metrics && Array.isArray(metrics) && metrics.length > 0) {
      const metricRows = metrics.map((m: any, index: number) => ({
        requirementId: created.id,
        metricName: m.metricName.trim(),
        targetValue: m.targetValue,
        unit: m.unit,
        displayOrder: index,
      }));
      await db.insert(metricTemplates).values(metricRows);
    }

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to create requirement" }, { status: 500 });
  }
}

// PUT /api/requirements — update a requirement
// Body: { id, ...fields to update }
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, description, type, recurrence, dueDate, status, ownerId, isPerMemberCheckIn, templateId } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (type !== undefined) updates.type = type;
    if (recurrence !== undefined) updates.recurrence = recurrence;
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (status !== undefined) updates.status = status;
    if (ownerId !== undefined) updates.ownerId = ownerId || null;
    if (isPerMemberCheckIn !== undefined) updates.isPerMemberCheckIn = isPerMemberCheckIn;
    if (templateId !== undefined) updates.templateId = templateId || null;

    const [updated] = await db
      .update(requirements)
      .set(updates)
      .where(eq(requirements.id, id))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update requirement" }, { status: 500 });
  }
}

// DELETE /api/requirements?id=<uuid>
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await db.delete(requirements).where(eq(requirements.id, id));
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete requirement" }, { status: 500 });
  }
}