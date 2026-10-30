"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Flag, Loader2, Pencil, Trash2, Play, QrCode, Square, UserCheck, Users, X } from "lucide-react";
import {
  cancelAttemptAction,
  checkInAction,
  correctAction,
  deleteResultAction,
  disputeAction,
  finishAction,
  finishRunnerAction,
  reviewAction,
  startHeatAction,
  scanLookupAction,
  startAction,
  submitAction,
} from "@/app/actions/lead";
import { ActionForm } from "@/components/action-form";
import { QrScanner } from "./scanner";
import { RunningTimer } from "@/components/timer";
import { Badge, Button, Card, CardBody, Input, Select, Stat } from "@/components/ui";
import { calculate, formatDuration, ScoringError } from "@/lib/scoring/engine";
import type { ActionResult } from "@/lib/errors";
import type { LeadAttempt, LeadConsoleData, LeadRow } from "@/lib/services/lead";
import { cn } from "@/lib/utils";

type Filter = "ALL" | "NO_RECORD" | "NOT_ARRIVED" | "WAITING" | "IN_PROGRESS" | "DONE";
const FILTERS: [Filter, string][] = [
  ["ALL", "All"],
  ["NO_RECORD", "No record yet"],
  ["NOT_ARRIVED", "Not arrived"],
  ["WAITING", "Waiting"],
  ["IN_PROGRESS", "In progress"],
  ["DONE", "Done"],
];

