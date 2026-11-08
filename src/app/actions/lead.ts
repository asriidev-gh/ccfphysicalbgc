"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { toResult } from "@/lib/errors";
import { lookupByReference } from "@/lib/services/lead";
import {
  cancelAttempt,
  checkIn,
  checkOut,
  correctResult,
  deleteResult,
  dismissDispute,
  finishAttempt,
  finishRunner,
  flagDispute,
  reviewResult,
  startAttempt,
  startHeat,
  withdrawFromActivity,
  submitResult,
} from "@/lib/services/challenge";

// Staff roles only. Per-activity assignment is enforced again inside each service call.
const STAFF = ["SUPER_ADMIN", "ADMIN", "ACTIVITY_LEAD"] as const;

export async function checkInAction(activityRegistrationId: string) {
  return toResult(async () => checkIn(db, await requireActionRole(...STAFF), z.string().uuid().parse(activityRegistrationId)));
}

export async function checkOutAction(activityRegistrationId: string) {
  return toResult(async () => checkOut(db, await requireActionRole(...STAFF), z.string().uuid().parse(activityRegistrationId)));
}

export async function startAction(activityRegistrationId: string, opponentRegistrationId?: string) {
  return toResult(async () => {
    const actor = await requireActionRole(...STAFF);
    return startAttempt(db, actor, {
      activityRegistrationId: z.string().uuid().parse(activityRegistrationId),
      opponentRegistrationId: opponentRegistrationId ? z.string().uuid().parse(opponentRegistrationId) : undefined,
    });
  });
}

export async function withdrawAction(activityRegistrationId: string, fd: FormData) {
  return toResult(async () =>
    withdrawFromActivity(
      db,
      await requireActionRole(...STAFF),
      z.string().uuid().parse(activityRegistrationId),
      String(fd.get("reason") ?? ""),
    ),
  );
}

export async function startHeatAction(activityRegistrationIds: string[]) {
  return toResult(async () => startHeat(db, await requireActionRole(...STAFF), activityRegistrationIds));
}

export async function finishRunnerAction(attemptId: string) {
  return toResult(async () => finishRunner(db, await requireActionRole(...STAFF), z.string().uuid().parse(attemptId)));
}

export async function finishAction(attemptId: string) {
  return toResult(async () => finishAttempt(db, await requireActionRole(...STAFF), z.string().uuid().parse(attemptId)));
}

export async function cancelAttemptAction(attemptId: string, fd: FormData) {
  return toResult(async () =>
    cancelAttempt(db, await requireActionRole(...STAFF), z.string().uuid().parse(attemptId), String(fd.get("reason") ?? "")),
  );
}

export async function submitAction(payload: unknown) {
  return toResult(async () => submitResult(db, await requireActionRole(...STAFF), payload));
}

export async function reviewAction(resultId: string, decision: "APPROVED" | "REJECTED", fd?: FormData) {
  return toResult(async () => {
    const r = await reviewResult(
      db,
      await requireActionRole(...STAFF),
      z.string().uuid().parse(resultId),
      z.enum(["APPROVED", "REJECTED"]).parse(decision),
      fd ? String(fd.get("note") ?? "") : undefined,
    );
    revalidatePath("/admin/results");
    return r;
  });
}

export async function disputeAction(resultId: string, fd: FormData) {
  return toResult(async () =>
    flagDispute(db, await requireActionRole(...STAFF), z.string().uuid().parse(resultId), String(fd.get("note") ?? "")),
  );
}

export async function correctAction(
  resultId: string,
  payload: { raw: Record<string, unknown>; status: "VALID" | "INCOMPLETE" | "DISQUALIFIED" | "WITHDRAWN"; reason?: string },
) {
  return toResult(async () => {
    const r = await correctResult(db, await requireActionRole(...STAFF), z.string().uuid().parse(resultId), payload);
    revalidatePath("/admin/results");
    return r;
  });
}

export async function deleteResultAction(resultId: string) {
  return toResult(async () => {
    const r = await deleteResult(db, await requireActionRole(...STAFF), z.string().uuid().parse(resultId));
    revalidatePath("/admin/results");
    return r;
  });
}

export async function dismissDisputeAction(resultId: string) {
  return toResult(async () => {
    const r = await dismissDispute(db, await requireActionRole("SUPER_ADMIN", "ADMIN"), z.string().uuid().parse(resultId));
    revalidatePath("/admin/results");
    return r;
  });
}

export async function scanLookupAction(activityId: string, scanned: string) {
  return toResult(async () =>
    lookupByReference(db, await requireActionRole(...STAFF), z.string().uuid().parse(activityId), z.string().max(500).parse(scanned)),
  );
}
