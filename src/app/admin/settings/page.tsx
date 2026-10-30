import { db } from "@/lib/db";
import { Badge, Card, CardBody, CardHeader, CardTitle, PageTitle } from "@/components/ui";
import { adminPage } from "../_lib";

export const metadata = { title: "System settings" };

export default async function SettingsPage() {
  const actor = await adminPage();
  let dbOk = true;
  let dbTime = "";
  try {
    const r = await db.$queryRaw<{ now: Date }[]>`SELECT now() AS now`;
    dbTime = r[0].now.toISOString();
  } catch {
    dbOk = false;
  }
  const [users, sessions] = await Promise.all([
    db.user.count({ where: { active: true } }),
    db.session.count({ where: { expiresAt: { gt: new Date() } } }),
  ]);
  const env = process.env;
  const rows: [string, boolean, string][] = [
    ["Database connection", dbOk, dbOk ? `Server time ${dbTime}` : "Cannot reach PostgreSQL"],
    [
      "APP_SECRET configured",
      Boolean(env.APP_SECRET) && env.APP_SECRET !== "change-me-generate-a-long-random-string",
      "Required in production",
    ],
    [
      "Direct DB URL for real-time (DIRECT_URL)",
      Boolean(env.DIRECT_URL) || !/pooler|:6543/.test(env.DATABASE_URL ?? ""),
      "Needed when DATABASE_URL is a pooled connection (Supabase)",
    ],
    ["NEXT_PUBLIC_APP_URL set", Boolean(env.NEXT_PUBLIC_APP_URL), env.NEXT_PUBLIC_APP_URL ?? "Used for QR codes"],
    ["Secure cookies", env.NODE_ENV === "production", env.NODE_ENV ?? ""],
  ];
  return (
    <>
      <PageTitle title="System settings" sub="Operational health. Secrets are never displayed." />
      <Card>
        <CardHeader>
          <CardTitle>Health checks</CardTitle>
        </CardHeader>
        <CardBody>
          <ul className="divide-line divide-y">
            {rows.map(([label, ok, note]) => (
              <li key={label} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>
                  {label}
                  <span className="text-muted block text-xs">{note}</span>
                </span>
                <Badge tone={ok ? "ok" : "warn"}>{ok ? "OK" : "Check"}</Badge>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Access</CardTitle>
        </CardHeader>
        <CardBody className="text-sm">
          <p>
            Signed in as <strong>{actor.name}</strong> ({actor.role}). {users} active accounts, {sessions} live sessions.
          </p>
          <p className="text-muted mt-2">
            Accounts and passwords are managed under Activity Leads. Sessions last 12 hours and are revoked when an account is deactivated
            or its password is reset.
          </p>
        </CardBody>
      </Card>
    </>
  );
}
