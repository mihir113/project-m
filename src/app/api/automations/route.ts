import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { taskAutomations, projects, teamMembers } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/automations — return all automation rules with project names
export async function GET() {
  try {
    const rows = await db
      .select({
        id: taskAutomations.id,
        projectId: taskAutomations.projectId,
        projectName: projects.name,
        projectColor: projects.color,
        taskName: taskAutomations.taskName,
        description: taskAutomations.description,
        recurrence: taskAutomations.recurrence,
        dayOfWeek: taskAutomations.dayOfWeek,
        dayOfMonth: taskAutomations.dayOfMonth,
        skipIfExists: taskAutomations.skipIfExists,
        enabled: taskAutomations.enabled,
        ownerId: taskAutomations.ownerId,
        ownerNick: teamMembers.nick,
        createdAt: taskAutomations.createdAt,
        updatedAt: taskAutomations.updatedAt,
      })
      .from(taskAutomations)
      .leftJoin(projects, eq(taskAutomations.projectId, projects.id))
      .leftJoin(teamMembers, eq(taskAutomations.ownerId, teamMembers.id))
      .orderBy(taskAutomations.createdAt);

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error("GET /api/automations error:", err);
    return NextResponse.json({ error: "Failed to fetch automations" }, { status: 500 });
  }
}

// POST /api/automations — create a new automation rule
// Body: { projectId, taskName, description?, recurrence, dayOfWeek?, dayOfMonth?, skipIfExists?, enabled?, ownerId? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, taskName, description, recurrence, dayOfWeek, dayOfMonth, skipIfExists, enabled, ownerId } = body;

    if (!projectId || !taskName || !recurrence) {
      return NextResponse.json(
        { error: "projectId, taskName, and recurrence are required" },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(taskAutomations)
      .values({
        projectId,
        taskName: taskName.trim(),
        description: description?.trim() || null,
        recurrence,
        dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : null,
        dayOfMonth: dayOfMonth !== undefined ? dayOfMonth : null,
        skipIfExists: skipIfExists !== undefined ? skipIfExists : true,
        enabled: enabled !== undefined ? enabled : true,
        ownerId: ownerId || null,
      })
      .returning();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/automations error:", err);
    return NextResponse.json({ error: "Failed to create automation" }, { status: 500 });
  }
}

// PUT /api/automations — update an automation rule
// Body: { id, ...fields to update }
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, taskName, description, recurrence, dayOfWeek, dayOfMonth, skipIfExists, enabled, ownerId } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (taskName !== undefined) updates.taskName = taskName.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (recurrence !== undefined) updates.recurrence = recurrence;
    if (dayOfWeek !== undefined) updates.dayOfWeek = dayOfWeek;
    if (dayOfMonth !== undefined) updates.dayOfMonth = dayOfMonth;
    if (skipIfExists !== undefined) updates.skipIfExists = skipIfExists;
    if (enabled !== undefined) updates.enabled = enabled;
    if (ownerId !== undefined) updates.ownerId = ownerId || null;

    const [updated] = await db
      .update(taskAutomations)
      .set(updates)
      .where(eq(taskAutomations.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("PUT /api/automations error:", err);
    return NextResponse.json({ error: "Failed to update automation" }, { status: 500 });
  }
}

// DELETE /api/automations?id=<uuid>
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await db.delete(taskAutomations).where(eq(taskAutomations.id, id));

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error("DELETE /api/automations error:", err);
    return NextResponse.json({ error: "Failed to delete automation" }, { status: 500 });
  }
}
