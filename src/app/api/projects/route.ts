import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { projects, requirements } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

// GET /api/projects — return all projects with requirement counts
export async function GET() {
  try {
    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        status: projects.status,
        color: projects.color,
        category: projects.category,
        createdAt: projects.createdAt,
        totalRequirements: sql<number>`(SELECT COUNT(*) FROM requirements WHERE requirements.project_id = ${projects.id})`,
        completedRequirements: sql<number>`(SELECT COUNT(*) FROM requirements WHERE requirements.project_id = ${projects.id} AND requirements.status = 'completed')`,
      })
      .from(projects)
      .orderBy(projects.createdAt);

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error("GET /api/projects error:", err);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

// POST /api/projects — create a new project
// Body: { name, description?, status?, color?, category? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, status, color, category } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const [created] = await db
      .insert(projects)
      .values({
        name: name.trim(),
        description: description?.trim() || null,
        status: status || "active",
        color: color || "#4f6ff5",
        category: category?.trim() || null,
      })
      .returning();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/projects error:", err);
    // Handle unique constraint violation for project name
    if (err?.code === "23505") {
      return NextResponse.json({ error: "Project name already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

// PUT /api/projects — update a project
// Body: { id, name?, description?, status?, color?, category? }
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, description, status, color, category } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (status !== undefined) updates.status = status;
    if (color !== undefined) updates.color = color;
    if (category !== undefined) updates.category = category?.trim() || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const [updated] = await db
      .update(projects)
      .set(updates)
      .where(eq(projects.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  } catch (err: any) {
    console.error("PUT /api/projects error:", err);
    if (err?.code === "23505") {
      return NextResponse.json({ error: "Project name already exists" }, { status: 400 });
    }
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
    console.error("DELETE /api/projects error:", err);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
