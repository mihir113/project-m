import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import {
  managerObservations,
  checkinResponses,
  submissions,
  teamMembers,
} from "@/db/schema";
import { eq, gte, and, isNotNull, ne } from "drizzle-orm";

export interface EquityScore {
  memberId: string;
  nick: string;
  role: string;
  observationCount: number;
  lastObservationDate: string | null;
  managerCommentCount: number;
  daysSinceLastInteraction: number;
  score: number; // 0-100, lower = needs more attention
}

// GET /api/management-equity
// Returns attention scores for Direct-role team members based on the last 30 days.
// "Admin" and "Boss" roles are excluded; only "Direct" members are tracked.
export async function GET(_req: NextRequest) {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Only track Direct reports — exclude Admin, Boss, and any other non-Direct roles
    const allMembers = await db.select().from(teamMembers);
    const members = allMembers.filter(
      (m) => m.role.trim().toLowerCase() === "direct"
    );

    // Fetch observations from last 30 days
    const recentObservations = await db
      .select()
      .from(managerObservations)
      .where(gte(managerObservations.createdAt, thirtyDaysAgo));

    // Fetch manager comments from checkin_responses in last 30 days
    // Join checkinResponses → submissions to get teamMemberId
    const recentComments = await db
      .select({
        teamMemberId: submissions.teamMemberId,
        createdAt: checkinResponses.createdAt,
      })
      .from(checkinResponses)
      .innerJoin(submissions, eq(checkinResponses.submissionId, submissions.id))
      .where(
        and(
          gte(checkinResponses.createdAt, thirtyDaysAgo),
          isNotNull(checkinResponses.managerComments),
          ne(checkinResponses.managerComments, "")
        )
      );

    const now = new Date();

    const scores: EquityScore[] = members.map((member) => {
      // Observations for this member
      const memberObs = recentObservations.filter((o) => o.memberId === member.id);
      const observationCount = memberObs.length;

      const latestObsDate =
        memberObs.length > 0
          ? memberObs.reduce((latest, o) =>
              new Date(o.createdAt) > new Date(latest.createdAt) ? o : latest
            ).createdAt
          : null;

      // Manager comments for this member
      const memberComments = recentComments.filter((c) => c.teamMemberId === member.id);
      const managerCommentCount = memberComments.length;

      const latestCommentDate =
        memberComments.length > 0
          ? memberComments.reduce((latest, c) =>
              new Date(c.createdAt) > new Date(latest.createdAt) ? c : latest
            ).createdAt
          : null;

      // Most recent interaction of any kind
      const latestDates = [latestObsDate, latestCommentDate].filter(Boolean) as Date[];
      const lastInteraction =
        latestDates.length > 0
          ? latestDates.reduce((a, b) => (new Date(a) > new Date(b) ? a : b))
          : null;

      const daysSinceLastInteraction = lastInteraction
        ? Math.floor((now.getTime() - new Date(lastInteraction).getTime()) / (1000 * 60 * 60 * 24))
        : 31; // treat as 31+ days if no interaction

      // Score: 100 = max attention, 0 = no attention
      // Based on: interaction recency (weighted 60%) + interaction volume (weighted 40%)
      const recencyScore = Math.max(0, 100 - daysSinceLastInteraction * (100 / 30));
      const volumeScore = Math.min(100, (observationCount + managerCommentCount) * 10);
      const score = Math.round(recencyScore * 0.6 + volumeScore * 0.4);

      return {
        memberId: member.id,
        nick: member.nick,
        role: member.role,
        observationCount,
        lastObservationDate: latestObsDate ? new Date(latestObsDate).toISOString() : null,
        managerCommentCount,
        daysSinceLastInteraction,
        score,
      };
    });

    // Sort ascending by score (lowest first = needs most attention)
    scores.sort((a, b) => a.score - b.score);

    return NextResponse.json({ data: scores });
  } catch {
    return NextResponse.json({ error: "Failed to calculate equity scores" }, { status: 500 });
  }
}
