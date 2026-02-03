import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { teamMembers } from "@/db/schema";
import { eq } from "drizzle-orm";

// POST /api/team/bulk
// Body: { members: [{ nick, role }, ...] }
// Returns: { imported: number, skipped: number, errors: string[] }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { members } = body;

    if (!Array.isArray(members) || members.length === 0) {
      return NextResponse.json({ error: "members array is required and must not be empty" }, { status: 400 });
    }

    // Fetch existing nicks to avoid duplicates
    const existingRows = await db.select({ nick: teamMembers.nick }).from(teamMembers);
    const existingNicks = new Set(existingRows.map((r) => r.nick.toLowerCase()));

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    const toInsert: { nick: string; role: string }[] = [];
    const seenInBatch = new Set<string>(); // catch duplicates within the upload itself

    for (const member of members) {
      const nick = (member.nick || "").trim();
      const role = (member.role || "").trim();

      // Validate
      if (!nick || !role) {
        errors.push(`Row skipped — missing nick or role: ${JSON.stringify(member)}`);
        skipped++;
        continue;
      }

      // Check duplicate against DB
      if (existingNicks.has(nick.toLowerCase())) {
        errors.push(`"${nick}" already exists — skipped`);
        skipped++;
        continue;
      }

      // Check duplicate within this batch
      if (seenInBatch.has(nick.toLowerCase())) {
        errors.push(`"${nick}" appears more than once in upload — skipped duplicate`);
        skipped++;
        continue;
      }

      seenInBatch.add(nick.toLowerCase());
      toInsert.push({ nick, role });
    }

    // Bulk insert in one query — much faster than one-by-one
    if (toInsert.length > 0) {
      await db.insert(teamMembers).values(toInsert);
      imported = toInsert.length;
    }

    return NextResponse.json({ data: { imported, skipped, errors } });
  } catch (err) {
    return NextResponse.json({ error: "Bulk import failed" }, { status: 500 });
  }
}
