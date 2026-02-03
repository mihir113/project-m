import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { teamMembers } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/team — returns all team members
export async function GET() {
  try {
    const members = await db.select().from(teamMembers).orderBy(teamMembers.nick);
    return NextResponse.json({ data: members });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch team members" }, { status: 500 });
  }
}

// POST /api/team — adds one team member
// Body: { nick: string, role: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nick, role } = body;

    if (!nick || !role) {
      return NextResponse.json({ error: "nick and role are required" }, { status: 400 });
    }

    // Check for duplicate nick
    const existing = await db.select().from(teamMembers).where(eq(teamMembers.nick, nick));
    if (existing.length > 0) {
      return NextResponse.json({ error: `A member with nick "${nick}" already exists` }, { status: 409 });
    }

    const [created] = await db
      .insert(teamMembers)
      .values({ nick: nick.trim(), role: role.trim() })
      .returning();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to add team member" }, { status: 500 });
  }
}

// DELETE /api/team?id=<uuid> — removes a team member
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await db.delete(teamMembers).where(eq(teamMembers.id, id));
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete team member" }, { status: 500 });
  }
}
