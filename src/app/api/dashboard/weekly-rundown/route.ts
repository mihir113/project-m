import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { dashboardWeeklyRundowns } from "@/db/schema";
import { desc, gte } from "drizzle-orm";
import { generateWeeklyRundownSnapshot } from "@/lib/projectSummary";

function startOfWeek(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

type WeeklyRow = { projectId: string; projectName: string; note: string };

export async function GET() {
  try {
    const weekStart = startOfWeek();
    const [stored] = await db
      .select()
      .from(dashboardWeeklyRundowns)
      .where(gte(dashboardWeeklyRundowns.weekStart, weekStart))
      .orderBy(desc(dashboardWeeklyRundowns.generatedAt))
      .limit(1);

    if (!stored) {
      return NextResponse.json({ data: null });
    }

    const wins = JSON.parse(stored.winsJson || "[]") as WeeklyRow[];
    const stalled = JSON.parse(stored.stalledJson || "[]") as WeeklyRow[];
    const nextActions = JSON.parse(stored.nextActionsJson || "[]") as WeeklyRow[];

    return NextResponse.json({
      data: {
        weekStart: stored.weekStart,
        wins,
        stalled,
        nextActions,
        recommendation: stored.recommendationText,
        generatedAt: stored.generatedAt,
      },
    });
  } catch (error) {
    console.error("GET /api/dashboard/weekly-rundown error", error);
    return NextResponse.json({ error: "Failed to build weekly rundown" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("x-cron-secret");
    if (process.env.CRON_SECRET && token && token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const row = await generateWeeklyRundownSnapshot(true);
    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    console.error("POST /api/dashboard/weekly-rundown error", error);
    return NextResponse.json({ error: "Failed to refresh weekly rundown" }, { status: 500 });
  }
}
