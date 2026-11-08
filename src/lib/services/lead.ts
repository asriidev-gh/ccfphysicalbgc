import type { Db } from "@/lib/db";
import { assertActivityAccess, assignedActivityIds, type Actor } from "@/lib/auth/policy";
import { AppError } from "@/lib/errors";
import { loadConfig } from "./challenge";
import { formatValue } from "./leaderboard";
import type { ScoringConfig } from "@/lib/scoring/schema";

export interface LeadAttempt {
  id: string;
  number: number;
  status: "RUNNING" | "FINISHED" | "SUBMITTED" | "CANCELLED";
  startedAt: string;
  elapsedMs: number | null;
  heat: number | null;
  opponentName: string | null;
  result: null | {
    id: string;
    status: string;
    approval: string;
    display: string;
    value: number | null;
    published: boolean;
    disputed: boolean;
    mine: boolean;
    raw: Record<string, unknown>;
  };
}

export interface LeadRow {
  id: string;
  name: string;
  /** Short booth code (CCFBGC-0427); staff-facing. */
  code: string;
  /** Cloudinary URL of the registration photo, or null when none was taken. */
  photoUrl: string | null;
  queue: "NOT_ARRIVED" | "WAITING" | "IN_PROGRESS" | "DONE" | "WITHDRAWN";
  participantStatus: string;
  attempts: LeadAttempt[];
}

export interface LeadConsoleData {
  activity: {
    id: string;
    eventId: string;
    name: string;
    status: string;
    instructions: string;
    maxAttempts: number;
    requireApproval: boolean;
    independentApproval: boolean;
    config: ScoringConfig;
  };
  rows: LeadRow[];
  stats: { registered: number; checkedIn: number; waiting: number; inProgress: number; completed: number; awaitingApproval: number };
  serverNow: string;
}

export async function listMyActivities(db: Db, actor: Actor) {
  const ids = await assignedActivityIds(db, actor);
  return db.eventActivity.findMany({
    where: ids === null ? {} : { id: { in: ids } },
    orderBy: [{ event: { startsAt: "desc" } }, { sortOrder: "asc" }],
    select: { id: true, name: true, eventId: true, challengeStatus: true, event: { select: { name: true } }, sport: { select: { icon: true } } },
  });
}

export async function getLeadConsole(db: Db, actor: Actor, activityId: string): Promise<LeadConsoleData> {
  await assertActivityAccess(db, actor, activityId);
  const a = await db.eventActivity.findUnique({ where: { id: activityId } });
  if (!a) throw new AppError("NOT_FOUND", "Activity not found.");
  const config = loadConfig(a.scoringConfig);

  const ars = await db.activityRegistration.findMany({
    where: { activityId, status: "CONFIRMED" },
    orderBy: { participant: { fullName: "asc" } },
    select: {
      id: true,
      queueStatus: true,
      participant: {
        select: {
          fullName: true,
          status: true,
          photoUrl: true,
          registrations: { where: { eventId: a.eventId }, select: { code: true }, take: 1 },
        },
      },
      attempts: {
        orderBy: { attemptNumber: "asc" },
        select: {
          id: true,
          attemptNumber: true,
          status: true,
          startedAt: true,
          elapsedMs: true,
          heat: true,
          opponentRegistration: { select: { participant: { select: { fullName: true } } } },
          results: {
            where: { current: true },
            select: {
              id: true,
              resultStatus: true,
              approvalStatus: true,
              finalValue: true,
              published: true,
              disputed: true,
              submittedById: true,
              rawData: true,
            },
          },
        },
      },
    },
  });

  let awaitingApproval = 0;
  const rows: LeadRow[] = ars.map((r) => ({
    id: r.id,
    name: r.participant.fullName,
    code: r.participant.registrations[0]?.code ?? "",
    photoUrl: r.participant.photoUrl,
    queue: r.queueStatus,
    participantStatus: r.participant.status,
    attempts: r.attempts.map((t) => {
      const res = t.results[0];
      if (res?.approvalStatus === "PENDING") awaitingApproval += 1;
      return {
        id: t.id,
        number: t.attemptNumber,
        status: t.status,
        startedAt: t.startedAt.toISOString(),
        elapsedMs: t.elapsedMs,
        heat: t.heat,
        opponentName: t.opponentRegistration?.participant.fullName ?? null,
        result: res
          ? {
              id: res.id,
              status: res.resultStatus,
              approval: res.approvalStatus,
              display:
                res.resultStatus === "VALID" ? formatValue(config, res.finalValue ? res.finalValue.toNumber() : null) : res.resultStatus,
              value: res.finalValue ? res.finalValue.toNumber() : null,
              published: res.published,
              disputed: res.disputed,
              mine: res.submittedById === actor.id,
              raw: (res.rawData ?? {}) as Record<string, unknown>,
            }
          : null,
      };
    }),
  }));

  return {
    activity: {
      id: a.id,
      eventId: a.eventId,
      name: a.name,
      status: a.challengeStatus,
      instructions: a.instructions,
      maxAttempts: config.attemptPolicy.maxAttempts,
      requireApproval: a.requireApproval,
      independentApproval: a.independentApproval,
      config,
    },
    rows,
    stats: {
      registered: rows.length,
      checkedIn: rows.filter((r) => r.queue !== "NOT_ARRIVED").length,
      waiting: rows.filter((r) => r.queue === "WAITING").length,
      inProgress: rows.filter((r) => r.queue === "IN_PROGRESS").length,
      completed: rows.filter((r) => r.queue === "DONE").length,
      awaitingApproval,
    },
    serverNow: new Date().toISOString(),
  };
}

/** Extract the booth code from a scanned QR or a typed value: the short CCFBGC-0000 code, or a legacy PB-… reference. */
export function parseReference(input: string): { code: string } | { reference: string } | null {
  const up = input.toUpperCase();
  const c = up.match(/CCFBGC-\d{4}/);
  if (c) return { code: c[0] };
  const m = up.match(/PB-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/);
  return m ? { reference: m[0] } : null;
}

/** Resolve a scanned participant to their registration for this booth's activity. */
export async function lookupByReference(db: Db, actor: Actor, activityId: string, scanned: string) {
  await assertActivityAccess(db, actor, activityId);
  const key = parseReference(scanned);
  if (!key) throw new AppError("VALIDATION", "That doesn't look like a participant QR code.");
  const reg = await db.registration.findFirst({
    where: "code" in key ? { code: key.code, event: { activities: { some: { id: activityId } } } } : { reference: key.reference },
    select: {
      status: true,
      participant: { select: { id: true, fullName: true } },
      event: { select: { activities: { where: { id: activityId }, select: { id: true } } } },
    },
  });
  if (!reg || reg.event.activities.length === 0) throw new AppError("NOT_FOUND", "Registration not found for this event.");
  if (reg.status === "CANCELLED") throw new AppError("CONFLICT", `${reg.participant.fullName}'s registration was cancelled.`);
  // Everyone registered may join any activity; enrol on first scan (covers activities added after they registered).
  const ar = await db.activityRegistration.upsert({
    where: { participantId_activityId: { participantId: reg.participant.id, activityId } },
    update: {},
    create: { participantId: reg.participant.id, activityId, status: "CONFIRMED" },
    select: { id: true, status: true },
  });
  if (!ar || ar.status !== "CONFIRMED") {
    throw new AppError("NOT_FOUND", `${reg.participant.fullName} is not registered for this activity.`);
  }
  return { activityRegistrationId: ar.id };
}
