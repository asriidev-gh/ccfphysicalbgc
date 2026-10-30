"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActionRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AppError, toResult } from "@/lib/errors";
import * as admin from "@/lib/services/admin";
import { cancelRegistrationById, registerParticipant, updateActivitiesById } from "@/lib/services/registration";

const ADMINS = ["SUPER_ADMIN", "ADMIN"] as const;
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const b = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
const n = (fd: FormData, k: string) => (s(fd, k).trim() === "" ? null : Number(s(fd, k)));
const date = (fd: FormData, k: string) => (s(fd, k) ? new Date(s(fd, k)) : null);

function json(fd: FormData, k: string): unknown {
  try {
    return JSON.parse(s(fd, k));
  } catch {
    throw new AppError("VALIDATION", "Scoring configuration is not valid JSON.");
  }
}

/** datetime-local values are entered in Manila time (UTC+8, no DST). */
function manila(fd: FormData, k: string): Date {
  const v = s(fd, k);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v))
    throw new AppError("VALIDATION", "A valid date and time is required.", { [k]: "Required" });
  return new Date(`${v}:00+08:00`);
}

async function run<T>(paths: string[], fn: (actor: Awaited<ReturnType<typeof requireActionRole>>) => Promise<T>) {
  return toResult(async () => {
    const actor = await requireActionRole(...ADMINS);
    const r = await fn(actor);
    for (const p of paths) revalidatePath(p);
    return r;
  });
}

export const saveSportAction = async (fd: FormData) =>
  run(["/admin/sports"], async (a) => {
    await admin.saveSport(db, a, {
      id: s(fd, "id") || undefined,
      name: s(fd, "name"),
      description: s(fd, "description"),
      icon: s(fd, "icon") || "trophy",
      active: b(fd, "active"),
      defaultScoring: json(fd, "defaultScoring"),
    });
  });

export async function saveActivityAction(fd: FormData) {
  const r = await saveActivityInner(fd);
  if (r.ok && !s(fd, "id")) redirect(`/admin/activities/${r.data.id}`);
  return r;
}

const saveActivityInner = (fd: FormData) =>
  run(["/admin/activities"], async (a) => {
    const act = await admin.saveActivity(db, a, {
      id: s(fd, "id") || undefined,
      eventId: s(fd, "eventId"),
      sportId: s(fd, "sportId"),
      name: s(fd, "name"),
      description: s(fd, "description"),
      instructions: s(fd, "instructions"),
      location: s(fd, "location"),
      capacity: n(fd, "capacity"),
      waitlistEnabled: b(fd, "waitlistEnabled"),
      participation: s(fd, "participation") || "INDIVIDUAL",
      requireApproval: b(fd, "requireApproval"),
      independentApproval: b(fd, "independentApproval"),
      leaderboardPublished: b(fd, "leaderboardPublished"),
      startsAt: date(fd, "startsAt"),
      endsAt: date(fd, "endsAt"),
      scoringConfig: json(fd, "scoringConfig"),
    });
    return { id: act.id };
  });

