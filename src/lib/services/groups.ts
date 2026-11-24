import type { Db } from "@/lib/db";
import { assertActivityAccess, type Actor } from "@/lib/auth/policy";
import { AppError } from "@/lib/errors";
import { audit } from "./audit";

/** Create a named group from checked-in players. A player can be in only one group per activity. */
export async function createGroup(db: Db, actor: Actor, activityId: string, name: string, activityRegistrationIds: string[]) {
  await assertActivityAccess(db, actor, activityId);
  const title = name.trim();
  if (title.length < 1 || title.length > 60) throw new AppError("VALIDATION", "Give the group a name (up to 60 characters).");
  const ids = [...new Set(activityRegistrationIds)];
  if (ids.length < 1) throw new AppError("VALIDATION", "Pick at least one player for a group.");
  const ars = await db.activityRegistration.findMany({
    where: { id: { in: ids }, activityId, status: "CONFIRMED" },
    select: { id: true, queueStatus: true, groupMembership: { select: { groupId: true } }, participant: { select: { fullName: true } } },
  });
  if (ars.length !== ids.length) throw new AppError("NOT_FOUND", "Some players are not part of this activity.");
  const taken = ars.find((a) => a.groupMembership);
  if (taken) throw new AppError("CONFLICT", `${taken.participant.fullName} is already in a group.`);
  const notIn = ars.find((a) => a.queueStatus === "NOT_ARRIVED");
  if (notIn) throw new AppError("CONFLICT", `${notIn.participant.fullName} is not checked in.`);
  const group = await db.$transaction(async (tx) => {
    const g = await tx.activityGroup.create({
      data: { activityId, name: title, members: { create: ids.map((activityRegistrationId) => ({ activityRegistrationId })) } },
    });
    await audit(tx, { actorId: actor.id, action: "group.create", entityType: "ActivityGroup", entityId: g.id, next: { name: title, members: ids } });
    return g;
  });
  return { id: group.id };
}

/** Delete a group (players and their results stay; only the grouping goes). */
export async function deleteGroup(db: Db, actor: Actor, groupId: string) {
  const g = await db.activityGroup.findUnique({ where: { id: groupId }, select: { id: true, name: true, activityId: true } });
  if (!g) throw new AppError("NOT_FOUND", "Group not found.");
  await assertActivityAccess(db, actor, g.activityId);
  await db.activityGroup.delete({ where: { id: g.id } });
  await audit(db, { actorId: actor.id, action: "group.delete", entityType: "ActivityGroup", entityId: g.id, previous: { name: g.name } });
  return { deleted: true };
}
