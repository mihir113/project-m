import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import {
  performanceSnapshots,
  managerObservations,
  checkInTemplates,
  templateGoalAreas,
  templateGoals,
  teamMembers,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// POST /api/performance-snapshots/synthesize
// Body: { snapshotId }
// Reads all manager_observations for the member, analyzes against IC template goals,
// writes the AI synthesis back into the snapshot's aiSynthesis field.
export async function POST(req: NextRequest) {
  try {
    const { snapshotId } = await req.json();
    if (!snapshotId) {
      return NextResponse.json({ error: "snapshotId is required" }, { status: 400 });
    }

    // Fetch the snapshot
    const [snapshot] = await db
      .select()
      .from(performanceSnapshots)
      .where(eq(performanceSnapshots.id, snapshotId));

    if (!snapshot) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }

    // Fetch the team member's name
    const [member] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, snapshot.memberId));

    // Fetch all observations for this member
    const observations = await db
      .select()
      .from(managerObservations)
      .where(eq(managerObservations.memberId, snapshot.memberId));

    if (observations.length === 0) {
      return NextResponse.json(
        { error: "No observations found. Log some observations first before synthesizing." },
        { status: 400 }
      );
    }

    // Build goal context from the linked IC template
    let templateContext = "No IC template linked to this snapshot.";
    if (snapshot.templateId) {
      const [template] = await db
        .select()
        .from(checkInTemplates)
        .where(eq(checkInTemplates.id, snapshot.templateId));

      if (template) {
        const goalAreas = await db
          .select()
          .from(templateGoalAreas)
          .where(eq(templateGoalAreas.templateId, snapshot.templateId))
          .orderBy(templateGoalAreas.displayOrder);

        const areasWithGoals = await Promise.all(
          goalAreas.map(async (area) => {
            const goals = await db
              .select()
              .from(templateGoals)
              .where(eq(templateGoals.goalAreaId, area.id))
              .orderBy(templateGoals.displayOrder);
            return { ...area, goals };
          })
        );

        const lines: string[] = [`IC Template: ${template.name}`];
        areasWithGoals.forEach((area) => {
          lines.push(`\n## ${area.name}`);
          area.goals.forEach((g) => {
            lines.push(`- Goal: ${g.goal}`);
            if (g.successCriteria) lines.push(`  Success Criteria: ${g.successCriteria}`);
          });
        });
        templateContext = lines.join("\n");
      }
    }

    // Build observations text
    const obsText = observations
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((o) => `[${new Date(o.createdAt).toLocaleDateString()}] ${o.content}`)
      .join("\n");

    const managerNotesSection = snapshot.managerNotes
      ? `\n\nAdditional Manager Notes:\n${snapshot.managerNotes}`
      : "";

    const systemPrompt = `You are a senior engineering manager assistant helping synthesize performance observations into a structured quarter assessment. Write in a professional, direct tone. Be specific and evidence-based. Output plain text only — no markdown headers or bullet formatting.`;

    const userPrompt = `Engineer: ${member?.nick || "Unknown"}
Quarter: ${snapshot.quarter}

${templateContext}

Manager Observations (chronological):
${obsText}${managerNotesSection}

Task: Write a concise 3–4 paragraph performance synthesis for ${member?.nick || "this engineer"} for ${snapshot.quarter}.

Structure your response as:
1. Overall performance summary and key strengths demonstrated this quarter.
2. Specific evidence-based assessment against the IC template goals above. Note where the engineer is exceeding, meeting, or needs improvement against success criteria.
3. Areas for growth and recommended focus for next quarter.
4. Overall track assessment: is this engineer on track, ahead of, or behind their IC level expectations?

Be candid but constructive. Ground every claim in the observations provided.`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 1024,
    });

    const synthesis = completion.choices[0]?.message?.content?.trim() || "";

    // Save synthesis back to the snapshot
    const [updated] = await db
      .update(performanceSnapshots)
      .set({ aiSynthesis: synthesis, updatedAt: new Date() })
      .where(eq(performanceSnapshots.id, snapshotId))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("Synthesis error:", err);
    return NextResponse.json({ error: "Failed to generate synthesis" }, { status: 500 });
  }
}
