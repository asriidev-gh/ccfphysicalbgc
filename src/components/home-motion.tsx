"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

// Motion pieces for the public home page. Everything here is decorative and
// degrades to a static page when JS is off or the user prefers reduced motion.

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Warm dust drifting through the hero, echoing the poster's sand clouds. */
export function DustField({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || reducedMotion()) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const count = window.innerWidth < 640 ? 36 : 72;
    const spawn = (anywhere: boolean) => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h + 10,
      r: 0.6 + Math.random() * 2.2,
      vx: 0.05 + Math.random() * 0.25,
      vy: -(0.1 + Math.random() * 0.35),
      a: 0.15 + Math.random() * 0.5,
      hue: 15 + Math.random() * 25,
      phase: Math.random() * Math.PI * 2,
    });
    let dust: ReturnType<typeof spawn>[] = [];

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dust = Array.from({ length: count }, () => spawn(true));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let frame = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !frame) frame = requestAnimationFrame(tick);
    });
    io.observe(canvas);

    function tick(t: number) {
      frame = 0;
      if (!visible || !ctx) return;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const p of dust) {
        p.x += p.vx + Math.sin(t / 1400 + p.phase) * 0.15;
        p.y += p.vy;
        if (p.y < -10 || p.x > w + 10) Object.assign(p, spawn(false));
        const flicker = 0.75 + Math.sin(t / 600 + p.phase) * 0.25;
        ctx.fillStyle = `hsla(${p.hue}, 85%, 65%, ${p.a * flicker})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={className} />;
}

/** 3D tilt with a moving glare, driven by the pointer (fine pointers only). */
export function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse" || reducedMotion()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${(0.5 - y) * 12}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * 14}deg`);
    el.style.setProperty("--gx", `${x * 100}%`);
    el.style.setProperty("--gy", `${y * 100}%`);
    el.dataset.active = "";
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    delete el.dataset.active;
  };

  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className={`tilt ${className ?? ""}`}>
      {children}
      <span aria-hidden className="tilt-glare" />
    </div>
  );
}

/** Feeds the pointer position into `.spotlight` children so their borders glow under the cursor. */
export function SpotlightGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>(".spotlight");
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <div onPointerMove={onMove} className={className}>
      {children}
    </div>
  );
}

// One shared 1s clock for every countdown on the page.
function subscribeClock(cb: () => void) {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
}
const getNow = () => Math.floor(Date.now() / 1000);
const getServerNow = () => null;

function Digits({ value, label }: { value: number; label: string }) {
  const text = String(value).padStart(2, "0");
  return (
    <div className="countdown-cell">
      <span className="tabular font-display flex text-3xl leading-none font-bold sm:text-4xl" aria-hidden>
        {text.split("").map((d, i) => (
          // Keyed by digit so a change remounts the span and replays the roll-in.
          <span key={`${i}-${d}`} className="countdown-digit">
            {d}
          </span>
        ))}
      </span>
      <span className="text-muted mt-1 text-[0.65rem] tracking-widest uppercase" aria-hidden>
        {label}
      </span>
    </div>
  );
}

/** Live countdown to the event start; switches to a "live now" badge during the event. */
export function Countdown({ startsAt, endsAt }: { startsAt: string; endsAt: string }) {
  const now = useSyncExternalStore(subscribeClock, getNow, getServerNow);
  const start = Math.floor(new Date(startsAt).getTime() / 1000);
  const end = Math.floor(new Date(endsAt).getTime() / 1000);

  if (now === null) return <div className="h-[4.5rem]" aria-hidden />;
  if (now >= end) return null;
  if (now >= start)
    return (
      <p className="font-display text-ok inline-flex items-center gap-2 text-xl font-semibold">
        <span className="live-dot bg-ok size-2.5 rounded-full" aria-hidden /> Happening now
      </p>
    );

  const left = start - now;
  const parts = [
    { value: Math.floor(left / 86400), label: "Days" },
    { value: Math.floor((left % 86400) / 3600), label: "Hrs" },
    { value: Math.floor((left % 3600) / 60), label: "Min" },
    { value: left % 60, label: "Sec" },
  ];
  return (
    <div className="flex items-stretch gap-2" role="timer" aria-label={`Event starts in ${parts[0].value} days`}>
      {parts.map((p) => (
        <Digits key={p.label} {...p} />
      ))}
    </div>
  );
}
