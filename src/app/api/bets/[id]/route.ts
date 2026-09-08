import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bets } from "@/db/schema";

export const dynamic = "force-dynamic";

interface UpdateBetPayload {
  spread?: number;
  juice?: number;
  units?: number;
  closingLine?: number | null;
  notes?: string | null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body: UpdateBetPayload = await req.json();

    const set: Partial<typeof bets.$inferInsert> = {};
    if (body.spread !== undefined) set.spread = body.spread;
    if (body.juice !== undefined) set.juice = body.juice;
    if (body.units !== undefined) set.units = body.units;
    if (body.closingLine !== undefined) set.closingLine = body.closingLine;
    if (body.notes !== undefined) set.notes = body.notes;

    if (Object.keys(set).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await db.update(bets).set(set).where(eq(bets.id, id)).returning();
    if (!updated.length) {
      return NextResponse.json({ error: "Bet not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, bet: updated[0] });
  } catch (err) {
    console.error("[api/bets/:id] PATCH failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error updating bet" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const deleted = await db.delete(bets).where(eq(bets.id, id)).returning();
    if (!deleted.length) {
      return NextResponse.json({ error: "Bet not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/bets/:id] DELETE failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error deleting bet" },
      { status: 500 }
    );
  }
}
