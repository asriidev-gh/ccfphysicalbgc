"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Maximize, Minimize, RotateCcw, Trash2 } from "lucide-react";
import { drawRaffleAction, removeRaffleWinnerAction, resetRaffleAction } from "@/app/actions/raffle";
import { StarPhoto } from "@/components/star-photo";
import { Button, Input } from "@/components/ui";
import type { RaffleEntrant, RaffleWinner } from "@/lib/services/raffle";

const COLORS = ["#e0301e", "#f2c200", "#1f7a8c", "#7b2cbf", "#2a9d4b", "#e76f00"];
const SPIN_MS = 7000;
/** Beyond this many slices the names no longer fit; the readout above the wheel still shows who is under the pointer. */
const MAX_LABELS = 60;
const R = 200;

/** A point on the wheel, `deg` clockwise from the top. */
const point = (deg: number, radius = R) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return `${(radius * Math.cos(rad)).toFixed(3)} ${(radius * Math.sin(rad)).toFixed(3)}`;
};

const colorOf = (i: number, n: number) => {
  // The last slice touches the first, so it must not share its colour.
  if (i === n - 1 && n > 1 && i % COLORS.length === 0) return COLORS[3];
  return COLORS[i % COLORS.length];
};

function Slices({ people }: { people: RaffleEntrant[] }) {
  const n = people.length;
  const step = 360 / n;
  return (
    <>
      {people.map((p, i) => (
        <g key={p.id}>
          {n === 1 ? (
            <circle r={R} fill={COLORS[0]} />
          ) : (
            <path d={`M0 0 L${point(i * step)} A${R} ${R} 0 0 1 ${point((i + 1) * step)} Z`} fill={colorOf(i, n)} />
          )}
          {n <= MAX_LABELS && (
            <text
              transform={`rotate(${(i + 0.5) * step - 90})`}
              x={R - 10}
              textAnchor="end"
              dominantBaseline="central"
              fontSize={Math.max(6, Math.min(14, step * 1.5))}
              fontWeight={700}
              fill="#fff"
              stroke="#000"
              strokeWidth={2.5}
              paintOrder="stroke"
            >
              {p.name.length > 22 ? `${p.name.slice(0, 21)}…` : p.name}
            </text>
          )}
        </g>
      ))}
    </>
  );
}

