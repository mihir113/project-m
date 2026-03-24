import Groq from "groq-sdk";
import { db } from "@/db/client";
import { projects, requirements, projectAiSummaries, dashboardWeeklyRundowns } from "@/db/schema";
import { eq, gte, and, lt, desc } from "drizzle-orm";

function clampSummaryLines(text: string, maxLines = 4): string {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, maxLines)
    .join("\n");
}

function detectTaskThemes(taskNames: string[]): Array<{ theme: string; count: number }> {
  const buckets: Record<string, number> = {
    approvals: 0,
    reviews: 0,
    communication: 0,
    reporting: 0,
    data_sync: 0,
    operations: 0,
    planning: 0,
    tooling: 0,
  };

  const rules: Array<{ theme: keyof typeof buckets; regex: RegExp }> = [
    { theme: "approvals", regex: /\bapprove|approval|sign[-\s]?off\b/i },
    { theme: "reviews", regex: /\breview|audit|check\b/i },
    { theme: "communication", regex: /\brespond|reply|follow\s?up|talk|sync\b/i },
    { theme: "reporting", regex: /\breport|summary|status update|dashboard\b/i },
    { theme: "data_sync", regex: /\bdata|migration|import|export|sync\b/i },
    { theme: "operations", regex: /\brequest|incident|ticket|ops|support\b/i },
    { theme: "planning", regex: /\bplan|roadmap|strategy|priorit\w+\b/i },
    { theme: "tooling", regex: /\btool|automation|script|agent|integration\b/i },
  ];

  for (const name of taskNames) {
    for (const rule of rules) {
      if (rule.regex.test(name)) buckets[rule.theme] += 1;
    }
  }

  const labels: Record<string, string> = {
    approvals: "approvals/sign-offs",
    reviews: "reviews/checks",
    communication: "stakeholder follow-ups",
    reporting: "reporting/updates",
    data_sync: "data sync/cleanup",
    operations: "ops/ticket handling",
    planning: "planning/prioritization",
    tooling: "tooling/automation",
  };

  return Object.entries(buckets)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([theme, count]) => ({ theme: labels[theme], count }));
}

export async function generateProjectSummarySnapshot(projectId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) throw new Error("Project not found");

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
  const topThemes = detectTaskThemes(doneNames).slice(0, 2);
  const themesLine = topThemes.length
    ? topThemes.map((t) => `${t.theme} (${t.count})`).join(", ")
    : "general execution";

  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    temperature: 0.2,
    max_tokens: 120,
    messages: [
      {
        role: "system",
        content:
          "You write executive project summaries. Keep output concise: 2-4 short lines, plain text, no intro/outro, no markdown. Avoid vague phrasing like 'progressing well'.",
      },
      {
        role: "user",
        content: [
          `Project: ${project.name}`,
          `Today: ${today}`,
          `Counts => total:${totalCount}, completed:${completedCount}, pending:${pendingCount}, overdue:${overdueCount}`,
          `Completed work themes: ${themesLine}`,
          `Done samples: ${doneNames.length ? doneNames.join("; ") : "none"}`,
          `Remaining samples: ${remainingNames.length ? remainingNames.join("; ") : "none"}`,
          "Line 1 must mention the kind of completed work themes. Then mention what remains and one concrete next focus.",
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

  return saved;
}

function startOfWeek(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sunday ... 6 Saturday
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function generateWeeklySnapshotsForAllProjects(force = false) {
  const allProjects = await db
    .select({ id: projects.id, name: projects.name, status: projects.status })
    .from(projects)
    .where(eq(projects.status, "active"));

  const weekStart = startOfWeek();
  const results: Array<{ projectId: string; projectName: string; action: "generated" | "skipped" | "error"; reason?: string }> = [];

  for (const p of allProjects) {
    try {
      if (!force) {
        const [existing] = await db
          .select({ id: projectAiSummaries.id })
          .from(projectAiSummaries)
          .where(
            and(
              eq(projectAiSummaries.projectId, p.id),
              gte(projectAiSummaries.generatedAt, weekStart)
            )
          )
          .limit(1);

        if (existing) {
          results.push({
            projectId: p.id,
            projectName: p.name,
            action: "skipped",
            reason: "Snapshot already exists for current week",
          });
          continue;
        }
      }

      await generateProjectSummarySnapshot(p.id);
      results.push({ projectId: p.id, projectName: p.name, action: "generated" });
    } catch (e: any) {
      results.push({
        projectId: p.id,
        projectName: p.name,
        action: "error",
        reason: e?.message || "Unknown error",
      });
    }
  }

  return {
    weekStart: weekStart.toISOString(),
    totalProjects: allProjects.length,
    generatedCount: results.filter((r) => r.action === "generated").length,
    skippedCount: results.filter((r) => r.action === "skipped").length,
    errorCount: results.filter((r) => r.action === "error").length,
    results,
  };
}

type WeeklyRow = { projectId: string; projectName: string; note: string };

async function buildWeeklyTableAiText(input: {
  wins: WeeklyRow[];
  stalled: WeeklyRow[];
  nextActions: WeeklyRow[];
}) {
  const fallback = "Weekly snapshot generated from project progress and overdue deltas.";
  if (!process.env.GROQ_API_KEY) return fallback;

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0,
      max_tokens: 90,
      messages: [
        {
          role: "system",
          content:
            "Write one concise executive line (max 20 words) summarizing this week's wins, stalled focus, and next action. Plain text only.",
        },
        {
          role: "user",
          content: [
            `Wins: ${input.wins.map((w) => w.projectName).join(", ") || "none"}`,
            `Stalled: ${input.stalled.map((s) => s.projectName).join(", ") || "none"}`,
            `Next Actions: ${input.nextActions.map((n) => n.projectName).join(", ") || "none"}`,
          ].join("\n"),
        },
      ],
    });
    return (completion.choices?.[0]?.message?.content || fallback).trim();
  } catch {
    return fallback;
  }
}

