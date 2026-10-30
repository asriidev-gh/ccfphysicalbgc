import Link from "next/link";
import { db } from "@/lib/db";
import { buttonVariants, EmptyState, Input, PageTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { adminPage, one } from "../_lib";

export const metadata = { title: "Audit logs" };
const PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await adminPage();
  const sp = await searchParams;
  const q = one(sp.q)?.trim() ?? "";
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const where = q
    ? {
        OR: [
          { action: { contains: q, mode: "insensitive" as const } },
          { entityType: { contains: q, mode: "insensitive" as const } },
          { entityId: q },
        ],
      }
    : {};
  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { actor: { select: { name: true } } },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const href = (p: number) => `/admin/audit?${new URLSearchParams({ q, page: String(p) })}`;
  return (
    <>
      <PageTitle title="Audit logs" sub={`${total} entries · passwords and secrets are never recorded`} />
      <form className="mb-4 flex gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder="Filter by action, entity type or entity id" aria-label="Filter audit log" />
        <button className={buttonVariants()}>Filter</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="No entries" />
      ) : (
        <div className="border-line overflow-x-auto rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-muted text-xs uppercase">
              <tr>
                <th className="p-3">When (Manila)</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-line border-t align-top">
                  <td className="tabular p-3 whitespace-nowrap">{formatDateTime(r.createdAt, "Asia/Manila", { timeStyle: "medium" })}</td>
                  <td>{r.actor?.name ?? "system / public"}</td>
                  <td className="font-semibold">{r.action}</td>
                  <td className="text-muted text-xs">
                    {r.entityType}
                    <br />
                    {r.entityId.slice(0, 8)}
                  </td>
                  <td className="text-muted max-w-xs text-xs break-words">
                    {r.next ? JSON.stringify(r.next).slice(0, 160) : ""}
                    {r.previous ? ` ← ${JSON.stringify(r.previous).slice(0, 100)}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <nav aria-label="Pagination" className="mt-6 flex items-center justify-between">
        {page > 1 ? (
          <Link className={buttonVariants({ variant: "secondary" })} href={href(page - 1)}>
            ← Newer
          </Link>
        ) : (
          <span />
        )}
        <span className="text-muted text-sm">
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Link className={buttonVariants({ variant: "secondary" })} href={href(page + 1)}>
            Older →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}
