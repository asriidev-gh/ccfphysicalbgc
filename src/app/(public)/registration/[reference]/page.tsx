import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { photoThumb } from "@/lib/photo-url";
import { getRegistrationByReference } from "@/lib/services/registration";
import { loadConfig } from "@/lib/services/challenge";
import { formatValue } from "@/lib/services/leaderboard";
import { formatDateTime } from "@/lib/utils";
import { Badge, Card, CardBody, CardHeader, CardTitle, PageTitle } from "@/components/ui";
import { QrTicket } from "@/components/qr-ticket";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registration", robots: { index: false } };

export default async function RegistrationPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const reg = await getRegistrationByReference(db, decodeURIComponent(reference));
  if (!reg) notFound();

  // The QR encodes only the short booth code (a small, easy-to-scan QR): no ids, names or contact details.
  // Error correction "H" lets the ticket cover the centre with the logo and still scan.
  const qr = await QRCode.toDataURL(reg.code, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 520,
    color: { dark: "#0b0b0c", light: "#ffffff" },
  });

  const results = await db.challengeResult.findMany({
    where: {
      current: true,
      disputed: false,
      approvalStatus: { in: ["APPROVED", "PENDING"] },
      attempt: { activityRegistration: { participantId: reg.participantId, activity: { eventId: reg.eventId } } },
    },
    select: {
      finalValue: true,
      resultStatus: true,
      approvalStatus: true,
      published: true,
      attempt: { select: { attemptNumber: true, activity: { select: { name: true, scoringConfig: true } } } },
    },
    orderBy: { submittedAt: "desc" },
  });

  const mine = reg.participant.activityRegistrations.filter((a) => a.status !== "CANCELLED");
  const cancelled = reg.status === "CANCELLED";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <PageTitle title={cancelled ? "Registration cancelled" : "You're registered!"} sub={reg.event.name} />
      <Card>
        <CardBody className="grid gap-6 sm:grid-cols-[auto_1fr]">
          <QrTicket qr={qr} name={reg.participant.fullName} code={reg.code} />
          <div className="space-y-2">
            <p className="text-muted text-xs tracking-wider uppercase">Check-in code</p>
            <p className="tabular font-display text-accent text-3xl font-bold">{reg.code}</p>
            <div className="flex items-center gap-3">
              {reg.participant.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- small Cloudinary thumbnail
                <img
                  src={photoThumb(reg.participant.photoUrl, 112)}
                  alt=""
                  width={56}
                  height={56}
                  className="size-14 rounded-full object-cover"
                />
              )}
              <p className="font-semibold">{reg.participant.fullName}</p>
            </div>
            <p className="text-muted text-sm">
              {formatDateTime(reg.event.startsAt, reg.event.timeZone)} · {reg.event.venue}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge tone={cancelled ? "bad" : "ok"}>{reg.status}</Badge>
              {reg.checkedInAt && <Badge tone="accent">Checked in</Badge>}
            </div>
            <p className="text-muted pt-2 text-xs">
              Show this QR code at check-in. Keep this link private: anyone with it can see this registration.
            </p>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Enjoy our sports challenge in the following sports</CardTitle>
        </CardHeader>
        <CardBody>
          {mine.length === 0 ? (
            <p className="text-muted text-sm">No activities selected.</p>
          ) : (
            <ul className="space-y-3">
              {mine.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{a.activity.name}</p>
                    {a.activity.location && <p className="text-muted text-xs">{a.activity.location}</p>}
                  </div>
                  <Badge tone={a.status === "CONFIRMED" ? "ok" : "warn"}>
                    {a.status === "WAITLISTED"
                      ? "Waitlisted"
                      : a.queueStatus === "NOT_ARRIVED"
                        ? "Confirmed"
                        : a.queueStatus.replace("_", " ")}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {results.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Your results</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2">
              {results.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span>
                    {r.attempt.activity.name} <span className="text-muted text-xs">attempt {r.attempt.attemptNumber}</span>
                  </span>
                  <span className="tabular font-display text-xl font-bold">
                    {r.approvalStatus === "PENDING" ? (
                      <Badge tone="warn">Awaiting approval</Badge>
                    ) : r.resultStatus === "VALID" ? (
                      formatValue(loadConfig(r.attempt.activity.scoringConfig), r.finalValue ? r.finalValue.toNumber() : null)
                    ) : (
                      r.resultStatus
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
