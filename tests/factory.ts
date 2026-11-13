import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/hash";
import type { Actor } from "@/lib/auth/policy";
import type { ScoringConfig } from "@/lib/scoring/schema";
import { defaultScoringConfig } from "@/lib/scoring/templates";

const uid = () => randomUUID().slice(0, 8);

export async function makeUser(role: Actor["role"], label = role.toLowerCase()): Promise<Actor> {
  const u = await db.user.create({
    data: { name: `${label} ${uid()}`, email: `${label}.${uid()}@test.local`, role, passwordHash: await hashPassword("test-password-123") },
  });
  return { id: u.id, name: u.name, role: u.role };
}

export interface World {
  event: Awaited<ReturnType<typeof db.event.create>>;
  sport: Awaited<ReturnType<typeof db.sport.create>>;
  admin: Actor;
  superAdmin: Actor;
  lead: Actor;
  otherLead: Actor;
  makeActivity: (o?: ActivityOpts) => Promise<Awaited<ReturnType<typeof db.eventActivity.create>>>;
  cleanup: () => Promise<void>;
}

interface ActivityOpts {
  name?: string;
  config?: ScoringConfig;
  capacity?: number | null;
  waitlist?: boolean;
  requireApproval?: boolean;
  independentApproval?: boolean;
  challengeStatus?: "DRAFT" | "ACTIVE";
  assign?: Actor[];
  checkpoints?: string[];
}

const DAY = 86_400_000;

export async function makeWorld(
  eventOverrides: Partial<{ registrationOpensAt: Date; registrationClosesAt: Date; status: "DRAFT" | "PUBLISHED" | "LIVE" }> = {},
): Promise<World> {
  const s = uid();
  const now = Date.now();
  const event = await db.event.create({
    data: {
      name: `Test Event ${s}`,
      slug: `test-event-${s}`,
      venue: "Test Hall",
      startsAt: new Date(now + 2 * DAY),
      endsAt: new Date(now + 2 * DAY + 3 * 3600_000),
      registrationOpensAt: eventOverrides.registrationOpensAt ?? new Date(now - DAY),
      registrationClosesAt: eventOverrides.registrationClosesAt ?? new Date(now + DAY),
      status: eventOverrides.status ?? "PUBLISHED",
    },
  });
  const sport = await db.sport.create({ data: { name: `Sport ${s}`, slug: `sport-${s}`, defaultScoring: defaultScoringConfig("TIME") } });
  const [admin, superAdmin, lead, otherLead] = await Promise.all([
    makeUser("ADMIN"),
    makeUser("SUPER_ADMIN", "super"),
    makeUser("ACTIVITY_LEAD", "lead"),
    makeUser("ACTIVITY_LEAD", "other"),
  ]);
  const userIds = [admin.id, superAdmin.id, lead.id, otherLead.id];

  const makeActivity: World["makeActivity"] = async (o = {}) => {
    const cfg = o.config ?? defaultScoringConfig("TIME");
    const name = o.name ?? `Activity ${uid()}`;
    const a = await db.eventActivity.create({
      data: {
        eventId: event.id,
        sportId: sport.id,
        name,
        slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${uid()}`,
        capacity: o.capacity === undefined ? null : o.capacity,
        waitlistEnabled: o.waitlist ?? false,
        requireApproval: o.requireApproval ?? true,
        independentApproval: o.independentApproval ?? true,
        challengeStatus: o.challengeStatus ?? "ACTIVE",
        checkpoints: o.checkpoints ?? [],
        scoringConfig: cfg,
      },
    });
    await db.scoringConfigVersion.create({ data: { activityId: a.id, version: 1, config: cfg } });
    for (const u of o.assign ?? [lead]) await db.activityAssignment.create({ data: { userId: u.id, activityId: a.id } });
    return a;
  };

  return {
    event,
    sport,
    admin,
    superAdmin,
    lead,
    otherLead,
    makeActivity,
    cleanup: async () => {
      await db.challengeResult.deleteMany({ where: { attempt: { activity: { eventId: event.id } } } });
      await db.event.delete({ where: { id: event.id } });
      await db.sport.deleteMany({ where: { id: sport.id } }).catch(() => undefined);
      await db.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
      await db.challengeResult.deleteMany({ where: { submittedById: { in: userIds } } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
    },
  };
}

let n = 0;
export function person(extra: Record<string, unknown> = {}) {
  n += 1;
  const s = `${uid()}${n}`;
  return {
    fullName: `Person ${s}`,
    email: `p.${s}@test.local`,
    gender: "MALE",
    activityIds: [] as string[],
    consent: true,
    eligibilityConfirmed: true,
    ...extra,
  };
}
