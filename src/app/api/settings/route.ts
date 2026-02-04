import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { userSettings } from "@/db/schema";

// GET /api/settings — return settings (or create default if none exist)
export async function GET() {
  try {
    const rows = await db.select().from(userSettings).limit(1);
    
    if (rows.length === 0) {
      // Create default settings row
      const [created] = await db
        .insert(userSettings)
        .values({ defaultOwnerId: null })
        .returning();
      return NextResponse.json({ data: created });
    }
    
    return NextResponse.json({ data: rows[0] });
  } catch (err) {
    console.error("GET /api/settings error:", err);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// PUT /api/settings — update settings
// Body: { defaultOwnerId: uuid | null }
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { defaultOwnerId } = body;

    // Get the settings row (there's only one)
    const rows = await db.select().from(userSettings).limit(1);
    
    if (rows.length === 0) {
      // Create if doesn't exist
      const [created] = await db
        .insert(userSettings)
        .values({ defaultOwnerId: defaultOwnerId || null })
        .returning();
      return NextResponse.json({ data: created });
    }

    // Update existing
    const [updated] = await db
      .update(userSettings)
      .set({ 
        defaultOwnerId: defaultOwnerId || null,
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("PUT /api/settings error:", err);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
