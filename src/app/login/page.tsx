import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor, homeFor } from "@/lib/auth/session";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";
import { Card, CardBody } from "@/components/ui";

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
            CCF <span className="text-brand">BGC</span> SPORTS
          </span>
        </Link>
        <Card>
          <CardBody>
            <h1 className="font-display mb-4 text-xl font-semibold">Staff sign in</h1>
            <LoginForm />
          </CardBody>
        </Card>
        <p className="text-muted mt-4 text-center text-xs">Activity leads and administrators only. Participants do not need an account.</p>
      </div>
    </main>
  );
}