export const activityStateAction = async (
  activityId: string,
  patch: { challengeStatus?: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED"; registrationStatus?: "OPEN" | "CLOSED" },
) =>
  run(["/admin/activities", "/admin"], async (a) => {
    await admin.setActivityState(db, a, activityId, patch);
  });

export const createUserAction = async (fd: FormData) =>
  run(["/admin/leads"], async (a) =>
    admin.createUser(db, a, {
      name: s(fd, "name"),
      email: s(fd, "email"),
      role: s(fd, "role") || "ACTIVITY_LEAD",
      password: s(fd, "password"),
    }),
  );

export const updateUserAction = async (userId: string, patch: { active?: boolean }, fd?: FormData) =>
  run(["/admin/leads"], async (a) =>
    admin.updateUser(db, a, userId, { ...patch, password: fd ? s(fd, "password") || undefined : undefined }),
  );

export const assignLeadAction = async (fd: FormData) =>
  run(["/admin/leads", "/admin/activities"], async (a) => admin.assignLead(db, a, s(fd, "userId"), s(fd, "activityId")));

export const unassignLeadAction = async (userId: string, activityId: string) =>
  run(["/admin/leads", "/admin/activities"], async (a) => admin.unassignLead(db, a, userId, activityId));

export const saveEventAction = async (fd: FormData) =>
  run(["/admin/events", "/admin", "/"], async (a) => {
    const e = await admin.saveEvent(db, a, {
      id: s(fd, "id") || undefined,
      name: s(fd, "name"),
      description: s(fd, "description"),
      organizer: s(fd, "organizer"),
      occasion: s(fd, "occasion"),
      venue: s(fd, "venue"),
      startsAt: manila(fd, "startsAt"),
      endsAt: manila(fd, "endsAt"),
      registrationOpensAt: manila(fd, "registrationOpensAt"),
      registrationClosesAt: manila(fd, "registrationClosesAt"),
      status: s(fd, "status"),
      timeZone: s(fd, "timeZone") || "Asia/Manila",
      allowMultipleActivities: b(fd, "allowMultipleActivities"),
    });
    return { id: e.id };
  });

export const saveAnnouncementAction = async (fd: FormData) =>
  run(["/admin/announcements", "/"], async (a) => {
    await admin.saveAnnouncement(db, a, {
      id: s(fd, "id") || undefined,
      eventId: s(fd, "eventId"),
      title: s(fd, "title"),
      body: s(fd, "body"),
      published: b(fd, "published"),
      showOnDisplay: b(fd, "showOnDisplay"),
    });
  });

export const deleteAnnouncementAction = async (id: string) =>
  run(["/admin/announcements", "/"], async (a) => admin.deleteAnnouncement(db, a, id));

export const saveDisplayAction = async (fd: FormData) =>
  run(["/admin/display"], async (a) => {
    await admin.saveDisplaySettings(db, a, {
      eventId: s(fd, "eventId"),
      activityId: s(fd, "activityId") || null,
      mode: s(fd, "mode"),
      topN: Number(s(fd, "topN") || 10),
      rotate: b(fd, "rotate"),
      rotateSeconds: Number(s(fd, "rotateSeconds") || 15),
      paused: b(fd, "paused"),
      showAnnouncements: b(fd, "showAnnouncements"),
    });
  });

export const editParticipantAction = async (participantId: string, fd: FormData) =>
  run(["/admin/participants"], async (a) => {
    await admin.editParticipant(db, a, participantId, {
      fullName: s(fd, "fullName"),
      email: s(fd, "email"),
      mobile: s(fd, "mobile"),
      affiliation: s(fd, "affiliation"),
      status: s(fd, "status"),
    });
  });

export const cancelRegistrationAction = async (registrationId: string) =>
  run(["/admin/participants", "/admin/registrations"], async (a) => {
    await cancelRegistrationById(db, registrationId, a.id, "admin");
  });

export const setRegistrationActivitiesAction = async (registrationId: string, fd: FormData) =>
  run(["/admin/participants", "/admin/registrations"], async (a) => {
    await updateActivitiesById(db, registrationId, fd.getAll("activityIds").map(String), a.id);
  });

export const walkInAction = async (eventSlug: string, fd: FormData) =>
  run(["/admin/participants", "/admin/registrations"], async (a) => {
    const r = await registerParticipant(
      db,
      eventSlug,
      {
        fullName: s(fd, "fullName"),
        email: s(fd, "email") || undefined,
        mobile: s(fd, "mobile") || undefined,
        affiliation: s(fd, "affiliation") || undefined,
        activityIds: fd.getAll("activityIds").map(String),
        consent: b(fd, "consent"),
        eligibilityConfirmed: b(fd, "eligibilityConfirmed"),
      },
      { walkInBy: a },
    );
    return { reference: r.reference };
  });
