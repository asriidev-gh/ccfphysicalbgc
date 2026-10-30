import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getLeaderboard } from "@/lib/services/leaderboard";

export const dynamic = "force-dynamic";

/** Public: published results only. Never includes provisional rows or private data. */
export async function GET(req: Request, ctx: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await ctx.params;
  if (!z.string().uuid().safeParse(activityId).success) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const limit = Number(new URL(req.url).searchParams.get("limit")) || undefined;
  const board = await getLeaderboard(db, activityId, { limit: limit && limit > 0 ? Math.min(limit, 1000) : undefined });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(board, { headers: { "Cache-Control": "no-store" } });
}
