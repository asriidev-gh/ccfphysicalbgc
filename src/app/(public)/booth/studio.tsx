"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, FlipHorizontal, ImagePlus, Loader2, Minus, Plus, RefreshCw, RotateCw, Share2, Trash2, Upload } from "lucide-react";
import { Button, buttonVariants, Input } from "@/components/ui";
import { BOOTH_TEMPLATES, type BoothTemplate } from "@/lib/booth/templates";
import { renderTemplate, toJpeg, whenLogoReady, type Shot } from "@/lib/booth/render";
import {
  hitHandle,
  hitSticker,
  newSticker,
  registerStickerFonts,
  STICKER_CATALOG,
  stickerUnit,
  type Sticker,
  type StickerDef,
  type StickerFont,
  type StickerGroup,
} from "@/lib/booth/stickers";
import { cn } from "@/lib/utils";
import { StickerThumb } from "./sticker-thumb";

const MAX_BYTES = 2_900_000;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Phase = "pick" | "shoot" | "review";
type Cam = "starting" | "ready" | "error";

const STEPS = ["Template", "Shots", "Publish"] as const;
const STEP_OF: Record<Phase, number> = { pick: 1, shoot: 2, review: 3 };

/** Three-step progress header. On phones only the current step shows its label, so it never wraps. */
function Stepper({ phase }: { phase: Phase }) {
  const step = STEP_OF[phase];
  return (
    <ol aria-label="Photobooth progress" className="mb-5 flex items-center">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < step ? "done" : n === step ? "current" : "todo";
        return (
          <li
            key={label}
            aria-current={state === "current" ? "step" : undefined}
            className={cn("flex items-center", n < STEPS.length && "flex-1")}
          >
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold",
                state === "done" && "bg-ok text-black",
                state === "current" && "bg-brand text-white",
                state === "todo" && "border-line text-muted border-2",
              )}
            >
              {state === "done" ? <Check className="size-4" aria-hidden /> : n}
            </span>
            <span className={cn("ml-2 text-sm font-semibold", state === "current" ? "text-fg" : "text-muted max-sm:sr-only")}>
              {label}
              <span className="sr-only">{state === "done" ? " (done)" : state === "current" ? " (current step)" : ""}</span>
            </span>
            {n < STEPS.length && <span aria-hidden className={cn("mx-3 h-0.5 flex-1 rounded-full", n < step ? "bg-ok" : "bg-line")} />}
          </li>
        );
      })}
    </ol>
  );
}

/** Primary actions stay pinned to the bottom of the screen so the thumb never has to hunt for them. */
const ACTION_BAR =
  "border-line bg-bg/95 sticky bottom-0 z-10 -mx-4 mt-4 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur";

function TemplatePreview({ t }: { t: BoothTemplate }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    void whenLogoReady().then(() => {
      if (live && ref.current) renderTemplate(ref.current, t, []);
    });
    return () => {
      live = false;
    };
  }, [t]);
  return <canvas ref={ref} aria-hidden className="mx-auto h-auto max-h-44 w-auto max-w-full rounded-sm" />;
}

