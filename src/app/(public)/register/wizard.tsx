"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Loader2, Upload, UserRound } from "lucide-react";
import { registerAction } from "@/app/actions/register";
import { Button, Card, CardBody, Field, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

// Client-side validation is a convenience only; the server re-validates everything.
const infoSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().min(1, "Please enter your email").email("Enter a valid email"),
  gender: z.enum(["MALE", "FEMALE"], { error: "Please select your gender" }),
  website: z.string().optional(), // honeypot, kept hidden
});
type Info = z.infer<typeof infoSchema>;

const STEPS = ["Your details", "Review"];

/** Centre-crop to a square and shrink to a small JPEG so the upload stays around 30-60 KB. */
async function toSquareJpeg(file: File, size = 400): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("unreadable"));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.min(size, side);
    canvas
      .getContext("2d")!
      .drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function RegisterWizard({ eventSlug }: { eventSlug: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [consent, setConsent] = useState(false);
  const [fit, setFit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const form = useForm<Info>({
    resolver: zodResolver(infoSchema),
    defaultValues: { fullName: "", email: "", gender: undefined, website: "" },
    mode: "onTouched",
  });
  const {
    register,
    formState: { errors },
    trigger,
    getValues,
  } = form;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPhoto(await toSquareJpeg(file));
      setPhotoError(null);
    } catch {
      setPhotoError("That file could not be read as a photo. Please try another.");
    }
  };

  const next = async () => {
    setError(null);
    const valid = await trigger();
    if (step === 0 && !photo) setPhotoError("Please add your photo.");
    if (step === 0 && (!valid || !photo)) return;
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
          email: v.email,
          gender: v.gender,
          website: v.website,
          photo,
          consent,
          eligibilityConfirmed: fit,
        });
        if (r.ok) router.push(`/registration/${r.data.reference}`);
        else {
          setError(r.error);
          if (r.fieldErrors) {
            setFieldErrors(r.fieldErrors);
            if (r.fieldErrors.fullName || r.fieldErrors.email || r.fieldErrors.gender || r.fieldErrors.photo) setStep(0);
            if (r.fieldErrors.photo) setPhotoError(r.fieldErrors.photo);
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
            hint="You will use it to find your registration."
          >
            <Input id="email" type="email" inputMode="email" autoComplete="email" {...register("email")} />
          </Field>
          <Field label="Gender" htmlFor="gender-male" error={errors.gender?.message ?? fieldErrors.gender}>
            <div className="flex gap-3" role="radiogroup" aria-label="Gender">
              {(["MALE", "FEMALE"] as const).map((g) => (
                <label
                  key={g}
                  className="border-line bg-surface-2 has-[:checked]:border-brand has-[:checked]:bg-brand/15 flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold"
                >
                  <input id={`gender-${g.toLowerCase()}`} type="radio" value={g} className="sr-only" {...register("gender")} />
                  {g === "MALE" ? "Male" : "Female"}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Your photo" htmlFor="photo-camera" error={photoError ?? undefined} hint="So the booth staff can recognise you.">
            <div className="flex items-center gap-4">
              <div className="border-line bg-surface-2 text-muted grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a local data URL preview
                  <img src={photo} alt="Your photo" className="size-full object-cover" />
                ) : (
                  <UserRound className="size-10" aria-hidden />
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="secondary" onClick={() => cameraRef.current?.click()}>
                  <Camera className="size-4" aria-hidden /> {photo ? "Retake photo" : "Take a photo"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => uploadRef.current?.click()}>
                  <Upload className="size-4" aria-hidden /> Upload photo
                </Button>
              </div>
              <input
                ref={cameraRef}
                id="photo-camera"
                type="file"
                accept="image/*"
                capture="user"
                className="sr-only"
                onChange={(e) => {
                  void pick(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <input
                ref={uploadRef}
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  void pick(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          </Field>
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Website
              <input tabIndex={-1} autoComplete="off" {...register("website")} />
            </label>
          </div>
        </div>

        {step === 1 && (
          <Card>
            <CardBody className="space-y-3 text-sm">
              <Row k="Name" v={getValues("fullName")} />
              <Row k="Email" v={getValues("email")} />
              <Row k="Gender" v={getValues("gender") === "FEMALE" ? "Female" : "Male"} />
              <Row k="Activities" v="Show your QR code at any booth you want to join." />
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
          {step < 1 ? (
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
