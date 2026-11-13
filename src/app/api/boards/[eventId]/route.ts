import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getEventBoards, parseGender } from "@/lib/services/leaderboard";

export const dynamic = "force-dynamic";

/** Public: published leaderboards for every listed activity of an event. */
export async function GET(req: Request, ctx: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await ctx.params;
  if (!z.string().uuid().safeParse(eventId).success) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const sp = new URL(req.url).searchParams;
  const limit = Number(sp.get("limit")) || undefined;
  const boards = await getEventBoards(db, eventId, limit && limit > 0 ? Math.min(limit, 1000) : undefined, parseGender(sp.get("gender")));
  return NextResponse.json({ boards }, { headers: { "Cache-Control": "no-store" } });
}
