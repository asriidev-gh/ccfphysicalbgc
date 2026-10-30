import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getDisplayState } from "@/lib/services/display";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await ctx.params;
  if (!z.string().uuid().safeParse(eventId).success) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const state = await getDisplayState(db, eventId);
  if (!state) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}
