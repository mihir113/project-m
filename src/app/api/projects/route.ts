import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { projects, requirements } from "@/db/schema";
import { eq, sql, getTableColumns } from "drizzle-orm";

// GET /api/projects — list all projects with requirement counts
export async function GET() {
  try {
    const rows = await db
  .select({
    ...getTableColumns(projects), // Fixes the spread error
    totalRequirements: sql<number>`COUNT(${requirements.id})`,
    completedRequirements: sql<number>`COUNT(CASE WHEN ${requirements.status} = 'completed' THEN 1 END)`,
  })
      .from(projects)
      .leftJoin(requirements, eq(requirements.projectId, projects.id))
      .groupBy(projects.id)
      .orderBy(projects.createdAt);

    return NextResponse.json({ data: rows });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

// POST /api/projects — create a project
// Body: { name, description?, status?, color? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, status, color } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    // Check unique name
    const existing = await db.select().from(projects).where(eq(projects.name, name));
    if (existing.length > 0) {
      return NextResponse.json({ error: `A project named "${name}" already exists` }, { status: 409 });
    }

    const [created] = await db
      .insert(projects)
      .values({
        name: name.trim(),
        description: description?.trim() || null,
        status: status || "active",
        color: color || "#4f6ff5",
      })
      .returning();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

// PUT /api/projects — update a project
// Body: { id, name?, description?, status?, color? }
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, description, status, color } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // If name is changing, check uniqueness
    if (name) {
      const existing = await db
        .select()
        .from(projects)
        .where(eq(projects.name, name));
      if (existing.length > 0 && existing[0].id !== id) {
        return NextResponse.json({ error: `A project named "${name}" already exists` }, { status: 409 });
      }
    }

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (status !== undefined) updates.status = status;
    if (color !== undefined) updates.color = color;

    const [updated] = await db
      .update(projects)
      .set(updates)
      .where(eq(projects.id, id))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

// DELETE /api/projects?id=<uuid>
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await db.delete(projects).where(eq(projects.id, id));
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