export function LeadConsole({ data, mode, multi = false }: { data: LeadConsoleData; mode: "booth" | "roster"; multi?: boolean }) {
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
      {mode === "booth" && <BoothScan data={data} focus={focus} onFocus={setFocusId} multi={multi} />}
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
      {mode === "booth" && multi && <HeatPanel data={data} />}
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
          <Users className="size-5" aria-hidden /> Select for heat
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
          <Button variant="secondary" size="sm" onClick={() => onPicked(allVisible ? new Set() : new Set(visible.map((r) => r.id)))}>
            {allVisible ? "Clear" : "Select all shown"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onStop}>
            Cancel
          </Button>
          <Button
            size="lg"
            disabled={pending || data.activity.status !== "ACTIVE" || ids.length === 0}
            onClick={() => run(() => startHeatAction(ids), onStop)}
          >
            {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Play className="size-5" aria-hidden />} Start heat (
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

function ParticipantCard({
  row,
  data,
  others,
  select,
}: {
  row: LeadRow;
  data: LeadConsoleData;
  others: LeadRow[];
  select?: { checked: boolean; onToggle: () => void };
}) {
  const { run, pending, error } = useAct();
  const [opponent, setOpponent] = useState("");
  const isMatch = data.activity.config.template === "MATCH";
  const used = row.attempts.filter((a) => a.status !== "CANCELLED").length;
  const remaining = used < data.activity.maxAttempts;
  const running = row.attempts.find((a) => a.status === "RUNNING");
  const finished = row.attempts.find((a) => a.status === "FINISHED");
  const canStart =
    data.activity.status === "ACTIVE" &&
    row.queue === "WAITING" &&
    remaining &&
    row.participantStatus === "ACTIVE" &&
    !running &&
    !finished;

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
                <Badge tone={queueTone[row.queue]}>{row.queue.replace("_", " ")}</Badge>
                {row.participantStatus !== "ACTIVE" && <Badge tone="bad">{row.participantStatus}</Badge>}
                <Badge>
                  {used}/{data.activity.maxAttempts} attempts
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {row.queue === "NOT_ARRIVED" && (
              <Button size="lg" variant="accent" disabled={pending} onClick={() => run(() => checkInAction(row.id))}>
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
                  size="lg"
                  disabled={pending || (isMatch && !opponent)}
                  onClick={() => run(() => startAction(row.id, isMatch ? opponent : undefined))}
                >
                  {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Play className="size-5" aria-hidden />} Start
                </Button>
              </>
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-bad mt-3 text-sm">
            {error}
          </p>
        )}

        {running && (
          <div className="border-brand/40 bg-brand/10 mt-4 rounded-md border p-4">
            <p className="text-muted text-xs tracking-wider uppercase">
              Attempt {running.number} running{running.opponentName ? ` vs ${running.opponentName}` : ""}
            </p>
            <RunningTimer
              startedAt={running.startedAt}
              serverNow={data.serverNow}
              className="tabular font-display block text-5xl font-bold"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="lg" disabled={pending} onClick={() => run(() => finishAction(running.id))}>
                <Square className="size-5" aria-hidden /> Stop &amp; score
              </Button>
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

/** Group start for timed sports: one start instant for everyone, then tap each runner as they finish. */
function HeatPanel({ data }: { data: LeadConsoleData }) {
  const { run, pending, error } = useAct();
  const [picked, setPicked] = useState<Set<string>>(new Set());
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

  return (
    <Card className="mt-4">
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg font-bold uppercase">Heat start</p>
            <p className="text-muted text-xs">Select runners who are checked in. They all start on the same server instant.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {waiting.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => setPicked(chosen.length === waiting.length ? new Set() : new Set(waiting.map((r) => r.id)))}
              >
                {chosen.length === waiting.length ? "Clear" : "Select all"}
              </Button>
            )}
            <Button
              size="lg"
              disabled={pending || !active || chosen.length === 0}
              onClick={() =>
                run(
                  () => startHeatAction(chosen.map((r) => r.id)),
                  () => setPicked(new Set()),
                )
              }
            >
              {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Play className="size-5" aria-hidden />} Start heat (
              {chosen.length})
            </Button>
          </div>
        </div>

        {waiting.length === 0 ? (
          <p className="text-muted text-sm">No one is waiting. Check runners in first (scan their QR or use the roster).</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {waiting.map((r) => (
              <li key={r.id}>
                <label className="border-line bg-surface-2 flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3">
                  <input
                    type="checkbox"
                    checked={picked.has(r.id)}
                    onChange={() => toggle(r.id)}
                    className="size-5 accent-[var(--brand)]"
                  />
                  <span className="truncate">{r.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p role="alert" className="text-bad text-sm">
            {error}
          </p>
        )}

        {running.length > 0 && (
          <div>
            <p className="text-muted mb-2 text-xs tracking-wider uppercase">Running · tap a runner when they finish</p>
            <ul className="space-y-2">
              {running.map(({ row, attempt }) => (
                <li key={attempt.id} className="border-brand/40 bg-brand/10 rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{row.name}</p>
                      <RunningTimer
                        startedAt={attempt.startedAt}
                        serverNow={data.serverNow}
                        className="tabular font-display text-3xl font-bold"
                      />
                    </div>
                    <Button size="lg" disabled={pending} onClick={() => run(() => finishRunnerAction(attempt.id))}>
                      <Square className="size-5" aria-hidden /> Finish
                    </Button>
                  </div>
                  <div className="mt-2">
                    <CancelAttempt attemptId={attempt.id} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {heatList.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted text-xs tracking-wider uppercase">Heat results</p>
            {heatList.map(([n, items], i) => {
              const ordered = [...items].sort((a, b) => {
                const av = a.attempt.result!.value;
                const bv = b.attempt.result!.value;
                if (av === null || bv === null) return av === bv ? 0 : av === null ? 1 : -1;
                return (av - bv) * dir;
              });
              return (
                <details key={n} open={i === 0} className="border-line rounded-md border">
                  <summary className="cursor-pointer px-3 py-2 font-semibold">
                    Heat {n}{" "}
                    <span className="text-muted text-sm font-normal">
                      · {items.length} runner{items.length === 1 ? "" : "s"}
                    </span>
                  </summary>
                  <ol className="divide-line border-line divide-y border-t">
                    {ordered.map(({ row, attempt }, k) => (
                      <li key={attempt.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <span className="min-w-0 truncate">
                          <span className="text-muted tabular mr-2">{attempt.result!.status === "VALID" ? k + 1 : "–"}</span>
                          {row.name}
                        </span>
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
                <p className="mb-1 font-semibold">{row.name}</p>
                <ScorePanel attempt={attempt} data={data} />
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function CancelAttempt({ attemptId }: { attemptId: string }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <X className="size-4" aria-hidden /> Cancel attempt
      </Button>
    );
  return (
    <ActionForm
      action={cancelAttemptAction.bind(null, attemptId)}
      submitLabel="Confirm cancel"
      variant="danger"
      size="sm"
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-muted text-xs">
            Attempt {attempt.number}
            {attempt.opponentName ? ` vs ${attempt.opponentName}` : ""}
          </span>
          <p className="tabular font-display text-2xl font-bold">{r.display}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          {r.approval === "PENDING" &&
            !r.disputed &&
            (mustBeOther ? (
              <span className="text-muted text-xs">A different reviewer must approve</span>
            ) : (
              <>
                <Button size="sm" disabled={pending} onClick={() => run(() => reviewAction(r.id, "APPROVED"))}>
                  <Check className="size-4" aria-hidden /> Approve
                </Button>
                <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => reviewAction(r.id, "REJECTED"))}>
                  Reject
                </Button>
              </>
            ))}
          <Button size="sm" variant="ghost" onClick={() => setEdit((e) => !e)}>
            <Pencil className="size-4" aria-hidden /> Edit score
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Delete this score? It is removed from the leaderboard and the participant can run again."))
                run(() => deleteResultAction(r.id));
            }}
          >
            <Trash2 className="size-4" aria-hidden /> Delete
          </Button>
          {!r.disputed && (
            <Button size="sm" variant="ghost" onClick={() => setFlag((f) => !f)}>
              <Flag className="size-4" aria-hidden /> Flag
            </Button>
          )}
        </div>
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
          size="sm"
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
  const [values, setValues] = useState<Record<string, string>>({});
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
          <Button size="lg" onClick={toReview}>
            Review result
          </Button>
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
            <Button variant="secondary" size="lg" onClick={() => setReview(false)} disabled={pending}>
              Edit
            </Button>
            <Button size="lg" onClick={submit} disabled={pending}>
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
}: {
  data: LeadConsoleData;
  focus?: LeadRow;
  onFocus: (id: string | null) => void;
  multi: boolean;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

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
      if (row?.queue === "NOT_ARRIVED") {
        const c = await checkInAction(id);
        if (!c.ok) return setError(c.error);
      }
      setCode("");
      if (multi) {
        // Group mode: scanning only checks runners in; they are started together from the heat panel.
        setNotice(`${row?.name ?? "Runner"} is checked in and ready for the heat.`);
      } else {
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
                <Button variant="secondary" onClick={() => onFocus(null)}>
                  Done
                </Button>
                <Button
                  onClick={() => {
                    onFocus(null);
                    setScanning(true);
                  }}
                >
                  <QrCode className="size-5" aria-hidden /> Next participant
                </Button>
              </div>
            </div>
            <ParticipantCard row={focus} data={data} others={data.rows.filter((o) => o.id !== focus.id && o.queue === "WAITING")} />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="lg" onClick={() => setScanning((v) => !v)}>
                <QrCode className="size-5" aria-hidden /> {scanning ? "Close scanner" : "Scan participant QR"}
              </Button>
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
            </div>
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
