import { NextResponse } from "next/server";
import { z } from "zod";
import { getActor } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/policy";
import { db } from "@/lib/db";
import { exportRegistrationsCsv, exportResultsCsv } from "@/lib/services/admin";

export const dynamic = "force-dynamic";

/** Admin-only CSV export of the participant list. */
export async function GET(req: Request) {
  const actor = await getActor();
  if (!actor || !isAdmin(actor)) return new NextResponse("Forbidden", { status: actor ? 403 : 401 });
  const eventId = new URL(req.url).searchParams.get("eventId");
  if (!z.string().uuid().safeParse(eventId).success) return new NextResponse("Bad request", { status: 400 });
  const results = new URL(req.url).searchParams.get("kind") === "results";
  const csv = results ? await exportResultsCsv(db, actor, eventId as string) : await exportRegistrationsCsv(db, actor, eventId as string);
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${results ? "results" : "registrations"}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