export function BoothStudio({ fonts }: { fonts: Partial<Record<StickerFont, string>> }) {
  // Register once, before the template previews (child effects) first draw lettering.
  useState(() => {
    registerStickerFonts(fonts);
    return null;
  });
  const [group, setGroup] = useState<StickerGroup>("faith");
  const [values, setValues] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>("pick");
  const [template, setTemplate] = useState<BoothTemplate | null>(null);
  const [shots, setShots] = useState<(Shot | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const [queue, setQueue] = useState<number[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [running, setRunning] = useState(false);
  const [cam, setCam] = useState<Cam>("starting");
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [busy, setBusy] = useState<"post" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runningRef = useRef(false);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | { kind: "drag"; dx: number; dy: number }
    | { kind: "pinch"; dist: number; angle: number; size: number; rot: number }
    | { kind: "rotate"; cx: number; cy: number; angle: number; rot: number }
    | { kind: "resize"; cx: number; cy: number; dist: number; size: number }
    | null
  >(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  }, []);

  const attach = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => undefined);
    }
  }, []);

  const startCamera = useCallback(
    async (mode: "user" | "environment") => {
      stopCamera();
      setCam("starting");
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
        setCam("ready");
      } catch {
        setCam("error");
      }
    },
    [stopCamera],
  );

  // Never leave the camera light on after leaving the page.
  useEffect(
    () => () => {
      runningRef.current = false;
      stopCamera();
    },
    [stopCamera],
  );

  // The review canvas is redrawn whenever the shots change.
  useEffect(() => {
    if (phase !== "review" || !template) return;
    let live = true;
    void whenLogoReady().then(() => {
      if (live && previewRef.current) renderTemplate(previewRef.current, template, shots, { stickers, selectedId, text: values });
    });
    return () => {
      live = false;
    };
  }, [phase, template, shots, stickers, selectedId, values]);

  function beginShoot(t: BoothTemplate, indexes: number[]) {
    setTemplate(t);
    setError(null);
    setQueue(indexes);
    setCurrent(indexes[0] ?? 0);
    setPhase("shoot");
    void startCamera(facing);
  }

  function choose(t: BoothTemplate) {
    setValues({});
    setShots(Array(t.slots.length).fill(null));
    setStickers([]);
    setSelectedId(null);
    beginShoot(
      t,
      t.slots.map((_, i) => i),
    );
  }

  function capture(i: number) {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    if (facing === "user") {
      // Selfie view is mirrored on screen, so the saved photo matches what people saw.
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0);
    setShots((prev) => prev.map((s, k) => (k === i ? c : s)));
  }

  async function run() {
    if (running || cam !== "ready") return;
    runningRef.current = true;
    setRunning(true);
    for (const idx of queue) {
      setCurrent(idx);
      for (let c = 3; c > 0; c--) {
        setCount(c);
        await wait(1000);
        if (!runningRef.current) return;
      }
      setCount(null);
      setFlash(true);
      capture(idx);
      setTimeout(() => setFlash(false), 180);
      await wait(900);
      if (!runningRef.current) return;
    }
    runningRef.current = false;
    setRunning(false);
    stopCamera();
    setPhase("review");
  }

  /** No camera (denied, or an in-app browser): take each shot with the phone's own camera app instead. */
  function fromFile(file: File | undefined) {
    if (!file || !template) return;
    const img = new Image();
    img.onload = () => {
      const idx = queue[0];
      setShots((prev) => prev.map((s, k) => (k === idx ? img : s)));
      const rest = queue.slice(1);
      setQueue(rest);
      if (rest.length === 0) setPhase("review");
      else setCurrent(rest[0]);
    };
    img.onerror = () => setError("That photo could not be read. Please try another one.");
    img.src = URL.createObjectURL(file);
  }

  function cancelShoot() {
    runningRef.current = false;
    setRunning(false);
    setCount(null);
    stopCamera();
    setPhase(shots.every(Boolean) ? "review" : "pick");
  }

  function flip() {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    void startCamera(next);
  }

  async function makeBlob() {
    if (!template) return null;
    // Export without the dashed selection outline.
    const canvas = document.createElement("canvas");
    renderTemplate(canvas, template, shots, { stickers, text: values });
    const blob = await toJpeg(canvas, MAX_BYTES);
    if (!blob) setError("The photo is too large to save. Please retake it.");
    return blob;
  }

  async function save() {
    setBusy("save");
    setError(null);
    try {
      const blob = await makeBlob();
      if (!blob) return;
      const file = new File([blob], "ccfbgc-photobooth.jpg", { type: "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] }).catch(() => undefined);
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setBusy(null);
    }
  }

  async function post() {
    if (!template) return;
    setBusy("post");
    let redirecting = false;
    setError(null);
    try {
      const blob = await makeBlob();
      if (!blob) return;
      const res = await fetch("/api/booth", {
        method: "POST",
        headers: { "content-type": "image/jpeg", "x-template": template.id },
        body: blob,
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string } | null;
      if (!res.ok || !json?.ok || !json.url) {
        setError(json?.error ?? "Could not post your photo. Please try again.");
        return;
      }
      redirecting = true;
      stopCamera();
      router.push("/booth?sort=new&posted=1");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      if (!redirecting) setBusy(null);
    }
  }

  const selected = stickers.find((s) => s.id === selectedId) ?? null;

  function addSticker(def: StickerDef) {
    if (!template) return;
    const s = newSticker(def, template.width, template.height);
    setStickers((prev) => [...prev, s]);
    setSelectedId(s.id);
  }

  function patchSelected(fn: (s: Sticker) => Sticker) {
    setStickers((prev) => prev.map((s) => (s.id === selectedId ? fn(s) : s)));
  }

  function canvasPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = e.currentTarget;
    const rect = c.getBoundingClientRect();
    const k = c.width / rect.width;
    return { x: (e.clientX - rect.left) * k, y: (e.clientY - rect.top) * k };
  }

  function pinchValues() {
    const [a, b] = [...pointers.current.values()];
    return { dist: Math.hypot(b.x - a.x, b.y - a.y) || 1, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = canvasPoint(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2 && selected) {
      gesture.current = { kind: "pinch", ...pinchValues(), size: selected.size, rot: selected.rot };
      return;
    }
    if (pointers.current.size !== 1) return;
    if (selected && template) {
      const handle = hitHandle(selected, p.x, p.y, stickerUnit(template.width));
      if (handle === "delete") {
        setStickers((prev) => prev.filter((s) => s.id !== selected.id));
        setSelectedId(null);
        pointers.current.clear();
        return;
      }
      if (handle === "rotate") {
        gesture.current = {
          kind: "rotate",
          cx: selected.x,
          cy: selected.y,
          angle: Math.atan2(p.y - selected.y, p.x - selected.x),
          rot: selected.rot,
        };
        return;
      }
      if (handle === "resize") {
        gesture.current = {
          kind: "resize",
          cx: selected.x,
          cy: selected.y,
          dist: Math.hypot(p.x - selected.x, p.y - selected.y) || 1,
          size: selected.size,
        };
        return;
      }
    }
    const hit = [...stickers].reverse().find((s) => hitSticker(s, p.x, p.y));
    if (hit) {
      setSelectedId(hit.id);
      gesture.current = { kind: "drag", dx: hit.x - p.x, dy: hit.y - p.y };
    } else {
      setSelectedId(null);
      gesture.current = null;
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!pointers.current.has(e.pointerId) || !selectedId || !template) return;
    const p = canvasPoint(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch" && pointers.current.size >= 2) {
      const { dist, angle } = pinchValues();
      const size = Math.min(Math.max((g.size * dist) / g.dist, template.width * 0.05), template.width * 0.8);
      patchSelected((s) => ({ ...s, size, rot: g.rot + angle - g.angle }));
    } else if (g.kind === "drag") {
      patchSelected((s) => ({ ...s, x: p.x + g.dx, y: p.y + g.dy }));
    } else if (g.kind === "rotate") {
      const angle = Math.atan2(p.y - g.cy, p.x - g.cx);
      patchSelected((s) => ({ ...s, rot: g.rot + angle - g.angle }));
    } else if (g.kind === "resize") {
      const size = Math.min(Math.max((g.size * Math.hypot(p.x - g.cx, p.y - g.cy)) / g.dist, template.width * 0.05), template.width * 0.8);
      patchSelected((s) => ({ ...s, size }));
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(e.pointerId);
    gesture.current = null;
  }

  function reset() {
    setValues({});
    setStickers([]);
    setSelectedId(null);
    setPhase("pick");
    setTemplate(null);
    setShots([]);
    setError(null);
  }

  if (phase === "pick" || !template) {
    return (
      <div>
        <Stepper phase="pick" />
        <h2 className="font-display text-2xl font-bold">Choose a template</h2>
        <p className="text-muted mt-1 mb-5 text-sm">Tap a layout to start. You get a 3-2-1 countdown before every shot.</p>
        {[
          { title: "Sports party layouts", list: BOOTH_TEMPLATES.filter((t) => t.scene) },
          { title: "Sports prop frames", list: BOOTH_TEMPLATES.filter((t) => t.prop) },
          { title: "Party frames", list: BOOTH_TEMPLATES.filter((t) => t.overlay) },
          { title: "Sports posters", list: BOOTH_TEMPLATES.filter((t) => t.poster) },
          { title: "Party & wedding strips", list: BOOTH_TEMPLATES.filter((t) => t.event) },
          { title: "Trading cards", list: BOOTH_TEMPLATES.filter((t) => t.card) },
          { title: "Sport cards", list: BOOTH_TEMPLATES.filter((t) => t.sport?.variant === "card") },
          { title: "Sport collages", list: BOOTH_TEMPLATES.filter((t) => t.sport && t.sport.variant !== "card") },
          {
            title: "Classic layouts",
            list: BOOTH_TEMPLATES.filter((t) => !t.sport && !t.card && !t.poster && !t.event && !t.overlay && !t.scene && !t.prop),
          },
        ].map((g) => (
          <section key={g.title} className="mb-6">
            <h2 className="font-display mb-2 text-xl font-bold">{g.title}</h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {g.list.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => choose(t)}
                    className="border-line bg-surface hover:border-brand focus-visible:border-brand block w-full rounded-md border p-3 text-center transition-colors"
                  >
                    <TemplatePreview t={t} />
                    <span className="font-display mt-2 block text-lg leading-tight font-bold">{t.name}</span>
                    <span className="text-muted block text-xs">{t.blurb}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  const total = template.slots.length;
  const slot = template.slots[Math.min(current, total - 1)];

  if (phase === "shoot") {
    return (
      <div className="mx-auto max-w-md">
        <Stepper phase="shoot" />
        <p className="font-display mb-2 text-center text-xl font-bold" aria-live="polite">
          Shot {current + 1} of {total}
        </p>
        {cam === "error" ? (
          <div className="border-line bg-surface rounded-md border p-4 text-center">
            <p className="text-sm">
              We could not open the camera. Allow camera access in your browser, or open this page in Safari or Chrome. You can also take
              each shot with your phone&apos;s camera instead.
            </p>
            <label className={cn(buttonVariants({ size: "lg" }), "mt-4 w-full cursor-pointer")}>
              <ImagePlus className="size-5" aria-hidden /> Take photo {current + 1}
              <input
                type="file"
                accept="image/*"
                capture="user"
                className="sr-only"
                onChange={(e) => {
                  fromFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <Button variant="secondary" className="mt-2 w-full" onClick={() => void startCamera(facing)}>
              <RefreshCw className="size-4" aria-hidden /> Try the camera again
            </Button>
          </div>
        ) : (
          <div
            className="relative mx-auto max-h-[62vh] overflow-hidden rounded-md bg-black"
            style={{ aspectRatio: `${slot.w} / ${slot.h}` }}
          >
            <video ref={attach} playsInline muted autoPlay className={cn("size-full object-cover", facing === "user" && "-scale-x-100")} />
            {cam === "starting" && (
              <div className="absolute inset-0 grid place-items-center bg-black/60">
                <Loader2 className="size-8 animate-spin" aria-hidden />
              </div>
            )}
            {count !== null && (
              <div
                aria-hidden
                className="font-display absolute inset-0 grid place-items-center text-9xl font-bold text-white drop-shadow-lg"
              >
                {count}
              </div>
            )}
            {flash && <div aria-hidden className="absolute inset-0 bg-white" />}
          </div>
        )}
        {error && (
          <p role="alert" className="text-bad mt-2 text-center text-sm">
            {error}
          </p>
        )}
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden>
          {template.slots.map((_, i) => (
            <span
              key={i}
              className={cn("size-2.5 rounded-full", shots[i] && !queue.includes(i) ? "bg-ok" : i === current ? "bg-brand" : "bg-line")}
            />
          ))}
        </div>
        {cam !== "error" && (
          <div className={cn(ACTION_BAR, "flex gap-2")}>
            <Button size="lg" className="flex-1" disabled={running || cam !== "ready"} onClick={() => void run()}>
              <Camera className="size-5" aria-hidden />
              {running ? "Pose!" : queue.length > 1 ? `Start ${queue.length} shots` : "Take photo"}
            </Button>
            <Button size="lg" variant="secondary" aria-label="Switch camera" disabled={running} onClick={flip}>
              <FlipHorizontal className="size-5" aria-hidden />
            </Button>
          </div>
        )}
        <Button variant="ghost" className="mt-2 w-full" onClick={cancelShoot}>
          {shots.every(Boolean) ? "Back to preview" : "Choose another template"}
        </Button>
      </div>
    );
  }

  if (phase === "review") {
    return (
      <div className="mx-auto max-w-md">
        <Stepper phase="review" />
        <canvas
          ref={previewRef}
          className={cn("mx-auto max-h-[65vh] w-auto max-w-full rounded-md", stickers.length > 0 && "touch-none")}
          aria-label="Your photobooth result"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {template.fields && (
          <section aria-label="Text on the photo" className="mt-4 grid gap-2">
            {template.fields.map((f) => (
              <label key={f.key} className="text-sm font-semibold">
                {f.label}
                <Input
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  maxLength={f.max}
                  placeholder={f.placeholder}
                  className="mt-1"
                />
              </label>
            ))}
          </section>
        )}
        <section aria-label="Stickers" className="mt-4">
          <p className="text-muted mb-2 text-xs">
            Tap a sticker to add it. Drag to move. Use the corner buttons to delete (red), rotate (blue) and resize (green), or pinch with
            two fingers.
          </p>
          <div className="mb-2 flex gap-2" role="tablist" aria-label="Sticker packs">
            {(
              [
                ["faith", "Faith"],
                ["sport", "Sports"],
                ["fun", "Props & fun"],
              ] as const
            ).map(([g, label]) => (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={group === g}
                onClick={() => setGroup(g)}
                className={cn(
                  "min-h-9 rounded-md px-3 text-xs font-semibold",
                  group === g ? "bg-brand text-white" : "bg-surface-2 text-muted hover:text-fg",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="border-line bg-surface grid max-h-60 grid-cols-3 gap-2 overflow-y-auto rounded-md border p-2 sm:grid-cols-4">
            {STICKER_CATALOG.filter((d) => d.group === group).map((def) => (
              <button
                key={`${def.kind}:${def.text}`}
                type="button"
                aria-label={`Add sticker ${def.text.replace(/\n/g, " ")}`}
                onClick={() => addSticker(def)}
                className={cn(
                  "bg-surface-2 hover:bg-line grid min-h-14 place-items-center rounded-md px-1 py-1 font-bold",
                  def.kind === "emoji" ? "text-2xl" : "text-xs",
                )}
                style={def.kind === "badge" ? { background: def.color, color: def.ink } : undefined}
              >
                {def.kind === "emoji" || def.kind === "badge" ? def.text.replace(/\n/g, " ") : <StickerThumb def={def} />}
              </button>
            ))}
          </div>
          {selected && (
            <div className="mt-1 flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                aria-label="Make sticker smaller"
                onClick={() => patchSelected((s) => ({ ...s, size: s.size * 0.85 }))}
              >
                <Minus className="size-4" aria-hidden />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                aria-label="Make sticker bigger"
                onClick={() => patchSelected((s) => ({ ...s, size: s.size * 1.18 }))}
              >
                <Plus className="size-4" aria-hidden />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                aria-label="Rotate sticker"
                onClick={() => patchSelected((s) => ({ ...s, rot: s.rot + Math.PI / 12 }))}
              >
                <RotateCw className="size-4" aria-hidden />
              </Button>
              <Button
                size="sm"
                variant="danger"
                aria-label="Remove sticker"
                onClick={() => {
                  setStickers((prev) => prev.filter((s) => s.id !== selectedId));
                  setSelectedId(null);
                }}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          )}
        </section>
        {error && (
          <p role="alert" className="text-bad mt-3 text-center text-sm">
            {error}
          </p>
        )}
        <div className={cn(ACTION_BAR, "flex gap-2")}>
          <Button size="lg" className="flex-1" disabled={busy !== null} onClick={() => void post()}>
            {busy === "post" ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Upload className="size-5" aria-hidden />}
            {busy === "post" ? "Publishing…" : "Publish to gallery"}
          </Button>
          <Button size="lg" variant="secondary" aria-label="Save to my phone" disabled={busy !== null} onClick={() => void save()}>
            {busy === "save" ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Share2 className="size-5" aria-hidden />}
          </Button>
        </div>
        <p className="text-muted mt-4 text-center text-xs">Not happy with a shot?</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {template.slots.map((_, i) => (
            <Button key={i} size="sm" variant="secondary" disabled={busy !== null} onClick={() => beginShoot(template, [i])}>
              Retake {total > 1 ? i + 1 : "photo"}
            </Button>
          ))}
          {total > 1 && (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy !== null}
              onClick={() =>
                beginShoot(
                  template,
                  template.slots.map((_, i) => i),
                )
              }
            >
              Retake all
            </Button>
          )}
        </div>
        <Button variant="ghost" className="mt-2 w-full" disabled={busy !== null} onClick={reset}>
          Choose another template
        </Button>
      </div>
    );
  }
}