export function RaffleWheel({ pool, winners, canReset }: { pool: RaffleEntrant[]; winners: RaffleWinner[]; canReset: boolean }) {
  const router = useRouter();
  const [checkedInOnly, setCheckedInOnly] = useState(false);
  const [prize, setPrize] = useState("");
  const [spinning, setSpinning] = useState(false);
  // The wheel as it was when spun; kept after it stops so the winning slice stays under the pointer.
  const [spun, setSpun] = useState<RaffleEntrant[] | null>(null);
  const [result, setResult] = useState<{ winner: RaffleEntrant; prize: string } | null>(null);
  const [under, setUnder] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition(); // removing a winner or resetting
  const [full, setFull] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const disc = useRef<SVGGElement>(null);
  const angle = useRef(0);
  const frame = useRef(0);

  const eligible = checkedInOnly ? pool.filter((p) => p.checkedIn) : pool;
  const people = spun ?? eligible;
  // While spinning, the new winner must not show up in the list yet.
  const shownWinners = spinning ? winners.filter((w) => w.participantId !== result?.winner.id) : winners;

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      cancelAnimationFrame(frame.current);
    };
  }, []);

  const rotate = (deg: number) => {
    angle.current = deg;
    disc.current?.setAttribute("transform", `rotate(${deg})`);
  };

  const animate = (list: RaffleEntrant[], index: number, done: () => void) => {
    const step = 360 / list.length;
    // Stop somewhere inside the winning slice, not always dead centre.
    const stopAt = (index + 0.5 + (Math.random() - 0.5) * 0.7) * step;
    const from = angle.current;
    const to = Math.ceil(from / 360) * 360 + 360 * 7 + (360 - stopAt);
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : SPIN_MS;
    const start = performance.now();
    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, Math.max(0, (now - start) / duration));
      const deg = from + (to - from) * (1 - (1 - t) ** 4);
      rotate(deg);
      setUnder(list[Math.floor((((360 - (deg % 360)) % 360) / step) % list.length)].name);
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else done();
    };
    frame.current = requestAnimationFrame(tick);
  };

  const spin = async () => {
    setError(null);
    setResult(null);
    setSpinning(true);
    try {
      const r = await drawRaffleAction({ checkedInOnly, prize });
      if (!r.ok) {
        setError(r.error);
        setSpinning(false);
        router.refresh();
        return;
      }
      const { winner } = r.data;
      // Someone who registered after this page loaded is not on the wheel yet.
      const list = eligible.some((p) => p.id === winner.id) ? eligible : [...eligible, winner];
      setSpun(list);
      setResult(r.data);
      // Wait for the slices to be on screen before turning them.
      requestAnimationFrame(() =>
        animate(
          list,
          list.findIndex((p) => p.id === winner.id),
          () => {
            setSpinning(false);
            setPrize("");
            router.refresh();
          },
        ),
      );
    } catch {
      setSpinning(false);
      // The draw may have been saved even though the reply was lost.
      setError("Network error. Check the winners list before spinning again.");
      router.refresh();
    }
  };

  /** Change the winners list, then rebuild the wheel so whoever came off it is back on. */
  const changeWinners = (question: string, change: () => ReturnType<typeof resetRaffleAction>) => {
    if (!window.confirm(question)) return;
    startSaving(async () => {
      setError(null);
      try {
        const r = await change();
        if (!r.ok) {
          router.refresh();
          return setError(r.error);
        }
        setSpun(null);
        setResult(null);
        router.refresh();
      } catch {
        setError("Network error. Check your connection and try again.");
      }
    });
  };

  const reset = () => changeWinners("Reset the draw? The winners list is cleared and everyone can win again.", resetRaffleAction);
  const remove = (w: RaffleWinner) =>
    changeWinners(`Remove ${w.name} from the winners? They go back into the draw.`, () => removeRaffleWinnerAction(w.participantId));

  const revealed = result && !spinning ? result : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div ref={stage} className="bg-bg flex flex-col items-center gap-4 overflow-auto rounded-lg p-4">
        <div className="flex min-h-40 flex-col items-center justify-center text-center" aria-live="polite">
          {revealed ? (
            <>
              <p className="text-gold text-xs font-bold tracking-[0.3em] uppercase">
                {revealed.prize ? `Winner · ${revealed.prize}` : "Winner"}
              </p>
              <div className="my-1 w-24">
                <StarPhoto name={revealed.winner.name} photoUrl={revealed.winner.photoUrl} size={192} leader />
              </div>
              <p className="font-display gold-text text-4xl leading-tight font-bold break-words sm:text-5xl">{revealed.winner.name}</p>
            </>
          ) : (
            <p className="font-display text-3xl font-bold break-words sm:text-4xl" aria-hidden={spinning}>
              {spinning ? under || "…" : "Ready to draw"}
            </p>
          )}
        </div>

        <div className="relative w-full max-w-[min(34rem,60vh)]">
          <svg viewBox="-210 -210 420 420" className="w-full" role="img" aria-label={`Raffle wheel with ${people.length} participants`}>
            <circle r={R + 6} fill="#2a2a30" />
            <g ref={disc}>{people.length > 0 && <Slices people={people} />}</g>
            <circle r={28} fill="#15151a" stroke="#f2c200" strokeWidth={4} />
            {/* Pointer */}
            <path d={`M-14 ${-R - 9} L14 ${-R - 9} L0 ${-R + 22} Z`} fill="#fff" stroke="#000" strokeWidth={2} />
          </svg>
        </div>

        <div className="flex w-full max-w-xl flex-col items-center gap-3">
          <Input
            value={prize}
            onChange={(e) => setPrize(e.target.value)}
            maxLength={100}
            placeholder="Prize (optional)"
            aria-label="Prize"
            disabled={spinning}
          />
          <Button size="lg" className="w-full sm:w-auto sm:min-w-60" disabled={spinning || saving || eligible.length === 0} onClick={spin}>
            {spinning ? "Drawing…" : "Spin the wheel"}
          </Button>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-5 accent-[var(--brand)]"
              checked={checkedInOnly}
              disabled={spinning}
              onChange={(e) => {
                setCheckedInOnly(e.target.checked);
                setSpun(null);
                setResult(null);
              }}
            />
            Checked-in participants only
          </label>
          <p className="text-muted text-sm">
            {eligible.length} {eligible.length === 1 ? "person" : "people"} in the next draw
          </p>
          {error && (
            <p role="alert" className="text-bad text-sm">
              {error}
            </p>
          )}
          <Button
            variant="ghost"
            onClick={() => (full ? document.exitFullscreen() : stage.current?.requestFullscreen?.())}
          >
            {full ? <Minimize className="size-4" aria-hidden /> : <Maximize className="size-4" aria-hidden />}
            {full ? "Exit full screen" : "Full screen"}
          </Button>
        </div>
      </div>

      <section aria-labelledby="raffle-winners">
        <h2 id="raffle-winners" className="font-display mb-3 text-xl font-bold uppercase">
          Winners ({shownWinners.length})
        </h2>
        {shownWinners.length === 0 ? (
          <p className="text-muted text-sm">No winners yet.</p>
        ) : (
          <>
            <ol className="border-line divide-line divide-y rounded-lg border">
              {shownWinners.map((w, i) => (
                <li key={w.participantId} className="flex items-center gap-3 px-3 py-2">
                  <span className="text-muted tabular w-6 text-sm">{shownWinners.length - i}</span>
                  <div className="w-10 shrink-0">
                    <StarPhoto name={w.name} photoUrl={w.photoUrl} size={96} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold break-words">{w.name}</p>
                    {w.prize && <p className="text-gold text-xs">{w.prize}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    className="text-bad -mr-2 min-w-11 shrink-0 px-2"
                    aria-label={`Remove ${w.name} from the winners`}
                    title="Remove"
                    disabled={spinning || saving}
                    onClick={() => remove(w)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </li>
              ))}
            </ol>
            {canReset && (
              <Button variant="ghost" className="mt-3" disabled={spinning || saving} onClick={reset}>
                <RotateCcw className="size-4" aria-hidden /> Reset draw
              </Button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
