import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor, homeFor } from "@/lib/auth/session";
import { loginAction } from "@/app/actions/auth";
import { ActionForm } from "@/components/action-form";
import { Logo } from "@/components/logo";
import { Card, CardBody, Field, Input } from "@/components/ui";

export const metadata = { title: "Staff sign in" };

export default async function LoginPage() {
  const actor = await getActor();
  if (actor) redirect(homeFor(actor.role));
  return (
    <main className="hero-glow grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-display mb-6 flex flex-col items-center gap-3 text-center text-3xl font-bold">
          <Logo size={88} />
          <span>
            CCF <span className="text-brand">BGC</span> PHYSICAL
          </span>
        </Link>
        <Card>
          <CardBody>
            <h1 className="font-display mb-4 text-xl font-semibold">Staff sign in</h1>
            <ActionForm action={loginAction} submitLabel="Sign in" size="lg" buttonClassName="w-full">
              <div className="space-y-4">
                <Field label="Email" htmlFor="email">
                  <Input id="email" name="email" type="email" autoComplete="username" required />
                </Field>
                <Field label="Password" htmlFor="password">
                  <Input id="password" name="password" type="password" autoComplete="current-password" required />
                </Field>
              </div>
            </ActionForm>
          </CardBody>
        </Card>
        <p className="text-muted mt-4 text-center text-xs">Activity leads and administrators only. Participants do not need an account.</p>
      </div>
    </main>
  );
}
