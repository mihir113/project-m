import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { managerObservations } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

// GET /api/manager-observations?memberId=<uuid>
export async function GET(req: NextRequest) {
  try {
    const memberId = req.nextUrl.searchParams.get("memberId");
    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    }

    const rows = await db
      .select()
      .from(managerObservations)
      .where(eq(managerObservations.memberId, memberId))
      .orderBy(desc(managerObservations.createdAt));

    return NextResponse.json({ data: rows });
  } catch {
    return NextResponse.json({ error: "Failed to fetch observations" }, { status: 500 });
  }
}

// POST /api/manager-observations
// Body: { memberId, content }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { memberId, content } = body;

    if (!memberId || !content?.trim()) {
      return NextResponse.json({ error: "memberId and content are required" }, { status: 400 });
    }

    const [created] = await db
      .insert(managerObservations)
      .values({ memberId, content: content.trim() })
      .returning();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to save observation" }, { status: 500 });
  }
}

// DELETE /api/manager-observations?id=<uuid>
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    await db.delete(managerObservations).where(eq(managerObservations.id, id));
    return NextResponse.json({ data: { deleted: true } });
  } catch {
    return NextResponse.json({ error: "Failed to delete observation" }, { status: 500 });
  }
}
