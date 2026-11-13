import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requirePageRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PageTitle } from "@/components/ui";
import { QrThumb } from "./qr-thumb";
import { DeleteAllParticipantsButton, DeleteParticipantButton, GenderSelect } from "./delete-buttons";

export const dynamic = "force-dynamic";
export const metadata = { title: "All Participants" };

/** Local development helper: every registered participant with their booth ID. Hidden in production. */
export default async function AllParticipants({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  await requirePageRole("ACTIVITY_LEAD", "ADMIN", "SUPER_ADMIN");
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  const regs = await db.registration.findMany({
    where: q
      ? { OR: [{ code: { contains: q, mode: "insensitive" } }, { participant: { fullName: { contains: q, mode: "insensitive" } } }] }
      : {},
    orderBy: [{ code: "asc" }],
    take: 1000,
    select: { id: true, code: true, status: true, participantId: true, participant: { select: { fullName: true, gender: true } } },
  });

  // Same QR as the registration ticket: it encodes only the booth code.
  const qrs = await Promise.all(
    regs.map((r) => QRCode.toDataURL(r.code, { errorCorrectionLevel: "M", margin: 1, width: 420, color: { dark: "#0b0b0c", light: "#ffffff" } })),
  );

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle title="All Participants" sub={`${regs.length} shown · local development only`} />
      <div className="mb-4">
        <DeleteAllParticipantsButton count={regs.length} />
      </div>
      <form className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name or ID"
          aria-label="Search participants"
          className="border-line bg-surface-2 min-h-11 flex-1 rounded-md border px-3"
        />
        <button className="border-line bg-surface-2 rounded-md border px-4 font-semibold">Search</button>
      </form>
      <div className="border-line bg-surface overflow-hidden rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="text-muted border-line border-b text-xs uppercase">
            <tr>
              <th className="px-3 py-2">QR</th>
              <th className="px-3 py-2">Participant ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Gender</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Delete</th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {regs.map((r, i) => (
              <tr key={r.id}>
                <td className="px-3 py-2">
                  <QrThumb qr={qrs[i]} name={r.participant.fullName} code={r.code} />
                </td>
                <td className="tabular px-3 py-2 font-semibold">{r.code}</td>
                <td className="px-3 py-2">{r.participant.fullName}</td>
                <td className="px-3 py-2">
                  <GenderSelect participantId={r.participantId} value={r.participant.gender} />
                </td>
                <td className="text-muted px-3 py-2">{r.status}</td>
                <td className="px-3 py-2 text-right">
                  <DeleteParticipantButton participantId={r.participantId} name={r.participant.fullName} code={r.code} />
                </td>
              </tr>
            ))}
            {regs.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted px-3 py-6 text-center">
                  No participants found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
