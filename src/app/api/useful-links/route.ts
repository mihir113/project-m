import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { usefulLinks } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db.select().from(usefulLinks).orderBy(desc(usefulLinks.createdAt));
    return NextResponse.json({ data: rows });
  } catch {
    return NextResponse.json({ error: "Failed to fetch links" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, url } = body;
    if (!title?.trim() || !url?.trim()) {
      return NextResponse.json({ error: "title and url are required" }, { status: 400 });
    }

    const [created] = await db
      .insert(usefulLinks)
      .values({ title: title.trim(), url: url.trim() })
      .returning();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create link" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title, url } = body;
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updates: Record<string, string> = {};
    if (title !== undefined) updates.title = title.trim();
    if (url !== undefined) updates.url = url.trim();

    const [updated] = await db
      .update(usefulLinks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(usefulLinks.id, id))
      .returning();

    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update link" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    let id = req.nextUrl.searchParams.get("id");
    if (!id) {
      const body = await req.json().catch(() => null);
      id = body?.id || null;
    }
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await db.delete(usefulLinks).where(eq(usefulLinks.id, id));
    return NextResponse.json({ data: { deleted: true } });
  } catch {
    return NextResponse.json({ error: "Failed to delete link" }, { status: 500 });
  }
}
