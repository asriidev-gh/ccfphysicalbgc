import Image from "next/image";
import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentEvent } from "@/lib/event";
import { formatDateTime, formatTime } from "@/lib/utils";
import { Badge, buttonVariants, Card, CardBody, EmptyState } from "@/components/ui";
import { SportIcon } from "@/components/sport-icon";
import { Countdown, DustField, SpotlightGroup, TiltCard } from "@/components/home-motion";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

// Splits a word into letters that slam in one after another (see `.slam` in globals.css).
function Slam({ text, from = 0 }: { text: string; from?: number }) {
  return [...text].map((ch, i) => (
    <span key={i} className="slam" style={{ "--i": from + i } as React.CSSProperties}>
      {ch}
    </span>
  ));
}

export default async function Home() {
  const event = await getCurrentEvent();
  if (!event)
    return (
      <div className="mx-auto max-w-3xl p-8">
        <EmptyState title="No event is published yet" hint="Please check back soon." />
      </div>
    );
  const [activities, announcements] = await Promise.all([
    db.eventActivity.findMany({
      where: { eventId: event.id, challengeStatus: { not: "DRAFT" } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { sport: { select: { icon: true } }, _count: { select: { registrations: { where: { status: "CONFIRMED" } } } } },
    }),
    db.announcement.findMany({ where: { eventId: event.id, published: true }, orderBy: { publishedAt: "desc" }, take: 3 }),
  ]);
  // Draft activities are hidden from the public; show all the event's activities if none are active yet.
  const list = activities.length
    ? activities
    : await db.eventActivity.findMany({
        where: { eventId: event.id },
        orderBy: [{ sortOrder: "asc" }],
        include: { sport: { select: { icon: true } }, _count: { select: { registrations: { where: { status: "CONFIRMED" } } } } },
      });
  const now = new Date();
  const open = event.status !== "COMPLETED" && now >= event.registrationOpensAt && now <= event.registrationClosesAt;
  // Repeat short lists so one copy of the ticker is always wider than the screen.
  const ticker = list.length ? Array.from({ length: Math.ceil(8 / list.length) }, () => list).flat() : [];

  return (
    <div>
      <section className="hero-glow border-line relative overflow-hidden border-b">
        <DustField className="pointer-events-none absolute inset-0 size-full" />
        <div className="hero-exit relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 md:grid-cols-[1.1fr_0.9fr] md:py-16">
          <div>
            <p className="fade-up font-display text-brand text-sm font-semibold tracking-widest">{event.organizer}</p>
            <p className="fade-up font-display text-muted text-lg" style={delay(80)}>
              {event.occasion}
            </p>
            <h1 className="font-display mt-3 text-6xl leading-[0.95] font-bold sm:text-7xl" aria-label="Physical BGC 2026">
              <span aria-hidden>
                <Slam text="PHYSICAL" />{" "}
                <span className="shine" data-text="BGC">
                  <Slam text="BGC" from={9} />
                </span>
                <span className="text-accent block text-3xl sm:text-4xl">
                  <Slam text="2026" from={13} />
                </span>
              </span>
            </h1>
            <div className="fade-up mt-6" style={delay(1000)}>
              <Countdown startsAt={event.startsAt.toISOString()} endsAt={event.endsAt.toISOString()} />
            </div>
            <ul className="fade-up mt-6 space-y-2 text-base" style={delay(1100)}>
              <li className="flex items-start gap-2">
                <CalendarDays className="text-accent mt-0.5 size-5 shrink-0" aria-hidden />
                <span>
                  {formatDateTime(event.startsAt, event.timeZone, { dateStyle: "full", timeStyle: undefined })} ·{" "}
                  {formatTime(event.startsAt, event.timeZone).replace(":00 ", " ")} –{" "}
                  {formatTime(event.endsAt, event.timeZone).replace(":00 ", " ")}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="text-accent mt-0.5 size-5 shrink-0" aria-hidden />
                <span>{event.venue}</span>
              </li>
            </ul>
            <div className="fade-up mt-8 flex flex-wrap gap-3" style={delay(1200)}>
              {open ? (
                <Link href="/register" className={cn(buttonVariants({ size: "lg" }))}>
                  Register now
                </Link>
              ) : (
                <Badge tone="warn" className="px-3 py-2 text-sm">
                  {now < event.registrationOpensAt
                    ? `Registration opens ${formatDateTime(event.registrationOpensAt, event.timeZone)}`
                    : "Registration is closed"}
                </Badge>
              )}
              <Link href="/leaderboard" className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}>
                Live leaderboard
              </Link>
            </div>
          </div>
          <div className="poster-in relative mx-auto">
            <div aria-hidden className="moon-glow absolute -inset-16 rounded-full blur-2xl" />
            <TiltCard className="rounded-md">
              <Image
                src="/poster.png"
                alt="PHYSICAL BGC 2026 event poster showing athletes from six sports"
                width={1073}
                height={1599}
                priority
                className="border-line max-h-[34rem] w-auto rounded-md border object-contain shadow-2xl"
              />
            </TiltCard>
          </div>
        </div>
      </section>

      {ticker.length > 0 && (
        <div className="marquee border-line bg-surface/60 overflow-hidden border-b py-3" aria-hidden>
          <div className="marquee-track">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0">
                {ticker.map((a, i) => (
                  <span key={i} className="font-display text-muted flex items-center gap-3 px-6 text-lg font-semibold">
                    <SportIcon name={a.sport.icon} className="text-brand size-5" />
                    {a.name}
                    <span className="text-line ml-3">/</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {announcements.length > 0 && (
        <section aria-label="Announcements" className="mx-auto max-w-6xl px-4 pt-8">
          <div className="space-y-2">
            {announcements.map((a) => (
              <Card key={a.id} className="border-l-brand border-l-4">
                <CardBody>
                  <p className="font-semibold">{a.title}</p>
                  <p className="text-muted mt-1 text-sm">{a.body}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="font-display text-3xl font-bold">Activities</h2>
        <SpotlightGroup className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((a) => {
            const taken = a._count.registrations;
            const full = a.capacity !== null && taken >= a.capacity;
            return (
              <Card key={a.id} className="spotlight reveal p-4">
                <div className="flex items-center gap-3">
                  <span className="bg-brand/15 text-brand grid size-11 place-items-center rounded-md">
                    <SportIcon name={a.sport.icon} className="size-6" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-xl font-semibold">{a.name}</h3>
                    <p className="text-muted text-xs">{a.location || "CCF BGC Main Hall"}</p>
                  </div>
                </div>
                {a.description && <p className="text-muted mt-3 text-sm">{a.description}</p>}
                <div className="mt-3 flex gap-2">
                  {a.registrationStatus === "CLOSED" ? (
                    <Badge tone="warn">Registration closed</Badge>
                  ) : full ? (
                    <Badge tone="warn">{a.waitlistEnabled ? "Waitlist" : "Full"}</Badge>
                  ) : (
                    <Badge tone="ok">Open</Badge>
                  )}
                  {a.capacity !== null && <Badge>{Math.max(0, a.capacity - taken)} spots left</Badge>}
                </div>
                {a.capacity !== null && a.capacity > 0 && (
                  <div className="bg-surface-2 mt-3 h-1.5 overflow-hidden rounded-full" aria-hidden>
                    <div
                      className={cn("capacity-bar h-full rounded-full", full ? "bg-warn" : "bg-brand")}
                      style={{ width: `${Math.min(100, (taken / a.capacity) * 100)}%` }}
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </SpotlightGroup>
      </section>
    </div>
  );
}
