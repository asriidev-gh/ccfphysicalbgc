"use server";

import { z } from "zod";
import { clientIp } from "@/app/actions/auth";
import { getActor, requireActionRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AppError, toResult } from "@/lib/errors";
import { getCurrentEvent } from "@/lib/event";
import { drawRaffle, removeRaffleWinner, resetRaffle } from "@/lib/services/raffle";
import { rateLimit } from "@/lib/services/ratelimit";

const optionsSchema = z.object({ checkedInOnly: z.boolean(), prize: z.string().max(100).optional() });

/** Resolved here, never taken from the caller: the public can only draw for the current event. */
async function currentEventId() {
  const event = await getCurrentEvent();
  if (!event) throw new AppError("NOT_FOUND", "There is no current event.");
  return event.id;
}

// No revalidatePath here: refreshing now would show the winner before the wheel has stopped.
export async function drawRaffleAction(options: { checkedInOnly: boolean; prize?: string }) {
  return toResult(async () => {
    await rateLimit(db, "raffle-draw-ip", await clientIp(), { limit: 100, windowSeconds: 3600 });
    return drawRaffle(db, await getActor(), await currentEventId(), optionsSchema.parse(options));
  });
}

export async function removeRaffleWinnerAction(participantId: string) {
  return toResult(async () =>
    removeRaffleWinner(db, await requireActionRole("SUPER_ADMIN", "ADMIN"), await currentEventId(), z.string().uuid().parse(participantId)),
  );
}

export async function resetRaffleAction() {
  return toResult(async () => resetRaffle(db, await requireActionRole("SUPER_ADMIN", "ADMIN"), await currentEventId()));
}
