import { db } from "@/lib/db";
import { createUserAction, updateUserAction } from "@/app/actions/admin";
import { ActionButton } from "@/components/action-button";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, CardBody, CardHeader, CardTitle, Field, Input, PageTitle, Select } from "@/components/ui";
import { adminPage } from "../_lib";

export const metadata = { title: "Activity leads" };

export default async function LeadsPage() {
  const actor = await adminPage();
  const users = await db.user.findMany({
    where: actor.role === "SUPER_ADMIN" ? {} : { role: "ACTIVITY_LEAD" },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    include: { assignments: { include: { activity: { select: { name: true, event: { select: { name: true } } } } } } },
  });
  return (
    <>
      <PageTitle
        title="Activity leads"
        sub="Create accounts for your leads, then assign them to activities. Assign from an activity's configuration page."
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
        </CardHeader>
        <CardBody>
          <ActionForm
            action={createUserAction}
            submitLabel="Create account"
            success="Account created. Share the password securely and ask them to keep it private."
            reset
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name">
                <Input name="name" required />
              </Field>
              <Field label="Email (used to sign in)">
                <Input name="email" type="email" required autoComplete="off" />
              </Field>
              <Field label="Role">
                <Select name="role" defaultValue="ACTIVITY_LEAD">
                  <option value="ACTIVITY_LEAD">Activity lead</option>
                  {actor.role === "SUPER_ADMIN" && (
                    <>
                      <option value="ADMIN">Admin</option>
                      <option value="SUPER_ADMIN">Super admin</option>
                    </>
                  )}
                </Select>
              </Field>
              <Field label="Temporary password" hint="At least 10 characters.">
                <Input name="password" type="password" required minLength={10} autoComplete="new-password" />
              </Field>
            </div>
          </ActionForm>
        </CardBody>
      </Card>

      <div className="space-y-3">
        {users.map((u) => (
          <Card key={u.id}>
            <CardHeader>
              <CardTitle>{u.name}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge tone={u.role === "ACTIVITY_LEAD" ? "accent" : "brand"}>{u.role.replace("_", " ")}</Badge>
                {!u.active && <Badge tone="bad">Deactivated</Badge>}
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-muted text-sm">{u.email}</p>
              <p className="text-sm">
                {u.assignments.length ? (
                  u.assignments.map((a) => a.activity.name).join(", ")
                ) : (
                  <span className="text-warn">{u.role === "ACTIVITY_LEAD" ? "Not assigned to any activity" : "—"}</span>
                )}
              </p>
              {u.id !== actor.id && (
                <div className="flex flex-wrap items-start gap-3">
                  <ActionButton
                    variant={u.active ? "danger" : "secondary"}
                    confirm={u.active ? `Deactivate ${u.name}? They are signed out immediately.` : undefined}
                    action={updateUserAction.bind(null, u.id, { active: !u.active })}
                  >
                    {u.active ? "Deactivate" : "Reactivate"}
                  </ActionButton>
                  <ActionForm
                    action={updateUserAction.bind(null, u.id, {})}
                    submitLabel="Reset password"
                    variant="secondary"
                    size="sm"
                    success="Password reset; user signed out."
                    reset
                    className="flex flex-wrap items-start gap-2"
                    buttonClassName="mt-0"
                  >
                    <Input
                      name="password"
                      type="password"
                      minLength={10}
                      required
                      placeholder="New password"
                      aria-label={`New password for ${u.name}`}
                      autoComplete="new-password"
                      className="w-52"
                    />
                  </ActionForm>
                </div>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
