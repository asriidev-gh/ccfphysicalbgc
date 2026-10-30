import { Client } from "pg";
import type { Db } from "@/lib/db";

/**
 * Real-time architecture
 * ----------------------
 * PostgreSQL stays the source of truth. After a state change commits, the writer issues
 * `NOTIFY physical_bgc, '<json>'`. One long-lived LISTEN connection per server process
 * (below) fans each notification out to the SSE streams connected to that process, and
 * the browser re-fetches the authoritative state. Because every process LISTENs, this
 * works across multiple Node instances. Messages carry no data beyond identifiers, so a
 * duplicate or missed message is harmless: clients always reload state from the database,
 * including after every reconnect.
 */
export const CHANNEL = "physical_bgc";

export type BusMessage =
  | { kind: "results"; eventId: string; activityId: string }
  | { kind: "display"; eventId: string }
  | { kind: "announcement"; eventId: string };

type Listener = (msg: BusMessage) => void;

interface BusState {
  listeners: Set<Listener>;
  client: Client | null;
  starting: boolean;
  backoff: number;
  stopped: boolean;
}

const g = globalThis as unknown as { __pbgcBus?: BusState };
const state: BusState = (g.__pbgcBus ??= { listeners: new Set(), client: null, starting: false, backoff: 500, stopped: false });

async function connect(): Promise<void> {
  if (state.client || state.starting || state.stopped) return;
  state.starting = true;
  const client = new Client({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
  const retry = () => {
    state.client = null;
    state.starting = false;
    client.removeAllListeners();
    client.end().catch(() => undefined);
    if (state.stopped || state.listeners.size === 0) return;
    const wait = state.backoff;
    state.backoff = Math.min(state.backoff * 2, 15_000);
    setTimeout(() => void connect(), wait).unref?.();
  };
  client.on("error", retry);
  client.on("end", retry);
  client.on("notification", (n) => {
    if (n.channel !== CHANNEL || !n.payload) return;
    let msg: BusMessage;
    try {
      msg = JSON.parse(n.payload) as BusMessage;
    } catch {
      return;
    }
    for (const l of state.listeners) {
      try {
        l(msg);
      } catch (e) {
        console.error("[bus] listener failed", e);
      }
    }
  });
  try {
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
    state.client = client;
    state.starting = false;
    state.backoff = 500;
  } catch {
    retry();
  }
}

/** Subscribe to change notifications. Returns an unsubscribe function. */
export function subscribe(listener: Listener): () => void {
  state.listeners.add(listener);
  void connect();
  return () => {
    state.listeners.delete(listener);
    if (state.listeners.size === 0 && state.client) {
      const c = state.client;
      state.client = null;
      c.removeAllListeners();
      c.end().catch(() => undefined);
    }
  };
}

/** Test hook: drop the LISTEN connection to exercise reconnection. */
export async function __dropConnectionForTests(): Promise<void> {
  const c = state.client;
  if (c) await c.end();
}

export async function publish(db: Db, msg: BusMessage): Promise<void> {
  await db.$executeRaw`SELECT pg_notify(${CHANNEL}, ${JSON.stringify(msg)})`;
}
