"use client";

import { useRouter } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { ActionForm } from "@/components/action-form";
import { Field, Input } from "@/components/ui";

/** Sign-in form. The action returns the destination and we navigate here, so no error flashes mid-redirect. */
export function LoginForm() {
  const router = useRouter();
  return (
    <ActionForm
      action={loginAction}
      submitLabel="Sign in"
      size="lg"
      buttonClassName="w-full"
      onDone={(to) => typeof to === "string" && router.replace(to)}
    >
      <div className="space-y-4">
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="username" required />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
      </div>
    </ActionForm>
  );
}
