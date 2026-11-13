"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Flag, FlagTriangleRight, Loader2, Pencil, Trash2, Play, QrCode, Square, UserCheck, Users, X } from "lucide-react";
import {
  cancelAttemptAction,
  checkInAction,
  checkOutAction,
  devCheckOutAllAction,
  correctAction,
  deleteResultAction,
  disputeAction,
  finishAction,
  finishRunnerAction,
  logCheckpointAction,
  reviewAction,
  startStationAction,
  stopStationAction,
  startHeatAction,
  scanLookupAction,
  startAction,
  submitAction,
  withdrawAction,
} from "@/app/actions/lead";
import { ActionForm } from "@/components/action-form";
import { QrScanner } from "./scanner";
import { RunningTimer } from "@/components/timer";
import { Badge, Button, Card, CardBody, Input, Select, Stat } from "@/components/ui";
import { calculate, formatDuration, ScoringError } from "@/lib/scoring/engine";
import type { ActionResult } from "@/lib/errors";
import type { LeadAttempt, LeadConsoleData, LeadRow } from "@/lib/services/lead";
import { photoThumb } from "@/lib/photo-url";
import { cn } from "@/lib/utils";
import { stationState } from "@/lib/stations";

type Filter = "ALL" | "NO_RECORD" | "NOT_ARRIVED" | "WAITING" | "IN_PROGRESS" | "DONE";
const FILTERS: [Filter, string][] = [
  ["ALL", "All"],
  ["NO_RECORD", "No record yet"],
  ["NOT_ARRIVED", "Not arrived"],
  ["WAITING", "Waiting"],
  ["IN_PROGRESS", "In progress"],
  ["DONE", "Done"],
];

