import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/hash";
import { presetFor } from "../src/lib/scoring/templates";

/**
 * SEED_MODE=dev        (default) event + sports + activities + LOCAL-ONLY demo accounts.
 * SEED_MODE=bootstrap  event + sports + activities + ONE super admin from BOOTSTRAP_ADMIN_EMAIL /
 *                      BOOTSTRAP_ADMIN_PASSWORD. Use this for staging/production (e.g. Supabase).
 * Dev mode refuses to run against NODE_ENV=production or a non-local database.
 */
const mode = process.env.SEED_MODE ?? "dev";
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);

if (mode === "dev" && (process.env.NODE_ENV === "production" || !isLocal)) {
  console.error("Refusing to seed development accounts into a non-local/production database. Use SEED_MODE=bootstrap.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

/** Initial configuration only. These people are NOT accounts; admins create their accounts and assign them. */
export const SUGGESTED_LEADS: Record<string, string> = {
  badminton: "Kat and Jayson",
  basketball: "Andy",
  running: "Salvi and Pau",
  pickleball: "Nikki",
  hyrox: "Lester",
  crossfit: "Jovi",
};

const SPORTS = [
  { slug: "badminton", name: "Badminton", icon: "feather", description: "Singles and doubles matches." },
  { slug: "basketball", name: "Basketball", icon: "dribbble", description: "Shooting challenge." },
  { slug: "running", name: "Running", icon: "footprints", description: "Timed sprint." },
  { slug: "pickleball", name: "Pickleball", icon: "circle-dot", description: "Match play." },
  { slug: "hyrox", name: "HYROX", icon: "dumbbell", description: "Multi-station fitness race." },
  { slug: "crossfit", name: "CrossFit", icon: "weight", description: "Rounds, reps and time." },
];

async function main() {
  const event = await db.event.upsert({
    where: { slug: "physical-bgc-2026" },
    update: {},
    create: {
      name: "PHYSICAL BGC 2026",
      slug: "physical-bgc-2026",
      organizer: "CCF BGC Sports Ministry",
      occasion: "2nd Year Anniversary Celebration",
      description: "A night of sport and community: badminton, basketball, running, pickleball, HYROX and CrossFit.",
      venue: "CCF BGC Main Hall, 4F, One Bonifacio, Taguig City",
      // Nov 25 2026, 6:00–9:00 PM Asia/Manila (UTC+8)
      startsAt: new Date("2026-11-25T10:00:00Z"),
      endsAt: new Date("2026-11-25T13:00:00Z"),
      registrationOpensAt: new Date("2026-10-01T00:00:00Z"),
      registrationClosesAt: new Date("2026-11-25T08:00:00Z"),
      status: "PUBLISHED",
      timeZone: "Asia/Manila",
    },
  });

  let order = 0;
  for (const s of SPORTS) {
    const cfg = presetFor(s.slug);
    const sport = await db.sport.upsert({
      where: { slug: s.slug },
      update: {},
      create: { slug: s.slug, name: s.name, icon: s.icon, description: s.description, defaultScoring: cfg },
    });
    const existing = await db.eventActivity.findUnique({ where: { eventId_slug: { eventId: event.id, slug: s.slug } } });
    if (existing) continue;
    const a = await db.eventActivity.create({
      data: {
        eventId: event.id,
        sportId: sport.id,
        name: s.name,
        slug: s.slug,
        description: s.description,
        scoringConfig: cfg,
        sortOrder: order++,
        challengeStatus: "DRAFT", // admins review the scoring rules, then activate
        capacity: null,
      },
    });
    await db.scoringConfigVersion.create({ data: { activityId: a.id, version: 1, config: cfg } });
  }
  await db.leaderboardDisplaySettings.upsert({ where: { eventId: event.id }, update: {}, create: { eventId: event.id } });

  if (mode === "bootstrap") {
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase();
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    if (!email || !password || password.length < 12)
      throw new Error("BOOTSTRAP_ADMIN_EMAIL and a BOOTSTRAP_ADMIN_PASSWORD of 12+ characters are required");
    await db.user.upsert({
      where: { email },
      update: {},
      create: { email, name: "Super Admin", role: "SUPER_ADMIN", passwordHash: await hashPassword(password) },
    });
    console.log(`Bootstrap complete. Super admin: ${email}. Create activity-lead accounts in Admin → Activity Leads.`);
    return;
  }

  const pw = process.env.SEED_DEV_PASSWORD ?? "local-dev-only-ChangeMe1";
  const hash = await hashPassword(pw);
  const accounts = [
    { email: "superadmin@local.test", name: "Dev Super Admin", role: "SUPER_ADMIN" as const },
    { email: "admin@local.test", name: "Dev Admin", role: "ADMIN" as const },
    ...SPORTS.map((s) => ({
      email: `lead.${s.slug}@local.test`,
      name: `Dev Lead (${s.name})`,
      role: "ACTIVITY_LEAD" as const,
      slug: s.slug,
    })),
  ];
  for (const acc of accounts) {
    const user = await db.user.upsert({
      where: { email: acc.email },
      update: {},
      create: { email: acc.email, name: acc.name, role: acc.role, passwordHash: hash },
    });
    if ("slug" in acc) {
      const act = await db.eventActivity.findUnique({ where: { eventId_slug: { eventId: event.id, slug: acc.slug } } });
      if (act)
        await db.activityAssignment.upsert({
          where: { userId_activityId: { userId: user.id, activityId: act.id } },
          update: {},
          create: { userId: user.id, activityId: act.id },
        });
    }
  }
  console.log("Seeded LOCAL development data. Accounts (password from SEED_DEV_PASSWORD):");
  for (const a of accounts) console.log(`  ${a.role.padEnd(14)} ${a.email}`);
  console.log("\nSuggested real leads (create accounts and assign in the admin UI):");
  for (const [k, v] of Object.entries(SUGGESTED_LEADS)) console.log(`  ${k.padEnd(11)} ${v}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
