import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { aiAutomations } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/ai-automations — return all AI automation rules
export async function GET() {
  try {
    const rows = await db
      .select()
      .from(aiAutomations)
      .orderBy(aiAutomations.createdAt);

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error("GET /api/ai-automations error:", err);
    return NextResponse.json({ error: "Failed to fetch AI automations" }, { status: 500 });
  }
}

// POST /api/ai-automations — create a new AI automation
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, prompt, rules, schedule, dayOfWeek, dayOfMonth, enabled } = body;

    if (!name || !prompt || !schedule) {
      return NextResponse.json(
        { error: "name, prompt, and schedule are required" },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(aiAutomations)
      .values({
        name: name.trim(),
        prompt: prompt.trim(),
        rules: rules?.trim() || null,
        schedule,
        dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : null,
        dayOfMonth: dayOfMonth !== undefined ? dayOfMonth : null,
        enabled: enabled !== undefined ? enabled : true,
      })
      .returning();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/ai-automations error:", err);
    return NextResponse.json({ error: "Failed to create AI automation" }, { status: 500 });
  }
}

// PUT /api/ai-automations — update an AI automation
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, prompt, rules, schedule, dayOfWeek, dayOfMonth, enabled } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name.trim();
    if (prompt !== undefined) updates.prompt = prompt.trim();
    if (rules !== undefined) updates.rules = rules?.trim() || null;
    if (schedule !== undefined) updates.schedule = schedule;
    if (dayOfWeek !== undefined) updates.dayOfWeek = dayOfWeek;
    if (dayOfMonth !== undefined) updates.dayOfMonth = dayOfMonth;
    if (enabled !== undefined) updates.enabled = enabled;

    const [updated] = await db
      .update(aiAutomations)
      .set(updates)
      .where(eq(aiAutomations.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "AI automation not found" }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("PUT /api/ai-automations error:", err);
    return NextResponse.json({ error: "Failed to update AI automation" }, { status: 500 });
  }
}

// DELETE /api/ai-automations?id=<uuid>
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await db.delete(aiAutomations).where(eq(aiAutomations.id, id));

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error("DELETE /api/ai-automations error:", err);
    return NextResponse.json({ error: "Failed to delete AI automation" }, { status: 500 });
  }
}
