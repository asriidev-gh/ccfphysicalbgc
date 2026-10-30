"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Loader2 } from "lucide-react";
import { registerAction } from "@/app/actions/register";
import { Button, Card, CardBody, Field, Input } from "@/components/ui";
import { SportIcon } from "@/components/sport-icon";
import { cn } from "@/lib/utils";

interface Act {
  id: string;
  name: string;
  description: string;
  icon: string;
  left: number | null;
  closed: boolean;
  waitlist: boolean;
  disabled: boolean;
}

// Client-side validation is a convenience only; the server re-validates everything.
const infoSchema = z
  .object({
    fullName: z.string().trim().min(2, "Please enter your full name").max(100),
    email: z.string().trim().email("Enter a valid email").or(z.literal("")),
    mobile: z.string().trim().max(30).or(z.literal("")),
    affiliation: z.string().trim().max(100).optional(),
    website: z.string().optional(), // honeypot, kept hidden
  })
  .refine((v) => v.email || v.mobile, { message: "Provide an email or a mobile number", path: ["email"] });
type Info = z.infer<typeof infoSchema>;

const STEPS = ["Your details", "Activities", "Review"];

export function RegisterWizard({ eventSlug, activities, allowMultiple }: { eventSlug: string; activities: Act[]; allowMultiple: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [fit, setFit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const form = useForm<Info>({
    resolver: zodResolver(infoSchema),
    defaultValues: { fullName: "", email: "", mobile: "", affiliation: "", website: "" },
    mode: "onTouched",
  });
  const {
    register,
    formState: { errors },
    trigger,
    getValues,
  } = form;

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : allowMultiple ? [...cur, id] : [id]));
  const next = async () => {
    setError(null);
    if (step === 0 && !(await trigger())) return;
    if (step === 1 && selected.length === 0) return setError("Choose at least one activity.");
    setStep((s) => s + 1);
  };

  const submit = () => {
    setError(null);
    setFieldErrors({});
    if (!consent || !fit) return setError("Please accept both confirmations to continue.");
    const v = getValues();
    start(async () => {
      try {
        const r = await registerAction(eventSlug, {
          fullName: v.fullName,
          email: v.email || undefined,
          mobile: v.mobile || undefined,
          affiliation: v.affiliation || undefined,
          website: v.website,
          activityIds: selected,
          consent,
          eligibilityConfirmed: fit,
        });
        if (r.ok) router.push(`/registration/${r.data.reference}`);
        else {
          setError(r.error);
          if (r.fieldErrors) {
            setFieldErrors(r.fieldErrors);
            if (r.fieldErrors.fullName || r.fieldErrors.email || r.fieldErrors.mobile) setStep(0);
          }
        }
      } catch {
        setError("Network error. Your registration was not saved; please check your connection and try again.");
      }
    });
  };

  return (
    <div>
      <ol className="mb-6 flex gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? "step" : undefined}
            className={cn(
              "flex-1 border-t-4 pt-2 text-xs font-semibold tracking-wide uppercase",
              i <= step ? "border-brand text-fg" : "border-line text-muted",
            )}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <form noValidate onSubmit={(e) => e.preventDefault()} className="space-y-4">
        {/* Step 1 stays mounted so values persist; hidden via the hidden attribute. */}
        <div hidden={step !== 0} className="space-y-4">
          <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message ?? fieldErrors.fullName}>
            <Input id="fullName" autoComplete="name" {...register("fullName")} />
          </Field>
          <Field
            label="Email"
            htmlFor="email"
            error={errors.email?.message ?? fieldErrors.email}
            hint="Email or mobile is required. You will use it to find your registration."
          >
            <Input id="email" type="email" inputMode="email" autoComplete="email" {...register("email")} />
          </Field>
          <Field label="Mobile number" htmlFor="mobile" error={errors.mobile?.message ?? fieldErrors.mobile}>
            <Input id="mobile" type="tel" inputMode="tel" autoComplete="tel" placeholder="09XX XXX XXXX" {...register("mobile")} />
          </Field>
          <Field label="Small group / affiliation (optional)" htmlFor="affiliation">
            <Input id="affiliation" {...register("affiliation")} />
          </Field>
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Website
              <input tabIndex={-1} autoComplete="off" {...register("website")} />
            </label>
          </div>
        </div>

        {step === 1 && (
          <fieldset>
            <legend className="text-muted mb-2 text-sm">
              {allowMultiple ? "Select every activity you want to join." : "Select one activity."}
            </legend>
            <div className="grid gap-2">
              {activities.map((a) => {
                const on = selected.includes(a.id);
                return (
                  <button
                    type="button"
                    key={a.id}
                    disabled={a.disabled}
                    aria-pressed={on}
                    onClick={() => toggle(a.id)}
                    className={cn(
                      "flex min-h-16 items-center gap-3 rounded-md border p-3 text-left transition-colors disabled:opacity-50",
                      on ? "border-brand bg-brand/10" : "border-line bg-surface hover:bg-surface-2",
                    )}
                  >
                    <span className="bg-surface-2 text-brand grid size-10 shrink-0 place-items-center rounded-md">
                      {on ? <Check className="size-5" aria-hidden /> : <SportIcon name={a.icon} className="size-5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{a.name}</span>
                      <span className="text-muted block text-xs">
                        {a.closed
                          ? "Registration closed"
                          : a.disabled
                            ? "Full"
                            : a.waitlist
                              ? "Full: you will be added to the waitlist"
                              : a.left !== null
                                ? `${a.left} spots left`
                                : "Open"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <Card>
            <CardBody className="space-y-3 text-sm">
              <Row k="Name" v={getValues("fullName")} />
              <Row k="Email" v={getValues("email") || "—"} />
              <Row k="Mobile" v={getValues("mobile") || "—"} />
              <Row
                k="Activities"
                v={activities
                  .filter((a) => selected.includes(a.id))
                  .map((a) => a.name + (a.waitlist ? " (waitlist)" : ""))
                  .join(", ")}
              />
              <label className="flex items-start gap-3 pt-2">
                <input
                  type="checkbox"
                  checked={fit}
                  onChange={(e) => setFit(e.target.checked)}
                  className="mt-1 size-5 accent-[var(--brand)]"
                />
                <span>I confirm that I am healthy and fit to take part in physical activities, and I participate at my own risk.</span>
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 size-5 accent-[var(--brand)]"
                />
                <span>
                  I agree that CCF BGC Sports Ministry may store my details to run this event, and display my name and results on the public
                  leaderboard.
                </span>
              </label>
            </CardBody>
          </Card>
        )}

        {error && (
          <p role="alert" className="border-bad/40 bg-bad/10 text-bad rounded-md border p-3 text-sm">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          {step > 0 && (
            <Button type="button" variant="secondary" size="lg" onClick={() => setStep(step - 1)} disabled={pending}>
              Back
            </Button>
          )}
          {step < 2 ? (
            <Button type="button" size="lg" className="flex-1" onClick={next}>
              Continue
            </Button>
          ) : (
            <Button type="button" size="lg" className="flex-1" onClick={submit} disabled={pending}>
              {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
              Confirm registration
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-line flex justify-between gap-4 border-b pb-2">
      <span className="text-muted">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}
