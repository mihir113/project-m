import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { db } from "@/db/client";
import { projectAiSummaries, projects } from "@/db/schema";
import { eq, gte, and, lt, desc } from "drizzle-orm";

function startOfWeek(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function clampLines(text: string, maxLines = 4): string {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, maxLines)
    .join("\n");
}

async function buildRecommendation(input: {
  moved: string[];
  stalled: string[];
  atRisk: string[];
}) {
  const fallback = [
    input.moved.length
      ? `Momentum: ${input.moved.slice(0, 2).join(", ")} moved this week.`
      : "Momentum is limited this week.",
    input.stalled.length
      ? `Stalled: ${input.stalled.slice(0, 2).join(", ")} need attention.`
      : "No major stalled projects identified.",
    input.atRisk.length
      ? `Risk: address overdue work in ${input.atRisk.slice(0, 2).join(", ")} first.`
      : "Risk is manageable; keep current cadence.",
  ].join("\n");

  if (!process.env.GROQ_API_KEY) return fallback;

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.2,
      max_tokens: 90,
      messages: [
        {
          role: "system",
          content:
            "Write weekly executive rundown in 2-4 short lines, plain text only, concise and action-oriented.",
        },
        {
          role: "user",
          content: [
            `Projects with progress: ${input.moved.length ? input.moved.join(", ") : "none"}`,
            `Stalled projects: ${input.stalled.length ? input.stalled.join(", ") : "none"}`,
            `At-risk projects: ${input.atRisk.length ? input.atRisk.join(", ") : "none"}`,
            "Mention wins, stalled focus, and immediate next action.",
          ].join("\n"),
        },
      ],
    });

    return clampLines(completion.choices?.[0]?.message?.content?.trim() || fallback, 4);
  } catch {
    return fallback;
  }
}

export async function GET() {
  try {
    const weekStart = startOfWeek();
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    const activeProjects = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.status, "active"));

    const thisWeekRows = await db
      .select()
      .from(projectAiSummaries)
      .where(gte(projectAiSummaries.generatedAt, weekStart))
      .orderBy(desc(projectAiSummaries.generatedAt));

    const prevWeekRows = await db
      .select()
      .from(projectAiSummaries)
      .where(
        and(
          gte(projectAiSummaries.generatedAt, prevWeekStart),
          lt(projectAiSummaries.generatedAt, weekStart)
        )
      )
      .orderBy(desc(projectAiSummaries.generatedAt));

    const latestThis = new Map<string, (typeof thisWeekRows)[number]>();
    for (const r of thisWeekRows) {
      if (!latestThis.has(r.projectId)) latestThis.set(r.projectId, r);
    }

    const latestPrev = new Map<string, (typeof prevWeekRows)[number]>();
    for (const r of prevWeekRows) {
      if (!latestPrev.has(r.projectId)) latestPrev.set(r.projectId, r);
    }

    const moved: Array<{ projectId: string; projectName: string; deltaCompleted: number }> = [];
    const stalled: Array<{ projectId: string; projectName: string }> = [];
    const atRisk: Array<{ projectId: string; projectName: string; overdueCount: number }> = [];

    for (const p of activeProjects) {
      const t = latestThis.get(p.id);
      const prev = latestPrev.get(p.id);

      if (!t) {
        stalled.push({ projectId: p.id, projectName: p.name });
        continue;
      }

      const deltaCompleted = (t.completedCount || 0) - (prev?.completedCount || 0);
      if (deltaCompleted > 0) {
        moved.push({ projectId: p.id, projectName: p.name, deltaCompleted });
      } else {
        stalled.push({ projectId: p.id, projectName: p.name });
      }

      if ((t.overdueCount || 0) > 0) {
        atRisk.push({ projectId: p.id, projectName: p.name, overdueCount: t.overdueCount || 0 });
      }
    }

    moved.sort((a, b) => b.deltaCompleted - a.deltaCompleted);
    atRisk.sort((a, b) => b.overdueCount - a.overdueCount);

    const recommendation = await buildRecommendation({
      moved: moved.map((m) => m.projectName),
      stalled: stalled.map((s) => s.projectName),
      atRisk: atRisk.map((r) => r.projectName),
    });

    return NextResponse.json({
      data: {
        weekStart: weekStart.toISOString(),
        projectsWithProgress: moved,
        stalledProjects: stalled,
        atRiskProjects: atRisk,
        recommendation,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("GET /api/dashboard/weekly-rundown error", error);
    return NextResponse.json({ error: "Failed to build weekly rundown" }, { status: 500 });
  }
}
