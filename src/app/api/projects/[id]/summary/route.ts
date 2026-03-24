import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { db } from "@/db/client";
import { projects, requirements, projectAiSummaries } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

function clampSummaryLines(text: string, maxLines = 4): string {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, maxLines)
    .join("\n");
}

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

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const reqs = await db
      .select({
        name: requirements.name,
        status: requirements.status,
        dueDate: requirements.dueDate,
      })
      .from(requirements)
      .where(eq(requirements.projectId, projectId));

    const totalCount = reqs.length;
    const completedCount = reqs.filter((r) => r.status === "completed").length;
    const pendingCount = reqs.filter((r) => r.status === "pending").length;
    const overdueCount = reqs.filter((r) => r.status === "overdue").length;

    const today = new Date().toISOString().split("T")[0];
    const doneNames = reqs.filter((r) => r.status === "completed").slice(0, 6).map((r) => r.name);
    const remainingNames = reqs
      .filter((r) => r.status !== "completed")
      .slice(0, 6)
      .map((r) => `${r.name} (${r.status}, due ${r.dueDate})`);

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.2,
      max_tokens: 120,
      messages: [
        {
          role: "system",
          content:
            "You write executive project summaries. Keep output concise: exactly 2-4 short lines, plain text, no intro/outro, no markdown.",
        },
        {
          role: "user",
          content: [
            `Project: ${project.name}`,
            `Today: ${today}`,
            `Counts => total:${totalCount}, completed:${completedCount}, pending:${pendingCount}, overdue:${overdueCount}`,
            `Done samples: ${doneNames.length ? doneNames.join("; ") : "none"}`,
            `Remaining samples: ${remainingNames.length ? remainingNames.join("; ") : "none"}`,
            "Write an executive summary that says progress, what remains, and one suggested focus next.",
          ].join("\n"),
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "No summary generated.";
    const summaryText = clampSummaryLines(raw, 4);

    const [saved] = await db
      .insert(projectAiSummaries)
      .values({
        projectId,
        summaryText,
        totalCount,
        completedCount,
        pendingCount,
        overdueCount,
      })
      .returning();

    return NextResponse.json({ data: saved });
  } catch (error) {
    console.error("POST /api/projects/[id]/summary error", error);
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
  }
}