export function LeadConsole({
  data,
  mode,
  multi = false,
  checkinOnly = false,
}: {
  data: LeadConsoleData;
  mode: "booth" | "roster";
  multi?: boolean;
  checkinOnly?: boolean;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const rows = useMemo(
    () =>
      data.rows.filter(
        (r) =>
          (filter === "ALL" || (filter === "NO_RECORD" ? !hasRecord(r) : r.queue === filter)) &&
          (r.name + " " + r.code).toLowerCase().includes(q.toLowerCase()),
      ),
    [data.rows, q, filter],
  );
  // Roster heat selection (timed sports): pick several runners and start them together.
  const timed = ["TIME", "MULTI_STATION"].includes(data.activity.config.template);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const eligible = data.rows.filter((r) => heatEligible(r, data));
  const startSelecting = () => {
    // Default: only people who have no record yet, all pre-selected.
    setFilter("NO_RECORD");
    setPicked(new Set(eligible.filter((r) => !hasRecord(r)).map((r) => r.id)));
    setSelecting(true);
  };
  const stopSelecting = () => {
    setSelecting(false);
    setPicked(new Set());
  };
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const s = data.stats;
  const [focusId, setFocusId] = useState<string | null>(null);
  const focus = focusId ? data.rows.find((r) => r.id === focusId) : undefined;
  return (
    <div>
      {mode === "booth" && <BoothScan data={data} focus={focus} onFocus={setFocusId} multi={multi} checkinOnly={checkinOnly} />}
      {mode === "roster" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Registered" value={s.registered} />
          <Stat label="Checked in" value={s.checkedIn} tone="accent" />
          <Stat label="Waiting" value={s.waiting} />
          <Stat label="In progress" value={s.inProgress} tone="brand" />
          <Stat label="Completed" value={s.completed} tone="ok" />
          <Stat label="Awaiting approval" value={s.awaitingApproval} tone="warn" />
        </div>
      )}
      {data.activity.status !== "ACTIVE" && (
        <p role="status" className="border-warn/40 bg-warn/10 text-warn mt-4 flex items-center gap-2 rounded-md border p-3 text-sm">
          <AlertTriangle className="size-4" aria-hidden /> This activity is {data.activity.status.toLowerCase()}. Challenges can only be
          started while it is ACTIVE.
        </p>
      )}
      {mode === "booth" && multi && (data.activity.config.template === "MATCH" ? <MatchPanel data={data} /> : <HeatPanel data={data} />)}
      {mode === "roster" && timed && (
        <HeatSelectBar
          data={data}
          selecting={selecting}
          picked={picked}
          visible={rows.filter((r) => heatEligible(r, data))}
          onStart={startSelecting}
          onStop={stopSelecting}
          onPicked={setPicked}
        />
      )}
      {mode === "roster" && (
        <>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label="Search participants"
              placeholder="Search participant"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="sm:max-w-xs"
            />
            <div className="flex gap-1 overflow-x-auto" role="group" aria-label="Filter by status">
              {FILTERS.map(([f, label]) => (
                <button
                  key={f}
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "min-h-11 shrink-0 rounded-md border px-3 text-sm font-semibold",
                    filter === f ? "border-brand bg-brand text-white" : "border-line bg-surface-2 text-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {rows.length === 0 && (
              <p className="border-line text-muted rounded-md border border-dashed p-6 text-center">No participants match.</p>
            )}
            {rows.map((r) => (
              <ParticipantCard
                key={r.id}
                row={r}
                data={data}
                others={data.rows.filter((o) => o.id !== r.id && o.queue === "WAITING")}
                select={selecting && heatEligible(r, data) ? { checked: picked.has(r.id), onToggle: () => toggle(r.id) } : undefined}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Run a Server Action, surface its error, and refresh server data. */
function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run<T>(fn: () => Promise<ActionResult<T>>, then?: (d: T) => void) {
    setError(null);
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          then?.(r.data);
          router.refresh();
        } else setError(r.error);
      } catch {
        setError("Network error. Nothing was changed. Check your connection and retry.");
      }
    });
  }
  return { run, pending, error, setError };
}

/** Configured countdown length in ms (null when the activity has no timer length). */
const countdownMs = (data: LeadConsoleData) => {
  const m = data.activity.config.params.durationMinutes;
  return m ? Math.round(m * 60_000) : undefined;
};

const queueTone = { NOT_ARRIVED: "neutral", WAITING: "accent", IN_PROGRESS: "brand", DONE: "ok", WITHDRAWN: "bad" } as const;

/** Has any recorded (non-deleted) result. */
const hasRecord = (r: LeadRow) => r.attempts.some((a) => a.result);

/** Checked in, active, with attempts left and nothing running: can join a heat. */
const heatEligible = (r: LeadRow, data: LeadConsoleData) =>
  r.queue === "WAITING" &&
  r.participantStatus === "ACTIVE" &&
  r.attempts.filter((a) => a.status !== "CANCELLED").length < data.activity.maxAttempts &&
  !r.attempts.some((a) => a.status === "RUNNING" || a.status === "FINISHED");

function HeatSelectBar({
  data,
  selecting,
  picked,
  visible,
  onStart,
  onStop,
  onPicked,
}: {
  data: LeadConsoleData;
  selecting: boolean;
  picked: Set<string>;
  visible: LeadRow[];
  onStart: () => void;
  onStop: () => void;
  onPicked: (s: Set<string>) => void;
}) {
  const { run, pending, error } = useAct();
  const ids = data.rows.filter((r) => picked.has(r.id) && heatEligible(r, data)).map((r) => r.id);
  const allVisible = visible.length > 0 && visible.every((r) => picked.has(r.id));
  if (!selecting)
    return (
      <div className="mt-6">
        <Button variant="secondary" onClick={onStart}>
          <Users className="size-5" aria-hidden /> Select for {/run/i.test(data.activity.name) ? "race" : "challenge"}
        </Button>
      </div>
    );
  return (
    <div className="border-brand/40 bg-brand/10 sticky top-0 z-10 mt-6 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {ids.length} selected <span className="text-muted font-normal">· they all start on the same server instant</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => onPicked(allVisible ? new Set() : new Set(visible.map((r) => r.id)))}>
            {allVisible ? "Clear" : "Select all shown"}
          </Button>
          <Button variant="ghost" onClick={onStop}>
            Cancel
          </Button>
          <Button
            disabled={pending || data.activity.status !== "ACTIVE" || ids.length === 0}
            onClick={() => run(() => startHeatAction(ids), onStop)}
          >
            {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Play className="size-5" aria-hidden />} {/run/i.test(data.activity.name) ? "Start Race" : "Start Challenge"} (
            {ids.length})
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-bad mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

/** Round participant photo (falls back to initials) shown beside names in the running / scoring lists. */
function Avatar({ row, size = 48, className }: { row: LeadRow; size?: number; className?: string }) {
  const box = className ? undefined : { width: size, height: size };
  if (row.photoUrl)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- small Cloudinary thumbnail
      <img
        src={photoThumb(row.photoUrl, size * 2)}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        style={box}
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    );
  const parts = row.name.trim().split(/s+/).filter(Boolean);
  const initials = (parts.length < 2 ? (parts[0] ?? "?").slice(0, 2) : `${parts[0][0]}${parts[parts.length - 1][0]}`).toUpperCase();
  return (
    <span
      aria-hidden
      style={box}
      className={cn("bg-surface-2 text-muted flex shrink-0 items-center justify-center rounded-full text-sm font-bold", className)}
    >
      {initials}
    </span>
  );
}

function ParticipantCard({
  row,
  data,
  others,
  select,
  checkinOnly = false,
}: {
  row: LeadRow;
  data: LeadConsoleData;
  others: LeadRow[];
  select?: { checked: boolean; onToggle: () => void };
  /** Check-in station: only the Check in action is offered (no Start, no Cancel/withdraw). */
  checkinOnly?: boolean;
}) {
  const { run, pending, error } = useAct();
  const [opponent, setOpponent] = useState("");
  // Optimistic UI: show the timer the instant Start/Stop is clicked instead of after the server round trip.
  // The official time is still the server's; these only drive what the lead sees while waiting.
  const [optStart, setOptStart] = useState<{ at: string; n: number } | null>(null);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const isMatch = data.activity.config.template === "MATCH";
  const used = row.attempts.filter((a) => a.status !== "CANCELLED").length;
  const remaining = used < data.activity.maxAttempts;
  const running = row.attempts.find((a) => a.status === "RUNNING");
  const finished = row.attempts.find((a) => a.status === "FINISHED");
  const canStart =
    !checkinOnly &&
    data.activity.status === "ACTIVE" &&
    row.queue === "WAITING" &&
    remaining &&
    row.participantStatus === "ACTIVE" &&
    !running &&
    !finished;
  const stopNow = (id: string, reason?: string, stopAtMs?: number) => {
    setStoppingId(id); // freeze the display immediately
    run(async () => {
      try {
        const r = await finishAction(id, reason, stopAtMs);
        if (!r.ok) setStoppingId(null);
        return r;
      } catch (e) {
        setStoppingId(null);
        throw e;
      }
    });
  };
  const canWithdraw = !checkinOnly && used === 0 && !running && !finished && (row.queue === "NOT_ARRIVED" || row.queue === "WAITING");

  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {select && (
              <input
                type="checkbox"
                aria-label={`Select ${row.name} for the heat`}
                checked={select.checked}
                onChange={select.onToggle}
                className="size-6 shrink-0 accent-[var(--brand)]"
              />
            )}
            {row.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- small Cloudinary thumbnail
              <img
                src={photoThumb(row.photoUrl, 96)}
                alt=""
                width={48}
                height={48}
                loading="lazy"
                className="size-12 shrink-0 rounded-full object-cover"
              />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-lg font-semibold">{row.name}</p>
                {row.code && (
                  <span className="tabular border-line bg-surface-2 text-muted rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                    {row.code}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                {!(checkinOnly && row.queue === "NOT_ARRIVED") && <Badge tone={queueTone[row.queue]}>{row.queue.replace("_", " ")}</Badge>}
                {row.participantStatus !== "ACTIVE" && <Badge tone="bad">{row.participantStatus}</Badge>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {row.queue === "NOT_ARRIVED" && (
              <Button variant="accent" disabled={pending} onClick={() => run(() => checkInAction(row.id))}>
                <UserCheck className="size-5" aria-hidden /> Check in
              </Button>
            )}
            {canStart && (
              <>
                {isMatch && (
                  <Select aria-label="Opponent" value={opponent} onChange={(e) => setOpponent(e.target.value)} className="w-44">
                    <option value="">Opponent…</option>
                    {others.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </Select>
                )}
                <Button
                  disabled={pending || (isMatch && !opponent)}
                  onClick={() => {
                    setOptStart({ at: new Date().toISOString(), n: row.attempts.length });
                    run(async () => {
                      try {
                        const r = await startAction(row.id, isMatch ? opponent : undefined);
                        if (!r.ok) setOptStart(null);
                        return r;
                      } catch (e) {
                        setOptStart(null);
                        throw e;
                      }
                    });
                  }}
                >
                  {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Play className="size-5" aria-hidden />} Start
                </Button>
              </>
            )}
            {canWithdraw && <WithdrawParticipant id={row.id} />}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-bad mt-3 text-sm">
            {error}
          </p>
        )}

        {!running && !finished && optStart && optStart.n === row.attempts.length && !error && (
          <div className="border-brand/40 bg-brand/10 mt-4 rounded-md border p-4">
            <p className="text-muted text-xs tracking-wider uppercase">Starting…</p>
            <RunningTimer startedAt={optStart.at} serverNow={optStart.at} className="tabular font-display block text-5xl font-bold" />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button disabled>
                <Square className="size-5" aria-hidden /> Stop &amp; score
              </Button>
            </div>
          </div>
        )}

        {running && (
          <div className="border-brand/40 bg-brand/10 mt-4 rounded-md border p-4">
            <p className="text-muted text-xs tracking-wider uppercase">
              Attempt {running.number} running{running.opponentName ? ` vs ${running.opponentName}` : ""}
            </p>
            {data.activity.stations.length === 0 && (
              <RunningTimer
                startedAt={running.startedAt}
                serverNow={data.serverNow}
                frozen={stoppingId === running.id}
                durationMs={countdownMs(data)}
                onTimeUp={() => stopNow(running.id, undefined, new Date(running.startedAt).getTime() + (countdownMs(data) ?? 0))}
                className="tabular font-display block text-5xl font-bold"
              />
            )}
            <RunControls
              attempt={running}
              data={data}
              busy={pending || stoppingId === running.id}
              finishLabel="Stop & score"
              onFinish={(reason, stopAtMs) => stopNow(running.id, reason, stopAtMs)}
            />
            <div className="mt-3">
              <CancelAttempt attemptId={running.id} />
            </div>
          </div>
        )}

        {finished && (
          <div className="mt-4">
            <ScorePanel attempt={finished} data={data} />
            <div className="mt-2">
              <CancelAttempt attemptId={finished.id} />
            </div>
          </div>
        )}

        {row.attempts.some((a) => a.result) && (
          <ul className="divide-line border-line mt-4 divide-y border-t">
            {row.attempts
              .filter((a) => a.result)
              .map((a) => (
                <ResultLine key={a.id} attempt={a} data={data} />
              ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/** Start Challenge for head-to-head matches: pick two checked-in players, start the match, then score it from the card below. */
function MatchPanel({ data }: { data: LeadConsoleData }) {
  const { run, pending, error } = useAct();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const ready = data.rows.filter((r) => heatEligible(r, data));
  const live = data.rows.filter((r) => r.attempts.some((t) => t.status === "RUNNING" || t.status === "FINISHED"));
  const canStart = data.activity.status === "ACTIVE" && !!a && !!b && a !== b;
  return (
    <Card className="mt-4">
      <CardBody className="space-y-4">
        <div>
          <p className="font-display text-lg font-bold uppercase">Start Challenge</p>
          <p className="text-muted text-xs">Pick the two checked-in players for this match.</p>
        </div>
        {ready.length < 2 ? (
          <p className="text-muted text-sm">Need at least two checked-in players. Check players in first.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Select aria-label="Player 1" value={a} onChange={(e) => setA(e.target.value)} className="w-52">
              <option value="">Player 1…</option>
              {ready.filter((r) => r.id !== b).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
            <span className="text-muted text-sm font-semibold">vs</span>
            <Select aria-label="Player 2" value={b} onChange={(e) => setB(e.target.value)} className="w-52">
              <option value="">Player 2…</option>
              {ready.filter((r) => r.id !== a).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
            <Button
              disabled={pending || !canStart}
              onClick={() =>
                run(
                  () => startAction(a, b),
                  () => {
                    setA("");
                    setB("");
                  },
                )
              }
            >
              {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Play className="size-5" aria-hidden />} Start Challenge
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-bad text-sm">
            {error}
          </p>
        )}
        {live.length > 0 && (
          <div className="space-y-3">
            <p className="text-muted text-xs tracking-wider uppercase">In play · score when finished</p>
            {live.map((r) => (
              <ParticipantCard key={r.id} row={r} data={data} others={[]} />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/** Group start for timed sports: one start instant for everyone, then tap each runner as they finish. */
function HeatPanel({ data }: { data: LeadConsoleData }) {
  const { run, pending, error } = useAct();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [stopping, setStopping] = useState<Set<string>>(new Set());
  // Separate from the start-heat action so finishing one runner never disables the others (or the Start button).
  const finisher = useAct();
  const active = data.activity.status === "ACTIVE";

  const waiting = data.rows.filter(
    (r) =>
      r.queue === "WAITING" &&
      r.participantStatus === "ACTIVE" &&
      r.attempts.filter((a) => a.status !== "CANCELLED").length < data.activity.maxAttempts,
  );
  const running = data.rows.flatMap((r) => r.attempts.filter((a) => a.status === "RUNNING").map((a) => ({ row: r, attempt: a })));
  const toScore = data.rows.flatMap((r) => r.attempts.filter((a) => a.status === "FINISHED").map((a) => ({ row: r, attempt: a })));
  const chosen = waiting.filter((r) => picked.has(r.id));

  // Completed heats, newest first; inside a heat, ordered by the activity's ranking direction.
  const dir = data.activity.config.primary.direction === "asc" ? 1 : -1;
  const heats = new Map<number, { row: LeadRow; attempt: LeadAttempt }[]>();
  for (const r of data.rows)
    for (const a of r.attempts)
      if (a.heat !== null && a.result && !a.result.disputed) heats.set(a.heat, [...(heats.get(a.heat) ?? []), { row: r, attempt: a }]);
  const heatList = [...heats.entries()].sort((x, y) => y[0] - x[0]);

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const durationMs = countdownMs(data);
  const doFinish = (id: string, reason?: string, stopAtMs?: number) => {
    setStopping((s) => new Set(s).add(id)); // freeze this runner's timer immediately
    const release = () =>
      setStopping((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    finisher.run(async () => {
      try {
        const r = await finishRunnerAction(id, reason, stopAtMs);
        if (!r.ok) release();
        return r;
      } catch (e) {
        release();
        throw e;
      }
    });
  };

  return (
    <Card className="mt-4">
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg font-bold uppercase">{/run/i.test(data.activity.name) ? "Start Race" : "Start Challenge"}</p>
            <p className="text-muted text-xs">Select runners who are checked in. They all start on the same server instant.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {process.env.NODE_ENV !== "production" && waiting.length > 0 && (
              <Button
                variant="danger"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm("Check out everyone who is waiting? They will go back to 'not arrived'.")) return;
                  run(
                    () => devCheckOutAllAction(data.activity.id),
                    () => setPicked(new Set()),
                  );
                }}
              >
                Check out all
              </Button>
            )}
            {waiting.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => setPicked(chosen.length === waiting.length ? new Set() : new Set(waiting.map((r) => r.id)))}
              >
                {chosen.length === waiting.length ? "Clear" : "Select all"}
              </Button>
            )}
            <Button
              disabled={pending || !active || chosen.length === 0}
              onClick={() =>
                run(
                  () => startHeatAction(chosen.map((r) => r.id)),
                  () => setPicked(new Set()),
                )
              }
            >
              {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Play className="size-5" aria-hidden />} {/run/i.test(data.activity.name) ? "Start Race" : "Start Challenge"} (
              {chosen.length})
            </Button>
          </div>
        </div>

        {waiting.length === 0 ? (
          <p className="text-muted text-sm">No one is waiting. Check runners in first (scan their QR or use the roster).</p>
        ) : (
          <ul className="grid gap-2">
            {waiting.map((r) => (
              <li key={r.id}>
                <label className="border-line bg-surface-2 flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3">
                  <input
                    type="checkbox"
                    checked={picked.has(r.id)}
                    onChange={() => toggle(r.id)}
                    className="size-5 accent-[var(--brand)]"
                  />
                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  {r.attempts.every((a) => a.status === "CANCELLED") && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={(e) => {
                        e.preventDefault();
                        if (!window.confirm(`Check out ${r.name}? They will go back to "not arrived".`)) return;
                        run(() => checkOutAction(r.id));
                      }}
                      className="text-bad text-xs font-semibold hover:underline"
                    >
                      Check out
                    </button>
                  )}
                </label>
              </li>
            ))}
          </ul>
        )}

        {(error || finisher.error) && (
          <p role="alert" className="text-bad text-sm">
            {error ?? finisher.error}
          </p>
        )}

        {running.length > 0 && (
          <div>
            <p className="text-muted mb-2 text-xs tracking-wider uppercase">Running · tap a runner when they finish</p>
            <ul className="space-y-2">
              {running.map(({ row, attempt }) => (
                <li key={attempt.id} className="border-brand/40 bg-brand/10 flex items-start gap-4 rounded-md border p-3">
                  <Avatar row={row} size={128} className="size-20 sm:size-32" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold">{row.name}</p>
                    {data.activity.stations.length === 0 && (
                      <RunningTimer
                        startedAt={attempt.startedAt}
                        serverNow={data.serverNow}
                        frozen={stopping.has(attempt.id)}
                        durationMs={durationMs}
                        onTimeUp={() => doFinish(attempt.id, undefined, new Date(attempt.startedAt).getTime() + (durationMs ?? 0))}
                        className="tabular font-display text-3xl font-bold"
                      />
                    )}
                    <RunControls
                      attempt={attempt}
                      data={data}
                      busy={stopping.has(attempt.id)}
                      finishLabel="Finish"
                      onFinish={(reason, stopAtMs) => doFinish(attempt.id, reason, stopAtMs)}
                    />
                    <div className="mt-2">
                      <CancelAttempt attemptId={attempt.id} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {heatList.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted text-xs tracking-wider uppercase">{/run/i.test(data.activity.name) ? "Race" : "Challenge"} results</p>
            {heatList.map(([n, items], i) => {
              // Shown number counts the races in this list (oldest = 1); `n` is only the stored id, which can have gaps.
              const ordered = [...items].sort((a, b) => {
                const av = a.attempt.result!.value;
                const bv = b.attempt.result!.value;
                if (av === null || bv === null) return av === bv ? 0 : av === null ? 1 : -1;
                return (av - bv) * dir;
              });
              return (
                <details key={n} open={i === 0} className="border-line rounded-md border">
                  <summary className="cursor-pointer px-3 py-2 font-semibold">
                    {/run/i.test(data.activity.name) ? "Race" : items.length === 1 ? "Challenger" : "Challengers"} {heatList.length - i}{" "}
                    <span className="text-muted text-sm font-normal">
                      · {items.length} runner{items.length === 1 ? "" : "s"}
                    </span>
                  </summary>
                  <ol className="divide-line border-line divide-y border-t">
                    {ordered.map(({ row, attempt }, k) => (
                      <li key={attempt.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate">
                            <span className="text-muted tabular mr-2">{attempt.result!.status === "VALID" ? k + 1 : "–"}</span>
                            {row.name}
                          </p>
                          {data.activity.stations.length > 0 && attempt.stations.some((st) => st.elapsedMs !== null) && (
                            <ul className="text-muted tabular mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs" aria-label="Station times">
                              {data.activity.stations.map((st, i) => {
                                const ms = attempt.stations.find((x) => x.index === i)?.elapsedMs;
                                return (
                                  <li key={st.key}>
                                    {st.label}{" "}
                                    <span className="text-fg font-semibold">{ms === null || ms === undefined ? "—" : formatDuration(ms)}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                        <span className="tabular font-display text-xl font-bold">{attempt.result!.display}</span>
                      </li>
                    ))}
                  </ol>
                </details>
              );
            })}
          </div>
        )}

        {toScore.length > 0 && (
          <div className="space-y-3">
            <p className="text-muted text-xs tracking-wider uppercase">Finished · enter result</p>
            {toScore.map(({ row, attempt }) => (
              <div key={attempt.id}>
                <div className="mb-2 flex items-center gap-3">
                  <Avatar row={row} size={48} />
                  <p className="font-semibold">{row.name}</p>
                </div>
                <ScorePanel attempt={attempt} data={data} />
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * Route tracking for a running attempt: shows each checkpoint (done with its split, next, or still ahead),
 * a "Passed <next>" button that logs the next one in order, and the finish button. Finish is only enabled
 * once every checkpoint is logged; otherwise the lead can finish anyway by giving a reason (audited).
 */
/**
 * Two-step button: the first tap swaps it for "Yes, …" + Cancel in the same spot (no browser alert);
 * it disarms itself after a few seconds so a stray tap never lingers.
 */
/** Server-clock "now" (same offset the running timers use), so a tap time can be sent to the server. */
function useServerClock(serverNow: string) {
  const offset = useRef(0);
  useEffect(() => {
    offset.current = new Date(serverNow).getTime() - Date.now();
  }, [serverNow]);
  return () => Date.now() + offset.current;
}

function ConfirmAction({
  onArm,
  onConfirm,
  confirmLabel,
  disabled,
  className,
  variant,
  children,
}: {
  onArm?: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  disabled?: boolean;
  className?: string;
  variant?: "danger";
  children: React.ReactNode;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 6000);
    return () => clearTimeout(t);
  }, [armed]);
  if (!armed)
    return (
      <Button variant={variant} disabled={disabled} onClick={() => {
          onArm?.();
          setArmed(true);
        }}
        className={className}
      >
        {children}
      </Button>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant={variant}
        disabled={disabled}
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
        className={cn(className, "ring-2 ring-white/70")}
      >
        {confirmLabel}
      </Button>
      <Button variant="ghost" onClick={() => setArmed(false)}>
        Cancel
      </Button>
    </div>
  );
}

function RunControls({
  attempt,
  data,
  busy,
  finishLabel,
  onFinish,
}: {
  attempt: LeadAttempt;
  data: LeadConsoleData;
  busy: boolean;
  finishLabel: string;
  onFinish: (overrideReason?: string, stopAtMs?: number) => void;
}) {
  if (data.activity.stations.length > 0) return <StationControls attempt={attempt} data={data} />;
  return <CheckpointControls attempt={attempt} data={data} busy={busy} finishLabel={finishLabel} onFinish={onFinish} />;
}

function CheckpointControls({
  attempt,
  data,
  busy,
  finishLabel,
  onFinish,
}: {
  attempt: LeadAttempt;
  data: LeadConsoleData;
  busy: boolean;
  finishLabel: string;
  onFinish: (overrideReason?: string, stopAtMs?: number) => void;
}) {
  const serverTime = useServerClock(data.serverNow);
  const armedAt = useRef<number | undefined>(undefined);
  const { run, pending, error } = useAct();
  const [override, setOverride] = useState(false);
  const [reason, setReason] = useState("");
  const names = data.activity.checkpoints;
  const done = new Map(attempt.checkpoints.map((c) => [c.index, c.elapsedMs]));
  const next = names.findIndex((_, i) => !done.has(i));
  const complete = next === -1;
  const disabled = busy || pending;

  return (
    <div className="mt-3 space-y-3">
      {names.length > 0 && (
        <>
          <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Route progress">
            {names.map((n, i) => {
              const ms = done.get(i);
              return (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1",
                    ms !== undefined ? "border-ok/50 bg-ok/10" : i === next ? "border-brand bg-brand/10 font-semibold" : "border-line text-muted",
                  )}
                >
                  {ms !== undefined ? <Check className="text-ok size-4" aria-hidden /> : null}
                  {n}
                  {ms !== undefined && <span className="tabular text-muted">{formatDuration(ms)}</span>}
                </li>
              );
            })}
            <li className={cn("rounded-full border px-3 py-1", complete ? "border-brand bg-brand/10 font-semibold" : "border-line text-muted")}>
              Finish
            </li>
          </ol>
          {!complete && (
            <Button disabled={disabled} onClick={() => run(() => logCheckpointAction(attempt.id, next))}>
              {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Check className="size-5" aria-hidden />} Passed {names[next]}
            </Button>
          )}
        </>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <ConfirmAction
          disabled={disabled || !complete}
          onArm={() => (armedAt.current = serverTime())}
          onConfirm={() => onFinish(undefined, armedAt.current)}
          confirmLabel={`Yes, ${finishLabel}`}
          className="bg-ok hover:bg-ok/85 min-h-14 w-full gap-2 text-lg font-bold text-black sm:w-auto sm:min-w-44 disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <FlagTriangleRight className="size-6" aria-hidden />}
          {busy ? "Saving…" : finishLabel}
        </ConfirmAction>
        {!complete && !override && (
          <Button variant="ghost" disabled={disabled} onClick={() => setOverride(true)}>
            Finish without all checkpoints…
          </Button>
        )}
      </div>
      {!complete && override && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (e.g. checkpoint missed by marshal)"
            aria-label="Reason for finishing without all checkpoints"
            className="w-72"
          />
          <ConfirmAction
            variant="danger"
            disabled={disabled || reason.trim().length < 3}
            onArm={() => (armedAt.current = serverTime())}
            onConfirm={() => onFinish(reason.trim(), armedAt.current)}
            confirmLabel={`Yes, ${finishLabel} anyway`}
          >
            {finishLabel} anyway
          </ConfirmAction>
        </div>
      )}
      {error && (
        <p role="alert" className="text-bad text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Multi-station run: every station has its own timer. The first starts with the run; Stop saves that station's
 * time and shows "Start Station N" for the next; stopping the last one ends the run with the stations' sum as the total.
 */
function StationControls({ attempt, data }: { attempt: LeadAttempt; data: LeadConsoleData }) {
  const serverTime = useServerClock(data.serverNow);
  const armedAt = useRef<number | undefined>(undefined);
  const { run, pending, error } = useAct();
  // Frozen is tied to the exact state it was pressed in: it holds until the refreshed data moves on (never resumes early).
  const [frozenAt, setFrozenAt] = useState<string | null>(null);
  // On Start, begin counting locally at the tap; the server's own start instant replaces it once the data refreshes.
  const [optStart, setOptStart] = useState<{ key: string; at: string } | null>(null);
  const stations = data.activity.stations;
  const st = stationState(attempt.startedAt, attempt.stations, stations.length);
  const stateKey = st.kind === "complete" ? "complete" : `${st.kind}-${st.index}`;
  const frozen = frozenAt === stateKey;
  const times = new Map(attempt.stations.filter((s) => s.finishedAt).map((s) => [s.index, s.elapsedMs ?? 0]));
  const last = st.kind === "running" && st.index === stations.length - 1;
  const idx = st.kind === "complete" ? stations.length - 1 : st.index;

  const act = (fn: () => Promise<ActionResult<unknown>>, optimisticStart = false) => {
    setFrozenAt(stateKey);
    if (optimisticStart) setOptStart({ key: stateKey, at: new Date().toISOString() });
    const undo = () => {
      setFrozenAt(null);
      setOptStart(null);
    };
    run(async () => {
      try {
        const r = await fn();
        if (!r.ok) undo();
        return r;
      } catch (e) {
        undo();
        throw e;
      }
    });
  };

  return (
    <div className="mt-2 space-y-3">
      <div>
        <p className="text-muted text-xs tracking-wider uppercase">
          {st.kind === "waiting" && !frozen ? `Ready for ${stations[idx].label}` : `${stations[idx].label} running`}
        </p>
        {st.kind === "running" ? (
          <RunningTimer
            key={`${attempt.id}-${st.index}`}
            startedAt={st.startedAt}
            serverNow={data.serverNow}
            frozen={frozen}
            className="tabular font-display block text-4xl font-bold"
          />
        ) : optStart && optStart.key === stateKey ? (
          <RunningTimer startedAt={optStart.at} serverNow={optStart.at} className="tabular font-display block text-4xl font-bold" />
        ) : (
          <span className="tabular font-display block text-4xl font-bold">{formatDuration(0)}</span>
        )}
      </div>

      <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Stations">
        {stations.map((s, i) => {
          const ms = times.get(i);
          return (
            <li
              key={s.key}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1",
                ms !== undefined ? "border-ok/50 bg-ok/10" : i === idx ? "border-brand bg-brand/10 font-semibold" : "border-line text-muted",
              )}
            >
              {ms !== undefined && <Check className="text-ok size-4" aria-hidden />}
              {s.label}
              {ms !== undefined && <span className="tabular text-muted">{formatDuration(ms)}</span>}
            </li>
          );
        })}
        <li className="text-muted tabular">
          Total so far: <span className="text-fg font-semibold">{formatDuration(st.doneMs)}</span>
        </li>
      </ol>

      {st.kind === "waiting" && (
        <Button
          disabled={pending || frozen}
          onClick={() => act(() => startStationAction(attempt.id), true)}
          className="bg-ok hover:bg-ok/85 min-h-14 w-full gap-2 text-lg font-bold text-black sm:w-auto sm:min-w-52"
        >
          {pending ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <Play className="size-6" aria-hidden />}
          Start {stations[st.index].label}
        </Button>
      )}
      {st.kind === "running" && (
        <ConfirmAction
          disabled={pending || frozen}
          onArm={() => (armedAt.current = serverTime())}
          onConfirm={() => act(() => stopStationAction(attempt.id, armedAt.current))}
          confirmLabel={`Yes, ${last ? `End ${stations[st.index].label} & Finish` : `End ${stations[st.index].label}`}`}
          className="min-h-14 w-full gap-2 text-lg font-bold sm:w-auto sm:min-w-52"
        >
          {frozen ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <Square className="size-6" aria-hidden />}
          {frozen ? "Saving…" : last ? `End ${stations[st.index].label} & Finish` : `End ${stations[st.index].label}`}
        </ConfirmAction>
      )}
      {error && (
        <p role="alert" className="text-bad text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

function WithdrawParticipant({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <X className="size-5" aria-hidden /> Cancel
      </Button>
    );
  return (
    <ActionForm
      action={withdrawAction.bind(null, id)}
      submitLabel="Remove from event"
      variant="danger"
      confirm="Remove this participant from this activity? They will no longer take part."
      className="flex flex-wrap items-start gap-2"
      buttonClassName="mt-0"
    >
      <Input name="reason" required minLength={3} placeholder="Reason (e.g. no show)" aria-label="Reason" className="w-52" />
    </ActionForm>
  );
}

function CancelAttempt({ attemptId }: { attemptId: string }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <X className="size-4" aria-hidden /> Cancel attempt
      </Button>
    );
  return (
    <ActionForm
      action={cancelAttemptAction.bind(null, attemptId)}
      submitLabel="Confirm cancel"
      variant="danger"
      className="flex flex-wrap items-start gap-2"
      buttonClassName="mt-0"
    >
      <Input
        name="reason"
        required
        minLength={3}
        placeholder="Reason (e.g. false start)"
        aria-label="Cancellation reason"
        className="w-60"
      />
    </ActionForm>
  );
}

/** Staff can change a submitted score at any time; it is saved as a new version (history kept in the audit log). */
function EditScore({
  resultId,
  status: initialStatus,
  raw,
  data,
  onDone,
}: {
  resultId: string;
  status: string;
  raw: Record<string, unknown>;
  data: LeadConsoleData;
  onDone: () => void;
}) {
  const cfg = data.activity.config;
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      cfg.fields.map((f) => {
        const v = raw[f.key];
        return [f.key, v === undefined || v === null ? "" : String(f.type === "duration_ms" ? Number(v) / 1000 : v)];
      }),
    ),
  );
  const [status, setStatus] = useState(initialStatus);
  const payload = () => {
    const out: Record<string, unknown> = {};
    for (const f of cfg.fields) {
      const v = vals[f.key];
      if (v === "" || v === undefined) continue;
      out[f.key] = f.type === "boolean" ? v === "true" || v === "on" : f.type === "duration_ms" ? Math.round(Number(v) * 1000) : Number(v);
    }
    return { raw: out, status: status as "VALID" };
  };
  return (
    <ActionForm
      action={async () => correctAction(resultId, payload())}
      submitLabel="Save score"
      success="Score updated."
      onDone={onDone}
      className="mt-3 space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {cfg.fields.map((f) => (
          <label key={f.key} className="block text-sm">
            <span className="mb-1 block font-medium">
              {f.label}
              {f.type === "duration_ms" ? " (seconds)" : f.unit ? ` (${f.unit})` : ""}
            </span>
            <Input
              type="number"
              inputMode="decimal"
              step={f.type === "integer" ? 1 : "any"}
              value={vals[f.key] ?? ""}
              onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
            />
          </label>
        ))}
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Outcome</span>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="VALID">Completed</option>
            <option value="INCOMPLETE">Incomplete</option>
            <option value="DISQUALIFIED">Disqualified</option>
            <option value="WITHDRAWN">Withdrawn</option>
          </Select>
        </label>
      </div>
    </ActionForm>
  );
}

function ResultLine({ attempt, data }: { attempt: LeadAttempt; data: LeadConsoleData }) {
  const { run, pending, error } = useAct();
  const [flag, setFlag] = useState(false);
  const [edit, setEdit] = useState(false);
  const r = attempt.result!;
  const mustBeOther = data.activity.independentApproval && r.mine;
  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-muted text-xs">
            Attempt {attempt.number}
            {attempt.opponentName ? ` vs ${attempt.opponentName}` : ""}
          </span>
          <p className="tabular font-display text-2xl font-bold">{r.display}</p>
        </div>
        {r.disputed ? (
          <Badge tone="bad">Disputed</Badge>
        ) : (
          <Badge tone={r.approval === "APPROVED" ? "ok" : r.approval === "REJECTED" ? "bad" : "warn"}>
            {r.approval === "APPROVED"
              ? r.published
                ? "Published"
                : "Approved"
              : r.approval === "PENDING"
                ? "Awaiting approval"
                : "Rejected"}
          </Badge>
        )}
      </div>

      {r.approval === "PENDING" && !r.disputed && (
        <div className="mt-3">
          {mustBeOther ? (
            <span className="text-muted text-xs">A different reviewer must approve</span>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button disabled={pending} onClick={() => run(() => reviewAction(r.id, "APPROVED"))}>
                <Check className="size-4" aria-hidden /> Approve
              </Button>
              <Button variant="danger" disabled={pending} onClick={() => run(() => reviewAction(r.id, "REJECTED"))}>
                Reject
              </Button>
            </div>
          )}
        </div>
      )}

      <div className={cn("mt-3 grid gap-2", r.disputed ? "grid-cols-2" : "grid-cols-3")}>
        <Button variant="secondary" onClick={() => setEdit((e) => !e)}>
          <Pencil className="size-4" aria-hidden /> Edit
        </Button>
        {!r.disputed && (
          <Button variant="secondary" onClick={() => setFlag((f) => !f)}>
            <Flag className="size-4" aria-hidden /> Flag
          </Button>
        )}
        <Button
          variant="danger"
          disabled={pending}
          onClick={() => {
            if (window.confirm("Delete this score? It is removed from the leaderboard and the participant can run again."))
              run(() => deleteResultAction(r.id));
          }}
        >
          <Trash2 className="size-4" aria-hidden /> Delete
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-bad mt-2 text-sm">
          {error}
        </p>
      )}
      {edit && <EditScore resultId={r.id} status={r.status} raw={r.raw} data={data} onDone={() => setEdit(false)} />}
      {flag && (
        <ActionForm
          action={disputeAction.bind(null, r.id)}
          submitLabel="Submit dispute"
          variant="secondary"
          className="mt-2"
          onDone={() => setFlag(false)}
          success="Flagged. An administrator will review it."
        >
          <Input name="note" required minLength={3} placeholder="What needs correcting?" aria-label="Dispute note" />
        </ActionForm>
      )}
    </li>
  );
}

function ScorePanel({ attempt, data }: { attempt: LeadAttempt; data: LeadConsoleData }) {
  const cfg = data.activity.config;
  const router = useRouter();
  const key = useRef<string>(`${attempt.id}-${crypto.randomUUID()}`); // one idempotency key per submission
  const [values, setValues] = useState<Record<string, string>>(() => {
    // Multi-station: pre-fill each station's recorded time (seconds) so the lead only adds what is missing.
    const out: Record<string, string> = {};
    for (const l of attempt.stations)
      if (l.elapsedMs !== null && data.activity.stations[l.index]) out[data.activity.stations[l.index].key] = String(l.elapsedMs / 1000);
    return out;
  });
  const [status, setStatus] = useState<"VALID" | "INCOMPLETE" | "DISQUALIFIED" | "WITHDRAWN">("VALID");
  const [review, setReview] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // duration_ms fields are typed in seconds for convenience and sent as integer milliseconds.
  const raw = (): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const f of cfg.fields) {
      const v = values[f.key];
      if (f.type === "boolean") out[f.key] = v === "on";
      else if (v === undefined || v === "") continue;
      else out[f.key] = f.type === "duration_ms" ? Math.round(Number(v) * 1000) : Number(v);
    }
    return out;
  };

  const preview = () => {
    try {
      return { calc: calculate(cfg, { raw: raw(), elapsedMs: attempt.elapsedMs, status }), errs: {} as Record<string, string> };
    } catch (e) {
      return { calc: null, errs: e instanceof ScoringError ? e.fieldErrors : { form: "Invalid input" } };
    }
  };

  const toReview = () => {
    const p = preview();
    setErrors(p.errs);
    if (!p.calc) return;
    setReview(true);
  };

  const submit = () =>
    start(async () => {
      setError(null);
      try {
        const r = await submitAction({ attemptId: attempt.id, raw: raw(), status, submitKey: key.current });
        if (r.ok) router.refresh();
        else {
          setError(r.error);
          if (r.fieldErrors) {
            setErrors(r.fieldErrors);
            setReview(false);
          }
        }
      } catch {
        // Safe to retry: the same idempotency key means a duplicate cannot double-submit.
        setError("Network error. Press Submit again to retry; it will not create a duplicate.");
      }
    });

  const p = review ? preview() : null;
  return (
    <div className="border-line bg-surface-2 rounded-md border p-4">
      <p className="mb-3 font-semibold">
        Enter result · attempt {attempt.number}
        {attempt.elapsedMs !== null && (
          <span className="text-muted ml-2">
            Timer: <span className="tabular">{formatDuration(attempt.elapsedMs)}</span>
          </span>
        )}
      </p>
      {!review ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {cfg.fields.map((f) => (
              <div key={f.key}>
                <label htmlFor={`f-${attempt.id}-${f.key}`} className="mb-1 block text-sm font-medium">
                  {f.label}
                  {f.type === "duration_ms" ? " (seconds)" : f.unit ? ` (${f.unit})` : ""}
                  {f.required && status === "VALID" ? " *" : ""}
                </label>
                {f.type === "boolean" ? (
                  <input
                    id={`f-${attempt.id}-${f.key}`}
                    type="checkbox"
                    className="size-6 accent-[var(--brand)]"
                    checked={values[f.key] === "on"}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.checked ? "on" : "" })}
                  />
                ) : (
                  <Input
                    id={`f-${attempt.id}-${f.key}`}
                    inputMode="decimal"
                    type="number"
                    step={f.type === "integer" ? 1 : "any"}
                    min={f.type === "duration_ms" && f.min !== undefined ? f.min / 1000 : f.min}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    aria-invalid={Boolean(errors[f.key])}
                  />
                )}
                {errors[f.key] && (
                  <p role="alert" className="text-bad mt-1 text-xs">
                    {errors[f.key]}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div>
            <label htmlFor={`st-${attempt.id}`} className="mb-1 block text-sm font-medium">
              Outcome
            </label>
            <Select
              id={`st-${attempt.id}`}
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="sm:max-w-xs"
            >
              <option value="VALID">Completed</option>
              <option value="INCOMPLETE">Incomplete</option>
              <option value="DISQUALIFIED">Disqualified</option>
              <option value="WITHDRAWN">Withdrawn</option>
            </Select>
          </div>
          <Button onClick={toReview}>Review result</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted">Started</dt>
            <dd className="tabular text-right">{new Date(attempt.startedAt).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila" })}</dd>
            <dt className="text-muted">Elapsed (server)</dt>
            <dd className="tabular text-right">{attempt.elapsedMs !== null ? formatDuration(attempt.elapsedMs) : "—"}</dd>
            {cfg.fields.map((f) => (
              <div key={f.key} className="contents">
                <dt className="text-muted">{f.label}</dt>
                <dd className="tabular text-right">{values[f.key] || (f.type === "boolean" ? "No" : "—")}</dd>
              </div>
            ))}
            <dt className="text-muted">Penalties applied</dt>
            <dd className="tabular text-right">
              {p?.calc
                ? p.calc.penalty.ms
                  ? `+${formatDuration(p.calc.penalty.ms)}`
                  : p.calc.penalty.points
                    ? `−${p.calc.penalty.points}`
                    : "None"
                : "—"}
            </dd>
            <dt className="font-semibold">Calculated result</dt>
            <dd className="font-display text-right text-2xl font-bold">
              {status !== "VALID"
                ? status
                : p?.calc?.primary !== null && p?.calc
                  ? cfg.unit === "time" || ["TIME", "MULTI_STATION"].includes(cfg.template)
                    ? formatDuration(p.calc.primary as number)
                    : `${p.calc.primary}${cfg.unit && cfg.unit !== "time" ? ` ${cfg.unit}` : ""}`
                  : "—"}
            </dd>
          </dl>
          <p className="text-muted text-xs">
            The server recalculates the official result when you submit.{" "}
            {data.activity.requireApproval ? "It will be sent for approval before it is published." : "It will be published immediately."}
          </p>
          {error && (
            <p role="alert" className="text-bad text-sm">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setReview(false)} disabled={pending}>
              Edit
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending && <Loader2 className="size-5 animate-spin" aria-hidden />} Confirm &amp; submit
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Booth mode: scan a participant's QR (or type the code) to pull them up alone on screen,
 * checking them in if they have not arrived. Staff handle one participant at a time.
 */
function BoothScan({
  data,
  focus,
  onFocus,
  multi,
  checkinOnly,
}: {
  data: LeadConsoleData;
  focus?: LeadRow;
  onFocus: (id: string | null) => void;
  multi: boolean;
  checkinOnly: boolean;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [showIn, setShowIn] = useState(false);
  const [hideDone, setHideDone] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const canHeat = !checkinOnly && data.activity.status === "ACTIVE" && data.activity.config.template !== "MATCH";
  const togglePick = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  async function startPicked() {
    const ids = [...picked].filter((id) => {
      const r = data.rows.find((x) => x.id === id);
      return r && heatEligible(r, data);
    });
    if (ids.length === 0) return setError("Select at least one participant who is ready to start.");
    setBusy(true);
    const st = await startHeatAction(ids);
    setBusy(false);
    if (!st.ok) return setError(st.error);
    setError(null);
    setSelecting(false);
    setPicked(new Set());
    router.refresh();
  }
  const checkedIn = data.rows.filter((r) => r.queue !== "NOT_ARRIVED" && r.queue !== "WITHDRAWN" && !(hideDone && r.queue === "DONE"));

  async function handle(text: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const r = await scanLookupAction(data.activity.id, text);
      if (!r.ok) return setError(r.error);
      const id = r.data.activityRegistrationId;
      const row = data.rows.find((x) => x.id === id);
      const already = !!row && row.queue !== "NOT_ARRIVED";
      setCode("");
      if (multi) {
        // Group mode: scanning checks runners in; they are started together from the heat panel.
        if (!already) {
          const c = await checkInAction(id);
          if (!c.ok) return setError(c.error);
        }
        setNotice(already ? `${row?.name} is already checked in.` : `${row?.name ?? "Runner"} is checked in and ready for the ${/run/i.test(data.activity.name) ? "race" : "challenge"}.`);
      } else {
        // Booth / check-in mode: scanning only pulls the participant up. Staff tap "Check in" themselves.
        setNotice(already ? `${row?.name} is already checked in.` : null);
        onFocus(id);
        setScanning(false);
      }
      router.refresh();
    } catch {
      setError("Network error. Nothing was changed. Try scanning again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardBody>
        {focus ? (
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted text-xs tracking-wider uppercase">Now serving</p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setNotice(null);
                    onFocus(null);
                  }}
                >
                  Done
                </Button>
                <Button
                  onClick={() => {
                    setNotice(null);
                    onFocus(null);
                    setScanning(true);
                  }}
                >
                  <QrCode className="size-5" aria-hidden /> Next participant
                </Button>
              </div>
            </div>
            {notice && (
              <p role="status" className="text-ok mb-3 text-sm font-medium">
                {notice}
              </p>
            )}
            <ParticipantCard checkinOnly={checkinOnly} row={focus} data={data} others={data.rows.filter((o) => o.id !== focus.id && o.queue === "WAITING")} />
          </div>
        ) : (
          <div className={cn("flex flex-col gap-3", multi && "relative")}>
            {!multi && (
              <div className="flex flex-wrap items-center gap-2">
                <Button className="ml-auto" onClick={() => setScanning((v) => !v)}>
                  <QrCode className="size-5" aria-hidden /> {scanning ? "Close scanner" : "Scan participant QR"}
                </Button>
                {!multi && (
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (code) void handle(`CCFBGC-${code.padStart(4, "0")}`);
                    }}
                  >
                    <div className="border-line bg-surface-2 focus-within:border-accent flex w-48 items-center rounded-md border pl-3">
                      <span className="text-muted text-sm select-none">CCFBGC-</span>
                      <Input
                        aria-label="Registration number (digits after CCFBGC-)"
                        placeholder="0000"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        className="border-0 bg-transparent pl-1 focus:ring-0"
                      />
                    </div>
                    <Button type="submit" variant="secondary" disabled={busy}>
                      {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} Find
                    </Button>
                </form>
                )}
              </div>
            )}
            <Button variant="secondary" onClick={() => setShowIn((v) => !v)} className="self-start">
              <Users className="size-5" aria-hidden /> {showIn ? "Hide checked in" : `See All Checked In (${checkedIn.length})`}
            </Button>
            {showIn && canHeat && (
              <div className={cn("flex flex-wrap items-center gap-2", multi && (selecting ? "sm:absolute sm:top-0 sm:right-0" : "absolute top-0 right-0"))}>
                {!selecting ? (
                  <Button variant="secondary" onClick={() => setSelecting(true)}>
                    <Play className="size-5" aria-hidden /> Start Multiple
                  </Button>
                ) : (
                  <>
                    <Button disabled={busy || picked.size === 0} onClick={startPicked}>
                      {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Play className="size-5" aria-hidden />} Start{" "}
                      {picked.size} together
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSelecting(false);
                        setPicked(new Set());
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            )}
            {showIn && (
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={hideDone}
                  onChange={(e) => setHideDone(e.target.checked)}
                  className="size-5 accent-[var(--brand)]"
                />
                Hide Done Players
              </label>
            )}
            {showIn && (
              <ul className="divide-line border-line max-h-80 divide-y overflow-y-auto rounded-md border">
                {checkedIn.length === 0 && <li className="text-muted p-3 text-sm">Nobody has checked in yet.</li>}
                {checkedIn
                  .filter((r) => !(selecting && r.queue === "DONE"))
                  .map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 p-3">
                      {selecting && (
                        <input
                          type="checkbox"
                          aria-label={`Select ${r.name}`}
                          disabled={!heatEligible(r, data)}
                          checked={picked.has(r.id)}
                          onChange={() => togglePick(r.id)}
                          className="size-6 shrink-0 accent-[var(--brand)]"
                        />
                      )}
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left disabled:cursor-default"
                        disabled={checkinOnly}
                        onClick={() => (selecting ? togglePick(r.id) : onFocus(r.id))}
                      >
                        <span className="block max-w-full truncate font-semibold">{r.name}</span>
                        <span className="text-muted tabular text-xs">{r.code}</span>
                        <Badge tone={queueTone[r.queue]}>{r.queue.replace("_", " ")}</Badge>
                      </button>
                      <div className="flex shrink-0 items-center gap-2">
                        {!checkinOnly && !multi && !selecting && data.activity.status === "ACTIVE" && heatEligible(r, data) && (
                          <Button
                            disabled={busy}
                            onClick={async () => {
                              // Matches need an opponent, so open the participant card to pick one.
                              if (data.activity.config.template === "MATCH") return onFocus(r.id);
                              setBusy(true);
                              const st = await startAction(r.id);
                              setBusy(false);
                              if (!st.ok) return setError(st.error);
                              setError(null);
                              if (!multi) onFocus(r.id);
                              router.refresh();
                            }}
                          >
                            <Play className="size-5" aria-hidden /> Start
                          </Button>
                        )}
                        {!selecting && r.queue === "WAITING" && r.attempts.every((a) => a.status === "CANCELLED") && (
                          <Button
                            variant="danger"
                            disabled={busy}
                            onClick={async () => {
                              if (!window.confirm(`Check out ${r.name}? They will go back to "not arrived".`)) return;
                              setBusy(true);
                              const c = await checkOutAction(r.id);
                              setBusy(false);
                              if (!c.ok) return setError(c.error);
                              setError(null);
                              router.refresh();
                            }}
                          >
                            Check out
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            )}
            {scanning && <QrScanner onScan={handle} />}
            {notice && (
              <p role="status" className="text-ok text-sm">
                {notice}
              </p>
            )}
            {error && (
              <p role="alert" className="text-bad text-sm">
                {error}
              </p>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