export async function generateWeeklyRundownSnapshot(force = false) {
  const weekStart = startOfWeek();
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);

  if (!force) {
    const [existing] = await db
      .select()
      .from(dashboardWeeklyRundowns)
      .where(gte(dashboardWeeklyRundowns.weekStart, weekStart))
      .orderBy(desc(dashboardWeeklyRundowns.generatedAt))
      .limit(1);
    if (existing) return existing;
  }

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
  for (const r of thisWeekRows) if (!latestThis.has(r.projectId)) latestThis.set(r.projectId, r);
  const latestPrev = new Map<string, (typeof prevWeekRows)[number]>();
  for (const r of prevWeekRows) if (!latestPrev.has(r.projectId)) latestPrev.set(r.projectId, r);

  const wins: WeeklyRow[] = [];
  const stalled: WeeklyRow[] = [];
  const nextActions: WeeklyRow[] = [];

  for (const p of activeProjects) {
    const t = latestThis.get(p.id);
    const prev = latestPrev.get(p.id);
    if (!t) {
      stalled.push({ projectId: p.id, projectName: p.name, note: "No snapshot this week" });
      continue;
    }

    const deltaCompleted = (t.completedCount || 0) - (prev?.completedCount || 0);
    if (deltaCompleted > 0) {
      wins.push({ projectId: p.id, projectName: p.name, note: `+${deltaCompleted} completed` });
    } else {
      stalled.push({ projectId: p.id, projectName: p.name, note: "No completion delta" });
    }

    if ((t.overdueCount || 0) > 0) {
      nextActions.push({ projectId: p.id, projectName: p.name, note: `${t.overdueCount} overdue to clear` });
    }
  }

  wins.sort((a, b) => Number(b.note.match(/\d+/)?.[0] || 0) - Number(a.note.match(/\d+/)?.[0] || 0));
  nextActions.sort((a, b) => Number(b.note.match(/\d+/)?.[0] || 0) - Number(a.note.match(/\d+/)?.[0] || 0));

  const recommendationText = await buildWeeklyTableAiText({
    wins: wins.slice(0, 5),
    stalled: stalled.slice(0, 5),
    nextActions: nextActions.slice(0, 5),
  });

  await db
    .delete(dashboardWeeklyRundowns)
    .where(and(gte(dashboardWeeklyRundowns.weekStart, weekStart), lt(dashboardWeeklyRundowns.weekStart, new Date(weekStart.getTime() + 7 * 86400000))));

  const [saved] = await db
    .insert(dashboardWeeklyRundowns)
    .values({
      weekStart,
      recommendationText,
      winsJson: JSON.stringify(wins.slice(0, 5)),
      stalledJson: JSON.stringify(stalled.slice(0, 5)),
      nextActionsJson: JSON.stringify(nextActions.slice(0, 5)),
      generatedAt: new Date(),
    })
    .returning();

  return saved;
}
