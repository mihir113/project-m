import { NextRequest, NextResponse } from "next/server";
import { generateWeeklySnapshotsForAllProjects, generateWeeklyRundownSnapshot } from "@/lib/projectSummary";

// POST /api/projects/summaries/weekly
// Generates weekly project snapshots for all active projects.
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("x-cron-secret");
    if (process.env.CRON_SECRET && token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let force = false;
    try {
      const body = await req.json();
      force = Boolean(body?.force);
    } catch {
      // body optional
    }

    const result = await generateWeeklySnapshotsForAllProjects(force);
    const rundown = await generateWeeklyRundownSnapshot(force);
    return NextResponse.json({ success: true, ...result, weeklyRundownGeneratedAt: rundown.generatedAt });
  } catch (error: any) {
    console.error("POST /api/projects/summaries/weekly error", error);
    return NextResponse.json(
      { error: "Failed to generate weekly snapshots", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
