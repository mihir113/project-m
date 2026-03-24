import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { projectAiSummaries } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateProjectSummarySnapshot } from "@/lib/projectSummary";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const [latest] = await db
      .select()
      .from(projectAiSummaries)
      .where(eq(projectAiSummaries.projectId, projectId))
      .orderBy(desc(projectAiSummaries.generatedAt))
      .limit(1);

    return NextResponse.json({ data: latest || null });
  } catch (error) {
    console.error("GET /api/projects/[id]/summary error", error);
    return NextResponse.json({ error: "Failed to fetch summary" }, { status: 500 });
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const saved = await generateProjectSummarySnapshot(projectId);

    return NextResponse.json({ data: saved });
  } catch (error) {
    console.error("POST /api/projects/[id]/summary error", error);
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
  }
}
