"use client";

import { useRouter } from "next/navigation";
import { lookupAction } from "@/app/actions/register";
import { ActionForm } from "@/components/action-form";
import { Card, CardBody, Field, Input, PageTitle } from "@/components/ui";

export default function FindPage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <PageTitle title="My registration" sub="View your QR code and your results." />
      <Card>
        <CardBody>
          <ActionForm
            action={lookupAction}
            submitLabel="Find my registration"
            size="lg"
            buttonClassName="w-full"
            onDone={(d) => router.push(`/registration/${(d as { reference: string }).reference}`)}
          >
            <div className="space-y-4">
              <Field label="Registration code" htmlFor="reference">
                <Input id="reference" name="reference" required placeholder="CCFBGC-0000" autoCapitalize="characters" />
              </Field>
              <Field label="Email or mobile used to register" htmlFor="contact">
                <Input id="contact" name="contact" required />
              </Field>
            </div>
          </ActionForm>
        </CardBody>
      </Card>
    </div>
  );
}
