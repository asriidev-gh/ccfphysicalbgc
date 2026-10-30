import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { cancelRegistrationById, participantCancel, participantUpdateActivities, registerParticipant } from "@/lib/services/registration";
import { makeWorld, person, type World } from "./factory";

let w: World;
beforeAll(async () => {
  w = await makeWorld();
});
afterAll(async () => {
  await w.cleanup();
  await db.$disconnect();
});

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "OK";
  } catch (e) {
    return e instanceof AppError ? e.code : `ERR:${String(e)}`;
  }
};

describe("registration", () => {
  it("registers a participant and returns an unguessable reference", async () => {
    const a = await w.makeActivity();
    const r = await registerParticipant(db, w.event.slug, person({ activityIds: [a.id] }));
    expect(r.reference).toMatch(/^PB-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(r.activities).toEqual([{ activityId: a.id, status: "CONFIRMED" }]);
    const ar = await db.activityRegistration.findFirst({ where: { activityId: a.id } });
    expect(ar?.status).toBe("CONFIRMED");
  });

  it("rejects the same person registering twice by email or by mobile", async () => {
    const a = await w.makeActivity();
    const p = person({ activityIds: [a.id], mobile: "09171234567" });
    await registerParticipant(db, w.event.slug, p);
    expect(
      await code(registerParticipant(db, w.event.slug, { ...person({ activityIds: [a.id] }), fullName: p.fullName, email: p.email })),
    ).toBe("CONFLICT");
    expect(
      await code(
        registerParticipant(db, w.event.slug, {
          ...person({ activityIds: [a.id] }),
          fullName: p.fullName.toUpperCase(),
          mobile: "+63 917 123 4567",
        }),
      ),
    ).toBe("CONFLICT");
  });

  it("allows different people (e.g. relatives) to share an email or mobile", async () => {
    const a = await w.makeActivity();
    const p = person({ activityIds: [a.id], mobile: "09171234567" });
    await registerParticipant(db, w.event.slug, p);
    await registerParticipant(db, w.event.slug, { ...person({ activityIds: [a.id] }), email: p.email, mobile: "09171234567" });
  });

  it("validates input", async () => {
    expect(await code(registerParticipant(db, w.event.slug, { ...person(), email: "nope" }))).toBe("VALIDATION");
    expect(await code(registerParticipant(db, w.event.slug, { ...person(), consent: false }))).toBe("VALIDATION");
    expect(await code(registerParticipant(db, w.event.slug, { ...person(), email: undefined }))).toBe("VALIDATION"); // no contact
    expect(await code(registerParticipant(db, w.event.slug, { ...person(), fullName: "x" }))).toBe("VALIDATION");
  });

  it("ignores privileged fields supplied by the client", async () => {
    const r = await registerParticipant(db, w.event.slug, {
      ...person(),
      role: "SUPER_ADMIN",
      status: "CANCELLED",
      walkIn: true,
      checkedInAt: new Date(),
    });
    const reg = await db.registration.findUnique({ where: { reference: r.reference } });
    expect(reg).toMatchObject({ status: "CONFIRMED", walkIn: false, checkedInAt: null });
  });

  it("enforces the registration window", async () => {
    const closed = await makeWorld({
      registrationClosesAt: new Date(Date.now() - 1000),
      registrationOpensAt: new Date(Date.now() - 86_400_000),
    });
    const notYet = await makeWorld({
      registrationOpensAt: new Date(Date.now() + 3_600_000),
      registrationClosesAt: new Date(Date.now() + 7_200_000),
    });
    const draft = await makeWorld({ status: "DRAFT" });
    try {
      expect(await code(registerParticipant(db, closed.event.slug, person()))).toBe("CONFLICT");
      expect(await code(registerParticipant(db, notYet.event.slug, person()))).toBe("CONFLICT");
      expect(await code(registerParticipant(db, draft.event.slug, person()))).toBe("CONFLICT");
      // An admin may still register a walk-in after close.
      expect(await code(registerParticipant(db, closed.event.slug, person(), { walkInBy: closed.admin }))).toBe("OK");
    } finally {
      await Promise.all([closed.cleanup(), notYet.cleanup(), draft.cleanup()]);
    }
  });

  it("rejects closed activities and full activities without a waitlist", async () => {
    const closedAct = await w.makeActivity();
    await db.eventActivity.update({ where: { id: closedAct.id }, data: { registrationStatus: "CLOSED" } });
    expect(await code(registerParticipant(db, w.event.slug, person({ activityIds: [closedAct.id] })))).toBe("CONFLICT");

    const full = await w.makeActivity({ capacity: 1 });
    await registerParticipant(db, w.event.slug, person({ activityIds: [full.id] }));
    expect(await code(registerParticipant(db, w.event.slug, person({ activityIds: [full.id] })))).toBe("CONFLICT");
  });

  it("never oversells capacity under concurrent registrations", async () => {
    const act = await w.makeActivity({ capacity: 3 });
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => registerParticipant(db, w.event.slug, person({ activityIds: [act.id] }))),
    );
    const confirmed = await db.activityRegistration.count({ where: { activityId: act.id, status: "CONFIRMED" } });
    expect(confirmed).toBe(3);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
  });

  it("waitlists when full and promotes the oldest on cancellation", async () => {
    const act = await w.makeActivity({ capacity: 1, waitlist: true });
    const first = await registerParticipant(db, w.event.slug, person({ activityIds: [act.id] }));
    const second = await registerParticipant(db, w.event.slug, person({ activityIds: [act.id] }));
    expect(second.activities[0].status).toBe("WAITLISTED");
    const reg = await db.registration.findUniqueOrThrow({ where: { reference: first.reference } });
    await cancelRegistrationById(db, reg.id, null, "admin");
    const promoted = await db.activityRegistration.findFirstOrThrow({
      where: { activityId: act.id, participant: { registrations: { some: { reference: second.reference } } } },
    });
    expect(promoted.status).toBe("CONFIRMED");
  });

  it("rejects unknown or foreign activities", async () => {
    const other = await makeWorld();
    const foreign = await other.makeActivity();
    try {
      expect(await code(registerParticipant(db, w.event.slug, person({ activityIds: [foreign.id] })))).toBe("VALIDATION");
    } finally {
      await other.cleanup();
    }
  });
});

