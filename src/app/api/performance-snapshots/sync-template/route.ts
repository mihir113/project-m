import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { performanceSnapshots } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// POST /api/performance-snapshots/sync-template
// Body: { templateId, quarter? }
// Updates all DRAFT performance snapshots that use this template
// to bump their version (signaling the template has new goals to review).
// Returns count of affected snapshots.
export async function POST(req: NextRequest) {
  try {
    const { templateId, quarter } = await req.json();

    if (!templateId) {
      return NextResponse.json({ error: "templateId is required" }, { status: 400 });
    }

    // Find all active (draft) snapshots using this template
    const conditions = [
      eq(performanceSnapshots.templateId, templateId),
      eq(performanceSnapshots.status, "draft"),
    ];
    if (quarter) {
      conditions.push(eq(performanceSnapshots.quarter, quarter));
    }

    const affected = await db
      .select({ id: performanceSnapshots.id, version: performanceSnapshots.version })
      .from(performanceSnapshots)
      .where(and(...conditions));

    if (affected.length === 0) {
      return NextResponse.json({ data: { updated: 0 } });
    }

    // Bump version on each to signal template sync
    await Promise.all(
      affected.map((snap) =>
        db
          .update(performanceSnapshots)
          .set({ version: snap.version + 1, updatedAt: new Date() })
          .where(eq(performanceSnapshots.id, snap.id))
      )
    );

    return NextResponse.json({ data: { updated: affected.length } });
  } catch {
    return NextResponse.json({ error: "Failed to sync template" }, { status: 500 });
  }
}

// GET /api/performance-snapshots/sync-template?templateId=<uuid>
// Returns the count of draft snapshots that would be affected by a sync
export async function GET(req: NextRequest) {
  try {
    const templateId = req.nextUrl.searchParams.get("templateId");
    if (!templateId) {
      return NextResponse.json({ error: "templateId is required" }, { status: 400 });
    }

    const affected = await db
      .select({ id: performanceSnapshots.id, memberId: performanceSnapshots.memberId })
      .from(performanceSnapshots)
      .where(
        and(
          eq(performanceSnapshots.templateId, templateId),
          eq(performanceSnapshots.status, "draft")
        )
      );

    return NextResponse.json({ data: { count: affected.length, memberIds: affected.map((s) => s.memberId) } });
  } catch {
    return NextResponse.json({ error: "Failed to check sync count" }, { status: 500 });
  }
}