describe("participant self-service authorisation", () => {
  it("requires proof of contact details to cancel or change a registration", async () => {
    const a = await w.makeActivity();
    const p = person({ activityIds: [a.id] });
    const r = await registerParticipant(db, w.event.slug, p);
    expect(await code(participantCancel(db, r.reference, "someone@else.com"))).toBe("NOT_FOUND");
    expect(await code(participantCancel(db, r.reference, ""))).toBe("NOT_FOUND");
    expect(await code(participantUpdateActivities(db, r.reference, "wrong@x.com", []))).toBe("NOT_FOUND");
    expect(await code(participantUpdateActivities(db, r.reference, p.email, []))).toBe("OK");
    expect(await code(participantCancel(db, r.reference, p.email))).toBe("OK");
    const reg = await db.registration.findUniqueOrThrow({ where: { reference: r.reference } });
    expect(reg.status).toBe("CANCELLED");
  });

  it("blocks changes after the registration deadline", async () => {
    const p = person();
    const r = await registerParticipant(db, w.event.slug, p);
    await db.event.update({
      where: { id: w.event.id },
      data: { registrationClosesAt: new Date(Date.now() - 1000), registrationOpensAt: new Date(Date.now() - 86_400_000 * 2) },
    });
    try {
      expect(await code(participantUpdateActivities(db, r.reference, p.email, []))).toBe("CONFLICT");
    } finally {
      await db.event.update({ where: { id: w.event.id }, data: { registrationClosesAt: new Date(Date.now() + 86_400_000) } });
    }
  });
});
